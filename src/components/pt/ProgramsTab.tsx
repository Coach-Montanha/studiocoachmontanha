import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, MoreVertical, Archive, ArchiveRestore,
  CalendarDays, Target, Dumbbell, MessageSquare, CheckCircle2, RotateCcw, Eye,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { confirmDialog } from "@/lib/confirm-dialog";
import { formatDateBR } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/edufinance/EmptyState";
import { TrainingDayDetail } from "./TrainingDayDetail";

const CATEGORY_LABELS: Record<string, string> = {
  hypertrophy: "Hipertrofia",
  conditioning: "Condicionamento físico",
  strength: "Força",
  cardio: "Cardio",
  general: "Geral",
};

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

type Program = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  goals: string | null;
  category: string;
  level: string;
  training_type: string;
  show_to_student: boolean;
  auto_archive: boolean;
  is_archived: boolean;
  is_deleted: boolean;
  sort_order: number;
};

type TrainingDay = {
  id: string;
  program_id: string;
  name: string;
  day_label: string;
  description: string | null;
  sort_order: number;
};

type Execution = {
  id: string;
  training_day_id: string;
  pt_student_id: string;
  executed_at: string;
  feedback: string | null;
  rating: number | null;
};

type ViewFilter = "active" | "archived" | "deleted";

