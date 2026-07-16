import { useState } from "react";
import { MoreVertical, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
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
}: {
  exercise: TrainingExercise;
  trainingDayId?: string;
  onDelete: (id: string) => void;
  onUpdate: () => void;
  initialExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [form, setForm] = useState({
    sets_reps: exercise.sets_reps ?? "",
    load: exercise.load ?? "",
    rest_seconds: exercise.rest_seconds ?? "",
    observations: exercise.observations ?? "",
    media_url: exercise.media_url ?? "",
    media_type: exercise.media_type ?? "image",
  });

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

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b p-3">
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="flex-1 font-semibold">{exercise.name}</div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground"
          aria-label={expanded ? "Recolher" : "Expandir"}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Recolher" : "Expandir"}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(exercise.id)}
            >
              Excluir exercício
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
              <Label className="text-xs">Série/rep</Label>
              <Input
                value={form.sets_reps}
                onChange={(e) => setForm((f) => ({ ...f, sets_reps: e.target.value }))}
                onBlur={(e) => autoSave({ sets_reps: e.target.value || null })}
                placeholder="4x12"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Carga</Label>
              <Input
                value={form.load}
                onChange={(e) => setForm((f) => ({ ...f, load: e.target.value }))}
                onBlur={(e) => autoSave({ load: e.target.value || null })}
                placeholder="20kg"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Intervalo (s)</Label>
              <Input
                value={form.rest_seconds}
                onChange={(e) => setForm((f) => ({ ...f, rest_seconds: e.target.value }))}
                onBlur={(e) => autoSave({ rest_seconds: e.target.value || null })}
                placeholder="60"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Observações</Label>
            <Textarea
              rows={2}
              value={form.observations}
              onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))}
              onBlur={(e) => autoSave({ observations: e.target.value || null })}
              placeholder="Instruções específicas para este exercício…"
            />
          </div>
        </div>
      )}
    </div>
  );
}
