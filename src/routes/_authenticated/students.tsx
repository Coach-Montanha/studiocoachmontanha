import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2, Pencil, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StudentDialog } from "@/components/edufinance/StudentDialog";
import { StudentStatusBadge, PlanBadge } from "@/components/edufinance/Badges";
import { EmptyState } from "@/components/edufinance/EmptyState";
import { formatBRL, formatDateBR, initials } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({ meta: [{ title: "Alunos — EduFinance" }] }),
  component: StudentsPage,
});

type Row = {
  id: string; name: string; email: string | null; status: string;
  created_at: string;
  payments: { amount: number; payment_date: string }[];
  student_plan_history: { is_current: boolean; plans: { name: string } | null }[];
};

function StudentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPlanId, setBulkPlanId] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id,name,email,status,created_at,payments(amount,payment_date),student_plan_history(is_current,plans(name))")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["plans-active"],
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("id,name,price").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    const q = norm(search);
    return students
      .filter((s) => (status === "all" ? true : s.status === status))
      .filter((s) => !q || norm(s.name).includes(q) || norm(s.email ?? "").includes(q))
      .map((s) => {
        const paid = s.payments.filter((p) => p.amount);
        const total = paid.reduce((a, p) => a + Number(p.amount), 0);
        const dates = paid.map((p) => p.payment_date).sort();
        const current = s.student_plan_history.find((h) => h.is_current);
        return {
          ...s,
          total,
          count: paid.length,
          first: dates[0],
          last: dates[dates.length - 1],
          avg: paid.length ? total / paid.length : 0,
          plan: current?.plans?.name ?? null,
        };
      });
  }, [students, search, status]);

  async function remove(id: string) {
    if (!confirm("Excluir este aluno e todos os seus pagamentos?")) return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Aluno excluído");
    qc.invalidateQueries();
  }

  async function handleBulkPlanChange() {
    if (!bulkPlanId) return;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const today = new Date().toISOString().slice(0, 10);
    const ids = [...selected];
    let okCount = 0;
    const errs: string[] = [];
    for (const studentId of ids) {
      await supabase
        .from("student_plan_history")
        .update({ end_date: today, is_current: false })
        .eq("student_id", studentId)
        .eq("is_current", true);
      const { error } = await supabase.from("student_plan_history").insert({
        user_id: userId,
        student_id: studentId,
        plan_id: bulkPlanId,
        start_date: today,
        is_current: true,
      });
      if (error) errs.push(error.message); else okCount++;
    }
    setBulkOpen(false);
    setSelected(new Set());
    setBulkPlanId("");
    qc.invalidateQueries();
    if (okCount) toast.success(`Plano atualizado para ${okCount} aluno(s)`);
    if (errs.length) toast.error(`${errs.length} erro(s) ao atualizar plano`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alunos</h1>
          <p className="text-sm text-muted-foreground">{rows.length} aluno(s)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              const { error } = await supabase.rpc("recalculate_all_student_statuses");
              if (error) return toast.error(error.message);
              toast.success("Status dos alunos atualizado com base nos pagamentos");
              qc.invalidateQueries({ queryKey: ["students-list"] });
            }}
          >
            <RefreshCw className="h-4 w-4" /> Recalcular status
          </Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Novo aluno
          </Button>
        </div>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
              <SelectItem value="churned">Desligado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selected.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2 text-sm">
            <span className="font-medium">{selected.size} aluno(s) selecionado(s)</span>
            <Button size="sm" onClick={() => setBulkOpen(true)}>Alterar plano em massa</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar seleção</Button>
          </div>
        )}

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nenhum aluno encontrado"
            description="Adicione seu primeiro aluno para começar"
            action={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Novo aluno</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">LTV</TableHead>
                <TableHead className="text-right">Ticket médio</TableHead>
                <TableHead>1º pagamento</TableHead>
                <TableHead>Último</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link to="/students/$id" params={{ id: s.id }} className="flex items-center gap-3 hover:underline">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {initials(s.name)}
                      </div>
                      <div>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.email ?? "—"}</div>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell><PlanBadge name={s.plan} /></TableCell>
                  <TableCell><StudentStatusBadge status={s.status} /></TableCell>
                  <TableCell className="text-right font-mono">{formatBRL(s.total)}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{formatBRL(s.avg)}</TableCell>
                  <TableCell className="font-mono text-xs">{s.first ? formatDateBR(s.first) : "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{s.last ? formatDateBR(s.last) : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(s as never); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <StudentDialog open={open} onOpenChange={setOpen} student={editing} />
    </div>
  );
}