export function ProgramsTab({ studentId }: { studentId: string }) {
  const qc = useQueryClient();
  const [view, setView] = useState<ViewFilter>("active");
  const [programOpen, setProgramOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [dayOpen, setDayOpen] = useState(false);
  const [editingDay, setEditingDay] = useState<TrainingDay | null>(null);
  const [activeProgramId, setActiveProgramId] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackDay, setFeedbackDay] = useState<TrainingDay | null>(null);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);

  const { data: programs = [] } = useQuery({
    queryKey: ["pt-programs", studentId, view],
    queryFn: async () => {
      let q = supabase
        .from("pt_programs" as never)
        .select("*")
        .eq("pt_student_id", studentId);
      if (view === "active") q = q.eq("is_archived", false).eq("is_deleted", false);
      else if (view === "archived") q = q.eq("is_archived", true).eq("is_deleted", false);
      else q = q.eq("is_deleted", true);
      const { data } = await q
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as Program[];
    },
  });

  const { data: trainingDays = [] } = useQuery({
    queryKey: ["pt-training-days", activeProgramId],
    enabled: !!activeProgramId,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_training_days" as never)
        .select("*")
        .eq("program_id", activeProgramId!)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      return (data ?? []) as unknown as TrainingDay[];
    },
  });

  const { data: executions = [] } = useQuery({
    queryKey: ["pt-executions", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_training_executions" as never)
        .select("*")
        .eq("pt_student_id", studentId)
        .order("executed_at", { ascending: false });
      return (data ?? []) as unknown as Execution[];
    },
  });

  // Auto-select the first program in the current view
  useEffect(() => {
    if (programs.length === 0) {
      setActiveProgramId(null);
      return;
    }
    if (!activeProgramId || !programs.find((p) => p.id === activeProgramId)) {
      setActiveProgramId(programs[0].id);
    }
  }, [programs, activeProgramId]);

  const activeProgram = programs.find((p) => p.id === activeProgramId) ?? null;

  async function softDeleteProgram(id: string) {
    if (!(await confirmDialog("Mover esta rotina para a lixeira?"))) return;
    const { error } = await supabase
      .from("pt_programs" as never)
      .update({ is_deleted: true, is_archived: false } as never)
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Rotina movida para a lixeira");
    qc.invalidateQueries({ queryKey: ["pt-programs", studentId] });
  }

  async function restoreProgram(id: string) {
    const { error } = await supabase
      .from("pt_programs" as never)
      .update({ is_deleted: false, is_archived: false } as never)
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Rotina restaurada");
    qc.invalidateQueries({ queryKey: ["pt-programs", studentId] });
  }

  async function archiveProgram(id: string, archived: boolean) {
    const { error } = await supabase
      .from("pt_programs" as never)
      .update({ is_archived: archived } as never)
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(archived ? "Rotina arquivada" : "Rotina desarquivada");
    qc.invalidateQueries({ queryKey: ["pt-programs", studentId] });
  }

  async function hardDeleteProgram(id: string) {
    if (!(await confirmDialog("Excluir permanentemente? Esta ação não pode ser desfeita."))) return;
    const { error } = await supabase.from("pt_programs" as never).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Rotina excluída");
    qc.invalidateQueries({ queryKey: ["pt-programs", studentId] });
  }

  async function deleteDay(id: string) {
    if (!(await confirmDialog("Excluir este treino?"))) return;
    const { error } = await supabase.from("pt_training_days" as never).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Treino excluído");
    qc.invalidateQueries({ queryKey: ["pt-training-days", activeProgramId] });
  }

  async function markExecuted(day: TrainingDay) {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const { error } = await supabase.from("pt_training_executions" as never).insert({
      user_id: userId,
      training_day_id: day.id,
      pt_student_id: studentId,
      executed_at: new Date().toISOString().slice(0, 10),
    } as never);
    if (error) return toast.error(error.message);
    toast.success(`${day.name} marcado como executado hoje`);
    qc.invalidateQueries({ queryKey: ["pt-executions", studentId] });
  }

  function execsForDay(dayId: string) {
    return executions.filter((e) => e.training_day_id === dayId);
  }

  return (
    <div className="space-y-4">
      {/* View toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => { setEditingProgram(null); setProgramOpen(true); }}
          >
            <Plus className="h-4 w-4" /> Criar rotina
          </Button>
          <Button
            size="sm"
            variant={view === "archived" ? "default" : "outline"}
            onClick={() => setView(view === "archived" ? "active" : "archived")}
          >
            <Archive className="h-4 w-4" /> Rotinas arquivadas
          </Button>
          <Button
            size="sm"
            variant={view === "deleted" ? "default" : "outline"}
            onClick={() => setView(view === "deleted" ? "active" : "deleted")}
          >
            <Trash2 className="h-4 w-4" /> Rotinas excluídas
          </Button>
          {view !== "active" && (
            <Button size="sm" variant="ghost" onClick={() => setView("active")}>
              Voltar para ativas
            </Button>
          )}
        </div>
      </div>

      {/* Program tabs */}
      {programs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {programs.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveProgramId(p.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                activeProgramId === p.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-accent"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {programs.length === 0 ? (
        <EmptyState
          icon={<Dumbbell className="h-6 w-6" />}
          title={
            view === "active"
              ? "Nenhuma rotina criada"
              : view === "archived"
                ? "Nenhuma rotina arquivada"
                : "Lixeira vazia"
          }
          description={
            view === "active"
              ? "Crie a primeira rotina de treino para este aluno."
              : undefined
          }
          action={
            view === "active" ? (
              <Button
                onClick={() => { setEditingProgram(null); setProgramOpen(true); }}
              >
                <Plus className="h-4 w-4" /> Criar rotina
              </Button>
            ) : null
          }
        />
      ) : activeProgram ? (
        <Card className="p-5 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Dumbbell className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{activeProgram.name}</h2>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>
                    {formatDateBR(activeProgram.start_date)}
                    {activeProgram.end_date ? ` — ${formatDateBR(activeProgram.end_date)}` : ""}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                    {CATEGORY_LABELS[activeProgram.category] ?? activeProgram.category}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
                    {LEVEL_LABELS[activeProgram.level] ?? activeProgram.level}
                  </span>
                  {activeProgram.is_archived && (
                    <span className="rounded-full border px-2 py-0.5 font-medium text-muted-foreground">
                      Arquivada
                    </span>
                  )}
                  {activeProgram.is_deleted && (
                    <span className="rounded-full border border-destructive/40 px-2 py-0.5 font-medium text-destructive">
                      Na lixeira
                    </span>
                  )}
                </div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => { setEditingProgram(activeProgram); setProgramOpen(true); }}
                >
                  <Pencil className="h-4 w-4" /> Editar rotina
                </DropdownMenuItem>
                {!activeProgram.is_deleted && (
                  <DropdownMenuItem
                    onClick={() => archiveProgram(activeProgram.id, !activeProgram.is_archived)}
                  >
                    {activeProgram.is_archived ? (
                      <><ArchiveRestore className="h-4 w-4" /> Desarquivar</>
                    ) : (
                      <><Archive className="h-4 w-4" /> Arquivar</>
                    )}
                  </DropdownMenuItem>
                )}
                {activeProgram.is_deleted ? (
                  <>
                    <DropdownMenuItem onClick={() => restoreProgram(activeProgram.id)}>
                      <RotateCcw className="h-4 w-4" /> Restaurar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => hardDeleteProgram(activeProgram.id)}
                    >
                      <Trash2 className="h-4 w-4" /> Excluir permanentemente
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => softDeleteProgram(activeProgram.id)}
                  >
                    <Trash2 className="h-4 w-4" /> Mover para lixeira
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Action bar */}
          <div className="flex flex-wrap gap-2">
            {[
              { icon: "⬇️", label: "Baixar treino" },
              { icon: "👁️", label: "Visão do aluno" },
              { icon: "📈", label: "Evolução de cargas" },
              { icon: "✨", label: "Prescrever com IA" },
            ].map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => toast.info("Em desenvolvimento")}
                className="flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                <span>{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>


          {/* Goals */}
          {activeProgram.goals && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Target className="h-3.5 w-3.5" /> Objetivos
              </div>
              <p className="text-sm whitespace-pre-wrap">{activeProgram.goals}</p>
            </div>
          )}

          {/* Meta */}
          <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-3 text-xs">
            <MetaCell label="Tipo de treino" value={activeProgram.training_type === "numeric" ? "Numérico" : "Alfabético"} />
            <MetaCell label="Mostrar para o aluno" value={activeProgram.show_to_student ? "Sim" : "Não"} />
            <MetaCell label="Arquivar automaticamente" value={activeProgram.auto_archive ? "Sim" : "Não"} />
          </div>

          {/* Days */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Treinos</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setEditingDay(null); setDayOpen(true); }}
            >
              <Plus className="h-4 w-4" /> Adicionar treino
            </Button>
          </div>

          {trainingDays.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum treino adicionado ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {trainingDays.map((day) => {
                const execs = execsForDay(day.id);
                const last = execs[0];
                const isActiveDay = activeDayId === day.id;
                return (
                  <div key={day.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveDayId(isActiveDay ? null : day.id)}
                        className="flex-1 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{day.name}</span>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {day.day_label}
                          </span>
                        </div>
                        {day.description && (
                          <p className="mt-1 text-sm text-muted-foreground">{day.description}</p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {execs.length === 0
                            ? "Ainda não executado"
                            : `Executado ${execs.length}x · última em ${formatDateBR(last.executed_at)}`}
                        </p>
                      </button>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => markExecuted(day)}>
                          <CheckCircle2 className="h-4 w-4" /> Executado
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setFeedbackDay(day); setFeedbackOpen(true); }}
                        >
                          <MessageSquare className="h-4 w-4" /> Feedbacks
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditingDay(day); setDayOpen(true); }}>
                              <Pencil className="h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => deleteDay(day.id)}>
                              <Trash2 className="h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveDayId(isActiveDay ? null : day.id)}
                      >
                        {isActiveDay ? "Recolher exercícios" : "Ver exercícios"}
                      </Button>
                    </div>
                    {isActiveDay && <TrainingDayDetail dayId={day.id} />}
                  </div>
                );
              })}
            </div>
          )}

          {activeProgram.show_to_student && !activeProgram.is_archived && !activeProgram.is_deleted && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" /> Esta rotina aparece no portal do aluno em "Meu treino".
            </p>
          )}
        </Card>
      ) : null}

      <ProgramDialog
        open={programOpen}
        onOpenChange={setProgramOpen}
        program={editingProgram}
        studentId={studentId}
      />
      {activeProgramId && (
        <TrainingDayDialog
          open={dayOpen}
          onOpenChange={setDayOpen}
          day={editingDay}
          programId={activeProgramId}
        />
      )}
      <FeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        day={feedbackDay}
        studentId={studentId}
        executions={feedbackDay ? execsForDay(feedbackDay.id) : []}
      />
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

