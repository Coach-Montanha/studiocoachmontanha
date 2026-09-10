import * as React from "react";
import { ChevronsLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ImageComparisonProps extends React.HTMLAttributes<HTMLDivElement> {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  initialPosition?: number;
  aspectRatio?: "square" | "portrait" | "video" | "auto";
}

export function ImageComparison({
  beforeImage,
  afterImage,
  beforeLabel = "Antes",
  afterLabel = "Depois",
  initialPosition = 50,
  aspectRatio = "portrait",
  className,
  ...props
}: ImageComparisonProps) {
  const [sliderPosition, setSliderPosition] = React.useState(initialPosition);
  const [isDragging, setIsDragging] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleMove = React.useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPosition(percent);
    },
    [],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    handleMove(e.clientX);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignored if pointer capture was already released
    }
  };

  const aspectClass =
    aspectRatio === "portrait"
      ? "aspect-[3/4]"
      : aspectRatio === "square"
        ? "aspect-square"
        : aspectRatio === "video"
          ? "aspect-video"
          : "";

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={cn(
        "group relative w-full select-none overflow-hidden rounded-xl border border-border bg-muted cursor-ew-resize touch-none shadow-md",
        aspectClass,
        className,
      )}
      {...props}
    >
      {/* After Image (Background) */}
      <img
        src={afterImage}
        alt={afterLabel}
        className="absolute inset-0 h-full w-full object-cover pointer-events-none"
      />

      {/* Before Image (Clipped overlay) */}
      <div
        className="absolute inset-0 h-full w-full overflow-hidden pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <img
          src={beforeImage}
          alt={beforeLabel}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      {/* Labels */}
      <div className="absolute top-3 left-3 pointer-events-none z-10">
        <span className="rounded-full bg-background/85 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm ring-1 ring-border/50">
          {beforeLabel}
        </span>
      </div>
      <div className="absolute top-3 right-3 pointer-events-none z-10">
        <span className="rounded-full bg-background/85 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm ring-1 ring-border/50">
          {afterLabel}
        </span>
      </div>

      {/* Divider line */}
      <div
        className="absolute inset-y-0 pointer-events-none z-20 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)]"
        style={{ left: `${sliderPosition}%` }}
      >
        {/* Grip Handle */}
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-background shadow-lg transition-transform group-hover:scale-110">
          <ChevronsLeftRight className="h-4 w-4 text-foreground" />
        </div>
      </div>
    </div>
  );
}
