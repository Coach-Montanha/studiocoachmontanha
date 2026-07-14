// jsPDF e jspdf-autotable são carregados dinamicamente dentro de downloadProgramPdf
// para não pesarem no bundle inicial.
import { supabase } from "@/integrations/supabase/client";
import { formatDateBR } from "@/lib/format";

const CATEGORY_LABELS: Record<string, string> = {
  hypertrophy: "Hipertrofia",
  conditioning: "Condicionamento físico",
  strength: "Força",
  cardio: "Cardio",
  general: "Geral",
};
const LEVEL_LABELS: Record<string, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

export async function downloadProgramPdf(programId: string, studentName?: string) {
  const { data: program } = await supabase
    .from("pt_programs" as never)
    .select("*")
    .eq("id", programId)
    .maybeSingle();
  if (!program) throw new Error("Rotina não encontrada");
  const p = program as any;

  const { data: days = [] } = await supabase
    .from("pt_training_days" as never)
    .select("*")
    .eq("program_id", programId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const dayIds = (days as any[]).map((d) => d.id);
  const { data: exercises = [] } = dayIds.length
    ? await supabase
        .from("pt_training_exercises" as never)
        .select("*")
        .in("training_day_id", dayIds)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
    : { data: [] as any[] };

  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 48;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(p.name ?? "Rotina de treino", 40, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  if (studentName) {
    doc.text(`Aluno: ${studentName}`, 40, y);
    y += 14;
  }
  const period = `${formatDateBR(p.start_date)}${p.end_date ? ` — ${formatDateBR(p.end_date)}` : ""}`;
  doc.text(`Período: ${period}`, 40, y);
  y += 14;
  doc.text(
    `Categoria: ${CATEGORY_LABELS[p.category] ?? p.category} · Nível: ${LEVEL_LABELS[p.level] ?? p.level}`,
    40,
    y,
  );
  y += 16;
  doc.setTextColor(0);

  if (p.goals) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Objetivos", 40, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const wrapped = doc.splitTextToSize(p.goals, pageWidth - 80);
    doc.text(wrapped, 40, y);
    y += wrapped.length * 12 + 8;
  }

  (days as any[]).forEach((d) => {
    if (y > 720) {
      doc.addPage();
      y = 48;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`${d.name}  •  ${d.day_label}`, 40, y);
    y += 14;
    if (d.description) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(90);
      const wrapped = doc.splitTextToSize(d.description, pageWidth - 80);
      doc.text(wrapped, 40, y);
      y += wrapped.length * 11 + 4;
      doc.setTextColor(0);
    }

    const dayExercises = (exercises as any[]).filter((e) => e.training_day_id === d.id);
    if (dayExercises.length > 0) {
      autoTable(doc, {
        startY: y + 2,
        head: [["Exercício", "Séries x Reps", "Carga", "Descanso", "Observações"]],
        body: dayExercises.map((ex) => [
          ex.name ?? "",
          ex.sets_reps ?? "",
          ex.load ?? "",
          ex.rest_seconds ? `${ex.rest_seconds}s` : "",
          ex.observations ?? "",
        ]),
        styles: { fontSize: 9, cellPadding: 5 },
        headStyles: { fillColor: [30, 30, 30] },
        margin: { left: 40, right: 40 },
      });
      const anyDoc = doc as unknown as { lastAutoTable?: { finalY: number } };
      y = (anyDoc.lastAutoTable?.finalY ?? y) + 16;
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text("Nenhum exercício adicionado.", 40, y);
      doc.setTextColor(0);
      y += 18;
    }
  });

  const filename = `${(p.name ?? "rotina").replace(/[^\w\-]+/g, "_")}.pdf`;
  doc.save(filename);
}
