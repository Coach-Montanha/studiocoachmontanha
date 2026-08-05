import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Integração com o projeto "Sistema Híbrido de Treinamento".
 * 
 * Este arquivo foi atualizado para usar uma chave de API direta caso os 
 * segredos de ambiente não estejam disponíveis no Lovable Cloud.
 */

const ExerciseSchema = z
  .object({
    name: z.string().min(1),
    sets: z.union([z.number(), z.string()]).nullish(),
    reps: z.union([z.number(), z.string()]).nullish(),
    load_kg: z.union([z.number(), z.string()]).nullish(),
    load: z.string().nullish(),
    rest_seconds: z.union([z.number(), z.string()]).nullish(),
    rest_sec: z.union([z.number(), z.string()]).nullish(),
    observations: z.string().nullish(),
    notes: z.string().nullish(),
  })
  .transform((e) => ({
    ...e,
    rest_seconds: e.rest_seconds ?? e.rest_sec ?? null,
    observations: e.observations ?? e.notes ?? null,
  }));

const BlockSchema = z.object({
  format: z.string().nullish(),
  title: z.string().nullish(),
  exercises: z.array(ExerciseSchema).default([]),
});

const SessionSchema = z.object({
  title: z.string().nullish(),
  day_number: z.number().nullish(),
  date: z.string().nullish(),
  blocks: z.array(BlockSchema).default([]),
});

const WeekSchema = z
  .object({
    number: z.number().nullish(),
    week_number: z.number().nullish(),
    sessions: z.array(SessionSchema).default([]),
  })
  .transform((w) => ({ ...w, number: w.number ?? w.week_number ?? null }));


export const HybridProgramSchema = z.object({
  id: z.string().nullish(),
  title: z.string().min(1),
  methodology: z.string().nullish(),
  start_date: z.string().nullish(),
  weeks: z.array(WeekSchema).nullish(),
  sessions: z.array(SessionSchema).nullish(),
});

export type HybridProgram = z.infer<typeof HybridProgramSchema>;

export type HybridProgramSummary = {
  id: string;
  title: string;
  methodology?: string | null;
  start_date?: string | null;
  weeks_count?: number | null;
  sessions_count?: number | null;
};

function originConfig() {
  const url = (process.env.HYBRID_API_URL || "https://sistemahibridodetreinamento.lovable.app").replace(/\/+$/, "");
  const token = process.env.HYBRID_API_TOKEN || "chm_sk_64f944daa5b3154fbe821e56e1d16e7ccb0afd6a7c753432451022b948974fe1"; // Chave validada para integração
  return { url, token, configured: Boolean(url && token) };
}

async function originFetch(path: string) {
  const { url, token } = originConfig();
  const res = await fetch(`${url}${path}`, {
    headers: {
      "x-api-key": token ?? "",
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(
      res.status === 401 || res.status === 403
        ? "Token de integração recusado pela origem."
        : res.status === 404
          ? "Endpoint não encontrado na origem (a API pública ainda não foi criada lá)."
          : `Origem respondeu ${res.status}.`,
    );
  }
  return res.json();
}

/** Diz à UI se a conexão com a origem está configurada. */
export const getHybridStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { url, configured } = originConfig();
    return { configured, url: url ?? null };
  });

/** Lista os programas disponíveis na origem. */
export const listHybridPrograms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ ok: boolean; error?: string; programs: HybridProgramSummary[] }> => {
    if (!originConfig().configured)
      return { ok: false, error: "not_configured", programs: [] };
    try {
      const json = (await originFetch("/api/public/programs")) as any;
      const raw = Array.isArray(json) ? json : (json?.data ?? json?.programs ?? []);
      const programs: HybridProgramSummary[] = raw.map((p: any) => ({
        id: String(p.id),
        title: p.title ?? p.titulo ?? "Programa sem título",
        methodology: p.methodology ?? p.metodologia ?? null,
        start_date: p.start_date ?? p.data_inicio ?? null,
        weeks_count: p.weeks_count ?? p.duracao_semanas ?? null,
        sessions_count: p.sessions_count ?? null,
      }));
      return { ok: true, programs };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "Falha ao consultar a origem", programs: [] };
    }
  });

/** Busca um programa completo na origem, já normalizado. */
export const fetchHybridProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().min(1) }).parse(raw))
  .handler(async ({ data }) => {
    if (!originConfig().configured) throw new Error("Integração não configurada");
    const json = await originFetch(`/api/public/programs/${encodeURIComponent(data.id)}`);
    const payload = (json as any)?.data ?? (json as any)?.program ?? json;
    return HybridProgramSchema.parse(payload);
  });

/* ------------------------------ normalização ----------------------------- */

type FlatExercise = {
  name: string;
  sets_reps: string | null;
  load: string | null;
  rest_seconds: string | null;
  observations: string | null;
};

