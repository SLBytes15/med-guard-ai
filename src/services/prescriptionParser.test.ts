import { describe, it, expect } from "vitest";
import { parsePrescriptionText } from "./prescriptionParser";

describe("parsePrescriptionText", () => {
  it("extracts multiple medications from numbered blocks", () => {
    const text = `1. Tab Paracetamol 500 mg
   Dose: 1 tablet
   Frequency: BD (Twice daily)
   Duration: 5 days
   Instructions: After food

2. Tab Ibuprofen 400 mg
   Dose: 1 tablet
   Frequency: BD (Twice daily)
   Duration: 3 days
   Instructions: After food

3. Tab Cetirizine 10 mg
   Dose: 1 tablet
   Frequency: OD (Once daily)
   Duration: 5 days
   Instructions: At night`;

    const meds = parsePrescriptionText(text);
    expect(meds.map((m) => m.drug)).toEqual(["paracetamol", "ibuprofen", "cetirizine"]);
  });
});
