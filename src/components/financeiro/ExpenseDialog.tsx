import { Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { currentMonthKey, paymentMethodLabel } from "@/lib/format";

type Category = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  segment: string;
  type: string;
};

type Expense = {
  id?: string;
  category_id?: string | null;
  description?: string;
  amount?: number;
  expense_date?: string;
  reference_month?: string;
  segment?: string;
  type?: string;
  recurrent?: boolean;
  recurrent_months?: number | null;
  payment_method?: string;
  notes?: string | null;
};

export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  expense?: Expense | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Expense>({});

  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("expense_categories")
        .select("*")
        .eq("is_active", true)
        .order("segment")
        .order("name");
      return (data ?? []) as Category[];
    },
  });

  useEffect(() => {
    if (open) {
      setForm(
        expense ?? {
          expense_date: format(new Date(), "yyyy-MM-dd"),
          reference_month: currentMonthKey(),
          segment: "general",
          type: "variable",
          recurrent: false,
          payment_method: "transfer",
        },
      );
    }
  }, [open, expense]);

  function applyCategory(catId: string) {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    setForm((f) => ({
      ...f,
      category_id: catId,
      segment: cat.segment,
      type: cat.type,
    }));
  }

  async function save() {
    if (!form.description || !form.amount || !form.expense_date) {
      return toast.error("Preencha descrição, valor e data.");
    }
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    const payload = {
      user_id: userId,
      category_id: form.category_id ?? null,
      description: form.description,
      amount: Number(form.amount),
      expense_date: form.expense_date,
      reference_month: form.reference_month ?? currentMonthKey(),
      segment: form.segment ?? "general",
      type: form.type ?? "variable",
      recurrent: form.recurrent ?? false,
      recurrent_months: form.recurrent ? (form.recurrent_months ?? null) : null,
      payment_method: form.payment_method ?? "transfer",
      notes: form.notes ?? null,
    };

    if (form.id) {
      const { error } = await supabase.from("expenses").update(payload).eq("id", form.id);
      if (error) return toast.error(error.message);
    } else {
      if (form.recurrent && form.recurrent_months && form.recurrent_months > 1) {
        const [y, m] = (form.reference_month ?? currentMonthKey()).split("-").map(Number);
        for (let i = 0; i < form.recurrent_months; i++) {
          const month = ((m - 1 + i) % 12) + 1;
          const year = y + Math.floor((m - 1 + i) / 12);
          const refMonth = `${year}-${String(month).padStart(2, "0")}`;
          await supabase.from("expenses").insert({ ...payload, reference_month: refMonth });
        }
      } else {
        const { error } = await supabase.from("expenses").insert(payload);
        if (error) return toast.error(error.message);
      }
    }

    toast.success(form.id ? "Despesa atualizada" : "Despesa registrada");
    qc.invalidateQueries();
    onOpenChange(false);
  }

  const groupedCategories = categories.reduce(
    (acc, c) => {
      const group =
        c.segment === "studio" ? "Studio" : c.segment === "pt" ? "Personal Trainer" : "Geral";
      if (!acc[group]) acc[group] = [];
      acc[group].push(c);
      return acc;
    },
    {} as Record<string, Category[]>,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeadline icon={Wallet} title={<>{form.id ? "Editar despesa" : "Nova despesa"}</>} description="Categoria, valor e data da despesa." />
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>Descrição *</Label>
            <Input
              value={form.description ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Ex: Aluguel do studio, conta de energia…"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Categoria</Label>
            <Select
              value={form.category_id ?? "none"}
              onValueChange={(v) =>
                v === "none"
                  ? setForm((f) => ({ ...f, category_id: null }))
                  : applyCategory(v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {Object.entries(groupedCategories).map(([group, cats]) => (
                  <div key={group}>
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                      {group}
                    </div>
                    {cats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Valor (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Data *</Label>
              <Input
                type="date"
                value={form.expense_date ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Mês de referência</Label>
            <Input
              type="month"
              value={form.reference_month ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, reference_month: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Segmento</Label>
              <Select
                value={form.segment ?? "general"}
                onValueChange={(v) => setForm((f) => ({ ...f, segment: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">🏢 Geral</SelectItem>
                  <SelectItem value="studio">🎯 Studio</SelectItem>
                  <SelectItem value="pt">🏋️ Personal Trainer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Tipo</Label>
              <Select
                value={form.type ?? "variable"}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">🔒 Fixa</SelectItem>
                  <SelectItem value="variable">🔄 Variável</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Forma de pagamento</Label>
            <Select
              value={form.payment_method ?? "transfer"}
              onValueChange={(v) => setForm((f) => ({ ...f, payment_method: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["pix", "credit_card", "debit_card", "bank_slip", "cash", "transfer"].map((m) => (
                  <SelectItem key={m} value={m}>
                    {paymentMethodLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Despesa recorrente?</Label>
            <Select
              value={form.recurrent ? "yes" : "no"}
              onValueChange={(v) => setForm((f) => ({ ...f, recurrent: v === "yes" }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">Não</SelectItem>
                <SelectItem value="yes">Sim</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.recurrent && (
            <div className="grid gap-1.5">
              <Label>Repetir por quantos meses?</Label>
              <Input
                type="number"
                min={1}
                value={form.recurrent_months ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, recurrent_months: Number(e.target.value) }))
                }
                placeholder="Ex: 12 (para repetir por 1 ano)"
              />
              <p className="text-xs text-muted-foreground">
                Serão criados {form.recurrent_months ?? 0} registros, um por mês.
              </p>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>Observações</Label>
            <Textarea
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
