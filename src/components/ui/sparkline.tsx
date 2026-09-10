import * as React from "react";
import { cn } from "@/lib/utils";

export interface SparklineProps extends React.SVGAttributes<SVGSVGElement> {
  data: number[];
  height?: number;
  strokeWidth?: number;
  tone?: "primary" | "success" | "warning" | "destructive" | "neutral";
  fill?: boolean;
}

const toneColors: Record<NonNullable<SparklineProps["tone"]>, { stroke: string; fill: string }> = {
  primary: {
    stroke: "var(--primary, #0ea5e9)",
    fill: "var(--primary, #0ea5e9)",
  },
  success: {
    stroke: "#10b981",
    fill: "#10b981",
  },
  warning: {
    stroke: "#f59e0b",
    fill: "#f59e0b",
  },
  destructive: {
    stroke: "#ef4444",
    fill: "#ef4444",
  },
  neutral: {
    stroke: "currentColor",
    fill: "currentColor",
  },
};

export function Sparkline({
  data,
  height = 32,
  strokeWidth = 2,
  tone = "primary",
  fill = true,
  className,
  ...props
}: SparklineProps) {
  const id = React.useId();
  const gradientId = `sparkline-grad-${id}`;

  if (!data || data.length < 2) return null;

  const width = 100;
  const paddingY = 4;
  const usableHeight = height - paddingY * 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = paddingY + usableHeight - ((val - min) / range) * usableHeight;
    return { x, y };
  });

  // Generate SVG path command with smooth quadratic bezier curves
  const linePath = points.reduce((acc, point, i, arr) => {
    if (i === 0) return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    const prev = arr[i - 1];
    const midX = ((prev.x + point.x) / 2).toFixed(1);
    const midY = ((prev.y + point.y) / 2).toFixed(1);
    return `${acc} Q ${prev.x.toFixed(1)} ${prev.y.toFixed(1)}, ${midX} ${midY}`;
  }, "");

  const lastPoint = points[points.length - 1];
  const fullLinePath = `${linePath} T ${lastPoint.x.toFixed(1)} ${lastPoint.y.toFixed(1)}`;
  const areaPath = `${fullLinePath} L ${width} ${height} L 0 ${height} Z`;

  const colors = toneColors[tone] || toneColors.primary;

  return (
    <div className={cn("relative w-full overflow-hidden", className)} style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
        {...props}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.fill} stopOpacity={0.25} />
            <stop offset="100%" stopColor={colors.fill} stopOpacity={0.0} />
          </linearGradient>
        </defs>

        {fill && (
          <path
            d={areaPath}
            fill={`url(#${gradientId})`}
            className="transition-all duration-300"
          />
        )}

        <path
          d={fullLinePath}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className="transition-all duration-300"
        />

        {/* Highlight dot on the last data point */}
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={strokeWidth * 1.5}
          fill={colors.stroke}
          className="animate-pulse"
        />
      </svg>
    </div>
  );
}
