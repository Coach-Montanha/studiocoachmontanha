import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Play,
  Pencil,
  Trash2,
  Dumbbell,
  Video,
  Loader2,
  X,
  Youtube,
  ExternalLink,
  UploadCloud,
  FileVideo,
  Link2,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { confirmDialog } from "@/lib/confirm-dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/personal-trainer/biblioteca")({
  head: () => ({
    meta: [
      { title: "Biblioteca de Movimentos — EduFinance PT" },
      {
        name: "description",
        content:
          "Catálogo reutilizável de exercícios com vídeos de referência para montar treinos consistentes.",
      },
    ],
  }),
  component: BibliotecaPage,
});

type LibraryItem = {
  id: string;
  name: string;
  muscle_group: string | null;
  description: string | null;
  media_url: string | null;
  media_type: string | null;
  thumbnail_url: string | null;
  user_id: string | null;
  is_global: boolean;
  created_at: string;
};

const MUSCLE_GROUPS = [
  "Peito",
  "Costas",
  "Pernas",
  "Glúteos",
  "Ombros",
  "Braços",
  "Core",
  "Cardio",
  "Mobilidade",
  "Corpo inteiro",
  "Outro",
] as const;

function detectMedia(url: string): { type: string; thumb: string | null } {
  const u = url.trim();
  if (!u) return { type: "url", thumb: null };
  const yt =
    u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/)?.[1];
  if (yt) return { type: "youtube", thumb: `https://img.youtube.com/vi/${yt}/hqdefault.jpg` };
  const vim = u.match(/vimeo\.com\/(\d+)/)?.[1];
  if (vim) return { type: "vimeo", thumb: null };
  if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) return { type: "video", thumb: null };
  if (/\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(u)) return { type: "image", thumb: u };
  return { type: "url", thumb: null };
}

function youtubeEmbed(url: string): string | null {
  const yt =
    url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/)?.[1];
  return yt ? `https://www.youtube.com/embed/${yt}` : null;
}

function BibliotecaPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryItem | null>(null);
  const [viewing, setViewing] = useState<LibraryItem | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["pt-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pt_exercises_library" as never)
        .select("id,name,muscle_group,description,media_url,media_type,thumbnail_url,user_id,is_global,created_at")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as LibraryItem[];
    },
  });

  const groups = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.muscle_group && set.add(i.muscle_group));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((i) => {
      if (groupFilter !== "all" && (i.muscle_group ?? "") !== groupFilter) return false;
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        (i.muscle_group ?? "").toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search, groupFilter]);

  async function handleDelete(item: LibraryItem) {
    const ok = await confirmDialog({
      title: "Excluir movimento?",
      description: `"${item.name}" será removido da biblioteca. Treinos que já usam este movimento mantêm seus dados, mas perdem a referência ao vídeo.`,
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("pt_exercises_library" as never).delete().eq("id", item.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Movimento excluído");
      qc.invalidateQueries({ queryKey: ["pt-library"] });
      qc.invalidateQueries({ queryKey: ["exercise-library"] });
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <header className="space-y-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Dumbbell className="h-3.5 w-3.5" />
            Personal Trainer
          </div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Biblioteca de Movimentos
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Cadastre exercícios com vídeo de referência uma vez e reutilize em todos os treinos —
            mesma técnica, mesma demonstração, para todos os alunos.
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, grupo muscular ou descrição…"
              className="h-11 pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="h-11 w-full sm:w-48">
                <SelectValue placeholder="Grupo muscular" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os grupos</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="h-11 gap-2 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo movimento</span>
              <span className="sm:hidden">Novo</span>
            </Button>
          </div>
        </div>

        {/* Meta count */}
        <div className="text-xs text-muted-foreground">
          {isLoading
            ? "Carregando…"
            : `${filtered.length} ${filtered.length === 1 ? "movimento" : "movimentos"}${
                items.length !== filtered.length ? ` de ${items.length}` : ""
              }`}
        </div>
      </header>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse space-y-3 rounded-xl border border-border/60 bg-card/40 p-3"
            >
              <div className="aspect-video rounded-lg bg-muted" />
              <div className="h-4 w-2/3 rounded bg-muted" />
              <div className="h-3 w-1/3 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          hasItems={items.length > 0}
          onCreate={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          onClearFilters={() => {
            setSearch("");
            setGroupFilter("all");
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <ExerciseTile
              key={item.id}
              item={item}
              onView={() => setViewing(item)}
              onEdit={() => {
                setEditing(item);
                setFormOpen(true);
              }}
              onDelete={() => handleDelete(item)}
            />
          ))}
        </div>
      )}

      <ExerciseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["pt-library"] });
          qc.invalidateQueries({ queryKey: ["exercise-library"] });
        }}
      />

      <ExerciseViewer item={viewing} onOpenChange={(v) => !v && setViewing(null)} />
    </div>
  );
}

