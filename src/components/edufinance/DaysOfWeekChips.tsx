import { Toggle } from "@/components/ui/toggle";

const DOW = ["D", "S", "T", "Q", "Q", "S", "S"];
const DOW_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function DaysOfWeekChips({
  value,
  onChange,
}: {
  value: number[];
  onChange: (next: number[]) => void;
}) {
  function toggle(dow: number) {
    if (value.includes(dow)) onChange(value.filter((d) => d !== dow).sort());
    else onChange([...value, dow].sort());
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {DOW.map((letter, i) => {
        const on = value.includes(i);
        return (
          <Toggle
            key={i}
            pressed={on}
            onPressedChange={() => toggle(i)}
            aria-label={DOW_LABELS[i]}
            className="h-9 w-9 rounded-full border data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {letter}
          </Toggle>
        );
      })}
    </div>
  );
}

export function formatDaysOfWeek(days: number[] | null | undefined): string {
  if (!days || days.length === 0) return "—";
  const abbr = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return [...days].sort().map((d) => abbr[d]).join(" · ");
}
