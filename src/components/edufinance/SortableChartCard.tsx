import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EyeOff, GripVertical, Eye } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Card de gráfico arrastável e ocultável — mesma mecânica dos KPIs,
 * mas preservando a altura/spando gráfico dentro do grid.
 */
export function SortableChartCard({
  id,
  title,
  actions,
  onHide,
  children,
  className,
}: {
  id: string;
  title: ReactNode;
  actions?: ReactNode;
  onHide: () => void;
  children: ReactNode;
  className?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative flex min-w-0 flex-col p-5",
        isDragging && "z-20 opacity-80 shadow-float",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            aria-label="Reordenar card"
            className="focus-ring -ml-1 cursor-grab rounded p-1 text-muted-foreground/50 opacity-0 transition-ui hover:text-foreground group-hover:opacity-100 active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <h3 className="truncate text-sm font-semibold">{title}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          <button
            type="button"
            aria-label="Ocultar card"
            onClick={onHide}
            className="focus-ring rounded p-1 text-muted-foreground/50 opacity-0 transition-ui hover:text-foreground group-hover:opacity-100"
          >
            <EyeOff className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </Card>
  );
}

/** Chips para restaurar cards de gráficos ocultos. */
export function HiddenChartChips({
  hidden,
  labels,
  onRestore,
}: {
  hidden: string[];
  labels: Record<string, string>;
  onRestore: (id: string) => void;
}) {
  if (hidden.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">Gráficos ocultos:</span>
      {hidden.map((id) => (
        <Button
          key={id}
          variant="secondary"
          size="sm"
          className="h-7 gap-1 px-2 text-[10px]"
          onClick={() => onRestore(id)}
        >
          <Eye className="h-3 w-3" />
          {labels[id] ?? id}
        </Button>
      ))}
    </div>
  );
}
