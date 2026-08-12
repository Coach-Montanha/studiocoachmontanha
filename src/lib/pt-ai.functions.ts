import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  programId: z.string().uuid(),
  prompt: z.string().min(3).max(4000),
});

export type AiExercise = {
  name: string;
  series_type?: string;
  sets_reps?: string;
  load?: string;
  time_seconds?: number;
  inclination?: string;
  pace?: string;
  cadence?: string;
  rest_seconds?: number;
  observations?: string;
};
export type AiTrainingDay = {
  name: string;
  day_label: string;
  description?: string;
  exercises: AiExercise[];
};
export type AiPrescription = { days: AiTrainingDay[]; notes?: string };

export const prescribeTrainingWithAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => InputSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: programRow, error } = await supabase
      .from("pt_programs" as never)
      .select("id,name,category,level,training_type,goals,start_date,end_date")
      .eq("id", data.programId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!programRow) throw new Error("Rotina não encontrada");
    const program = programRow as any;

    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      throw new Error("Configuração do motor Híbrido/KB Fitness ausente (LOVABLE_API_KEY)");
    }


    const system = `Você é um Personal Trainer experiente. Gere uma prescrição de treino em português (Brasil).
Responda APENAS com JSON válido, sem markdown, no formato:
{
  "days": [
    {
      "name": "Treino 1",
      "day_label": "Dia A",
      "description": "Foco muscular / observações gerais",
      "exercises": [
        { 
          "name": "Supino reto", 
          "series_type": "reps_load", 
          "sets_reps": "4x10", 
          "load": "60kg", 
          "rest_seconds": 90, 
          "observations": "Cadência 2:1" 
        }
      ]
    }
  ],
  "notes": "Observações finais do plano"
}
Tipos de série (series_type):
- "reps_load": Repetições e carga (campos: sets_reps, load)
- "reps_load_time": Repetições, carga e tempo (campos: sets_reps, load, time_seconds)
- "sets_time": Séries e tempo (campos: sets_reps, time_seconds)
- "reps_time": Repetições e tempo (campos: sets_reps, time_seconds)
- "time_inclination": Tempo e inclinação (campos: time_seconds, inclination)
- "run": Corrida (campos: load para distância, pace)
- "cadence": Cadência (campo: cadence)
Regras: 4 a 8 exercícios por dia. "day_label" segue o tipo (numérico "Dia 1/2/3..." ou alfabético "Dia A/B/C...").`;

    const user = `Rotina: ${program.name}
Categoria: ${program.category}
Nível: ${program.level}
Tipo de nomenclatura: ${program.training_type}
Período: ${program.start_date}${program.end_date ? ` até ${program.end_date}` : ""}
Objetivos: ${program.goals ?? "(não informado)"}

Instruções do trainer:
${data.prompt}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em alguns instantes.");
    if (res.status === 402) throw new Error("Créditos da IA esgotados. Adicione créditos no workspace.");
    if (!res.ok) throw new Error(`Falha na IA (${res.status})`);
    const json = (await res.json()) as any;
    const content: string = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: AiPrescription;
    try {
      parsed = JSON.parse(content) as AiPrescription;
    } catch {
      throw new Error("Resposta da IA não pôde ser interpretada.");
    }
    if (!Array.isArray(parsed.days)) parsed.days = [];
    return parsed;
  });
