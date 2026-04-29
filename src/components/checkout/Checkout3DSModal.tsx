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
 *  window — useTapPayment listens for that message. */
const Checkout3DSModal: React.FC<Checkout3DSModalProps> = ({ url, onCancel }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6">
      <div className="relative w-full max-w-md h-[640px] max-h-[90vh] rounded-xl overflow-hidden border-2 border-border bg-card shadow-2xl flex flex-col">
        <div className="px-4 py-3 border-b-2 border-border bg-muted/30 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>{isRTL ? 'تأكيد البطاقة (3D Secure)' : 'Card Verification (3D Secure)'}</span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
        </div>
        <iframe
          src={url}
          title="3D Secure"
          className="flex-1 w-full bg-white"
          allow="payment *"
        />
      </div>
    </div>
  );
};

export default Checkout3DSModal;
