import { Layers as PageIcon, Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { createFileRoute } from "@tanstack/react-router";
import { confirmDialog } from "@/lib/confirm-dialog";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useScopeFilter } from "@/hooks/use-scope-filter";

export const Route = createFileRoute("/_authenticated/programs")({
  head: () => ({ meta: [{ title: "Programas — Studio" }] }),
  component: ProgramsPage,
});

type Program = {
  id?: string;
  name?: string;
  color?: string;
  is_active?: boolean;
};

// Paleta de identificação de programas — derivada dos tokens de gráfico.
const PALETTE = [
  "var(--color-chart-1)",
  "var(--color-chart-4)",
  "var(--color-chart-3)",
  "var(--color-state-pending)",
  "var(--color-chart-2)",
  "var(--color-chart-7)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-8)",
];

function ProgramsPage() {
  const qc = useQueryClient();
  const { scopeId, scopeKey, ready } = useScopeFilter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);

  const { data: programs = [] } = useQuery({
    queryKey: ["programs", scopeKey],
    enabled: ready,
    queryFn: async () => {
      let q = supabase
        .from("programs")
        .select("id, name, color, is_active")
        .order("name");
      if (scopeId) q = q.eq("user_id", scopeId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  function openNew() {
    setEditing({ name: "", color: PALETTE[0], is_active: true });
    setDialogOpen(true);
  }
  function openEdit(p: Program) {
    setEditing(p);
    setDialogOpen(true);
  }

  async function save() {
    if (!editing?.name) return toast.error("Nome obrigatório");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const payload = {
      user_id: scopeId ?? u.user.id,
      name: editing.name!,
      color: editing.color ?? PALETTE[0],
      is_active: editing.is_active ?? true,
    };
    const op = editing.id
      ? supabase.from("programs").update(payload).eq("id", editing.id)
      : supabase.from("programs").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success(editing.id ? "Programa atualizado" : "Programa criado");
    qc.invalidateQueries({ queryKey: ["programs", scopeKey] });
    setDialogOpen(false);
  }

  async function remove(id: string) {
    if (!(await confirmDialog("Excluir este programa? As turmas vinculadas ficarão sem programa."))) return;
    const { error } = await supabase.from("programs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Programa excluído");
    qc.invalidateQueries({ queryKey: ["programs", scopeKey] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PageIcon}
        eyebrow="Studio"
        title="Programas de Treino"
        description="Agrupe suas turmas por modalidade (ex: Muay Thai, Funcional). Usado no controle de check-in por programa."
        actions={
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> Novo programa
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {programs.length === 0 ? (
          <Card className="col-span-full p-6 text-sm text-muted-foreground text-center">
            Nenhum programa cadastrado ainda.
          </Card>
        ) : (
          programs.map((p) => (
            <Card key={p.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="inline-block h-5 w-5 rounded-full border"
                  style={{ backgroundColor: p.color ?? "var(--color-chart-1)" }}
                />
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.is_active ? "Ativo" : "Inativo"}</div>
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(p.id!)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar programa" : "Novo programa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={editing?.name ?? ""} onChange={(e) => setEditing((f) => ({ ...f!, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditing((f) => ({ ...f!, color: c }))}
                    className={`h-8 w-8 rounded-full border-2 ${editing?.color === c ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={editing?.is_active ?? true} onCheckedChange={(v) => setEditing((f) => ({ ...f!, is_active: v }))} />
              Ativo
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
