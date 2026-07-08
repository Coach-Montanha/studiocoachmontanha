import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function combineDateTime(dateISO: string, timeHHMM: string): Date {
  // treat time as local (no timezone offset); consistent between server + client for compare purposes
  return new Date(`${dateISO}T${timeHHMM.slice(0, 5)}:00`);
}

/** Start (Mon) and end (Sun 23:59:59) of the ISO week for a given date */
function weekBounds(d: Date): { start: Date; end: Date } {
  const day = d.getDay(); // 0..6 (Sun..Sat)
  const diffToMonday = (day + 6) % 7; // 0 if Mon
  const start = new Date(d);
  start.setDate(d.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function monthBounds(d: Date): { start: Date; end: Date } {
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

// ------------------------------------------------------------------
// Generate class sessions (now supports multi-day)
// ------------------------------------------------------------------

export const generateClassSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { classId: string; weeks?: number }) => {
    if (!input.classId) throw new Error("classId requerido");
    return { classId: input.classId, weeks: input.weeks ?? 12 };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cls, error } = await supabase
      .from("classes")
      .select("id, user_id, days_of_week, day_of_week, start_time, duration_minutes, is_recurring")
      .eq("id", data.classId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cls) throw new Error("Turma não encontrada");
    if (cls.user_id !== userId) throw new Error("Sem permissão");
    if (!cls.is_recurring) throw new Error("Turma não é recorrente");

    const days: number[] =
      (cls.days_of_week && cls.days_of_week.length > 0)
        ? (cls.days_of_week as number[])
        : cls.day_of_week !== null && cls.day_of_week !== undefined
          ? [cls.day_of_week as number]
          : [];
    if (days.length === 0) throw new Error("Selecione ao menos um dia da semana");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentDow = today.getDay();

    const rows: Array<{
      user_id: string;
      class_id: string;
      session_date: string;
      start_time: string;
      duration_minutes: number;
    }> = [];

    for (const targetDow of days) {
      const diff = (targetDow - currentDow + 7) % 7;
      for (let w = 0; w < data.weeks; w++) {
        const d = new Date(today);
        d.setDate(today.getDate() + diff + w * 7);
        rows.push({
          user_id: userId,
          class_id: cls.id,
          session_date: toDateKey(d),
          start_time: cls.start_time,
          duration_minutes: cls.duration_minutes,
        });
      }
    }

    const { data: existing } = await supabase
      .from("class_sessions")
      .select("session_date")
      .eq("class_id", cls.id)
      .in("session_date", rows.map((r) => r.session_date));
    const existingSet = new Set((existing ?? []).map((e: any) => e.session_date));
    const toInsert = rows.filter((r) => !existingSet.has(r.session_date));

    if (toInsert.length > 0) {
      const { error: iErr } = await supabase.from("class_sessions").insert(toInsert);
      if (iErr) throw new Error(iErr.message);
    }

    return { created: toInsert.length, total: rows.length };
  });

// ------------------------------------------------------------------
// Agenda (admin + student)
// ------------------------------------------------------------------

export type AgendaSession = {
  id: string;
  session_date: string;
  start_time: string;
  duration_minutes: number;
  class_id: string | null;
  class_name: string;
  trainer_name: string | null;
  program_id: string | null;
  program_name: string | null;
  program_color: string | null;
  capacity: number;
  filled: number;
  is_enrolled: boolean;
  checked_in: boolean;
  checkin_opens_minutes_before: number;
  checkin_closes_minutes_before: number;
  studio_user_id: string;
};

