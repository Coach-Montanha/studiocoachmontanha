import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { migrateStudents, type MigrationDirection, type MigrationMode } from "@/lib/student-migration.functions";

export function MigrateStudentsDialog({
  open, onOpenChange, ids, direction, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ids: string[];
  direction: MigrationDirection;
  onDone?: () => void;
}) {
  const [mode, setMode] = useState<MigrationMode>("copy");
  const [loading, setLoading] = useState(false);
  const migrate = useServerFn(migrateStudents);
  const qc = useQueryClient();

  const label =
    direction === "studio_to_pt"
      ? { from: "Studio", to: "Personal Trainer" }
      : { from: "Personal Trainer", to: "Studio" };
  const count = ids.length;

  async function submit() {
    setLoading(true);
    try {
      const res = await migrate({ data: { ids, direction, mode } });
      const okCount = res.results.length;
      const errCount = res.errors.length;
      if (okCount > 0) {
        toast.success(
          mode === "move"
            ? `${okCount} aluno(s) movido(s) para ${label.to}`
            : `${okCount} aluno(s) copiado(s) para ${label.to}`,
        );
      }
      if (errCount > 0) {
        toast.error(`${errCount} falha(s): ${res.errors[0].error}`);
      }
      qc.invalidateQueries();
      onOpenChange(false);
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao migrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (loading ? null : onOpenChange(v))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Migrar {count} aluno(s) — {label.from} → {label.to}
          </DialogTitle>
          <DialogDescription>
            Serão copiados: perfil básico, acesso de login (mesma senha), histórico de pagamentos e contratos.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={mode} onValueChange={(v) => setMode(v as MigrationMode)} className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/40">
            <RadioGroupItem value="copy" id="mig-copy" className="mt-0.5" />
            <div className="space-y-1">
              <div className="font-medium">Copiar (duplicar)</div>
              <div className="text-xs text-muted-foreground">
                Cria cadastro em {label.to} mantendo o original ativo em {label.from}. Pagamentos aparecerão nos dois módulos.
              </div>
            </div>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/40">
            <RadioGroupItem value="move" id="mig-move" className="mt-0.5" />
            <div className="space-y-1">
              <div className="font-medium">Mover (converter)</div>
              <div className="text-xs text-muted-foreground">
                Cria cadastro em {label.to} e remove do {label.from}. Não pode ser desfeito.
              </div>
            </div>
          </label>
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "move" ? "Mover" : "Copiar"} {count} aluno(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
