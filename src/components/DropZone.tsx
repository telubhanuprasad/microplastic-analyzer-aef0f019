import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Upload, Microscope } from "lucide-react";

interface DropZoneProps {
  onImageSelect: (file: File) => void;
  disabled?: boolean;
}

export function DropZone({ onImageSelect, disabled }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith("image/")) onImageSelect(file);
    },
    [onImageSelect, disabled]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onImageSelect(file);
    },
    [onImageSelect]
  );

  return (
    <motion.label
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      whileHover={{ scale: disabled ? 1 : 1.01 }}
      className={`
        relative flex flex-col items-center justify-center gap-4
        w-full min-h-[320px] rounded-lg border-2 border-dashed cursor-pointer
        transition-all duration-300
        ${isDragging ? "border-primary bg-primary/5 glow-primary" : "border-border hover:border-primary/50"}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      {/* Scan line effect */}
      {isDragging && (
        <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
          <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan" />
        </div>
      )}

      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />

      <div className="p-4 rounded-full bg-secondary">
        {isDragging ? (
          <Microscope className="w-10 h-10 text-primary animate-pulse-glow" />
        ) : (
          <Upload className="w-10 h-10 text-muted-foreground" />
        )}
      </div>

      <div className="text-center">
        <p className="text-lg font-heading text-foreground">
          {isDragging ? "Release to analyze" : "Drop sample image here"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          or click to browse • PNG, JPG, TIFF
        </p>
      </div>
    </motion.label>
  );
}
