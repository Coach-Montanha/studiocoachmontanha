import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  CalendarDays,
  Receipt,
  TrendingUp,
  Layers,
  Pencil,
  PauseCircle,
  Ticket,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PlanBadge, StudentStatusBadge } from "@/components/edufinance/Badges";
import { PaymentDialog } from "@/components/edufinance/PaymentDialog";
import { StudentDialog } from "@/components/edufinance/StudentDialog";
import { FreezeDialog } from "@/components/edufinance/FreezeDialog";
import { TransferPaymentDialog } from "@/components/edufinance/TransferPaymentDialog";
import { renewPayment } from "@/lib/payment-renew";
import { initials, formatMonthLabel } from "@/lib/format";

// Modularized Tabs
import { StudentOverviewTab } from "@/components/students/tabs/StudentOverviewTab";
import { StudentPersonalTab } from "@/components/students/tabs/StudentPersonalTab";
import { StudentPlanTab } from "@/components/students/tabs/StudentPlanTab";
import { StudentPaymentsTab, type PaymentRow } from "@/components/students/tabs/StudentPaymentsTab";
import { StudentCheckinsTab, type CheckinEntry } from "@/components/students/tabs/StudentCheckinsTab";
import { StudentAttendanceTab } from "@/components/students/tabs/StudentAttendanceTab";

const STUDENT_TABS = [
  "overview",
  "personal",
  "plan",
  "payments",
  "checkins",
  "attendance",
] as const;
type StudentTab = (typeof STUDENT_TABS)[number];

export const Route = createFileRoute("/_authenticated/students/$id")({
  head: () => ({ meta: [{ title: "Aluno — EduFinance" }] }),
  validateSearch: (search: Record<string, unknown>): { tab?: StudentTab } => ({
    tab: STUDENT_TABS.includes(search.tab as StudentTab)
      ? (search.tab as StudentTab)
      : "overview",
  }),
  component: StudentDetail,
});

