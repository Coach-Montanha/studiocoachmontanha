import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Um único componente para os três estados que toda aba precisa cobrir:
 * carregando (skeleton), vazio (ilustração + CTA) e erro (retry).
 *
 * Retorna `null` quando há dados — o chamador renderiza o conteúdo real:
 *   <DataState loading={…} error={…} empty={rows.length === 0} … />
 *   {rows.length > 0 && <Tabela />}
 */
export function DataState({
  loading,
  error,
  empty,
  onRetry,
  icon: Icon,
  emptyTitle = "Nada por aqui ainda",
  emptyDescription,
  action,
  rows = 5,
  variant = "list",
  className,
}: {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  onRetry?: () => void;
  icon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  action?: ReactNode;
  rows?: number;
  variant?: "list" | "cards" | "block";
  className?: string;
}) {
  if (loading) {
    if (variant === "cards") {
      return (
        <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      );
    }
    if (variant === "block") {
      return <Skeleton className={cn("h-64 w-full rounded-xl", className)} />;
    }
    return (
      <div className={cn("space-y-2", className)} role="status" aria-label="Carregando">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-14 rounded-lg"
            style={{ opacity: Math.max(0.35, 1 - i * 0.12) }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-col items-center gap-4 rounded-xl border border-destructive/25 bg-destructive/5 px-6 py-10 text-center",
          className,
        )}
      >
        <span className="grid h-11 w-11 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="space-y-1">
          <p className="text-section text-foreground">Não foi possível carregar</p>
          <p className="text-caption max-w-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Tente novamente em instantes."}
          </p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="transition-ui">
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar de novo
          </Button>
        )}
      </div>
    );
  }

  if (empty) {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-surface-sunken px-6 py-12 text-center",
          className,
        )}
      >
        {Icon && (
          <span
            aria-hidden
            className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15"
          >
            <Icon className="h-6 w-6" />
          </span>
        )}
        <div className="space-y-1.5">
          <p className="text-section text-foreground">{emptyTitle}</p>
          {emptyDescription && (
            <p className="text-caption mx-auto max-w-sm text-muted-foreground">{emptyDescription}</p>
          )}
        </div>
        {action}
      </div>
    );
  }

  return null;
}
