import { cn } from "@/lib/utils";
import { ptSessionStatusLabel, ptBillingTypeLabel } from "@/lib/pt-format";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function PTSessionStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-success/10 text-success border-success/20",
    cancelled_student: "bg-destructive/10 text-destructive border-destructive/20",
    cancelled_trainer: "bg-destructive/10 text-destructive border-destructive/20",
    no_show: "bg-warning/15 text-warning-foreground border-warning/30",
  };
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
      styles[status] ?? "bg-muted text-muted-foreground border-border",
    )}>
      {ptSessionStatusLabel[status] ?? status}
    </span>
  );
}

export function PTStudentStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-state-paid-soft text-state-paid border-state-paid/30",
    inactive: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-400 dark:border-yellow-500/30",
    paused: "bg-warning/15 text-warning-foreground border-warning/30",
    churned: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30",
  };
  const labels: Record<string, string> = {
    active: "Ativo",
    inactive: "Inativo",
    paused: "Pausado",
    churned: "Churn",
  };
  const tooltips: Record<string, string> = {
    inactive: "Sem pagamento há 1 mês",
    churned: "Sem pagamento há 2 meses ou mais",
  };
  const badge = (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
      styles[status] ?? styles.inactive,
    )}>
      {labels[status] ?? status}
    </span>
  );
  const tip = tooltips[status];
  if (!tip) return badge;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild><span>{badge}</span></TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function PTBillingBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      {ptBillingTypeLabel[type] ?? type}
    </span>
  );
}

export function PTBadge() {
  return (
    <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
      PT
    </span>
  );
}
