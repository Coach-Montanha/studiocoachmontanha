import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileImage,
  FileText,
  GripVertical,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ASPECTS,
  BLOCK_META,
  PRESET_META,
  PRESETS,
  type AspectKey,
  type BlockType,
  type LayoutBlock,
  type PresetKey,
  type ProgramLayout,
  buildPreset,
  clampBlock,
  clearLayout,
  findFreeSlot,
  hasCollision,
  loadLayout,
  saveLayout,
} from "@/lib/pt-program-layout";
import {
  exportLayoutPdf,
  exportLayoutPng,
  fetchProgramRenderData,
  readThemeColors,
  renderProgramLayout,
  type BlockOverflow,
  type ProgramRenderData,
} from "@/lib/pt-program-render";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  programId: string | null;
  studentName?: string;
};

type DragState =
  | { mode: "move" | "resize"; id: string; startX: number; startY: number; origin: LayoutBlock }
  | null;

export function ProgramLayoutEditor({ open, onOpenChange, programId, studentName }: Props) {
  const [data, setData] = useState<ProgramRenderData | null>(null);
  const [loading, setLoading] = useState(false);
  const [layout, setLayout] = useState<ProgramLayout | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [overflow, setOverflow] = useState<BlockOverflow>({});
  const [exporting, setExporting] = useState<"png" | "pdf" | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState>(null);

  /* ---------------- data ---------------- */
  useEffect(() => {
    if (!open || !programId) return;
    let cancelled = false;
    setLoading(true);
    fetchProgramRenderData(programId, studentName)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        const stored = loadLayout(programId);
        setLayout(stored ?? buildPreset("compacto", d.days));
      })
      .catch((e: any) => toast.error(e?.message ?? "Falha ao carregar a rotina"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, programId, studentName]);

  /* ---------------- persist + preview ---------------- */
  useEffect(() => {
    if (!programId || !layout || !data) return;
    saveLayout(programId, layout);
    const id = window.setTimeout(() => {
      if (canvasRef.current) {
        setOverflow(renderProgramLayout(canvasRef.current, data, layout, readThemeColors(), 900));
      }
    }, 60);
    return () => window.clearTimeout(id);
  }, [layout, data, programId]);

  const spec = layout ? ASPECTS[layout.aspect] : ASPECTS["1:1"];

  const usedDayIds = useMemo(
    () => new Set((layout?.blocks ?? []).filter((b) => b.type === "day").map((b) => b.dayId)),
    [layout],
  );
  const usedTypes = useMemo(
    () => new Set((layout?.blocks ?? []).map((b) => b.type)),
    [layout],
  );

  /* ---------------- mutations ---------------- */
  const update = useCallback((fn: (l: ProgramLayout) => ProgramLayout) => {
    setLayout((prev) => (prev ? fn(prev) : prev));
  }, []);

  function addBlock(type: BlockType, dayId?: string) {
    if (!layout) return;
    const w = type === "day" ? 6 : 12;
    const h = type === "brand" ? 1 : type === "day" ? 4 : 2;
    const slot =
      findFreeSlot(layout.blocks, w, h, spec.cols, spec.rows) ??
      findFreeSlot(layout.blocks, Math.min(w, 6), 2, spec.cols, spec.rows);
    if (!slot) {
      toast.error("Sem espaço livre. Reduza um bloco ou troque o formato.");
      return;
    }
    const id = dayId ? `day-${dayId}` : type;
    update((l) => ({ ...l, blocks: [...l.blocks, { id, type, dayId, ...slot, w, h }] }));
    setSelected(id);
  }

  function removeBlock(id: string) {
    update((l) => ({ ...l, blocks: l.blocks.filter((b) => b.id !== id) }));
    setSelected((s) => (s === id ? null : s));
  }

  function applyPreset(preset: PresetKey) {
    if (!data) return;
    setLayout(buildPreset(preset, data.days));
    setSelected(null);
    toast.success(`Layout "${PRESET_META[preset].label}" aplicado`);
  }

  function changeAspect(aspect: AspectKey) {
    update((l) => {
      const next = ASPECTS[aspect];
      const blocks: LayoutBlock[] = [];
      for (const b of l.blocks) {
        const clamped = clampBlock(b, next.cols, next.rows);
        if (!hasCollision(clamped, blocks)) blocks.push(clamped);
        else {
          const slot = findFreeSlot(blocks, clamped.w, clamped.h, next.cols, next.rows);
          if (slot) blocks.push({ ...clamped, ...slot });
        }
      }
      return { aspect, blocks };
    });
  }

  function nudge(id: string, dx: number, dy: number) {
    update((l) => {
      const b = l.blocks.find((x) => x.id === id);
      if (!b) return l;
      const moved = clampBlock({ ...b, x: b.x + dx, y: b.y + dy }, spec.cols, spec.rows);
      if (hasCollision(moved, l.blocks)) return l;
      return { ...l, blocks: l.blocks.map((x) => (x.id === id ? moved : x)) };
    });
  }

  /* ---------------- pointer drag / resize ---------------- */
  function beginDrag(e: React.PointerEvent, block: LayoutBlock, mode: "move" | "resize") {
    e.preventDefault();
    e.stopPropagation();
    setSelected(block.id);
    dragRef.current = {
      mode,
      id: block.id,
      startX: e.clientX,
      startY: e.clientY,
      origin: block,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    const grid = gridRef.current;
    if (!drag || !grid || !layout) return;
    const rect = grid.getBoundingClientRect();
    const cw = rect.width / spec.cols;
    const ch = rect.height / spec.rows;
    const dx = Math.round((e.clientX - drag.startX) / cw);
    const dy = Math.round((e.clientY - drag.startY) / ch);
    if (dx === 0 && dy === 0) return;

    const o = drag.origin;
    const candidate = clampBlock(
      drag.mode === "move"
        ? { ...o, x: o.x + dx, y: o.y + dy }
        : { ...o, w: o.w + dx, h: o.h + dy },
      spec.cols,
      spec.rows,
    );
    if (hasCollision(candidate, layout.blocks)) return;
    update((l) => ({
      ...l,
      blocks: l.blocks.map((b) => (b.id === drag.id ? candidate : b)),
    }));
  }

  function endDrag() {
    dragRef.current = null;
  }

  /* ---------------- export ---------------- */
  async function doExport(kind: "png" | "pdf") {
    if (!data || !layout) return;
    setExporting(kind);
    try {
      if (kind === "png") await exportLayoutPng(data, layout);
      else await exportLayoutPdf(data, layout);
      toast.success(kind === "png" ? "Imagem gerada" : "PDF gerado");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao exportar");
    } finally {
      setExporting(null);
    }
  }

  const overflowCount = Object.values(overflow).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto p-0">
        <DialogHeader className="space-y-1.5 border-b border-border px-5 py-4 sm:px-6">
          <DialogTitle className="text-lg font-semibold leading-tight tracking-tight">
            Layout da imagem
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            Escolha onde cada bloco fica na peça. Arraste para posicionar, use o canto para
            redimensionar — o conteúdo respeita os limites de cada bloco.
          </DialogDescription>
        </DialogHeader>

        {loading || !layout || !data ? (
          <div className="flex h-72 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando rotina…
          </div>
        ) : (
          <div className="grid gap-6 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* ---------- grade ---------- */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {(Object.keys(ASPECTS) as AspectKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => changeAspect(key)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium outline-none transition-all duration-200",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]",
                      layout.aspect === key
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {ASPECTS[key].label}
                    <span className="ml-1.5 hidden text-[10px] opacity-70 sm:inline">
                      {ASPECTS[key].hint}
                    </span>
                  </button>
                ))}
              </div>

              <div
                ref={gridRef}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className="relative w-full touch-none select-none overflow-hidden rounded-xl border border-border bg-muted/30 p-0"
                style={{ aspectRatio: String(spec.ratio) }}
              >
                {/* grade de fundo */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-60"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
                    backgroundSize: `${100 / spec.cols}% ${100 / spec.rows}%`,
                  }}
                />
                {layout.blocks.map((b) => {
                  const isSel = selected === b.id;
                  const isOver = overflow[b.id];
                  const day = b.dayId ? data.days.find((d) => d.id === b.dayId) : null;
                  return (
                    <div
                      key={b.id}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        const map: Record<string, [number, number]> = {
                          ArrowLeft: [-1, 0],
                          ArrowRight: [1, 0],
                          ArrowUp: [0, -1],
                          ArrowDown: [0, 1],
                        };
                        const d = map[e.key];
                        if (d) {
                          e.preventDefault();
                          nudge(b.id, d[0], d[1]);
                        }
                      }}
                      onPointerDown={(e) => beginDrag(e, b, "move")}
                      className={cn(
                        "group absolute flex cursor-grab flex-col justify-between rounded-lg border p-2 outline-none transition-[box-shadow,border-color,background-color] duration-200",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                        isSel
                          ? "border-primary bg-primary/10 shadow-md"
                          : "border-border bg-card shadow-sm hover:border-primary/50 hover:shadow-md",
                        isOver && "border-warning bg-warning/10",
                      )}
                      style={{
                        left: `${(b.x / spec.cols) * 100}%`,
                        top: `${(b.y / spec.rows) * 100}%`,
                        width: `${(b.w / spec.cols) * 100}%`,
                        height: `${(b.h / spec.rows) * 100}%`,
                        padding: 4,
                      }}
                    >
                      <div className="flex min-w-0 items-start gap-1">
                        <GripVertical className="mt-px h-3 w-3 shrink-0 text-muted-foreground/70" />
                        <span className="truncate text-[11px] font-semibold leading-tight text-foreground">
                          {day ? `${day.day_label} · ${day.name}` : BLOCK_META[b.type].label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        {isOver ? (
                          <span className="flex items-center gap-1 truncate text-[10px] font-medium text-warning">
                            <TriangleAlert className="h-3 w-3 shrink-0" /> conteúdo cortado
                          </span>
                        ) : (
                          <span className="text-[10px] tabular-nums text-muted-foreground">
                            {b.w}×{b.h}
                          </span>
                        )}
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => removeBlock(b.id)}
                          aria-label="Remover bloco"
                          className="rounded p-0.5 text-muted-foreground opacity-0 outline-none transition-opacity duration-150 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <span
                        onPointerDown={(e) => beginDrag(e, b, "resize")}
                        className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 cursor-se-resize rounded-sm border-b-2 border-r-2 border-primary/60 transition-colors duration-150 hover:border-primary"
                        aria-hidden
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => applyPreset(p)}
                    title={PRESET_META[p].description}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground outline-none transition-all duration-200 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]"
                  >
                    {PRESET_META[p].label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    if (!programId) return;
                    clearLayout(programId);
                    applyPreset("compacto");
                  }}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground outline-none transition-colors duration-200 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão
                </button>
              </div>
            </div>

            {/* ---------- painel lateral ---------- */}
            <div className="space-y-5">
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Blocos disponíveis
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {(["header", "meta", "goals", "notes", "brand"] as BlockType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={usedTypes.has(t)}
                      onClick={() => addBlock(t)}
                      className="flex items-center gap-1 rounded-lg border border-dashed border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground outline-none transition-all duration-200 hover:border-primary hover:bg-primary/5 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-background disabled:hover:text-foreground"
                    >
                      <Plus className="h-3 w-3" /> {BLOCK_META[t].label}
                    </button>
                  ))}
                </div>
                {data.days.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {data.days.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        disabled={usedDayIds.has(d.id)}
                        onClick={() => addBlock("day", d.id)}
                        className="flex max-w-full items-center gap-1 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary outline-none transition-all duration-200 hover:border-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {d.day_label} · {d.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Pré-visualização
                </h4>
                <div className="overflow-hidden rounded-xl border border-border bg-muted/30 p-2">
                  <canvas ref={canvasRef} className="h-auto w-full rounded-lg" />
                </div>
                {overflowCount > 0 && (
                  <p className="flex items-start gap-1.5 text-xs leading-relaxed text-warning">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {overflowCount === 1
                      ? "1 bloco tem conteúdo além do espaço reservado."
                      : `${overflowCount} blocos têm conteúdo além do espaço reservado.`}{" "}
                    Aumente a altura para caber tudo.
                  </p>
                )}
              </section>

              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Exportar
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => doExport("png")}
                    disabled={exporting !== null}
                    className="justify-center gap-1.5 transition-all duration-200 active:scale-[0.98]"
                  >
                    {exporting === "png" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileImage className="h-4 w-4" />
                    )}
                    PNG
                  </Button>
                  <Button
                    onClick={() => doExport("pdf")}
                    disabled={exporting !== null}
                    className="justify-center gap-1.5 transition-all duration-200 active:scale-[0.98]"
                  >
                    {exporting === "pdf" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    PDF
                  </Button>
                </div>
                <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  <Download className="mt-0.5 h-3 w-3 shrink-0" />
                  O layout fica salvo automaticamente para esta rotina neste dispositivo.
                </p>
              </section>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
