import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Pill,
  Receipt,
  ShieldAlert,
  ShoppingCart,
  Trash2,
  User,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  parsePrescriptionText,
  searchDrugSuggestions,
  type DrugSuggestion,
} from "@/services/drugIntelligence";
import { analyzeDrugsForBilling } from "@/services/pharmacyBillingApi";
import { checkInteractions, type AnalysisResult, type Interaction } from "@/services/interactionEngine";

/** Demo unit prices (INR). Unknown drugs get a deterministic mock from getMockUnitPrice. */
const MOCK_UNIT_PRICES: Record<string, number> = {
  aspirin: 12,
  warfarin: 45,
  paracetamol: 18,
  ibuprofen: 28,
  metformin: 35,
  simvastatin: 52,
  amoxicillin: 88,
  omeprazole: 65,
  clopidogrel: 120,
  tramadol: 42,
  fluoxetine: 72,
  digoxin: 95,
  amiodarone: 140,
  atorvastatin: 68,
  cetirizine: 22,
};

const norm = (s: string) => s.toLowerCase().trim();

function getMockUnitPrice(displayName: string): number {
  const k = norm(displayName);
  if (MOCK_UNIT_PRICES[k] != null) return MOCK_UNIT_PRICES[k];
  let h = 0;
  for (const c of k) h = (h << 5) - h + c.charCodeAt(0);
  return 30 + (Math.abs(h) % 120);
}

export interface BillLine {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

function uniqueDrugNamesFromLines(lines: BillLine[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = norm(line.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line.name.trim());
  }
  return out;
}

function worstSeverity(interactions: Interaction[]): "High" | "Moderate" | "Low" | null {
  if (interactions.length === 0) return null;
  if (interactions.some((i) => i.severity === "High")) return "High";
  if (interactions.some((i) => i.severity === "Moderate")) return "Moderate";
  return "Low";
}

export default function PharmacyBilling() {
  const { toast } = useToast();
  const [patientName, setPatientName] = useState("");
  const [lines, setLines] = useState<BillLine[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<DrugSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const linesRef = useRef(lines);
  linesRef.current = lines;

  const [checking, setChecking] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [proceedDespiteHigh, setProceedDespiteHigh] = useState(false);
  const [finalizedAt, setFinalizedAt] = useState<string | null>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);

  const uniqueNames = useMemo(() => uniqueDrugNamesFromLines(lines), [lines]);
  /** Stable while only qty/price change — avoids redundant API calls */
  const distinctDrugSig = useMemo(
    () =>
      uniqueDrugNamesFromLines(lines)
        .map((n) => n.toLowerCase())
        .sort()
        .join("|"),
    [lines]
  );
  const canScreen = uniqueNames.length >= 2;

  /** Debounced auto risk check when ≥2 distinct medicines (signature ignores qty/price-only edits). */
  useEffect(() => {
    if (!canScreen) {
      setAnalysis(null);
      setProceedDespiteHigh(false);
      setFinalizedAt(null);
      setChecking(false);
      return;
    }

    setChecking(true);
    const drugs = uniqueDrugNamesFromLines(linesRef.current);
    let cancelled = false;

    const t = window.setTimeout(() => {
      (async () => {
        setProceedDespiteHigh(false);
        try {
          let result: AnalysisResult;
          try {
            result = await analyzeDrugsForBilling(drugs);
          } catch {
            result = await checkInteractions(drugs.map((name) => ({ name })));
          }
          if (!cancelled) setAnalysis(result);
        } catch (e) {
          if (!cancelled) {
            toast({
              title: "Safety check failed",
              description: e instanceof Error ? e.message : "Unexpected error",
              variant: "destructive",
            });
            setAnalysis(null);
          }
        } finally {
          if (!cancelled) setChecking(false);
        }
      })();
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(t);
      setChecking(false);
    };
  }, [canScreen, distinctDrugSig, toast]);

  useEffect(() => {
    setHighlightIdx(0);
  }, [suggestions, inputValue]);

  useEffect(() => {
    if (!inputValue || inputValue.length < 1) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      const drugNames = uniqueDrugNamesFromLines(lines);
      setSuggestions(searchDrugSuggestions(inputValue, drugNames));
    }, 180);
    return () => clearTimeout(t);
  }, [inputValue, lines]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const subtotal = useMemo(
    () => lines.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0),
    [lines]
  );

