import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "primary" | "paid" | "pending" | "late" | "frozen";

const toneRing: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  primary: "bg-primary/10 text-primary ring-primary/15",
  paid: "bg-state-paid-soft text-state-paid ring-state-paid/20",
  pending: "bg-state-pending-soft text-state-pending ring-state-pending/20",
  late: "bg-state-late-soft text-state-late ring-state-late/20",
  frozen: "bg-state-frozen-soft text-state-frozen ring-state-frozen/20",
};

/**
 * KPI. Valor tabular em destaque, label discreto, delta opcional.
 * Usa exclusivamente tokens semânticos — dark mode sai de graça.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  delta,
  onClick,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  delta?: number | null;
  onClick?: () => void;
  className?: string;
}) {
  const interactive = typeof onClick === "function";
  const Comp = interactive ? "button" : "div";
  const up = (delta ?? 0) >= 0;

  return (
    <Comp
      {...(interactive ? { type: "button" as const, onClick } : {})}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card p-4 text-left shadow-card transition-ui sm:p-5",
        interactive &&
          "focus-ring cursor-pointer hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-float active:translate-y-0",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-overline min-w-0 truncate text-muted-foreground">{label}</p>
        {Icon && (
          <span
            aria-hidden
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-lg ring-1 ring-inset transition-ui",
              toneRing[tone],
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>

      <p className="text-numeric mt-3 text-2xl text-foreground sm:text-[1.75rem]">{value}</p>

      {(hint || typeof delta === "number") && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          {typeof delta === "number" && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.6875rem] font-semibold",
                up ? "bg-state-paid-soft text-state-paid" : "bg-state-late-soft text-state-late",
              )}
            >
              {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {up ? "+" : ""}
              {delta.toFixed(0)}%
            </span>
          )}
          {hint && <span className="text-caption min-w-0 truncate text-muted-foreground">{hint}</span>}
        </div>
      )}
    </Comp>
  );
}
