import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg",
    "text-sm font-semibold cursor-pointer select-none",
    "transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
    "outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-card hover:bg-primary/90 hover:shadow-float",
        destructive:
          "bg-destructive text-destructive-foreground shadow-card hover:bg-destructive/90 hover:shadow-float",
        outline:
          "border border-border bg-card text-foreground shadow-card hover:border-primary/40 hover:bg-muted/60 hover:text-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline active:translate-y-0",
        success: "bg-state-paid text-primary-foreground shadow-card hover:brightness-110",
      },
      size: {
        default: "h-10 px-4 py-2 sm:h-9",
        sm: "h-9 rounded-md px-3 text-xs sm:h-8",
        lg: "h-11 rounded-lg px-7 text-[0.9375rem]",
        icon: "h-10 w-10 sm:h-9 sm:w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Mostra spinner e desabilita o botão sem alterar a largura do conteúdo. */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    if (asChild) {
      return (
        <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
          {children}
        </Comp>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }), loading && "text-transparent")}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <span className="absolute inset-0 grid place-items-center text-primary-foreground [button[data-quiet]_&]:text-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          </span>
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
