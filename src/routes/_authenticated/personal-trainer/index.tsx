import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users, DollarSign, Activity, TrendingUp, Percent, Plus, Eye,
  CalendarPlus, CreditCard, Pencil, Trash2,
} from "lucide-react";
import { addDays, format, startOfMonth, endOfMonth, startOfWeek, addWeeks, isSameDay, isSameMonth, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KPICard } from "@/components/edufinance/KPICard";
import { EmptyState } from "@/components/edufinance/EmptyState";
import { PTBadge, PTSessionStatusBadge, PTStudentStatusBadge } from "@/components/pt/PTBadges";
import { PTStudentDialog } from "@/components/pt/PTStudentDialog";
import { PTSessionDialog } from "@/components/pt/PTSessionDialog";
import { PTPaymentDialog } from "@/components/pt/PTPaymentDialog";
import { formatBRL, formatDateBR } from "@/lib/format";

import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/personal-trainer/")({
  head: () => ({ meta: [{ title: "Personal Trainer — EduFinance" }] }),
  component: PTOverview,
});

function PTOverview() {
  const [studentOpen, setStudentOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [presetStudentId, setPresetStudentId] = useState<string | undefined>();
  const [presetDate, setPresetDate] = useState<string | undefined>();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string>("");

  const [dayDetailOpen, setDayDetailOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [editingSession, setEditingSession] = useState<any>(null);
  const [sessionOpenEdit, setSessionOpenEdit] = useState(false);

  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));

  const [revenueMode, setRevenueMode] = useState<"month" | "all" | "range">("month");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [revenueOpen, setRevenueOpen] = useState(false);

  const calendarMonthKey = format(calendarMonth, "yyyy-MM");
  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);

  const { data: students = [] } = useQuery({
    queryKey: ["pt-students-overview"],
    queryFn: async () =>
      (await supabase
        .from("pt_students")
        .select("id,name,status,pt_payments(id,amount,payment_date,status,pt_plan_id,sessions_paid,reference_month,pt_plans(name,sessions_per_month))")
        .order("name")
      ).data ?? [],
    staleTime: 0,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: monthSessions = [] } = useQuery({
    queryKey: ["pt-month-sessions", calendarMonthKey],
    queryFn: async () =>
      (await supabase
        .from("pt_sessions")
        .select("id,pt_student_id,session_date,session_time,duration_minutes,status,exercises,performance_notes,next_session_plan,pt_students(name)")
        .gte("session_date", format(monthStart, "yyyy-MM-dd"))
        .lte("session_date", format(monthEnd, "yyyy-MM-dd"))
        .order("session_date")
      ).data ?? [],
  });

  const { data: monthPayments = [] } = useQuery({
    queryKey: ["pt-month-payments", calendarMonthKey],
    queryFn: async () =>
      (await supabase
        .from("pt_payments")
        .select("id,amount,status,payment_date,reference_month,pt_student_id,pt_students!pt_payments_pt_student_id_fkey(name),pt_plans(name)")
        .eq("status", "paid")
        .gte("payment_date", format(monthStart, "yyyy-MM-dd"))
        .lte("payment_date", format(monthEnd, "yyyy-MM-dd"))
      ).data ?? [],
  });

  const { data: allPtPayments = [] } = useQuery({
    queryKey: ["pt-all-payments-revenue"],
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("pt_payments")
          .select("id,amount,payment_date,reference_month,status,pt_student_id,pt_students!pt_payments_pt_student_id_fkey(name),pt_plans(name)")
          .eq("status", "paid")
          .order("payment_date", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) break;
        all = all.concat(data ?? []);
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
  });

  const filteredRevenue = useMemo(() => {
    if (revenueMode === "month") return monthPayments;
    if (revenueMode === "all") return allPtPayments;
    return allPtPayments.filter((p) => {
      if (rangeStart && p.payment_date < rangeStart) return false;
      if (rangeEnd && p.payment_date > rangeEnd) return false;
      return true;
    });
  }, [revenueMode, monthPayments, allPtPayments, rangeStart, rangeEnd]);

  const filteredRevenueTotal = useMemo(
    () => filteredRevenue.reduce((s, p) => s + Number(p.amount), 0),
    [filteredRevenue]
  );

  const kpis = useMemo(() => {
    const active = students.filter((s) => s.status === "active").length;
    const revenue = monthPayments.reduce((s, p) => s + Number(p.amount), 0);
    const completed = monthSessions.filter((s) => s.status === "completed").length;
    const attended = completed;
    const scheduled = monthSessions.length;
    const attendanceRate = scheduled ? (attended / scheduled) * 100 : 0;
    const paidCount = monthPayments.length;
    const avg = paidCount ? revenue / paidCount : 0;
    return { active, revenue, completed, attendanceRate, avg };
  }, [students, monthSessions, monthPayments]);

  async function handleBulkUpdate() {
    const ids = [...selected];
    let okCount = 0;
    for (const studentId of ids) {
      if (!bulkStatus) break;
      const { error } = await supabase
        .from("pt_students")
        .update({ status: bulkStatus })
        .eq("id", studentId);
      if (!error) okCount++;
    }
    setBulkOpen(false);
    setSelected(new Set());
    setBulkStatus("");
    qc.invalidateQueries();
    toast.success(`${okCount} aluno(s) PT atualizado(s)`);
  }

  async function deleteSession(id: string) {
    if (!confirm("Excluir esta aula?")) return;
    const { error } = await supabase.from("pt_sessions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Aula excluída");
    qc.invalidateQueries();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Personal Trainer</h1>
          <PTBadge />
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/personal-trainer/plans"><Button variant="outline">Planos PT</Button></Link>
          <Link to="/personal-trainer/analytics"><Button variant="outline">Análises PT</Button></Link>
          <Button onClick={() => { setPresetStudentId(undefined); setStudentOpen(true); }}>
            <Plus className="h-4 w-4" /> Novo aluno PT
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard label="👥 Alunos PT Ativos" value={kpis.active} icon={<Users className="h-5 w-5" />} />
        <div
          className="cursor-pointer transition-transform hover:scale-[1.01]"
          onClick={() => setRevenueOpen(true)}
          title="Clique para ver detalhes da receita"
        >
          <KPICard
            label={`💰 Receita PT — ${format(calendarMonth, "MMM/yyyy", { locale: ptBR })}`}
            value={formatBRL(kpis.revenue)}
            icon={<DollarSign className="h-5 w-5" />}
            hint="Clique para filtrar"
          />
        </div>
        <KPICard label="🏃 Aulas realizadas" value={kpis.completed} icon={<Activity className="h-5 w-5" />} hint={`em ${format(calendarMonth, "MMMM/yyyy", { locale: ptBR })}`} />
        <KPICard label="📊 Ticket Médio PT" value={formatBRL(kpis.avg)} icon={<TrendingUp className="h-5 w-5" />} />
        <KPICard label="⚡ Taxa de presença" value={`${kpis.attendanceRate.toFixed(1).replace(".", ",")}%`} icon={<Percent className="h-5 w-5" />} />
      </div>

      <Tabs defaultValue="students" className="space-y-4">
        <TabsList>
          <TabsTrigger value="students">Alunos</TabsTrigger>
          <TabsTrigger value="calendar">Aulas do Mês</TabsTrigger>
        </TabsList>

        <TabsContent value="students">
          <Card className="p-5 space-y-3">
            {selected.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3">
                <span className="text-sm font-medium">{selected.size} aluno(s) selecionado(s)</span>
                <Button size="sm" onClick={() => setBulkOpen(true)}>Editar em massa</Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar seleção</Button>
              </div>
            )}
            {students.length === 0 ? (
              <EmptyState title="Nenhum aluno PT" description="Cadastre seu primeiro aluno de personal trainer" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={students.length > 0 && selected.size === students.length}
                        onChange={(e) =>
                          setSelected(e.target.checked ? new Set(students.map((s) => s.id)) : new Set())
                        }
                      />
                    </TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aulas/mês</TableHead>
                    <TableHead className="text-right">Realizadas</TableHead>
                    <TableHead className="text-right">Restantes</TableHead>
                    <TableHead>Último pagamento</TableHead>
                    <TableHead className="text-right">Saldo pacote</TableHead>
                    <TableHead className="text-right">Ações</TableHead>

                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s) => {
                    const latestPayment = [...(s.pt_payments ?? [])]
                      .filter((p) => p.status === "paid")
                      .sort((a, b) => (a.payment_date < b.payment_date ? 1 : -1))[0];
                    const planName = latestPayment?.pt_plans?.name;
                    const contracted = latestPayment?.pt_plans?.sessions_per_month ?? latestPayment?.sessions_paid ?? 0;
                    const done = monthSessions.filter(
                      (ms) =>
                        ms.pt_student_id === s.id &&
                        ms.status === "completed" &&
                        ms.session_date >= format(monthStart, "yyyy-MM-dd") &&
                        ms.session_date <= format(monthEnd, "yyyy-MM-dd")
                    ).length;
                    const remaining = Math.max(0, (contracted ?? 0) - done);
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selected.has(s.id)}
                            onChange={(e) => {
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(s.id);
                                else next.delete(s.id);
                                return next;
                              });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Link to="/personal-trainer/students/$id" params={{ id: s.id }} className="font-medium hover:underline">
                            {s.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs">{planName ?? "—"}</TableCell>
                        <TableCell><PTStudentStatusBadge status={s.status} /></TableCell>
                        <TableCell className="text-right font-mono">{contracted ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono">{done}</TableCell>
                        <TableCell className="text-right font-mono">{contracted ? remaining : "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{latestPayment ? formatDateBR(latestPayment.payment_date) : "—"}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {(() => {
                            const lp = [...(s.pt_payments ?? [])]
                              .filter((p: any) => p.status === "paid" && p.sessions_paid)
                              .sort((a: any, b: any) => (a.payment_date < b.payment_date ? 1 : -1))[0];
                            if (!lp) return <span className="text-muted-foreground">—</span>;
                            const usedInPayment = monthSessions.filter(
                              (ms: any) => ms.pt_student_id === s.id && ms.status === "completed",
                            ).length;
                            const remainingPkg = (lp.sessions_paid ?? 0) - usedInPayment;
                            return (
                              <span className={cn(remainingPkg <= 0 && "text-destructive font-semibold")}>
                                {usedInPayment}/{lp.sessions_paid}
                              </span>
                            );
                          })()}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Link to="/personal-trainer/students/$id" params={{ id: s.id }}>
                              <Button size="icon" variant="ghost" title="Ver detalhes"><Eye className="h-4 w-4" /></Button>
                            </Link>
                            <Button size="icon" variant="ghost" title="Registrar aula" onClick={() => { setPresetStudentId(s.id); setSessionOpen(true); }}>
                              <CalendarPlus className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Registrar pagamento" onClick={() => { setPresetStudentId(s.id); setPaymentOpen(true); }}>
                              <CreditCard className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCalendarMonth((d) => startOfMonth(subMonths(d, 1)))}
              >
                ← Mês anterior
              </Button>
              <div className="min-w-[160px] text-center text-sm font-semibold capitalize">
                {format(calendarMonth, "MMMM yyyy", { locale: ptBR })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCalendarMonth((d) => startOfMonth(addMonths(d, 1)))}
              >
                Próximo mês →
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCalendarMonth(startOfMonth(new Date()))}
            >
              Voltar ao mês atual
            </Button>
          </div>
          <MonthCalendar
            sessions={monthSessions}
            monthStart={monthStart}
            currentMonth={calendarMonth}
            onDayClick={(d) => { setSelectedDay(d); setDayDetailOpen(true); }}
          />
        </TabsContent>
      </Tabs>

      <PTStudentDialog open={studentOpen} onOpenChange={setStudentOpen} />
      <PTSessionDialog open={sessionOpen} onOpenChange={setSessionOpen} defaultStudentId={presetStudentId} defaultDate={presetDate} />
      <PTSessionDialog open={sessionOpenEdit} onOpenChange={setSessionOpenEdit} session={editingSession} />
      <PTPaymentDialog open={paymentOpen} onOpenChange={setPaymentOpen} defaultStudentId={presetStudentId} />

      <DaySessionsDialog
        open={dayDetailOpen}
        onOpenChange={setDayDetailOpen}
        date={selectedDay}
        sessions={monthSessions}
        onEdit={(s) => {
          setEditingSession(s);
          setSessionOpenEdit(true);
          setDayDetailOpen(false);
        }}
        onAdd={() => {
          setPresetDate(selectedDay);
          setPresetStudentId(undefined);
          setDayDetailOpen(false);
          setSessionOpen(true);
        }}
        onDelete={deleteSession}
      />

      <RevenueDialog
        open={revenueOpen}
        onOpenChange={setRevenueOpen}
        mode={revenueMode}
        setMode={setRevenueMode}
        rangeStart={rangeStart}
        setRangeStart={setRangeStart}
        rangeEnd={rangeEnd}
        setRangeEnd={setRangeEnd}
        payments={filteredRevenue}
      />

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {selected.size} aluno(s) PT em massa</DialogTitle>
            <p className="text-sm text-muted-foreground">Deixe em branco os campos que não deseja alterar.</p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Alterar status para</label>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger><SelectValue placeholder="Não alterar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="churned">Desligado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkStatus(""); setBulkOpen(false); }}>
              Cancelar
            </Button>
            <Button onClick={handleBulkUpdate} disabled={!bulkStatus}>
              Aplicar a {selected.size} aluno(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MonthCalendar({
  sessions, monthStart, currentMonth, onDayClick,
}: {
  sessions: any[];
  monthStart: Date;
  currentMonth: Date;
  onDayClick: (date: string) => void;
}) {
  const weeks = useMemo(() => {
    const start = startOfWeek(monthStart, { weekStartsOn: 0 });
    const arr: Date[][] = [];
    for (let w = 0; w < 6; w++) {
      const wk: Date[] = [];
      for (let d = 0; d < 7; d++) wk.push(addDays(addWeeks(start, w), d));
      arr.push(wk);
    }
    return arr;
  }, [monthStart]);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const s of sessions) {
      const k = s.session_date;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return map;
  }, [sessions]);

  const pillClass = (status: string) =>
    cn(
      "block w-full truncate rounded px-1 py-0.5 text-[10px] leading-tight font-medium cursor-pointer",
      status === "completed" && "bg-success/15 text-success",
      status === "no_show" && "bg-warning/20 text-warning-foreground",
      (status === "cancelled_student" || status === "cancelled_trainer") && "bg-destructive/15 text-destructive",
    );

  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold capitalize">{format(currentMonth, "MMMM yyyy", { locale: ptBR })}</h2>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
        {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const items = sessionsByDate.get(key) ?? [];
          const outside = !isSameMonth(day, currentMonth);
          return (
            <div
              key={key}
              onClick={() => onDayClick(key)}
              className={cn(
                "min-h-[88px] cursor-pointer rounded-lg border p-1 text-left transition-colors hover:bg-accent/50",
                outside && "opacity-40",
                isSameDay(day, new Date()) && "ring-2 ring-primary",
              )}
            >
              <div className="text-[11px] font-medium text-muted-foreground">{format(day, "d")}</div>
              <div className="mt-1 space-y-0.5">
                {items.slice(0, 3).map((s) => (
                  <div key={s.id} className={pillClass(s.status)} title={s.pt_students?.name}>
                    {s.session_time ? s.session_time.slice(0,5) + " · " : ""}{s.pt_students?.name}
                  </div>
                ))}
                {items.length > 3 && <div className="text-[10px] text-muted-foreground">+{items.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <Legend className="bg-success" label="Realizada" />
        <Legend className="bg-warning" label="Falta" />
        <Legend className="bg-destructive" label="Cancelada" />
      </div>
    </Card>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={cn("h-3 w-3 rounded-sm", className)} />{label}</span>;
}

function DaySessionsDialog({
  open, onOpenChange, date, sessions, onEdit, onAdd, onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: string;
  sessions: any[];
  onEdit: (s: any) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  const daySessions = sessions.filter((s) => s.session_date === date);
  const label = date
    ? new Date(date + "T12:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="capitalize">{label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {daySessions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhuma aula registrada neste dia.
            </div>
          ) : (
            daySessions.map((s) => (
              <div key={s.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="font-medium">{s.pt_students?.name ?? "—"}</div>
                    <PTSessionStatusBadge status={s.status} />
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => onEdit(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => onDelete(s.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {s.session_time && <span>🕐 {s.session_time.slice(0, 5)}</span>}
                  <span>⏱ {s.duration_minutes}min</span>
                </div>
                {s.exercises && (
                  <div className="text-xs">
                    <span className="font-medium">Exercícios:</span> {s.exercises}
                  </div>
                )}
                {s.performance_notes && (
                  <div className="text-xs">
                    <span className="font-medium">Performance:</span> {s.performance_notes}
                  </div>
                )}
                {s.next_session_plan && (
                  <div className="text-xs">
                    <span className="font-medium">Próxima aula:</span> {s.next_session_plan}
                  </div>
                )}
              </div>
            ))
          )}
          <Button className="w-full" onClick={onAdd}>
            <Plus className="h-4 w-4" /> Registrar nova aula neste dia
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RevenueDialog({
  open, onOpenChange, mode, setMode, rangeStart, setRangeStart, rangeEnd, setRangeEnd, payments,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "month" | "all" | "range";
  setMode: (m: "month" | "all" | "range") => void;
  rangeStart: string;
  setRangeStart: (v: string) => void;
  rangeEnd: string;
  setRangeEnd: (v: string) => void;
  payments: any[];
}) {
  const total = payments.reduce((s, p) => s + Number(p.amount), 0);
  const avg = payments.length ? total / payments.length : 0;

  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of payments) {
      const k = p.reference_month ?? p.payment_date.slice(0, 7);
      map.set(k, (map.get(k) ?? 0) + Number(p.amount));
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([month, total]) => ({ month, total }));
  }, [payments]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Receita PT — Detalhamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="flex flex-wrap gap-2">
            {(["month", "all", "range"] as const).map((m) => (
              <Button
                key={m}
                size="sm"
                variant={mode === m ? "default" : "outline"}
                onClick={() => setMode(m)}
              >
                {m === "month" ? "Mês atual" : m === "all" ? "Todos os meses" : "Período"}
              </Button>
            ))}
          </div>

          {mode === "range" && (
            <div className="flex flex-wrap items-center gap-2">
              <Input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="w-auto" />
              <span className="text-sm text-muted-foreground">até</span>
              <Input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="w-auto" />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-lg font-bold font-mono">{formatBRL(total)}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Pagamentos</div>
              <div className="text-lg font-bold font-mono">{payments.length}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Ticket médio</div>
              <div className="text-lg font-bold font-mono">{formatBRL(avg)}</div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Receita</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byMonth.map(({ month, total }) => (
                <TableRow key={month}>
                  <TableCell className="capitalize">
                    {new Date(month + "-01").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatBRL(total)}</TableCell>
                </TableRow>
              ))}
              {byMonth.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-sm text-muted-foreground">
                    Nenhum pagamento encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <p className="text-xs text-muted-foreground">
            Mostrando apenas pagamentos com status "Pago"
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
