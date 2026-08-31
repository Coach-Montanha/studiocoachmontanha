import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { KPICard } from "@/components/edufinance/KPICard";
import { EmptyState } from "@/components/edufinance/EmptyState";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PaymentRow } from "./StudentPaymentsTab";

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function StudentAttendanceTab({
  payments,
  studentCreatedAt,
}: {
  payments: PaymentRow[];
  studentCreatedAt: string;
}) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const startMonthKey = useMemo(() => {
    const sortedPaid = payments
      .filter((p) => p.status === "paid")
      .map((p) => p.reference_month)
      .sort();
    if (sortedPaid.length) return sortedPaid[0];
    return monthKey(new Date(studentCreatedAt));
  }, [payments, studentCreatedAt]);

  const availableYears = useMemo(() => {
    const startY = Number(startMonthKey.slice(0, 4));
    const arr: number[] = [];
    for (let y = currentYear; y >= startY; y--) arr.push(y);
    return arr;
  }, [startMonthKey, currentYear]);

  const monthStatusForYear = (year: number) => {
    const result: { month: number; status: "paid" | "pending" | "absent" | "na" }[] = [];
    const [sy, sm] = startMonthKey.split("-").map(Number);
    const nowY = currentYear;
    const nowM = new Date().getMonth() + 1;
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      // before student start
      if (year < sy || (year === sy && m < sm)) {
        result.push({ month: m, status: "na" });
        continue;
      }
      // future
      if (year > nowY || (year === nowY && m > nowM)) {
        result.push({ month: m, status: "na" });
        continue;
      }
      const ps = payments.filter((p) => p.reference_month === key);
      if (ps.some((p) => p.status === "paid")) result.push({ month: m, status: "paid" });
      else if (ps.some((p) => p.status === "pending" || p.status === "overdue"))
        result.push({ month: m, status: "pending" });
      else result.push({ month: m, status: "absent" });
    }
    return result;
  };

  const grid = useMemo(
    () => monthStatusForYear(selectedYear),
    [selectedYear, startMonthKey, payments],
  );

  const yearStats = useMemo(() => {
    const paidMonths = grid.filter((g) => g.status === "paid").length;
    const expected = grid.filter((g) => g.status !== "na").length;
    const absent = grid.filter((g) => g.status === "absent").length;
    const rate = expected ? (paidMonths / expected) * 100 : 0;
    const totalPaid = payments
      .filter((p) => p.status === "paid" && p.reference_month.startsWith(String(selectedYear)))
      .reduce((s, p) => s + Number(p.amount), 0);
    return { paidMonths, expected, absent, rate, totalPaid };
  }, [grid, payments, selectedYear]);

  const yearlyEvolution = useMemo(() => {
    return availableYears
      .slice()
      .sort((a, b) => a - b)
      .map((y) => {
        const g = monthStatusForYear(y);
        const paidMonths = g.filter((x) => x.status === "paid").length;
        const expected = g.filter((x) => x.status !== "na").length;
        const absent = g.filter((x) => x.status === "absent").length;
        const yearPaid = payments.filter(
          (p) => p.status === "paid" && p.reference_month.startsWith(String(y)),
        );
        const total = yearPaid.reduce((s, p) => s + Number(p.amount), 0);
        const avg = paidMonths ? total / paidMonths : 0;
        const rate = expected ? (paidMonths / expected) * 100 : 0;
        return { year: y, paidMonths, absent, total, avg, rate };
      })
      .sort((a, b) => b.year - a.year);
  }, [availableYears, payments, startMonthKey]);

  const cellClass = (status: string) =>
    cn(
      "flex h-20 flex-col items-center justify-center rounded-lg border text-xs font-medium",
      status === "paid" && "bg-success/15 border-success/30 text-success",
      status === "pending" && "bg-warning/15 border-warning/30 text-warning-foreground",
      status === "absent" && "bg-destructive/10 border-destructive/20 text-destructive",
      status === "na" && "bg-muted/40 border-border text-muted-foreground",
    );

  const statusLabel = (s: string) =>
    s === "paid" ? "PAGO" : s === "pending" ? "PENDENTE" : s === "absent" ? "AUSENTE" : "N/A";

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Mapa de frequência — {selectedYear}</h2>
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => setSelectedYear(Number(v))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12">
          {grid.map((g) => (
            <div key={g.month} className={cellClass(g.status)}>
              <span className="text-[11px] uppercase">{MONTH_NAMES[g.month - 1]}</span>
              <span className="mt-1 text-[10px] font-semibold">{statusLabel(g.status)}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <LegendDot className="bg-success" label="Pago" />
          <LegendDot className="bg-warning" label="Pendente" />
          <LegendDot className="bg-destructive" label="Ausente" />
          <LegendDot className="bg-muted" label="N/A" />
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Meses pagos no ano" value={yearStats.paidMonths} />
        <KPICard label="Meses ausentes" value={yearStats.absent} />
        <KPICard label="Total pago no ano" value={formatBRL(yearStats.totalPaid)} />
        <Card className="p-5">
          <div className="text-sm font-medium text-muted-foreground">Taxa de frequência</div>
          <div className="mt-2 text-2xl font-bold font-mono">
            {yearStats.rate.toFixed(1).replace(".", ",")}%
          </div>
          <Progress value={yearStats.rate} className="mt-3" />
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold">Evolução Anual</h2>
        {yearlyEvolution.length === 0 ? (
          <EmptyState title="Sem dados" description="Sem histórico anual" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ano</TableHead>
                <TableHead className="text-right">Meses Pagos</TableHead>
                <TableHead className="text-right">Meses Ausentes</TableHead>
                <TableHead className="text-right">Total Pago</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
                <TableHead className="text-right">Taxa de Frequência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {yearlyEvolution.map((r) => (
                <TableRow key={r.year}>
                  <TableCell className="font-medium">{r.year}</TableCell>
                  <TableCell className="text-right font-mono">{r.paidMonths}</TableCell>
                  <TableCell className="text-right font-mono">{r.absent}</TableCell>
                  <TableCell className="text-right font-mono">{formatBRL(r.total)}</TableCell>
                  <TableCell className="text-right font-mono">{formatBRL(r.avg)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {r.rate.toFixed(1).replace(".", ",")}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded-sm", className)} />
      {label}
    </span>
  );
}
