import { formatBRL, formatDateBR, formatMonthLabel, paymentMethodLabel } from "@/lib/format";

export type ReceiptData = {
  receiptId: string;
  studentName: string;
  studentEmail?: string | null;
  studentPhone?: string | null;
  studentCpf?: string | null;
  amount: number;
  paymentDate: string;
  dueDate?: string | null;
  referenceMonth?: string | null;
  paymentMethod: string;
  planName?: string | null;
  notes?: string | null;
  businessName?: string;
  kind?: "studio" | "pt";
};

export async function downloadReceiptPdf(data: ReceiptData) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  // Background frame / border
  doc.setDrawColor(220, 225, 230);
  doc.setLineWidth(1);
  doc.roundedRect(margin - 10, margin - 10, contentWidth + 20, pageHeight - margin * 2 + 20, 8, 8);

  let y = margin + 15;

  // Header Banner
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.roundedRect(margin, y, contentWidth, 54, 6, 6, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(data.businessName || "STUDIO COACH MONTANHA", margin + 18, y + 26);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("GESTÃO FINANCEIRA E TREINAMENTO", margin + 18, y + 42);

  // Receipt Number & Badge
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("RECIBO", pageWidth - margin - 18, y + 26, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Nº #${data.receiptId.slice(0, 8).toUpperCase()}`, pageWidth - margin - 18, y + 42, { align: "right" });

  y += 75;

  // Status Stamp: QUITADO
  doc.setDrawColor(22, 163, 74); // Green-600
  doc.setFillColor(240, 253, 244); // Green-50
  doc.roundedRect(margin, y, contentWidth, 34, 4, 4, "FD");
  doc.setTextColor(21, 128, 61); // Green-700
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("✓  PAGAMENTO CONFIRMADO / QUITADO", margin + 14, y + 21);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Data do pagamento: ${formatDateBR(data.paymentDate)}`, pageWidth - margin - 14, y + 21, { align: "right" });

  y += 50;

  // Payer Information Section
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("DADOS DO PAGADOR", margin, y);
  y += 8;

  const payerRows = [
    ["Nome do Aluno:", data.studentName, "Tipo:", data.kind === "pt" ? "Personal Trainer" : "Studio"],
    ["CPF:", data.studentCpf || "Não informado", "Telefone:", data.studentPhone || "Não informado"],
    ["E-mail:", data.studentEmail || "Não informado", "Data Emissão:", formatDateBR(new Date().toISOString().slice(0, 10))],
  ];

  autoTable(doc, {
    startY: y,
    theme: "plain",
    body: payerRows,
    styles: { fontSize: 9.5, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", textColor: [100, 116, 139], cellWidth: 90 },
      1: { fontStyle: "normal", textColor: [15, 23, 42], cellWidth: 160 },
      2: { fontStyle: "bold", textColor: [100, 116, 139], cellWidth: 80 },
      3: { fontStyle: "normal", textColor: [15, 23, 42] },
    },
    margin: { left: margin, right: margin },
  });

  const anyDoc = doc as unknown as { lastAutoTable?: { finalY: number } };
  y = (anyDoc.lastAutoTable?.finalY ?? y) + 20;

  // Payment Breakdown Table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text("DISCRIMINAÇÃO DO PAGAMENTO", margin, y);
  y += 8;

  const description = data.planName
    ? `Mensalidade / Plano: ${data.planName}`
    : data.kind === "pt"
    ? "Sessões / Treinamento Personal Trainer"
    : "Mensalidade Studio";

  autoTable(doc, {
    startY: y,
    head: [["Item / Descrição", "Ref.", "Forma de Pagamento", "Valor"]],
    body: [
      [
        description,
        data.referenceMonth ? formatMonthLabel(data.referenceMonth) : "—",
        paymentMethodLabel(data.paymentMethod),
        formatBRL(data.amount),
      ],
    ],
    foot: [
      ["TOTAL RECEBIDO", "", "", formatBRL(data.amount)],
    ],
    styles: { fontSize: 9.5, cellPadding: 8 },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [51, 65, 85],
      fontStyle: "bold",
    },
    footStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      fontSize: 10.5,
    },
    columnStyles: {
      0: { cellWidth: 230 },
      1: { cellWidth: 90 },
      2: { cellWidth: 110 },
      3: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: margin, right: margin },
  });

  y = (anyDoc.lastAutoTable?.finalY ?? y) + 24;

  // Notes if available
  if (data.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Observações:", margin, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const wrapped = doc.splitTextToSize(data.notes, contentWidth);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 11 + 16;
  }

  // Legal Declaration
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentWidth, 48, 4, 4, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const declarationText = `Declaramos para os devidos fins que recebemos de ${data.studentName} a importância de ${formatBRL(data.amount)} (${paymentMethodLabel(data.paymentMethod)}), referente aos serviços descritos acima, dando plena e geral quitação.`;
  const splitDec = doc.splitTextToSize(declarationText, contentWidth - 20);
  doc.text(splitDec, margin + 10, y + 16);

  y += 90;

  // Signature Block
  const sigWidth = 200;
  const sigX = pageWidth / 2 - sigWidth / 2;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.8);
  doc.line(sigX, y, sigX + sigWidth, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(data.businessName || "Studio Coach Montanha", pageWidth / 2, y + 14, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Assinatura do Responsável", pageWidth / 2, y + 26, { align: "center" });

  // Download filename
  const cleanName = data.studentName.replace(/[^\w\-]+/g, "_");
  const monthTag = data.referenceMonth ? `_${data.referenceMonth}` : "";
  const filename = `Recibo_${cleanName}${monthTag}.pdf`;

  doc.save(filename);
}
