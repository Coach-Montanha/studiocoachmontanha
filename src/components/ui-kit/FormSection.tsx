import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Grupo de campos dentro de um diálogo/formulário.
 * Rótulo em overline + grade responsiva (1 coluna no mobile, 2 a partir de `sm`).
 */
export function FormSection({
  title,
  description,
  children,
  className,
  divided = true,
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  divided?: boolean;
}) {
  return (
    <section className={cn(divided && "border-t border-border pt-4", className)}>
      {title && (
        <div className="mb-3">
          <h3 className="text-overline text-muted-foreground">{title}</h3>
          {description && (
            <p className="text-caption mt-1 text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** Campo individual. `full` ocupa a linha inteira na grade de 2 colunas. */
export function Field({
  label,
  hint,
  full,
  children,
  className,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  full?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", full && "sm:col-span-2", className)}>
      {label && <div className="text-caption text-foreground">{label}</div>}
      {children}
      {hint && <p className="text-caption text-muted-foreground">{hint}</p>}
    </div>
  );
}
