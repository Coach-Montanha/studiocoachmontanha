import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Loader2, ImageIcon, Trash2, History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  generateAnnouncementImage,
  listAiImageCache,
  deleteAiImageCache,
  type AiImageCacheRow,
  type AiImageModel,
} from "@/lib/ai-image.functions";
import { getSignedAnnouncementImageUrl } from "@/lib/announcements.functions";

const ASPECT_PRESETS: { value: string; label: string }[] = [
  { value: "1:1", label: "Quadrado (1:1)" },
  { value: "16:9", label: "Paisagem (16:9)" },
  { value: "9:16", label: "Retrato (9:16)" },
  { value: "4:3", label: "Padrão (4:3)" },
  { value: "3:4", label: "Vertical (3:4)" },
  { value: "custom", label: "Personalizado…" },
];

const MODEL_OPTIONS: { value: AiImageModel; label: string; hint: string }[] = [
  { value: "google/gemini-3.1-flash-image", label: "Nano Banana 2 (rápido)", hint: "Padrão · ótimo custo/qualidade" },
  { value: "google/gemini-3-pro-image", label: "Gemini Pro Image (alta qualidade)", hint: "Mais caro · use quando o resultado precisa ser perfeito" },
];

const DEFAULT_LIMIT_PER_NOTICE = 5;

export function AiImageGenerator({
  onPick,
  limitPerNotice = DEFAULT_LIMIT_PER_NOTICE,
}: {
  onPick: (path: string) => void;
  limitPerNotice?: number;
}) {
  const qc = useQueryClient();
  const genFn = useServerFn(generateAnnouncementImage);
  const listFn = useServerFn(listAiImageCache);
  const delFn = useServerFn(deleteAiImageCache);
  const signFn = useServerFn(getSignedAnnouncementImageUrl);

  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<string>("1:1");
  const [customW, setCustomW] = useState<number>(1024);
  const [customH, setCustomH] = useState<number>(1024);
  const [model, setModel] = useState<AiImageModel>("google/gemini-3.1-flash-image");
  const [usedInSession, setUsedInSession] = useState(0);

  const { data: cache = [] } = useQuery({
    queryKey: ["ai-image-cache"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });

  const effectiveAspect = useMemo(() => {
    if (aspect !== "custom") return aspect;
    const w = Math.max(256, Math.min(2048, Number(customW) || 1024));
    const h = Math.max(256, Math.min(2048, Number(customH) || 1024));
    return `custom:${w}x${h}`;
  }, [aspect, customW, customH]);

  const genMut = useMutation({
    mutationFn: async () => genFn({ data: { prompt: prompt.trim(), aspect: effectiveAspect, model } }),
    onSuccess: (r) => {
      if (!r.cached) setUsedInSession((n) => n + 1);
      qc.invalidateQueries({ queryKey: ["ai-image-cache"] });
      onPick(r.path);
      toast.success(r.cached ? "Imagem reutilizada do cache (0 créditos)" : "Imagem gerada e selecionada");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar imagem"),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-image-cache"] });
      toast.success("Imagem removida do cache");
    },
    onError: (e: any) => toast.error(e?.message),
  });

  const remaining = Math.max(0, limitPerNotice - usedInSession);
  const overLimit = remaining === 0;

  return (
    <div className="space-y-3 rounded-md border border-dashed p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" /> Gerar imagem com IA
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm">
              <History className="h-4 w-4 mr-1" /> Reutilizar ({cache.length})
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[320px] p-2">
            <p className="mb-2 px-1 text-xs text-muted-foreground">
              Clique numa imagem para reaproveitar sem gastar créditos.
            </p>
            {cache.length === 0 ? (
              <p className="p-3 text-center text-xs text-muted-foreground">Sem imagens ainda</p>
            ) : (
              <div className="grid max-h-[280px] grid-cols-3 gap-2 overflow-auto">
                {cache.map((r) => (
                  <CacheThumb
                    key={r.id}
                    row={r}
                    signFn={signFn}
                    onPick={() => onPick(r.image_path)}
                    onDelete={() => delMut.mutate(r.id)}
                  />
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Ex: Cartaz motivacional para aula de muay thai no sábado, cores vibrantes, texto 'BORA!'"
        rows={2}
      />

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Modelo</Label>
          <Select value={model} onValueChange={(v) => setModel(v as AiImageModel)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODEL_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  <div className="flex flex-col">
                    <span>{m.label}</span>
                    <span className="text-[10px] text-muted-foreground">{m.hint}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Proporção</Label>
          <Select value={aspect} onValueChange={setAspect}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ASPECT_PRESETS.map((a) => (
                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {aspect === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Largura (px)</Label>
            <Input type="number" min={256} max={2048} value={customW}
              onChange={(e) => setCustomW(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Altura (px)</Label>
            <Input type="number" min={256} max={2048} value={customH}
              onChange={(e) => setCustomH(Number(e.target.value))} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Restam <strong>{remaining}</strong> de {limitPerNotice} gerações neste aviso.
        </span>
        <Button
          type="button"
          onClick={() => genMut.mutate()}
          disabled={genMut.isPending || overLimit || prompt.trim().length < 3}
          size="sm"
        >
          {genMut.isPending ? (
            <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Gerando…</>
          ) : (
            <><Sparkles className="h-4 w-4 mr-1" /> Gerar</>
          )}
        </Button>
      </div>
      {overLimit && (
        <p className="text-xs text-amber-600">
          Limite deste aviso atingido. Reutilize uma imagem do cache para economizar créditos.
        </p>
      )}
    </div>
  );
}

function CacheThumb({
  row,
  signFn,
  onPick,
  onDelete,
}: {
  row: AiImageCacheRow;
  signFn: ReturnType<typeof useServerFn<typeof getSignedAnnouncementImageUrl>>;
  onPick: () => void;
  onDelete: () => void;
}) {
  const { data } = useQuery({
    queryKey: ["ann-thumb", row.image_path],
    queryFn: () => signFn({ data: { path: row.image_path } }),
    staleTime: 60 * 60 * 1000,
  });
  return (
    <div className="group relative overflow-hidden rounded border">
      <button
        type="button"
        onClick={onPick}
        className="block h-20 w-full bg-muted"
        title={row.prompt}
      >
        {data?.url ? (
          <img src={data.url} alt={row.prompt} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="absolute right-1 top-1 hidden rounded bg-overlay p-1 text-primary-foreground backdrop-blur-sm transition-ui group-hover:block"
        aria-label="Excluir"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}
