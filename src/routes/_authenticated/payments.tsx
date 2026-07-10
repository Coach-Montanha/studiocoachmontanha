import { createFileRoute } from "@tanstack/react-router";
import { confirmDialog } from "@/lib/confirm-dialog";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Search, Loader2, Copy } from "lucide-react";
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

type P = {
  id: string; amount: number; payment_date: string; due_date: string | null;
  reference_month: string; payment_method: string; status: string;
  student_id: string; plan_id: string | null;
  students: { name: string } | null;
  plans: { name: string } | null;
};

function PaymentsPage() {
  const qc = useQueryClient();
  const { scopeId, scopeKey, ready } = useScopeFilter();
  const [month, setMonth] = useState<string>(currentMonthKey());
  const [allMonths, setAllMonths] = useState(false);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("all");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<P | null>(null);
  const [useRange, setUseRange] = useState(false);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [deduping, setDeduping] = useState(false);
  const [dupeCount, setDupeCount] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { methods: availableMethods, labelFor: pmLabel } = usePaymentMethods({ activeOnly: true });

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments-list", scopeKey],
    enabled: ready,
    queryFn: async () => {
      let allRows: P[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        let q = supabase
          .from("payments")
          .select("id,amount,payment_date,due_date,reference_month,payment_method,status,student_id,plan_id,students(name),plans(name)")
          .is("deleted_at", null)
          .order("payment_date", { ascending: false })
          .range(from, from + PAGE - 1);
        if (scopeId) q = q.eq("user_id", scopeId);
        const { data, error } = await q;
        if (error) throw error;
        allRows = allRows.concat((data ?? []) as unknown as P[]);
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }
      return allRows;
    },
  });


  const [page, setPage] = useState(0);
  const PER_PAGE = 50;

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return payments.filter((p) => {
      if (useRange) {
        if (rangeStart && p.payment_date < rangeStart) return false;
        if (rangeEnd && p.payment_date > rangeEnd) return false;
      } else {
        if (!allMonths && p.reference_month !== month) return false;
      }
      if (method !== "all" && p.payment_method !== method) return false;
      if (status !== "all" && p.status !== status) return false;
      if (q && !(p.students?.name ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [payments, month, allMonths, useRange, rangeStart, rangeEnd, method, status, search]);

  const totals = useMemo(() => {
    const paid = rows.filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.amount), 0);
    return { count: rows.length, paid };
  }, [rows]);

  const pageRows = rows.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));

  useEffect(() => { setPage(0); }, [search, method, status, month, allMonths, useRange, rangeStart, rangeEnd]);

  async function remove(id: string) {
    if (!(await confirmDialog("Excluir este pagamento?"))) return;
    const { error, count } = await supabase.from("payments").delete({ count: "exact" }).eq("id", id);
    if (error) return toast.error(error.message);
    if (!count) return toast.error("Exclusão bloqueada. Se você é super admin, volte o escopo para 'Meus dados' para excluir seus próprios registros.");
    toast.success("Pagamento excluído");
    qc.invalidateQueries();
  }

  async function deduplicatePayments() {
    setDeduping(true);
    setDupeCount(null);
    const seen = new Map<string, string>();
    const toDelete: string[] = [];
    for (const p of payments) {
      const key = `${p.student_id}|${p.reference_month}|${p.amount}|${p.payment_date}`;
      if (seen.has(key)) toDelete.push(p.id);
      else seen.set(key, p.id);
    }
    if (toDelete.length === 0) {
      toast.success("Nenhuma duplicata encontrada.");
      setDeduping(false);
      setDupeCount(0);
      return;
    }
    let deleted = 0;
    for (let i = 0; i < toDelete.length; i += 50) {
      const batch = toDelete.slice(i, i + 50);
      const { error } = await supabase.from("payments").delete().in("id", batch);
      if (!error) deleted += batch.length;
    }
    setDupeCount(deleted);
    toast.success(`${deleted} pagamento(s) duplicado(s) removido(s).`);
    qc.invalidateQueries();
    setDeduping(false);
  }

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
          {dupeCount !== null && (
            <p className="mt-1 text-sm font-medium">
              {dupeCount === 0
                ? "✅ Nenhuma duplicata encontrada."
                : `🗑️ ${dupeCount} duplicata(s) removida(s) com sucesso.`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <Button variant="outline" className="h-11 sm:h-10" onClick={deduplicatePayments} disabled={deduping}>
            {deduping
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Verificando…</>
              : <><Copy className="h-4 w-4" /> Duplicatas</>}
          </Button>
          <Button className="h-11 w-full sm:h-10 sm:w-auto" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Novo pagamento
          </Button>
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
                  <li key={p.id} className={`rounded-lg border bg-card p-3 transition-colors ${checked ? "ring-1 ring-primary" : ""}`}>
                    <div className="flex items-start gap-3">
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
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{p.students?.name ?? "—"}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                          <PaymentStatusBadge status={p.status} />
                          <PlanBadge name={p.plans?.name} />
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
                      <span>Pago em {formatDateBR(p.payment_date)}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => { setEditing(p); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => remove(p.id)}>
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
                    <TableHead>Aluno</TableHead>
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
                      <TableRow key={p.id} data-state={checked ? "selected" : undefined}>
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
                        <TableCell className="font-medium">{p.students?.name ?? "—"}</TableCell>
                        <TableCell><PlanBadge name={p.plans?.name} /></TableCell>
                        <TableCell className="text-xs uppercase font-mono">{formatMonthLabel(p.reference_month)}</TableCell>
                        <TableCell className="text-xs font-mono">{formatDateBR(p.payment_date)}</TableCell>
                        <TableCell className="text-xs font-mono">{p.due_date ? formatDateBR(p.due_date) : "—"}</TableCell>
                        <TableCell className="text-xs">{pmLabel(p.payment_method)}</TableCell>
                        <TableCell className="text-right font-mono font-medium">{formatBRL(p.amount)}</TableCell>
                        <TableCell><PaymentStatusBadge status={p.status} /></TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
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

      <PaymentDialog open={open} onOpenChange={setOpen} payment={editing} />
      <BulkPaymentEditBar selectedIds={[...selected]} onClear={() => setSelected(new Set())} />
    </div>
  );
}
