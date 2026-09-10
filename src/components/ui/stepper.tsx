import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface StepItem {
  id?: string | number;
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

export interface StepperProps {
  steps: StepItem[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
  className?: string;
}

export function Stepper({ steps, currentStep, onStepClick, className }: StepperProps) {
  return (
    <div className={cn("w-full py-2", className)}>
      <nav aria-label="Progresso das etapas">
        <ol className="flex items-center justify-between gap-2">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isActive = index === currentStep;
            const isClickable = Boolean(onStepClick && index <= currentStep);

            return (
              <li
                key={step.id || index}
                className={cn("flex items-center flex-1 last:flex-initial", {
                  "cursor-pointer": isClickable,
                })}
                onClick={() => isClickable && onStepClick?.(index)}
              >
                <div className="flex items-center gap-2.5">
                  {/* Step Circle Indicator */}
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all select-none",
                      isCompleted && "bg-primary text-primary-foreground ring-2 ring-primary/20",
                      isActive && "border-2 border-primary bg-primary/10 text-primary font-bold ring-4 ring-primary/15",
                      !isCompleted && !isActive && "border border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4 stroke-[2.5]" />
                    ) : step.icon ? (
                      step.icon
                    ) : (
                      index + 1
                    )}
                  </div>

                  {/* Step Title & Description */}
                  <div className="hidden sm:block text-left">
                    <p
                      className={cn(
                        "text-xs font-medium leading-none tracking-tight",
                        isActive ? "text-foreground font-semibold" : isCompleted ? "text-foreground/90" : "text-muted-foreground",
                      )}
                    >
                      {step.title}
                    </p>
                    {step.description && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">
                        {step.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Horizontal Connector Line */}
                {index < steps.length - 1 && (
                  <div
                    aria-hidden="true"
                    className={cn(
                      "mx-2 sm:mx-4 h-0.5 flex-1 transition-colors",
                      index < currentStep ? "bg-primary" : "bg-border/80",
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

export interface StepperFooterProps {
  currentStep: number;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
  onFinish?: () => void;
  isNextDisabled?: boolean;
  isPrevDisabled?: boolean;
  isLoading?: boolean;
  nextLabel?: string;
  prevLabel?: string;
  finishLabel?: string;
  className?: string;
}

export function StepperFooter({
  currentStep,
  totalSteps,
  onPrev,
  onNext,
  onFinish,
  isNextDisabled = false,
  isPrevDisabled = false,
  isLoading = false,
  nextLabel = "Próximo",
  prevLabel = "Voltar",
  finishLabel = "Concluir",
  className,
}: StepperFooterProps) {
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className={cn("flex items-center justify-between pt-4 border-t border-border/60", className)}>
      <Button
        type="button"
        variant="outline"
        onClick={onPrev}
        disabled={currentStep === 0 || isPrevDisabled || isLoading}
      >
        {prevLabel}
      </Button>

      {isLastStep ? (
        <Button
          type="button"
          onClick={onFinish || onNext}
          disabled={isNextDisabled || isLoading}
        >
          {isLoading ? "Salvando..." : finishLabel}
        </Button>
      ) : (
        <Button
          type="button"
          onClick={onNext}
          disabled={isNextDisabled || isLoading}
        >
          {nextLabel}
        </Button>
      )}
    </div>
  );
}
