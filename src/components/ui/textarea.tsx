import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          [
            "flex min-h-[76px] w-full rounded-lg border border-input bg-card px-3 py-2 text-base shadow-card md:text-sm",
            "transition-[color,background-color,border-color,box-shadow] duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
            "placeholder:text-muted-foreground hover:border-primary/30",
            "outline-hidden focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/35",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
          ].join(" "),
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
