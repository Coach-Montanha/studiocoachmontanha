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
    <div className="inline-flex w-full sm:w-auto items-center justify-between rounded-lg border bg-card shadow-xs">
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 sm:h-9 sm:w-9 shrink-0"
        onClick={() => onChange(addMonths(value, -1))}
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex-1 sm:min-w-[140px] px-2 text-center text-sm font-medium capitalize truncate">
        {formatMonthLong(value)}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 sm:h-9 sm:w-9 shrink-0"
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
