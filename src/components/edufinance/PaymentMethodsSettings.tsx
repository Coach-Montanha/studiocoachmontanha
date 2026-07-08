import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2, GripVertical, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  DEFAULT_PAYMENT_METHODS,
  usePaymentMethods,
  type PaymentMethod,
} from "@/hooks/use-payment-methods";

function slugify(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function PaymentMethodsSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { all: methods, isLoading } = usePaymentMethods();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [seeding, setSeeding] = useState(false);

  async function seedDefaults() {
    if (!user) return;
    setSeeding(true);
    const existing = new Set(methods.map((m) => m.key));
    const toInsert = DEFAULT_PAYMENT_METHODS
      .filter((d) => !existing.has(d.key))
      .map((d, i) => ({
        user_id: user.id,
        key: d.key,
        label: d.label,
        sort_order: methods.length + i,
      }));
    if (toInsert.length === 0) {
      toast.info("Formas padrão já estão cadastradas.");
      setSeeding(false);
      return;
    }
    const { error } = await supabase.from("payment_methods").insert(toInsert);
    setSeeding(false);
    if (error) return toast.error(error.message);
    toast.success(`${toInsert.length} forma(s) padrão adicionada(s).`);
    qc.invalidateQueries({ queryKey: ["payment-methods"] });
  }

  async function toggleActive(m: PaymentMethod) {
    const { error } = await supabase
      .from("payment_methods")
      .update({ is_active: !m.is_active })
      .eq("id", m.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["payment-methods"] });
  }

  async function remove(m: PaymentMethod) {
    if (!confirm(`Excluir a forma "${m.label}"? Pagamentos já registrados com essa forma continuarão exibindo o código "${m.key}".`)) return;
    const { error } = await supabase.from("payment_methods").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Forma de pagamento excluída");
    qc.invalidateQueries({ queryKey: ["payment-methods"] });
  }

  async function move(m: PaymentMethod, direction: -1 | 1) {
    const sorted = [...methods].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((x) => x.id === m.id);
    const swap = sorted[idx + direction];
    if (!swap) return;
    const updates = [
      supabase.from("payment_methods").update({ sort_order: swap.sort_order }).eq("id", m.id),
      supabase.from("payment_methods").update({ sort_order: m.sort_order }).eq("id", swap.id),
    ];
    const results = await Promise.all(updates);
    const err = results.find((r) => r.error)?.error;
    if (err) return toast.error(err.message);
    qc.invalidateQueries({ queryKey: ["payment-methods"] });
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Formas de pagamento</h2>
          <p className="text-xs text-muted-foreground">
            Cadastre, edite e organize as formas de pagamento disponíveis nos registros.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {methods.length === 0 && (
            <Button variant="outline" size="sm" onClick={seedDefaults} disabled={seeding}>
              {seeding && <Loader2 className="h-4 w-4 animate-spin" />}
              Usar padrões
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nova forma
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : methods.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma forma de pagamento cadastrada. Use os padrões (PIX, Cartão, Boleto…) ou crie a
            sua.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {[...methods]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((m, i, arr) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-3 p-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                    onClick={() => move(m, -1)}
                    disabled={i === 0}
                    aria-label="Mover para cima"
                  >
                    <GripVertical className="h-3.5 w-3.5 rotate-180" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                    onClick={() => move(m, 1)}
                    disabled={i === arr.length - 1}
                    aria-label="Mover para baixo"
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{m.label}</span>
                    {!m.is_active && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                        Inativa
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">{m.key}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Switch checked={m.is_active} onCheckedChange={() => toggleActive(m)} />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(m);
                      setDialogOpen(true);
                    }}
                    aria-label="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(m)}
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
        </ul>
      )}

      <PaymentMethodDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        method={editing}
        nextSortOrder={methods.length}
      />
    </Card>
  );
}

function PaymentMethodDialog({
  open,
  onOpenChange,
  method,
  nextSortOrder,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  method: PaymentMethod | null;
  nextSortOrder: number;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [label, setLabel] = useState(method?.label ?? "");
  const [key, setKey] = useState(method?.key ?? "");
  const [keyTouched, setKeyTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset on open change
  useState(() => {});
  if (open && method && label === "" && method.label !== "") {
    // Sync when reopening with a different record
    setLabel(method.label);
    setKey(method.key);
  }

  function onOpen(v: boolean) {
    if (!v) {
      setLabel("");
      setKey("");
      setKeyTouched(false);
    } else {
      setLabel(method?.label ?? "");
      setKey(method?.key ?? "");
      setKeyTouched(!!method);
    }
    onOpenChange(v);
  }

  async function save() {
    if (!user) return;
    const finalLabel = label.trim();
    const finalKey = (keyTouched || method ? key : slugify(label)).trim();
    if (!finalLabel) return toast.error("Informe um nome");
    if (!finalKey) return toast.error("Informe um código");
    setSaving(true);
    const payload = {
      user_id: user.id,
      label: finalLabel,
      key: finalKey,
    };
    const op = method
      ? supabase.from("payment_methods").update(payload).eq("id", method.id)
      : supabase.from("payment_methods").insert({ ...payload, sort_order: nextSortOrder });
    const { error } = await op;
    setSaving(false);
    if (error) {
      if (error.code === "23505") return toast.error("Já existe uma forma com esse código.");
      return toast.error(error.message);
    }
    toast.success(method ? "Forma atualizada" : "Forma criada");
    qc.invalidateQueries({ queryKey: ["payment-methods"] });
    onOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{method ? "Editar forma de pagamento" : "Nova forma de pagamento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                if (!keyTouched && !method) setKey(slugify(e.target.value));
              }}
              placeholder="Ex: PIX Empresa, Dinheiro, Cartão Nubank…"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Código interno *</Label>
            <Input
              value={key}
              onChange={(e) => {
                setKey(slugify(e.target.value));
                setKeyTouched(true);
              }}
              placeholder="pix_empresa"
              className="font-mono text-sm"
              disabled={!!method}
            />
            <p className="text-xs text-muted-foreground">
              {method
                ? "O código não pode ser alterado após a criação."
                : "Gerado automaticamente. Usado internamente para identificar a forma."}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpen(false)}>
            <X className="h-4 w-4" /> Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
