import { motion } from "framer-motion";
import type { Detection } from "@/lib/inference";

const COLORS = [
  "bg-emerald-500", "bg-cyan-500", "bg-amber-500", "bg-red-500",
  "bg-violet-500", "bg-pink-500", "bg-teal-500", "bg-orange-500",
];

interface ResultsPanelProps {
  detections: Detection[];
  onHover: (id: number | null) => void;
}

export function ResultsPanel({ detections, onHover }: ResultsPanelProps) {
  if (detections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 py-12">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
          <span className="text-2xl">🔬</span>
        </div>
        <p className="font-heading text-sm">No detections yet</p>
        <p className="text-xs text-center max-w-[200px]">Upload a microscope image to detect microplastic particles</p>
      </div>
    );
  }

  const summary = detections.reduce((acc, d) => {
    acc[d.className] = (acc[d.className] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-secondary rounded-lg p-3 text-center">
          <p className="text-2xl font-heading text-primary">{detections.length}</p>
          <p className="text-xs text-muted-foreground">Particles</p>
        </div>
        <div className="bg-secondary rounded-lg p-3 text-center">
          <p className="text-2xl font-heading text-accent">{Object.keys(summary).length}</p>
          <p className="text-xs text-muted-foreground">Types</p>
        </div>
      </div>

      {/* Detection list */}
      <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1">
        {detections.map((det, i) => (
          <motion.div
            key={det.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            onMouseEnter={() => onHover(det.id)}
            onMouseLeave={() => onHover(null)}
            className="bg-secondary/50 hover:bg-secondary rounded-lg p-3 cursor-pointer transition-colors border border-transparent hover:border-primary/30"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2.5 h-2.5 rounded-full ${COLORS[det.classId % COLORS.length]}`} />
              <span className="font-heading text-sm text-foreground truncate">{det.className}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Size</span>
                <p className="font-mono text-foreground">{det.sizeMm} mm</p>
              </div>
              <div>
                <span className="text-muted-foreground">Confidence</span>
                <p className="font-mono text-primary">{det.confidence}%</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
