import { createFileRoute } from "@tanstack/react-router";
import { confirmDialog } from "@/lib/confirm-dialog";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Search, RotateCw, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { renewPayment, renewPtPayment } from "@/lib/payment-renew";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PaymentDialog } from "@/components/edufinance/PaymentDialog";
import { PTPaymentDialog } from "@/components/pt/PTPaymentDialog";
import { PaymentStatusBadge, PlanBadge } from "@/components/edufinance/Badges";
import { EmptyState } from "@/components/edufinance/EmptyState";
import { MonthYearPicker } from "@/components/edufinance/MonthYearPicker";
import { BulkPaymentEditBar } from "@/components/edufinance/BulkPaymentEditBar";
import { Checkbox } from "@/components/ui/checkbox";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { addMonths, currentMonthKey, formatBRL, formatDateBR, formatMonthLabel } from "@/lib/format";
import { useScopeFilter } from "@/hooks/use-scope-filter";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({ meta: [{ title: "Pagamentos — EduFinance" }] }),
  component: PaymentsPage,
});

type Kind = "studio" | "pt" | "all";

type Row = {
  id: string;
  kind: "studio" | "pt";
  amount: number;
  payment_date: string;
  due_date: string | null;
  reference_month: string;
  payment_method: string;
  status: string;
  student_name: string;
  plan_name: string | null;
  original: any;
};

