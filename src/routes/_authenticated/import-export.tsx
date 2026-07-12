import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { paymentMethodLabel, billingCycleLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/import-export")({
  head: () => ({ meta: [{ title: "Importar / Exportar — EduFinance" }] }),
  component: ImportExportPage,
});

// Map a raw header string to a canonical field.
const headerMap: Record<string, string> = {
  // students
  nome: "name", name: "name",
  email: "email",
  telefone: "phone", phone: "phone",
  status: "status",
  notas: "notes", notes: "notes",
  plano: "plan_name", plan: "plan_name", plan_name: "plan_name",
  inicio: "start_date", start_date: "start_date",
  // payments
  aluno: "student_name", student_name: "student_name",
  valor: "amount", amount: "amount",
  data: "payment_date", data_pagamento: "payment_date", payment_date: "payment_date",
  vencimento: "due_date", due_date: "due_date",
  mes_referencia: "reference_month", reference_month: "reference_month",
  metodo: "payment_method", forma_pagamento: "payment_method", payment_method: "payment_method",
  // plans
  nome_plano: "name", plan_price: "price", preco: "price", price: "price",
  ciclo: "billing_cycle", billing_cycle: "billing_cycle", ciclo_cobranca: "billing_cycle",
  descricao: "description", description: "description",
  ativo: "is_active", is_active: "is_active",
};

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, "_");

function parseDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  // DD/MM/YYYY
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    let y = Number(br[3]);
    if (y < 100) y += 2000;
    return `${y}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Excel serial
  if (/^\d+(\.\d+)?$/.test(s)) {
    const d = XLSX.SSF.parse_date_code(Number(s));
    if (d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  return null;
}

function parseMonth(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  // MM/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}`;
  // YYYY-MM
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  // YYYY-MM-DD -> YYYY-MM
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 7);
  return null;
}

const methodMap: Record<string, string> = {
  pix: "pix", "cartao_de_credito": "credit_card", "credito": "credit_card",
  "cartao_de_debito": "debit_card", "debito": "debit_card",
  boleto: "bank_slip", dinheiro: "cash", transferencia: "transfer",
};
const statusMap: Record<string, string> = {
  pago: "paid", pendente: "pending", atrasado: "overdue", cancelado: "cancelled",
};
const billingCycleMap: Record<string, string> = {
  mensal: "monthly", monthly: "monthly",
  trimestral: "quarterly", quarterly: "quarterly",
  semestral: "semiannual", semiannual: "semiannual",
  anual: "annual", annual: "annual",
};

