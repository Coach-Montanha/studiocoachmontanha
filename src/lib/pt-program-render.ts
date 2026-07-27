import { supabase } from "@/integrations/supabase/client";
import { formatDateBR } from "@/lib/format";
import { ASPECTS, type LayoutBlock, type ProgramLayout } from "@/lib/pt-program-layout";

const CATEGORY_LABELS: Record<string, string> = {
  hypertrophy: "Hipertrofia",
  conditioning: "Condicionamento",
  strength: "Força",
  cardio: "Cardio",
  general: "Geral",
};
const LEVEL_LABELS: Record<string, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

export type RenderExercise = {
  name: string;
  sets_reps: string | null;
  load: string | null;
  rest_seconds: string | null;
};
export type RenderDay = {
  id: string;
  name: string;
  day_label: string;
  description: string | null;
  exercises: RenderExercise[];
};
export type ProgramRenderData = {
  program: {
    id: string;
    name: string;
    start_date: string;
    end_date: string | null;
    goals: string | null;
    category: string;
    level: string;
  };
  studentName?: string;
  days: RenderDay[];
};

export async function fetchProgramRenderData(
  programId: string,
  studentName?: string,
): Promise<ProgramRenderData> {
  const { data: program } = await supabase
    .from("pt_programs" as never)
    .select("*")
    .eq("id", programId)
    .maybeSingle();
  if (!program) throw new Error("Rotina não encontrada");

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

  return {
    program: program as any,
    studentName,
    days: (days as any[]).map((d) => ({
      id: d.id,
      name: d.name,
      day_label: d.day_label,
      description: d.description ?? null,
      exercises: (exercises as any[])
        .filter((e) => e.training_day_id === d.id)
        .map((e) => ({
          name: e.name ?? "",
          sets_reps: e.sets_reps ?? null,
          load: e.load ?? null,
          rest_seconds: e.rest_seconds ?? null,
        })),
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Tema — lê os tokens do design system para a peça acompanhar o app.   */
/* ------------------------------------------------------------------ */

export type RenderTheme = {
  background: string;
  card: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  border: string;
};

function token(styles: CSSStyleDeclaration, name: string, fallback: string) {
  const v = styles.getPropertyValue(name).trim();
  return v || fallback;
}

export function readThemeColors(): RenderTheme {
  if (typeof window === "undefined") {
    return {
      background: "#ffffff",
      card: "#ffffff",
      foreground: "#18181b",
      muted: "#f4f4f5",
      mutedForeground: "#71717a",
      primary: "#2563eb",
      primaryForeground: "#ffffff",
      border: "#e4e4e7",
    };
  }
  const s = getComputedStyle(document.documentElement);
  return {
    background: token(s, "--background", "#ffffff"),
    card: token(s, "--card", "#ffffff"),
    foreground: token(s, "--foreground", "#18181b"),
    muted: token(s, "--muted", "#f4f4f5"),
    mutedForeground: token(s, "--muted-foreground", "#71717a"),
    primary: token(s, "--primary", "#2563eb"),
    primaryForeground: token(s, "--primary-foreground", "#ffffff"),
    border: token(s, "--border", "#e4e4e7"),
  };
}

/* ------------------------------------------------------------------ */
/* Renderização                                                        */
/* ------------------------------------------------------------------ */

const FONT = (weight: number, size: number) =>
  `${weight} ${size}px Inter, ui-sans-serif, system-ui, sans-serif`;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

/** Desenha linhas dentro do bloco; devolve true se o conteúdo coube inteiro. */
function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  maxW: number,
  bottom: number,
  lineHeight: number,
) {
  let cy = y;
  for (let i = 0; i < lines.length; i++) {
    if (cy + lineHeight > bottom) {
      // ainda há conteúdo: aplica reticências na última linha desenhada
      return { y: cy, overflow: true };
    }
    ctx.fillText(ellipsize(ctx, lines[i], maxW), x, cy + lineHeight * 0.78);
    cy += lineHeight;
  }
  return { y: cy, overflow: false };
}

export type BlockOverflow = Record<string, boolean>;

export function renderProgramLayout(
  canvas: HTMLCanvasElement,
  data: ProgramRenderData,
  layout: ProgramLayout,
  theme: RenderTheme,
  width = 1080,
): BlockOverflow {
  const spec = ASPECTS[layout.aspect];
  const height = Math.round(width / spec.ratio);
  const dpr = 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return {};
  ctx.scale(dpr, dpr);
  ctx.textBaseline = "alphabetic";

  const pad = Math.round(width * 0.035);
  const gap = Math.round(width * 0.014);
  const cellW = (width - pad * 2 - gap * (spec.cols - 1)) / spec.cols;
  const cellH = (height - pad * 2 - gap * (spec.rows - 1)) / spec.rows;

  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);

  const overflow: BlockOverflow = {};

  for (const block of layout.blocks) {
    const x = pad + block.x * (cellW + gap);
    const y = pad + block.y * (cellH + gap);
    const w = block.w * cellW + (block.w - 1) * gap;
    const h = block.h * cellH + (block.h - 1) * gap;
    overflow[block.id] = drawBlock(ctx, block, data, theme, x, y, w, h, width);
  }

  return overflow;
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  block: LayoutBlock,
  data: ProgramRenderData,
  theme: RenderTheme,
  x: number,
  y: number,
  w: number,
  h: number,
  base: number,
): boolean {
  const scale = base / 1080;
  const padX = 26 * scale;
  const padY = 22 * scale;
  const innerW = w - padX * 2;
  const bottom = y + h - padY;
  const isHeader = block.type === "header";

  // superfície
  ctx.save();
  roundRect(ctx, x, y, w, h, 22 * scale);
  ctx.fillStyle = isHeader ? theme.primary : theme.card;
  ctx.fill();
  if (!isHeader) {
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1.5 * scale;
    ctx.stroke();
  }
  ctx.clip();

  const fg = isHeader ? theme.primaryForeground : theme.foreground;
  const dim = isHeader ? theme.primaryForeground : theme.mutedForeground;
  let cy = y + padY;
  let over = false;

  const label = (text: string) => {
    ctx.font = FONT(600, 15 * scale);
    ctx.fillStyle = dim;
    ctx.globalAlpha = isHeader ? 0.82 : 1;
    ctx.fillText(text.toUpperCase(), x + padX, cy + 12 * scale);
    ctx.globalAlpha = 1;
    cy += 26 * scale;
  };

  if (block.type === "header") {
    ctx.font = FONT(800, 52 * scale);
    ctx.fillStyle = fg;
    const lines = wrap(ctx, data.program.name || "Rotina de treino", innerW);
    const r = drawLines(ctx, lines.slice(0, 2), x + padX, cy, innerW, bottom, 58 * scale);
    cy = r.y + 8 * scale;
    over = over || r.overflow || lines.length > 2;
    if (data.studentName) {
      ctx.font = FONT(500, 26 * scale);
      ctx.globalAlpha = 0.85;
      const r2 = drawLines(ctx, [data.studentName], x + padX, cy, innerW, bottom, 34 * scale);
      ctx.globalAlpha = 1;
      over = over || r2.overflow;
    }
  } else if (block.type === "meta") {
    label("Período");
    const period = `${formatDateBR(data.program.start_date)}${
      data.program.end_date ? ` — ${formatDateBR(data.program.end_date)}` : ""
    }`;
    ctx.font = FONT(700, 24 * scale);
    ctx.fillStyle = fg;
    const r = drawLines(ctx, wrap(ctx, period, innerW), x + padX, cy, innerW, bottom, 30 * scale);
    cy = r.y + 6 * scale;
    over = over || r.overflow;
    ctx.font = FONT(500, 21 * scale);
    ctx.fillStyle = dim;
    const meta = `${CATEGORY_LABELS[data.program.category] ?? data.program.category} · ${
      LEVEL_LABELS[data.program.level] ?? data.program.level
    }`;
    const r2 = drawLines(ctx, wrap(ctx, meta, innerW), x + padX, cy, innerW, bottom, 28 * scale);
    over = over || r2.overflow;
  } else if (block.type === "goals") {
    label("Objetivos");
    ctx.font = FONT(500, 22 * scale);
    ctx.fillStyle = fg;
    const text = data.program.goals || "—";
    const r = drawLines(ctx, wrap(ctx, text, innerW), x + padX, cy, innerW, bottom, 30 * scale);
    over = over || r.overflow;
  } else if (block.type === "notes") {
    label("Observações");
    ctx.font = FONT(500, 21 * scale);
    ctx.fillStyle = dim;
    const lineH = 34 * scale;
    let ly = cy + lineH * 0.9;
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1.2 * scale;
    while (ly < bottom) {
      ctx.beginPath();
      ctx.moveTo(x + padX, ly);
      ctx.lineTo(x + w - padX, ly);
      ctx.stroke();
      ly += lineH;
    }
  } else if (block.type === "brand") {
    ctx.font = FONT(600, 20 * scale);
    ctx.fillStyle = dim;
    const text = data.studentName
      ? `${data.program.name} · ${data.studentName}`
      : data.program.name;
    ctx.fillText(ellipsize(ctx, text, innerW), x + padX, y + h / 2 + 7 * scale);
  } else if (block.type === "day") {
    const day = data.days.find((d) => d.id === block.dayId);
    if (!day) {
      ctx.font = FONT(500, 20 * scale);
      ctx.fillStyle = dim;
      ctx.fillText("Treino removido", x + padX, cy + 16 * scale);
    } else {
      // chip do dia
      ctx.font = FONT(700, 17 * scale);
      const chipText = day.day_label.toUpperCase();
      const chipW = ctx.measureText(chipText).width + 22 * scale;
      const chipH = 30 * scale;
      roundRect(ctx, x + padX, cy, chipW, chipH, chipH / 2);
      ctx.fillStyle = theme.primary;
      ctx.fill();
      ctx.fillStyle = theme.primaryForeground;
      ctx.fillText(chipText, x + padX + 11 * scale, cy + chipH * 0.68);

      ctx.font = FONT(700, 27 * scale);
      ctx.fillStyle = fg;
      ctx.fillText(
        ellipsize(ctx, day.name, innerW - chipW - 14 * scale),
        x + padX + chipW + 14 * scale,
        cy + chipH * 0.76,
      );
      cy += chipH + 16 * scale;

      for (const ex of day.exercises) {
        if (cy + 26 * scale > bottom) {
          over = true;
          break;
        }
        ctx.font = FONT(600, 21 * scale);
        ctx.fillStyle = fg;
        const right = [ex.sets_reps, ex.load, ex.rest_seconds ? `${ex.rest_seconds}s` : null]
          .filter(Boolean)
          .join(" · ");
        ctx.font = FONT(500, 19 * scale);
        const rightW = right ? ctx.measureText(right).width + 16 * scale : 0;
        ctx.font = FONT(600, 21 * scale);
        ctx.fillText(ellipsize(ctx, ex.name, innerW - rightW), x + padX, cy + 18 * scale);
        if (right) {
          ctx.font = FONT(500, 19 * scale);
          ctx.fillStyle = dim;
          ctx.textAlign = "right";
          ctx.fillText(right, x + w - padX, cy + 18 * scale);
          ctx.textAlign = "left";
        }
        cy += 30 * scale;
      }
      if (day.exercises.length === 0) {
        ctx.font = FONT(500, 19 * scale);
        ctx.fillStyle = dim;
        ctx.fillText("Sem exercícios", x + padX, cy + 16 * scale);
      }
    }
  }

  ctx.restore();
  return over;
}

/* ------------------------------------------------------------------ */
/* Exportação                                                          */
/* ------------------------------------------------------------------ */

function safeName(name: string) {
  return (name || "rotina").replace(/[^\w\-]+/g, "_");
}

export async function exportLayoutPng(data: ProgramRenderData, layout: ProgramLayout) {
  const canvas = document.createElement("canvas");
  renderProgramLayout(canvas, data, layout, readThemeColors(), 1440);
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName(data.program.name)}.png`;
  a.click();
}

export async function exportLayoutPdf(data: ProgramRenderData, layout: ProgramLayout) {
  const canvas = document.createElement("canvas");
  renderProgramLayout(canvas, data, layout, readThemeColors(), 1600);
  const { jsPDF } = await import("jspdf");
  const ratio = canvas.width / canvas.height;
  const doc = new jsPDF({
    unit: "pt",
    orientation: ratio > 1 ? "landscape" : "portrait",
    format: [595, Math.round(595 / ratio)],
  });
  doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 595, Math.round(595 / ratio));
  doc.save(`${safeName(data.program.name)}-layout.pdf`);
}