function StudentDetail() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const qc = useQueryClient();
  const tab = search.tab ?? "overview";

  const [editOpen, setEditOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [editingFreeze, setEditingFreeze] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentRow | null>(null);
  const [transferPaymentId, setTransferPaymentId] = useState<string | null>(null);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [attendancePeriod, setAttendancePeriod] = useState<string>("all");

  const { data: student } = useQuery({
    queryKey: ["student", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("*, student_plan_history(*, plans(*))")
        .eq("id", id)
        .is("deleted_at", null)
        .single();
      return data;
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["student-payments", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*, plans(*)")
        .eq("student_id", id)
        .is("deleted_at", null)
        .order("reference_month", { ascending: false });
      return (data ?? []) as PaymentRow[];
    },
  });

  const { data: freezes = [] } = useQuery({
    queryKey: ["student-freezes", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_freezes")
        .select("*")
        .eq("student_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: checkinEntries = [], isLoading: loadingAttendance } = useQuery({
    queryKey: ["student-attendance-entries", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("class_attendance")
        .select("id, checked_in_at, class_instances(id, date, start_time, classes(name))")
        .eq("student_id", id)
        .order("checked_in_at", { ascending: false });

      return (data ?? [])
        .map((row: any) => {
          const inst = row.class_instances;
          const date: string | null =
            inst?.date ?? (row.checked_in_at ? row.checked_in_at.slice(0, 10) : null);
          if (!date) return null;
          return {
            id: row.id,
            date,
            time: inst?.start_time ?? (row.checked_in_at ? row.checked_in_at.slice(11, 16) : null),
            className: inst?.classes?.name ?? null,
          } as CheckinEntry;
        })
        .filter(Boolean) as CheckinEntry[];
    },
  });

  const attendance = useMemo(() => checkinEntries.map((e) => e.date), [checkinEntries]);

  const attendanceCount = useMemo(() => {
    const now = new Date();
    const currentYear = String(now.getFullYear());
    const currentMonth = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const filtered = attendance.filter((d) => {
      if (attendancePeriod === "year") return d.startsWith(currentYear);
      if (attendancePeriod === "month") return d.startsWith(currentMonth);
      return true;
    });
    const base = filtered.length;
    const offset = attendancePeriod === "all" ? Number((student as any)?.attendance_offset ?? 0) : 0;
    return base + offset;
  }, [attendance, attendancePeriod, student]);

  const paid = useMemo(() => payments.filter((p) => p.status === "paid"), [payments]);

  const kpis = useMemo(() => {
    const total = paid.reduce((s, p) => s + Number(p.amount), 0);
    const monthsSet = new Set(paid.map((p) => p.reference_month));
    const months = monthsSet.size;
    const avg = months ? total / months : 0;
    const sortedAsc = [...paid].sort((a, b) =>
      a.payment_date < b.payment_date ? -1 : 1,
    );
    const first = sortedAsc[0]?.reference_month;
    const last = sortedAsc[sortedAsc.length - 1]?.reference_month;
    const lastDate = sortedAsc[sortedAsc.length - 1]?.payment_date;
    let gapMonths = 0;
    if (first && last) {
      const [fy, fm] = first.split("-").map(Number);
      const [ly, lm] = last.split("-").map(Number);
      const totalMonths = (ly - fy) * 12 + (lm - fm) + 1;
      gapMonths = Math.max(0, totalMonths - months);
    }
    return { total, months, avg, lastDate, gapMonths };
  }, [paid]);

  const monthlySeries = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of paid) {
      map.set(p.reference_month, (map.get(p.reference_month) ?? 0) + Number(p.amount));
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => ({ month: formatMonthLabel(k), value: v }));
  }, [paid]);

  if (!student) {
    return <div className="text-sm text-muted-foreground">Carregando…</div>;
  }

  const currentPlan = student.student_plan_history?.find((h: any) => h.is_current);

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("payments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deleteTarget.id)
      .is("deleted_at", null);
    if (error) return toast.error(error.message);
    toast.success("Pagamento movido para a Lixeira");
    qc.invalidateQueries();
    setDeleteTarget(null);
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <Link
          to="/students"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {initials(student.name)}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{student.name}</h1>
              <div className="mt-1 flex items-center gap-2">
                <StudentStatusBadge status={student.status} />
                <PlanBadge name={currentPlan?.plans?.name} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {student.email ?? "Sem email"} · {student.phone ?? "Sem telefone"}
              </div>
              {student.notes && (
                <p className="mt-2 max-w-md text-xs text-muted-foreground">{student.notes}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="transition-all duration-200 active:scale-[0.98]"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-4 w-4" /> Editar
            </Button>
            <Button
              variant="outline"
              className="transition-all duration-200 active:scale-[0.98]"
              onClick={() => {
                setEditingFreeze(null);
                setFreezeOpen(true);
              }}
            >
              <PauseCircle className="h-4 w-4" /> Trancar plano
            </Button>
            <Button
              className="transition-all duration-200 active:scale-[0.98]"
              onClick={() => {
                setEditingPayment(null);
                setPaymentOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Novo pagamento
            </Button>
          </div>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) =>
            navigate({ search: { tab: v as StudentTab }, replace: true })
          }
          className="space-y-4"
        >
          <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="inline-flex w-max justify-start gap-1">
              <TabsTrigger value="overview" className="gap-1.5 transition-all duration-200">
                <TrendingUp className="h-3.5 w-3.5" /> Visão Geral
              </TabsTrigger>
              <TabsTrigger value="personal" className="gap-1.5 transition-all duration-200">
                <UserRound className="h-3.5 w-3.5" /> Dados pessoais
              </TabsTrigger>
              <TabsTrigger value="plan" className="gap-1.5 transition-all duration-200">
                <Layers className="h-3.5 w-3.5" /> Plano
              </TabsTrigger>
              <TabsTrigger value="payments" className="gap-1.5 transition-all duration-200">
                <Receipt className="h-3.5 w-3.5" /> Pagamentos
              </TabsTrigger>
              <TabsTrigger value="checkins" className="gap-1.5 transition-all duration-200">
                <Ticket className="h-3.5 w-3.5" /> Check-ins
              </TabsTrigger>
              <TabsTrigger value="attendance" className="gap-1.5 transition-all duration-200">
                <CalendarDays className="h-3.5 w-3.5" /> Frequência
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview">
            <StudentOverviewTab
              kpis={kpis}
              currentPlan={currentPlan}
              attendanceCount={attendanceCount}
              attendancePeriod={attendancePeriod}
              onAttendancePeriodChange={setAttendancePeriod}
              monthlySeries={monthlySeries}
            />
          </TabsContent>

          <TabsContent value="personal">
            <StudentPersonalTab
              student={student as any}
              onEdit={() => setEditOpen(true)}
            />
          </TabsContent>

          <TabsContent value="plan">
            <StudentPlanTab
              currentPlan={currentPlan}
              history={(student.student_plan_history ?? []) as any[]}
              freezes={freezes}
              onOpenNewFreeze={() => {
                setEditingFreeze(null);
                setFreezeOpen(true);
              }}
              onEditFreeze={(f) => {
                setEditingFreeze(f);
                setFreezeOpen(true);
              }}
            />
          </TabsContent>

          <TabsContent value="payments">
            <StudentPaymentsTab
              payments={payments}
              attendanceDates={attendance}
              freezes={freezes as any[]}
              student={student}
              onEdit={(p) => {
                setEditingPayment(p);
                setPaymentOpen(true);
              }}
              onDelete={(p) => setDeleteTarget(p)}
              onAdd={() => {
                setEditingPayment(null);
                setPaymentOpen(true);
              }}
              onTransfer={(p) => setTransferPaymentId(p.id)}
              onRenew={async (p) => {
                setRenewingId(p.id);
                const ok = await renewPayment(p as any);
                setRenewingId(null);
                if (ok) qc.invalidateQueries();
              }}
              onToggleAutoRenew={async (p) => {
                const next = !(p.auto_renew ?? p.plans?.auto_renew ?? false);
                const { error } = await supabase
                  .from("payments")
                  .update({ auto_renew: next })
                  .eq("id", p.id);
                if (error) {
                  toast.error(error.message);
                  return;
                }
                toast.success(
                  next ? "Renovação automática ativada" : "Renovação automática desativada",
                );
                qc.invalidateQueries();
              }}
              renewingId={renewingId}
            />
          </TabsContent>

          <TabsContent value="checkins">
            <StudentCheckinsTab
              payments={payments}
              attendanceDates={attendance}
              freezes={freezes as any[]}
              entries={checkinEntries}
              loading={loadingAttendance}
              studentName={student.name}
            />
          </TabsContent>

          <TabsContent value="attendance">
            <StudentAttendanceTab
              payments={payments}
              studentCreatedAt={student.created_at}
            />
          </TabsContent>
        </Tabs>

        <StudentDialog open={editOpen} onOpenChange={setEditOpen} student={student} />
        <PaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          defaultStudentId={id}
          payment={editingPayment}
        />
        <FreezeDialog
          open={freezeOpen}
          onOpenChange={setFreezeOpen}
          studentId={id}
          planName={currentPlan?.plans?.name}
          freeze={editingFreeze}
        />
        <TransferPaymentDialog
          open={!!transferPaymentId}
          onOpenChange={(o) => {
            if (!o) setTransferPaymentId(null);
          }}
          paymentId={transferPaymentId ?? ""}
          currentStudentId={id}
        />

        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mover pagamento para a Lixeira?</AlertDialogTitle>
              <AlertDialogDescription>
                O pagamento de {deleteTarget?.reference_month} (R${" "}
                {Number(deleteTarget?.amount).toFixed(2)}) será movido para a Lixeira. Você poderá
                restaurá-lo depois se necessário.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Mover para a Lixeira
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
