import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, AlertCircle } from 'lucide-react';

declare global {
  interface Window {
    CardSDK: any;
  }
}

interface TapCardFormProps {
  onToken: (token: string) => void;
  onError: (error: string) => void;
  isSubmitting: boolean;
  setIsSubmitting: (val: boolean) => void;
}

const SCRIPT_URL = 'https://tap-sdks.b-cdn.net/card/1.0.0/index.js';
const CONTAINER_ID = 'card-sdk-id';

/* ── Brand hex values derived from design tokens ── */
const BRAND = {
  foreground: '#C6BFAA',
  mutedForeground: '#8D8D8D',
  primary: '#CC4E1D',
  destructive: '#E5443B',
  cardBg: '#2E3233',
  border: '#C6BFAA',
  mutedBg: '#272B2C',
  nearBlack: '#1C1D1D',
} as const;

const TapCardForm: React.FC<TapCardFormProps> = ({
  onToken,
  onError,
  isSubmitting,
  setIsSubmitting,
}) => {
  const { isRTL } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);
  const unmountRef = useRef<(() => void) | null>(null);

  const initCardSDK = useCallback(async () => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      /* 1 — Fetch public key */
      const { data, error: fnErr } = await supabase.functions.invoke('tap-config');
      if (fnErr || !data?.public_key) {
        throw new Error(isRTL ? 'فشل تحميل إعدادات الدفع' : 'Failed to load payment config');
      }

      /* 2 — Load Card SDK V2 script */
      if (!document.querySelector(`script[src="${SCRIPT_URL}"]`)) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = SCRIPT_URL;
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load payment script'));
          document.head.appendChild(script);
        });
      }

      /* 3 — Wait for CardSDK */
      let attempts = 0;
      while (!window.CardSDK && attempts < 40) {
        await new Promise(r => setTimeout(r, 150));
        attempts++;
      }
      if (!window.CardSDK) {
        throw new Error(isRTL ? 'فشل تهيئة بوابة الدفع' : 'Payment gateway failed to initialize');
      }

      /* 4 — Ensure container exists */
      if (!document.getElementById(CONTAINER_ID)) {
        throw new Error('Card container not found in DOM');
      }

      /* 5 — Render via Card SDK V2 */
      const {
        renderTapCard,
        Theme,
        Currencies,
        Direction,
        Edges,
        Locale,
      } = window.CardSDK;

      const { unmount } = renderTapCard(CONTAINER_ID, {
        publicKey: data.public_key,
        merchant: {
          id: '',
        },
        transaction: {
          currency: Currencies.SAR,
        },
        acceptance: {
          supportedBrands: ['VISA', 'MASTERCARD', 'AMERICAN_EXPRESS'],
          supportedCards: 'ALL',
        },
        fields: {
          cardHolder: true,
        },
        addons: {
          displayPaymentBrands: true,
          loader: true,
          saveCard: false,
        },
        interface: {
          locale: Locale.AR,
          theme: Theme.DARK,
          edges: Edges.CURVED,
          direction: Direction.RTL,
        },
        onReady: () => {
          console.log('[TapCardSDK] Ready');
          setLoading(false);
        },
        onFocus: () => {},
        onBinIdentification: (data: any) => {
          console.log('[TapCardSDK] BIN:', data);
        },
        onSuccess: (data: any) => {
          console.log('[TapCardSDK] Success:', data);
          setIsSubmitting(false);
          if (data?.id) {
            onToken(data.id);
          }
        },
        onError: (err: any) => {
          console.error('[TapCardSDK] Error:', err);
          setIsSubmitting(false);
          onError(
            err?.message ||
            (isRTL ? 'فشل معالجة البطاقة' : 'Card processing failed')
          );
        },
        onValidInput: (valid: boolean) => {
          console.log('[TapCardSDK] Valid input:', valid);
        },
      });

      unmountRef.current = unmount;
    } catch (err: any) {
      console.error('[TapCardForm] Init error:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [isRTL, onToken, onError, setIsSubmitting]);

  useEffect(() => {
    initCardSDK();
    return () => {
      unmountRef.current?.();
    };
  }, [initCardSDK]);

  /* ── Submit handler exposed globally for the checkout modal ── */
  const handleSubmit = useCallback(() => {
    if (!window.CardSDK) {
      onError(isRTL ? 'بوابة الدفع غير جاهزة' : 'Payment gateway not ready');
      return;
    }
    setIsSubmitting(true);
    // Card SDK V2 auto-submits via onSuccess callback when card is tokenized
    // Trigger tokenization via the SDK's submit
    const submitBtn = document.querySelector(`#${CONTAINER_ID} .tap-submit-btn, #${CONTAINER_ID} button[type="submit"]`) as HTMLButtonElement;
    if (submitBtn) {
      submitBtn.click();
    }
  }, [isRTL, onError, setIsSubmitting]);

  useEffect(() => {
    (window as any).__tapCardSubmit = handleSubmit;
    return () => { delete (window as any).__tapCardSubmit; };
  }, [handleSubmit]);

  /* ── Error state ── */
  if (error) {
    return (
      <div className="flex items-center gap-2 p-3 sm:p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs sm:text-sm">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="tap-card-wrapper space-y-2">
      {loading && (
        <div className="flex items-center justify-center py-6 sm:py-8">
          <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary animate-spin" />
          <span className="ms-2 text-xs sm:text-sm text-muted-foreground">
            {isRTL ? 'جاري تحميل نموذج الدفع...' : 'Loading payment form...'}
          </span>
        </div>
      )}

      {/* Container — Card SDK V2 mounts here */}
      <div
        id={CONTAINER_ID}
        ref={containerRef}
        className={`tap-card-sdk-container ${loading ? 'hidden' : ''}`}
        dir="rtl"
      />

      {/* Scoped styles for Card SDK V2 dark theme + brand overrides */}
      <style>{`
        /* ── Container ── */
        .tap-card-sdk-container {
          min-height: 200px;
          border-radius: 0.75rem;
          padding: 16px;
          background: ${BRAND.cardBg} !important;
          border: 1px solid ${BRAND.border};
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
          overflow: hidden;
          direction: rtl;
          text-align: right;
        }
        @media (min-width: 640px) {
          .tap-card-sdk-container {
            min-height: 220px;
            padding: 20px;
          }
        }
        .tap-card-sdk-container:focus-within {
          border-color: ${BRAND.primary};
          box-shadow: 0 0 0 2px ${BRAND.primary}33;
        }

        /* ── Iframe ── */
        .tap-card-sdk-container iframe {
          width: 100% !important;
          min-height: 180px !important;
          max-width: 100% !important;
          border: none !important;
          background: transparent !important;
          color-scheme: dark !important;
        }
        @media (min-width: 640px) {
          .tap-card-sdk-container iframe {
            min-height: 200px !important;
          }
        }

        /* ── Font ── */
        .tap-card-sdk-container,
        .tap-card-sdk-container * {
          font-family: 'Tajawal', 'Almarai', 'Roboto', sans-serif !important;
        }

        /* ── Card SDK V2 internal overrides ── */
        #${CONTAINER_ID} .Input,
        #${CONTAINER_ID} input {
          background: ${BRAND.mutedBg} !important;
          color: #FFFFFF !important;
          border: 1px solid ${BRAND.border} !important;
          border-radius: 8px !important;
          font-size: 16px !important;
          padding: 10px 14px !important;
          direction: rtl !important;
          text-align: right !important;
          font-family: 'Tajawal', 'Almarai', sans-serif !important;
          transition: border-color 0.25s ease, box-shadow 0.25s ease !important;
        }
        #${CONTAINER_ID} .Input::placeholder,
        #${CONTAINER_ID} input::placeholder {
          color: ${BRAND.mutedForeground} !important;
        }

        /* Focus — primary ring */
        #${CONTAINER_ID} .Input:focus,
        #${CONTAINER_ID} .Input--focus,
        #${CONTAINER_ID} input:focus {
          border-color: ${BRAND.primary} !important;
          box-shadow: 0 0 0 2px ${BRAND.primary}33 !important;
          outline: none !important;
        }

        /* Invalid state */
        #${CONTAINER_ID} .Input--invalid,
        #${CONTAINER_ID} input:invalid,
        #${CONTAINER_ID} .Input--error {
          border-color: ${BRAND.destructive} !important;
        }

        /* Labels — RTL */
        #${CONTAINER_ID} label,
        #${CONTAINER_ID} .Label {
          color: ${BRAND.mutedForeground} !important;
          font-family: 'Tajawal', 'Almarai', sans-serif !important;
          direction: rtl !important;
          text-align: right !important;
          font-size: 13px !important;
          font-weight: 500 !important;
        }

        /* Buttons */
        #${CONTAINER_ID} button,
        #${CONTAINER_ID} .tap-submit-btn {
          background: ${BRAND.primary} !important;
          border-color: ${BRAND.primary} !important;
          font-family: 'Tajawal', 'Almarai', sans-serif !important;
          border-radius: 8px !important;
          color: #FFFFFF !important;
        }

        /* Card brands bar */
        #${CONTAINER_ID} .payment-brands,
        #${CONTAINER_ID} .brands-container {
          direction: rtl !important;
          justify-content: flex-end !important;
        }
      `}</style>
    </div>
  );
};

export default TapCardForm;
