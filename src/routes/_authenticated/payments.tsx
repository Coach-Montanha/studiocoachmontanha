import { createFileRoute } from "@tanstack/react-router";
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
import { addMonths, currentMonthKey, formatBRL, formatDateBR, formatMonthLabel, paymentMethodLabel } from "@/lib/format";

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

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments-list"],
    queryFn: async () => {
      let allRows: P[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("payments")
          .select("id,amount,payment_date,due_date,reference_month,payment_method,status,student_id,plan_id,students(name),plans(name)")
          .order("payment_date", { ascending: false })
          .range(from, from + PAGE - 1);
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
    if (!confirm("Excluir este pagamento?")) return;
    const { error } = await supabase.from("payments").delete().eq("id", id);
    if (error) return toast.error(error.message);
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pagamentos</h1>
          <p className="text-sm text-muted-foreground">
            {totals.count} registro(s) encontrado(s)
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
            onClick={() => { setAllMonths(false); setUseRange(false); }}
            className={!allMonths && !useRange ? "border-primary text-primary" : ""}
          >
            Mês
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setAllMonths(true); setUseRange(false); }}
            className={allMonths ? "border-primary text-primary" : ""}
          >
            Todos os meses
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setAllMonths(false); setUseRange(true); }}
            className={useRange ? "border-primary text-primary" : ""}
          >
            Período
          </Button>
          {!allMonths && !useRange && <MonthYearPicker value={month} onChange={setMonth} />}
          {useRange && (
            <div className="flex items-center gap-2">
              <Input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="w-[150px]" />
              <span className="text-xs text-muted-foreground">até</span>
              <Input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="w-[150px]" />
            </div>
          )}
          <Button variant="outline" onClick={deduplicatePayments} disabled={deduping}>
            {deduping
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Verificando…</>
              : <><Copy className="h-4 w-4" /> Remover duplicatas</>}
          </Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Novo pagamento
          </Button>
        </div>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por aluno"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos métodos</SelectItem>
              {["pix","credit_card","debit_card","bank_slip","cash","transfer"].map((m) => (
                <SelectItem key={m} value={m}>{paymentMethodLabel(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
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
          <Table>
            <TableHeader>
              <TableRow>
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
              {pageRows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.students?.name ?? "—"}</TableCell>
                  <TableCell><PlanBadge name={p.plans?.name} /></TableCell>
                  <TableCell className="text-xs uppercase font-mono">{formatMonthLabel(p.reference_month)}</TableCell>
                  <TableCell className="text-xs font-mono">{formatDateBR(p.payment_date)}</TableCell>
                  <TableCell className="text-xs font-mono">{p.due_date ? formatDateBR(p.due_date) : "—"}</TableCell>
                  <TableCell className="text-xs">{paymentMethodLabel(p.payment_method)}</TableCell>
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
              ))}
            </TableBody>
          </Table>
        )}
        {rows.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="text-muted-foreground">Página {page + 1} de {totalPages}</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={(page + 1) * PER_PAGE >= rows.length} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
            </div>
          </div>
        )}
        {/* Suppress unused setter warning */}
        <div className="hidden">{addMonths(month, 0)}</div>
      </Card>

      <PaymentDialog open={open} onOpenChange={setOpen} payment={editing} />
    </div>
  );
}
