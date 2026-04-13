import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Microscope, Loader2, AlertTriangle } from "lucide-react";
import { DropZone } from "@/components/DropZone";
import { DetectionCanvas } from "@/components/DetectionCanvas";
import { ResultsPanel } from "@/components/ResultsPanel";
import { loadModel, runInference, isModelLoaded, type Detection } from "@/lib/inference";

export default function Index() {
  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Try to load model on mount
  useEffect(() => {
    setModelStatus("loading");
    loadModel("/best.onnx")
      .then(() => setModelStatus("ready"))
      .catch(() => setModelStatus("error"));
  }, []);

  const handleImageSelect = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setDetections([]);

    if (!isModelLoaded()) return;

    setAnalyzing(true);
    const img = new Image();
    img.onload = async () => {
      imgRef.current = img;
      try {
        const results = await runInference(img, processingCanvasRef.current!);
        setDetections(results);
      } catch (err) {
        console.error("Inference error:", err);
      } finally {
        setAnalyzing(false);
      }
    };
    img.src = url;
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hidden processing canvas */}
      <canvas ref={processingCanvasRef} className="hidden" />

      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 glow-primary">
              <Microscope className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-heading text-gradient-primary">MicroDetect</h1>
              <p className="text-xs text-muted-foreground">AI-Powered Microplastic Sensor</p>
            </div>
          </div>

          {/* Model status */}
          <div className="flex items-center gap-2 font-mono text-xs">
            {modelStatus === "loading" && (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                <span className="text-muted-foreground">Loading model…</span>
              </>
            )}
            {modelStatus === "ready" && (
              <>
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
                <span className="text-primary">Model ready</span>
              </>
            )}
            {modelStatus === "error" && (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                <span className="text-warning">Model not found — place best.onnx in /public</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 h-full">
          {/* Left: Canvas / Upload */}
          <div className="flex flex-col gap-4">
            {!imageSrc ? (
              <DropZone onImageSelect={handleImageSelect} disabled={modelStatus === "loading"} />
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative"
              >
                <DetectionCanvas
                  imageSrc={imageSrc}
                  detections={detections}
                  highlightedId={highlightedId}
                />

                {analyzing && (
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 rounded-lg">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="font-heading text-sm text-primary animate-pulse-glow">Analyzing sample…</p>
                  </div>
                )}

                {/* New image button */}
                <button
                  onClick={() => { setImageSrc(null); setDetections([]); }}
                  className="mt-3 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Upload new sample
                </button>
              </motion.div>
            )}
          </div>

          {/* Right: Results panel */}
          <aside className="bg-card border border-border rounded-lg p-4">
            <h2 className="font-heading text-sm text-muted-foreground mb-4 tracking-wider uppercase">
              Detection Results
            </h2>
            <ResultsPanel detections={detections} onHover={setHighlightedId} />
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-3">
        <p className="text-center text-xs text-muted-foreground font-mono">
          YOLOv8 • 640×640 input • ONNX Runtime Web • Client-side inference
        </p>
      </footer>
    </div>
  );
}
