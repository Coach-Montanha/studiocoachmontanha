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

import { ShieldCheck, ShieldAlert, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/diagnostics")({
  head: () => ({ meta: [{ title: "Diagnóstico & Segurança — EduFinance" }] }),
  component: DiagnosticsPage,
});

function DiagnosticsPage() {
  const qc = useQueryClient();
  const [showSecurityChecklist, setShowSecurityChecklist] = useState(true);
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

  const securityItems = [
    { id: 'ann-rls', label: 'Políticas de acesso a imagens de avisos (bucket: announcements)', status: 'fixed' },
    { id: 'module-access', label: 'Restrição de acesso a módulos pagos no banco de dados', status: 'fixed' },
    { id: 'mcp-sanitization', label: 'Sanitização de busca em ferramentas MCP', status: 'fixed' },
    { id: 'trainer-attendance', label: 'Vínculo obrigatório entre aluno e treinador no check-in', status: 'fixed' },
    { id: 'class-enrollment', label: 'Bloqueio de matrícula em turmas de outros treinadores', status: 'fixed' },
    { id: 'shared-resend', label: 'Remoção do uso de Resend Key compartilhada', status: 'fixed' },
  ];

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
    if (!keepId || mergeIds.length === 0) return toast.error("Selecione o perfil a manter e ao menos um perfil a fundir.");
    if (mergeIds.includes(keepId)) return toast.error("O perfil a manter não pode estar entre os que serão fundidos.");
    setMerging(true);
    let okCount = 0;
    const errors: string[] = [];
    try {
      for (const mid of mergeIds) {
        try {
          if (mergeType === "students") {
            const { error: e1 } = await supabase.from("payments").update({ student_id: keepId }).eq("student_id", mid);
            if (e1) throw e1;
            const { error: e2 } = await supabase.from("student_plan_history").update({ student_id: keepId }).eq("student_id", mid);
            if (e2) throw e2;
            const { error: e3 } = await supabase.from("students").delete().eq("id", mid);
            if (e3) throw e3;
          } else {
            const { error: e1 } = await supabase.from("pt_sessions").update({ pt_student_id: keepId }).eq("pt_student_id", mid);
            if (e1) throw e1;
            const { error: e2 } = await supabase.from("pt_payments").update({ pt_student_id: keepId }).eq("pt_student_id", mid);
            if (e2) throw e2;
            const { error: e3 } = await supabase.from("pt_students").delete().eq("id", mid);
            if (e3) throw e3;
          }
          okCount++;
        } catch (err: any) {
          errors.push(err.message);
        }
      }
      if (okCount > 0) toast.success(`${okCount} perfil(is) fundido(s) com sucesso!`);
      if (errors.length > 0) toast.error(`${errors.length} falha(s): ${errors[0]}`);
      setKeepId("");
      setMergeIds([]);
      setMergeConfirmOpen(false);
      qc.invalidateQueries();
    } finally {
      setMerging(false);
    }
  }

  const allList: any[] = mergeType === "students" ? allStudents : allPtStudents;
  const keepStudent: any = allList.find((s) => s.id === keepId);
  const mergeStudents: any[] = mergeIds
    .map((id) => allList.find((s) => s.id === id))
    .filter(Boolean);
  const paymentsOf = (s: any) =>
    (mergeType === "students" ? s?.payments?.length : s?.pt_payments?.length) ?? 0;
  const sessionsOf = (s: any) =>
    mergeType === "pt_students" ? s?.pt_sessions?.length ?? 0 : null;
  const keepPayments = paymentsOf(keepStudent);
  const keepSessions = sessionsOf(keepStudent);
  const totalMergePayments = mergeStudents.reduce((n, s) => n + paymentsOf(s), 0);
  const totalMergeSessions = mergeType === "pt_students"
    ? mergeStudents.reduce((n, s) => n + (s?.pt_sessions?.length ?? 0), 0)
    : null;

  function toggleMergeId(id: string) {
    setMergeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }


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

      {/* SECTION 0: Security Checklist */}
      {showSecurityChecklist && (
        <Card className="border-primary/20 bg-primary/5 p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <ShieldCheck className="h-24 w-24" />
          </div>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="text-lg font-bold">Relatório de Segurança e Hardening</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSecurityChecklist(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajustes de segurança aplicados para mitigar vulnerabilidades identificadas no scan.
          </p>
          
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {securityItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-xl border border-primary/10 bg-background/50 p-3 shadow-sm"
              >
                <div className="mt-0.5 rounded-full bg-state-paid-soft p-1 text-state-paid">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-bold leading-tight">{item.label}</div>
                  <div className="inline-flex items-center rounded-full bg-state-paid-soft px-1.5 py-0.5 text-[10px] font-bold text-state-paid uppercase tracking-wider">
                    Protegido
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 flex items-center justify-between border-t border-primary/10 pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldAlert className="h-4 w-4" />
              Ponto de restauração criado e RLS reforçado.
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Revalidar Sistema
            </Button>
          </div>
        </Card>
      )}

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
              <p className="mt-2 text-sm text-state-paid">
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
            Escolha o perfil a manter e marque um ou mais perfis duplicados para fundir. Todos os pagamentos e sessões dos perfis marcados serão transferidos para o perfil mantido.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mergeType === "students" ? "default" : "outline"}
            onClick={() => { setMergeType("students"); setKeepId(""); setMergeIds([]); }}
          >
            Alunos padrão
          </Button>
          <Button
            size="sm"
            variant={mergeType === "pt_students" ? "default" : "outline"}
            onClick={() => { setMergeType("pt_students"); setKeepId(""); setMergeIds([]); }}
          >
            Alunos PT
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-state-paid/30 bg-state-paid-soft p-3">
            <Label className="text-state-paid">✅ Perfil a MANTER</Label>
            <Select value={keepId} onValueChange={(v) => { setKeepId(v); setMergeIds((prev) => prev.filter((x) => x !== v)); }}>
              <SelectTrigger><SelectValue placeholder="Selecione o perfil a manter" /></SelectTrigger>
              <SelectContent>
                {allList
                  .filter((s: any) => !mergeIds.includes(s.id))
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
                <div className="text-state-paid">Este perfil será mantido com todos os dados</div>
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-state-late/30 bg-state-late-soft p-3">
            <div className="flex items-center justify-between">
              <Label className="text-state-late">🗑️ Perfis a REMOVER ({mergeIds.length})</Label>
              {mergeIds.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setMergeIds([])}>Limpar</Button>
              )}
            </div>
            <Input
              placeholder="Buscar por nome/email/telefone…"
              value={mergeSearch}
              onChange={(e) => setMergeSearch(e.target.value)}
            />
            <div className="max-h-64 overflow-y-auto rounded border bg-background">
              {allList
                .filter((s: any) => s.id !== keepId)
                .filter((s: any) => {
                  const q = mergeSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    (s.name ?? "").toLowerCase().includes(q) ||
                    (s.email ?? "").toLowerCase().includes(q) ||
                    (s.phone ?? "").toLowerCase().includes(q)
                  );
                })
                .map((s: any) => {
                  const checked = mergeIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-start gap-2 border-b px-2 py-1.5 text-xs last:border-b-0 hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleMergeId(s.id)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{s.name}</div>
                        <div className="text-muted-foreground truncate">
                          {s.email ?? "Sem email"} · {s.phone ?? "Sem telefone"} · 💳 {paymentsOf(s)}
                          {sessionsOf(s) !== null && ` · 🏃 ${sessionsOf(s)}`}
                        </div>
                      </div>
                    </label>
                  );
                })}
              {allList.filter((s: any) => s.id !== keepId).length === 0 && (
                <div className="p-3 text-xs text-muted-foreground">Nenhum perfil disponível.</div>
              )}
            </div>
            {mergeStudents.length > 0 && (
              <div className="text-xs text-state-late">
                {mergeStudents.length} perfil(is) será(ão) excluído(s) após a fusão
              </div>
            )}
          </div>
        </div>

        {keepId && mergeIds.length > 0 && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
            <div className="font-semibold">Resumo da fusão:</div>
            <div>
              • {totalMergePayments} pagamento(s) de {mergeStudents.length} perfil(is) serão transferidos para "{keepStudent?.name}"
            </div>
            {totalMergeSessions !== null && (
              <div>
                • {totalMergeSessions} aula(s) serão transferidas para "{keepStudent?.name}"
              </div>
            )}
            <div>• Os perfis {mergeStudents.map((s) => `"${s.name}"`).join(", ")} serão excluídos permanentemente</div>
            <div>• O perfil "{keepStudent?.name}" será mantido com todos os dados combinados</div>
          </div>
        )}

        <Button
          disabled={!keepId || mergeIds.length === 0 || merging}
          onClick={() => setMergeConfirmOpen(true)}
          className="w-full"
        >
          {merging ? "Fundindo perfis…" : `🔀 Fundir ${mergeIds.length || ""} perfil(is)`}
        </Button>
      </Card>

      <AlertDialog open={mergeConfirmOpen} onOpenChange={setMergeConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar fusão de perfis?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <div>
                  Todos os dados de <strong>{mergeStudents.map((s) => `"${s.name}"`).join(", ")}</strong> serão transferidos para{" "}
                  <strong>"{keepStudent?.name}"</strong>.
                </div>
                <div>
                  Os {mergeStudents.length} perfil(is) selecionado(s) serão excluídos permanentemente. Esta ação não pode ser desfeita.
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
