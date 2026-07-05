import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatBRL, formatDateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/diagnostics")({
  head: () => ({ meta: [{ title: "Diagnóstico — EduFinance" }] }),
  component: DiagnosticsPage,
});

function DiagnosticsPage() {
  const qc = useQueryClient();
  const [threshold, setThreshold] = useState("100");
  const [fixing, setFixing] = useState(false);
  const [deleted, setDeleted] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const {
    data: lowPayments = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["diagnostics-low-payments", threshold],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(
          "id,amount,payment_date,reference_month,status,student_id,plan_id,students(name),plans(name)",
        )
        .lt("amount", Number(threshold))
        .order("amount", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: duplicates = [], isLoading: loadingDupes } = useQuery({
    queryKey: ["diagnostics-duplicates"],
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      while (true) {
        const { data } = await supabase
          .from("payments")
          .select(
            "id,amount,payment_date,reference_month,status,student_id,students(name),plans(name)",
          )
          .order("payment_date", { ascending: false })
          .range(from, from + 999);
        all = all.concat(data ?? []);
        if (!data || data.length < 1000) break;
        from += 1000;
      }
      const seen = new Map();
      const dupes: any[] = [];
      for (const p of all) {
        const key = `${p.student_id}|${p.reference_month}|${p.amount}|${p.payment_date}`;
        if (seen.has(key)) {
          dupes.push({ ...p, original_id: seen.get(key).id });
        } else {
          seen.set(key, p);
        }
      }
      return dupes;
    },
  });

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(lowPayments.map((p: any) => p.id)));
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return toast.error("Selecione ao menos um registro.");
    if (!confirm(`Excluir ${selectedIds.size} pagamento(s) selecionado(s)? Esta ação não pode ser desfeita.`)) return;
    setFixing(true);
    const ids = [...selectedIds];
    let count = 0;
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      const { error } = await supabase.from("payments").delete().in("id", batch);
      if (!error) count += batch.length;
    }
    setDeleted(count);
    setSelectedIds(new Set());
    setFixing(false);
    toast.success(`${count} pagamento(s) excluído(s).`);
    qc.invalidateQueries();
    refetch();
  }

  async function deleteAllDuplicates() {
    if (duplicates.length === 0) return toast.success("Nenhuma duplicata encontrada.");
    if (!confirm(`Excluir ${duplicates.length} pagamento(s) duplicado(s)?`)) return;
    setFixing(true);
    const ids = duplicates.map((d: any) => d.id);
    let count = 0;
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      const { error } = await supabase.from("payments").delete().in("id", batch);
      if (!error) count += batch.length;
    }
    setFixing(false);
    toast.success(`${count} duplicata(s) removida(s).`);
    qc.invalidateQueries();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">🔧 Diagnóstico de Dados</h1>
          <p className="text-muted-foreground mt-1">
            Página administrativa para identificar e corrigir inconsistências nos dados.
            Acesse por: /diagnostics
          </p>
        </div>
      </div>

      {/* SECTION 1: Low value payments */}
      <Card className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Pagamentos com valor abaixo do limite</h2>
            <p className="text-muted-foreground text-sm">
              Identifique registros com valores suspeitos.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="threshold">Valor mínimo (R$)</Label>
              <Input
                id="threshold"
                type="number"
                value={threshold}
                onChange={(e) => {
                  setThreshold(e.target.value);
                  setSelectedIds(new Set());
                }}
              />
            </div>
            <Button variant="outline" onClick={() => refetch()}>
              Atualizar
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground py-8 text-center">Carregando…</p>
        ) : lowPayments.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">
            ✅ Nenhum pagamento encontrado abaixo de R$ {threshold}.
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-sm">
                {lowPayments.length} registro(s) encontrado(s)
              </span>
              <Button variant="outline" size="sm" onClick={selectAll}>
                Selecionar todos
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Limpar seleção
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={selectedIds.size === 0 || fixing}
                onClick={deleteSelected}
              >
                {fixing ? "Excluindo…" : `Excluir selecionados (${selectedIds.size})`}
              </Button>
            </div>

            {deleted !== null && (
              <p className="text-sm text-green-600 mt-2">
                ✅ {deleted} registro(s) excluído(s) com sucesso.
              </p>
            )}

            <div className="mt-4 overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={lowPayments.length > 0 && selectedIds.size === lowPayments.length}
                        onCheckedChange={(checked) =>
                          checked ? selectAll() : setSelectedIds(new Set())
                        }
                        aria-label="Selecionar todos"
                      />
                    </TableHead>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data Pagamento</TableHead>
                    <TableHead>Mês Referência</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowPayments.map((p: any) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => toggleSelect(p.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(p.id)}
                          onCheckedChange={() => toggleSelect(p.id)}
                          aria-label={`Selecionar pagamento ${p.id}`}
                        />
                      </TableCell>
                      <TableCell>{p.students?.name ?? "—"}</TableCell>
                      <TableCell>{p.plans?.name ?? "—"}</TableCell>
                      <TableCell>{formatBRL(p.amount)}</TableCell>
                      <TableCell>{formatDateBR(p.payment_date)}</TableCell>
                      <TableCell>{p.reference_month}</TableCell>
                      <TableCell>{p.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>

      {/* SECTION 2: Duplicates */}
      <Card className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Pagamentos duplicados</h2>
            <p className="text-muted-foreground text-sm">
              Mesmo aluno + mesmo mês + mesmo valor + mesma data.
            </p>
          </div>
          <Button
            variant="destructive"
            disabled={duplicates.length === 0 || fixing}
            onClick={deleteAllDuplicates}
          >
            {fixing ? "Removendo…" : `Remover todas (${duplicates.length})`}
          </Button>
        </div>

        {loadingDupes ? (
          <p className="text-muted-foreground py-8 text-center">Analisando…</p>
        ) : duplicates.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">
            ✅ Nenhuma duplicata encontrada.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Mês Referência</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {duplicates.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.students?.name ?? "—"}</TableCell>
                    <TableCell>{p.reference_month}</TableCell>
                    <TableCell>{formatBRL(p.amount)}</TableCell>
                    <TableCell>{formatDateBR(p.payment_date)}</TableCell>
                    <TableCell>{p.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
