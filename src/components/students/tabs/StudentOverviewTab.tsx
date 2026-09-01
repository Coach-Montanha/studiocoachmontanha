import { Wallet, CalendarDays, TrendingUp, Receipt, Clock, Layers } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KPICard } from "@/components/edufinance/KPICard";
import { EmptyState } from "@/components/edufinance/EmptyState";
import { chartTooltip } from "@/lib/chart-theme";
import { formatBRL, formatDateBR } from "@/lib/format";

type MonthlyPoint = { month: string; value: number };

type StudentOverviewTabProps = {
  kpis: {
    total: number;
    months: number;
    avg: number;
    lastDate?: string;
    gapMonths: number;
  };
  currentPlan?: {
    plans?: {
      name?: string | null;
      price?: number | null;
    } | null;
  } | null;
  attendanceCount: number;
  attendancePeriod: string;
  onAttendancePeriodChange: (p: string) => void;
  monthlySeries: MonthlyPoint[];
};

export function StudentOverviewTab({
  kpis,
  currentPlan,
  attendanceCount,
  attendancePeriod,
  onAttendancePeriodChange,
  monthlySeries,
}: StudentOverviewTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KPICard
          label="💰 LTV Total"
          value={formatBRL(kpis.total)}
          icon={<Wallet className="h-5 w-5" />}
        />
        <KPICard
          label="📅 Meses Ativo"
          value={kpis.months}
          icon={<CalendarDays className="h-5 w-5" />}
        />
        <KPICard
          label="📊 Ticket Médio"
          value={formatBRL(kpis.avg)}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <KPICard
          label="🗓️ Último Pagamento"
          value={kpis.lastDate ? formatDateBR(kpis.lastDate) : "—"}
          icon={<Receipt className="h-5 w-5" />}
        />
        <KPICard
          label="⏳ Meses sem pagamento"
          value={kpis.gapMonths}
          icon={<Clock className="h-5 w-5" />}
        />
        <KPICard
          label="🔁 Plano Atual"
          value={currentPlan?.plans?.name ?? "—"}
          hint={currentPlan?.plans?.price ? formatBRL(Number(currentPlan.plans.price)) : undefined}
          icon={<Layers className="h-5 w-5" />}
        />
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium text-muted-foreground">🏃 Aulas realizadas</div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono">{attendanceCount}</div>
          <Select value={attendancePeriod} onValueChange={onAttendancePeriodChange}>
            <SelectTrigger className="mt-2 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Total (todo o histórico)</SelectItem>
              <SelectItem value="year">Ano atual</SelectItem>
              <SelectItem value="month">Mês atual</SelectItem>
            </SelectContent>
          </Select>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold">Evolução de pagamentos</h2>
        {monthlySeries.length === 0 ? (
          <EmptyState title="Sem dados" description="Sem pagamentos registrados" />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatBRL(v)} width={90} />
                <Tooltip {...chartTooltip} formatter={(v: number) => formatBRL(v)} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
