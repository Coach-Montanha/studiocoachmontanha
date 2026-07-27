/**
 * Modelo de layout da peça (imagem/PDF) gerada para um programa de treino.
 * Cada bloco ocupa um retângulo em uma grade de 12 colunas x N linhas.
 * Persistido por programa em localStorage — sem alterações de banco.
 */

export type AspectKey = "1:1" | "4:5" | "9:16" | "a4";

export const ASPECTS: Record<
  AspectKey,
  { label: string; hint: string; ratio: number; cols: number; rows: number }
> = {
  "1:1": { label: "Quadrado", hint: "1:1 · feed", ratio: 1, cols: 12, rows: 12 },
  "4:5": { label: "Retrato", hint: "4:5 · post", ratio: 4 / 5, cols: 12, rows: 15 },
  "9:16": { label: "Story", hint: "9:16 · stories", ratio: 9 / 16, cols: 12, rows: 21 },
  a4: { label: "Ficha A4", hint: "210×297 · impressão", ratio: 210 / 297, cols: 12, rows: 17 },
};

export type BlockType = "header" | "meta" | "goals" | "day" | "notes" | "brand";

export type LayoutBlock = {
  id: string;
  type: BlockType;
  /** preenchido apenas quando type === "day" */
  dayId?: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ProgramLayout = {
  aspect: AspectKey;
  blocks: LayoutBlock[];
};

export const BLOCK_META: Record<BlockType, { label: string; description: string }> = {
  header: { label: "Cabeçalho", description: "Nome da rotina + aluno" },
  meta: { label: "Período & nível", description: "Datas, categoria e nível" },
  goals: { label: "Objetivos", description: "Texto de objetivos da rotina" },
  day: { label: "Treino", description: "Um dia de treino com exercícios" },
  notes: { label: "Observações", description: "Espaço livre de anotações" },
  brand: { label: "Assinatura", description: "Marca / nome do treinador" },
};

export const PRESETS = ["compacto", "cartaz", "ficha"] as const;
export type PresetKey = (typeof PRESETS)[number];

export const PRESET_META: Record<PresetKey, { label: string; description: string }> = {
  compacto: { label: "Compacto", description: "Cabeçalho enxuto e treinos em duas colunas" },
  cartaz: { label: "Cartaz", description: "Cabeçalho grande, treinos empilhados" },
  ficha: { label: "Ficha A4", description: "Documento vertical para impressão" },
};

const KEY = (programId: string) => `pt:layout:${programId}`;

export function clampBlock(b: LayoutBlock, cols: number, rows: number): LayoutBlock {
  const w = Math.max(2, Math.min(cols, Math.round(b.w)));
  const h = Math.max(1, Math.min(rows, Math.round(b.h)));
  return {
    ...b,
    w,
    h,
    x: Math.max(0, Math.min(cols - w, Math.round(b.x))),
    y: Math.max(0, Math.min(rows - h, Math.round(b.y))),
  };
}

export function overlaps(a: LayoutBlock, b: LayoutBlock) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function hasCollision(block: LayoutBlock, blocks: LayoutBlock[]) {
  return blocks.some((o) => o.id !== block.id && overlaps(block, o));
}

/** Primeiro retângulo livre com o tamanho pedido, varrendo de cima para baixo. */
export function findFreeSlot(
  blocks: LayoutBlock[],
  w: number,
  h: number,
  cols: number,
  rows: number,
): { x: number; y: number } | null {
  for (let y = 0; y <= rows - h; y++) {
    for (let x = 0; x <= cols - w; x++) {
      const probe: LayoutBlock = { id: "__probe", type: "notes", x, y, w, h };
      if (!hasCollision(probe, blocks)) return { x, y };
    }
  }
  return null;
}

export function buildPreset(
  preset: PresetKey,
  days: { id: string; name: string }[],
): ProgramLayout {
  const dayList = days.slice(0, 6);

  if (preset === "cartaz") {
    const rows = ASPECTS["4:5"].rows;
    const blocks: LayoutBlock[] = [
      { id: "header", type: "header", x: 0, y: 0, w: 12, h: 3 },
      { id: "meta", type: "meta", x: 0, y: 3, w: 12, h: 2 },
    ];
    let y = 5;
    const per = Math.max(2, Math.floor((rows - 6) / Math.max(1, dayList.length)));
    dayList.forEach((d) => {
      if (y + per > rows - 1) return;
      blocks.push({ id: `day-${d.id}`, type: "day", dayId: d.id, x: 0, y, w: 12, h: per });
      y += per;
    });
    blocks.push({ id: "brand", type: "brand", x: 0, y: rows - 1, w: 12, h: 1 });
    return { aspect: "4:5", blocks };
  }

  if (preset === "ficha") {
    const rows = ASPECTS.a4.rows;
    const blocks: LayoutBlock[] = [
      { id: "header", type: "header", x: 0, y: 0, w: 12, h: 2 },
      { id: "meta", type: "meta", x: 0, y: 2, w: 7, h: 2 },
      { id: "goals", type: "goals", x: 7, y: 2, w: 5, h: 2 },
    ];
    let y = 4;
    const per = Math.max(2, Math.floor((rows - 5) / Math.max(1, dayList.length)));
    dayList.forEach((d) => {
      if (y + per > rows - 1) return;
      blocks.push({ id: `day-${d.id}`, type: "day", dayId: d.id, x: 0, y, w: 12, h: per });
      y += per;
    });
    blocks.push({ id: "brand", type: "brand", x: 0, y: rows - 1, w: 12, h: 1 });
    return { aspect: "a4", blocks };
  }

  // compacto — 1:1, treinos em duas colunas
  const rows = ASPECTS["1:1"].rows;
  const blocks: LayoutBlock[] = [
    { id: "header", type: "header", x: 0, y: 0, w: 8, h: 2 },
    { id: "meta", type: "meta", x: 8, y: 0, w: 4, h: 2 },
  ];
  const per = Math.max(2, Math.floor((rows - 3) / Math.max(1, Math.ceil(dayList.length / 2))));
  dayList.forEach((d, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const y = 2 + row * per;
    if (y + per > rows - 1) return;
    blocks.push({ id: `day-${d.id}`, type: "day", dayId: d.id, x: col * 6, y, w: 6, h: per });
  });
  blocks.push({ id: "brand", type: "brand", x: 0, y: rows - 1, w: 12, h: 1 });
  return { aspect: "1:1", blocks };
}

export function loadLayout(programId: string): ProgramLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY(programId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProgramLayout;
    if (!parsed?.aspect || !Array.isArray(parsed.blocks)) return null;
    if (!ASPECTS[parsed.aspect]) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLayout(programId: string, layout: ProgramLayout) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY(programId), JSON.stringify(layout));
  } catch {
    /* quota — ignora */
  }
}

export function clearLayout(programId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY(programId));
  } catch {
    /* ignora */
  }
}
