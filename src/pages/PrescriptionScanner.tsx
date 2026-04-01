import { useState, useRef, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Upload, FileText, Pill, AlertTriangle, CheckCircle, Loader2, X, Zap, Eye } from "lucide-react";
import { parsePrescriptionText, cleanOcrText, type ParsedMedication } from "@/services/prescriptionParser";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

type ScanStage = "idle" | "preprocessing" | "ocr" | "parsing" | "done";

export default function PrescriptionScanner() {
  const [stage, setStage] = useState<ScanStage>("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [rawText, setRawText] = useState("");
  const [cleanedText, setCleanedText] = useState("");
  const [medications, setMedications] = useState<ParsedMedication[]>([]);
  const [manualMode, setManualMode] = useState(false);
  const [manualText, setManualText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const processImage = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setStage("preprocessing");
    setMedications([]);
    setRawText("");
    setCleanedText("");

    try {
      // Dynamic import to avoid blocking initial load
      setStage("ocr");
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const { data } = await worker.recognize(file);
      await worker.terminate();

      const raw = data.text;
      setRawText(raw);

      setStage("parsing");
      const cleaned = cleanOcrText(raw);
      setCleanedText(cleaned);
      const parsed = parsePrescriptionText(raw);
      setMedications(parsed);
      setStage("done");

      if (parsed.length === 0) {
        toast({ title: "No medicines detected", description: "Try a clearer image or enter text manually.", variant: "destructive" });
      } else {
        toast({ title: `Found ${parsed.length} medication(s)`, description: "Review the results below." });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "OCR failed", description: "Could not process the image. Try again or use manual entry.", variant: "destructive" });
      setStage("idle");
    }
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) processImage(file);
  };

  const handleManualParse = () => {
    if (!manualText.trim()) return;
    setRawText(manualText);
    const cleaned = cleanOcrText(manualText);
    setCleanedText(cleaned);
    const parsed = parsePrescriptionText(manualText);
    setMedications(parsed);
    setStage("done");
    if (parsed.length === 0) {
      toast({ title: "No medicines detected", description: "Check spelling or add more detail.", variant: "destructive" });
    }
  };

  const reset = () => {
    setStage("idle");
    setImageUrl(null);
    setRawText("");
    setCleanedText("");
    setMedications([]);
    setManualText("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const stageLabels: Record<ScanStage, string> = {
    idle: "Ready",
    preprocessing: "Preparing image…",
    ocr: "Extracting text (OCR)…",
    parsing: "Analyzing prescription…",
    done: "Complete",
  };

  const isProcessing = stage !== "idle" && stage !== "done";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-8 md:py-12 max-w-5xl mx-auto space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/10 text-secondary text-sm font-medium">
            <Camera className="h-4 w-4" /> Prescription Scanner
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-display text-foreground">
            Scan & Understand Prescriptions
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Upload a prescription image or paste text. Our OCR + NLP engine extracts medicines,
            dosages, and frequencies — optimized for Indian prescriptions.
          </p>
        </div>

        {/* Input Section */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Upload Card */}
          <Card className="border-dashed border-2 hover:border-secondary/50 transition-colors">
            <CardContent className="p-6">
              <div
                className="flex flex-col items-center justify-center gap-4 min-h-[200px] cursor-pointer"
                onClick={() => !isProcessing && fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                {imageUrl ? (
                  <div className="relative w-full">
                    <img src={imageUrl} alt="Prescription" className="w-full max-h-64 object-contain rounded-lg" />
                    {stage === "done" && (
                      <button onClick={(e) => { e.stopPropagation(); reset(); }} className="absolute top-2 right-2 bg-background/80 rounded-full p-1">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center">
                      <Upload className="h-8 w-8 text-secondary" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-foreground">Drop prescription image here</p>
                      <p className="text-sm text-muted-foreground mt-1">or click to browse · JPG, PNG, WEBP</p>
                    </div>
                  </>
                )}
                {isProcessing && (
                  <div className="flex items-center gap-2 text-secondary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm font-medium">{stageLabels[stage]}</span>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </CardContent>
          </Card>

          {/* Manual Entry Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-secondary" /> Manual Entry
              </CardTitle>
              <CardDescription>Paste prescription text or type medicine names</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder={"Dolo 650 Tab BD\nPan 40 OD\nAugmentin 625 TDS\nCetcip 10mg HS"}
                className="min-h-[140px] text-sm font-mono"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
              />
              <Button onClick={handleManualParse} className="w-full gradient-primary border-0" disabled={!manualText.trim()}>
                <Zap className="h-4 w-4 mr-2" /> Parse Text
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Status */}
        {stage !== "idle" && (
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {(["preprocessing", "ocr", "parsing", "done"] as ScanStage[]).map((s) => {
              const active = s === stage;
              const completed = (["preprocessing", "ocr", "parsing", "done"].indexOf(stage) > ["preprocessing", "ocr", "parsing", "done"].indexOf(s));
              return (
                <div key={s} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${completed ? "bg-success/10 text-success" : active ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"}`}>
                  {completed ? <CheckCircle className="h-3 w-3" /> : active ? <Loader2 className="h-3 w-3 animate-spin" /> : <div className="h-3 w-3 rounded-full border border-current" />}
                  {stageLabels[s]}
                </div>
              );
            })}
          </div>
        )}

        {/* Raw OCR Text */}
        {rawText && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5 text-muted-foreground" /> Extracted Text (Raw)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-sm bg-muted/50 p-4 rounded-lg whitespace-pre-wrap font-mono text-muted-foreground max-h-40 overflow-y-auto">
                {rawText}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Parsed Medications */}
        {medications.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Pill className="h-5 w-5 text-secondary" /> Detected Medications ({medications.length})
              </CardTitle>
              <CardDescription>Structured data extracted from your prescription</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {medications.map((med, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 border border-border/50">
                    <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                      <Pill className="h-5 w-5 text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground capitalize">{med.drug}</span>
                        {med.generic && med.generic !== med.drug && (
                          <Badge variant="outline" className="text-xs">{med.generic}</Badge>
                        )}
                        <Badge
                          className={`text-xs ${med.confidence >= 0.9 ? "bg-success/10 text-success border-success/20" : med.confidence >= 0.7 ? "bg-warning/10 text-warning border-warning/20" : "bg-destructive/10 text-destructive border-destructive/20"}`}
                          variant="outline"
                        >
                          {Math.round(med.confidence * 100)}% match
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                        {med.form && <span className="capitalize">{med.form}</span>}
                        {med.dosage && <span className="font-mono">{med.dosage}</span>}
                        {med.frequency && <span>· {med.frequency}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground/60 font-mono truncate">{med.raw}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA to check interactions */}
              <div className="mt-6 p-4 rounded-xl bg-secondary/5 border border-secondary/20 flex flex-col sm:flex-row items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-secondary shrink-0" />
                <p className="text-sm text-foreground flex-1">
                  Check these medications for potentially dangerous interactions.
                </p>
                <Button className="gradient-primary border-0 shrink-0" asChild>
                  <Link to={`/analyzer?drugs=${medications.map((m) => encodeURIComponent(m.drug)).join(",")}`}>
                    Check Interactions →
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {stage === "done" && medications.length === 0 && (
          <Card className="border-warning/30">
            <CardContent className="p-6 flex items-center gap-4">
              <AlertTriangle className="h-8 w-8 text-warning shrink-0" />
              <div>
                <p className="font-medium text-foreground">No medications detected</p>
                <p className="text-sm text-muted-foreground">
                  The image may be unclear or the text wasn't recognized. Try a higher quality photo or use manual entry above.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  );
}
