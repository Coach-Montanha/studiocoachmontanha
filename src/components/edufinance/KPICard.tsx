import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronRight, EyeOff, GripVertical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KPICard({
  label,
  value,
  icon,
  trend,
  hint,
  onClick,
  disabled,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  trend?: { value: number; positiveIsGood?: boolean };
  hint?: string;
  onClick?: () => void;
  disabled?: boolean;
  onHide?: () => void;
  dragHandleProps?: any;
}) {
  const showTrend = trend && Number.isFinite(trend.value);
  const isUp = (trend?.value ?? 0) >= 0;
  const positiveIsGood = trend?.positiveIsGood ?? true;
  const good = positiveIsGood ? isUp : !isUp;
  const interactive = Boolean(onClick) && !disabled;

  return (
    <Card
      {...(interactive
        ? { role: "button" as const, tabIndex: 0, onClick,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); }
            } }
        : {})}
      aria-disabled={onClick && disabled ? true : undefined}
      className={cn(
        "group relative overflow-hidden p-4 shadow-card transition-ui sm:p-5",
        interactive
          ? "focus-ring cursor-pointer hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-float active:translate-y-0"
          : onClick && disabled
            ? "cursor-default opacity-60"
            : "hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-float",
      )}
    >
      {onHide && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onHide();
          }}
          className="absolute right-2 top-2 z-10 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
          title="Esconder card"
        >
          <EyeOff className="h-3.5 w-3.5" />
        </button>
      )}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          className="absolute left-1.5 top-1/2 z-10 -translate-y-1/2 cursor-grab rounded-md p-1 text-muted-foreground/30 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      )}
      {/* Realce sutil no topo — dá personalidade sem poluir. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-ui group-hover:opacity-100"
      />
      {interactive && (
        <ChevronRight
          aria-hidden
          className="absolute bottom-4 right-4 h-4 w-4 text-muted-foreground opacity-0 transition-ui group-hover:translate-x-0.5 group-hover:opacity-100"
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="text-overline min-w-0 truncate text-muted-foreground">{label}</div>
        {icon && (
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/15 transition-ui group-hover:bg-primary/15">
            {icon}
          </div>
        )}
      </div>
      <div className="text-numeric mt-3 text-2xl text-foreground sm:text-[1.75rem]">{value}</div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        {showTrend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.6875rem] font-semibold",
              good ? "bg-state-paid-soft text-state-paid" : "bg-state-late-soft text-state-late",
            )}
          >
            {isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(trend!.value).toFixed(1).replace(".", ",")}%
          </span>
        )}
        {hint && <span className="text-caption min-w-0 truncate text-muted-foreground">{hint}</span>}
      </div>
    </Card>
  );
}

