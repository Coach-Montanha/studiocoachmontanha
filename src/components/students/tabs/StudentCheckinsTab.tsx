import { useMemo, useState } from "react";
import { Ticket, ArrowRight, Pencil, RefreshCw, CalendarClock, Loader2, Download, FileSpreadsheet, FileText, CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TooltipRoot, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDateBR, formatMonthLabel } from "@/lib/format";
import { allocateCheckins, checkinTone, type CheckinPkg } from "@/lib/checkins";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { PaymentRow } from "./StudentPaymentsTab";

export type CheckinEntry = {
  id: string;
  date: string;
  time: string | null;
  className: string | null;
};

export function StudentCheckinsTab({
  payments,
  attendanceDates,
  freezes,
  entries,
  loading,
  studentName,
}: {
  payments: PaymentRow[];
  attendanceDates: string[];
  freezes: any[];
  entries: CheckinEntry[];
  loading: boolean;
  studentName: string;
}) {
  const checkinByPayment = useMemo(
    () => allocateCheckins(payments, attendanceDates, freezes),
    [payments, attendanceDates, freezes],
  );

  const packages = useMemo(
    () =>
      payments
        .filter((p) => checkinByPayment.has(p.id))
        .sort((a, b) => (a.payment_date < b.payment_date ? 1 : -1))
        .map((p) => ({ payment: p, pkg: checkinByPayment.get(p.id)! })),
    [payments, checkinByPayment],
  );

  const activePackage = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (
      [...packages]
        .reverse()
        .find(
          (e) =>
            e.pkg.quota - e.pkg.used.length > 0 &&
            (!e.pkg.validUntil || e.pkg.validUntil >= today),
        ) ?? null
    );
  }, [packages]);

  const hasPackages = packages.length > 0;

  return (
    <div className="space-y-6">
      {loading && !hasPackages ? (
        <div className="h-28 animate-pulse rounded-xl border border-border bg-muted/40" />
      ) : null}

      {hasPackages ? (
        <>
          {activePackage ? (
            <ActivePackageSummary
              payment={activePackage.payment}
              pkg={activePackage.pkg}
              onOpenDetails={() =>
                document
                  .getElementById(`ck-${activePackage.payment.id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
            />
          ) : null}

          <Card className="space-y-4 p-5">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold leading-none tracking-tight">
                Pacotes de check-in
              </h3>
              <p className="text-xs leading-snug text-muted-foreground">
                Ajuste a cota de cada pacote e acompanhe os check-ins consumidos.
              </p>
            </div>

            <div className="space-y-4">
              {packages.map(({ payment, pkg }) => (
                <div key={payment.id} id={`ck-${payment.id}`}>
                  <CheckinPackagePanel payment={payment} pkg={pkg} />
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : null}

      <CheckinHistoryCard entries={entries} loading={loading} studentName={studentName} />
    </div>
  );
}

function ActivePackageSummary({
  payment,
  pkg,
  onOpenDetails,
}: {
  payment: PaymentRow;
  pkg: CheckinPkg;
  onOpenDetails: () => void;
}) {
  const used = pkg.used.length;
  const remaining = Math.max(0, pkg.quota - used);
  const pct = pkg.quota > 0 ? Math.min(100, (used / pkg.quota) * 100) : 0;
  const tone = checkinTone(remaining, pkg.quota);
  const barClass =
    tone === "destructive" ? "bg-destructive" : tone === "warning" ? "bg-warning" : "bg-primary";

  return (
    <section
      className={cn(
        "rounded-xl border p-4 sm:p-5 transition-colors duration-200",
        tone === "destructive"
          ? "border-destructive/25 bg-destructive/5"
          : tone === "warning"
            ? "border-warning/30 bg-warning/5"
            : "border-primary/20 bg-primary/5",
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pacote ativo
            </h3>
          </div>

          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <p className="text-3xl font-semibold leading-none tabular-nums">{remaining}</p>
              <p className="mt-1 text-xs leading-none text-muted-foreground">
                check-in{remaining === 1 ? "" : "s"} restante{remaining === 1 ? "" : "s"}
              </p>
            </div>
            <div>
              <p className="text-base font-medium leading-none tabular-nums text-foreground/80">
                {used}/{pkg.quota}
              </p>
              <p className="mt-1 text-xs leading-none text-muted-foreground">usados</p>
            </div>
            {pkg.validUntil && (
              <div>
                <p className="text-base font-medium leading-none tabular-nums text-foreground/80">
                  {formatDateBR(pkg.validUntil)}
                </p>
                <p className="mt-1 text-xs leading-none text-muted-foreground">
                  válido até{pkg.freezeDays > 0 ? ` (+${pkg.freezeDays}d)` : ""}
                </p>
              </div>
            )}
          </div>

          <div className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all duration-300", barClass)}
              style={{ width: `${pct}%` }}
            />
          </div>

          <p className="text-xs leading-snug text-muted-foreground">
            {payment.plans?.name ?? "Pacote"} · pago em {formatDateBR(payment.payment_date)}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenDetails}
          className="shrink-0 transition-all duration-200 hover:bg-accent active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          Ver detalhes <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </section>
  );
}

function CheckinPackagePanel({ payment, pkg }: { payment: PaymentRow; pkg: CheckinPkg }) {
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<string>(String(pkg.quota ?? ""));
  const [saving, setSaving] = useState(false);

  const used = pkg.used.length;
  const remaining = Math.max(0, pkg.quota - used);
  const pct = pkg.quota > 0 ? Math.min(100, (used / pkg.quota) * 100) : 0;
  const tone = checkinTone(remaining, pkg.quota);

  const barClass =
    tone === "destructive" ? "bg-destructive" : tone === "warning" ? "bg-warning" : "bg-primary";
  const ringClass =
    tone === "destructive"
      ? "border-destructive/25 bg-destructive/5"
      : tone === "warning"
        ? "border-warning/30 bg-warning/5"
        : "border-primary/20 bg-primary/5";

  const expectedDue = pkg.validUntil;
  const dueMismatch = Boolean(expectedDue && payment.due_date && payment.due_date < expectedDue);
  const [fixing, setFixing] = useState(false);

  async function fixDueDate() {
    if (!expectedDue) return;
    setFixing(true);
    const { error } = await supabase
      .from("payments")
      .update({ due_date: expectedDue })
      .eq("id", payment.id);
    setFixing(false);
    if (error) return toast.error(error.message);
    toast.success("Validade corrigida");
    qc.invalidateQueries({ queryKey: ["student-payments"] });
  }

  async function save(value: number | null) {
    setSaving(true);
    const { error } = await supabase
      .from("payments")
      .update({ checkin_quota_override: value })
      .eq("id", payment.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(value == null ? "Cota do plano restaurada" : "Cota ajustada");
    setEditOpen(false);
    qc.invalidateQueries({ queryKey: ["student-payments"] });
  }

  const visible = showAll ? pkg.used : pkg.used.slice(0, 6);

  return (
    <div className={cn("rounded-xl border p-4 transition-colors duration-200", ringClass)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Ticket className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold leading-none tracking-tight">
              Check-ins do pacote
            </h4>
            {pkg.isOverride && (
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                cota ajustada
              </span>
            )}
            {dueMismatch && (
              <span className="rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
                validade divergente
              </span>
            )}
          </div>

          {dueMismatch && (
            <div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-relaxed text-muted-foreground">
                O vencimento salvo (
                <span className="font-medium tabular-nums text-foreground">
                  {formatDateBR(payment.due_date!)}
                </span>
                ) é menor que a validade do pacote (
                <span className="font-medium tabular-nums text-foreground">
                  {formatDateBR(expectedDue!)}
                </span>
                ).
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={fixing}
                onClick={fixDueDate}
                className="w-full shrink-0 transition-all duration-200 active:scale-[0.97] sm:w-auto"
              >
                {fixing ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                )}
                Corrigir validade
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end sm:gap-8">
            <div>
              <p className="text-2xl font-semibold leading-tight tabular-nums">{remaining}</p>
              <p className="text-xs leading-tight text-muted-foreground">Restantes</p>
            </div>
            <div>
              <p className="text-base font-medium leading-tight tabular-nums text-foreground/80">
                {used}
              </p>
              <p className="text-xs leading-tight text-muted-foreground">Usados</p>
            </div>
            <div>
              <p className="text-base font-medium leading-tight tabular-nums text-foreground/80">
                {pkg.quota}
              </p>
              <p className="text-xs leading-tight text-muted-foreground">Cota</p>
            </div>
            {pkg.validUntil && (
              <div>
                <p className="text-base font-medium leading-tight tabular-nums text-foreground/80">
                  {formatDateBR(pkg.validUntil)}
                </p>
                <p className="text-xs leading-tight text-muted-foreground">
                  Válido até{pkg.freezeDays > 0 ? ` (+${pkg.freezeDays}d)` : ""}
                </p>
              </div>
            )}
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all duration-300", barClass)}
              style={{ width: `${pct}%` }}
            />
          </div>

          {used > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {visible.map((d) => (
                <span
                  key={d}
                  className="rounded-full bg-muted/70 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground"
                >
                  {formatDateBR(d)}
                </span>
              ))}
              {pkg.used.length > 6 && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-primary transition-colors duration-200 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showAll ? "ver menos" : `ver todas (${pkg.used.length})`}
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum check-in utilizado neste pacote.</p>
          )}
        </div>

        <Popover
          open={editOpen}
          onOpenChange={(o) => {
            setEditOpen(o);
            if (o) setDraft(String(pkg.quota ?? ""));
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 transition-all duration-200 active:scale-[0.97]"
            >
              <Pencil className="h-3.5 w-3.5" /> Ajustar
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold leading-none">Cota de check-ins</p>
              <p className="text-xs leading-snug text-muted-foreground">
                Vale só para este pagamento. Limpe para voltar à cota do plano
                {payment.plans?.checkin_quota_amount != null
                  ? ` (${payment.plans.checkin_quota_amount})`
                  : ""}
                .
              </p>
            </div>
            <Input
              type="number"
              min={0}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="tabular-nums"
            />
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={saving || !pkg.isOverride}
                onClick={() => save(null)}
              >
                Limpar
              </Button>
              <Button
                size="sm"
                disabled={
                  saving || draft === "" || Number(draft) < 0 || Number.isNaN(Number(draft))
                }
                onClick={() => save(Number(draft))}
              >
                {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null} Salvar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

const CHECKIN_FILTERS = [
  { key: "today", label: "Hoje" },
  { key: "month", label: "Mês" },
  { key: "year", label: "Ano" },
  { key: "range", label: "Período" },
  { key: "all", label: "Todos" },
] as const;

type CheckinFilter = (typeof CHECKIN_FILTERS)[number]["key"];

function CheckinHistoryCard({
  entries,
  loading,
  studentName,
}: {
  entries: CheckinEntry[];
  loading: boolean;
  studentName: string;
}) {
  const [filter, setFilter] = useState<CheckinFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exporting, setExporting] = useState<null | "csv" | "xlsx">(null);

  const filtered = useMemo(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const ym = today.slice(0, 7);
    const y = today.slice(0, 4);
    return entries
      .filter((e) => {
        if (filter === "today") return e.date === today;
        if (filter === "month") return e.date.startsWith(ym);
        if (filter === "year") return e.date.startsWith(y);
        if (filter === "range") {
          if (from && e.date < from) return false;
          if (to && e.date > to) return false;
          return true;
        }
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [entries, filter, from, to]);

  const groups = useMemo(() => {
    const map = new Map<string, CheckinEntry[]>();
    for (const e of filtered) {
      const key = e.date.slice(0, 7);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()];
  }, [filtered]);

  const summary = useMemo(() => {
    const months = new Set(filtered.map((e) => e.date.slice(0, 7))).size;
    return {
      total: filtered.length,
      avg: months ? filtered.length / months : 0,
      last: filtered[0]?.date ?? null,
    };
  }, [filtered]);

  const periodLabel = useMemo(() => {
    if (filter === "range") {
      if (!from && !to) return "Período personalizado";
      return `De ${from ? formatDateBR(from) : "início"} até ${to ? formatDateBR(to) : "hoje"}`;
    }
    return CHECKIN_FILTERS.find((f) => f.key === filter)?.label ?? "Todos";
  }, [filter, from, to]);

  const handleExport = async (format: "csv" | "xlsx") => {
    if (!filtered.length) return;
    setExporting(format);
    try {
      const rows = filtered.map((e) => ({
        Data: formatDateBR(e.date),
        "Dia da semana": weekdayLabel(e.date),
        Hora: e.time ? e.time.slice(0, 5) : "—",
        Turma: e.className ?? "—",
        "Mês de referência": e.date.slice(0, 7),
      }));
      const stamp = new Date().toISOString().slice(0, 10);
      const slug =
        studentName
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || "aluno";
      const base = `checkins-${slug}-${stamp}`;

      if (format === "csv") {
        const Papa = (await import("papaparse")).default;
        const csv = Papa.unparse(rows, { delimiter: ";" });
        downloadBlob(
          new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
          `${base}.csv`,
        );
      } else {
        const XLSX = await import("xlsx");
        const sheet = XLSX.utils.aoa_to_sheet([
          [`Histórico de check-ins — ${studentName}`],
          [`Filtro: ${periodLabel}`, `Registros: ${rows.length}`],
          [],
        ]);
        XLSX.utils.sheet_add_json(sheet, rows, { origin: "A4" });
        sheet["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 28 }, { wch: 18 }];
        const book = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(book, sheet, "Check-ins");
        const out = XLSX.write(book, { bookType: "xlsx", type: "array" });
        downloadBlob(
          new Blob([out], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
          `${base}.xlsx`,
        );
      }
      toast.success(`${rows.length} check-in(s) exportado(s)`);
    } catch {
      toast.error("Não foi possível gerar o arquivo");
    } finally {
      setExporting(null);
    }
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col gap-4 border-b border-border p-4 sm:p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold leading-tight tracking-tight text-foreground">
              Histórico de check-ins
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Todos os registros de presença do aluno, agrupados por mês.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-primary">
              {summary.total}
            </span>
            <ExportCheckinsMenu
              disabled={loading || filtered.length === 0}
              exporting={exporting}
              onExport={handleExport}
              count={filtered.length}
            />
          </div>
        </div>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {CHECKIN_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                filter === f.key
                  ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/25"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filter === "range" && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="Data inicial"
            />
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="Data final"
            />
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Check-ins" value={String(summary.total)} />
          <Stat label="Média/mês" value={summary.avg ? summary.avg.toFixed(1) : "—"} />
          <Stat label="Último" value={summary.last ? formatDateBR(summary.last) : "—"} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 p-4 sm:p-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/60" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="p-8 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">Nenhum check-in neste filtro</p>
          <p className="mt-1 text-xs text-muted-foreground">Ajuste o período para ver outros registros.</p>
        </div>
      ) : (
        <div className="max-h-[28rem] overflow-y-auto">
          {groups.map(([month, items]) => (
            <div key={month}>
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-card/95 px-4 py-2 backdrop-blur sm:px-5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {formatMonthLabel(month)}
                </span>
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {items.length}
                </span>
              </div>
              <ul className="divide-y divide-border/60">
                {items.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-muted/50 sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight tabular-nums text-foreground">
                        {formatDateBR(e.date)}
                        <span className="ml-2 text-xs font-normal capitalize text-muted-foreground">
                          {weekdayLabel(e.date)}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-xs leading-relaxed text-muted-foreground">
                        {e.className ?? "Turma removida"}
                      </p>
                    </div>
                    {e.time && (
                      <span className="shrink-0 rounded-md bg-muted/70 px-2 py-1 text-xs font-medium tabular-nums text-muted-foreground">
                        {e.time.slice(0, 5)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function weekdayLabel(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1)
    .toLocaleDateString("pt-BR", { weekday: "short" })
    .replace(".", "");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function ExportCheckinsMenu({
  disabled,
  exporting,
  count,
  onExport,
}: {
  disabled: boolean;
  exporting: null | "csv" | "xlsx";
  count: number;
  onExport: (format: "csv" | "xlsx") => void;
}) {
  const busy = exporting !== null;
  const trigger = (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled || busy}
      className={cn(
        "h-8 gap-1.5 rounded-full border-border/80 px-3 text-xs font-semibold",
        "transition-all duration-200 hover:border-primary/40 hover:bg-primary/10 hover:text-primary",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "active:scale-[0.97] disabled:opacity-50",
      )}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">Exportar</span>
    </Button>
  );

  if (disabled) {
    return (
      <TooltipProvider>
        <TooltipRoot>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-not-allowed">{trigger}</span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Nenhum check-in no período selecionado</TooltipContent>
        </TooltipRoot>
      </TooltipProvider>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Exportar {count} registro(s)
        </DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={() => onExport("xlsx")}
          className="gap-3 py-2.5 transition-colors duration-150"
        >
          <FileSpreadsheet className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0">
            <span className="block text-sm font-medium leading-tight text-foreground">
              Excel (.xlsx)
            </span>
            <span className="block text-xs leading-snug text-muted-foreground">
              Planilha com cabeçalho e período
            </span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onExport("csv")}
          className="gap-3 py-2.5 transition-colors duration-150"
        >
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block text-sm font-medium leading-tight text-foreground">
              CSV (.csv)
            </span>
            <span className="block text-xs leading-snug text-muted-foreground">
              Compatível com qualquer planilha
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
