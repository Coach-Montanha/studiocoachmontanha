import * as React from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KanbanColumnItem {
  id: UniqueIdentifier;
  [key: string]: any;
}

export interface KanbanColumnDef {
  id: UniqueIdentifier;
  title: string;
  badge?: React.ReactNode;
  tone?: "default" | "primary" | "success" | "warning" | "destructive" | "muted";
  items: KanbanColumnItem[];
}

// ── Board Component ──────────────────────────────────────────────────────────

export interface KanbanBoardProps {
  columns: KanbanColumnDef[];
  onDragEnd: (event: DragEndEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
  children: React.ReactNode;
  className?: string;
  renderOverlayCard?: (activeItem: KanbanColumnItem | null) => React.ReactNode;
}

export function KanbanBoard({
  columns,
  onDragEnd,
  onDragOver,
  children,
  className,
  renderOverlayCard,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = React.useState<UniqueIdentifier | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const activeItem = React.useMemo(() => {
    if (!activeId) return null;
    for (const col of columns) {
      const found = col.items.find((item) => item.id === activeId);
      if (found) return found;
    }
    return null;
  }, [columns, activeId]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    onDragEnd(event);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={onDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        className={cn(
          "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0 w-full",
          className,
        )}
      >
        {children}
      </div>

      <DragOverlay dropAnimation={{ duration: 150, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
        {activeItem && renderOverlayCard ? (
          <div className="rotate-1 scale-105 opacity-95 shadow-xl cursor-grabbing pointer-events-none">
            {renderOverlayCard(activeItem)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ── Column Component ─────────────────────────────────────────────────────────

export interface KanbanColumnProps {
  id: UniqueIdentifier;
  title: string;
  count?: number;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "primary" | "success" | "warning" | "destructive" | "muted";
  items: KanbanColumnItem[];
  children?: React.ReactNode;
  className?: string;
  emptyText?: string;
}

const toneDotStyles: Record<string, string> = {
  default: "bg-muted-foreground",
  primary: "bg-primary",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground/60",
};

export function KanbanColumn({
  id,
  title,
  count,
  badge,
  icon,
  tone = "default",
  items,
  children,
  className,
  emptyText = "Nenhum item nesta coluna",
}: KanbanColumnProps) {
  const itemIds = React.useMemo(() => items.map((i) => i.id), [items]);

  return (
    <div
      data-column-id={id}
      className={cn(
        "flex flex-col rounded-xl border border-border/80 bg-muted/20 p-3 shadow-2xs backdrop-blur-xs min-h-[350px] transition-colors",
        className,
      )}
    >
      {/* Column Header */}
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span
            className={cn("h-2.5 w-2.5 rounded-full ring-2 ring-background", toneDotStyles[tone] || toneDotStyles.default)}
          />
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <h3 className="text-sm font-bold tracking-tight text-foreground">{title}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {badge}
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">
            {count ?? items.length}
          </span>
        </div>
      </div>

      {/* Column Body / Droppable Cards Container */}
      <SortableContext id={String(id)} items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
              {emptyText}
            </div>
          ) : (
            children
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ── Card Component ───────────────────────────────────────────────────────────

export interface KanbanCardProps {
  id: UniqueIdentifier;
  children: React.ReactNode;
  className?: string;
  isDragging?: boolean;
}

export function KanbanCard({ id, children, className }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-lg border border-border/80 bg-card p-3 shadow-2xs transition-all hover:border-primary/40 hover:shadow-xs",
        isDragging && "ring-2 ring-primary/40 shadow-md",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Arrastar card"
          className="mt-0.5 -ml-1 flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground active:cursor-grabbing focus:opacity-100 focus-ring"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
