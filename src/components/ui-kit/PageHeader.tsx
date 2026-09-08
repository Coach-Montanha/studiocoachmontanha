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
        "flex flex-col gap-4 pb-6 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span
            aria-hidden
            className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15"
          >
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="text-overline mb-0.5 text-muted-foreground">{eyebrow}</p>}
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-title sm:truncate break-words">{title}</h1>
          {description && (
            <p className="text-caption mt-1 max-w-prose text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
          {actions}
        </div>
      )}
    </header>
  );
}