// ── Program Dialog ───────────────────────────────────────────────────────────

type ProgramForm = Partial<Program>;

function ProgramDialog({
  open, onOpenChange, program, studentId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  program: Program | null;
  studentId: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ProgramForm>({});

  useEffect(() => {
    if (!open) return;
    setForm(
      program ?? {
        training_type: "numeric",
        show_to_student: true,
        auto_archive: true,
        category: "hypertrophy",
        level: "intermediate",
        start_date: new Date().toISOString().slice(0, 10),
      },
    );
  }, [open, program]);

  async function save() {
    if (!form.name || !form.start_date) return toast.error("Nome e data inicial são obrigatórios.");
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const payload = {
      user_id: userId,
      pt_student_id: studentId,
      name: form.name,
      start_date: form.start_date,
      end_date: form.end_date || null,
      goals: form.goals || null,
      category: form.category ?? "general",
      level: form.level ?? "intermediate",
      training_type: form.training_type ?? "numeric",
      show_to_student: form.show_to_student ?? true,
      auto_archive: form.auto_archive ?? true,
    };
    const op = form.id
      ? supabase.from("pt_programs" as never).update(payload as never).eq("id", form.id)
      : supabase.from("pt_programs" as never).insert(payload as never);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Rotina atualizada" : "Rotina criada");
    qc.invalidateQueries({ queryKey: ["pt-programs", studentId] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar rotina" : "Nova rotina de treino"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Título da rotina *</Label>
            <Input
              value={form.name ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Treino Hipertrofia — S1 (2026)"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Data inicial *</Label>
              <Input
                type="date"
                value={form.start_date ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data final</Label>
              <Input
                type="date"
                value={form.end_date ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Objetivos da rotina</Label>
            <Textarea
              rows={3}
              value={form.goals ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, goals: e.target.value }))}
              placeholder="Ex: Ganho de massa muscular em membros superiores…"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select
                value={form.category ?? "general"}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nível</Label>
              <Select
                value={form.level ?? "intermediate"}
                onValueChange={(v) => setForm((f) => ({ ...f, level: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LEVEL_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de treino</Label>
            <Select
              value={form.training_type ?? "numeric"}
              onValueChange={(v) => setForm((f) => ({ ...f, training_type: v }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="numeric">Numérico (Treino 1, 2, 3…)</SelectItem>
                <SelectItem value="alphabetic">Alfabético (Treino A, B, C…)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Mostrar para o aluno</Label>
              <Select
                value={form.show_to_student ? "yes" : "no"}
                onValueChange={(v) => setForm((f) => ({ ...f, show_to_student: v === "yes" }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Sim</SelectItem>
                  <SelectItem value="no">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Arquivar automaticamente</Label>
              <Select
                value={form.auto_archive ? "yes" : "no"}
                onValueChange={(v) => setForm((f) => ({ ...f, auto_archive: v === "yes" }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Sim</SelectItem>
                  <SelectItem value="no">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Training Day Dialog ──────────────────────────────────────────────────────

function TrainingDayDialog({
  open, onOpenChange, day, programId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  day: TrainingDay | null;
  programId: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<TrainingDay>>({});

  useEffect(() => {
    if (!open) return;
    setForm(day ?? { name: "", day_label: "" });
  }, [open, day]);

  async function save() {
    if (!form.name || !form.day_label) return toast.error("Nome e dia são obrigatórios.");
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const payload = {
      user_id: userId,
      program_id: programId,
      name: form.name,
      day_label: form.day_label,
      description: form.description || null,
    };
    const op = form.id
      ? supabase.from("pt_training_days" as never).update(payload as never).eq("id", form.id)
      : supabase.from("pt_training_days" as never).insert(payload as never);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Treino atualizado" : "Treino adicionado");
    qc.invalidateQueries({ queryKey: ["pt-training-days", programId] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar treino" : "Adicionar treino"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome do treino *</Label>
            <Input
              value={form.name ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Treino 1"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Identificação do dia *</Label>
            <Input
              value={form.day_label ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, day_label: e.target.value }))}
              placeholder="Ex: Dia A"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              rows={4}
              value={form.description ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Ex: Peito, ombro e tríceps — 4 séries de cada exercício"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Feedback Dialog ──────────────────────────────────────────────────────────

function FeedbackDialog({
  open, onOpenChange, day, studentId, executions,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  day: TrainingDay | null;
  studentId: string;
  executions: Execution[];
}) {
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setFeedback(""); setRating(0); }
  }, [open]);

  async function save() {
    if (!day) return;
    if (!feedback.trim()) return toast.error("Digite um feedback.");
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) { setSaving(false); return; }
    const last = executions[0];
    let error;
    if (last) {
      ({ error } = await supabase
        .from("pt_training_executions" as never)
        .update({ feedback, rating: rating || null } as never)
        .eq("id", last.id));
    } else {
      ({ error } = await supabase.from("pt_training_executions" as never).insert({
        user_id: userId,
        training_day_id: day.id,
        pt_student_id: studentId,
        executed_at: new Date().toISOString().slice(0, 10),
        feedback,
        rating: rating || null,
      } as never));
    }
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Feedback salvo");
    qc.invalidateQueries({ queryKey: ["pt-executions", studentId] });
    setSaving(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Feedbacks{day ? ` — ${day.name} (${day.day_label})` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {executions.length > 0 && (
            <div className="max-h-40 space-y-2 overflow-y-auto">
              <p className="text-xs font-medium uppercase text-muted-foreground">Histórico</p>
              {executions.map((e) => (
                <div key={e.id} className="rounded-lg bg-muted/40 p-2 text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium">{formatDateBR(e.executed_at)}</span>
                    {e.rating ? <span>{"⭐".repeat(e.rating)}</span> : null}
                  </div>
                  {e.feedback && <p className="mt-1 text-muted-foreground">{e.feedback}</p>}
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Adicionar feedback</Label>
            <Textarea
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Como foi o treino? Observações do professor ou do aluno…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Avaliação (opcional)</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRating(s === rating ? 0 : s)}
                  className="text-2xl transition-transform hover:scale-110"
                >
                  {s <= rating ? "⭐" : "☆"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando…" : "Salvar feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
