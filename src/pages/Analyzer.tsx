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
import {
  checkInteractions,
  checkInteractionsFromDB,
  searchDrugNames,
  drugSuggestions,
  type Medication,
  type AnalysisResult,
} from "@/services/interactionEngine";

export default function Analyzer() {
  const { user } = useAuth();
  const [selectedDrugs, setSelectedDrugs] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (!inputValue || inputValue.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingSuggestions(true);
      if (user) {
        const results = await searchDrugNames(inputValue);
        setSuggestions(results.filter((d) => !selectedDrugs.includes(d)));
      } else {
        const q = inputValue.toLowerCase();
        const results = drugSuggestions
          .filter((d) => d.toLowerCase().includes(q) && !selectedDrugs.includes(d))
          .slice(0, 8);
        setSuggestions(results);
      }
      setLoadingSuggestions(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [inputValue, selectedDrugs, user]);

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

  const addDrug = useCallback(
    (name: string) => {
      if (!selectedDrugs.includes(name)) {
        setSelectedDrugs((prev) => [...prev, name]);
      }
      setInputValue("");
      setSuggestions([]);
      setResult(null);
      inputRef.current?.focus();
    },
    [selectedDrugs]
  );

  const removeDrug = (name: string) => {
    setSelectedDrugs((prev) => prev.filter((d) => d !== name));
    setResult(null);
  };

  const analyze = async () => {
    if (selectedDrugs.length < 2) return;
    setAnalyzing(true);
    const start = Date.now();
    const meds: Medication[] = selectedDrugs.map((name) => ({ name }));

    let res: AnalysisResult;
    if (user) {
      res = await checkInteractionsFromDB(meds);
      await supabase.from("api_logs").insert({
        user_id: user.id,
        endpoint: "/check-interactions",
        method: "POST",
        status_code: 200,
        response_time_ms: Date.now() - start,
      });
    } else {
      res = checkInteractions(meds);
    }

    setResult(res);
    setAnalyzing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && suggestions.length > 0) {
      e.preventDefault();
      addDrug(suggestions[0]);
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
              Enter your medications below. Our engine cross-references 190,000+ interaction rules to keep you safe.
            </p>
          </motion.div>
        </div>
      </section>

      <main className="flex-1 container py-10">
        <div className="max-w-3xl mx-auto">
          {/* Input Section */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-border bg-card shadow-card p-6 mb-8"
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
                  placeholder={selectedDrugs.length === 0 ? "Type a drug name (e.g., Aspirin, Warfarin)..." : "Add another medication..."}
                  className="flex-1 min-w-[160px] border-0 shadow-none p-0 h-auto focus-visible:ring-0 bg-transparent"
                />
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
                      suggestions.map((s) => (
                        <button
                          key={s}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-2"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            addDrug(s);
                          }}
                        >
                          <Pill className="h-3.5 w-3.5 text-muted-foreground" />
                          {s}
                        </button>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                {selectedDrugs.length} medication{selectedDrugs.length !== 1 ? "s" : ""} selected
                {selectedDrugs.length < 2 && " — add at least 2 to analyze"}
              </p>
              <Button
                onClick={analyze}
                disabled={selectedDrugs.length < 2 || analyzing}
                className="gradient-primary border-0 gap-2 shadow-card hover:shadow-elevated transition-shadow"
              >
                {analyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {analyzing ? "Analyzing..." : "Analyze Interactions"}
              </Button>
            </div>
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
                  className={`rounded-2xl border p-6 shadow-card ${
                    overallSeverity === "safe"
                      ? "border-success/30 bg-success/5"
                      : overallSeverity === "caution"
                      ? "border-warning/30 bg-warning/5"
                      : "border-destructive/30 bg-destructive/5"
                  }`}
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
                      <p className="text-sm text-muted-foreground">
                        {overallSeverity === "safe"
                          ? "No known interactions found between these medications."
                          : overallSeverity === "caution"
                          ? `${result.interactions.length} interaction(s) found — review below.`
                          : `${result.interactions.length} interaction(s) found — including high-risk combinations.`}
                      </p>
                    </div>
                  </div>
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
