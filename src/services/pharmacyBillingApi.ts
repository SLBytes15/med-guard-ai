import type { AnalysisResult } from "./interactionEngine";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

/**
 * POST /api/analyze — contract: { drugs: string[] }
 * Matches pharmacy demo; backend aliases the same engine as /api/check-interactions.
 */
export async function analyzeDrugsForBilling(drugs: string[]): Promise<AnalysisResult> {
  const path = API_BASE ? `${API_BASE}/api/analyze` : "/api/analyze";
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drugs }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Analyze API error (${response.status}): ${text || "Unknown error"}`);
  }

  return response.json() as Promise<AnalysisResult>;
}