function PaymentsPage() {
  const qc = useQueryClient();
  const { scopeId, scopeKey, ready } = useScopeFilter();
  const [kind, setKind] = useState<Kind>("studio");
  const [month, setMonth] = useState<string>(currentMonthKey());
  const [allMonths, setAllMonths] = useState(false);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("all");
  const [status, setStatus] = useState("all");
  const [studioOpen, setStudioOpen] = useState(false);
  const [ptOpen, setPtOpen] = useState(false);
  const [editingStudio, setEditingStudio] = useState<any | null>(null);
  const [editingPt, setEditingPt] = useState<any | null>(null);
  const [useRange, setUseRange] = useState(false);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { methods: availableMethods, labelFor: pmLabel } = usePaymentMethods({ activeOnly: true });
  const [sortBy, setSortBy] = useState<string>("payment_date_desc");
  const [renewingId, setRenewingId] = useState<string | null>(null);

  async function renewRow(r: Row) {
    setRenewingId(r.id);
    try {
      const ok = r.kind === "studio"
        ? await renewPayment({
            id: r.original.id,
            student_id: r.original.student_id,
            plan_id: r.original.plan_id,
            amount: Number(r.original.amount),
            payment_date: r.original.payment_date,
            reference_month: r.original.reference_month,
            payment_method: r.original.payment_method,
            notes: r.original.notes ?? null,
            renewals_remaining: r.original.renewals_remaining,
            plans: r.original.plans,
          })
        : await renewPtPayment({
            id: r.original.id,
            pt_student_id: r.original.pt_student_id,
            pt_plan_id: r.original.pt_plan_id,
            amount: Number(r.original.amount),
            payment_date: r.original.payment_date,
            reference_month: r.original.reference_month,
            payment_method: r.original.payment_method,
            notes: r.original.notes ?? null,
            sessions_paid: r.original.sessions_paid ?? null,
          });
      if (ok) qc.invalidateQueries();
    } finally {
      setRenewingId(null);
    }
  }

  const { data: studioRows = [], isLoading: loadingStudio } = useQuery({
    queryKey: ["payments-studio", scopeKey],
    enabled: ready && (kind === "studio" || kind === "all"),
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        let q = supabase
          .from("payments")
          .select("id,amount,payment_date,due_date,reference_month,payment_method,status,student_id,plan_id,notes,renewals_remaining,students(name),plans(name,billing_cycle,max_renewals)")
          .is("deleted_at", null)
          .order("payment_date", { ascending: false })
          .range(from, from + PAGE - 1);
        if (scopeId) q = q.eq("user_id", scopeId);
        const { data, error } = await q;
        if (error) throw error;
        all = all.concat(data ?? []);
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }
      return all.map<Row>((p) => ({
        id: p.id,
        kind: "studio",
        amount: Number(p.amount),
        payment_date: p.payment_date,
        due_date: p.due_date,
        reference_month: p.reference_month,
        payment_method: p.payment_method,
        status: p.status,
        student_name: p.students?.name ?? "—",
        plan_name: p.plans?.name ?? null,
        original: p,
      }));
    },
  });

  const { data: ptRows = [], isLoading: loadingPt } = useQuery({
    queryKey: ["payments-pt", scopeKey],
    enabled: ready && (kind === "pt" || kind === "all"),
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        let q = supabase
          .from("pt_payments")
          .select("id,amount,payment_date,due_date,reference_month,payment_method,status,pt_student_id,pt_plan_id,pt_students(name),pt_plans(name)")
          .is("deleted_at", null)
          .order("payment_date", { ascending: false })
          .range(from, from + PAGE - 1);
        if (scopeId) q = q.eq("user_id", scopeId);
        const { data, error } = await q;
        if (error) throw error;
        all = all.concat(data ?? []);
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }
      return all.map<Row>((p) => ({
        id: p.id,
        kind: "pt",
        amount: Number(p.amount),
        payment_date: p.payment_date,
        due_date: p.due_date,
        reference_month: p.reference_month ?? p.payment_date.slice(0, 7),
        payment_method: p.payment_method,
        status: p.status,
        student_name: p.pt_students?.name ?? "—",
        plan_name: p.pt_plans?.name ?? null,
        original: p,
      }));
    },
  });

  const payments: Row[] = useMemo(() => {
    if (kind === "studio") return studioRows;
    if (kind === "pt") return ptRows;
    return [...studioRows, ...ptRows].sort((a, b) =>
      a.payment_date < b.payment_date ? 1 : -1,
    );
  }, [kind, studioRows, ptRows]);

  const isLoading =
    (kind === "studio" && loadingStudio) ||
    (kind === "pt" && loadingPt) ||
    (kind === "all" && (loadingStudio || loadingPt));

  // Clear cross-kind selection when switching
  useEffect(() => {
    setSelected(new Set());
  }, [kind]);

  const [page, setPage] = useState(0);
  const PER_PAGE = 50;

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = payments.filter((p) => {
      if (useRange) {
        if (rangeStart && p.payment_date < rangeStart) return false;
        if (rangeEnd && p.payment_date > rangeEnd) return false;
      } else {
        if (!allMonths && p.reference_month !== month) return false;
      }
      if (method !== "all" && p.payment_method !== method) return false;
      if (status !== "all" && p.status !== status) return false;
      if (q && !p.student_name.toLowerCase().includes(q)) return false;
      return true;
    });
    const statusOrder: Record<string, number> = { overdue: 0, pending: 1, paid: 2, cancelled: 3 };
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "payment_date_asc": return a.payment_date < b.payment_date ? -1 : a.payment_date > b.payment_date ? 1 : 0;
        case "payment_date_desc": return a.payment_date < b.payment_date ? 1 : a.payment_date > b.payment_date ? -1 : 0;
        case "due_date_asc": {
          const ad = a.due_date ?? "9999-12-31"; const bd = b.due_date ?? "9999-12-31";
          return ad < bd ? -1 : ad > bd ? 1 : 0;
        }
        case "due_date_desc": {
          const ad = a.due_date ?? "0000-01-01"; const bd = b.due_date ?? "0000-01-01";
          return ad < bd ? 1 : ad > bd ? -1 : 0;
        }
        case "amount_desc": return b.amount - a.amount;
        case "amount_asc": return a.amount - b.amount;
        case "student_asc": return a.student_name.localeCompare(b.student_name, "pt-BR");
        case "student_desc": return b.student_name.localeCompare(a.student_name, "pt-BR");
        case "status": return (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
        case "plan": return (a.plan_name ?? "").localeCompare(b.plan_name ?? "", "pt-BR");
        case "method": return a.payment_method.localeCompare(b.payment_method);
        case "reference_desc": return a.reference_month < b.reference_month ? 1 : a.reference_month > b.reference_month ? -1 : 0;
        case "reference_asc": return a.reference_month < b.reference_month ? -1 : a.reference_month > b.reference_month ? 1 : 0;
        default: return 0;
      }
    });
    return sorted;
  }, [payments, month, allMonths, useRange, rangeStart, rangeEnd, method, status, search, sortBy]);

  const totals = useMemo(() => {
    const paid = rows.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0);
    return { count: rows.length, paid };
  }, [rows]);

  const pageRows = rows.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));

  useEffect(() => { setPage(0); }, [search, method, status, month, allMonths, useRange, rangeStart, rangeEnd, kind]);

  async function remove(r: Row) {
    if (!(await confirmDialog("Mover este pagamento para a Lixeira?"))) return;
    const table = r.kind === "studio" ? "payments" : "pt_payments";
    const { error, count } = await supabase
      .from(table)
      .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
      .eq("id", r.id)
      .is("deleted_at", null);
    if (error) return toast.error(error.message);
    if (!count) return toast.error("Nada foi excluído (permissão negada).");
    toast.success("Pagamento movido para a Lixeira");
    qc.invalidateQueries();
  }

  function editRow(r: Row) {
    if (r.kind === "studio") {
      setEditingStudio(r.original);
      setStudioOpen(true);
    } else {
      setEditingPt(r.original);
      setPtOpen(true);
    }
  }

  const bulkEnabled = kind === "studio"; // BulkPaymentEditBar targets studio payments

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Pagamentos</h1>
          <p className="text-sm text-muted-foreground">
            {totals.count} registro(s)
            {useRange && rangeStart && rangeEnd
              ? ` · ${new Date(rangeStart + "T00:00").toLocaleDateString("pt-BR")} até ${new Date(rangeEnd + "T00:00").toLocaleDateString("pt-BR")}`
              : ""}
            {" · "}Total pago: <span className="font-mono font-medium text-foreground">{formatBRL(totals.paid)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Kind toggle: Studio / PT / Todos */}
          <div className="inline-flex rounded-md border p-0.5">
            {(["studio", "pt", "all"] as Kind[]).map((k) => (
              <Button
                key={k}
                variant={kind === k ? "default" : "ghost"}
                size="sm"
                className="h-9 rounded-sm"
                onClick={() => setKind(k)}
              >
                {k === "studio" ? "Studio" : k === "pt" ? "PT" : "Todos"}
              </Button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-11 sm:h-9"
            onClick={() => { setAllMonths(false); setUseRange(false); }}
          >
            <span className={!allMonths && !useRange ? "text-primary" : ""}>Mês</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-11 sm:h-9"
            onClick={() => { setAllMonths(true); setUseRange(false); }}
          >
            <span className={allMonths ? "text-primary" : ""}>Todos</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-11 sm:h-9"
            onClick={() => { setAllMonths(false); setUseRange(true); }}
          >
            <span className={useRange ? "text-primary" : ""}>Período</span>
          </Button>
          {!allMonths && !useRange && <MonthYearPicker value={month} onChange={setMonth} />}
          {useRange && (
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="h-11 flex-1 sm:h-10 sm:w-[150px] sm:flex-none" />
              <span className="text-xs text-muted-foreground">até</span>
              <Input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="h-11 flex-1 sm:h-10 sm:w-[150px] sm:flex-none" />
            </div>
          )}
          {kind === "pt" ? (
            <Button className="h-11 w-full sm:h-10 sm:w-auto" onClick={() => { setEditingPt(null); setPtOpen(true); }}>
              <Plus className="h-4 w-4" /> Novo pagamento PT
            </Button>
          ) : (
            <Button className="h-11 w-full sm:h-10 sm:w-auto" onClick={() => { setEditingStudio(null); setStudioOpen(true); }}>
              <Plus className="h-4 w-4" /> Novo pagamento
            </Button>
          )}
        </div>
      </div>

      <Card className="p-3 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          <div className="relative flex-1 sm:min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por aluno"
              className="h-11 pl-9 sm:h-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="h-11 w-full sm:h-10 sm:w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos métodos</SelectItem>
              {(availableMethods.length > 0
                ? availableMethods.map((m) => ({ key: m.key, label: m.label }))
                : ["pix","credit_card","debit_card","bank_slip","cash","transfer"].map((k) => ({ key: k, label: pmLabel(k) }))
              ).map((m) => (
                <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-11 w-full sm:h-10 sm:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="overdue">Atrasado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-11 w-full sm:h-10 sm:w-[220px]">
              <span className="mr-1 text-xs text-muted-foreground">Organizar por:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="payment_date_desc">Pagamento (mais recente)</SelectItem>
              <SelectItem value="payment_date_asc">Pagamento (mais antigo)</SelectItem>
              <SelectItem value="due_date_asc">Vencimento (mais próximo)</SelectItem>
              <SelectItem value="due_date_desc">Vencimento (mais distante)</SelectItem>
              <SelectItem value="reference_desc">Mês ref. (mais recente)</SelectItem>
              <SelectItem value="reference_asc">Mês ref. (mais antigo)</SelectItem>
              <SelectItem value="amount_desc">Valor (maior)</SelectItem>
              <SelectItem value="amount_asc">Valor (menor)</SelectItem>
              <SelectItem value="student_asc">Aluno (A-Z)</SelectItem>
              <SelectItem value="student_desc">Aluno (Z-A)</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="plan">Plano</SelectItem>
              <SelectItem value="method">Método</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : rows.length === 0 ? (
          <EmptyState title="Sem pagamentos" description="Nenhum pagamento neste filtro" />
        ) : (
          <>
            {/* Mobile: cards */}
            <ul className="space-y-2 md:hidden">
              {pageRows.map((p) => {
                const checked = selected.has(p.id);
                return (
                  <li key={`${p.kind}-${p.id}`} className={`rounded-lg border bg-card p-3 transition-colors ${checked ? "ring-1 ring-primary" : ""}`}>
                    <div className="flex items-start gap-3">
                      {bulkEnabled && p.kind === "studio" && (
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setSelected((prev) => {
                              const n = new Set(prev);
                              if (v) n.add(p.id); else n.delete(p.id);
                              return n;
                            });
                          }}
                          className="mt-1"
                          aria-label="Selecionar pagamento"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="truncate font-semibold">{p.student_name}</span>
                          <KindBadge kind={p.kind} />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                          <PaymentStatusBadge status={p.status} />
                          <PlanBadge name={p.plan_name} />
                          <span className="rounded bg-muted px-1.5 py-0.5 uppercase text-muted-foreground">
                            {formatMonthLabel(p.reference_month)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-base font-semibold">{formatBRL(p.amount)}</div>
                        <div className="text-[11px] text-muted-foreground">{pmLabel(p.payment_method)}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2 text-[11px] text-muted-foreground">
                      <span>Pago em {formatDateBR(p.payment_date)} · Venc: {effectiveDueDate(p)}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => editRow(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => remove(p)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>


            {/* Desktop: table */}
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    {bulkEnabled && (
                      <TableHead className="w-8">
                        <Checkbox
                          checked={pageRows.length > 0 && pageRows.every((p) => selected.has(p.id))}
                          onCheckedChange={(v) => {
                            setSelected((prev) => {
                              const n = new Set(prev);
                              if (v) pageRows.forEach((p) => n.add(p.id));
                              else pageRows.forEach((p) => n.delete(p.id));
                              return n;
                            });
                          }}
                          aria-label="Selecionar todos"
                        />
                      </TableHead>
                    )}
                    <TableHead>Aluno</TableHead>
                    {kind === "all" && <TableHead>Tipo</TableHead>}
                    <TableHead>Plano</TableHead>
                    <TableHead>Mês ref.</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((p) => {
                    const checked = selected.has(p.id);
                    return (
                      <TableRow key={`${p.kind}-${p.id}`} data-state={checked ? "selected" : undefined}>
                        {bulkEnabled && (
                          <TableCell>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                setSelected((prev) => {
                                  const n = new Set(prev);
                                  if (v) n.add(p.id); else n.delete(p.id);
                                  return n;
                                });
                              }}
                              aria-label="Selecionar linha"
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-medium">{p.student_name}</TableCell>
                        {kind === "all" && <TableCell><KindBadge kind={p.kind} /></TableCell>}
                        <TableCell><PlanBadge name={p.plan_name} /></TableCell>
                        <TableCell className="text-xs uppercase font-mono">{formatMonthLabel(p.reference_month)}</TableCell>
                        <TableCell className="text-xs font-mono">{formatDateBR(p.payment_date)}</TableCell>
                        <TableCell className="text-xs font-mono">{effectiveDueDate(p)}</TableCell>
                        <TableCell className="text-xs">{pmLabel(p.payment_method)}</TableCell>
                        <TableCell className="text-right font-mono font-medium">{formatBRL(p.amount)}</TableCell>
                        <TableCell><PaymentStatusBadge status={p.status} /></TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => editRow(p)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => remove(p)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
        {rows.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="text-muted-foreground">Página {page + 1} de {totalPages}</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-11 sm:h-9" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" className="h-11 sm:h-9" disabled={(page + 1) * PER_PAGE >= rows.length} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
            </div>
          </div>
        )}
        <div className="hidden">{addMonths(month, 0)}</div>
      </Card>

      <PaymentDialog open={studioOpen} onOpenChange={setStudioOpen} payment={editingStudio} />
      <PTPaymentDialog open={ptOpen} onOpenChange={setPtOpen} payment={editingPt} />
      {bulkEnabled && (
        <BulkPaymentEditBar selectedIds={[...selected]} onClear={() => setSelected(new Set())} />
      )}
    </div>
  );
}

function effectiveDueDate(p: Row): string {
  if (p.due_date) return formatDateBR(p.due_date);
  // Fallback: last day of reference_month (yyyy-MM) for imported payments without due_date.
  const rm = p.reference_month;
  if (rm && /^\d{4}-\d{2}$/.test(rm)) {
    const [y, m] = rm.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    return formatDateBR(`${rm}-${String(last).padStart(2, "0")}`);
  }
  // Second fallback: payment_date + 30 days
  if (p.payment_date) {
    const d = new Date(p.payment_date + "T00:00:00");
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + 30);
      return formatDateBR(d.toISOString().slice(0, 10));
    }
  }
  return "—";
}

function KindBadge({ kind }: { kind: "studio" | "pt" }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
        kind === "pt"
          ? "bg-purple-500/15 text-purple-600 dark:text-purple-300"
          : "bg-blue-500/15 text-blue-600 dark:text-blue-300"
      }`}
    >
      {kind === "pt" ? "PT" : "Studio"}
    </span>
  );
}
