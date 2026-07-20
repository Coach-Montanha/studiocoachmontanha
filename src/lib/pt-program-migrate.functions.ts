import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  programId: z.string().uuid(),
  targetStudentId: z.string().uuid(),
  mode: z.enum(["copy", "move"]),
});

export const migrateProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => InputSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: program, error: progErr } = await supabase
      .from("pt_programs" as never)
      .select("*")
      .eq("id", data.programId)
      .maybeSingle();
    if (progErr) throw new Error(progErr.message);
    if (!program) throw new Error("Rotina não encontrada");
    const p = program as any;
    if (p.user_id !== userId) throw new Error("Sem permissão para esta rotina");

    const { data: target, error: tgtErr } = await supabase
      .from("pt_students" as never)
      .select("id,user_id,name")
      .eq("id", data.targetStudentId)
      .maybeSingle();
    if (tgtErr) throw new Error(tgtErr.message);
    if (!target) throw new Error("Aluno de destino não encontrado");
    const t = target as any;
    if (t.user_id !== userId) throw new Error("Sem permissão para o aluno de destino");

    if (data.mode === "move") {
      if (p.pt_student_id === data.targetStudentId) {
        return { newProgramId: p.id, targetName: t.name };
      }
      const { error } = await supabase
        .from("pt_programs" as never)
        .update({ pt_student_id: data.targetStudentId } as never)
        .eq("id", p.id);
      if (error) throw new Error(error.message);
      return { newProgramId: p.id, targetName: t.name };
    }

    // copy
    const sameStudent = p.pt_student_id === data.targetStudentId;
    const newName = sameStudent ? `${p.name} (cópia)` : p.name;

    const { data: created, error: createErr } = await supabase
      .from("pt_programs" as never)
      .insert({
        user_id: userId,
        pt_student_id: data.targetStudentId,
        name: newName,
        start_date: p.start_date,
        end_date: p.end_date,
        goals: p.goals,
        category: p.category,
        level: p.level,
        training_type: p.training_type,
        show_to_student: p.show_to_student,
        auto_archive: p.auto_archive,
        ai_prompt: p.ai_prompt ?? null,
        ai_generated_at: p.ai_generated_at ?? null,
      } as never)
      .select("id")
      .single();
    if (createErr) throw new Error(createErr.message);
    const newProgramId = (created as any).id as string;

    try {
      const { data: days, error: daysErr } = await supabase
        .from("pt_training_days" as never)
        .select("*")
        .eq("program_id", p.id)
        .order("sort_order", { ascending: true });
      if (daysErr) throw new Error(daysErr.message);

      for (const dRaw of (days as any[]) ?? []) {
        const d = dRaw as any;
        const { data: newDay, error: newDayErr } = await supabase
          .from("pt_training_days" as never)
          .insert({
            user_id: userId,
            program_id: newProgramId,
            name: d.name,
            day_label: d.day_label,
            description: d.description,
            sort_order: d.sort_order,
          } as never)
          .select("id")
          .single();
        if (newDayErr) throw new Error(newDayErr.message);
        const newDayId = (newDay as any).id as string;

        const { data: exercises, error: exErr } = await supabase
          .from("pt_training_exercises" as never)
          .select("*")
          .eq("training_day_id", d.id)
          .order("sort_order", { ascending: true });
        if (exErr) throw new Error(exErr.message);

        const rows = ((exercises as any[]) ?? []).map((eRaw) => {
          const e = eRaw as any;
          return {
            user_id: userId,
            training_day_id: newDayId,
            name: e.name,
            sets_reps: e.sets_reps,
            load: e.load,
            rest_seconds: e.rest_seconds,
            observations: e.observations,
            media_url: e.media_url,
            media_type: e.media_type,
            sort_order: e.sort_order,
          };
        });
        if (rows.length > 0) {
          const { error: insExErr } = await supabase
            .from("pt_training_exercises" as never)
            .insert(rows as never);
          if (insExErr) throw new Error(insExErr.message);
        }
      }

      return { newProgramId, targetName: t.name };
    } catch (e) {
      // rollback: cascade delete cleans training days + exercises
      await supabase.from("pt_programs" as never).delete().eq("id", newProgramId);
      throw e;
    }
  });
