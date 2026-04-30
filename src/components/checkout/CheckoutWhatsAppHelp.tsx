/**
 * CheckoutWhatsAppHelp — discreet "Need help?" button that opens WhatsApp
 * with a prefilled message tailored to the user's current checkout state.
 *
 * Why context-aware text:
 *   - On a slow charge (`processing`/`verifying`) we hint that we're checking
 *     on the payment so the agent can pick up faster.
 *   - On `confirming` (verify polling exhausted) we tell support the charge
 *     may be in limbo and include the user's last-known charge state.
 *   - On `failed` we paste the failure reason so the agent doesn't need to
 *     ask the user to re-explain.
 *   - On `idle` (during step 1/2 form) we keep it generic.
 *
 * Why a delayMs:
 *   - During the happy path (charge takes 4-6 s) the button would flash on
 *     screen unnecessarily. We hide it for the first N seconds so it only
 *     appears for users who are actually waiting longer than expected.
 *
 * Privacy: we never include the card number, CVV, or token id in the message.
 * Only the course id and any server-emitted error string the user already saw.
 */
import React, { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { buildWhatsAppLink } from "@/config/support";

export type WhatsAppHelpContext = "idle" | "processing" | "confirming" | "failed";

interface CheckoutWhatsAppHelpProps {
  /** What state the checkout is in — controls the prefilled message tone. */
  context: WhatsAppHelpContext;
  /** Defer rendering for N ms (useful during fast happy-path waits). */
  delayMs?: number;
  /** Optional: course id to include in the message body for support context. */
  courseId?: string;
  /** Optional: failure reason copied verbatim into the message body. */
  reason?: string;
  /** Optional: charge id so support can look it up in Tap dashboard. */
  chargeId?: string | null;
  /** Display variant — `inline` is a quiet text link, `pill` is a soft button. */
  variant?: "inline" | "pill";
}

const CheckoutWhatsAppHelp = React.forwardRef<HTMLAnchorElement, CheckoutWhatsAppHelpProps>(({
  context,
  delayMs = 0,
  courseId,
  reason,
  chargeId,
  variant = "pill",
}, ref) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [visible, setVisible] = useState(delayMs <= 0);

  useEffect(() => {
    if (delayMs <= 0) {
      setVisible(true);
      return;
    }
    const id = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);

  if (!visible) return null;

  const message = composeMessage({ context, isRTL, courseId, reason, chargeId });
  const href = buildWhatsAppLink(message);
  const label = t(`checkout.whatsAppHelp.${context}`, {
    defaultValue: isRTL ? "محتاج مساعدة؟ تواصل معنا" : "Need help? Chat with us",
  });

  if (variant === "inline") {
    return (
      <a
        ref={ref}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#25D366] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] rounded"
        aria-label={isRTL ? "تواصل معنا عبر واتساب" : "Contact us on WhatsApp"}
      >
        <MessageCircle className="h-3.5 w-3.5" />
        <span>{label}</span>
      </a>
    );
  }

  return (
    <a
      ref={ref}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-2 text-xs font-semibold text-[#128C7E] dark:text-[#25D366] transition-colors hover:bg-[#25D366]/20 hover:border-[#25D366] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] min-h-[36px]"
      aria-label={isRTL ? "تواصل معنا عبر واتساب" : "Contact us on WhatsApp"}
    >
      <MessageCircle className="h-4 w-4" />
      <span>{label}</span>
    </a>
  );
});

CheckoutWhatsAppHelp.displayName = "CheckoutWhatsAppHelp";

interface ComposeArgs {
  context: WhatsAppHelpContext;
  isRTL: boolean;
  courseId?: string;
  reason?: string;
  chargeId?: string | null;
}

function composeMessage(args: ComposeArgs): string {
  const { context, isRTL, courseId, reason, chargeId } = args;

  const lines: string[] = [];

  if (isRTL) {
    if (context === "processing") {
      lines.push("مرحباً، أحاول إكمال عملية دفع وعملية التحقق تأخذ وقتاً.");
    } else if (context === "confirming") {
      lines.push("مرحباً، أحتاج مساعدة — قد تكون عملية الدفع نجحت ولكن الحالة لم تُؤكَّد بعد.");
    } else if (context === "failed") {
      lines.push("مرحباً، فشلت محاولة الدفع وأحتاج مساعدة لإكمال التسجيل.");
    } else {
      lines.push("مرحباً، أحتاج مساعدة في إتمام عملية الشراء.");
    }
  } else {
    if (context === "processing") {
      lines.push("Hi — I'm trying to complete a payment and the verification is taking longer than expected.");
    } else if (context === "confirming") {
      lines.push("Hi — I need help. My payment may have succeeded but the status hasn't been confirmed yet.");
    } else if (context === "failed") {
      lines.push("Hi — my payment attempt failed and I need help completing the enrollment.");
    } else {
      lines.push("Hi, I need help completing my purchase.");
    }
  }

  if (courseId) {
    lines.push(isRTL ? `معرّف الدورة: ${courseId}` : `Course ID: ${courseId}`);
  }
  if (chargeId) {
    lines.push(isRTL ? `رقم العملية: ${chargeId}` : `Charge ID: ${chargeId}`);
  }
  if (reason) {
    // Trim to a sane length so we don't paste a giant stack trace into WhatsApp.
    const trimmed = reason.length > 240 ? `${reason.slice(0, 240)}…` : reason;
    lines.push(isRTL ? `سبب الفشل: ${trimmed}` : `Failure reason: ${trimmed}`);
  }

  return lines.join("\n");
}

export default CheckoutWhatsAppHelp;
