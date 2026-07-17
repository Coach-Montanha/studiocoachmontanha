import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { combineDateTime, computeQuotaUsage, loadSessionContext, toDateKey, type QuotaUsage } from "./classes.helpers";

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

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
      .select("session_date,start_time")
      .eq("class_id", cls.id)
      .in("session_date", rows.map((r) => r.session_date));
    const existingSet = new Set((existing ?? []).map((e: any) => `${e.session_date}|${String(e.start_time).slice(0, 5)}`));
    const toInsert = rows.filter((r) => !existingSet.has(`${r.session_date}|${String(r.start_time).slice(0, 5)}`));

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
  capacity_override: number | null;
  session_notes: string | null;
  status: string;
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
        capacity_override, notes, status,
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
      capacity: s.capacity_override ?? s.classes?.capacity ?? 0,
      filled: countsMap.get(s.id) ?? 0,
      is_enrolled: hasAccess(s.classes?.program_id ?? null),
      checked_in: checkedInSessionIds.has(s.id),
      checkin_opens_minutes_before: s.classes?.checkin_opens_minutes_before ?? 60,
      checkin_closes_minutes_before: s.classes?.checkin_closes_minutes_before ?? 15,
      studio_user_id: s.user_id,
      capacity_override: s.capacity_override ?? null,
      session_notes: s.notes ?? null,
      status: s.status ?? "scheduled",
    }));

    if (data.programId) {
      out = out.filter((s) => s.program_id === data.programId);
    }
    return out;
  });

// ------------------------------------------------------------------
// Student check-in usage (for quota display)
// ------------------------------------------------------------------

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

// ------------------------------------------------------------------
// Student attendance stats (portal counter)
// ------------------------------------------------------------------

export type MyAttendanceStats = {
  total: number;
  year: number;
  month: number;
};