export const getAgenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { from: string; to: string; programId?: string | null }) => {
    if (!input.from || !input.to) throw new Error("Período obrigatório");
    return input;
  })
  .handler(async ({ data, context }): Promise<AgendaSession[]> => {
    const { supabase, userId } = context;

    // Discover if user is a student and their student.id
    let studentId: string | null = null;
    {
      const { data: stu } = await supabase
        .from("students")
        .select("id")
        .eq("account_user_id", userId)
        .maybeSingle();
      studentId = stu?.id ?? null;
    }

    const { data: sessions, error } = await supabase
      .from("class_sessions")
      .select(`
        id, session_date, start_time, duration_minutes, class_id, user_id,
        classes:class_id (
          name, trainer_name, capacity, program_id,
          checkin_opens_minutes_before, checkin_closes_minutes_before,
          programs:program_id ( id, name, color )
        )
      `)
      .gte("session_date", data.from)
      .lte("session_date", data.to)
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw new Error(error.message);

    const sessionIds = (sessions ?? []).map((s: any) => s.id);

    // Counts per session
    const countsMap = new Map<string, number>();
    if (sessionIds.length > 0) {
      const { data: att } = await supabase
        .from("class_attendance")
        .select("session_id")
        .in("session_id", sessionIds);
      (att ?? []).forEach((r: any) => {
        countsMap.set(r.session_id, (countsMap.get(r.session_id) ?? 0) + 1);
      });
    }

    // Student access is derived from the current plan's program restrictions.
    // - No current plan → no access
    // - Plan without plan_programs rows → access to all programs (unrestricted)
    // - Plan with plan_programs rows → access only to those programs
    let allowedProgramIds: Set<string> | null = null; // null = unrestricted
    let hasCurrentPlan = false;
    let checkedInSessionIds = new Set<string>();
    if (studentId) {
      const today = toDateKey(new Date());
      const { data: currentPayments } = await supabase
        .from("payments")
        .select("plan_id,due_date,payment_date")
        .eq("student_id", studentId)
        .eq("status", "paid")
        .not("plan_id", "is", null)
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10);
      const current = (currentPayments ?? []).find((p: any) => !p.due_date || p.due_date >= today);
      if (current?.plan_id) {
        hasCurrentPlan = true;
        const { data: pp } = await supabase
          .from("plan_programs")
          .select("program_id")
          .eq("plan_id", current.plan_id);
        const ids = (pp ?? []).map((r: any) => r.program_id);
        allowedProgramIds = ids.length > 0 ? new Set(ids) : null;
      }
      if (sessionIds.length > 0) {
        const { data: mine } = await supabase
          .from("class_attendance")
          .select("session_id")
          .eq("student_id", studentId)
          .in("session_id", sessionIds);
        checkedInSessionIds = new Set((mine ?? []).map((r: any) => r.session_id));
      }
    }

    const hasAccess = (programId: string | null) => {
      if (!studentId || !hasCurrentPlan) return false;
      if (allowedProgramIds === null) return true;
      return programId ? allowedProgramIds.has(programId) : false;
    };

    let out: AgendaSession[] = (sessions ?? []).map((s: any) => ({
      id: s.id,
      session_date: s.session_date,
      start_time: s.start_time,
      duration_minutes: s.duration_minutes,
      class_id: s.class_id,
      class_name: s.classes?.name ?? "Turma removida",
      trainer_name: s.classes?.trainer_name ?? null,
      program_id: s.classes?.program_id ?? null,
      program_name: s.classes?.programs?.name ?? null,
      program_color: s.classes?.programs?.color ?? null,
      capacity: s.classes?.capacity ?? 0,
      filled: countsMap.get(s.id) ?? 0,
      is_enrolled: hasAccess(s.classes?.program_id ?? null),
      checked_in: checkedInSessionIds.has(s.id),
      checkin_opens_minutes_before: s.classes?.checkin_opens_minutes_before ?? 60,
      checkin_closes_minutes_before: s.classes?.checkin_closes_minutes_before ?? 15,
      studio_user_id: s.user_id,
    }));

    if (data.programId) {
      out = out.filter((s) => s.program_id === data.programId);
    }
    return out;
  });

// ------------------------------------------------------------------
// Student check-in usage (for quota display)
// ------------------------------------------------------------------

export type QuotaUsage = {
  plan_id: string | null;
  plan_name: string | null;
  quota_type: "none" | "weekly" | "monthly" | "package";
  quota_amount: number | null;
  used: number;
  remaining: number | null;
  period_label: string;
  package_expires_at: string | null;
};

