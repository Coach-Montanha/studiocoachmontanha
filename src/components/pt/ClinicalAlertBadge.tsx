import { AlertTriangle, ShieldAlert, HeartPulse, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ClinicalAlertBadgeProps {
  alerts: string[];
  riskLevel?: "low" | "moderate" | "high" | string;
  onClick?: () => void;
  className?: string;
  variant?: "banner" | "compact" | "badge";
}

export function ClinicalAlertBadge({
  alerts,
  riskLevel = "moderate",
  onClick,
  className,
  variant = "banner",
}: ClinicalAlertBadgeProps) {
  if (!alerts || alerts.length === 0) return null;

  const isHighRisk = riskLevel === "high";

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border transition-all cursor-pointer",
          isHighRisk
            ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20"
            : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20",
          className,
        )}
        title={alerts.join(" • ")}
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>Atenção Clínica ({alerts.length})</span>
      </button>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border p-3 sm:px-4 sm:py-3 transition-all",
        isHighRisk
          ? "border-red-500/40 bg-red-500/[0.06] text-red-950 dark:text-red-200 shadow-xs"
          : "border-amber-500/40 bg-amber-500/[0.06] text-amber-950 dark:text-amber-200 shadow-xs",
        onClick && "cursor-pointer hover:border-amber-500/70",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
            isHighRisk ? "bg-red-500/20 text-red-600 dark:text-red-400" : "bg-amber-500/20 text-amber-600 dark:text-amber-400",
          )}
        >
          {isHighRisk ? <ShieldAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider">
              {isHighRisk ? "Alto Risco Clínico (PAR-Q)" : "Atenção Clínica & Restrições"}
            </span>
            <div className="flex flex-wrap items-center gap-1">
              {alerts.map((alert, i) => (
                <span
                  key={i}
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[10px] font-bold border",
                    isHighRisk
                      ? "border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-300"
                      : "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300",
                  )}
                >
                  {alert}
                </span>
              ))}
            </div>
          </div>
          <p className="mt-0.5 text-[11px] opacity-80 truncate">
            Evite sobrecargas axiais ou amplitudes extremas nas articulações indicadas.
          </p>
        </div>
      </div>

      {onClick && (
        <span className="text-xs font-semibold underline underline-offset-2 opacity-90 hover:opacity-100 shrink-0">
          Ver Anamnese →
        </span>
      )}
    </div>
  );
}
