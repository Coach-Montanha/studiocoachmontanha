import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addMonths, formatMonthLong } from "@/lib/format";

export function MonthYearPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border bg-card">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onChange(addMonths(value, -1))}
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-[140px] px-2 text-center text-sm font-medium capitalize">
        {formatMonthLong(value)}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onChange(addMonths(value, 1))}
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function YearPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border bg-card">
      <Button variant="ghost" size="icon" onClick={() => onChange(value - 1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-[60px] px-2 text-center text-sm font-medium font-mono">{value}</div>
      <Button variant="ghost" size="icon" onClick={() => onChange(value + 1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