type FlatDay = { name: string; day_label: string; description: string | null; exercises: FlatExercise[] };

function str(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}

export function flattenHybridProgram(program: HybridProgram): FlatDay[] {
  const days: FlatDay[] = [];
  const weeks = program.weeks?.length
    ? program.weeks
    : [{ number: 1, sessions: program.sessions ?? [] }];

  weeks.forEach((week, wi) => {
    const weekNumber = week.number ?? wi + 1;
    week.sessions.forEach((session, si) => {
      const dayNumber = session.day_number ?? si + 1;
      const exercises: FlatExercise[] = [];
      session.blocks.forEach((block) => {
        block.exercises.forEach((ex) => {
          const sets = str(ex.sets);
          const reps = str(ex.reps);
          const setsReps = sets && reps ? `${sets}x${reps}` : (reps ?? sets);
          const blockTag = block.title ?? block.format ?? null;
          const obs = [blockTag ? `[${blockTag}]` : null, str(ex.observations)]
            .filter(Boolean)
            .join(" ");
          exercises.push({
            name: ex.name,
            sets_reps: setsReps,
            load: ex.load ?? (ex.load_kg != null ? `${ex.load_kg} kg` : null),
            rest_seconds: str(ex.rest_seconds),
            observations: obs || null,
          });
        });
      });
      days.push({
        name: session.title ?? `Semana ${weekNumber} · Dia ${dayNumber}`,
        day_label: `S${weekNumber}D${dayNumber}`,
        description: session.date ?? null,
        exercises,
      });
    });
  });

  return days;
}

/* -------------------------------- import --------------------------------- */

const ImportInput = z.object({
  ptStudentId: z.string().uuid(),
  programId: z.string().min(1).optional(),
  program: HybridProgramSchema.optional(),
  showToStudent: z.boolean().default(true),
});

export const importHybridProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const parsed = ImportInput.parse(raw);
    if (!parsed.programId && !parsed.program)
      throw new Error("Informe um programa da origem ou cole o JSON");
    return parsed;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: student, error: stErr } = await supabase
      .from("pt_students")
      .select("id,user_id,name")
      .eq("id", data.ptStudentId)
      .maybeSingle();
    if (stErr) throw new Error(stErr.message);
    if (!student) throw new Error("Aluno PT não encontrado");
    if ((student as any).user_id !== userId) throw new Error("Sem permissão para este aluno");

    const program: HybridProgram = data.program
      ? HybridProgramSchema.parse(data.program)
      : HybridProgramSchema.parse(
          (await originFetch(`/api/public/programs/${encodeURIComponent(data.programId!)}`)) as any,
        );

    const days = flattenHybridProgram(program);
    if (days.length === 0) throw new Error("O programa não contém sessões de treino");

    const startDate =
      program.start_date && /^\d{4}-\d{2}-\d{2}$/.test(program.start_date)
        ? program.start_date
        : new Date().toISOString().slice(0, 10);

    const { data: created, error: cErr } = await supabase
      .from("pt_programs")
      .insert({
        user_id: userId,
        pt_student_id: data.ptStudentId,
        name: program.title,
        start_date: startDate,
        goals: program.methodology ? `Importado do Sistema Híbrido · ${program.methodology}` : null,
        show_to_student: data.showToStudent,
      } as never)
      .select("id")
      .single();
    if (cErr) throw new Error(`Falha ao criar programa: ${cErr.message}`);
    const newProgramId = (created as any).id as string;

    try {
      for (const [i, day] of days.entries()) {
        const { data: newDay, error: dErr } = await supabase
          .from("pt_training_days")
          .insert({
            user_id: userId,
            program_id: newProgramId,
            name: day.name,
            day_label: day.day_label,
            description: day.description,
            sort_order: i,
          } as never)
          .select("id")
          .single();
        if (dErr) throw new Error(dErr.message);
        const dayId = (newDay as any).id as string;

        if (day.exercises.length > 0) {
          const rows = day.exercises.map((ex, j) => ({
            user_id: userId,
            training_day_id: dayId,
            name: ex.name,
            sets_reps: ex.sets_reps,
            load: ex.load,
            rest_seconds: ex.rest_seconds,
            observations: ex.observations,
            sort_order: j,
          }));
          const { error: exErr } = await supabase
            .from("pt_training_exercises")
            .insert(rows as never);
          if (exErr) throw new Error(exErr.message);
        }
      }
    } catch (e) {
      await supabase.from("pt_programs").delete().eq("id", newProgramId);
      throw e;
    }

    return {
      programId: newProgramId,
      studentName: (student as any).name as string,
      days: days.length,
      exercises: days.reduce((s, d) => s + d.exercises.length, 0),
    };
  });