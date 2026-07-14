import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { FileSpreadsheet, Search, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { paymentMethodLabel } from "@/lib/format";



type Kind = "studio" | "pt";

function sanitize(name: string) {
  // Excel sheet name: max 31, no []:*?/\
  return name.replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Aluno";
}

function uniqueSheetName(wb: XLSX.WorkBook, base: string) {
  let name = sanitize(base);
  let i = 2;
  const existing = new Set(wb.SheetNames);
  while (existing.has(name)) {
    const suffix = ` (${i++})`;
    name = sanitize(base).slice(0, 31 - suffix.length) + suffix;
  }
  return name;
}

export function PerStudentExport() {
  const [kind, setKind] = useState<Kind>("studio");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const { data: studioStudents = [] } = useQuery({
    queryKey: ["export-studio-students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id,name,email,phone,status,notes,cpf,rg,birth_date,address,neighborhood,city,state,postal_code,country,start_date,created_at")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: ptStudents = [] } = useQuery({
    queryKey: ["export-pt-students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pt_students")
        .select("id,name,email,phone,status,notes,goal,health_notes,training_plan,birth_date,start_date,created_at")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const list = kind === "studio" ? studioStudents : ptStudents;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s: any) =>
      s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q),
    );
  }, [list, search]);

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (on) n.add(id); else n.delete(id);
      return n;
    });
  }

  function toggleAll(on: boolean) {
    if (on) setSelected(new Set(filtered.map((s: any) => s.id)));
    else setSelected(new Set());
  }

  async function exportSelected(mode: "selected" | "all") {
    const ids = mode === "all" ? list.map((s: any) => s.id) : [...selected];
    if (ids.length === 0) {
      toast.error("Selecione ao menos um aluno");
      return;
    }
    setBusy(true);
    try {
      const wb = XLSX.utils.book_new();

      // Index sheet
      const indexRows = ids
        .map((id) => list.find((s: any) => s.id === id))
        .filter(Boolean)
        .map((s: any) => ({
          Nome: s.name,
          Email: s.email ?? "",
          Telefone: s.phone ?? "",
          Status: s.status,
        }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(indexRows), "Índice");

      for (const id of ids) {
        const student = list.find((s: any) => s.id === id);
        if (!student) continue;

        // Payments per student
        let payments: any[] = [];
        let planHistory: any[] = [];
        if (kind === "studio") {
          const { data: pays } = await supabase
            .from("payments")
            .select("amount,payment_date,due_date,reference_month,payment_method,status,notes,plans(name)")
            .eq("student_id", id)
            .is("deleted_at", null)
            .order("payment_date", { ascending: false });
          payments = pays ?? [];
          const { data: hist } = await supabase
            .from("student_plan_history")
            .select("start_date,end_date,is_current,plans(name)")
            .eq("student_id", id)
            .order("start_date", { ascending: false });
          planHistory = hist ?? [];
        } else {
          const { data: pays } = await supabase
            .from("pt_payments")
            .select("amount,payment_date,due_date,reference_month,payment_method,status,sessions_paid,notes,pt_plans(name)")
            .eq("pt_student_id", id)
            .is("deleted_at", null)
            .order("payment_date", { ascending: false });
          payments = pays ?? [];
        }

        // Build a single sheet with multiple sections
        const sections: (string | number | null)[][] = [];
        sections.push(["DADOS PESSOAIS"]);
        const s: any = student;
        const personalRows: [string, any][] =

          kind === "studio"
            ? [
                ["Nome", s.name],
                ["Email", s.email ?? ""],
                ["Telefone", s.phone ?? ""],
                ["CPF", s.cpf ?? ""],
                ["RG", s.rg ?? ""],
                ["Nascimento", s.birth_date ?? ""],
                ["Endereço", s.address ?? ""],
                ["Bairro", s.neighborhood ?? ""],
                ["Cidade", s.city ?? ""],
                ["Estado", s.state ?? ""],
                ["CEP", s.postal_code ?? ""],
                ["País", s.country ?? ""],
                ["Início", s.start_date ?? ""],
                ["Status", s.status],
                ["Objetivo", s.goal ?? ""],
                ["Notas de saúde", s.health_notes ?? ""],
                ["Plano de treino", s.training_plan ?? ""],
                ["Observações", s.notes ?? ""],
                ["Criado em", s.created_at ?? ""],
              ]
            : [
                ["Nome", s.name],
                ["Email", s.email ?? ""],
                ["Telefone", s.phone ?? ""],
                ["Nascimento", s.birth_date ?? ""],
                ["Início", s.start_date ?? ""],
                ["Status", s.status],
                ["Objetivo", s.goal ?? ""],
                ["Notas de saúde", s.health_notes ?? ""],
                ["Plano de treino", s.training_plan ?? ""],
                ["Observações", s.notes ?? ""],
                ["Criado em", s.created_at ?? ""],
              ];
        for (const [k, v] of personalRows) sections.push([k, v]);
        sections.push([]);

        sections.push(["PAGAMENTOS"]);
        if (kind === "studio") {
          sections.push(["Data", "Vencimento", "Mês Ref.", "Plano", "Valor", "Método", "Status", "Notas"]);
          for (const p of payments) {
            sections.push([
              p.payment_date,
              p.due_date ?? "",
              p.reference_month ?? "",
              p.plans?.name ?? "",
              Number(p.amount),
              paymentMethodLabel(p.payment_method),
              p.status,
              p.notes ?? "",
            ]);
          }
          const totalPaid = payments
            .filter((p: any) => p.status === "paid")
            .reduce((s: number, p: any) => s + Number(p.amount), 0);
          sections.push([]);
          sections.push(["Total pago", "", "", "", totalPaid]);
          sections.push([]);
          sections.push(["HISTÓRICO DE PLANOS"]);
          sections.push(["Início", "Fim", "Atual", "Plano"]);
          for (const h of planHistory) {
            sections.push([
              h.start_date,
              h.end_date ?? "",
              h.is_current ? "Sim" : "Não",
              h.plans?.name ?? "",
            ]);
          }
        } else {
          sections.push(["Data", "Vencimento", "Mês Ref.", "Plano", "Valor", "Sessões pagas", "Método", "Status", "Notas"]);
          for (const p of payments) {
            sections.push([
              p.payment_date,
              p.due_date ?? "",
              p.reference_month ?? "",
              p.pt_plans?.name ?? "",
              Number(p.amount),
              p.sessions_paid ?? "",
              paymentMethodLabel(p.payment_method),
              p.status,
              p.notes ?? "",
            ]);
          }
          const totalPaid = payments
            .filter((p: any) => p.status === "paid")
            .reduce((s: number, p: any) => s + Number(p.amount), 0);
          sections.push([]);
          sections.push(["Total pago", "", "", "", totalPaid]);
        }

        const ws = XLSX.utils.aoa_to_sheet(sections);
        const sheetName = uniqueSheetName(wb, s.name);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      const today = new Date().toISOString().slice(0, 10);
      const prefix = kind === "studio" ? "alunos_studio" : "alunos_pt";
      XLSX.writeFile(wb, `edufinance_${prefix}_individual_${today}.xlsx`);
      toast.success(`${ids.length} aluno(s) exportado(s)`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao exportar");
    } finally {
      setBusy(false);
    }
  }

  const allChecked = filtered.length > 0 && filtered.every((s: any) => selected.has(s.id));

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">Exportar alunos individualmente</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Gera um arquivo Excel com uma aba por aluno, contendo dados pessoais, pagamentos e histórico.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={kind === "studio" ? "default" : "outline"}
          onClick={() => { setKind("studio"); setSelected(new Set()); }}
        >
          Studio
        </Button>
        <Button
          size="sm"
          variant={kind === "pt" ? "default" : "outline"}
          onClick={() => { setKind("pt"); setSelected(new Set()); }}
        >
          Personal Trainer
        </Button>
      </div>

      <div className="mt-3 relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar aluno…"
          className="h-10 pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <label className="flex items-center gap-2">
          <Checkbox
            checked={allChecked}
            onCheckedChange={(v) => toggleAll(!!v)}
            aria-label="Selecionar todos filtrados"
          />
          <span>Selecionar todos ({filtered.length})</span>
        </label>
        <span className="text-muted-foreground">{selected.size} selecionado(s)</span>
      </div>

      <div className="mt-2 max-h-72 overflow-auto rounded-lg border">
        <ul className="divide-y">
          {filtered.map((s: any) => (
            <li key={s.id} className="flex items-center gap-2 p-2 text-sm">
              <Checkbox
                checked={selected.has(s.id)}
                onCheckedChange={(v) => toggle(s.id, !!v)}
                aria-label={`Selecionar ${s.name}`}
              />
              <span className="truncate font-medium">{s.name}</span>
              <span className="ml-auto truncate text-xs text-muted-foreground">
                {s.email ?? ""}
              </span>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="p-3 text-sm text-muted-foreground">Nenhum aluno encontrado</li>
          )}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          onClick={() => exportSelected("selected")}
          disabled={busy || selected.size === 0}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Exportar selecionados ({selected.size})
        </Button>
        <Button
          variant="outline"
          onClick={() => exportSelected("all")}
          disabled={busy || list.length === 0}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Exportar todos ({list.length})
        </Button>
      </div>
