/**
 * Indian Prescription NLP Parser
 * Extracts structured medication data from raw OCR text.
 */

import brandToGeneric from "@/data/brandToGeneric.json";

// Indian medical abbreviation map
const ABBREVIATION_MAP: Record<string, string> = {
  od: "once daily",
  bd: "twice daily",
  bid: "twice daily",
  tds: "three times daily",
  tid: "three times daily",
  qid: "four times daily",
  sos: "when needed (SOS)",
  prn: "when needed",
  hs: "at bedtime",
  ac: "before meals",
  pc: "after meals",
  stat: "immediately",
  nocte: "at night",
  mane: "in the morning",
};

const DOSAGE_FORMS = [
  "tablet", "tab", "capsule", "cap", "syrup", "syr", "injection", "inj",
  "cream", "ointment", "drops", "suspension", "susp", "inhaler", "gel",
  "patch", "solution", "lotion", "powder", "sachet", "spray",
];

export interface ParsedMedication {
  drug: string;
  generic?: string;
  dosage?: string;
  frequency?: string;
  form?: string;
  raw: string;
  confidence: number;
}

// Build a lookup of known drug names (brand + generic)
const allKnownDrugs: string[] = [
  ...Object.keys(brandToGeneric),
  ...new Set(Object.values(brandToGeneric).flatMap((v) =>
    typeof v === "string" ? v.split(" + ").map((s) => s.trim().toLowerCase()) : []
  )),
].map((d) => d.toLowerCase());

/**
 * Levenshtein distance for fuzzy matching
 */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

/**
 * Fuzzy match a token against known drug names
 */
function fuzzyMatchDrug(token: string): { name: string; confidence: number } | null {
  const t = token.toLowerCase();
  if (t.length < 3) return null;

  // Exact match
  if (allKnownDrugs.includes(t)) return { name: t, confidence: 1.0 };

  // Prefix match
  const prefixMatch = allKnownDrugs.find((d) => d.startsWith(t) && d.length - t.length <= 3);
  if (prefixMatch) return { name: prefixMatch, confidence: 0.9 };

  // Fuzzy match
  let best: { name: string; dist: number } | null = null;
  for (const drug of allKnownDrugs) {
    if (Math.abs(drug.length - t.length) > 3) continue;
    const dist = levenshtein(t, drug);
    const threshold = Math.max(1, Math.floor(drug.length * 0.3));
    if (dist <= threshold && (!best || dist < best.dist)) {
      best = { name: drug, dist };
    }
  }
  if (best) return { name: best.name, confidence: Math.max(0.5, 1 - best.dist / best.name.length) };

  return null;
}

/**
 * Clean raw OCR text
 */
export function cleanOcrText(raw: string): string {
  return raw
    .replace(/[|\\{}[\]@#$%^&*_=~`]/g, " ") // remove noise symbols
    .replace(/\s+/g, " ")                      // collapse whitespace
    .replace(/(\d)\s+(mg|ml|mcg|g|iu)\b/gi, "$1$2") // join dosage numbers
    .trim();
}

/**
 * Parse cleaned OCR text into structured medications
 */
export function parsePrescriptionText(text: string): ParsedMedication[] {
  const cleaned = cleanOcrText(text);
  const lines = cleaned.split(/\n|;|,\s*(?=[A-Z])/);
  const results: ParsedMedication[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) continue;

    const tokens = trimmed.split(/\s+/);
    let drugMatch: { name: string; confidence: number } | null = null;
    let dosage: string | undefined;
    let frequency: string | undefined;
    let form: string | undefined;

    // Try multi-word brand names first (e.g. "dolo 650", "pan 40")
    for (let i = 0; i < tokens.length - 1; i++) {
      const twoWord = `${tokens[i]} ${tokens[i + 1]}`.toLowerCase();
      if (allKnownDrugs.includes(twoWord)) {
        drugMatch = { name: twoWord, confidence: 1.0 };
        break;
      }
    }

    // Single token matching
    if (!drugMatch) {
      for (const token of tokens) {
        const match = fuzzyMatchDrug(token);
        if (match && (!drugMatch || match.confidence > drugMatch.confidence)) {
          drugMatch = match;
        }
      }
    }

    // Extract dosage (e.g. "500mg", "250 mg")
    const dosageMatch = trimmed.match(/\b(\d+(?:\.\d+)?)\s*(mg|ml|mcg|g|iu|units?)\b/i);
    if (dosageMatch) dosage = `${dosageMatch[1]} ${dosageMatch[2].toLowerCase()}`;

    // Extract frequency abbreviations
    for (const token of tokens) {
      const t = token.toLowerCase().replace(/[.,;:()]/g, "");
      if (ABBREVIATION_MAP[t]) {
        frequency = ABBREVIATION_MAP[t];
        break;
      }
    }

    // Extract form
    for (const token of tokens) {
      const t = token.toLowerCase().replace(/[.,;:()]/g, "");
      if (DOSAGE_FORMS.includes(t)) {
        form = t === "tab" ? "tablet" : t === "cap" ? "capsule" : t === "syr" ? "syrup" : t === "inj" ? "injection" : t === "susp" ? "suspension" : t;
        break;
      }
    }

    if (drugMatch) {
      const generic = (brandToGeneric as Record<string, string>)[drugMatch.name];
      results.push({
        drug: drugMatch.name,
        generic: generic || undefined,
        dosage,
        frequency,
        form,
        raw: trimmed,
        confidence: drugMatch.confidence,
      });
    }
  }

  return results;
}
