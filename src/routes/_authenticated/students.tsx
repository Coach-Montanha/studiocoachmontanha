import { createFileRoute, Link } from "@tanstack/react-router";
import { confirmDialog } from "@/lib/confirm-dialog";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { BulkStudentEditDialog } from "@/components/edufinance/BulkStudentEditDialog";
import { MigrateStudentsDialog } from "@/components/MigrateStudentsDialog";
import { StudentStatusBadge, PlanBadge } from "@/components/edufinance/Badges";
import { EmptyState } from "@/components/edufinance/EmptyState";
import { formatBRL, formatDateBR, initials } from "@/lib/format";


export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({ meta: [{ title: "Alunos — EduFinance" }] }),
  component: StudentsPage,
});

type Row = {
  id: string; name: string; email: string | null; phone: string | null;
  notes: string | null; status: string;
  created_at: string; birth_date: string | null;
  account_user_id: string | null;
  payments: { amount: number; payment_date: string }[];
  student_plan_history: { is_current: boolean; plans: { name: string } | null }[];
};

function StudentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPlanId, setBulkPlanId] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [migrateOpen, setMigrateOpen] = useState(false);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id,name,email,phone,notes,status,created_at,birth_date,account_user_id,attendance_offset,payments(amount,payment_date),student_plan_history(is_current,plans(name))")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
    staleTime: 0,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["plans-active"],
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("id,name,price").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  const { data: birthdayStudents = [] } = useQuery({
    queryKey: ["birthday-students-page"],
    queryFn: async () => {
      const currentMonth = new Date().getMonth() + 1;
      const { data } = await supabase
        .from("students")
        .select("id,name,email,phone,birth_date,status")
        .not("birth_date", "is", null)
        .order("birth_date");
      return (data ?? []).filter((s) => {
        if (!s.birth_date) return false;
        const month = new Date(s.birth_date + "T12:00").getMonth() + 1;
        return month === currentMonth;
      });
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
    if (!(await confirmDialog("Excluir este aluno e todos os seus pagamentos?"))) return;
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
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Alunos</h1>
          <p className="text-sm text-muted-foreground">{rows.length} aluno(s)</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button className="h-11 w-full sm:h-10 sm:w-auto" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Novo aluno
          </Button>
        </div>
      </div>

      {birthdayStudents.length > 0 && (
        <Card className="relative overflow-hidden border-accent/30 bg-gradient-to-br from-accent/10 via-card to-primary/10 p-4 sm:p-5">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/20 blur-2xl" aria-hidden />
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-accent/20 text-base">🎂</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight text-foreground">
                {birthdayStudents.length} aniversariante(s) este mês
              </div>
              <div className="text-[11px] text-muted-foreground">Envie uma mensagem rápida</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {birthdayStudents.map((s) => {
              const day = new Date(s.birth_date + "T12:00").getDate();
              const isToday = day === new Date().getDate();
              const msg = encodeURIComponent(
                `Feliz aniversário, ${s.name}! 🎂 Desejamos um dia incrível!`
              );
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-2.5 py-1.5 text-xs shadow-sm backdrop-blur transition-colors duration-200 hover:border-accent/50 hover:bg-card"
                >
                  <span aria-hidden>{isToday ? "🎉" : "🎂"}</span>
                  <span className="font-medium text-foreground">{s.name}</span>
                  <span className="text-muted-foreground">dia {day}</span>
                  {s.phone && (
                    <a
                      href={`https://wa.me/55${s.phone.replace(/\D/g, "")}?text=${msg}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`WhatsApp ${s.name}`}
                      className="ml-1 grid h-7 w-7 place-items-center rounded-full bg-success/15 text-success outline-none transition-all duration-200 hover:bg-success/25 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background active:scale-95"
                    >
                      💬
                    </a>
                  )}
                  {s.email && (
                    <a
                      href={`mailto:${s.email}?subject=Feliz%20Anivers%C3%A1rio!&body=${msg}`}
                      aria-label={`Email ${s.name}`}
                      className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-primary outline-none transition-all duration-200 hover:bg-primary/25 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background active:scale-95"
                    >
                      📧
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="p-3 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          <div className="relative flex-1 sm:min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email"
              className="h-11 pl-9 sm:h-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-11 w-full sm:h-10 sm:w-[160px]"><SelectValue /></SelectTrigger>
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
            <Button size="sm" variant="secondary" onClick={() => setBulkEditOpen(true)}>Editar informações em massa</Button>
            <Button size="sm" variant="outline" onClick={() => setMigrateOpen(true)}>Migrar para PT</Button>
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
          <>
            {/* Mobile: cards */}
            <ul className="space-y-2 md:hidden">
              {rows.map((s) => (
                <li key={s.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-2 h-4 w-4 shrink-0"
                      checked={selected.has(s.id)}
                      onChange={(e) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(s.id); else next.delete(s.id);
                          return next;
                        });
                      }}
                    />
                    <Link to="/students/$id" params={{ id: s.id }} className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {initials(s.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-primary">{s.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{s.email ?? "—"}</div>
                      </div>
                    </Link>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <StudentStatusBadge status={s.status} />
                    <PlanBadge name={s.plan} />
                    <span className="ml-auto font-mono font-medium">{formatBRL(s.total)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      Último: {s.last ? formatDateBR(s.last) : "—"}
                    </span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => { setEditing(s as never); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => remove(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <input
                        type="checkbox"
                        checked={rows.length > 0 && selected.size === rows.length}
                        onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                      />
                    </TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">LTV</TableHead>
                    <TableHead>Último</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selected.has(s.id)}
                          onChange={(e) => {
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(s.id); else next.delete(s.id);
                              return next;
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Link to="/students/$id" params={{ id: s.id }} className="group flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {initials(s.name)}
                          </div>
                          <div>
                            <div className="font-semibold text-primary group-hover:underline">{s.name}</div>
                            <div className="text-xs text-muted-foreground">{s.email ?? "—"}</div>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell><PlanBadge name={s.plan} /></TableCell>
                      <TableCell><StudentStatusBadge status={s.status} /></TableCell>
                      <TableCell className="text-right font-mono">{formatBRL(s.total)}</TableCell>
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
            </div>
          </>
        )}
      </Card>

      <StudentDialog open={open} onOpenChange={setOpen} student={editing} />

      <BulkStudentEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        selectedIds={[...selected]}
        onDone={() => setSelected(new Set())}
      />

      <MigrateStudentsDialog
        open={migrateOpen}
        onOpenChange={setMigrateOpen}
        ids={[...selected]}
        direction="studio_to_pt"
        onDone={() => setSelected(new Set())}
      />

      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar plano em massa</AlertDialogTitle>
            <AlertDialogDescription>
              Isso encerrará o plano atual de {selected.size} aluno(s) selecionado(s) e iniciará o novo plano a partir de hoje.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Select value={bulkPlanId} onValueChange={setBulkPlanId}>
              <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} — {formatBRL(Number(p.price))}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkPlanChange} disabled={!bulkPlanId}>
              Aplicar a {selected.size} aluno(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
