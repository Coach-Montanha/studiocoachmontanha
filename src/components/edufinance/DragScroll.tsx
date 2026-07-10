import { useEffect, useRef, type ReactNode, type PointerEvent } from "react";

/**
 * Horizontal scroll container with click-and-drag ("click and roll") support.
 * Shows only a visible slice by default; drag or wheel to reveal older data.
 */
export function DragScroll({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useRef({ down: false, startX: 0, startLeft: 0, moved: false });

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    state.current = {
      down: true,
      startX: e.clientX,
      startLeft: el.scrollLeft,
      moved: false,
    };
    el.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || !state.current.down) return;
    const dx = e.clientX - state.current.startX;
    if (Math.abs(dx) > 3) state.current.moved = true;
    el.scrollLeft = state.current.startLeft - dx;
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    state.current.down = false;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`overflow-x-auto overscroll-x-contain cursor-grab active:cursor-grabbing select-none touch-pan-y ${className}`}
      style={{ scrollbarWidth: "thin" }}
    >
      {children}
    </div>
  );
}
