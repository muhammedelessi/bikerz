/**
 * CheckoutStepIndicator — modern progress indicator for the 2-step checkout.
 *
 * Visual rules:
 * - Active step: filled primary circle with a subtle ring + bold digit
 * - Completed step: primary fill with check icon
 * - Upcoming step: muted background, muted digit
 * - Connector: animated fill that follows progress (0% → 100% as step changes)
 *
 * The component is responsive — on mobile it stays compact (icons + short labels)
 * while on desktop it gets full labels with descriptions for clarity.
 */
import React from "react";
import { Check, User, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckoutStepIndicatorProps {
  currentStep: "info" | "payment";
  isRTL: boolean;
  /** Hide the info step entirely (used when the user came in with a complete profile). */
  hideInfoStep?: boolean;
  /** Compact variant — used in the mobile header where space is tight. */
  compact?: boolean;
}

const CheckoutStepIndicator: React.FC<CheckoutStepIndicatorProps> = ({
  currentStep,
  isRTL,
  hideInfoStep = false,
  compact = false,
}) => {
  if (hideInfoStep) return null;

  const infoDone = currentStep === "payment";
  const paymentActive = currentStep === "payment";

  const labels = {
    info: isRTL ? "بياناتك" : "Your Info",
    payment: isRTL ? "الدفع" : "Payment",
  };
  const sublabels = {
    info: isRTL ? "البيانات الشخصية" : "Personal details",
    payment: isRTL ? "إتمام الشراء" : "Complete purchase",
  };

  if (compact) {
    return (
      <div
        className="flex items-center gap-1.5 text-xs"
        aria-label={isRTL ? "خطوات الدفع" : "Checkout steps"}
      >
        <CompactDot active={!infoDone} done={infoDone} digit={1} />
        <div className="h-0.5 w-6 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full bg-primary transition-all duration-500 ease-out",
              infoDone ? "w-full" : "w-0",
            )}
          />
        </div>
        <CompactDot active={paymentActive} done={false} digit={2} />
        <span className="ms-1 font-semibold text-foreground">
          {paymentActive ? labels.payment : labels.info}
        </span>
        <span className="text-muted-foreground tabular-nums">
          {paymentActive ? "2/2" : "1/2"}
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex items-stretch gap-0 w-full"
      aria-label={isRTL ? "خطوات الدفع" : "Checkout steps"}
    >
      <FullStep
        active={!infoDone}
        done={infoDone}
        digit={1}
        icon={User}
        label={labels.info}
        sublabel={sublabels.info}
      />
      <Connector filled={infoDone} />
      <FullStep
        active={paymentActive}
        done={false}
        digit={2}
        icon={CreditCard}
        label={labels.payment}
        sublabel={sublabels.payment}
      />
    </div>
  );
};

const CompactDot: React.FC<{ active: boolean; done: boolean; digit: number }> = ({ active, done, digit }) => (
  <span
    className={cn(
      "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-all",
      done && "bg-primary text-primary-foreground",
      active && !done && "bg-primary text-primary-foreground ring-2 ring-primary/25",
      !active && !done && "bg-muted text-muted-foreground",
    )}
    aria-current={active ? "step" : undefined}
  >
    {done ? <Check className="w-3 h-3" /> : digit}
  </span>
);

const FullStep: React.FC<{
  active: boolean;
  done: boolean;
  digit: number;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel: string;
}> = ({ active, done, digit, icon: Icon, label, sublabel }) => (
  <div className="flex items-center gap-2.5 flex-1 min-w-0">
    <span
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
        done && "bg-primary text-primary-foreground",
        active && !done && "bg-primary text-primary-foreground ring-4 ring-primary/15",
        !active && !done && "bg-muted text-muted-foreground border-2 border-border",
      )}
      aria-current={active ? "step" : undefined}
    >
      {done ? <Check className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
    </span>
    <div className="min-w-0 flex flex-col leading-tight">
      <span
        className={cn(
          "text-xs font-bold uppercase tracking-wide transition-colors",
          active || done ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "text-[10px] transition-colors hidden sm:block",
          active ? "text-primary font-medium" : "text-muted-foreground",
        )}
      >
        {sublabel}
      </span>
    </div>
  </div>
);

const Connector: React.FC<{ filled: boolean }> = ({ filled }) => (
  <div className="flex items-center px-2 sm:px-3">
    <div className="h-0.5 w-8 sm:w-12 rounded-full bg-muted overflow-hidden">
      <div
        className={cn(
          "h-full bg-primary transition-all duration-500 ease-out",
          filled ? "w-full" : "w-0",
        )}
      />
    </div>
  </div>
);

export default CheckoutStepIndicator;
