import { supabase } from "@/integrations/supabase/client";

export const DUO_TAG_REGEX = /\[DUO_PARTNER:([a-f0-9-]+)\]/i;

/**
 * Extrai o ID do parceiro de treino e retorna as notas limpas sem a tag técnica.
 */
export function parseStudentPartner(notes?: string | null): {
  cleanNotes: string;
  partnerId: string | null;
} {
  if (!notes) return { cleanNotes: "", partnerId: null };
  const match = notes.match(DUO_TAG_REGEX);
  const partnerId = match ? match[1] : null;
  const cleanNotes = notes.replace(/\[DUO_PARTNER:[a-f0-9-]+\]\r?\n?/gi, "").trim();
  return { cleanNotes, partnerId };
}

/**
 * Constrói o texto de notas preservando a tag de parceiro de treino.
 */
export function buildStudentPartnerNotes(
  cleanNotes?: string | null,
  partnerId?: string | null,
): string {
  const base = (cleanNotes ?? "").trim();
  if (!partnerId) return base;
  return base ? `${base}\n[DUO_PARTNER:${partnerId}]` : `[DUO_PARTNER:${partnerId}]`;
}

/**
 * Garante a sincronização bidirecional entre dois alunos parceiros de treino.
 * Ao vincular o Aluno A ao Aluno B, o Aluno B também recebe o vínculo com o Aluno A.
 * Se o vínculo for alterado ou removido, o antigo parceiro é desvinculado.
 */
export async function syncDuoPartners(
  studentAId: string,
  oldPartnerId: string | null,
  newPartnerId: string | null,
): Promise<void> {
  if (oldPartnerId === newPartnerId) return;

  // 1. Se havia um parceiro antigo diferente do novo, remove a tag do antigo
  if (oldPartnerId && oldPartnerId !== newPartnerId) {
    try {
      const { data: oldStudent } = await supabase
        .from("pt_students")
        .select("notes")
        .eq("id", oldPartnerId)
        .single();

      if (oldStudent) {
        const { cleanNotes, partnerId } = parseStudentPartner(oldStudent.notes);
        if (partnerId === studentAId) {
          await supabase
            .from("pt_students")
            .update({ notes: cleanNotes || null })
            .eq("id", oldPartnerId);
        }
      }
    } catch (e) {
      console.error("Erro ao desvincular antigo parceiro:", e);
    }
  }

  // 2. Se há um novo parceiro, vincula-o reciprocamente ao Aluno A
  if (newPartnerId) {
    try {
      const { data: newStudent } = await supabase
        .from("pt_students")
        .select("notes")
        .eq("id", newPartnerId)
        .single();

      if (newStudent) {
        const { cleanNotes } = parseStudentPartner(newStudent.notes);
        const updatedNotes = buildStudentPartnerNotes(cleanNotes, studentAId);
        await supabase
          .from("pt_students")
          .update({ notes: updatedNotes })
          .eq("id", newPartnerId);
      }
    } catch (e) {
      console.error("Erro ao vincular novo parceiro:", e);
    }
  }
}