export const getMyAttendanceStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyAttendanceStats> => {
    const { supabase, userId } = context;
    const { data: stu } = await supabase
      .from("students")
      .select("id, attendance_offset")
      .eq("account_user_id", userId)
      .maybeSingle();
    if (!stu) return { total: 0, year: 0, month: 0 };
    const { data: att } = await supabase
      .from("class_attendance")
      .select("session_id, class_sessions:session_id(session_date)")
      .eq("student_id", (stu as any).id);
    const dates = ((att ?? []) as any[])
      .map((r) => r.class_sessions?.session_date as string | undefined)
      .filter((d): d is string => !!d);
    const now = new Date();
    const y = String(now.getFullYear());
    const ym = `${y}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const offset = ((stu as any).attendance_offset as number | null) ?? 0;
    return {
      total: dates.length + offset,
      year: dates.filter((d) => d.startsWith(y)).length,
      month: dates.filter((d) => d.startsWith(ym)).length,
    };
  });

// ------------------------------------------------------------------
// Session attendees (student-visible names for a class session)
// ------------------------------------------------------------------

export type SessionAttendee = { student_id: string; name: string; is_me: boolean };

export const getSessionAttendees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string }) => {
    if (!input.sessionId) throw new Error("sessionId requerido");
    return input;
  })
  .handler(async ({ data, context }): Promise<SessionAttendee[]> => {
    const { supabase, userId } = context;
    // Requester must be a student in the same studio as the session, OR the studio owner
    const { data: session, error: sErr } = await supabase
      .from("class_sessions")
      .select("id, user_id")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!session) throw new Error("Sessão não encontrada");

    let myStudentId: string | null = null;
    if (session.user_id !== userId) {
      const { data: stu } = await supabase
        .from("students")
        .select("id, user_id")
        .eq("account_user_id", userId)
        .maybeSingle();
      if (!stu || stu.user_id !== session.user_id) {
        throw new Error("Sem permissão");
      }
      myStudentId = stu.id;
    }

    // Use admin client to bypass students SELECT policy (which hides other students' names)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: att, error: aErr } = await supabaseAdmin
      .from("class_attendance")
      .select("student_id, students:student_id(name)")
      .eq("session_id", data.sessionId);
    if (aErr) throw new Error(aErr.message);
    return ((att ?? []) as any[])
      .map((r) => ({
        student_id: r.student_id as string,
        name: (r.students?.name as string) ?? "Aluno",
        is_me: myStudentId === r.student_id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  });

// ------------------------------------------------------------------
// Student check-in / cancel
// ------------------------------------------------------------------

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

// ------------------------------------------------------------------
// Per-session admin ops: delete/update with scope
// ------------------------------------------------------------------

async function assertSessionOwner(supabase: any, userId: string, sessionId: string) {
  const { data: s, error } = await supabase
    .from("class_sessions")
    .select("id, user_id, class_id, session_date, start_time")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!s) throw new Error("Sessão não encontrada");
  if (s.user_id !== userId) throw new Error("Sem permissão");
  return s as {
    id: string;
    user_id: string;
    class_id: string | null;
    session_date: string;
    start_time: string;
  };
}

/** Exclui apenas UMA sessão (não afeta as demais nem a turma-mãe). */
export const deleteClassSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string }) => {
    if (!input.sessionId) throw new Error("sessionId requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSessionOwner(supabase, userId, data.sessionId);
    const { error } = await supabase
      .from("class_sessions")
      .delete()
      .eq("id", data.sessionId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, deleted: 1 };
  });

/** Exclui esta sessão e todas as futuras (mesma turma) a partir dela. */
export const deleteClassSessionsFrom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string }) => {
    if (!input.sessionId) throw new Error("sessionId requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const s = await assertSessionOwner(supabase, userId, data.sessionId);
    if (!s.class_id) {
      const { error } = await supabase
        .from("class_sessions")
        .delete()
        .eq("id", s.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { ok: true, deleted: 1 };
    }
    // Seleciona ids elegíveis: mesma turma, (data > esta) OR (data == esta AND hora >= esta)
    const { data: futures, error: qErr } = await supabase
      .from("class_sessions")
      .select("id, session_date, start_time")
      .eq("class_id", s.class_id)
      .eq("user_id", userId)
      .gte("session_date", s.session_date);
    if (qErr) throw new Error(qErr.message);
    const ids = (futures ?? [])
      .filter((r: any) =>
        r.session_date > s.session_date ||
        (r.session_date === s.session_date && String(r.start_time) >= String(s.start_time)),
      )
      .map((r: any) => r.id as string);
    if (ids.length === 0) return { ok: true, deleted: 0 };
    const { error } = await supabase
      .from("class_sessions")
      .delete()
      .in("id", ids)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, deleted: ids.length };
  });

/** Exclui a turma inteira (e, por cascade, todas as sessões e check-ins). */
export const deleteClassAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { classId: string }) => {
    if (!input.classId) throw new Error("classId requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("classes")
      .delete()
      .eq("id", data.classId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Atualiza os campos editáveis de UMA sessão (override individual). */
export const updateClassSessionOverrides = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      sessionId: string;
      session_date?: string;
      start_time?: string;
      duration_minutes?: number;
      capacity_override?: number | null;
      notes?: string | null;
      status?: string;
    }) => {
      if (!input.sessionId) throw new Error("sessionId requerido");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSessionOwner(supabase, userId, data.sessionId);
    const patch: any = {};
    if (data.session_date !== undefined) patch.session_date = data.session_date;
    if (data.start_time !== undefined) patch.start_time = data.start_time;
    if (data.duration_minutes !== undefined) patch.duration_minutes = data.duration_minutes;
    if (data.capacity_override !== undefined) patch.capacity_override = data.capacity_override;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.status !== undefined) patch.status = data.status;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase
      .from("class_sessions")
      .update(patch)
      .eq("id", data.sessionId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Aplica overrides à sessão atual e a todas as futuras da mesma turma. */
export const updateClassSessionsFromOverrides = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      sessionId: string;
      start_time?: string;
      duration_minutes?: number;
      capacity_override?: number | null;
      notes?: string | null;
    }) => {
      if (!input.sessionId) throw new Error("sessionId requerido");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const s = await assertSessionOwner(supabase, userId, data.sessionId);
    const patch: any = {};
    if (data.start_time !== undefined) patch.start_time = data.start_time;
    if (data.duration_minutes !== undefined) patch.duration_minutes = data.duration_minutes;
    if (data.capacity_override !== undefined) patch.capacity_override = data.capacity_override;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (Object.keys(patch).length === 0) return { ok: true, updated: 0 };

    if (!s.class_id) {
      const { error } = await supabase
        .from("class_sessions")
        .update(patch)
        .eq("id", s.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { ok: true, updated: 1 };
    }
    const { data: futures, error: qErr } = await supabase
      .from("class_sessions")
      .select("id, session_date, start_time")
      .eq("class_id", s.class_id)
      .eq("user_id", userId)
      .gte("session_date", s.session_date);
    if (qErr) throw new Error(qErr.message);
    const ids = (futures ?? [])
      .filter((r: any) =>
        r.session_date > s.session_date ||
        (r.session_date === s.session_date && String(r.start_time) >= String(s.start_time)),
      )
      .map((r: any) => r.id as string);
    if (ids.length === 0) return { ok: true, updated: 0 };
    const { error } = await supabase
      .from("class_sessions")
      .update(patch)
      .in("id", ids)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, updated: ids.length };
  });
