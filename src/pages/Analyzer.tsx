import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Shield, AlertTriangle, CheckCircle2, Info, ChevronDown, Pill, Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SeverityBadge } from "@/components/SeverityBadge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  checkInteractions,
  checkInteractionsFromAPI,
  type Medication,
  type AnalysisResult,
} from "@/services/interactionEngine";
import {
  appendUniqueEntries,
  formatSelectedSummary,
  normalizeSelectedForInteractionCheck,
  parsePrescriptionText,
  resolveSuggestionEntries,
  searchDrugSuggestions,
  type DrugSuggestion,
} from "@/services/drugIntelligence";
import { useSearchParams } from "react-router-dom";

export default function Analyzer() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [selectedDrugs, setSelectedDrugs] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<DrugSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionHighlight, setSuggestionHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (!inputValue || inputValue.length < 1) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      setLoadingSuggestions(true);
      const results = searchDrugSuggestions(inputValue, selectedDrugs);
      setSuggestions(results);
      setLoadingSuggestions(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [inputValue, selectedDrugs]);

  useEffect(() => {
    setSuggestionHighlight(0);
  }, [suggestions, inputValue]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Hydrate selected drugs from query param (e.g. /analyzer?drugs=paracetamol,ibuprofen)
  useEffect(() => {
    const drugsParam = searchParams.get("drugs");
    if (!drugsParam) return;

    const entries = parsePrescriptionText(drugsParam);
    if (entries.length === 0) return;

    setSelectedDrugs((prev) => appendUniqueEntries(prev, entries));
    setResult(null);
  }, [searchParams]);

  const addEntries = useCallback((entries: string[]) => {
    setSelectedDrugs((prev) => appendUniqueEntries(prev, entries));
    setInputValue("");
    setSuggestions([]);
    setResult(null);
    inputRef.current?.focus();
  }, []);

  const removeDrug = (name: string) => {
    setSelectedDrugs((prev) => prev.filter((d) => d !== name));
    setResult(null);
  };

  const addSuggestion = useCallback(
    (suggestionId: string) => {
      const entries = resolveSuggestionEntries(suggestionId);
      addEntries(entries);
    },
    [addEntries]
  );

  const addFromTypedInput = useCallback(() => {
    const entries = parsePrescriptionText(inputValue);
    if (entries.length === 0) return;
    addEntries(entries);
  }, [addEntries, inputValue]);

  const highlightLabel = (label: string, matchIndex: number, query: string) => {
    if (matchIndex < 0 || !query) return <>{label}</>;
    const end = matchIndex + query.length;
    return (
      <>
        {label.slice(0, matchIndex)}
        <span className="font-semibold text-foreground">{label.slice(matchIndex, end)}</span>
        {label.slice(end)}
      </>
    );
  };

  const analyze = async () => {
    if (selectedDrugs.length < 2) return;
    setAnalyzing(true);
    const start = Date.now();
    const normalized = normalizeSelectedForInteractionCheck(selectedDrugs);
    if (normalized.length < 2) {
      toast({
        title: "Need more unique drugs",
        description: "Add at least 2 unique generic medicines for interaction analysis.",
        variant: "destructive",
      });
      setAnalyzing(false);
      return;
    }
    const meds: Medication[] = normalized.map((name) => ({ name }));

    try {
      const res: AnalysisResult = await checkInteractionsFromAPI(meds);
      if (user) {
        await supabase.from("api_logs").insert({
          user_id: user.id,
          endpoint: "/check-interactions",
          method: "POST",
          status_code: 200,
          response_time_ms: Date.now() - start,
        });
      }
      setResult(res);
    } catch (error) {
      try {
        const fallback = await checkInteractions(meds);
        setResult(fallback);
        toast({
          title: "Running in local mode",
          description: "Backend is unreachable, so local interaction data was used for this analysis.",
        });
      } catch (fallbackError) {
        toast({
          title: "Analysis failed",
          description:
            fallbackError instanceof Error
              ? fallbackError.message
              : error instanceof Error
              ? error.message
              : "Could not run interaction analysis.",
          variant: "destructive",
        });
        setResult(null);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setShowSuggestions(false);
      return;
    }

    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSuggestionHighlight((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSuggestionHighlight((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const s = suggestions[suggestionHighlight] ?? suggestions[0];
        if (s) addSuggestion(s.id);
        return;
      }
    }

    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      addFromTypedInput();
    } else if (e.key === "Backspace" && inputValue === "" && selectedDrugs.length > 0) {
      removeDrug(selectedDrugs[selectedDrugs.length - 1]);
    }
  };

  const overallSeverity = result
    ? result.interactions.length === 0
      ? "safe"
      : result.interactions.some((i) => i.severity === "High")
      ? "danger"
      : result.interactions.some((i) => i.severity === "Moderate")
      ? "caution"
      : "safe"
    : null;
  const interactionSummary = result?.summary ?? {
    total: result?.interactions.length ?? 0,
    high: result?.interactions.filter((item) => item.severity === "High").length ?? 0,
    moderate: result?.interactions.filter((item) => item.severity === "Moderate").length ?? 0,
    low: result?.interactions.filter((item) => item.severity === "Low").length ?? 0,
  };
  const riskTypeLabel =
    overallSeverity === "danger"
      ? "High Risk"
      : overallSeverity === "caution"
      ? "Moderate Risk"
      : overallSeverity === "safe" && interactionSummary.total > 0
      ? "Low Risk"
      : "No Known Risk";
  const overallCardTone =
    overallSeverity === "danger"
      ? "border-destructive/60 bg-destructive/10"
      : overallSeverity === "caution"
      ? "border-warning/60 bg-warning/10"
      : "border-success/60 bg-success/10";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      {/* Hero */}
      <section className="gradient-hero text-primary-foreground py-16">
        <div className="container text-center max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-sm mb-6">
              <Shield className="h-4 w-4" />
              <span>AI-Powered Drug Safety</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
              Detect unsafe drug interactions instantly
            </h1>
            <p className="text-lg text-white/70 max-w-xl mx-auto">
              Enter medicine brands or generic names below. Our engine checks real interaction intelligence to flag safety risks.
            </p>
            <div className="mt-7">
              <Button
                className="bg-secondary hover:bg-secondary/90 text-secondary-foreground border-0 gap-2"
                onClick={() => document.getElementById("analysis-input")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                <Search className="h-4 w-4" />
                Start Analysis
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <main className="flex-1 container py-10">
        <div id="analysis-input" className="max-w-3xl mx-auto">
          {/* Input Section */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-border bg-card shadow-[0_20px_60px_-30px_rgba(15,23,42,0.45)] p-6 mb-8"
          >
            <div className="flex items-center gap-2 mb-4">
              <Pill className="h-5 w-5 text-secondary" />
              <h2 className="font-display text-lg font-semibold">Enter Medications</h2>
            </div>

            {/* Chip input area */}
            <div ref={dropdownRef} className="relative">
              <div
                className="flex flex-wrap gap-2 items-center min-h-[44px] px-3 py-2 rounded-xl border border-input bg-background cursor-text transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent"
                onClick={() => inputRef.current?.focus()}
              >
                <AnimatePresence>
                  {selectedDrugs.map((drug) => (
                    <motion.span
                      key={drug}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/15 text-secondary text-sm font-medium"
                    >
                      {drug}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDrug(drug);
                        }}
                        className="hover:bg-secondary/20 rounded-full p-0.5 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={handleKeyDown}
                  placeholder={selectedDrugs.length === 0 ? "Type medicine (e.g., combiflam, dolo 650, aspirin)..." : "Add another medicine..."}
                  className="flex-1 min-w-[160px] border-0 shadow-none p-0 h-auto focus-visible:ring-0 bg-transparent"
                  aria-autocomplete="list"
                  aria-expanded={showSuggestions && suggestions.length > 0}
                />
                {inputValue.trim().length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={addFromTypedInput}
                  >
                    Add
                  </Button>
                )}
              </div>

              {/* Autocomplete dropdown */}
              <AnimatePresence>
                {showSuggestions && (suggestions.length > 0 || loadingSuggestions) && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-elevated overflow-hidden"
                  >
                    {loadingSuggestions ? (
                      <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Searching...
                      </div>
                    ) : (
                      suggestions.map((s, idx) => (
                        <button
                          key={s.id}
                          type="button"
                          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors flex items-center justify-between gap-3 ${
                            idx === suggestionHighlight ? "bg-muted" : ""
                          }`}
                          onMouseEnter={() => setSuggestionHighlight(idx)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            addSuggestion(s.id);
                          }}
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <Pill className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <div className="truncate">{highlightLabel(s.label, s.matchIndex, inputValue.toLowerCase())}</div>
                              <div className="text-xs text-muted-foreground truncate">{s.subtitle}</div>
                            </div>
                          </div>
                          <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                            {s.type}
                          </span>
                        </button>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              Keyboard: ↑↓ to highlight suggestions, Enter to add, Esc to close list. Empty input + Backspace removes last chip.
            </p>
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                {selectedDrugs.length} medication{selectedDrugs.length !== 1 ? "s" : ""} selected
                {selectedDrugs.length < 2 && " — add at least 2 to analyze"}
              </p>
              <Button
                onClick={analyze}
                disabled={selectedDrugs.length < 2 || analyzing}
                className="gradient-primary border-0 gap-2 px-6 shadow-card hover:shadow-elevated transition-shadow"
              >
                {analyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {analyzing ? "Analyzing..." : "Analyze Interactions"}
              </Button>
            </div>
            {selectedDrugs.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3 break-words">
                Input summary: {formatSelectedSummary(selectedDrugs)}
              </p>
            )}
          </motion.div>

          {/* Results */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Overall Assessment Card */}
                <div
                  className={`rounded-2xl border p-6 shadow-card ${overallCardTone}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={`p-2 rounded-xl ${
                        overallSeverity === "safe"
                          ? "bg-success/15"
                          : overallSeverity === "caution"
                          ? "bg-warning/15"
                          : "bg-destructive/15"
                      }`}
                    >
                      {overallSeverity === "safe" ? (
                        <Shield className="h-5 w-5 text-success" />
                      ) : overallSeverity === "caution" ? (
                        <AlertTriangle className="h-5 w-5 text-warning" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-display font-semibold">Overall Assessment</h3>
                      <p
                        className={`text-sm font-semibold ${
                          overallSeverity === "danger"
                            ? "text-destructive"
                            : overallSeverity === "caution"
                            ? "text-warning"
                            : "text-success"
                        }`}
                      >
                        Risk Type: {riskTypeLabel}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {overallSeverity === "safe"
                          ? "No known interactions found between these medications."
                          : overallSeverity === "caution"
                          ? `${interactionSummary.total} interaction(s) found — review below.`
                          : `${interactionSummary.total} interaction(s) found — including high-risk combinations.`}
                      </p>
                    </div>
                  </div>
                  {interactionSummary.total > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {interactionSummary.high > 0 && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-destructive/10 text-destructive font-medium">
                          High: {interactionSummary.high}
                        </span>
                      )}
                      {interactionSummary.moderate > 0 && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-warning/10 text-warning font-medium">
                          Moderate: {interactionSummary.moderate}
                        </span>
                      )}
                      {interactionSummary.low > 0 && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-success/10 text-success font-medium">
                          Low: {interactionSummary.low}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Medications Card */}
                <div className="rounded-2xl border border-border bg-card shadow-card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Pill className="h-5 w-5 text-secondary" />
                    <h3 className="font-display font-semibold">Medications Checked</h3>
                    <span className="ml-auto text-xs text-muted-foreground">{result.medicationCount} drugs</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedDrugs.map((drug) => (
                      <span key={drug} className="px-3 py-1.5 rounded-full bg-muted text-sm font-medium">
                        {drug}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Interactions */}
                {result.interactions.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
                    <div className="flex items-center gap-2 p-6 pb-4">
                      <Activity className="h-5 w-5 text-secondary" />
                      <h3 className="font-display font-semibold">Interaction Details</h3>
                    </div>
                    <div className="divide-y divide-border">
                      {result.interactions.map((interaction, i) => (
                        <div key={i}>
                          <button
                            className="w-full flex items-center justify-between p-4 px-6 text-left hover:bg-muted/50 transition-colors"
                            onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                          >
                            <div className="flex items-center gap-3">
                              <AlertTriangle
                                className={`h-4 w-4 ${
                                  interaction.severity === "High"
                                    ? "text-destructive"
                                    : interaction.severity === "Moderate"
                                    ? "text-warning"
                                    : "text-success"
                                }`}
                              />
                              <span className="font-medium text-sm">
                                {interaction.drugA} + {interaction.drugB}
                              </span>
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
                                <div className="px-6 pb-4 border-t border-border pt-3">
                                  <div className="space-y-3">
                                    <div className="flex items-start gap-2">
                                      <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                      <p className="text-sm text-muted-foreground leading-relaxed">
                                        {interaction.reason || interaction.message}
                                      </p>
                                    </div>
                                    {interaction.advice && (
                                      <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                                        <span className="font-semibold text-foreground">Guidance:</span> {interaction.advice}
                                      </div>
                                    )}
                                    {interaction.diseaseRisk &&
                                      Object.keys(interaction.diseaseRisk).length > 0 && (
                                        <div className="rounded-lg border border-border px-3 py-2">
                                          <p className="text-xs font-semibold mb-1">Condition-specific notes</p>
                                          <div className="grid gap-1">
                                            {Object.entries(interaction.diseaseRisk).map(([condition, note]) => (
                                              <p key={condition} className="text-xs text-muted-foreground">
                                                <span className="font-medium text-foreground">
                                                  {condition.replace(/_/g, " ")}:
                                                </span>{" "}
                                                {note}
                                              </p>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    {interaction.source && (
                                      <p className="text-[11px] text-muted-foreground">
                                        Source: {interaction.source}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-center text-muted-foreground">
                  Analysis completed at {new Date(result.timestamp).toLocaleString()} · {result.interactions.length} interaction(s) found
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <Footer />
    </div>
  );
}
