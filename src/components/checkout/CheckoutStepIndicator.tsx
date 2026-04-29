/**
 * CheckoutStepIndicator — minimal "1 / 2" progress bar for the checkout modal.
 *
 * Visual rules:
 * - Active step: solid primary background, white digit.
 * - Completed step: primary outline + check icon (replaces digit).
 * - Upcoming step: muted background, muted digit.
 * - Connector line between the two steps fills with primary as the user advances.
 *
 * Bilingual: labels swap AR/EN; layout uses logical CSS so RTL just works.
 */
import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckoutStepIndicatorProps {
  currentStep: "info" | "payment";
  isRTL: boolean;
  /** Hide the info step entirely (used when the user came in with a complete profile). */
  hideInfoStep?: boolean;
}

const CheckoutStepIndicator: React.FC<CheckoutStepIndicatorProps> = ({
  currentStep,
  isRTL,
  hideInfoStep = false,
}) => {
  if (hideInfoStep) return null;

  const infoDone = currentStep === "payment";
  const paymentActive = currentStep === "payment";

  const labels = {
    info: isRTL ? "بياناتك" : "Your info",
    payment: isRTL ? "الدفع" : "Payment",
  };

  return (
    <div className="flex items-center gap-2 text-xs" aria-label={isRTL ? "خطوات الدفع" : "Checkout steps"}>
      <StepDot active={!infoDone} done={infoDone} digit={1} label={labels.info} />
      <div className="h-0.5 flex-1 max-w-[48px] rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full bg-primary transition-all duration-300",
            infoDone ? "w-full" : "w-0",
          )}
        />
      </div>
      <StepDot active={paymentActive} done={false} digit={2} label={labels.payment} />
    </div>
  );
};

const StepDot: React.FC<{ active: boolean; done: boolean; digit: number; label: string }> = ({
  active,
  done,
  digit,
  label,
}) => {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-colors",
          done && "bg-primary/15 text-primary border border-primary",
          active && !done && "bg-primary text-primary-foreground",
          !active && !done && "bg-muted text-muted-foreground",
        )}
        aria-current={active ? "step" : undefined}
      >
        {done ? <Check className="w-3 h-3" /> : digit}
      </span>
      <span
        className={cn(
          "text-[11px] font-medium transition-colors",
          active || done ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  );
};

export default CheckoutStepIndicator;
