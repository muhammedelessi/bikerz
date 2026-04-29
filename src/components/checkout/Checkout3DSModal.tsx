import React from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Checkout3DSModalProps {
  url: string;
  onCancel: () => void;
}

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
 */
const Checkout3DSModal: React.FC<Checkout3DSModalProps> = ({ url, onCancel }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';

  // Lock body scroll while 3DS is open so the page behind doesn't move
  // around on iOS when the soft keyboard appears for OTP entry.
  React.useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  return (
    <div
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
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>{isRTL ? 'تأكيد البطاقة (3D Secure)' : 'Card Verification (3D Secure)'}</span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[36px] min-w-[44px] px-2 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            aria-label={isRTL ? 'إلغاء التحقق' : 'Cancel verification'}
          >
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
        </div>
        <iframe
          src={url}
          title="3D Secure"
          className="flex-1 w-full bg-white"
          allow="payment *"
          sandbox="allow-forms allow-scripts allow-same-origin allow-top-navigation-by-user-activation allow-popups"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
};

export default Checkout3DSModal;