  const addLine = useCallback((displayName: string) => {
    const name = displayName.trim();
    if (!name) return;
    setLines((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name,
        quantity: 1,
        unitPrice: getMockUnitPrice(name),
      },
    ]);
    setInputValue("");
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, []);

  const addFromSuggestion = (s: DrugSuggestion) => {
    addLine(s.label);
  };

  const addFromTyped = () => {
    const entries = parsePrescriptionText(inputValue);
    if (entries.length === 0 && inputValue.trim()) addLine(inputValue.trim());
    else if (entries.length > 0) addLine(entries[0]);
  };

  const updateLine = (id: string, patch: Partial<Pick<BillLine, "quantity" | "unitPrice">>) => {
    setLines((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  };

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((row) => row.id !== id));
  };

  const highRisk = Boolean(analysis?.interactions.some((i) => i.severity === "High"));
  const canFinalize =
    lines.length > 0 &&
    !finalizedAt &&
    (uniqueNames.length < 2 ||
      (analysis !== null && !checking && (!highRisk || proceedDespiteHigh)));

  const finalizeBill = () => {
    if (!canFinalize) return;
    setFinalizedAt(new Date().toISOString());
    toast({ title: "Bill finalized", description: "Transaction recorded (demo)." });
  };

  const risk = analysis ? worstSeverity(analysis.interactions) : null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1 container max-w-4xl py-10 space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 text-secondary text-xs font-medium">
            <ShoppingCart className="h-3.5 w-3.5" /> Pharmacy billing demo
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">
            Mini pharmacy billing & safety
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-base">
            Add at least two distinct medicines to see automatic interaction screening (
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">POST /api/analyze</code>
            ). Use arrow keys in the search list, Enter to add, Esc to close.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-secondary" /> Patient
              </CardTitle>
              <CardDescription>Optional — printed on the mock receipt</CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="e.g. Rahul Sharma"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Pill className="h-4 w-4 text-secondary" /> Add medicine
              </CardTitle>
              <CardDescription>
                Search catalog, then set quantity in the table. ↑↓ highlight, Enter adds, Esc closes list.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div ref={dropdownRef} className="relative">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setShowSuggestions(false);
                        return;
                      }
                      if (showSuggestions && suggestions.length > 0) {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setHighlightIdx((i) => Math.min(i + 1, suggestions.length - 1));
                          return;
                        }
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setHighlightIdx((i) => Math.max(i - 1, 0));
                          return;
                        }
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const pick = suggestions[highlightIdx] ?? suggestions[0];
                          if (pick) addFromSuggestion(pick);
                          return;
                        }
                      }
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addFromTyped();
                      }
                    }}
                    placeholder="Type medicine name…"
                    aria-autocomplete="list"
                    aria-expanded={showSuggestions && suggestions.length > 0}
                    className="flex-1"
                  />
                  <Button type="button" variant="secondary" onClick={addFromTyped}>
                    Add
                  </Button>
                </div>
                <AnimatePresence>
                  {showSuggestions && suggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute z-20 mt-1 w-full rounded-xl border border-border bg-card shadow-lg overflow-hidden"
                    >
                      {suggestions.map((s, idx) => (
                        <button
                          key={s.id}
                          type="button"
                          className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted flex justify-between gap-2 ${
                            idx === highlightIdx ? "bg-muted" : ""
                          }`}
                          onMouseEnter={() => setHighlightIdx(idx)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            addFromSuggestion(s);
                          }}
                        >
                          <span className="font-medium truncate">{s.label}</span>
                          <span className="text-[10px] uppercase text-muted-foreground shrink-0">
                            {s.type}
                          </span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {lines.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {uniqueDrugNamesFromLines(lines).map((name) => (
                    <Badge key={name} variant="secondary" className="font-normal">
                      {name}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-secondary" /> Billing table
            </CardTitle>
            <CardDescription>Quantity × unit price · totals update automatically</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No line items yet. Add medicines above.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drug</TableHead>
                    <TableHead className="w-[100px]">Qty</TableHead>
                    <TableHead className="w-[120px]">Price (₹)</TableHead>
                    <TableHead className="text-right w-[120px]">Line total</TableHead>
                    <TableHead className="w-[48px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          className="h-9"
                          value={row.quantity}
                          onChange={(e) =>
                            updateLine(row.id, {
                              quantity: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          className="h-9"
                          value={row.unitPrice}
                          onChange={(e) =>
                            updateLine(row.id, {
                              unitPrice: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        ₹{(row.quantity * row.unitPrice).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground"
                          onClick={() => removeLine(row.id)}
                          aria-label="Remove line"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t pt-4">
              <Button
                variant="outline"
                onClick={finalizeBill}
                disabled={!canFinalize}
                className="sm:self-end"
              >
                Finalize bill
              </Button>
              <div className="text-sm space-y-1 sm:text-right">
                <p className="text-muted-foreground">
                  Subtotal{" "}
                  <span className="font-mono font-semibold text-foreground">
                    ₹{subtotal.toFixed(2)}
                  </span>
                </p>
                <p className="text-lg font-display font-bold text-foreground">
                  Total ₹{subtotal.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {canScreen && (
        <Card className="border-secondary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base flex-wrap">
              <ShieldAlert className="h-5 w-5 text-secondary" />
              Interaction screening
              {checking && (
                <span className="inline-flex items-center gap-1.5 text-xs font-normal text-muted-foreground ml-auto">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Checking…
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Updates automatically when two or more distinct medicines are on the bill.{" "}
              <code className="text-xs bg-muted px-1 rounded">POST /api/analyze</code>{" "}
              <code className="text-xs bg-muted px-1 rounded">{`{ "drugs": [...] }`}</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AnimatePresence mode="wait">
              {analysis && risk === "High" && (
                <motion.div
                  key="high"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border-2 border-destructive bg-destructive/10 p-4 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold text-destructive">
                        🚨 Dangerous interaction detected
                      </p>
                      <p className="text-sm text-foreground/90">
                        {analysis.interactions[0]?.reason || analysis.interactions[0]?.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pair: {analysis.interactions[0]?.drugA} + {analysis.interactions[0]?.drugB}
                      </p>
                    </div>
                  </div>
                  {analysis.interactions.length > 1 && (
                    <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
                      {analysis.interactions.slice(1, 5).map((i, idx) => (
                        <li key={idx}>
                          {i.drugA} + {i.drugB}: {i.reason || i.message}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center gap-2 pt-2">
                    <Checkbox
                      id="proceed-high"
                      checked={proceedDespiteHigh}
                      onCheckedChange={(c) => setProceedDespiteHigh(c === true)}
                    />
                    <Label htmlFor="proceed-high" className="text-sm font-normal cursor-pointer">
                      Proceed anyway (supervisor override — demo)
                    </Label>
                  </div>
                </motion.div>
              )}

              {analysis && risk === "Moderate" && (
                <motion.div
                  key="mod"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border-2 border-warning bg-warning/10 p-4 flex gap-3"
                >
                  <AlertTriangle className="h-6 w-6 text-warning shrink-0" />
                  <div>
                    <p className="font-semibold text-warning">Moderate risk — review required</p>
                    <p className="text-sm mt-1">
                      {analysis.interactions[0]?.reason || analysis.interactions[0]?.message}
                    </p>
                  </div>
                </motion.div>
              )}

              {analysis && risk === "Low" && (
                <motion.div
                  key="low"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border-2 border-success bg-success/10 p-4 flex gap-3"
                >
                  <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
                  <div>
                    <p className="font-semibold text-success">Low-severity flags only</p>
                    <p className="text-sm mt-1 text-muted-foreground">
                      Interactions are classified as low risk. Verify with standard pharmacy
                      protocol.
                    </p>
                  </div>
                </motion.div>
              )}

              {analysis && risk === null && (
                <motion.div
                  key="clear"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border-2 border-success bg-success/10 p-4 flex gap-3"
                >
                  <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
                  <div>
                    <p className="font-semibold text-success">No known interactions</p>
                    <p className="text-sm mt-1 text-muted-foreground">
                      No matching interaction rules for this combination in the demo dataset.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
        )}

        {finalizedAt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-border bg-muted/40 p-4 text-sm"
          >
            <p className="font-semibold flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Receipt (mock)
            </p>
            <p className="text-muted-foreground mt-2">
              Patient: {patientName || "Walk-in"}
              <br />
              Issued: {new Date(finalizedAt).toLocaleString()}
              <br />
              Amount: ₹{subtotal.toFixed(2)}
            </p>
          </motion.div>
        )}
      </main>

      <Footer />
    </div>
  );
}
