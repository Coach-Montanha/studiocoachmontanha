import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/format";

const paymentStyles: Record<string, string> = {
  paid: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning-foreground border-warning/30",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const studentStyles: Record<string, string> = {
  active: "bg-success/10 text-success border-success/20",
  inactive: "bg-muted text-muted-foreground border-border",
  churned: "bg-destructive/10 text-destructive border-destructive/20",
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
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        studentStyles[status] ?? studentStyles.inactive,
      )}
    >
      {statusLabel.student[status] ?? status}
    </span>
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