function ImportExportPage() {
  const qc = useQueryClient();
  const [importType, setImportType] = useState<"payments" | "students" | "plans">("payments");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [imported, setImported] = useState<number | null>(null);

  const { data: students = [] } = useQuery({
    queryKey: ["students-all"],
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("students")
          .select("id,name,email,phone,status,notes,cpf,rg,birth_date,address,neighborhood,city,state,postal_code,country,start_date,created_at")

          .is("deleted_at", null)
          .order("name")
          .range(from, from + 999);
        if (error) break;
        all = all.concat(data ?? []);
        if (!data || data.length < 1000) break;
        from += 1000;
      }
      return all;
    },
  });
  const { data: plans = [] } = useQuery({
    queryKey: ["plans-all"],
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("id,name,price,billing_cycle,description,is_active");
      return data ?? [];
    },
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["payments-export"],
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("payments")
          .select("amount,payment_date,due_date,reference_month,payment_method,status,notes,students!payments_student_id_fkey(name),plans(name)")
          .is("deleted_at", null)
          .order("payment_date", { ascending: false })
          .range(from, from + 999);
        if (error) break;
        all = all.concat(data ?? []);
        if (!data || data.length < 1000) break;
        from += 1000;
      }
      return all;
    },
  });

  const { data: ptStudents = [] } = useQuery({
    queryKey: ["pt-students-all"],
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("pt_students")
          .select("id,name,email,phone,status,notes,goal,health_notes,training_plan,birth_date,start_date,created_at")
          .is("deleted_at", null)
          .order("name")
          .range(from, from + 999);
        if (error) break;
        all = all.concat(data ?? []);
        if (!data || data.length < 1000) break;
        from += 1000;
      }
      return all;
    },
  });

  const { data: ptPlans = [] } = useQuery({
    queryKey: ["pt-plans-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_plans")
        .select("id,name,description,billing_type,price_per_month,price_per_session,package_price,package_sessions,sessions_per_month,is_active");
      return data ?? [];
    },
  });

  const { data: ptPayments = [] } = useQuery({
    queryKey: ["pt-payments-export"],
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("pt_payments")
          .select("amount,payment_date,due_date,reference_month,payment_method,status,sessions_paid,notes,pt_students!pt_payments_pt_student_id_fkey(name),pt_plans(name)")
          .is("deleted_at", null)
          .order("payment_date", { ascending: false })
          .range(from, from + 999);
        if (error) break;
        all = all.concat(data ?? []);
        if (!data || data.length < 1000) break;
        from += 1000;
      }
      return all;
    },
  });


  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
      const mapped = raw.map((row) => {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) {
          const key = headerMap[norm(k)] ?? norm(k);
          out[key] = v;
        }
        return out;
      });
      setRows(mapped);
      setErrors([]);
      setImported(null);
    };
    reader.readAsArrayBuffer(file);
  }

  async function confirmImport() {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const errs: string[] = [];
    let okCount = 0;

    if (importType === "plans") {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r.name) { errs.push(`Linha ${i + 2}: nome do plano ausente`); continue; }
        const price = Number(r.price);
        if (!price) { errs.push(`Linha ${i + 2}: preço inválido`); continue; }
        const cycleRaw = r.billing_cycle ? norm(String(r.billing_cycle)) : "monthly";
        const billing_cycle = billingCycleMap[cycleRaw] ?? "monthly";
        const isActiveRaw = r.is_active;
        const is_active = isActiveRaw === undefined || isActiveRaw === null
          ? true
          : ["true", "1", "sim", "ativo", true, 1].includes(
              typeof isActiveRaw === "string" ? isActiveRaw.toLowerCase() : isActiveRaw as never
            );
        const { error } = await supabase.from("plans").insert({
          user_id: userId,
          name: String(r.name),
          price,
          billing_cycle,
          description: r.description ? String(r.description) : null,
          is_active,
        });
        if (error) errs.push(`Linha ${i + 2}: ${error.message}`); else okCount++;
      }
    } else if (importType === "students") {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r.name) { errs.push(`Linha ${i + 2}: nome ausente`); continue; }
        const { error } = await supabase.from("students").insert({
          user_id: userId,
          name: String(r.name),
          email: r.email ? String(r.email) : null,
          phone: r.phone ? String(r.phone) : null,
          status: r.status ? String(r.status) : "active",
          notes: r.notes ? String(r.notes) : null,
        });
        if (error) errs.push(`Linha ${i + 2}: ${error.message}`); else okCount++;
      }
    } else {
      // Payments: auto-create student if missing
      const studentByName = new Map(students.map((s) => [s.name.toLowerCase(), s.id]));
      const planByName = new Map(plans.map((p) => [p.name.toLowerCase(), p.id]));

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const name = r.student_name ?? r.name;
        if (!name) { errs.push(`Linha ${i + 2}: aluno ausente`); continue; }
        const amount = Number(r.amount);
        if (!amount) { errs.push(`Linha ${i + 2}: valor inválido`); continue; }
        const pd = parseDate(r.payment_date);
        const rm = parseMonth(r.reference_month) ?? (pd ? pd.slice(0, 7) : null);
        if (!pd || !rm) { errs.push(`Linha ${i + 2}: data ou mês de referência inválido`); continue; }

        const key = String(name).toLowerCase();
        let studentId = studentByName.get(key);
        if (!studentId) {
          const { data, error } = await supabase
            .from("students").insert({ user_id: userId, name: String(name) })
            .select("id").single();
          if (error) { errs.push(`Linha ${i + 2}: ${error.message}`); continue; }
          studentId = data.id;
          studentByName.set(key, studentId);
        }
        const planId = r.plan_name ? planByName.get(String(r.plan_name).toLowerCase()) ?? null : null;
        const methodRaw = r.payment_method ? norm(String(r.payment_method)) : "pix";
        const method = methodMap[methodRaw] ?? methodRaw;
        const statusRaw = r.status ? norm(String(r.status)) : "paid";
        const status = statusMap[statusRaw] ?? statusRaw;

        const { error } = await supabase.from("payments").insert({
          user_id: userId, student_id: studentId, plan_id: planId,
          amount, payment_date: pd, reference_month: rm,
          due_date: parseDate(r.due_date),
          payment_method: method, status,
          notes: r.notes ? String(r.notes) : null,
        });
        if (error) errs.push(`Linha ${i + 2}: ${error.message}`); else okCount++;
      }
    }

    setErrors(errs);
    setImported(okCount);
    qc.invalidateQueries();
    if (okCount) toast.success(`${okCount} registro(s) importado(s)`);
    if (errs.length) toast.error(`${errs.length} erro(s)`);
  }

  function downloadTemplate(kind: "payments" | "students" | "plans") {
    const data =
      kind === "payments"
        ? [{ student_name: "João Silva", plan_name: "Mensal Basic", amount: 99.9, payment_date: "01/03/2025", reference_month: "03/2025", payment_method: "pix", status: "pago", notes: "" }]
        : kind === "students"
        ? [{ name: "João Silva", email: "joao@example.com", phone: "11999990000", plan_name: "Mensal Basic", start_date: "01/03/2025", status: "active", notes: "" }]
        : [{ name: "Mensal Pro", price: 250, billing_cycle: "mensal", description: "Plano mensal completo", is_active: true }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, kind);
    XLSX.writeFile(wb, `edufinance_template_${kind}.xlsx`);
  }

  function exportPlans() {
    const data = plans.map((p) => ({
      Nome: p.name, Preco: Number(p.price), Ciclo: billingCycleLabel(p.billing_cycle),
      Descricao: p.description ?? "", Ativo: p.is_active ? "Sim" : "Não",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Planos");
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `edufinance_planos_${today}.xlsx`);
  }

  function exportPayments() {
    const data = payments.map((p) => ({
      Aluno: p.students?.name ?? "",
      Plano: p.plans?.name ?? "",
      Valor: Number(p.amount),
      Data_Pagamento: p.payment_date,
      Vencimento: p.due_date ?? "",
      Mes_Referencia: p.reference_month,
      Metodo: paymentMethodLabel(p.payment_method),
      Status: p.status,
      Notas: p.notes ?? "",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Pagamentos");
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `edufinance_pagamentos_${today}.xlsx`);
  }

  function exportStudents() {
    const data = students.map((s) => ({
      Nome: s.name, Email: s.email ?? "", Telefone: s.phone ?? "",
      Status: s.status, Notas: s.notes ?? "", Criado_em: s.created_at,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Alunos");
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `edufinance_alunos_${today}.xlsx`);
  }

  function exportPTStudents() {
    const data = ptStudents.map((s) => ({
      Nome: s.name, Email: s.email ?? "", Telefone: s.phone ?? "",
      Status: s.status, Objetivo: s.goal ?? "", Saude: s.health_notes ?? "",
      Plano_Treino: s.training_plan ?? "", Nascimento: s.birth_date ?? "",
      Inicio: s.start_date ?? "", Notas: s.notes ?? "", Criado_em: s.created_at,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Alunos PT");
    XLSX.writeFile(wb, `edufinance_alunos_pt_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  function exportPTPayments() {
    const data = ptPayments.map((p: any) => ({
      Aluno: p.pt_students?.name ?? "",
      Plano: p.pt_plans?.name ?? "",
      Valor: Number(p.amount),
      Data_Pagamento: p.payment_date,
      Vencimento: p.due_date ?? "",
      Mes_Referencia: p.reference_month ?? "",
      Sessoes_Pagas: p.sessions_paid ?? "",
      Metodo: paymentMethodLabel(p.payment_method),
      Status: p.status,
      Notas: p.notes ?? "",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Pagamentos PT");
    XLSX.writeFile(wb, `edufinance_pagamentos_pt_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  function exportPTPlans() {
    const data = ptPlans.map((p: any) => ({
      Nome: p.name, Descricao: p.description ?? "", Tipo_Cobranca: p.billing_type,
      Preco_Mensal: p.price_per_month ?? "", Preco_Sessao: p.price_per_session ?? "",
      Preco_Pacote: p.package_price ?? "", Sessoes_Pacote: p.package_sessions ?? "",
      Sessoes_Mes: p.sessions_per_month ?? "", Ativo: p.is_active ? "Sim" : "Não",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Planos PT");
    XLSX.writeFile(wb, `edufinance_planos_pt_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  function exportReport() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payments.map((p) => ({
      Aluno: p.students?.name, Plano: p.plans?.name, Valor: Number(p.amount),
      Data: p.payment_date, Mes_Ref: p.reference_month, Status: p.status,
    }))), "Pagamentos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(students.map((s) => ({
      Nome: s.name, Email: s.email, Status: s.status,
    }))), "Alunos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(plans.map((p) => ({
      Nome: p.name, Preco: Number(p.price), Ciclo: billingCycleLabel(p.billing_cycle), Ativo: p.is_active,
    }))), "Planos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ptStudents.map((s) => ({
      Nome: s.name, Email: s.email ?? "", Telefone: s.phone ?? "", Status: s.status,
      Objetivo: s.goal ?? "", Saude: s.health_notes ?? "", Plano_Treino: s.training_plan ?? "",
      Nascimento: s.birth_date ?? "", Inicio: s.start_date ?? "", Notas: s.notes ?? "",
    }))), "Alunos PT");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ptPayments.map((p: any) => ({
      Aluno: p.pt_students?.name ?? "", Plano: p.pt_plans?.name ?? "", Valor: Number(p.amount),
      Data: p.payment_date, Vencimento: p.due_date ?? "", Mes_Ref: p.reference_month ?? "",
      Sessoes_Pagas: p.sessions_paid ?? "", Metodo: paymentMethodLabel(p.payment_method), Status: p.status,
    }))), "Pagamentos PT");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ptPlans.map((p: any) => ({
      Nome: p.name, Descricao: p.description ?? "", Tipo_Cobranca: p.billing_type,
      Preco_Mensal: p.price_per_month ?? "", Preco_Sessao: p.price_per_session ?? "",
      Preco_Pacote: p.package_price ?? "", Sessoes_Pacote: p.package_sessions ?? "",
      Sessoes_Mes: p.sessions_per_month ?? "", Ativo: p.is_active,
    }))), "Planos PT");
    XLSX.writeFile(wb, `edufinance_relatorio_${new Date().toISOString().slice(0,10)}.xlsx`);
  }


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar / Exportar</h1>
        <p className="text-sm text-muted-foreground">Migre dados em massa via Excel ou CSV</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Importar</h2>
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant={importType === "payments" ? "default" : "outline"} size="sm" onClick={() => { setImportType("payments"); setRows([]); }}>Pagamentos</Button>
            <Button variant={importType === "students" ? "default" : "outline"} size="sm" onClick={() => { setImportType("students"); setRows([]); }}>Alunos</Button>
            <Button variant={importType === "plans" ? "default" : "outline"} size="sm" onClick={() => { setImportType("plans"); setRows([]); }}>Planos</Button>
          </div>

          <div className="mt-4 rounded-lg border-2 border-dashed p-6 text-center">
            <FileSpreadsheet className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm">Arraste um arquivo .xlsx ou .csv ou</p>
            <label className="mt-2 inline-block cursor-pointer text-sm font-medium text-primary hover:underline">
              selecione um arquivo
              <input
                type="file"
                accept=".xlsx,.csv,.xls"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </label>
            <div className="mt-3">
              <Button variant="ghost" size="sm" onClick={() => downloadTemplate(importType)}>
                <Download className="h-3.5 w-3.5" /> Baixar template
              </Button>
            </div>
          </div>

          {rows.length > 0 && (
            <div className="mt-4">
              <p className="text-sm">
                <span className="font-medium">{rows.length}</span> linhas detectadas — pré-visualização (5 primeiras):
              </p>
              <div className="mt-2 overflow-auto rounded-lg border bg-muted/30 p-2 text-xs">
                <pre className="font-mono">{JSON.stringify(rows.slice(0, 5), null, 2)}</pre>
              </div>
              <Button className="mt-3" onClick={confirmImport}>Confirmar importação</Button>
            </div>
          )}

          {imported !== null && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> {imported} registro(s) importado(s) com sucesso
            </div>
          )}
          {errors.length > 0 && (
            <div className="mt-2 rounded-lg bg-destructive/10 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" /> {errors.length} erro(s)
              </div>
              <ul className="mt-2 max-h-32 list-disc overflow-auto pl-5 text-xs text-destructive">
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Exportar</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Baixe seus dados como planilha Excel.
          </p>
          <div className="mt-4 grid gap-2">
            <Button variant="outline" className="justify-start" onClick={exportPayments}>
              <FileSpreadsheet className="h-4 w-4" /> Exportar pagamentos
            </Button>
            <Button variant="outline" className="justify-start" onClick={exportStudents}>
              <FileSpreadsheet className="h-4 w-4" /> Exportar alunos
            </Button>
            <Button variant="outline" className="justify-start" onClick={exportPlans}>
              <FileSpreadsheet className="h-4 w-4" /> Exportar planos
            </Button>
            <Button variant="outline" className="justify-start" onClick={exportPTStudents}>
              <FileSpreadsheet className="h-4 w-4" /> Exportar alunos PT
            </Button>
            <Button variant="outline" className="justify-start" onClick={exportPTPayments}>
              <FileSpreadsheet className="h-4 w-4" /> Exportar pagamentos PT
            </Button>
            <Button variant="outline" className="justify-start" onClick={exportPTPlans}>
              <FileSpreadsheet className="h-4 w-4" /> Exportar planos PT
            </Button>
            <Button variant="outline" className="justify-start" onClick={exportReport}>
              <FileSpreadsheet className="h-4 w-4" /> Relatório completo (todas as abas)
            </Button>

          </div>
        </Card>
      </div>
    </div>
  );
}
