import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRightLeft, Copy, Move, Search, Loader2, User, Check } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { migrateProgram } from "@/lib/pt-program-migrate.functions";

type Mode = "copy" | "move";

export function MigrateProgramDialog({
  open,
  onOpenChange,
  programId,
  programName,
  currentStudentId,
  onMigrated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  programId: string | null;
  programName: string | null;
  currentStudentId: string;
  onMigrated?: (targetStudentId: string, mode: Mode) => void;
}) {
  const qc = useQueryClient();
  const migrateFn = useServerFn(migrateProgram);
  const [mode, setMode] = useState<Mode>("copy");
  const [search, setSearch] = useState("");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["pt-students-picker"],
    enabled: open,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_students")
        .select("id,name,status")
        .order("name", { ascending: true });
      return (data ?? []) as Array<{
        id: string;
        name: string;
        status: string | null;
      }>;
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = students.filter((s) => s.id !== currentStudentId);
    if (!q) return list;
    return list.filter((s) => s.name.toLowerCase().includes(q));
  }, [students, search, currentStudentId]);

  async function confirm() {
    if (!programId) return;
    if (!targetId) return toast.error("Selecione um aluno de destino.");
    setSaving(true);
    try {
      const res = await migrateFn({
        data: { programId, targetStudentId: targetId, mode },
      });
      toast.success(
        mode === "copy"
          ? `Rotina copiada para ${res.targetName}`
          : `Rotina movida para ${res.targetName}`,
      );
      qc.invalidateQueries({ queryKey: ["pt-programs"] });
      onMigrated?.(targetId, mode);
      onOpenChange(false);
      setTargetId(null);
      setSearch("");
      setMode("copy");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao migrar rotina");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0 overflow-hidden">
        <DialogHeader className="space-y-2 border-b p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ArrowRightLeft className="h-4.5 w-4.5" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold leading-tight">
                Migrar rotina
              </DialogTitle>
              {programName && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {programName}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 p-5">
          {/* Mode segmented control */}
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              Como migrar
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ModeButton
                active={mode === "copy"}
                onClick={() => setMode("copy")}
                icon={<Copy className="h-4 w-4" />}
                label="Copiar"
                hint="Duplica no destino"
                tone="primary"
              />
              <ModeButton
                active={mode === "move"}
                onClick={() => setMode("move")}
                icon={<Move className="h-4 w-4" />}
                label="Mover"
                hint="Remove do atual"
                tone="destructive"
              />
            </div>
          </div>

          {/* Student picker */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              Aluno de destino
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar aluno…"
                className="pl-9"
              />
            </div>

            <div className="max-h-64 overflow-y-auto rounded-lg border bg-background">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum aluno encontrado.
                </div>
              ) : (
                <ul className="divide-y">
                  {filtered.map((s) => {
                    const selected = targetId === s.id;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => setTargetId(s.id)}
                          className={[
                            "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                            selected
                              ? "bg-primary/10 hover:bg-primary/15"
                              : "hover:bg-accent",
                          ].join(" ")}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground">
                            {s.avatar_url ? (
                              <img
                                src={s.avatar_url}
                                alt={s.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <User className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">
                              {s.name}
                            </div>
                            {s.status && (
                              <div className="mt-0.5 text-xs capitalize text-muted-foreground">
                                {s.status}
                              </div>
                            )}
                          </div>
                          {selected && (
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-3 w-3" strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t bg-muted/30 p-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={confirm}
            disabled={!targetId || saving}
            variant={mode === "move" ? "destructive" : "default"}
            className="min-w-32"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {mode === "copy" ? "Copiando…" : "Movendo…"}
              </>
            ) : mode === "copy" ? (
              <>
                <Copy className="h-4 w-4" /> Copiar rotina
              </>
            ) : (
              <>
                <Move className="h-4 w-4" /> Mover rotina
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
  hint,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
  tone: "primary" | "destructive";
}) {
  const activeClass =
    tone === "primary"
      ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
      : "border-destructive/60 bg-destructive/10 text-foreground ring-1 ring-destructive/30";
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? activeClass
          : "border-border bg-background hover:border-foreground/20 hover:bg-accent",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
          active
            ? tone === "primary"
              ? "bg-primary text-primary-foreground"
              : "bg-destructive text-destructive-foreground"
            : "bg-muted text-muted-foreground group-hover:text-foreground",
        ].join(" ")}
      >
        {icon}
      </div>
      <div className="text-sm font-semibold">{label}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </button>
  );
}
