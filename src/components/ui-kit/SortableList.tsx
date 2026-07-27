import { useMemo } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";

export type SortableRenderProps = {
  /** props para o punho de arraste */
  handleProps: Record<string, unknown>;
  isDragging: boolean;
};

/**
 * Lista vertical reordenável, acessível por teclado (Tab no punho + setas).
 * A persistência fica a cargo do consumidor via onReorder(ids).
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  disabled,
  className,
  children,
}: {
  items: T[];
  onReorder: (ids: string[]) => void;
  disabled?: boolean;
  className?: string;
  children: (item: T, props: SortableRenderProps) => React.ReactNode;
}) {
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(ids, from, to));
  }

  if (disabled) {
    return (
      <div className={className}>
        {items.map((item) => children(item, { handleProps: {}, isDragging: false }))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item) => (
            <SortableRow key={item.id} id={item.id}>
              {(props) => children(item, props)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  children,
}: {
  id: string;
  children: (props: SortableRenderProps) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "relative transition-shadow duration-200",
        isDragging && "z-20 scale-[1.01] opacity-95 shadow-lg",
      )}
    >
      {children({ handleProps: { ...attributes, ...listeners }, isDragging })}
    </div>
  );
}

/** Punho visual padronizado — usa os props devolvidos pelo SortableList. */
export function DragHandle({
  handleProps,
  label = "Reordenar",
  className,
}: {
  handleProps: Record<string, unknown>;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      {...handleProps}
      className={cn(
        "flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/60 outline-none transition-colors duration-150",
        "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card active:cursor-grabbing",
        className,
      )}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}
