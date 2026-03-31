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

// Rule-based interaction dataset (MVP — will be replaced by DB/AI service)
const interactionDataset: Omit<Interaction, "drugA" | "drugB">[][] = [];

interface InteractionRule {
  drug: string;
  interactsWith: string;
  severity: "Low" | "Moderate" | "High";
  message: string;
}

const rules: InteractionRule[] = [
  { drug: "paracetamol", interactsWith: "ibuprofen", severity: "Moderate", message: "Combined use may increase the risk of kidney damage and gastrointestinal issues." },
  { drug: "paracetamol", interactsWith: "warfarin", severity: "High", message: "Paracetamol can enhance the anticoagulant effect of warfarin, increasing bleeding risk." },
  { drug: "ibuprofen", interactsWith: "aspirin", severity: "High", message: "Ibuprofen may reduce the cardioprotective effects of aspirin and increase GI bleeding risk." },
  { drug: "ibuprofen", interactsWith: "warfarin", severity: "High", message: "NSAIDs increase the risk of bleeding when taken with anticoagulants." },
  { drug: "ibuprofen", interactsWith: "lisinopril", severity: "Moderate", message: "NSAIDs can reduce the effectiveness of ACE inhibitors and affect kidney function." },
  { drug: "metformin", interactsWith: "alcohol", severity: "High", message: "Alcohol increases the risk of lactic acidosis with metformin use." },
  { drug: "metformin", interactsWith: "contrast dye", severity: "High", message: "Contrast dye with metformin increases risk of kidney damage and lactic acidosis." },
  { drug: "simvastatin", interactsWith: "amiodarone", severity: "High", message: "Increased risk of rhabdomyolysis (muscle breakdown) with this combination." },
  { drug: "simvastatin", interactsWith: "grapefruit", severity: "Moderate", message: "Grapefruit increases simvastatin levels in the blood, raising side effect risk." },
  { drug: "amoxicillin", interactsWith: "methotrexate", severity: "High", message: "Amoxicillin may increase methotrexate toxicity by reducing its renal clearance." },
  { drug: "lisinopril", interactsWith: "potassium", severity: "High", message: "ACE inhibitors with potassium supplements can cause dangerous hyperkalemia." },
  { drug: "lisinopril", interactsWith: "spironolactone", severity: "High", message: "Both drugs increase potassium levels, risking hyperkalemia." },
  { drug: "warfarin", interactsWith: "aspirin", severity: "High", message: "Significantly increased risk of major bleeding events." },
  { drug: "warfarin", interactsWith: "vitamin k", severity: "Moderate", message: "Vitamin K can reduce warfarin effectiveness, affecting anticoagulation control." },
  { drug: "ciprofloxacin", interactsWith: "antacids", severity: "Moderate", message: "Antacids reduce ciprofloxacin absorption, decreasing its effectiveness." },
  { drug: "ciprofloxacin", interactsWith: "theophylline", severity: "High", message: "Ciprofloxacin increases theophylline levels, risking seizures and arrhythmias." },
  { drug: "omeprazole", interactsWith: "clopidogrel", severity: "High", message: "Omeprazole reduces the antiplatelet effect of clopidogrel, increasing cardiovascular risk." },
  { drug: "amlodipine", interactsWith: "simvastatin", severity: "Moderate", message: "Amlodipine increases simvastatin levels, raising the risk of muscle-related side effects." },
  { drug: "fluoxetine", interactsWith: "tramadol", severity: "High", message: "Risk of serotonin syndrome — a potentially life-threatening condition." },
  { drug: "fluoxetine", interactsWith: "maois", severity: "High", message: "Extremely dangerous combination — can cause fatal serotonin syndrome." },
  { drug: "digoxin", interactsWith: "amiodarone", severity: "High", message: "Amiodarone increases digoxin levels, risking toxicity and cardiac arrhythmias." },
  { drug: "digoxin", interactsWith: "verapamil", severity: "High", message: "Verapamil increases digoxin concentration, increasing toxicity risk." },
  { drug: "metoprolol", interactsWith: "verapamil", severity: "High", message: "Both drugs slow heart rate — combination can cause severe bradycardia or heart block." },
  { drug: "losartan", interactsWith: "potassium", severity: "High", message: "ARBs with potassium supplements risk dangerous hyperkalemia." },
  { drug: "atorvastatin", interactsWith: "clarithromycin", severity: "High", message: "Clarithromycin increases statin levels, raising rhabdomyolysis risk." },
];

const normalize = (name: string) => name.toLowerCase().trim();

export function checkInteractions(medications: Medication[]): AnalysisResult {
  const interactions: Interaction[] = [];

  for (let i = 0; i < medications.length; i++) {
    for (let j = i + 1; j < medications.length; j++) {
      const a = normalize(medications[i].name);
      const b = normalize(medications[j].name);

      for (const rule of rules) {
        if (
          (rule.drug === a && rule.interactsWith === b) ||
          (rule.drug === b && rule.interactsWith === a)
        ) {
          interactions.push({
            drugA: medications[i].name,
            drugB: medications[j].name,
            severity: rule.severity,
            message: rule.message,
          });
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

export const drugSuggestions = [
  "Paracetamol", "Ibuprofen", "Aspirin", "Warfarin", "Metformin",
  "Simvastatin", "Amoxicillin", "Lisinopril", "Ciprofloxacin", "Omeprazole",
  "Amlodipine", "Fluoxetine", "Digoxin", "Metoprolol", "Losartan",
  "Atorvastatin", "Clopidogrel", "Tramadol", "Verapamil", "Amiodarone",
  "Clarithromycin", "Spironolactone", "Methotrexate", "Theophylline", "Potassium",
];
