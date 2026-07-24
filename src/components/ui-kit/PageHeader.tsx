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
        "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 pb-6 sm:flex sm:flex-wrap sm:items-center sm:justify-between",
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
        <div className="min-w-0">
          {eyebrow && <p className="text-overline mb-1 text-muted-foreground">{eyebrow}</p>}
          <h1 className="text-title truncate text-foreground">{title}</h1>
          {description && (
            <p className="text-caption mt-1.5 max-w-prose text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