export const getMyQuotaUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QuotaUsage> => {
    const { supabase, userId } = context;
    const { data: stu } = await supabase
      .from("students")
      .select("id")
      .eq("account_user_id", userId)
      .maybeSingle();
    if (!stu) {
      return {
        plan_id: null,
        plan_name: null,
        quota_type: "none",
        quota_amount: null,
        used: 0,
        remaining: null,
        period_label: "",
        package_expires_at: null,
      };
    }
    return await computeQuotaUsage(supabase, stu.id);
  });

async function computeQuotaUsage(
  supabase: any,
  studentId: string,
): Promise<QuotaUsage> {
  const today = toDateKey(new Date());
  const { data: currentPayments } = await supabase
    .from("payments")
    .select("plan_id, payment_date, due_date, plans:plan_id ( name, checkin_quota_type, checkin_quota_amount, package_valid_days )")
    .eq("student_id", studentId)
    .eq("status", "paid")
    .not("plan_id", "is", null)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(10);
  const current = (currentPayments ?? []).find((p: any) => !p.due_date || p.due_date >= today);

  const plan = current?.plans;
  const quotaType = (plan?.checkin_quota_type ?? "none") as QuotaUsage["quota_type"];
  const quotaAmount = plan?.checkin_quota_amount ?? null;
  const now = new Date();

  const base: QuotaUsage = {
    plan_id: current?.plan_id ?? null,
    plan_name: plan?.name ?? null,
    quota_type: quotaType,
    quota_amount: quotaAmount,
    used: 0,
    remaining: quotaAmount,
    period_label: "",
    package_expires_at: null,
  };

  if (quotaType === "none" || !quotaAmount) return base;

  let periodStart: Date;
  let periodEnd: Date;
  let periodLabel: string;
  let packageExpiresAt: string | null = null;

  if (quotaType === "weekly") {
    const wb = weekBounds(now);
    periodStart = wb.start;
    periodEnd = wb.end;
    periodLabel = "esta semana";
  } else if (quotaType === "monthly") {
    const mb = monthBounds(now);
    periodStart = mb.start;
    periodEnd = mb.end;
    periodLabel = "este mês";
  } else {
    // package
    const start = current?.payment_date ? new Date(current.payment_date) : now;
    const validDays = plan?.package_valid_days ?? 30;
    periodStart = new Date(start);
    periodStart.setHours(0, 0, 0, 0);
    periodEnd = new Date(periodStart);
    periodEnd.setDate(periodStart.getDate() + validDays);
    packageExpiresAt = periodEnd.toISOString().slice(0, 10);
    periodLabel = `até ${new Date(periodEnd).toLocaleDateString("pt-BR")}`;
  }

  // Count check-ins in the period via class_sessions.session_date
  const { data: attRows } = await supabase
    .from("class_attendance")
    .select("id, class_sessions:session_id ( session_date )")
    .eq("student_id", studentId);

  const used = (attRows ?? []).filter((r: any) => {
    const sd = r.class_sessions?.session_date;
    if (!sd) return false;
    const d = new Date(`${sd}T12:00:00`);
    return d >= periodStart && d <= periodEnd;
  }).length;

  return {
    ...base,
    used,
    remaining: Math.max(0, quotaAmount - used),
    period_label: periodLabel,
    package_expires_at: packageExpiresAt,
  };
}

// ------------------------------------------------------------------
// Student check-in / cancel
// ------------------------------------------------------------------

async function loadSessionContext(supabase: any, sessionId: string) {
  const { data: session, error } = await supabase
    .from("class_sessions")
    .select(`
      id, session_date, start_time, class_id, user_id,
      classes:class_id (
        capacity, program_id,
        checkin_opens_minutes_before, checkin_closes_minutes_before
      )
    `)
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!session) throw new Error("Sessão não encontrada");
  return session;
}

