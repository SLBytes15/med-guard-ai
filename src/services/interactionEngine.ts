import { supabase } from "@/integrations/supabase/client";

export interface Medication {
  name: string;
}

export interface Interaction {
  drugA: string;
  drugB: string;
  severity: "Low" | "Moderate" | "High";
  message: string;
  reason?: string;
  advice?: string;
  diseaseRisk?: Record<string, string> | null;
  source?: string;
}

export interface AnalysisResult {
  interactions: Interaction[];
  timestamp: string;
  medicationCount: number;
  summary?: {
    total: number;
    high: number;
    moderate: number;
    low: number;
  };
}

const normalize = (name: string) => name.toLowerCase().trim();
const canonicalPairKey = (a: string, b: string) => [normalize(a), normalize(b)].sort().join(" + ");

type InteractionLevel = "HIGH" | "MEDIUM" | "LOW";

interface InteractionLookupEntry {
  level: InteractionLevel;
  reason: string;
  advice?: string;
  disease_risk?: Record<string, string>;
  source?: string;
}

type InteractionLookupMap = Record<string, InteractionLookupEntry>;

let interactionLookupPromise: Promise<InteractionLookupMap> | null = null;
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const mapLevelToSeverity = (level: string): Interaction["severity"] => {
  const value = level.toUpperCase();
  if (value === "HIGH") return "High";
  if (value === "LOW") return "Low";
  return "Moderate";
};

const loadInteractionLookup = async (): Promise<InteractionLookupMap> => {
  if (!interactionLookupPromise) {
    interactionLookupPromise = Promise.all([
      fetch("/data/drug_interactions.json").then((res) => (res.ok ? (res.json() as Promise<InteractionLookupMap>) : {})),
      fetch("/data/india/interaction_db_india.json").then((res) => (res.ok ? (res.json() as Promise<InteractionLookupMap>) : {})),
      fetch("/data/india/high_risk_interactions.json").then((res) =>
        res.ok ? (res.json() as Promise<InteractionLookupMap>) : {}
      ),
      fetch("/data/india/medium_risk_drug_interactions_110.json").then((res) =>
        res.ok ? (res.json() as Promise<InteractionLookupMap>) : {}
      ),
      fetch("/data/india/low_risk_interactions_120.json").then((res) =>
        res.ok ? (res.json() as Promise<InteractionLookupMap>) : {}
      ),
    ])
      .then(([base, india, highRisk, mediumRisk, lowRisk]) => {
        const merged: InteractionLookupMap = { ...base };
        const rank = (lvl?: string) => (lvl === "HIGH" ? 3 : lvl === "MEDIUM" ? 2 : 1);
        const score = (entry?: InteractionLookupEntry) =>
          (entry?.advice ? 1 : 0) + (entry?.disease_risk ? Object.keys(entry.disease_risk).length : 0);
        const apply = (dataset: InteractionLookupMap, defaultLevel: InteractionLevel, source: string) => {
          for (const [key, value] of Object.entries(dataset)) {
            const normalized: InteractionLookupEntry = {
              level: (value.level || defaultLevel) as InteractionLevel,
              reason: value.reason,
              advice: value.advice,
              disease_risk: value.disease_risk,
              source,
            };
            const existing = merged[key];
            if (
              !existing ||
              rank(normalized.level) > rank(existing.level) ||
              (rank(normalized.level) === rank(existing.level) && score(normalized) >= score(existing))
            ) {
              merged[key] = normalized;
            }
          }
        };

        apply(india, "MEDIUM", "india-core-local");
        apply(highRisk, "HIGH", "india-high-risk-local");
        apply(mediumRisk, "MEDIUM", "india-medium-risk-local");
        apply(lowRisk, "LOW", "india-low-risk-local");

        for (const [key, value] of Object.entries(merged)) {
          if (!value.source) {
            merged[key] = { ...value, source: "base-local" };
          }
        }
        return merged;
      })
      .catch(() => ({}));
  }
  return interactionLookupPromise;
};

export async function searchDrugNames(query: string): Promise<string[]> {
  if (!query || query.length < 2) return [];
  const { data } = await supabase
    .from("medications_dataset")
    .select("drug_name")
    .ilike("drug_name", `${query}%`)
    .limit(50);

  if (!data) return [];
  const unique = [...new Set(data.map((r) => r.drug_name))];
  return unique.sort().slice(0, 8);
}

