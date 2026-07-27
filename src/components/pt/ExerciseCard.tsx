import { useEffect, useRef, useState } from "react";
import {
  MoreVertical,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Pencil,
  Check,
  X,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExerciseMediaUpload } from "./ExerciseMediaUpload";

type MediaType = "image" | "video" | "youtube";

export interface TrainingExercise {
  id: string;
  training_day_id: string;
  name: string;
  media_url: string | null;
  media_type: string | null;
  sets_reps: string | null;
  load: string | null;
  rest_seconds: string | null;
  observations: string | null;
  sort_order: number;
}

export function ExerciseCard({
  exercise,
  onDelete,
  onUpdate,
  initialExpanded = true,
  dragHandle,
}: {
  exercise: TrainingExercise;
  trainingDayId?: string;
  onDelete: (id: string) => void;
  onUpdate: () => void;
  initialExpanded?: boolean;
  dragHandle?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(exercise.name);
  const [savingName, setSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    sets_reps: exercise.sets_reps ?? "",
    load: exercise.load ?? "",
    rest_seconds: exercise.rest_seconds ?? "",
    observations: exercise.observations ?? "",
    media_url: exercise.media_url ?? "",
    media_type: exercise.media_type ?? "image",
  });

  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editingName]);

  async function autoSave(patch: Record<string, string | null>) {
    const { error } = await supabase
      .from("pt_training_exercises" as never)
      .update(patch as never)
      .eq("id", exercise.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    onUpdate();
  }

  async function commitName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === exercise.name) {
      setNameDraft(exercise.name);
      setEditingName(false);
      return;
    }
    setSavingName(true);
    const { error } = await supabase
      .from("pt_training_exercises" as never)
      .update({ name: trimmed } as never)
      .eq("id", exercise.id);
    setSavingName(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Exercício renomeado");
    setEditingName(false);
    onUpdate();
  }

  function cancelName() {
    setNameDraft(exercise.name);
    setEditingName(false);
  }

  return (
    <div className="group/card rounded-xl border border-border bg-card shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-center gap-2 border-b border-border/70 p-3">
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />

        {editingName ? (
          <div className="flex flex-1 items-center gap-1.5">
            <Input
              ref={nameInputRef}
              value={nameDraft}
              disabled={savingName}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitName();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelName();
                }
              }}
              aria-label="Nome do exercício"
              className="h-8 flex-1 text-sm font-semibold tracking-tight transition-colors duration-150"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={commitName}
              disabled={savingName}
              aria-label="Salvar nome"
              className="h-9 w-9 text-primary hover:bg-primary/10 hover:text-primary sm:h-8 sm:w-8"
            >
              {savingName ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={cancelName}
              disabled={savingName}
              aria-label="Cancelar edição"
              className="h-9 w-9 text-muted-foreground hover:bg-muted hover:text-foreground sm:h-8 sm:w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            aria-label={`Renomear ${exercise.name}`}
            className="group/name flex flex-1 items-center gap-1.5 rounded-md text-left text-sm font-semibold leading-tight tracking-tight text-foreground outline-none transition-colors duration-150 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            <span className="truncate">{exercise.name}</span>
            <Pencil
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70 opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover/card:opacity-100 sm:group-focus-visible/name:opacity-100"
              aria-hidden
            />
          </button>
        )}

        {!editingName && (
          <>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-md p-1 text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              aria-label={expanded ? "Recolher exercício" : "Expandir exercício"}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label="Mais opções"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => setExpanded((v) => !v)}>
                  {expanded ? (
                    <ChevronUp className="mr-2 h-4 w-4" />
                  ) : (
                    <ChevronDown className="mr-2 h-4 w-4" />
                  )}
                  {expanded ? "Recolher" : "Expandir"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setExpanded(true);
                    setEditingName(true);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Renomear exercício
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(exercise.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir exercício
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {expanded && (
        <div className="space-y-3 p-3">
          <ExerciseMediaUpload
            mediaUrl={form.media_url}
            mediaType={form.media_type}
            onUpload={(url, type: MediaType) => {
              setForm((f) => ({ ...f, media_url: url, media_type: type }));
              autoSave({ media_url: url, media_type: type });
            }}
            onRemove={() => {
              setForm((f) => ({ ...f, media_url: "", media_type: "image" }));
              autoSave({ media_url: null, media_type: null });
            }}
          />

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Série/rep</Label>
              <Input
                value={form.sets_reps}
                onChange={(e) => setForm((f) => ({ ...f, sets_reps: e.target.value }))}
                onBlur={(e) => autoSave({ sets_reps: e.target.value || null })}
                placeholder="4x12"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Carga</Label>
              <Input
                value={form.load}
                onChange={(e) => setForm((f) => ({ ...f, load: e.target.value }))}
                onBlur={(e) => autoSave({ load: e.target.value || null })}
                placeholder="20kg"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Intervalo (s)</Label>
              <Input
                value={form.rest_seconds}
                onChange={(e) => setForm((f) => ({ ...f, rest_seconds: e.target.value }))}
                onBlur={(e) => autoSave({ rest_seconds: e.target.value || null })}
                placeholder="60"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Observações</Label>
            <Textarea
              rows={2}
              value={form.observations}
              onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))}
              onBlur={(e) => autoSave({ observations: e.target.value || null })}
              placeholder="Instruções específicas para este exercício…"
            />
          </div>

          <p className="pt-0.5 text-[11px] leading-tight text-muted-foreground/80">
            Toque em qualquer campo para editar — as alterações são salvas automaticamente.
          </p>
        </div>
      )}
    </div>
  );
}