export const studentCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string }) => {
    if (!input.sessionId) throw new Error("sessionId requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: stu } = await supabase
      .from("students")
      .select("id, user_id")
      .eq("account_user_id", userId)
      .maybeSingle();
    if (!stu) throw new Error("Perfil de aluno não encontrado");

    const session = await loadSessionContext(supabase, data.sessionId);
    if (session.user_id !== stu.user_id) throw new Error("Sessão não pertence ao seu studio");
    if (!session.class_id) throw new Error("Sessão sem turma associada");

    // Access is derived from the student's current plan and its program restrictions
    // (validated below via plan_programs). Enrollment is not required.

    // Check-in window
    const start = combineDateTime(session.session_date, session.start_time);
    const opens = new Date(start.getTime() - (session.classes?.checkin_opens_minutes_before ?? 60) * 60_000);
    const closes = new Date(start.getTime() - (session.classes?.checkin_closes_minutes_before ?? 15) * 60_000);
    const now = new Date();
    if (now < opens) {
      throw new Error(`Check-in abre às ${opens.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`);
    }
    if (now > closes) {
      throw new Error(`Check-in encerrado às ${closes.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`);
    }

    // Capacity
    const { count } = await supabase
      .from("class_attendance")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id);
    if ((count ?? 0) >= (session.classes?.capacity ?? 0)) {
      throw new Error("Turma sem vagas");
    }

    // Program per-day rule
    const programId = session.classes?.program_id ?? null;
    if (programId) {
      const { data: settings } = await supabase
        .from("studio_settings")
        .select("allow_multi_checkin_same_program_per_day")
        .eq("user_id", stu.user_id)
        .maybeSingle();
      const allowMulti = settings?.allow_multi_checkin_same_program_per_day ?? false;
      if (!allowMulti) {
        const { data: sameDay } = await supabase
          .from("class_attendance")
          .select("id, class_sessions:session_id ( session_date, classes:class_id ( program_id ) )")
          .eq("student_id", stu.id);
        const conflict = (sameDay ?? []).some((r: any) =>
          r.class_sessions?.session_date === session.session_date &&
          r.class_sessions?.classes?.program_id === programId
        );
        if (conflict) throw new Error("Você já fez check-in em outra aula deste programa hoje");
      }
    }

    // Quota
    const usage = await computeQuotaUsage(supabase, stu.id);
    if (usage.quota_type !== "none" && usage.quota_amount) {
      if (usage.used >= usage.quota_amount) {
        const label =
          usage.quota_type === "weekly" ? "semana"
          : usage.quota_type === "monthly" ? "mês"
          : "pacote";
        throw new Error(`Cota do plano atingida (${usage.quota_amount} check-ins/${label})`);
      }
    }

    // Plan access: must have a current plan; if the plan has program links,
    // the session's program must be one of them.
    if (!usage.plan_id) {
      throw new Error("Você não possui um plano ativo — fale com o studio");
    }
    if (programId) {
      const { data: allowed } = await supabase
        .from("plan_programs")
        .select("program_id")
        .eq("plan_id", usage.plan_id);
      const allowedIds = (allowed ?? []).map((r: any) => r.program_id);
      if (allowedIds.length > 0 && !allowedIds.includes(programId)) {
        throw new Error("Seu plano não libera esta modalidade");
      }
    }

    const { error: insErr } = await supabase.from("class_attendance").insert({
      user_id: stu.user_id,
      session_id: session.id,
      student_id: stu.id,
      status: "present",
    });
    if (insErr) throw new Error(insErr.message);
    return { ok: true };
  });

export const studentCancelCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string }) => {
    if (!input.sessionId) throw new Error("sessionId requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: stu } = await supabase
      .from("students")
      .select("id, user_id")
      .eq("account_user_id", userId)
      .maybeSingle();
    if (!stu) throw new Error("Perfil de aluno não encontrado");

    const session = await loadSessionContext(supabase, data.sessionId);
    const start = combineDateTime(session.session_date, session.start_time);
    const closes = new Date(start.getTime() - (session.classes?.checkin_closes_minutes_before ?? 15) * 60_000);
    const now = new Date();
    if (now > closes) {
      throw new Error(`Cancelamento encerrado às ${closes.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`);
    }

    const { error } = await supabase
      .from("class_attendance")
      .delete()
      .eq("session_id", session.id)
      .eq("student_id", stu.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