export async function checkInteractionsFromDB(medications: Medication[]): Promise<AnalysisResult> {
  const interactions: Interaction[] = [];
  const names = medications.map((m) => m.name);

  // For each pair, query DB
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i];
      const b = names[j];

      const { data: rules } = await supabase
        .from("medications_dataset")
        .select("*")
        .or(
          `and(drug_name.ilike.${a},interacts_with.ilike.${b}),and(drug_name.ilike.${b},interacts_with.ilike.${a})`
        )
        .limit(1);

      if (rules && rules.length > 0) {
        const rule = rules[0];
        interactions.push({
          drugA: a,
          drugB: b,
          severity: (rule.severity === "High" || rule.severity === "Low") ? rule.severity as "High" | "Low" : "Moderate",
          message: rule.description,
        });
      }
    }
  }

  return {
    interactions,
    timestamp: new Date().toISOString(),
    medicationCount: medications.length,
  };
}

export async function checkInteractionsFromAPI(medications: Medication[]): Promise<AnalysisResult> {
  const apiPath = API_BASE_URL ? `${API_BASE_URL}/api/check-interactions` : "/api/check-interactions";
  const response = await fetch(apiPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ medications }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Backend API error (${response.status}): ${text || "Unknown error"}`);
  }

  return response.json() as Promise<AnalysisResult>;
}

// Fallback client-side rules
interface InteractionRule {
  drug: string;
  interactsWith: string;
  severity: "Low" | "Moderate" | "High";
  message: string;
}

const fallbackRules: InteractionRule[] = [
  { drug: "paracetamol", interactsWith: "ibuprofen", severity: "Low", message: "Generally safe when used in correct doses." },
  { drug: "aspirin", interactsWith: "warfarin", severity: "High", message: "Severe bleeding risk." },
  { drug: "ibuprofen", interactsWith: "aspirin", severity: "High", message: "Increased risk of bleeding and stomach ulcers." },
  { drug: "ibuprofen", interactsWith: "warfarin", severity: "High", message: "Increased bleeding risk." },
  { drug: "omeprazole", interactsWith: "clopidogrel", severity: "High", message: "Reduces antiplatelet effectiveness." },
  { drug: "fluoxetine", interactsWith: "tramadol", severity: "High", message: "Risk of serotonin syndrome." },
  { drug: "digoxin", interactsWith: "amiodarone", severity: "High", message: "Increased digoxin toxicity risk." },
];

const fallbackMap: Record<string, InteractionRule> = fallbackRules.reduce((acc, rule) => {
  acc[canonicalPairKey(rule.drug, rule.interactsWith)] = rule;
  return acc;
}, {} as Record<string, InteractionRule>);

export async function checkInteractions(medications: Medication[]): Promise<AnalysisResult> {
  const lookup = await loadInteractionLookup();
  const interactions: Interaction[] = [];

  for (let i = 0; i < medications.length; i++) {
    for (let j = i + 1; j < medications.length; j++) {
      const key = canonicalPairKey(medications[i].name, medications[j].name);
      const fromLookup = lookup[key];

      if (fromLookup) {
        interactions.push({
          drugA: medications[i].name,
          drugB: medications[j].name,
          severity: mapLevelToSeverity(fromLookup.level),
          message: fromLookup.reason,
          reason: fromLookup.reason,
          advice: fromLookup.advice,
          diseaseRisk: fromLookup.disease_risk || null,
          source: fromLookup.source,
        });
        continue;
      }

      const fallback = fallbackMap[key];
      if (fallback) {
        interactions.push({
          drugA: medications[i].name,
          drugB: medications[j].name,
          severity: fallback.severity,
          message: fallback.message,
          reason: fallback.message,
        });
      }
    }
  }

  return {
    interactions: interactions.sort((a, b) => {
      const rank: Record<Interaction["severity"], number> = { High: 3, Moderate: 2, Low: 1 };
      return rank[b.severity] - rank[a.severity];
    }),
    timestamp: new Date().toISOString(),
    medicationCount: medications.length,
  };
}

export const drugSuggestions = [
  "Paracetamol", "Ibuprofen", "Aspirin", "Warfarin", "Metformin",
  "Simvastatin", "Amoxicillin", "Lisinopril", "Ciprofloxacin", "Omeprazole",
  "Amlodipine", "Fluoxetine", "Digoxin", "Metoprolol", "Losartan",
  "Atorvastatin", "Clopidogrel", "Tramadol", "Verapamil", "Amiodarone",
  "Cetirizine", "Diclofenac", "Naproxen", "Alprazolam", "Pantoprazole",
];
