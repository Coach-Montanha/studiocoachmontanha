import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Expande uma turma recorrente em ocorrências (class_sessions)
 * para as próximas N semanas.
 */
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
      .select("id, user_id, day_of_week, start_time, duration_minutes, is_recurring, is_active")
      .eq("id", data.classId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cls) throw new Error("Turma não encontrada");
    if (cls.user_id !== userId) throw new Error("Sem permissão");
    if (!cls.is_recurring || cls.day_of_week === null) {
      throw new Error("Turma não é recorrente");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDow = cls.day_of_week; // 0=Dom
    const currentDow = today.getDay();
    let diff = (targetDow - currentDow + 7) % 7;
    if (diff === 0) diff = 0; // include today

    const rows: Array<{
      user_id: string;
      class_id: string;
      session_date: string;
      start_time: string;
      duration_minutes: number;
    }> = [];

    for (let w = 0; w < data.weeks; w++) {
      const d = new Date(today);
      d.setDate(today.getDate() + diff + w * 7);
      rows.push({
        user_id: userId,
        class_id: cls.id,
        session_date: d.toISOString().slice(0, 10),
        start_time: cls.start_time,
        duration_minutes: cls.duration_minutes,
      });
    }

    // Skip existing dates
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
