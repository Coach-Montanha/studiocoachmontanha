import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KPICard({
  label,
  value,
  icon,
  trend,
  hint,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  trend?: { value: number; positiveIsGood?: boolean };
  hint?: string;
}) {
  const showTrend = trend && Number.isFinite(trend.value);
  const isUp = (trend?.value ?? 0) >= 0;
  const positiveIsGood = trend?.positiveIsGood ?? true;
  const good = positiveIsGood ? isUp : !isUp;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        {icon && <div className="text-primary">{icon}</div>}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight font-mono">{value}</div>
      <div className="mt-2 flex items-center gap-2">
        {showTrend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
              good ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
            )}
          >
            {isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(trend!.value).toFixed(1).replace(".", ",")}%
          </span>
        )}
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
    </Card>
  );
}
