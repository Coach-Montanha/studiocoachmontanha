import { createFileRoute } from "@tanstack/react-router";
import { confirmDialog } from "@/lib/confirm-dialog";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AgendaView } from "@/components/edufinance/AgendaView";
import { DaysOfWeekChips, formatDaysOfWeek } from "@/components/edufinance/DaysOfWeekChips";
import {
  generateClassSessions,
  deleteClassSession,
  deleteClassSessionsFrom,
  deleteClassAll,
  updateClassSessionOverrides,
  updateClassSessionsFromOverrides,
  type AgendaSession,
} from "@/lib/classes.functions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({ meta: [{ title: "Turmas & Agenda — Studio" }] }),
  component: AgendaPage,
});

type ClassRow = {
  id: string;
  name: string;
  trainer_name: string | null;
  day_of_week: number | null;
  days_of_week: number[] | null;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  is_active: boolean;
  is_recurring: boolean;
  notes: string | null;
  program_id: string | null;
  checkin_opens_minutes_before: number;
  checkin_closes_minutes_before: number;
};

function AgendaPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<ClassRow> | null>(null);
  const [selected, setSelected] = useState<AgendaSession | null>(null);
  const [weeksToGenerate, setWeeksToGenerate] = useState<number>(12);
  const genSessions = useServerFn(generateClassSessions);

  const { data: programs = [] } = useQuery({
    queryKey: ["programs-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("programs").select("id,name,color").order("name");
      return data ?? [];
    },
  });

  function openNew() {
    setEditing({
      name: "",
      trainer_name: "",
      days_of_week: [1],
      start_time: "07:00",
      duration_minutes: 60,
      capacity: 10,
      is_active: true,
      is_recurring: true,
      program_id: null,
      checkin_opens_minutes_before: 60,
      checkin_closes_minutes_before: 15,
    });
    setDialogOpen(true);
  }

  async function openEditFromSession(classId: string) {
    const { data, error } = await supabase
      .from("classes")
      .select("id,name,trainer_name,day_of_week,days_of_week,start_time,duration_minutes,capacity,is_active,is_recurring,notes,program_id,checkin_opens_minutes_before,checkin_closes_minutes_before")
      .eq("id", classId)
      .maybeSingle();
    if (error || !data) return toast.error(error?.message ?? "Turma não encontrada");
    setEditing({
      ...(data as ClassRow),
      days_of_week: data.days_of_week && data.days_of_week.length > 0
        ? data.days_of_week
        : data.day_of_week !== null && data.day_of_week !== undefined
          ? [data.day_of_week]
          : [],
    });
    setSelected(null);
    setDialogOpen(true);
  }

  async function saveClass() {
    if (!editing?.name) return toast.error("Nome obrigatório");
    if (!editing.days_of_week || editing.days_of_week.length === 0) return toast.error("Selecione ao menos um dia");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const payload = {
      user_id: u.user.id,
      name: editing.name!,
      trainer_name: editing.trainer_name || null,
      days_of_week: editing.days_of_week!,
      day_of_week: editing.days_of_week![0] ?? null,
      start_time: editing.start_time || "07:00",
      duration_minutes: editing.duration_minutes ?? 60,
      capacity: editing.capacity ?? 10,
      is_active: editing.is_active ?? true,
      is_recurring: editing.is_recurring ?? true,
      notes: editing.notes || null,
      program_id: editing.program_id || null,
      checkin_opens_minutes_before: editing.checkin_opens_minutes_before ?? 60,
      checkin_closes_minutes_before: editing.checkin_closes_minutes_before ?? 15,
    };
    const { data: saved, error } = editing.id
      ? await supabase.from("classes").update(payload).eq("id", editing.id).select("id").single()
      : await supabase.from("classes").insert(payload).select("id").single();
    if (error) return toast.error(error.message);
    const classId = editing.id ?? saved?.id;
    if (classId && payload.is_active && payload.is_recurring) {
      try {
        await genSessions({ data: { classId, weeks: weeksToGenerate } });
      } catch (e: any) {
        toast.error(`Turma salva, mas a agenda não foi gerada: ${e.message}`);
      }
    }
    toast.success(editing.id ? "Turma atualizada" : "Turma criada");
    qc.invalidateQueries();
    setDialogOpen(false);
  }

  const delOne = useServerFn(deleteClassSession);
  const delFrom = useServerFn(deleteClassSessionsFrom);
  const delAll = useServerFn(deleteClassAll);

  async function runDelete(session: AgendaSession, scope: "one" | "from" | "all") {
    try {
      if (scope === "one") await delOne({ data: { sessionId: session.id } });
      else if (scope === "from") await delFrom({ data: { sessionId: session.id } });
      else if (scope === "all") {
        if (!session.class_id) {
          await delOne({ data: { sessionId: session.id } });
        } else {
          await delAll({ data: { classId: session.class_id } });
        }
      }
      toast.success("Excluído");
      qc.invalidateQueries();
      setSelected(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function generate(classId: string, weeks: number) {
    try {
      const res = await genSessions({ data: { classId, weeks } });
      toast.success(`${res.created} sessões criadas`);
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">Turmas & Agenda</h1>
          <p className="text-sm text-muted-foreground">
            Suas turmas semanais e a ocupação em tempo real. Toque em um card para gerenciar.
          </p>
        </div>
        <Button className="h-11 w-full sm:h-10 sm:w-auto" onClick={openNew}>
          <Plus className="h-4 w-4" /> Nova turma
        </Button>
      </div>

      <AgendaView
        renderCard={(s) => (
          <button
            type="button"
            onClick={() => setSelected(s)}
            className="w-full text-left"
          >
            <Card
              className="min-h-[44px] space-y-1 border-l-4 p-2 transition hover:border-primary active:scale-[0.99]"
              style={{ borderLeftColor: s.program_color ?? "var(--color-border)" }}
            >
              <div className="text-xs font-semibold">{String(s.start_time).slice(0, 5)}</div>
              <div className="truncate text-sm font-medium">{s.class_name}</div>
              {s.program_name && (
                <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                  {s.program_name}
                </div>
              )}
              {s.trainer_name && (
                <div className="truncate text-xs text-muted-foreground">{s.trainer_name}</div>
              )}
              <div className={`font-mono text-[10px] ${s.filled >= s.capacity ? "text-destructive" : "text-emerald-600"}`}>
                {s.filled}/{s.capacity}
              </div>
            </Card>
          </button>
        )}
      />

      {/* Session details sheet */}
      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="pr-6">{selected?.class_name}</SheetTitle>
          </SheetHeader>
          {selected && (
            <SessionDetails
              session={selected}
              onEdit={() => selected.class_id && openEditFromSession(selected.class_id)}
              onDelete={(scope) => void runDelete(selected, scope)}
              onGenerate={(weeks) => { if (selected.class_id) void generate(selected.class_id, weeks); }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Create/Edit turma dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar turma" : "Nova turma"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Nome *</Label>
              <Input className="h-11 sm:h-10" value={editing?.name ?? ""} onChange={(e) => setEditing((f) => ({ ...f!, name: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Treinador</Label>
              <Input className="h-11 sm:h-10" value={editing?.trainer_name ?? ""} onChange={(e) => setEditing((f) => ({ ...f!, trainer_name: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Programa</Label>
              <Select
                value={editing?.program_id ?? "none"}
                onValueChange={(v) => setEditing((f) => ({ ...f!, program_id: v === "none" ? null : v }))}
              >
                <SelectTrigger className="h-11 sm:h-10"><SelectValue placeholder="Sem programa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem programa</SelectItem>
                  {programs.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Dias da semana *</Label>
              <DaysOfWeekChips
                value={editing?.days_of_week ?? []}
                onChange={(v) => setEditing((f) => ({ ...f!, days_of_week: v }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Horário</Label>
              <Input className="h-11 sm:h-10" type="time" value={editing?.start_time ?? "07:00"} onChange={(e) => setEditing((f) => ({ ...f!, start_time: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Duração (min)</Label>
              <Input className="h-11 sm:h-10" type="number" value={editing?.duration_minutes ?? 60} onChange={(e) => setEditing((f) => ({ ...f!, duration_minutes: Number(e.target.value) }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Capacidade</Label>
              <Input className="h-11 sm:h-10" type="number" value={editing?.capacity ?? 10} onChange={(e) => setEditing((f) => ({ ...f!, capacity: Number(e.target.value) }))} />
            </div>
            <div className="col-span-2 space-y-3 border-t pt-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Janela de check-in do aluno</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Abre X min antes</Label>
                  <Input className="h-11 sm:h-10" type="number" min={0} value={editing?.checkin_opens_minutes_before ?? 60} onChange={(e) => setEditing((f) => ({ ...f!, checkin_opens_minutes_before: Number(e.target.value) }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha X min antes</Label>
                  <Input className="h-11 sm:h-10" type="number" min={0} value={editing?.checkin_closes_minutes_before ?? 15} onChange={(e) => setEditing((f) => ({ ...f!, checkin_closes_minutes_before: Number(e.target.value) }))} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Ex: 60 e 15 → o aluno pode marcar/desmarcar entre 60 min antes e 15 min antes do início.
              </p>
            </div>
            <div className="col-span-2 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={editing?.is_active ?? true} onCheckedChange={(v) => setEditing((f) => ({ ...f!, is_active: v }))} />
                Ativa
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={editing?.is_recurring ?? true} onCheckedChange={(v) => setEditing((f) => ({ ...f!, is_recurring: v }))} />
                Recorrente semanal
              </label>
            </div>
            {(editing?.is_recurring ?? true) && (
              <div className="col-span-2 space-y-1.5">
                <Label>Gerar sessões para</Label>
                <Select value={String(weeksToGenerate)} onValueChange={(v) => setWeeksToGenerate(Number(v))}>
                  <SelectTrigger className="h-11 sm:h-10"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[240px]">
                    {Array.from({ length: 52 }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} {n === 1 ? "semana" : "semanas"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Sessões recorrentes serão pré-criadas para este prazo (1 a 52 semanas).
                </p>
              </div>
            )}
            <div className="col-span-2 space-y-1.5">
              <Label>Notas</Label>
              <Textarea rows={2} value={editing?.notes ?? ""} onChange={(e) => setEditing((f) => ({ ...f!, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="h-11 sm:h-10" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button className="h-11 sm:h-10" onClick={saveClass}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SessionDetails({
  session,
  onEdit,
  onDelete,
  onGenerate,
}: {
  session: AgendaSession;
  onEdit: () => void;
  onDelete: (scope: "one" | "from" | "all") => void;
  onGenerate: (weeks: number) => void;
}) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [genWeeks, setGenWeeks] = useState(12);
  const [addSearch, setAddSearch] = useState("");
  const [delOpen, setDelOpen] = useState(false);
  const [delScope, setDelScope] = useState<"one" | "from" | "all">("one");
  const [sessionEditOpen, setSessionEditOpen] = useState(false);

  const { data: classInfo } = useQuery({
    queryKey: ["class-info", session.class_id],
    enabled: !!session.class_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("classes")
        .select("days_of_week,day_of_week,duration_minutes,notes,is_recurring")
        .eq("id", session.class_id!)
        .maybeSingle();
      return data;
    },
  });

  const { data: checkedIn = [] } = useQuery({
    queryKey: ["session-checkins", session.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("class_attendance")
        .select("id, students(id,name,email,phone)")
        .eq("session_id", session.id);
      return (data ?? []) as any[];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students-lookup-with-status"],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("id, name, status").order("name");
      return (data ?? []) as { id: string; name: string; status: string | null }[];
    },
  });

  const [showAllStudents, setShowAllStudents] = useState(false);
  const checkedInIds = new Set(checkedIn.map((c: any) => c.students?.id).filter(Boolean));
  const notCheckedIn = students.filter((s) => !checkedInIds.has(s.id));
  const activeStudents = notCheckedIn.filter((s) => s.status === "active");
  const availableStudents = showAllStudents ? notCheckedIn : activeStudents;
  const hiddenInactiveCount = notCheckedIn.length - activeStudents.length;
  const isFull = checkedIn.length >= session.capacity;

  const daysList = classInfo?.days_of_week && classInfo.days_of_week.length > 0
    ? classInfo.days_of_week
    : classInfo?.day_of_week !== null && classInfo?.day_of_week !== undefined
      ? [classInfo.day_of_week as number]
      : [];

  async function removeCheckin(id: string, name?: string) {
    if (!(await confirmDialog(`Remover o check-in de ${name ?? "este aluno"}?`))) return;
    const { error } = await supabase.from("class_attendance").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Check-in removido");
    qc.invalidateQueries();
  }

  async function addCheckin(studentId: string) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("class_attendance").insert({
      session_id: session.id,
      student_id: studentId,
      user_id: u.user.id,
      status: "present",
    });
    if (error) return toast.error(error.message);
    toast.success("Check-in adicionado");
    qc.invalidateQueries();
  }

  const when = new Date(`${session.session_date}T${session.start_time}`);

  return (
    <div className="space-y-4 py-4">
      <Card className="space-y-1.5 p-4 text-sm">
        <div>
          <span className="text-muted-foreground">Sessão:</span>{" "}
          {when.toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" })}
        </div>
        <div><span className="text-muted-foreground">Duração:</span> {session.duration_minutes} min</div>
        <div><span className="text-muted-foreground">Programa:</span> {session.program_name ?? "—"}</div>
        <div><span className="text-muted-foreground">Treinador:</span> {session.trainer_name ?? "—"}</div>
        <div><span className="text-muted-foreground">Vagas:</span> {session.filled}/{session.capacity}</div>
        {daysList.length > 0 && (
          <div><span className="text-muted-foreground">Recorre:</span> {formatDaysOfWeek(daysList)}</div>
        )}
        <div>
          <span className="text-muted-foreground">Janela check-in:</span>{" "}
          {session.checkin_opens_minutes_before}min antes → {session.checkin_closes_minutes_before}min antes
        </div>
        {classInfo?.notes && (
          <div className="border-t pt-2"><span className="text-muted-foreground">Notas:</span> {classInfo.notes}</div>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" className="h-11 sm:h-9" onClick={() => setSessionEditOpen(true)}>
          <Pencil className="mr-1 h-3 w-3" /> Editar esta sessão
        </Button>
        <Button size="sm" variant="outline" className="h-11 sm:h-9" onClick={onEdit}>
          <Pencil className="mr-1 h-3 w-3" /> Editar turma (modelo)
        </Button>
        {classInfo?.is_recurring && (
          <div className="flex items-center gap-1">
            <Select value={String(genWeeks)} onValueChange={(v) => setGenWeeks(Number(v))}>
              <SelectTrigger className="h-11 w-[92px] sm:h-9"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-[240px]">
                {Array.from({ length: 52 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} {n === 1 ? "semana" : "semanas"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-11 sm:h-9" onClick={() => onGenerate(genWeeks)}>
              Gerar
            </Button>
          </div>
        )}
        <Button
          size="sm"
          variant="destructive"
          className="h-11 sm:h-9"
          onClick={() => { setDelScope("one"); setDelOpen(true); }}
        >
          <Trash2 className="mr-1 h-3 w-3" /> Excluir…
        </Button>
      </div>

      <AlertDialog open={delOpen} onOpenChange={setDelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir turma</AlertDialogTitle>
            <AlertDialogDescription>
              Escolha o alcance da exclusão. Sessões recorrentes agora são
              independentes — você pode remover apenas esta, esta e todas as
              futuras, ou a turma inteira.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <RadioGroup value={delScope} onValueChange={(v) => setDelScope(v as any)} className="space-y-2 py-2">
            <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm">
              <RadioGroupItem value="one" id="scope-one" className="mt-0.5" />
              <div>
                <div className="font-medium">Somente esta sessão</div>
                <div className="text-xs text-muted-foreground">
                  Remove apenas a aula deste dia/horário. Nenhuma outra é afetada.
                </div>
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm">
              <RadioGroupItem value="from" id="scope-from" className="mt-0.5" />
              <div>
                <div className="font-medium">Esta e as seguintes</div>
                <div className="text-xs text-muted-foreground">
                  Remove esta sessão e todas as futuras desta turma. Sessões passadas ficam intactas.
                </div>
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm">
              <RadioGroupItem value="all" id="scope-all" className="mt-0.5" />
              <div>
                <div className="font-medium">Todas (excluir a turma)</div>
                <div className="text-xs text-muted-foreground">
                  Remove a turma e todas as sessões (passadas e futuras) e seus check-ins.
                </div>
              </div>
            </label>
          </RadioGroup>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete(delScope)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SessionOverrideDialog
        open={sessionEditOpen}
        onOpenChange={setSessionEditOpen}
        session={session}
        onSaved={() => qc.invalidateQueries()}
      />

      <div>
        <div className="mb-2 flex items-center gap-2">
          <Users className="h-4 w-4" />
          <h3 className="text-sm font-semibold">Check-ins ({checkedIn.length}/{session.capacity})</h3>
        </div>

        <Button
          size="sm"
          className="mb-3 h-11 w-full sm:h-10"
          disabled={isFull}
          onClick={() => setAddOpen(true)}
        >
          <Plus className="mr-1 h-4 w-4" />
          {isFull ? "Turma cheia" : "Adicionar aluno ao check-in"}
        </Button>

        <div className="space-y-1">
          {checkedIn.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum aluno fez check-in ainda</p>
          ) : (
            checkedIn.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{e.students?.name}</div>
                  {e.students?.phone && <div className="truncate text-xs text-muted-foreground">{e.students.phone}</div>}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-11 w-11 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => removeCheckin(e.id, e.students?.name)}
                  aria-label="Remover check-in"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) { setAddSearch(""); setShowAllStudents(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar aluno ao check-in</DialogTitle>
          </DialogHeader>
          <Input
            className="h-11 sm:h-10"
            placeholder="Buscar aluno..."
            value={addSearch}
            onChange={(e) => setAddSearch(e.target.value)}
            autoFocus
          />
          <div className="mt-2 max-h-80 space-y-1 overflow-y-auto">
            {availableStudents.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {showAllStudents
                  ? "Todos os alunos já fizeram check-in nesta sessão."
                  : "Nenhum aluno ativo disponível."}
              </p>
            ) : (
              availableStudents
                .filter((s) => s.name.toLowerCase().includes(addSearch.toLowerCase()))
                .map((s) => (
                  <button
                    key={s.id}
                    className="min-h-[44px] w-full rounded-md border p-2 text-left text-sm transition hover:bg-accent flex items-center justify-between gap-2"
                    onClick={async () => {
                      await addCheckin(s.id);
                      setAddOpen(false);
                      setAddSearch("");
                      setShowAllStudents(false);
                    }}
                  >
                    <span className="truncate">{s.name}</span>
                    {showAllStudents && s.status && s.status !== "active" && (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
                        {s.status === "inactive" ? "inativo" : s.status === "churned" ? "cancelado" : s.status}
                      </span>
                    )}
                  </button>
                ))
            )}
          </div>
          {!showAllStudents && hiddenInactiveCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowAllStudents(true)}
            >
              Exibir todos ({hiddenInactiveCount} inativo{hiddenInactiveCount === 1 ? "" : "s"})
            </Button>
          )}
          {showAllStudents && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setShowAllStudents(false)}
            >
              Mostrar só ativos
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SessionOverrideDialog({
  open,
  onOpenChange,
  session,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  session: AgendaSession;
  onSaved: () => void;
}) {
  const updOne = useServerFn(updateClassSessionOverrides);
  const updFrom = useServerFn(updateClassSessionsFromOverrides);
  const [date, setDate] = useState(session.session_date);
  const [time, setTime] = useState(String(session.start_time).slice(0, 5));
  const [duration, setDuration] = useState(session.duration_minutes);
  const [cap, setCap] = useState<number | "">(session.capacity_override ?? session.capacity);
  const [notes, setNotes] = useState(session.session_notes ?? "");
  const [scope, setScope] = useState<"one" | "from">("one");
  const [saving, setSaving] = useState(false);

  // SessionDetails desmonta ao fechar o sheet, então o estado local
  // já reinicializa para a próxima sessão selecionada.

  async function save() {
    setSaving(true);
    try {
      const capOverride =
        cap === "" ? null : Number(cap) === session.capacity && session.capacity_override === null
          ? null
          : Number(cap);
      if (scope === "one") {
        await updOne({
          data: {
            sessionId: session.id,
            session_date: date,
            start_time: `${time}:00`,
            duration_minutes: Number(duration),
            capacity_override: capOverride,
            notes: notes.trim() ? notes.trim() : null,
          },
        });
      } else {
        // "from" não muda a data (evita colisão em série); só horário/duração/capacidade/notas
        await updFrom({
          data: {
            sessionId: session.id,
            start_time: `${time}:00`,
            duration_minutes: Number(duration),
            capacity_override: capOverride,
            notes: notes.trim() ? notes.trim() : null,
          },
        });
      }
      toast.success("Alterações salvas");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar sessão</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={scope === "from"}
                className="h-11 sm:h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Horário</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-11 sm:h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Duração (min)</Label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="h-11 sm:h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Capacidade</Label>
              <Input
                type="number"
                value={cap}
                onChange={(e) => setCap(e.target.value === "" ? "" : Number(e.target.value))}
                className="h-11 sm:h-10"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notas desta sessão</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="space-y-2 rounded-md border p-3">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Aplicar em</div>
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as any)} className="space-y-1.5">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="one" id="edit-one" />
                Somente esta sessão
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="from" id="edit-from" />
                Esta e as seguintes (mantém a data de cada uma)
              </label>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              Para alterar nome, treinador, programa ou dias da semana da turma,
              use “Editar turma (modelo)”. As sessões já geradas permanecem
              independentes.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
