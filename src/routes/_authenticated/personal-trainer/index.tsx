import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, DollarSign, Activity, TrendingUp, Percent, Plus, Eye, CalendarPlus, CreditCard, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { addDays, format, parseISO, startOfMonth, endOfMonth, startOfWeek, addWeeks, isSameDay, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KPICard } from "@/components/edufinance/KPICard";
import { EmptyState } from "@/components/edufinance/EmptyState";
import { PTBadge, PTSessionStatusBadge, PTStudentStatusBadge } from "@/components/pt/PTBadges";
import { PTStudentDialog } from "@/components/pt/PTStudentDialog";
import { PTSessionDialog } from "@/components/pt/PTSessionDialog";
import { PTPaymentDialog } from "@/components/pt/PTPaymentDialog";
import { formatBRL, formatDateBR, currentMonthKey } from "@/lib/format";
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

  const monthKey = currentMonthKey();
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  const { data: students = [] } = useQuery({
    queryKey: ["pt-students-overview"],
    queryFn: async () =>
      (await supabase
        .from("pt_students")
        .select("id,name,status,pt_payments(id,amount,payment_date,status,pt_plan_id,sessions_paid,reference_month,pt_plans(name,sessions_per_month))")
        .order("name")
      ).data ?? [],
  });

  const { data: monthSessions = [] } = useQuery({
    queryKey: ["pt-month-sessions", monthKey],
    queryFn: async () =>
      (await supabase
        .from("pt_sessions")
        .select("id,pt_student_id,session_date,session_time,duration_minutes,status,pt_students(name)")
        .gte("session_date", format(monthStart, "yyyy-MM-dd"))
        .lte("session_date", format(monthEnd, "yyyy-MM-dd"))
        .order("session_date")
      ).data ?? [],
  });

  const { data: monthPayments = [] } = useQuery({
    queryKey: ["pt-month-payments", monthKey],
    queryFn: async () =>
      (await supabase
        .from("pt_payments")
        .select("id,amount,status,payment_date")
        .eq("status", "paid")
        .gte("payment_date", format(monthStart, "yyyy-MM-dd"))
        .lte("payment_date", format(monthEnd, "yyyy-MM-dd"))
      ).data ?? [],
  });

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
        <KPICard label="💰 Receita PT no mês" value={formatBRL(kpis.revenue)} icon={<DollarSign className="h-5 w-5" />} />
        <KPICard label="🏃 Aulas realizadas" value={kpis.completed} icon={<Activity className="h-5 w-5" />} />
        <KPICard label="📊 Ticket Médio PT" value={formatBRL(kpis.avg)} icon={<TrendingUp className="h-5 w-5" />} />
        <KPICard label="⚡ Taxa de presença" value={`${kpis.attendanceRate.toFixed(1).replace(".", ",")}%`} icon={<Percent className="h-5 w-5" />} />
      </div>

      <Tabs defaultValue="students" className="space-y-4">
        <TabsList>
          <TabsTrigger value="students">Alunos</TabsTrigger>
          <TabsTrigger value="calendar">Aulas do Mês</TabsTrigger>
        </TabsList>

        <TabsContent value="students">
          <Card className="p-5">
            {students.length === 0 ? (
              <EmptyState title="Nenhum aluno PT" description="Cadastre seu primeiro aluno de personal trainer" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aulas/mês</TableHead>
                    <TableHead className="text-right">Realizadas</TableHead>
                    <TableHead className="text-right">Restantes</TableHead>
                    <TableHead>Último pagamento</TableHead>
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
                    const done = monthSessions.filter((ms) => ms.pt_student_id === s.id && ms.status === "completed").length;
                    const remaining = Math.max(0, (contracted ?? 0) - done);
                    return (
                      <TableRow key={s.id}>
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

        <TabsContent value="calendar">
          <MonthCalendar
            sessions={monthSessions}
            monthStart={monthStart}
            onDayClick={(d) => { setPresetDate(d); setPresetStudentId(undefined); setSessionOpen(true); }}
          />
        </TabsContent>
      </Tabs>

      <PTStudentDialog open={studentOpen} onOpenChange={setStudentOpen} />
      <PTSessionDialog open={sessionOpen} onOpenChange={setSessionOpen} defaultStudentId={presetStudentId} defaultDate={presetDate} />
      <PTPaymentDialog open={paymentOpen} onOpenChange={setPaymentOpen} defaultStudentId={presetStudentId} />
    </div>
  );
}

function MonthCalendar({
  sessions, monthStart, onDayClick,
}: {
  sessions: any[];
  monthStart: Date;
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
      <h2 className="mb-3 text-sm font-semibold">{format(monthStart, "MMMM yyyy", { locale: ptBR })}</h2>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
        {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const items = sessionsByDate.get(key) ?? [];
          const outside = !isSameMonth(day, monthStart);
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
