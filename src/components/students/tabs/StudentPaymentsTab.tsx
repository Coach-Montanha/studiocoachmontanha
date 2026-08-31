import { useState, useMemo, Fragment } from "react";
import { Plus, Pencil, Trash2, RefreshCw, ArrowRightLeft, Ticket, ChevronDown, ArrowRight, Loader2, CalendarClock, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TooltipRoot, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PaymentStatusBadge, PlanBadge } from "@/components/edufinance/Badges";
import { EmptyState } from "@/components/edufinance/EmptyState";
import { formatBRL, formatDateBR, formatMonthLong, paymentMethodLabel } from "@/lib/format";
import { allocateCheckins, checkinChipClass, checkinTone, type CheckinPkg } from "@/lib/checkins";
import { downloadReceiptPdf } from "@/lib/receipt-pdf";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export type PaymentRow = {
  id: string;
  amount: number;
  payment_date: string;
  due_date: string | null;
  reference_month: string;
  payment_method: string;
  status: string;
  notes: string | null;
  plan_id: string | null;
  student_id: string;
  auto_renew: boolean | null;
  renewed_from_payment_id: string | null;
  renewals_remaining: number | null;
  checkin_quota_override: number | null;
  plans: {
    name: string;
    billing_cycle: string | null;
    auto_renew: boolean | null;
    max_renewals: number | null;
    checkin_quota_type: string | null;
    checkin_quota_amount: number | null;
    package_valid_days: number | null;
  } | null;
};

