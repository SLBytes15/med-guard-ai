import { supabase } from "@/integrations/supabase/client";

export interface Medication {
  name: string;
}

export interface Interaction {
  drugA: string;
  drugB: string;
  severity: "Low" | "Moderate" | "High";
  message: string;
}

export interface AnalysisResult {
  interactions: Interaction[];
  timestamp: string;
  medicationCount: number;
}

const normalize = (name: string) => name.toLowerCase().trim();

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

export function checkInteractions(medications: Medication[]): AnalysisResult {
  const interactions: Interaction[] = [];
  for (let i = 0; i < medications.length; i++) {
    for (let j = i + 1; j < medications.length; j++) {
      const a = normalize(medications[i].name);
      const b = normalize(medications[j].name);
      for (const rule of fallbackRules) {
        if ((rule.drug === a && rule.interactsWith === b) || (rule.drug === b && rule.interactsWith === a)) {
          interactions.push({ drugA: medications[i].name, drugB: medications[j].name, severity: rule.severity, message: rule.message });
        }
      }
    }
  }
  return { interactions, timestamp: new Date().toISOString(), medicationCount: medications.length };
}

export const drugSuggestions = [
  "Paracetamol", "Ibuprofen", "Aspirin", "Warfarin", "Metformin",
  "Simvastatin", "Amoxicillin", "Lisinopril", "Ciprofloxacin", "Omeprazole",
  "Amlodipine", "Fluoxetine", "Digoxin", "Metoprolol", "Losartan",
  "Atorvastatin", "Clopidogrel", "Tramadol", "Verapamil", "Amiodarone",
  "Cetirizine", "Diclofenac", "Naproxen", "Alprazolam", "Pantoprazole",
];
