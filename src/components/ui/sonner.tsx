import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Toasts alinhados ao design system: superfície de popover, elevação flutuante
 * e tons de estado vindos de tokens (nada chumbado, dark mode de graça).
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:rounded-xl group-[.toaster]:shadow-float group-[.toaster]:gap-3",
          title: "group-[.toast]:text-section",
          description: "group-[.toast]:text-caption group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg group-[.toast]:transition-ui",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg group-[.toast]:transition-ui",
          closeButton:
            "group-[.toast]:bg-popover group-[.toast]:border-border group-[.toast]:text-muted-foreground",
          success:
            "group-[.toaster]:border-state-paid/30 group-[.toaster]:[&_svg]:text-state-paid",
          warning:
            "group-[.toaster]:border-state-pending/30 group-[.toaster]:[&_svg]:text-state-pending",
          error:
            "group-[.toaster]:border-destructive/30 group-[.toaster]:[&_svg]:text-destructive",
          info: "group-[.toaster]:border-primary/30 group-[.toaster]:[&_svg]:text-primary",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
