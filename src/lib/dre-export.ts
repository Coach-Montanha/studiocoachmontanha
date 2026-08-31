import { formatBRL } from "@/lib/format";

export type DreRow = {
  month: string;
  label: string;
  studioRev: number;
  ptRev: number;
  totalRev: number;
  fixedExp: number;
  varExp: number;
  totalExp: number;
  profit: number;
  margin: number;
};

/** Exporta o Demonstrativo de Resultado (DRE) para Excel (.xlsx) */
export async function exportDreToExcel(rows: DreRow[], businessName = "Studio Coach Montanha") {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // Cabeçalho institucional
  const data: any[][] = [
    [businessName],
    ["DEMONSTRATIVO DO RESULTADO DO EXERCÍCIO (DRE)"],
    [`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`],
    [], // linha em branco
    [
      "Mês",
      "Receita Studio (R$)",
      "Receita PT (R$)",
      "Total Receitas (R$)",
      "Despesas Fixas (R$)",
      "Despesas Variáveis (R$)",
      "Total Despesas (R$)",
      "Lucro / Prejuízo (R$)",
      "Margem (%)",
    ],
  ];

  let totalStudio = 0;
  let totalPt = 0;
  let totalRev = 0;
  let totalFixed = 0;
  let totalVar = 0;
  let totalExp = 0;
  let totalProfit = 0;

  for (const r of rows) {
    totalStudio += r.studioRev;
    totalPt += r.ptRev;
    totalRev += r.totalRev;
    totalFixed += r.fixedExp;
    totalVar += r.varExp;
    totalExp += r.totalExp;
    totalProfit += r.profit;

    data.push([
      r.label,
      r.studioRev,
      r.ptRev,
      r.totalRev,
      r.fixedExp,
      r.varExp,
      r.totalExp,
      r.profit,
      `${r.margin.toFixed(1)}%`,
    ]);
  }

  // Linha de totais
  const overallMargin = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;
  data.push([]);
  data.push([
    "TOTAL DO PERÍODO",
    totalStudio,
    totalPt,
    totalRev,
    totalFixed,
    totalVar,
    totalExp,
    totalProfit,
    `${overallMargin.toFixed(1)}%`,
  ]);

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Ajuste de largura das colunas
  ws["!cols"] = [
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 22 },
    { wch: 18 },
    { wch: 20 },
    { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "DRE Contábil");

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `DRE_${businessName.replace(/[^\w\-]+/g, "_")}_${today}.xlsx`);
}

/** Exporta o Demonstrativo de Resultado (DRE) para PDF */
export async function exportDreToPdf(rows: DreRow[], businessName = "Studio Coach Montanha") {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;
  let y = margin + 10;

  // Header Banner
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 44, 4, 4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(businessName, margin + 14, y + 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("DEMONSTRATIVO DE RESULTADO DO EXERCÍCIO (DRE)", margin + 14, y + 34);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Emissão: ${new Date().toLocaleDateString("pt-BR")}`, pageWidth - margin - 14, y + 26, { align: "right" });

  y += 56;

  // Calculate Totals
  const totals = rows.reduce(
    (acc, r) => ({
      studioRev: acc.studioRev + r.studioRev,
      ptRev: acc.ptRev + r.ptRev,
      totalRev: acc.totalRev + r.totalRev,
      fixedExp: acc.fixedExp + r.fixedExp,
      varExp: acc.varExp + r.varExp,
      totalExp: acc.totalExp + r.totalExp,
      profit: acc.profit + r.profit,
    }),
    { studioRev: 0, ptRev: 0, totalRev: 0, fixedExp: 0, varExp: 0, totalExp: 0, profit: 0 },
  );

  const overallMargin = totals.totalRev > 0 ? (totals.profit / totals.totalRev) * 100 : 0;

  const tableHead = [
    [
      "Mês",
      "Rec. Studio",
      "Rec. PT",
      "Total Receita",
      "Desp. Fixas",
      "Desp. Variáveis",
      "Total Despesas",
      "Lucro / Prejuízo",
      "Margem",
    ],
  ];

  const tableBody = rows.map((r) => [
    r.label,
    formatBRL(r.studioRev),
    formatBRL(r.ptRev),
    formatBRL(r.totalRev),
    formatBRL(r.fixedExp),
    formatBRL(r.varExp),
    formatBRL(r.totalExp),
    formatBRL(r.profit),
    `${r.margin.toFixed(1)}%`,
  ]);

  const tableFoot = [
    [
      "TOTAL",
      formatBRL(totals.studioRev),
      formatBRL(totals.ptRev),
      formatBRL(totals.totalRev),
      formatBRL(totals.fixedExp),
      formatBRL(totals.varExp),
      formatBRL(totals.totalExp),
      formatBRL(totals.profit),
      `${overallMargin.toFixed(1)}%`,
    ],
  ];

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    foot: tableFoot,
    styles: { fontSize: 8.5, cellPadding: 6 },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [51, 65, 85],
      fontStyle: "bold",
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      fontSize: 9,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 80 },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right", fontStyle: "bold" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right", fontStyle: "bold" },
      7: { halign: "right", fontStyle: "bold" },
      8: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: margin, right: margin },
  });

  const today = new Date().toISOString().slice(0, 10);
  doc.save(`DRE_${businessName.replace(/[^\w\-]+/g, "_")}_${today}.pdf`);
}
