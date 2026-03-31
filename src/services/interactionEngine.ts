import { supabase } from "@/integrations/supabase/client";

export interface Medication {
  name: string;
  dosage: string;
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

export async function checkInteractionsFromDB(medications: Medication[]): Promise<AnalysisResult> {
  const interactions: Interaction[] = [];
  const names = medications.map((m) => m.name);

  const { data: rules } = await supabase
    .from("medications_dataset")
    .select("*")
    .or(
      names.map((n) => `drug_name.ilike.%${n}%`).join(",") + "," +
      names.map((n) => `interacts_with.ilike.%${n}%`).join(",")
    );

  if (rules) {
    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        const a = normalize(medications[i].name);
        const b = normalize(medications[j].name);

        for (const rule of rules) {
          const rDrug = normalize(rule.drug_name);
          const rWith = normalize(rule.interacts_with);
          if ((rDrug === a && rWith === b) || (rDrug === b && rWith === a)) {
            interactions.push({
              drugA: medications[i].name,
              drugB: medications[j].name,
              severity: rule.severity as "Low" | "Moderate" | "High",
              message: rule.description,
            });
          }
        }
      }
    }
  }

  return {
    interactions,
    timestamp: new Date().toISOString(),
    medicationCount: medications.length,
  };
}

// Fallback client-side rules (used when not authenticated)
interface InteractionRule {
  drug: string;
  interactsWith: string;
  severity: "Low" | "Moderate" | "High";
  message: string;
}

const fallbackRules: InteractionRule[] = [
  { drug: "paracetamol", interactsWith: "ibuprofen", severity: "Moderate", message: "Combined use may increase the risk of kidney damage and gastrointestinal issues." },
  { drug: "paracetamol", interactsWith: "warfarin", severity: "High", message: "Paracetamol can enhance the anticoagulant effect of warfarin, increasing bleeding risk." },
  { drug: "ibuprofen", interactsWith: "aspirin", severity: "High", message: "Ibuprofen may reduce the cardioprotective effects of aspirin and increase GI bleeding risk." },
  { drug: "ibuprofen", interactsWith: "warfarin", severity: "High", message: "NSAIDs increase the risk of bleeding when taken with anticoagulants." },
  { drug: "warfarin", interactsWith: "aspirin", severity: "High", message: "Significantly increased risk of major bleeding events." },
  { drug: "omeprazole", interactsWith: "clopidogrel", severity: "High", message: "Omeprazole reduces the antiplatelet effect of clopidogrel." },
  { drug: "fluoxetine", interactsWith: "tramadol", severity: "High", message: "Risk of serotonin syndrome — a potentially life-threatening condition." },
  { drug: "digoxin", interactsWith: "amiodarone", severity: "High", message: "Amiodarone increases digoxin levels, risking toxicity and cardiac arrhythmias." },
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
  "Clarithromycin", "Spironolactone", "Methotrexate", "Theophylline", "Potassium",
];
