import { forwardRef, useEffect, useRef } from "react";
import type { Detection } from "@/lib/inference";

interface DetectionCanvasProps {
  imageSrc: string;
  detections: Detection[];
  highlightedId?: number | null;
}

const COLORS = [
  "#10b981", "#06b6d4", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
];

export const DetectionCanvas = forwardRef<HTMLDivElement, DetectionCanvasProps>(function DetectionCanvas(
  { imageSrc, detections, highlightedId },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      draw(ctx, img, detections, highlightedId ?? null);
    };
    img.src = imageSrc;
  }, [imageSrc, detections, highlightedId]);

  return (
    <div ref={ref} className="relative w-full rounded-lg overflow-hidden border border-border bg-card">
      <canvas ref={canvasRef} className="w-full h-auto" />
      {detections.length > 0 && (
        <div className="absolute top-3 left-3 bg-card/80 backdrop-blur-sm px-3 py-1.5 rounded-md border border-border">
          <span className="font-mono text-sm text-primary">{detections.length} detected</span>
        </div>
      )}
    </div>
  );
});

function draw(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  detections: Detection[],
  highlightedId: number | null
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(img, 0, 0);

  for (const det of detections) {
    const color = COLORS[det.classId % COLORS.length];
    const isHighlighted = highlightedId === det.id;
    const lineWidth = isHighlighted ? 4 : 2;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(det.x, det.y, det.width, det.height);

    // Label background
    const label = `${det.className.split("(")[0].trim()} ${det.confidence}%`;
    ctx.font = `bold ${Math.max(12, img.naturalWidth * 0.015)}px monospace`;
    const metrics = ctx.measureText(label);
    const labelH = 20;
    ctx.fillStyle = color;
    ctx.fillRect(det.x, det.y - labelH, metrics.width + 8, labelH);
    ctx.fillStyle = "#000";
    ctx.fillText(label, det.x + 4, det.y - 5);

    if (isHighlighted) {
      ctx.fillStyle = color + "20";
      ctx.fillRect(det.x, det.y, det.width, det.height);
    }
  }
}
