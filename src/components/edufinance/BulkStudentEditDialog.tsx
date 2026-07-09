import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

type FieldKey =
  | "phone" | "email" | "status" | "birth_date"
  | "cpf" | "rg" | "start_date"
  | "address" | "postal_code" | "neighborhood" | "city" | "state" | "country";

const FIELDS: { key: FieldKey; label: string; type: "text" | "email" | "tel" | "date" | "status" }[] = [
  { key: "phone", label: "Telefone", type: "tel" },
  { key: "email", label: "Email", type: "email" },
  { key: "status", label: "Status", type: "status" },
  { key: "birth_date", label: "Data de nascimento", type: "date" },
  { key: "start_date", label: "Data de início", type: "date" },
  { key: "cpf", label: "CPF", type: "text" },
  { key: "rg", label: "RG", type: "text" },
  { key: "address", label: "Endereço", type: "text" },
  { key: "postal_code", label: "CEP", type: "text" },
  { key: "neighborhood", label: "Bairro", type: "text" },
  { key: "city", label: "Cidade", type: "text" },
  { key: "state", label: "Estado", type: "text" },
  { key: "country", label: "País", type: "text" },
];

export function BulkStudentEditDialog({
  open, onOpenChange, selectedIds, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedIds: string[];
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [field, setField] = useState<FieldKey>("phone");
  const [value, setValue] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const cfg = FIELDS.find((f) => f.key === field)!;

  async function apply() {
    if (selectedIds.length === 0) return;
    setBusy(true);
    const patch = { [field]: value === "" ? null : value } as never;
    const { error } = await supabase.from("students").update(patch).in("id", selectedIds);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${selectedIds.length} aluno(s) atualizado(s)`);
    qc.invalidateQueries();
    setValue("");
    onDone();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar em massa</DialogTitle>
          <DialogDescription>
            O campo escolhido será substituído em {selectedIds.length} aluno(s) selecionado(s). Deixe em branco para limpar o campo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Campo</Label>
            <Select value={field} onValueChange={(v) => { setField(v as FieldKey); setValue(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FIELDS.map((f) => (
                  <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Novo valor</Label>
            {cfg.type === "status" ? (
              <Select value={value} onValueChange={setValue}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="churned">Desligado</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input
                type={cfg.type === "date" ? "date" : cfg.type === "email" ? "email" : cfg.type === "tel" ? "tel" : "text"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={cfg.type === "date" ? "" : "Deixe em branco para limpar"}
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={apply} disabled={busy || (cfg.type === "status" && !value)}>
            {busy ? "Aplicando…" : `Aplicar a ${selectedIds.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
