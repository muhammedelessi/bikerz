import React, { forwardRef, useEffect, useState } from 'react';
import { Loader2, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Checkout3DSModalProps {
  url: string;
  onCancel: () => void;
  /**
   * Optional manual verify trigger. Wired to `tap.recheckStatus()`.
   * Shown alongside Cancel in the 60 s "stuck hint" so a user who
   * already entered OTP successfully but is staring at a Tap loading
   * spinner (cross-origin nav blocked the redirect chain) can force a
   * status check from Tap directly instead of waiting for the watchdog.
   */
  onVerifyNow?: () => void;
}

// forwardRef so the parent (Radix Dialog Portal / framer Presence) can
// attach a ref to the outermost element for mount-tracking without
// triggering a "Function components cannot be given refs" dev warning.

/** In-page 3-D Secure iframe — replaces Tap's hosted result page so the user
 *  never leaves our branded UI. The iframe loads Tap's challenge page; on
 *  completion Tap redirects (within the iframe) to our static
 *  /tap-3ds-callback.html, which postMessages the result back to the parent
 *  window — useTapPayment listens for that message.
 *
 *  Why no `sandbox` attribute:
 *  Tap's 3DS flow uses three nested iframes — the outer redirect (this
 *  iframe), an inner threeDsLoading iframe Tap injects, and the bank's
 *  OTP iframe. When the bank confirms OTP, Tap's inner iframe redirects
 *  *its parent* (this iframe) back to Tap's `response.aspx` URL via
 *  `parent.location.href = ...`. The HTML sandbox spec has NO flag that
 *  permits navigating a non-top, cross-origin ancestor — `allow-top-
 *  navigation` only applies to the top browsing context. So any sandbox at
 *  all on this iframe breaks the BOP / cross-bank 3DS handoff (we saw it
 *  break with errors like "frame attempting navigation is sandboxed,
 *  therefore disallowed from navigating its ancestors" + "Failed to set
 *  the 'href' property on 'Location'"). The trade-off — defence-in-depth
 *  vs. a working payment flow — is decided by trust model: this iframe
 *  loads `authenticate.tap.company`, a partner origin we already trust
 *  with cardholder data, so dropping the sandbox is the same posture as
 *  Stripe/Adyen/Tap's own reference integrations.
 *
 *  The `allow=...` attribute stays — it's permission *delegation*
 *  (Payment Request API, WebAuthn) and unrelated to the navigation
 *  sandboxing problem.
 *
 *  After 60 s of being open we surface a "still waiting?" hint with a clear
 *  cancel option — the bank's OTP step is the most common abandonment
 *  point, and previously the only signal was a tiny "Cancel" link the user
 *  often missed. The watchdog in useTapPayment additionally times out after
 *  3 min and routes to the recovery overlay.
 */
const Checkout3DSModal = forwardRef<HTMLDivElement, Checkout3DSModalProps>(({ url, onCancel, onVerifyNow }, ref) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';
  const [showStuckHint, setShowStuckHint] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Lock body scroll while 3DS is open so the page behind doesn't move
  // around on iOS when the soft keyboard appears for OTP entry.
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Show the "still waiting?" hint after 60 s so the user knows they can
  // cancel without breaking anything (banks that take longer than this
  // are usually a sign of an OTP that didn't arrive).
  useEffect(() => {
    const id = setTimeout(() => setShowStuckHint(true), 60_000);
    return () => clearTimeout(id);
  }, []);

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={isRTL ? 'تأكيد البطاقة' : 'Card verification'}
    >
      {/*
        100dvh lets the iframe use the *dynamic* viewport — on mobile, that
        means the soft keyboard (for OTP entry) shrinks the available area
        without the iframe extending below the visible region.
      */}
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl border-2 border-border bg-card shadow-2xl"
           style={{ height: 'min(100dvh - 24px, 720px)' }}>
        <div className="px-4 py-3 border-b-2 border-border bg-gradient-to-b from-muted/40 to-muted/20 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground min-w-0">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <div className="min-w-0 flex flex-col leading-tight">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                {isRTL ? 'تحقّق آمن' : 'Secure verification'}
              </span>
              <span className="truncate text-xs font-bold text-foreground">
                {isRTL ? 'تأكيد البطاقة 3D Secure' : 'Card Verification (3D Secure)'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 min-h-[36px] px-3 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md border border-border bg-background hover:border-destructive/40"
            aria-label={isRTL ? 'إلغاء التحقق' : 'Cancel verification'}
          >
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
        </div>

        {/* Reassurance strip — tells the user they're on a real verification
            step, not stuck. Loader spins to confirm motion. */}
        <div className="px-4 py-2.5 bg-primary/5 border-b border-primary/20 flex items-center gap-2 text-xs text-foreground/80 flex-shrink-0">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
          <span className="leading-tight">
            {isRTL
              ? 'بنك بطاقتك يطلب رمز التحقق (OTP). أدخل الرمز لإتمام الدفع.'
              : "Your bank is requesting a verification code (OTP). Enter it to complete the payment."}
          </span>
        </div>

        <iframe
          src={url}
          title="3D Secure"
          dir="ltr"
          className="flex-1 w-full bg-white"
          style={{ direction: 'ltr', minHeight: 0, touchAction: 'auto' }}
          allow="payment *; publickey-credentials-get *"
          referrerPolicy="no-referrer-when-downgrade"
        />

        {/* "Still waiting?" hint — appears after 60 s.
            Now offers TWO actions:
              1. "Verify status now" — for users who completed OTP but are
                 stuck on Tap's loading spinner (the cross-origin redirect
                 broke). Pulls the charge status directly from Tap.
              2. "Cancel and use a different card" — for users whose OTP
                 didn't arrive at all. */}
        {showStuckHint && (
          <div className="px-4 py-3 bg-amber-500/10 border-t-2 border-amber-500/30 flex items-start gap-2.5 flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 text-xs">
              <p className="font-semibold text-foreground mb-0.5">
                {isRTL ? 'هل تأخر الرد؟' : "Taking too long?"}
              </p>
              <p className="text-muted-foreground">
                {isRTL
                  ? 'إذا أدخلت الرمز ولم تنتقل الصفحة، اضغط "تحقق الآن". وإذا لم يصلك الرمز، اضغط إلغاء.'
                  : 'If you entered the code but the page is stuck, tap "Verify now". If the code never arrived, tap Cancel.'}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
                {onVerifyNow && (
                  <button
                    type="button"
                    disabled={verifying}
                    onClick={async () => {
                      setVerifying(true);
                      try {
                        await onVerifyNow();
                      } finally {
                        setVerifying(false);
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2 -mx-2 py-1 text-xs font-semibold text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${verifying ? 'animate-spin' : ''}`} />
                    {isRTL ? 'تحقق من الحالة الآن' : 'Verify status now'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex items-center gap-1 px-2 -mx-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
                >
                  {isRTL ? 'إلغاء واستخدام بطاقة مختلفة' : 'Cancel and use a different card'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

Checkout3DSModal.displayName = "Checkout3DSModal";

export default Checkout3DSModal;
