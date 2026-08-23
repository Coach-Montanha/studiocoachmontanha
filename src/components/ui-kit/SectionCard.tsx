import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Card de seção com header interno consistente.
 * Substitui os blocos `<Card><CardHeader>…` repetidos em analytics,
 * perfil e settings, com a mesma escala de respiro em todas as telas.
 */
export function SectionCard({
  title,
  description,
  icon: Icon,
  actions,
  children,
  footer,
  padded = true,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  padded?: boolean;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[var(--radius-card-val)] border border-border bg-card shadow-card transition-ui",
        className,
      )}
    >
      {(title || actions) && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon && (
              <span aria-hidden className="shrink-0 text-muted-foreground">
                <Icon className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="text-section truncate text-foreground">{title}</h2>}
              {description && (
                <p className="text-caption mt-0.5 truncate text-muted-foreground">{description}</p>
              )}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(padded && "p-4 sm:p-5", bodyClassName)}>{children}</div>
      {footer && (
        <div className="border-t border-border bg-surface-sunken px-4 py-3 sm:px-5">{footer}</div>
      )}
    </section>
  );
}
