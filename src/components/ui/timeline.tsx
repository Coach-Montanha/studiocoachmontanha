import * as React from "react";
import { cn } from "@/lib/utils";

export interface TimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export const Timeline = React.forwardRef<HTMLDivElement, TimelineProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("relative space-y-6", className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
Timeline.displayName = "Timeline";

export interface TimelineItemProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  status?: "default" | "completed" | "active" | "warning" | "destructive";
}

export const TimelineItem = React.forwardRef<HTMLDivElement, TimelineItemProps>(
  ({ className, children, status = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-status={status}
        className={cn(
          "group relative flex gap-4 pb-6 last:pb-0",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
TimelineItem.displayName = "TimelineItem";

export interface TimelineConnectorProps extends React.HTMLAttributes<HTMLDivElement> {}

export const TimelineConnector = React.forwardRef<HTMLDivElement, TimelineConnectorProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        aria-hidden="true"
        className={cn(
          "absolute left-3.5 top-7 -bottom-6 w-0.5 bg-border/80 group-last:hidden transition-colors",
          className,
        )}
        {...props}
      />
    );
  },
);
TimelineConnector.displayName = "TimelineConnector";

export interface TimelineIconProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  variant?: "default" | "primary" | "success" | "warning" | "destructive" | "muted";
}

const variantStyles: Record<NonNullable<TimelineIconProps["variant"]>, string> = {
  default: "border-border bg-background text-foreground",
  primary: "border-primary/30 bg-primary/10 text-primary ring-primary/20",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  destructive: "border-destructive/30 bg-destructive/10 text-destructive ring-destructive/20",
  muted: "border-border/60 bg-muted text-muted-foreground",
};

export const TimelineIcon = React.forwardRef<HTMLDivElement, TimelineIconProps>(
  ({ className, children, variant = "primary", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border shadow-xs ring-4 ring-background transition-all",
          variantStyles[variant],
          className,
        )}
        {...props}
      >
        {children || <span className="h-2 w-2 rounded-full bg-current" />}
      </div>
    );
  },
);
TimelineIcon.displayName = "TimelineIcon";

export interface TimelineContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export const TimelineContent = React.forwardRef<HTMLDivElement, TimelineContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex-1 pt-0.5 min-w-0 space-y-2", className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
TimelineContent.displayName = "TimelineContent";

export interface TimelineHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export const TimelineHeader = React.forwardRef<HTMLDivElement, TimelineHeaderProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-wrap items-center justify-between gap-2", className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
TimelineHeader.displayName = "TimelineHeader";

export interface TimelineTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children?: React.ReactNode;
}

export const TimelineTitle = React.forwardRef<HTMLHeadingElement, TimelineTitleProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <h4
        ref={ref}
        className={cn("text-sm font-semibold leading-tight text-foreground tracking-tight", className)}
        {...props}
      >
        {children}
      </h4>
    );
  },
);
TimelineTitle.displayName = "TimelineTitle";

export interface TimelineTimeProps extends React.HTMLAttributes<HTMLTimeElement> {
  children?: React.ReactNode;
}

export const TimelineTime = React.forwardRef<HTMLTimeElement, TimelineTimeProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <time
        ref={ref}
        className={cn("text-[11px] font-medium text-muted-foreground tabular-nums tracking-wide uppercase", className)}
        {...props}
      >
        {children}
      </time>
    );
  },
);
TimelineTime.displayName = "TimelineTime";

export interface TimelineDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children?: React.ReactNode;
}

export const TimelineDescription = React.forwardRef<HTMLParagraphElement, TimelineDescriptionProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn("text-xs text-muted-foreground leading-relaxed", className)}
        {...props}
      >
        {children}
      </p>
    );
  },
);
TimelineDescription.displayName = "TimelineDescription";
