import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { generateClassSessions } from "@/lib/classes.functions";
import { useServerFn } from "@tanstack/react-start";
import { DaysOfWeekChips, formatDaysOfWeek } from "@/components/edufinance/DaysOfWeekChips";

export const Route = createFileRoute("/_authenticated/turmas")({
  head: () => ({ meta: [{ title: "Turmas — Studio" }] }),
  component: TurmasPage,
});

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

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

function TurmasPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<ClassRow> | null>(null);
  const [selected, setSelected] = useState<{ id: string; dow: number } | null>(null);
  const genSessions = useServerFn(generateClassSessions);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id,name,trainer_name,day_of_week,days_of_week,start_time,duration_minutes,capacity,is_active,is_recurring,notes,program_id,checkin_opens_minutes_before,checkin_closes_minutes_before")
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as ClassRow[];
    },
  });

  const { data: programs = [] } = useQuery({
    queryKey: ["programs-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("programs").select("id,name,color").order("name");
      return data ?? [];
    },
  });

  // Counts are based on check-ins (class_attendance) of the NEXT upcoming session
  // per class PER WEEKDAY, so a class that runs on multiple days shows the
  // correct occupancy for each day column (matches the Agenda tab).
  const { data: counts = {} } = useQuery({
    queryKey: ["class-counts-next-session-by-dow"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data: sess } = await supabase
        .from("class_sessions")
        .select("id, class_id, session_date, start_time")
        .gte("session_date", today)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true });
      // Pick the first future session for each (class_id, weekday) pair.
      const nextByClassDow = new Map<string, string>();
      (sess ?? []).forEach((s: any) => {
        const dow = new Date(`${s.session_date}T00:00:00`).getDay();
        const key = `${s.class_id}-${dow}`;
        if (!nextByClassDow.has(key)) nextByClassDow.set(key, s.id);
      });
      const sessionIds = Array.from(nextByClassDow.values());
      const map: Record<string, number> = {};
      if (sessionIds.length > 0) {
        const { data: att } = await supabase
          .from("class_attendance")
          .select("session_id")
          .in("session_id", sessionIds);
        const perSession: Record<string, number> = {};
        (att ?? []).forEach((r: any) => {
          perSession[r.session_id] = (perSession[r.session_id] ?? 0) + 1;
        });
        nextByClassDow.forEach((sid, key) => {
          map[key] = perSession[sid] ?? 0;
        });
      }
      return map;
    },
  });

  const byDay: Record<number, ClassRow[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  classes.forEach((c) => {
    const days = c.days_of_week && c.days_of_week.length > 0
      ? c.days_of_week
      : c.day_of_week !== null && c.day_of_week !== undefined
        ? [c.day_of_week]
        : [];
    days.forEach((d) => {
      if (byDay[d]) byDay[d].push(c);
    });
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

  function openEdit(c: ClassRow) {
    setEditing({
      ...c,
      days_of_week: c.days_of_week && c.days_of_week.length > 0
        ? c.days_of_week
        : c.day_of_week !== null && c.day_of_week !== undefined
          ? [c.day_of_week]
          : [],
    });
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
      day_of_week: editing.days_of_week![0] ?? null, // keep legacy field synced with first day
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
        await genSessions({ data: { classId, weeks: 12 } });
      } catch (e: any) {
        toast.error(`Turma salva, mas a agenda não foi gerada: ${e.message}`);
      }
    }
    toast.success(editing.id ? "Turma atualizada" : "Turma criada");
    qc.invalidateQueries();
    setDialogOpen(false);
  }

  async function deleteClass(id: string) {
    if (!confirm("Excluir esta turma? Todas as matrículas e sessões serão removidas.")) return;
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Turma excluída");
    qc.invalidateQueries();
  }

  async function generate(id: string) {
    try {
      const res = await genSessions({ data: { classId: id, weeks: 12 } });
      toast.success(`${res.created} sessões criadas`);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const selectedClass = selected ? classes.find((c) => c.id === selected.id) : undefined;
  const programColor = (id: string | null) => programs.find((p: any) => p.id === id)?.color ?? "#94a3b8";
  const programName = (id: string | null) => programs.find((p: any) => p.id === id)?.name ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Turmas do Studio</h1>
          <p className="text-sm text-muted-foreground">Uma turma pode acontecer em vários dias — clique para ver detalhes.</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Nova turma
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-7">
        {DOW.map((label, dow) => (
          <div key={dow} className="min-h-[200px]">
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-2 text-center">{label}</div>
            <div className="space-y-2">
              {byDay[dow].length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">—</div>
              ) : (
                byDay[dow].map((c) => {
                  const filled = (counts as any)[`${c.id}-${dow}`] ?? 0;
                  const isFull = filled >= c.capacity;
                  return (
                    <button
                      key={`${dow}-${c.id}`}
                      onClick={() => setSelected({ id: c.id, dow })}
                      className={`w-full text-left rounded-lg border-l-4 border border-l-4 p-2 hover:border-primary transition ${
                        c.is_active ? "bg-card" : "bg-muted opacity-60"
                      }`}
                      style={{ borderLeftColor: programColor(c.program_id) }}
                    >
                      <div className="text-sm font-semibold truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {String(c.start_time).slice(0, 5)} · {c.duration_minutes}min
                      </div>
                      {programName(c.program_id) && (
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
                          {programName(c.program_id)}
                        </div>
                      )}
                      {c.trainer_name && (
                        <div className="text-xs text-muted-foreground truncate">{c.trainer_name}</div>
                      )}
                      <div className={`text-[10px] mt-1 font-mono ${isFull ? "text-destructive" : "text-emerald-600"}`}>
                        {filled}/{c.capacity} vagas
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Dialog: create/edit class */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar turma" : "Nova turma"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Nome *</Label>
              <Input value={editing?.name ?? ""} onChange={(e) => setEditing((f) => ({ ...f!, name: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Treinador</Label>
              <Input value={editing?.trainer_name ?? ""} onChange={(e) => setEditing((f) => ({ ...f!, trainer_name: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Programa</Label>
              <Select
                value={editing?.program_id ?? "none"}
                onValueChange={(v) => setEditing((f) => ({ ...f!, program_id: v === "none" ? null : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Sem programa" /></SelectTrigger>
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
              <Input type="time" value={editing?.start_time ?? "07:00"} onChange={(e) => setEditing((f) => ({ ...f!, start_time: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Duração (min)</Label>
              <Input type="number" value={editing?.duration_minutes ?? 60} onChange={(e) => setEditing((f) => ({ ...f!, duration_minutes: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Capacidade</Label>
              <Input type="number" value={editing?.capacity ?? 10} onChange={(e) => setEditing((f) => ({ ...f!, capacity: Number(e.target.value) }))} />
            </div>
            <div className="col-span-2 pt-2 border-t space-y-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Janela de check-in do aluno</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Abre X min antes</Label>
                  <Input type="number" min={0} value={editing?.checkin_opens_minutes_before ?? 60} onChange={(e) => setEditing((f) => ({ ...f!, checkin_opens_minutes_before: Number(e.target.value) }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha X min antes</Label>
                  <Input type="number" min={0} value={editing?.checkin_closes_minutes_before ?? 15} onChange={(e) => setEditing((f) => ({ ...f!, checkin_closes_minutes_before: Number(e.target.value) }))} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Ex: 60 e 15 → o aluno pode marcar/desmarcar entre 60 min antes e 15 min antes do início.
              </p>
            </div>
            <div className="col-span-2 flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={editing?.is_active ?? true} onCheckedChange={(v) => setEditing((f) => ({ ...f!, is_active: v }))} />
                Ativa
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={editing?.is_recurring ?? true} onCheckedChange={(v) => setEditing((f) => ({ ...f!, is_recurring: v }))} />
                Recorrente semanal
              </label>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notas</Label>
              <Textarea rows={2} value={editing?.notes ?? ""} onChange={(e) => setEditing((f) => ({ ...f!, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveClass}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet: class details */}
      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedClass?.name}
              {selected && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({DOW[selected.dow]})
                </span>
              )}
            </SheetTitle>
          </SheetHeader>
          {selectedClass && selected && (
            <ClassDetails
              cls={selectedClass}
              dow={selected.dow}
              programName={programName(selectedClass.program_id)}
              onEdit={() => { openEdit(selectedClass); setSelected(null); }}
              onDelete={() => { deleteClass(selectedClass.id); setSelected(null); }}
              onGenerate={() => generate(selectedClass.id)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ClassDetails({
  cls,
  programName,
  onEdit,
  onDelete,
  onGenerate,
}: {
  cls: ClassRow;
  programName: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onGenerate: () => void;
}) {



  const { data: nextSession } = useQuery({
    queryKey: ["class-next-session", cls.id],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("class_sessions")
        .select("id, session_date, start_time")
        .eq("class_id", cls.id)
        .gte("session_date", today)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: checkedIn = [] } = useQuery({
    queryKey: ["class-checkins", cls.id, nextSession?.id],
    enabled: !!nextSession?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("class_attendance")
        .select("id, students(id,name,email,phone)")
        .eq("session_id", nextSession!.id);
      return (data ?? []) as any[];
    },
  });

  return (
    <div className="space-y-4 py-4">
      <Card className="p-4 space-y-2 text-sm">
        <div><span className="text-muted-foreground">Dias:</span> {formatDaysOfWeek(cls.days_of_week)}</div>
        <div><span className="text-muted-foreground">Horário:</span> {String(cls.start_time).slice(0, 5)}</div>
        <div><span className="text-muted-foreground">Duração:</span> {cls.duration_minutes} min</div>
        <div><span className="text-muted-foreground">Programa:</span> {programName ?? "—"}</div>
        <div><span className="text-muted-foreground">Treinador:</span> {cls.trainer_name ?? "—"}</div>
        <div><span className="text-muted-foreground">Vagas (próx. sessão):</span> {checkedIn.length}/{cls.capacity}</div>
        <div><span className="text-muted-foreground">Janela check-in:</span> {cls.checkin_opens_minutes_before}min antes → {cls.checkin_closes_minutes_before}min antes</div>
        {cls.notes && <div className="pt-2 border-t"><span className="text-muted-foreground">Notas:</span> {cls.notes}</div>}
      </Card>

      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="h-3 w-3 mr-1" />Editar</Button>
        {cls.is_recurring && <Button size="sm" variant="outline" onClick={onGenerate}>Gerar 12 semanas</Button>}
        <Button size="sm" variant="destructive" onClick={onDelete}><Trash2 className="h-3 w-3 mr-1" />Excluir</Button>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-4 w-4" />
          <h3 className="font-semibold text-sm">
            Check-ins da próxima sessão ({checkedIn.length})
          </h3>
        </div>
        {nextSession ? (
          <p className="text-xs text-muted-foreground mb-2">
            {new Date(`${nextSession.session_date}T${nextSession.start_time}`).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mb-2">Nenhuma sessão futura agendada</p>
        )}
        <div className="space-y-1">
          {checkedIn.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum aluno fez check-in ainda</p>
          ) : (
            checkedIn.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <div>
                  <div className="font-medium">{e.students?.name}</div>
                  {e.students?.phone && <div className="text-xs text-muted-foreground">{e.students.phone}</div>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
