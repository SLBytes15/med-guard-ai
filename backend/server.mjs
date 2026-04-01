import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "0.0.0.0";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_ORIGIN || "http://localhost:8080")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const normalize = (value = "") => value.toString().toLowerCase().trim().replace(/\s+/g, " ");
const canonicalKey = (a, b) => [normalize(a), normalize(b)].sort().join(" + ");
const splitPair = (pair = "") => pair.split(/\s*\+\s*/).map((item) => item.trim()).filter(Boolean);
const levelRank = (level = "") => {
  const v = String(level).toUpperCase();
  if (v === "HIGH") return 3;
  if (v === "MEDIUM") return 2;
  return 1;
};

const toSeverity = (level = "MEDIUM") => {
  const val = String(level).toUpperCase();
  if (val === "HIGH") return "High";
  if (val === "LOW") return "Low";
  return "Moderate";
};

const toRiskRank = (severity) => {
  if (severity === "High") return 3;
  if (severity === "Moderate") return 2;
  return 1;
};

const getDatasetPath = () => {
  const explicitPath = process.env.INTERACTIONS_FILE;
  if (explicitPath && existsSync(explicitPath)) return explicitPath;

  const preferred = resolve(process.cwd(), "data", "kaggle_interactions.json");
  if (existsSync(preferred)) return preferred;

  return resolve(process.cwd(), "data", "drug_interactions.json");
};

const normalizeRawRule = (rule, fallbackLevel = "MEDIUM", source = "core") => {
  const level = String(rule?.level || fallbackLevel).toUpperCase();
  const reason = rule?.reason || rule?.description || "Potential interaction detected.";
  const advice =
    rule?.advice ||
    (level === "HIGH"
      ? "Avoid this combination unless explicitly advised by a doctor."
      : level === "MEDIUM"
      ? "Use with caution and monitor symptoms."
      : "Usually safe in normal doses, but monitor for unusual effects.");
  const diseaseRisk =
    rule?.disease_risk && typeof rule.disease_risk === "object" ? rule.disease_risk : undefined;
  return { level, reason, advice, diseaseRisk, source };
};

const parseInteractionFile = (filePath, options = {}) => {
  const fallbackLevel = options.fallbackLevel || "MEDIUM";
  const source = options.source || "core";
  const raw = JSON.parse(readFileSync(filePath, "utf8"));

  // Flat map format: { "aspirin + warfarin": {level, reason} }
  if (raw && typeof raw === "object" && !raw.interactions) {
    const flat = {};
    const drugs = new Set();
    for (const [pairKey, rule] of Object.entries(raw)) {
      const [a, b] = splitPair(pairKey);
      if (!a || !b) continue;
      flat[canonicalKey(a, b)] = normalizeRawRule(rule, fallbackLevel, source);
      if (a) drugs.add(normalize(a));
      if (b) drugs.add(normalize(b));
    }
    return { flatMap: flat, knownDrugs: [...drugs].sort() };
  }

  // Nested Kaggle format: { interactions: { drugA: { drugB: {level, description}}}}
  const nested = raw?.interactions || {};
  const flat = {};
  const drugs = new Set();

  for (const [drugA, neighbors] of Object.entries(nested)) {
    drugs.add(normalize(drugA));
    if (!neighbors || typeof neighbors !== "object") continue;

    for (const [drugB, rule] of Object.entries(neighbors)) {
      drugs.add(normalize(drugB));
      const key = canonicalKey(drugA, drugB);
      flat[key] = normalizeRawRule(rule, fallbackLevel, source);
    }
  }

  return { flatMap: flat, knownDrugs: [...drugs].sort() };
};

const infoRank = (rule) => {
  const advicePoints = rule?.advice ? 1 : 0;
  const diseaseRiskPoints =
    rule?.diseaseRisk && typeof rule.diseaseRisk === "object" ? Object.keys(rule.diseaseRisk).length : 0;
  return advicePoints + diseaseRiskPoints;
};

const mergeInteractionMaps = (baseMap, overrideMap) => {
  const merged = { ...baseMap };
  for (const [k, rule] of Object.entries(overrideMap)) {
    const existing = merged[k];
    const incomingRank = levelRank(rule.level);
    const existingRank = existing ? levelRank(existing.level) : 0;

    if (
      !existing ||
      incomingRank > existingRank ||
      (incomingRank === existingRank && infoRank(rule) >= infoRank(existing))
    ) {
      merged[k] = rule;
    }
  }
  return merged;
};

const loadInteractions = () => {
  const primaryPath = getDatasetPath();
  const datasets = [
    { path: primaryPath, fallbackLevel: "MEDIUM", source: "kaggle" },
    {
      path: resolve(process.cwd(), "data", "india", "interaction_db_india.json"),
      fallbackLevel: "MEDIUM",
      source: "india-core",
    },
    {
      path: resolve(process.cwd(), "data", "india", "high_risk_interactions.json"),
      fallbackLevel: "HIGH",
      source: "india-high-risk",
    },
    {
      path: resolve(process.cwd(), "data", "india", "medium_risk_drug_interactions_110.json"),
      fallbackLevel: "MEDIUM",
      source: "india-medium-risk",
    },
    {
      path: resolve(process.cwd(), "data", "india", "low_risk_interactions_120.json"),
      fallbackLevel: "LOW",
      source: "india-low-risk",
    },
  ];

  let flatMap = {};
  const drugs = new Set();
  const sources = [];

  for (const dataset of datasets) {
    if (!existsSync(dataset.path)) continue;
    const parsed = parseInteractionFile(dataset.path, {
      fallbackLevel: dataset.fallbackLevel,
      source: dataset.source,
    });
    flatMap = mergeInteractionMaps(flatMap, parsed.flatMap);
    for (const d of parsed.knownDrugs) drugs.add(d);
    sources.push(dataset.path);
  }

  return { datasetSources: sources, flatMap, knownDrugs: [...drugs].sort() };
};

