import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const paymentStyles: Record<string, string> = {
  paid: "bg-state-paid-soft text-state-paid border-state-paid/30",
  pending: "bg-state-pending-soft text-state-pending border-state-pending/30",
  overdue: "bg-state-late-soft text-state-late border-state-late/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const studentStyles: Record<string, string> = {
  active: "bg-state-paid-soft text-state-paid border-state-paid/30",
  inactive: "bg-state-pending-soft text-state-pending border-state-pending/30",
  churned: "bg-state-late-soft text-state-late border-state-late/30",
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
