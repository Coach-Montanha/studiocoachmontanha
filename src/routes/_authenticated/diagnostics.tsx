import { createFileRoute } from "@tanstack/react-router";
import { confirmDialog } from "@/lib/confirm-dialog";
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
  const [mergeType, setMergeType] = useState<"students" | "pt_students">("students");
  const [keepId, setKeepId] = useState("");
  const [mergeIds, setMergeIds] = useState<string[]>([]);
  const [mergeSearch, setMergeSearch] = useState("");
  const [merging, setMerging] = useState(false);
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false);

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

  const { data: allStudents = [] } = useQuery({
    queryKey: ["diagnostics-all-students"],
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id,name,email,phone,status,created_at,payments(id,amount,payment_date,reference_month,status)")
        .order("name");
      return data ?? [];
    },
  });

  const { data: allPtStudents = [] } = useQuery({
    queryKey: ["diagnostics-all-pt-students"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_students")
        .select("id,name,email,phone,status,created_at,pt_payments(id,amount,payment_date,status),pt_sessions(id,session_date,status)")
        .order("name");
      return data ?? [];
    },
  });

  async function executeMerge() {
    if (!keepId || !mergeId) return toast.error("Selecione os dois perfis.");
    if (keepId === mergeId) return toast.error("Selecione perfis diferentes.");
    setMerging(true);
    try {
      if (mergeType === "students") {
        const { error: e1 } = await supabase.from("payments").update({ student_id: keepId }).eq("student_id", mergeId);
        if (e1) throw e1;
        const { error: e2 } = await supabase.from("student_plan_history").update({ student_id: keepId }).eq("student_id", mergeId);
        if (e2) throw e2;
        const { error: e3 } = await supabase.from("students").delete().eq("id", mergeId);
        if (e3) throw e3;
      } else {
        const { error: e1 } = await supabase.from("pt_sessions").update({ pt_student_id: keepId }).eq("pt_student_id", mergeId);
        if (e1) throw e1;
        const { error: e2 } = await supabase.from("pt_payments").update({ pt_student_id: keepId }).eq("pt_student_id", mergeId);
        if (e2) throw e2;
        const { error: e3 } = await supabase.from("pt_students").delete().eq("id", mergeId);
        if (e3) throw e3;
      }
      toast.success("Perfis fundidos com sucesso!");
      setKeepId("");
      setMergeId("");
      setMergeConfirmOpen(false);
      qc.invalidateQueries();
    } catch (err: any) {
      toast.error(`Erro ao fundir perfis: ${err.message}`);
    }
    setMerging(false);
  }

  const keepStudent: any = mergeType === "students"
    ? allStudents.find((s) => s.id === keepId)
    : allPtStudents.find((s) => s.id === keepId);
  const mergeStudent: any = mergeType === "students"
    ? allStudents.find((s) => s.id === mergeId)
    : allPtStudents.find((s) => s.id === mergeId);
  const keepPayments = mergeType === "students"
    ? keepStudent?.payments?.length ?? 0
    : keepStudent?.pt_payments?.length ?? 0;
  const mergePayments = mergeType === "students"
    ? mergeStudent?.payments?.length ?? 0
    : mergeStudent?.pt_payments?.length ?? 0;
  const keepSessions = mergeType === "pt_students" ? keepStudent?.pt_sessions?.length ?? 0 : null;
  const mergeSessions = mergeType === "pt_students" ? mergeStudent?.pt_sessions?.length ?? 0 : null;


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
    if (!(await confirmDialog(`Excluir ${selectedIds.size} pagamento(s) selecionado(s)? Esta ação não pode ser desfeita.`))) return;
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
    if (!(await confirmDialog(`Excluir ${duplicates.length} pagamento(s) duplicado(s)?`))) return;
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

      {/* SECTION 3: Merge profiles */}
      <Card className="p-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">🔀 Fundir perfis duplicados</h2>
          <p className="text-muted-foreground text-sm">
            Selecione dois perfis da mesma pessoa. Todos os pagamentos e sessões do perfil removido
            serão transferidos para o perfil mantido.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mergeType === "students" ? "default" : "outline"}
            onClick={() => { setMergeType("students"); setKeepId(""); setMergeId(""); }}
          >
            Alunos padrão
          </Button>
          <Button
            size="sm"
            variant={mergeType === "pt_students" ? "default" : "outline"}
            onClick={() => { setMergeType("pt_students"); setKeepId(""); setMergeId(""); }}
          >
            Alunos PT
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-green-300 bg-green-50/50 p-3">
            <Label className="text-green-700">✅ Perfil a MANTER</Label>
            <Select value={keepId} onValueChange={setKeepId}>
              <SelectTrigger><SelectValue placeholder="Selecione o perfil a manter" /></SelectTrigger>
              <SelectContent>
                {(mergeType === "students" ? allStudents : allPtStudents)
                  .filter((s: any) => s.id !== mergeId)
                  .map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{s.email ? ` · ${s.email}` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {keepStudent && (
              <div className="space-y-1 text-xs">
                <div className="font-semibold text-sm">{keepStudent.name}</div>
                <div className="text-muted-foreground">
                  {keepStudent.email ?? "Sem email"} · {keepStudent.phone ?? "Sem telefone"}
                </div>
                <div className="text-muted-foreground">
                  💳 {keepPayments} pagamento(s)
                  {keepSessions !== null && ` · 🏃 ${keepSessions} aula(s)`}
                </div>
                <div className="text-green-700">Este perfil será mantido com todos os dados</div>
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-red-300 bg-red-50/50 p-3">
            <Label className="text-red-700">🗑️ Perfil a REMOVER</Label>
            <Select value={mergeId} onValueChange={setMergeId}>
              <SelectTrigger><SelectValue placeholder="Selecione o perfil a remover" /></SelectTrigger>
              <SelectContent>
                {(mergeType === "students" ? allStudents : allPtStudents)
                  .filter((s: any) => s.id !== keepId)
                  .map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{s.email ? ` · ${s.email}` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {mergeStudent && (
              <div className="space-y-1 text-xs">
                <div className="font-semibold text-sm">{mergeStudent.name}</div>
                <div className="text-muted-foreground">
                  {mergeStudent.email ?? "Sem email"} · {mergeStudent.phone ?? "Sem telefone"}
                </div>
                <div className="text-muted-foreground">
                  💳 {mergePayments} pagamento(s)
                  {mergeSessions !== null && ` · 🏃 ${mergeSessions} aula(s)`}
                </div>
                <div className="text-red-700">Este perfil será excluído após a fusão</div>
              </div>
            )}
          </div>
        </div>

        {keepId && mergeId && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
            <div className="font-semibold">Resumo da fusão:</div>
            <div>
              • {mergePayments} pagamento(s) de "{mergeStudent?.name}" serão transferidos para "{keepStudent?.name}"
            </div>
            {mergeSessions !== null && (
              <div>
                • {mergeSessions} aula(s) de "{mergeStudent?.name}" serão transferidas para "{keepStudent?.name}"
              </div>
            )}
            <div>• O perfil "{mergeStudent?.name}" será excluído permanentemente</div>
            <div>• O perfil "{keepStudent?.name}" será mantido com todos os dados combinados</div>
          </div>
        )}

        <Button
          disabled={!keepId || !mergeId || merging}
          onClick={() => setMergeConfirmOpen(true)}
          className="w-full"
        >
          {merging ? "Fundindo perfis…" : "🔀 Fundir perfis"}
        </Button>
      </Card>

      <AlertDialog open={mergeConfirmOpen} onOpenChange={setMergeConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar fusão de perfis?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <div>
                  Todos os dados de <strong>"{mergeStudent?.name}"</strong> serão transferidos para{" "}
                  <strong>"{keepStudent?.name}"</strong>.
                </div>
                <div>
                  O perfil "{mergeStudent?.name}" será excluído permanentemente. Esta ação não pode ser desfeita.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={merging}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeMerge} disabled={merging}>
              {merging ? "Fundindo…" : "Confirmar fusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
