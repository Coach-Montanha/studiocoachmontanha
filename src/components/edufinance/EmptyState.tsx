import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Estado vazio padrão — mesma linguagem visual do `DataState`
 * (borda tracejada, superfície rebaixada, ícone em cápsula com anel).
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-surface-sunken px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <span
          aria-hidden
          className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15"
        >
          {icon}
        </span>
      )}
      <div className="space-y-1.5">
        <p className="text-section text-foreground">{title}</p>
        {description && (
          <p className="text-caption mx-auto max-w-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