function ExerciseTile({
  item,
  onView,
  onEdit,
  onDelete,
}: {
  item: LibraryItem;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const thumb = item.thumbnail_url ?? (item.media_url ? detectMedia(item.media_url).thumb : null);
  const hasVideo = !!item.media_url;

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm",
        "transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-border hover:shadow-md",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
      )}
    >
      {/* Media */}
      <button
        type="button"
        onClick={onView}
        className={cn(
          "relative block aspect-video w-full overflow-hidden bg-muted",
          "focus:outline-none",
        )}
        aria-label={`Ver vídeo de ${item.name}`}
      >
        {thumb ? (
          <img
            src={thumb}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/40">
            <Dumbbell className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />
          </div>
        )}
        {hasVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/0 transition-colors duration-200 group-hover:bg-background/30">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-background/90 text-foreground shadow-lg backdrop-blur-sm transition-transform duration-200 group-hover:scale-110">
              <Play className="ml-0.5 h-5 w-5 fill-current" />
            </span>
          </div>
        )}
        {item.muscle_group && (
          <Badge
            variant="secondary"
            className="absolute left-2 top-2 border-border/50 bg-background/85 backdrop-blur-sm"
          >
            {item.muscle_group}
          </Badge>
        )}
      </button>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold leading-tight">{item.name}</h3>
          {item.description && (
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/50 pt-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {hasVideo ? (
              <>
                <Video className="h-3.5 w-3.5" />
                <span>Com vídeo</span>
              </>
            ) : (
              <span className="text-muted-foreground/70">Sem mídia</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={onEdit}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Editar movimento"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onDelete}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              aria-label="Excluir movimento"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  hasItems,
  onCreate,
  onClearFilters,
}: {
  hasItems: boolean;
  onCreate: () => void;
  onClearFilters: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-card/30 px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Dumbbell className="h-6 w-6" strokeWidth={1.75} />
      </div>
      {hasItems ? (
        <>
          <h2 className="text-lg font-semibold">Nenhum movimento encontrado</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Tente ajustar a busca ou remover os filtros aplicados.
          </p>
          <Button variant="outline" onClick={onClearFilters} className="mt-4">
            Limpar filtros
          </Button>
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold">Sua biblioteca está vazia</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Comece cadastrando seu primeiro movimento com vídeo de referência para reutilizar em
            todos os seus treinos.
          </p>
          <Button onClick={onCreate} className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            Cadastrar primeiro movimento
          </Button>
        </>
      )}
    </div>
  );
}

function ExerciseFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: LibraryItem | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState<string>("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"link" | "upload">("link");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useMemo(() => {
    if (open) {
      setName(editing?.name ?? "");
      setMuscleGroup(editing?.muscle_group ?? "");
      setMediaUrl(editing?.media_url ?? "");
      setMediaType(editing?.media_type ?? null);
      setDescription(editing?.description ?? "");
      setTab(editing?.media_type === "upload" ? "upload" : "link");
      setUploadProgress(0);
    }
  }, [open, editing]);

  const isUpload = mediaType === "upload";
  const media = mediaUrl && !isUpload ? detectMedia(mediaUrl) : null;
  const embed = mediaUrl && !isUpload ? youtubeEmbed(mediaUrl) : null;

  async function handleFileSelected(file: File) {
    if (!file.type.startsWith("video/")) {
      toast.error("Envie um arquivo de vídeo (MP4, WebM ou MOV).");
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      toast.error("Arquivo maior que 200MB. Comprima antes de enviar.");
      return;
    }
    setUploading(true);
    setUploadProgress(8);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada");

      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const path = `${userId}/library/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      // Fake incremental progress — Supabase JS SDK doesn't stream progress.
      const tick = setInterval(() => {
        setUploadProgress((p) => (p < 88 ? p + Math.max(1, Math.round((90 - p) / 8)) : p));
      }, 400);

      const { error: uploadError } = await supabase.storage
        .from("exercise-media")
        .upload(path, file, { contentType: file.type, upsert: false });
      clearInterval(tick);
      if (uploadError) throw uploadError;

      const { data: signed, error: signErr } = await supabase.storage
        .from("exercise-media")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Falha ao gerar URL");

      setMediaUrl(signed.signedUrl);
      setMediaType("upload");
      setUploadProgress(100);
      toast.success("Vídeo enviado com sucesso");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao enviar vídeo");
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  }

  function clearMedia() {
    setMediaUrl("");
    setMediaType(null);
    setUploadProgress(0);
  }


          <div className="space-y-2">
            <Label htmlFor="ex-desc">Observações técnicas</Label>
            <Textarea
              id="ex-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Postura, respiração, erros comuns…"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "Salvar alterações" : "Cadastrar movimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExerciseViewer({
  item,
  onOpenChange,
}: {
  item: LibraryItem | null;
  onOpenChange: (v: boolean) => void;
}) {
  if (!item) return null;
  const embed = item.media_url ? youtubeEmbed(item.media_url) : null;
  const media = item.media_url ? detectMedia(item.media_url) : null;

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto p-0">
        <div className="relative">
          <div className="overflow-hidden bg-muted">
            {embed ? (
              <iframe
                src={embed}
                title={item.name}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="aspect-video w-full"
              />
            ) : media?.type === "video" && item.media_url ? (
              <video src={item.media_url} controls autoPlay className="aspect-video w-full" />
            ) : media?.type === "image" && item.media_url ? (
              <img src={item.media_url} alt={item.name} className="aspect-video w-full object-contain" />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center">
                <Dumbbell className="h-14 w-14 text-muted-foreground/40" strokeWidth={1.5} />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/85 text-foreground shadow backdrop-blur-sm transition-colors hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold leading-tight">{item.name}</h2>
              {item.muscle_group && (
                <Badge variant="secondary" className="mt-2">
                  {item.muscle_group}
                </Badge>
              )}
            </div>
            {item.media_url && !embed && (
              <a
                href={item.media_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir original
              </a>
            )}
          </div>
          {item.description && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
