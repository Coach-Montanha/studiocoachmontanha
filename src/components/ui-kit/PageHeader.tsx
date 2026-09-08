import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cabeçalho de página padrão.
 *
 * Layout: grid de duas colunas no mobile (texto encolhe/trunca, ações fixas),
 * vira flex a partir de `sm`. Respiro na escala de 4/8px.
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  eyebrow,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex w-full max-w-full min-w-0 flex-col gap-3 pb-4 sm:pb-6 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 max-w-full flex-1 items-start gap-2.5 sm:gap-3">
        {Icon && (
          <span
            aria-hidden
            className="mt-0.5 grid h-9 w-9 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15"
          >
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="text-overline mb-0.5 text-muted-foreground">{eyebrow}</p>}
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-title break-words">{title}</h1>
          {description && (
            <p className="text-caption mt-1 max-w-prose text-muted-foreground break-words">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex w-full max-w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
          {actions}
        </div>
      )}
    </header>
  );
}
