/**
 * PaymentProgressSteps — staged progress display for the "processing" /
 * "verifying" / "confirming" overlays.
 *
 * Why this exists:
 * Replaces a single anonymous spinner with a 5-stage timeline so the user
 * sees concrete forward motion ("validating card → encrypting → confirming
 * with bank → finalizing → enrolling"). This dramatically reduces perceived
 * wait time and the urge to close the modal during a slow charge.
 *
 * The stages are deterministic, not actually wired to backend events — they
 * advance on a timer calibrated to the typical Tap charge timing:
 *   - validating: instant (already done, shown briefly for confidence)
 *   - encrypting: 0.6 s
 *   - bank: 1.5 s
 *   - finalizing: starts when payment status flips to 'verifying'
 *   - enrolling: starts when payment status flips to 'succeeded'
 *
 * If the actual flow is faster than the animation, that's fine — the user
 * still gets the success state. If it's slower, the bank-verification stage
 * just keeps spinning (which is the truthful state anyway).
 */
import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaymentStatus } from "@/types/payment";

interface PaymentProgressStepsProps {
  paymentStatus: PaymentStatus;
  isRTL: boolean;
}

type StageId = "validating" | "encrypting" | "bank" | "finalizing" | "enrolling";

interface Stage {
  id: StageId;
  labelEn: string;
  labelAr: string;
  /** ms after `processing` started before this stage begins. */
  delayMs: number;
}

const STAGES: Stage[] = [
  { id: "validating", labelEn: "Card details validated", labelAr: "تم التحقق من بيانات البطاقة", delayMs: 0 },
  { id: "encrypting", labelEn: "Securely encrypting", labelAr: "تشفير البيانات بأمان", delayMs: 600 },
  { id: "bank", labelEn: "Confirming with your bank", labelAr: "التأكيد مع البنك", delayMs: 1500 },
  { id: "finalizing", labelEn: "Finalizing payment", labelAr: "إنهاء عملية الدفع", delayMs: 999_999 }, // gated by status
  { id: "enrolling", labelEn: "Enrolling you in the course", labelAr: "تسجيلك في الدورة", delayMs: 999_999 }, // gated by status
];

const PaymentProgressSteps: React.FC<PaymentProgressStepsProps> = ({ paymentStatus, isRTL }) => {
  const [now, setNow] = useState(0);
  const [startedAt] = useState(() => Date.now());

  // Tick every 250 ms so timed stages flip in near-real-time without a
  // wasteful 60 fps loop. challenging_3ds is included so the bank-confirm
  // stage keeps animating while the user is on the 3DS iframe.
  useEffect(() => {
    if (
      paymentStatus !== "processing" &&
      paymentStatus !== "verifying" &&
      paymentStatus !== "confirming" &&
      paymentStatus !== "challenging_3ds" &&
      paymentStatus !== "succeeded"
    ) {
      return;
    }
    const id = setInterval(() => setNow(Date.now() - startedAt), 250);
    return () => clearInterval(id);
  }, [paymentStatus, startedAt]);

  /**
   * Determine which stage the user is currently on. The first three are
   * time-driven; "finalizing" and "enrolling" are status-driven so the UI
   * never gets ahead of the actual backend state.
   */
  const getStageState = (stageId: StageId): "done" | "active" | "pending" => {
    const order: StageId[] = ["validating", "encrypting", "bank", "finalizing", "enrolling"];
    const idx = order.indexOf(stageId);

    // Status-driven gates. challenging_3ds is treated as still on the
    // "bank" stage — the user is waiting on their bank's OTP, not yet
    // finalizing the charge.
    const reachedFinalizing = paymentStatus === "verifying" || paymentStatus === "confirming" || paymentStatus === "succeeded";
    const reachedEnrolling = paymentStatus === "succeeded";

    // Compute the "current" stage index
    let currentIdx: number;
    if (reachedEnrolling) {
      currentIdx = 4; // enrolling
    } else if (reachedFinalizing) {
      currentIdx = 3; // finalizing
    } else if (now >= 1500) {
      currentIdx = 2; // bank
    } else if (now >= 600) {
      currentIdx = 1; // encrypting
    } else {
      currentIdx = 0; // validating
    }

    // Once we hit succeeded, mark every stage as done (including enrolling).
    if (paymentStatus === "succeeded") {
      return "done";
    }

    if (idx < currentIdx) return "done";
    if (idx === currentIdx) return "active";
    return "pending";
  };

  return (
    <ol
      className="w-full max-w-sm space-y-2.5"
      aria-label={isRTL ? "مراحل عملية الدفع" : "Payment progress"}
    >
      {STAGES.map((stage) => {
        const state = getStageState(stage.id);
        const label = isRTL ? stage.labelAr : stage.labelEn;
        return (
          <li
            key={stage.id}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-300",
              state === "active" && "bg-primary/5",
              state === "done" && "opacity-100",
              state === "pending" && "opacity-50",
            )}
            aria-current={state === "active" ? "step" : undefined}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              {state === "done" && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
              {state === "active" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {state === "pending" && <Circle className="h-4 w-4 text-muted-foreground/40" />}
            </span>
            <span
              className={cn(
                "text-sm transition-colors",
                state === "active" && "font-semibold text-foreground",
                state === "done" && "font-medium text-foreground/80",
                state === "pending" && "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
};

export default PaymentProgressSteps;
