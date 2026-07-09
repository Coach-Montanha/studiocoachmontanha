import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type Pending = ConfirmOptions & { resolve: (v: boolean) => void };

let setPendingExternal: ((p: Pending | null) => void) | null = null;

export function confirmDialog(
  descriptionOrOptions: string | ConfirmOptions,
): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const opts: ConfirmOptions =
    typeof descriptionOrOptions === "string"
      ? { description: descriptionOrOptions }
      : descriptionOrOptions;
  return new Promise((resolve) => {
    if (!setPendingExternal) {
      // Fallback if host not mounted
      resolve(window.confirm(opts.description ?? ""));
      return;
    }
    setPendingExternal({ ...opts, resolve });
  });
}

export function ConfirmDialogHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    setPendingExternal = setPending;
    return () => {
      setPendingExternal = null;
    };
  }, []);

  const close = (result: boolean) => {
    if (pending) pending.resolve(result);
    setPending(null);
  };

  return (
    <AlertDialog open={!!pending} onOpenChange={(o) => !o && close(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending?.title ?? "Coach Montanha diz"}</AlertDialogTitle>
          {pending?.description && (
            <AlertDialogDescription className="whitespace-pre-line">
              {pending.description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>
            {pending?.cancelLabel ?? "Cancelar"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className={
              pending?.destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {pending?.confirmLabel ?? "OK"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
