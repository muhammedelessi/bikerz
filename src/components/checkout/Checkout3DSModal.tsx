import React, { forwardRef, useEffect, useState } from 'react';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Checkout3DSModalProps {
  url: string;
  onCancel: () => void;
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
 *  Sandbox attributes are explicit (rather than open-by-default) so a
 *  malicious 3DS challenge page cannot escape the iframe to manipulate the
 *  parent app. The bare minimum for 3DS to work is:
 *    - allow-forms        : 3DS challenges submit forms
 *    - allow-scripts      : 3DS pages run JS
 *    - allow-same-origin  : Tap's challenge needs cookies on its own origin
 *    - allow-top-navigation-by-user-activation : in case the bank's challenge
 *                            redirects via a user-clicked link
 *    - allow-popups       : some banks open OTP entry in a popup
 *
 *  After 60 s of being open we surface a "still waiting?" hint with a clear
 *  cancel option — the bank's OTP step is the most common abandonment
 *  point, and previously the only signal was a tiny "Cancel" link the user
 *  often missed. The watchdog in useTapPayment additionally times out after
 *  3 min and routes to the recovery overlay.
 */
const Checkout3DSModal = forwardRef<HTMLDivElement, Checkout3DSModalProps>(({ url, onCancel }, ref) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';
  const [showStuckHint, setShowStuckHint] = useState(false);

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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={isRTL ? 'تأكيد البطاقة' : 'Card verification'}
    >
      {/*
        100dvh lets the iframe use the *dynamic* viewport — on mobile, that
        means the soft keyboard (for OTP entry) shrinks the available area
        without the iframe extending below the visible region.
      */}
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-xl border-2 border-border bg-card shadow-2xl"
           style={{ height: 'min(100dvh - 24px, 720px)' }}>
        <div className="px-4 py-3 border-b-2 border-border bg-muted/30 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground min-w-0">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate">
              {isRTL ? 'تأكيد البطاقة (3D Secure)' : 'Card Verification (3D Secure)'}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 min-h-[36px] px-3 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded border border-transparent hover:border-border"
            aria-label={isRTL ? 'إلغاء التحقق' : 'Cancel verification'}
          >
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
        </div>

        {/* Reassurance strip — tells the user they're on a real verification
            step, not stuck. Loader spins to confirm motion. */}
        <div className="px-4 py-2 bg-primary/5 border-b border-primary/20 flex items-center gap-2 text-xs text-foreground/80 flex-shrink-0">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
          <span>
            {isRTL
              ? 'بنك بطاقتك يطلب رمز التحقق (OTP). أدخل الرمز لإتمام الدفع.'
              : "Your bank is requesting a verification code (OTP). Enter it to complete the payment."}
          </span>
        </div>

        <iframe
          src={url}
          title="3D Secure"
          className="flex-1 w-full bg-white"
          allow="payment *"
          sandbox="allow-forms allow-scripts allow-same-origin allow-top-navigation-by-user-activation allow-popups"
          referrerPolicy="no-referrer-when-downgrade"
        />

        {/* "Still waiting?" hint — appears after 60 s. Most users by then
            either succeeded (and we'd have closed) or are stuck because the
            OTP didn't arrive. Make the cancel option visible. */}
        {showStuckHint && (
          <div className="px-4 py-3 bg-amber-500/10 border-t-2 border-amber-500/30 flex items-start gap-2.5 flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 text-xs">
              <p className="font-semibold text-foreground mb-0.5">
                {isRTL ? 'لم يصلك الرمز؟' : "Didn't receive the code?"}
              </p>
              <p className="text-muted-foreground">
                {isRTL
                  ? 'تحقق من الرسائل أو التطبيق البنكي، أو اضغط إلغاء وحاول ببطاقة أخرى.'
                  : 'Check your messages or banking app, or tap Cancel to try with another card.'}
              </p>
              <button
                type="button"
                onClick={onCancel}
                className="mt-1.5 inline-flex items-center gap-1 px-2 -mx-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
              >
                {isRTL ? 'إلغاء واستخدام بطاقة مختلفة' : 'Cancel and use a different card'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

Checkout3DSModal.displayName = "Checkout3DSModal";

export default Checkout3DSModal;