export function StudentPaymentsTab({
  payments,
  attendanceDates,
  freezes,
  student,
  onEdit,
  onDelete,
  onAdd,
  onTransfer,
  onRenew,
  onToggleAutoRenew,
  renewingId,
}: {
  payments: PaymentRow[];
  attendanceDates: string[];
  freezes: any[];
  student?: {
    name: string;
    email?: string | null;
    phone?: string | null;
    cpf?: string | null;
  } | null;
  onEdit: (p: PaymentRow) => void;
  onDelete: (p: PaymentRow) => void;
  onAdd: () => void;
  onTransfer: (p: PaymentRow) => void;
  onRenew: (p: PaymentRow) => void | Promise<void>;
  onToggleAutoRenew: (p: PaymentRow) => void | Promise<void>;
  renewingId: string | null;
}) {
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const checkinByPayment = useMemo(
    () => allocateCheckins(payments, attendanceDates, freezes),
    [payments, attendanceDates, freezes],
  );

  const activePackage = useMemo(() => {
    const entries = payments
      .filter((p) => checkinByPayment.has(p.id))
      .sort((a, b) => (a.payment_date < b.payment_date ? -1 : 1))
      .map((p) => ({ payment: p, pkg: checkinByPayment.get(p.id)! }));
    const today = new Date().toISOString().slice(0, 10);
    return (
      entries.find(
        (e) =>
          e.pkg.quota - e.pkg.used.length > 0 &&
          (!e.pkg.validUntil || e.pkg.validUntil >= today),
      ) ?? null
    );
  }, [payments, checkinByPayment]);

  const [toggled, setToggled] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const isExpanded = (id: string, pkg: CheckinPkg) => {
    const defaultOpen =
      checkinTone(Math.max(0, pkg.quota - pkg.used.length), pkg.quota) !== "primary";
    return toggled.has(id) ? !defaultOpen : defaultOpen;
  };

  const years = useMemo(() => {
    const s = new Set(payments.map((p) => p.reference_month.slice(0, 4)));
    return [...s].sort((a, b) => (a < b ? 1 : -1));
  }, [payments]);

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (yearFilter !== "all" && !p.reference_month.startsWith(yearFilter)) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      return true;
    });
  }, [payments, yearFilter, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, PaymentRow[]>();
    for (const p of filtered) {
      const y = p.reference_month.slice(0, 4);
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(p);
    }
    return [...map.entries()].sort(([a], [b]) => (a < b ? 1 : -1));
  }, [filtered]);

  async function handleGenerateReceipt(p: PaymentRow) {
    if (p.status !== "paid") {
      toast.error("Recibos só podem ser emitidos para pagamentos quitados.");
      return;
    }
    try {
      await downloadReceiptPdf({
        receiptId: p.id,
        studentName: student?.name || "Aluno",
        studentEmail: student?.email,
        studentPhone: student?.phone,
        studentCpf: student?.cpf,
        amount: Number(p.amount),
        paymentDate: p.payment_date,
        dueDate: p.due_date,
        referenceMonth: p.reference_month,
        paymentMethod: p.payment_method,
        planName: p.plans?.name || "Mensalidade Studio",
        notes: p.notes,
        kind: "studio",
      });
      toast.success("Recibo do aluno gerado em PDF!");
    } catch (err: any) {
      toast.error("Erro ao gerar recibo: " + err.message);
    }
  }

  return (
    <Card className="p-5 space-y-4">
      {activePackage && (
        <ActivePackageSummary
          payment={activePackage.payment}
          pkg={activePackage.pkg}
          onOpenDetails={() => {
            setYearFilter("all");
            setStatusFilter("all");
            const id = activePackage.payment.id;
            const open = isExpanded(id, activePackage.pkg);
            if (!open) toggleExpanded(id);
            requestAnimationFrame(() => {
              document
                .getElementById(`pkg-${id}`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            });
          }}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os anos</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="overdue">Atrasado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={onAdd}>
          <Plus className="h-4 w-4" /> Adicionar Pagamento
        </Button>
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          title="Sem pagamentos"
          description="Nenhum registro para os filtros selecionados"
        />
      ) : (
        grouped.map(([year, rows]) => {
          const paidRows = rows.filter((r) => r.status === "paid");
          const total = paidRows.reduce((s, r) => s + Number(r.amount), 0);
          const avg = paidRows.length ? total / paidRows.length : 0;
          return (
            <div key={year} className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">{year}</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês de Referência</TableHead>
                    <TableHead>Data de Pagamento</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Forma</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => {
                    const isRenewable = p.auto_renew ?? p.plans?.auto_renew ?? false;
                    const remaining = p.renewals_remaining;
                    const isRenewing = renewingId === p.id;
                    const canRenew = p.status === "paid" && !isRenewing;
                    const pkg = checkinByPayment.get(p.id);
                    return (
                      <Fragment key={p.id}>
                        <TableRow
                          className={cn(
                            "group transition-colors duration-200",
                            pkg && isExpanded(p.id, pkg) && "border-b-0",
                          )}
                        >
                          <TableCell className="text-xs capitalize">
                            <span className="font-medium">{formatMonthLong(p.reference_month)}</span>
                            {isRenewable && (
                              <TooltipRoot>
                                <TooltipTrigger asChild>
                                  <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary transition-colors duration-200">
                                    <RefreshCw className="h-2.5 w-2.5" />
                                    {remaining != null ? `auto · ${remaining}` : "auto"}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {remaining != null
                                    ? `Renovações automáticas restantes: ${remaining}`
                                    : "Renovação automática ativada"}
                                </TooltipContent>
                              </TooltipRoot>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {formatDateBR(p.payment_date)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <PlanBadge name={p.plans?.name} />
                              {pkg && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpanded(p.id)}
                                  aria-expanded={isExpanded(p.id, pkg)}
                                  aria-controls={`pkg-${p.id}`}
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                                    "transition-all duration-200 hover:brightness-105 active:scale-[0.97]",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                                    checkinChipClass(
                                      checkinTone(Math.max(0, pkg.quota - pkg.used.length), pkg.quota),
                                    ),
                                  )}
                                >
                                  <Ticket className="h-3 w-3" />
                                  {Math.max(0, pkg.quota - pkg.used.length)}/{pkg.quota}
                                  <ChevronDown
                                    className={cn(
                                      "h-3 w-3 transition-transform duration-200",
                                      isExpanded(p.id, pkg) && "rotate-180",
                                    )}
                                  />
                                </button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium tabular-nums">
                            {formatBRL(p.amount)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {paymentMethodLabel(p.payment_method)}
                          </TableCell>
                          <TableCell>
                            <PaymentStatusBadge status={p.status} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {p.notes ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center rounded-lg border border-border/60 bg-background/50 p-0.5 shadow-sm divide-x divide-border/60">
                              {p.status === "paid" && (
                                <div className="flex items-center px-0.5">
                                  <TooltipRoot>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        aria-label="Gerar recibo em PDF"
                                        className="h-8 w-8 rounded-md text-blue-600 transition-all duration-200 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:scale-[0.96] dark:text-blue-400 dark:hover:bg-blue-950/50"
                                        onClick={() => handleGenerateReceipt(p)}
                                      >
                                        <FileText className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Gerar Recibo em PDF</TooltipContent>
                                  </TooltipRoot>
                                </div>
                              )}
                              <div className="flex items-center px-0.5">
                                <TooltipRoot>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      aria-label={
                                        isRenewable
                                          ? "Desativar renovação automática"
                                          : "Ativar renovação automática"
                                      }
                                      aria-pressed={isRenewable}
                                      className={cn(
                                        "h-8 w-8 rounded-md transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:scale-[0.96]",
                                        isRenewable &&
                                          "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
                                      )}
                                      onClick={() => onToggleAutoRenew(p)}
                                    >
                                      <RefreshCw className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {isRenewable
                                      ? "Desativar renovação automática"
                                      : "Ativar renovação automática"}
                                  </TooltipContent>
                                </TooltipRoot>
                              </div>
                              <div className="flex items-center px-0.5">
                                <TooltipRoot>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      aria-label="Renovar pagamento"
                                      disabled={!canRenew}
                                      className="h-8 w-8 rounded-md transition-all duration-200 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:scale-[0.96] disabled:opacity-40 disabled:cursor-not-allowed"
                                      onClick={() => onRenew(p)}
                                    >
                                      {isRenewing ? (
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Plus className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {p.status === "paid"
                                      ? "Renovar (criar próximo pagamento)"
                                      : "Só pagamentos pagos podem ser renovados"}
                                  </TooltipContent>
                                </TooltipRoot>
                                <TooltipRoot>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      aria-label="Transferir para outro aluno"
                                      className="h-8 w-8 rounded-md transition-all duration-200 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:scale-[0.96]"
                                      onClick={() => onTransfer(p)}
                                    >
                                      <ArrowRightLeft className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Transferir para outro aluno</TooltipContent>
                                </TooltipRoot>
                              </div>
                              <div className="flex items-center px-0.5">
                                <TooltipRoot>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      aria-label="Editar pagamento"
                                      className="h-8 w-8 rounded-md transition-all duration-200 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:scale-[0.96]"
                                      onClick={() => onEdit(p)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Editar</TooltipContent>
                                </TooltipRoot>
                                <TooltipRoot>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      aria-label="Excluir pagamento"
                                      className="h-8 w-8 rounded-md transition-all duration-200 hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-1 active:scale-[0.96]"
                                      onClick={() => onDelete(p)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Excluir</TooltipContent>
                                </TooltipRoot>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                        {pkg && isExpanded(p.id, pkg) && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={8} className="pt-0 pb-4">
                              <div
                                id={`pkg-${p.id}`}
                                className="animate-in fade-in-0 slide-in-from-top-1 duration-200"
                              >
                                <CheckinPackagePanel payment={p} pkg={pkg} />
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                  <TableRow className="bg-muted/40 font-medium">
                    <TableCell colSpan={3} className="text-xs">
                      Resumo {year}: {paidRows.length} pagamento
                      {paidRows.length === 1 ? "" : "s"}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatBRL(total)}</TableCell>
                    <TableCell colSpan={3} className="text-xs text-muted-foreground">
                      Ticket médio: {formatBRL(avg)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          );
        })
      )}
    </Card>
  );
}

function ActivePackageSummary({
  payment,
  pkg,
  onOpenDetails,
}: {
  payment: PaymentRow;
  pkg: CheckinPkg;
  onOpenDetails: () => void;
}) {
  const used = pkg.used.length;
  const remaining = Math.max(0, pkg.quota - used);
  const pct = pkg.quota > 0 ? Math.min(100, (used / pkg.quota) * 100) : 0;
  const tone = checkinTone(remaining, pkg.quota);

  const barClass =
    tone === "destructive" ? "bg-destructive" : tone === "warning" ? "bg-warning" : "bg-primary";

  return (
    <section
      aria-label="Resumo do pacote ativo"
      className={cn(
        "rounded-xl border p-4 transition-colors duration-200",
        tone === "destructive"
          ? "border-destructive/25 bg-destructive/5"
          : tone === "warning"
            ? "border-warning/30 bg-warning/5"
            : "border-primary/20 bg-primary/5",
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pacote ativo
            </h3>
          </div>

          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <p className="text-3xl font-semibold leading-none tabular-nums">{remaining}</p>
              <p className="mt-1 text-xs leading-none text-muted-foreground">
                check-in{remaining === 1 ? "" : "s"} restante{remaining === 1 ? "" : "s"}
              </p>
            </div>
            <div>
              <p className="text-base font-medium leading-none tabular-nums text-foreground/80">
                {used}/{pkg.quota}
              </p>
              <p className="mt-1 text-xs leading-none text-muted-foreground">usados</p>
            </div>
            {pkg.validUntil && (
              <div>
                <p className="text-base font-medium leading-none tabular-nums text-foreground/80">
                  {formatDateBR(pkg.validUntil)}
                </p>
                <p className="mt-1 text-xs leading-none text-muted-foreground">
                  válido até{pkg.freezeDays > 0 ? ` (+${pkg.freezeDays}d)` : ""}
                </p>
              </div>
            )}
          </div>

          <div className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all duration-300", barClass)}
              style={{ width: `${pct}%` }}
            />
          </div>

          <p className="text-xs leading-snug text-muted-foreground">
            {payment.plans?.name ?? "Pacote"} · pago em {formatDateBR(payment.payment_date)}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenDetails}
          className="shrink-0 transition-all duration-200 hover:bg-accent active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          Ver detalhes <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </section>
  );
}

function CheckinPackagePanel({ payment, pkg }: { payment: PaymentRow; pkg: CheckinPkg }) {
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<string>(String(pkg.quota ?? ""));
  const [saving, setSaving] = useState(false);

  const used = pkg.used.length;
  const remaining = Math.max(0, pkg.quota - used);
  const pct = pkg.quota > 0 ? Math.min(100, (used / pkg.quota) * 100) : 0;
  const tone = checkinTone(remaining, pkg.quota);

  const barClass =
    tone === "destructive" ? "bg-destructive" : tone === "warning" ? "bg-warning" : "bg-primary";
  const ringClass =
    tone === "destructive"
      ? "border-destructive/25 bg-destructive/5"
      : tone === "warning"
        ? "border-warning/30 bg-warning/5"
        : "border-primary/20 bg-primary/5";

  const expectedDue = pkg.validUntil;
  const dueMismatch = Boolean(expectedDue && payment.due_date && payment.due_date < expectedDue);
  const [fixing, setFixing] = useState(false);

  async function fixDueDate() {
    if (!expectedDue) return;
    setFixing(true);
    const { error } = await supabase
      .from("payments")
      .update({ due_date: expectedDue })
      .eq("id", payment.id);
    setFixing(false);
    if (error) return toast.error(error.message);
    toast.success("Validade corrigida");
    qc.invalidateQueries({ queryKey: ["student-payments"] });
  }

  async function save(value: number | null) {
    setSaving(true);
    const { error } = await supabase
      .from("payments")
      .update({ checkin_quota_override: value })
      .eq("id", payment.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(value == null ? "Cota do plano restaurada" : "Cota ajustada");
    setEditOpen(false);
    qc.invalidateQueries({ queryKey: ["student-payments"] });
  }

  const visible = showAll ? pkg.used : pkg.used.slice(0, 6);

  return (
    <div className={cn("rounded-xl border p-4 transition-colors duration-200", ringClass)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Ticket className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold leading-none tracking-tight">
              Check-ins do pacote
            </h4>
            {pkg.isOverride && (
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                cota ajustada
              </span>
            )}
            {dueMismatch && (
              <span className="rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
                validade divergente
              </span>
            )}
          </div>

          {dueMismatch && (
            <div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-relaxed text-muted-foreground">
                O vencimento salvo (
                <span className="font-medium tabular-nums text-foreground">
                  {formatDateBR(payment.due_date!)}
                </span>
                ) é menor que a validade do pacote (
                <span className="font-medium tabular-nums text-foreground">
                  {formatDateBR(expectedDue!)}
                </span>
                ).
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={fixing}
                onClick={fixDueDate}
                className="w-full shrink-0 transition-all duration-200 active:scale-[0.97] sm:w-auto"
              >
                {fixing ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                )}
                Corrigir validade
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end sm:gap-8">
            <div>
              <p className="text-2xl font-semibold leading-tight tabular-nums">{remaining}</p>
              <p className="text-xs leading-tight text-muted-foreground">Restantes</p>
            </div>
            <div>
              <p className="text-base font-medium leading-tight tabular-nums text-foreground/80">
                {used}
              </p>
              <p className="text-xs leading-tight text-muted-foreground">Usados</p>
            </div>
            <div>
              <p className="text-base font-medium leading-tight tabular-nums text-foreground/80">
                {pkg.quota}
              </p>
              <p className="text-xs leading-tight text-muted-foreground">Cota</p>
            </div>
            {pkg.validUntil && (
              <div>
                <p className="text-base font-medium leading-tight tabular-nums text-foreground/80">
                  {formatDateBR(pkg.validUntil)}
                </p>
                <p className="text-xs leading-tight text-muted-foreground">
                  Válido até{pkg.freezeDays > 0 ? ` (+${pkg.freezeDays}d)` : ""}
                </p>
              </div>
            )}
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all duration-300", barClass)}
              style={{ width: `${pct}%` }}
            />
          </div>

          {used > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {visible.map((d) => (
                <span
                  key={d}
                  className="rounded-full bg-muted/70 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground"
                >
                  {formatDateBR(d)}
                </span>
              ))}
              {pkg.used.length > 6 && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-primary transition-colors duration-200 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showAll ? "ver menos" : `ver todas (${pkg.used.length})`}
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum check-in utilizado neste pacote.</p>
          )}
        </div>

        <Popover
          open={editOpen}
          onOpenChange={(o) => {
            setEditOpen(o);
            if (o) setDraft(String(pkg.quota ?? ""));
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 transition-all duration-200 active:scale-[0.97]"
            >
              <Pencil className="h-3.5 w-3.5" /> Ajustar
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold leading-none">Cota de check-ins</p>
              <p className="text-xs leading-snug text-muted-foreground">
                Vale só para este pagamento. Limpe para voltar à cota do plano
                {payment.plans?.checkin_quota_amount != null
                  ? ` (${payment.plans.checkin_quota_amount})`
                  : ""}
                .
              </p>
            </div>
            <Input
              type="number"
              min={0}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="tabular-nums"
            />
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={saving || !pkg.isOverride}
                onClick={() => save(null)}
              >
                Limpar
              </Button>
              <Button
                size="sm"
                disabled={
                  saving || draft === "" || Number(draft) < 0 || Number.isNaN(Number(draft))
                }
                onClick={() => save(Number(draft))}
              >
                {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null} Salvar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