const { datasetSources, flatMap: interactionMap, knownDrugs: knownDrugsSorted } = loadInteractions();

const resolveCorsOrigin = (requestOrigin) => {
  if (ALLOWED_ORIGINS.includes("*")) return "*";
  if (!requestOrigin) return ALLOWED_ORIGINS[0] || "";
  if (ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin;
  return "";
};

const sendJson = (res, statusCode, payload) => {
  const corsOrigin = resolveCorsOrigin(res.req?.headers?.origin);
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-API-Key",
    Vary: "Origin",
  };

  if (corsOrigin) headers["Access-Control-Allow-Origin"] = corsOrigin;

  res.writeHead(statusCode, {
    ...headers,
  });
  res.end(JSON.stringify(payload));
};

const parseBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
};

const extractMedicationName = (item) => {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") return item.name || "";
  return "";
};

const findInteractions = (medications) => {
  const interactions = [];

  for (let i = 0; i < medications.length; i += 1) {
    for (let j = i + 1; j < medications.length; j += 1) {
      const drugA = medications[i];
      const drugB = medications[j];
      const key = canonicalKey(drugA, drugB);
      const rule = interactionMap[key];

      if (!rule) continue;

      interactions.push({
        drugA,
        drugB,
        severity: toSeverity(rule.level),
        message: rule.reason,
        reason: rule.reason,
        advice: rule.advice,
        diseaseRisk: rule.diseaseRisk || null,
        source: rule.source || "unknown",
      });
    }
  }

  return interactions.sort((a, b) => toRiskRank(b.severity) - toRiskRank(a.severity));
};

const buildSummary = (interactions) => {
  const summary = { total: interactions.length, high: 0, moderate: 0, low: 0 };
  for (const item of interactions) {
    if (item.severity === "High") summary.high += 1;
    else if (item.severity === "Moderate") summary.moderate += 1;
    else summary.low += 1;
  }
  return summary;
};

const server = createServer(async (req, res) => {
  try {
    const corsOrigin = resolveCorsOrigin(req.headers.origin);
    if (req.method === "OPTIONS") {
      if (!corsOrigin && req.headers.origin) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Origin not allowed" }));
        return;
      }

      const headers = {
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-API-Key",
        Vary: "Origin",
      };
      if (corsOrigin) headers["Access-Control-Allow-Origin"] = corsOrigin;
      res.writeHead(204, headers);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        service: "med-guard-api",
        interactions_loaded: Object.keys(interactionMap).length,
        datasets: datasetSources,
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/drugs/suggest") {
      const q = normalize(url.searchParams.get("q") || "");
      if (q.length < 2) {
        sendJson(res, 200, { suggestions: [] });
        return;
      }

      const suggestions = knownDrugsSorted.filter((drug) => drug.includes(q)).slice(0, 15);
      sendJson(res, 200, { suggestions });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/check-interactions") {
      const body = await parseBody(req);
      const list = Array.isArray(body.medications) ? body.medications : [];

      const medications = list
        .map(extractMedicationName)
        .map((name) => name.trim())
        .filter(Boolean);

      if (medications.length < 2) {
        sendJson(res, 400, { error: "Provide at least 2 medications" });
        return;
      }

      const interactions = findInteractions(medications);

      sendJson(res, 200, {
        interactions,
        timestamp: new Date().toISOString(),
        medicationCount: medications.length,
        summary: buildSummary(interactions),
      });
      return;
    }

    /** Pharmacy / billing demo — body: { drugs: ["aspirin", "warfarin"] } */
    if (req.method === "POST" && url.pathname === "/api/analyze") {
      const body = await parseBody(req);
      const raw = Array.isArray(body.drugs) ? body.drugs : [];
      const seen = new Set();
      const medications = [];
      for (const item of raw) {
        const name = typeof item === "string" ? item.trim() : String(item || "").trim();
        if (!name) continue;
        const key = normalize(name);
        if (seen.has(key)) continue;
        seen.add(key);
        medications.push(name);
      }

      if (medications.length < 2) {
        sendJson(res, 200, {
          interactions: [],
          timestamp: new Date().toISOString(),
          medicationCount: medications.length,
          summary: { total: 0, high: 0, moderate: 0, low: 0 },
        });
        return;
      }

      const interactions = findInteractions(medications);
      sendJson(res, 200, {
        interactions,
        timestamp: new Date().toISOString(),
        medicationCount: medications.length,
        summary: buildSummary(interactions),
      });
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, {
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Backend API running on http://${HOST}:${PORT}`);
});
