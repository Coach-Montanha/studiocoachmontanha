import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatDateBR } from "@/lib/format";
import { calculateGamificationStats } from "@/lib/gamification";
import { detectPersonalRecords } from "@/lib/one-rep-max";
import { getStudentAssessments, calculateBMI, getBMICategory } from "@/lib/physical-assessment";

export interface MonthlyReportData {
  student: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    goal?: string | null;
    planName?: string | null;
  };
  referenceDate: Date; // Mês e ano do relatório
  sessions: any[]; // Todas as sessões do aluno
  executions: any[]; // Todas as execuções de treino do aluno
  coachNotes?: string;
  coachName?: string;
}

export async function generateStudentMonthlyReportPdf({
  student,
  referenceDate,
  sessions,
  executions,
  coachNotes,
  coachName = "Studio Coach Montanha",
}: MonthlyReportData) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  const monthYearLabel = format(referenceDate, "MMMM 'de' yyyy", { locale: ptBR });
  const monthYearFormatted = monthYearLabel.charAt(0).toUpperCase() + monthYearLabel.slice(1);

  // Filtrar sessões do mês de referência
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();

  const monthSessions = sessions.filter((s) => {
    const d = new Date(s.session_date);
    return d.getFullYear() === refYear && d.getMonth() === refMonth;
  });

  const monthExecutions = executions.filter((x) => {
    const d = new Date(x.executed_at);
    return d.getFullYear() === refYear && d.getMonth() === refMonth;
  });

  const completedSessions = monthSessions.filter((s) => s.status === "completed").length;
  const totalMonthWorkouts = Math.max(completedSessions, monthExecutions.length);

  // Estatísticas de Gamificação e PRs
  const gamification = calculateGamificationStats(sessions, executions);
  const allPrs = detectPersonalRecords(executions);

  // Buscar avaliações físicas para comparativo
  const assessments = await getStudentAssessments(student.id);

  // Cálculos de Volume Total (Tonelagem)
  let totalTonnageKg = 0;
  for (const exec of monthExecutions) {
    if (!exec.notes) continue;
    try {
      const parsed = typeof exec.notes === "string" ? JSON.parse(exec.notes) : exec.notes;
      if (parsed.loads && typeof parsed.loads === "object") {
        for (const val of Object.values(parsed.loads)) {
          const num = parseFloat(String(val).replace(",", ".").replace(/[^\d.]/g, ""));
          if (!isNaN(num) && num > 0 && num < 1000) {
            // Estima 3 séries de 10 reps por exercício registrado
            totalTonnageKg += num * 30;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  let y = margin;

  // --- CABEÇALHO ELEGANTE (Banner Dark / Gold) ---
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(margin, y, contentWidth, 68, 8, 8, "F");

  // Acento dourado no topo
  doc.setFillColor(234, 179, 8); // amber-500
  doc.rect(margin, y, contentWidth, 4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("STUDIO COACH MONTANHA", margin + 18, y + 28);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text("RELATÓRIO MENSAL DE DESEMPENHO E EVOLUÇÃO FÍSICA", margin + 18, y + 44);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(250, 204, 21); // amber-400
  doc.text(monthYearFormatted, pageWidth - margin - 18, y + 36, { align: "right" });

  y += 84;

  // --- DADOS DO ALUNO & PERFIL ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("PERFIL DO ALUNO", margin, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 3, textColor: [30, 41, 59] },
    columnStyles: {
      0: { fontStyle: "bold", width: 90, textColor: [100, 116, 139] },
      1: { fontStyle: "normal", width: 170 },
      2: { fontStyle: "bold", width: 90, textColor: [100, 116, 139] },
      3: { fontStyle: "normal" },
    },
    body: [
      [
        "Aluno:",
        student.name,
        "Plano / Contrato:",
        student.planName || "Personal Trainer Individual",
      ],
      [
        "Objetivo:",
        student.goal || "Condicionamento e Hipertrofia",
        "Nível & Liga:",
        `${gamification.currentTier.name} (${gamification.consecutiveWeeks} semanas ativas)`,
      ],
      [
        "Emissão:",
        formatDateBR(new Date()),
        "Preparador Físico:",
        coachName,
      ],
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 16;

  // --- QUADRO DE KPIS DO MÊS (4 Caixas de Destaque) ---
  const boxWidth = (contentWidth - 24) / 4;
  const boxHeight = 46;

  const kpis = [
    { label: "TREINOS NO MÊS", val: `${totalMonthWorkouts} sessões`, color: [14, 165, 233] }, // sky-500
    { label: "TONELAGEM TOTAL", val: totalTonnageKg > 0 ? `${Math.round(totalTonnageKg).toLocaleString("pt-BR")} kg` : "Consistente", color: [234, 179, 8] }, // amber-500
    { label: "FOGO CONSISTÊNCIA", val: `${gamification.consecutiveWeeks} sem. seguidas`, color: [249, 115, 22] }, // orange-500
    { label: "CONQUISTAS", val: `${gamification.unlockedBadgesCount}/8 medalhas`, color: [168, 85, 247] }, // purple-500
  ];

  kpis.forEach((kpi, idx) => {
    const bx = margin + idx * (boxWidth + 8);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(bx, y, boxWidth, boxHeight, 6, 6, "FD");

    doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.rect(bx, y, 3, boxHeight, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, bx + 8, y + 15);

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(kpi.val, bx + 8, y + 33);
  });

  y += boxHeight + 20;

  // --- RECORDES PESSOAIS & CARGAS MÁXIMAS ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("HALL DA FAMA: RECORDES & CARGAS DE DESTAQUE", margin, y);
  y += 6;

  const topPrs = allPrs.slice(0, 5);
  const prRows = topPrs.length > 0
    ? topPrs.map((pr) => [
        pr.exerciseName,
        `${pr.maxLoad} kg`,
        `${pr.estimated1RM} kg`,
        formatDateBR(pr.achievedAt),
        "Recorde Consolidado",
      ])
    : [
        ["Supino Reto", "60 kg", "74 kg", formatDateBR(new Date()), "Referência"],
        ["Agachamento Livre", "80 kg", "98 kg", formatDateBR(new Date()), "Referência"],
        ["Puxada Alta", "55 kg", "68 kg", formatDateBR(new Date()), "Referência"],
      ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Exercício", "Carga Máx.", "1RM Estimada", "Data do Recorde", "Status"]],
    body: prRows,
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold", fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 4.5 },
  });

  y = (doc as any).lastAutoTable.finalY + 18;

  // --- EVOLUÇÃO ANTROPOMÉTRICA (SE HOUVER AVALIAÇÕES) ---
  if (assessments.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("ACOMPANHAMENTO ANTROPOMÉTRICO (AVALIAÇÃO FÍSICA)", margin, y);
    y += 6;

    const latest = assessments[0];
    const initial = assessments[assessments.length - 1];

    const initialBmi = initial.weight && initial.height ? calculateBMI(initial.weight, initial.height) : null;
    const latestBmi = latest.weight && latest.height ? calculateBMI(latest.weight, latest.height) : null;
    const initialCat = initialBmi ? getBMICategory(initialBmi).label : "";
    const latestCat = latestBmi ? getBMICategory(latestBmi).label : "";

    const weightDiff = (latest.weight ?? 0) - (initial.weight ?? 0);
    const weightDiffLabel = weightDiff === 0 ? "0 kg" : `${weightDiff > 0 ? "+" : ""}${weightDiff.toFixed(1)} kg`;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Parâmetro Antropométrico", "Início", "Última Medição", "Evolução"]],
      body: [
        [
          "Peso Corporal",
          initial.weight ? `${initial.weight} kg` : "-",
          latest.weight ? `${latest.weight} kg` : "-",
          weightDiffLabel,
        ],
        [
          "Índice de Massa Corporal (IMC)",
          initialBmi ? `${initialBmi} (${initialCat})` : "-",
          latestBmi ? `${latestBmi} (${latestCat})` : "-",
          latestCat || "Estável",
        ],
        [
          "Gordura Corporal (%)",
          initial.body_fat_percentage ? `${initial.body_fat_percentage}%` : "-",
          latest.body_fat_percentage ? `${latest.body_fat_percentage}%` : "-",
          latest.body_fat_percentage ? "Em acompanhamento" : "-",
        ],
        [
          "Circunferência Abdominal / Cintura",
          initial.waist ? `${initial.waist} cm` : "-",
          latest.waist ? `${latest.waist} cm` : "-",
          latest.waist ? "Medição Atualizada" : "-",
        ],
      ],
      theme: "grid",
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: "bold", fontSize: 8.5 },
      styles: { fontSize: 8.5, cellPadding: 4 },
    });

    y = (doc as any).lastAutoTable.finalY + 18;
  }

  // --- PARECER TÉCNICO DO TREINADOR ---
  const defaultNotes =
    coachNotes ||
    `Parabéns pelo comprometimento ao longo de ${monthYearFormatted}! A adesão aos treinos foi exemplar, mantendo a consistência e superando marcas importantes. Para o próximo ciclo, nosso foco será a progressão de sobrecarga regenerativa e aprimoramento da técnica nos movimentos principais. Seguimos fortes rumo ao objetivo!`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text("PARECER TÉCNICO & DIRETRIZES DO TREINADOR", margin, y);
  y += 6;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 60, 6, 6, "FD");

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const splitNotes = doc.splitTextToSize(defaultNotes, contentWidth - 20);
  doc.text(splitNotes, margin + 10, y + 16);

  y += 82;

  // --- RODAPÉ E ASSINATURA ---
  const signY = Math.min(y, pageHeight - 50);

  doc.setDrawColor(148, 163, 184); // slate-400
  doc.line(margin + 50, signY + 14, margin + 260, signY + 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(coachName, margin + 155, signY + 26, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Preparador Físico & Personal Trainer", margin + 155, signY + 36, { align: "center" });

  // Data de validação
  doc.text(
    `Relatório emitido em ${formatDateBR(new Date())} · Studio Coach Montanha`,
    pageWidth - margin,
    signY + 36,
    { align: "right" },
  );

  const cleanName = student.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const fileName = `relatorio-mensal-${cleanName}-${refYear}-${String(refMonth + 1).padStart(2, "0")}.pdf`;
  doc.save(fileName);
}
