import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Search, AlertTriangle, CheckCircle2, Info, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SeverityBadge } from "@/components/SeverityBadge";
import { checkInteractions, drugSuggestions, type Medication, type AnalysisResult } from "@/services/interactionEngine";

export default function Analyzer() {
  const [medications, setMedications] = useState<Medication[]>([{ name: "", dosage: "" }]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [searchQuery, setSearchQuery] = useState<{ index: number; query: string } | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const suggestions = useMemo(() => {
    if (!searchQuery || !searchQuery.query) return [];
    const q = searchQuery.query.toLowerCase();
    return drugSuggestions.filter((d) => d.toLowerCase().includes(q)).slice(0, 6);
  }, [searchQuery]);

  const addMedication = () => setMedications((m) => [...m, { name: "", dosage: "" }]);

  const removeMedication = (i: number) => {
    setMedications((m) => m.filter((_, idx) => idx !== i));
    setResult(null);
  };

  const updateMedication = (i: number, field: keyof Medication, value: string) => {
    setMedications((m) => m.map((med, idx) => (idx === i ? { ...med, [field]: value } : med)));
    if (field === "name") setSearchQuery({ index: i, query: value });
    setResult(null);
  };

  const selectSuggestion = (i: number, name: string) => {
    updateMedication(i, "name", name);
    setSearchQuery(null);
  };

  const analyze = () => {
    const valid = medications.filter((m) => m.name.trim());
    if (valid.length < 2) return;
    const res = checkInteractions(valid);
    setResult(res);
  };

  const canAnalyze = medications.filter((m) => m.name.trim()).length >= 2;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-10">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display text-3xl font-bold mb-2">Medication Analyzer</h1>
          <p className="text-muted-foreground mb-8">Enter two or more medications to check for interactions.</p>

          {/* Medication Inputs */}
          <div className="space-y-3 mb-6">
            {medications.map((med, i) => (
              <div key={i} className="relative flex gap-3 items-start">
                <div className="flex-1 relative">
                  <Input
                    placeholder="Drug name (e.g. Warfarin)"
                    value={med.name}
                    onChange={(e) => updateMedication(i, "name", e.target.value)}
                    onFocus={() => setSearchQuery({ index: i, query: med.name })}
                    onBlur={() => setTimeout(() => setSearchQuery(null), 200)}
                    className="bg-card"
                  />
                  {searchQuery?.index === i && suggestions.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-elevated overflow-hidden">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                          onMouseDown={() => selectSuggestion(i, s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Input
                  placeholder="Dosage"
                  value={med.dosage}
                  onChange={(e) => updateMedication(i, "dosage", e.target.value)}
                  className="w-28 bg-card"
                />
                {medications.length > 1 && (
                  <button
                    onClick={() => removeMedication(i)}
                    className="mt-2 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3 mb-10">
            <Button variant="outline" onClick={addMedication} className="gap-2">
              <Plus className="h-4 w-4" /> Add Medication
            </Button>
            <Button onClick={analyze} disabled={!canAnalyze} className="gradient-primary border-0 gap-2">
              <Search className="h-4 w-4" /> Analyze Interactions
            </Button>
          </div>

          {/* Results */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl font-semibold">Results</h2>
                  <span className="text-xs text-muted-foreground">
                    {result.medicationCount} medications checked
                  </span>
                </div>

                {result.interactions.length === 0 ? (
                  <div className="flex items-center gap-3 p-4 rounded-xl border border-success/30 bg-success/5">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <p className="text-sm font-medium">No known interactions found between these medications.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {result.interactions.map((interaction, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-border bg-card shadow-card overflow-hidden"
                      >
                        <button
                          className="w-full flex items-center justify-between p-4 text-left"
                          onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                        >
                          <div className="flex items-center gap-3">
                            <AlertTriangle
                              className={`h-5 w-5 ${
                                interaction.severity === "High"
                                  ? "text-destructive"
                                  : interaction.severity === "Moderate"
                                  ? "text-warning"
                                  : "text-success"
                              }`}
                            />
                            <div>
                              <span className="font-medium text-sm">
                                {interaction.drugA} + {interaction.drugB}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <SeverityBadge severity={interaction.severity} />
                            <ChevronDown
                              className={`h-4 w-4 text-muted-foreground transition-transform ${
                                expandedIdx === i ? "rotate-180" : ""
                              }`}
                            />
                          </div>
                        </button>
                        <AnimatePresence>
                          {expandedIdx === i && (
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: "auto" }}
                              exit={{ height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 border-t border-border pt-3">
                                <div className="flex items-start gap-2">
                                  <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                  <p className="text-sm text-muted-foreground leading-relaxed">
                                    {interaction.message}
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <Footer />
    </div>
  );
}
