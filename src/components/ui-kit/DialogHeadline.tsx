import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

/**
 * Cabeçalho padrão dos diálogos: cápsula com ícone + título e apoio.
 * Mantém alinhamento e hierarquia iguais em todo o app.
 */
export function DialogHeadline({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <DialogHeader>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15"
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </div>
      </div>
    </DialogHeader>
  );
}
