import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const paymentStyles: Record<string, string> = {
  paid: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning-foreground border-warning/30",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const studentStyles: Record<string, string> = {
  active: "bg-state-paid-soft text-state-paid border-state-paid/30",
  inactive: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-400 dark:border-yellow-500/30",
  churned: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30",
};

const studentTooltips: Record<string, string> = {
  inactive: "Sem pagamento há 1 mês",
  churned: "Sem pagamento há 2 meses ou mais",
};

const studentDisplay: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
  churned: "Churn",
};

export function PaymentStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        paymentStyles[status] ?? paymentStyles.cancelled,
      )}
    >
      {statusLabel.payment[status] ?? status}
    </span>
  );
}

export function StudentStatusBadge({ status }: { status: string }) {
  const badge = (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        studentStyles[status] ?? studentStyles.inactive,
      )}
    >
      {studentDisplay[status] ?? status}
    </span>
  );
  const tip = studentTooltips[status];
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

export function PlanBadge({ name }: { name: string | null | undefined }) {
  if (!name) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      {name}
    </span>
  );
}
