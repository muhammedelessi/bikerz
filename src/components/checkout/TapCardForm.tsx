import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, AlertCircle } from 'lucide-react';

declare global {
  interface Window {
    goSell: any;
  }
}

interface TapCardFormProps {
  onToken: (token: string) => void;
  onError: (error: string) => void;
  isSubmitting: boolean;
  setIsSubmitting: (val: boolean) => void;
}

const SCRIPT_URL = 'https://goSellJSLib.b-cdn.net/v2.0.0/js/gosell.js';
const CONTAINER_ID = 'tap-card-container';

/* ── Brand hex values derived from design tokens ── */
const BRAND = {
  foreground: '#C6BFAA',       // --foreground  (sand)
  mutedForeground: '#8D8D8D',  // --muted-foreground (gray)
  primary: '#CC4E1D',          // --primary (accent orange)
  destructive: '#E5443B',      // --destructive
  cardBg: '#1F2526',           // --card
  border: '#2E3233',           // --border
  mutedBg: '#272B2C',          // --muted
  nearBlack: '#1C1D1D',        // --near-black / background
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

  const initGoSell = useCallback(async () => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      /* 1 — Fetch public key from backend */
      const { data, error: fnErr } = await supabase.functions.invoke('tap-config');
      if (fnErr || !data?.public_key) {
        throw new Error(isRTL ? 'فشل تحميل إعدادات الدفع' : 'Failed to load payment config');
      }

      /* 2 — Load goSell script if not present */
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

      /* 3 — Wait for goSell to be available on window */
      let attempts = 0;
      while (!window.goSell && attempts < 30) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }
      if (!window.goSell) {
        throw new Error(isRTL ? 'فشل تهيئة بوابة الدفع' : 'Payment gateway failed to initialize');
      }

      /* 4 — Ensure the container DOM node exists before mounting */
      if (!document.getElementById(CONTAINER_ID)) {
        throw new Error('Card container not found in DOM');
      }

      /* 5 — Detect dark/light theme from current CSS vars */
      const isDark = (() => {
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
        // Lightness < 30% ➜ dark
        const parts = bg.replace(/%/g, '').split(/\s+/).map(Number);
        return parts.length >= 3 && parts[2] < 30;
      })();

      /* 6 — Initialize goSell Elements with full appearance overrides */
      window.goSell.goSellElements({
        containerID: CONTAINER_ID,
        gateway: {
          publicKey: data.public_key,
          language: 'ar',
          supportedCurrencies: ['SAR', 'KWD', 'USD', 'AED', 'BHD', 'QAR', 'OMR', 'EGP'],
          supportedPaymentMethods: 'all',
          notifications: 'msg',

          /* ── Labels ── */
          labels: {
            cardNumber: isRTL ? 'رقم البطاقة' : 'Card Number',
            expirationDate: 'MM/YY',
            cvv: 'CVV',
            cardHolder: isRTL ? 'اسم حامل البطاقة' : 'Name on Card',
            actionButton: isRTL ? 'ادفع' : 'Pay',
          },

          /* ── Appearance / Style ── */
          style: {
            base: {
              color: BRAND.foreground,
              lineHeight: '24px',
              fontFamily: "'Tajawal', 'Almarai', 'Roboto', sans-serif",
              fontSmoothing: 'antialiased',
              fontSize: '16px',
              fontWeight: '400',
              textAlign: 'right',
              direction: 'rtl',
              '::placeholder': {
                color: BRAND.mutedForeground,
                fontSize: '14px',
                fontWeight: '300',
              },
            },
            invalid: {
              color: BRAND.destructive,
              iconColor: BRAND.destructive,
            },
          },

          /* ── Theme override ── */
          theme: isDark ? 'dark' : 'light',

          /* ── Token callback ── */
          callback: (response: any) => {
            setIsSubmitting(false);
            if (response?.id) {
              onToken(response.id);
            } else if (response?.error) {
              onError(
                response.error?.message ||
                (isRTL ? 'فشل معالجة البطاقة' : 'Card processing failed')
              );
            }
          },
        },
        token: true,
      });

      setLoading(false);
    } catch (err: any) {
      console.error('[TapCardForm] Init error:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [isRTL, onToken, onError, setIsSubmitting]);

  useEffect(() => {
    initGoSell();
  }, [initGoSell]);

  /* ── Submit handler exposed globally for the checkout modal ── */
  const handleSubmit = useCallback(() => {
    if (!window.goSell) {
      onError(isRTL ? 'بوابة الدفع غير جاهزة' : 'Payment gateway not ready');
      return;
    }
    setIsSubmitting(true);
    window.goSell.submit();
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

      {/* Container div with specific ID — goSell mounts its iframe here */}
      <div
        id={CONTAINER_ID}
        ref={containerRef}
        className={`tap-card-container ${loading ? 'hidden' : ''}`}
        dir="rtl"
      />

      {/* Scoped styles for the Tap card form & goSell overlays */}
      <style>{`
        /* ─────────────────────────────────────
           Container — matches site card style
           ───────────────────────────────────── */
        .tap-card-container {
          min-height: 160px;
          border-radius: 0.75rem;
          padding: 12px;
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
          overflow: hidden;
          direction: rtl;
          text-align: right;
        }
        @media (min-width: 640px) {
          .tap-card-container {
            min-height: 180px;
            padding: 16px;
          }
        }
        .tap-card-container:focus-within {
          border-color: ${BRAND.primary};
          box-shadow: 0 0 0 2px ${BRAND.primary}26;
        }

        /* ─────────────────────────────────────
           Iframe sizing — full-width responsive
           ───────────────────────────────────── */
        .tap-card-container iframe {
          width: 100% !important;
          min-height: 140px !important;
          max-width: 100% !important;
        }
        @media (min-width: 640px) {
          .tap-card-container iframe {
            min-height: 160px !important;
          }
        }

        /* ─────────────────────────────────────
           Font override — Tajawal everywhere
           ───────────────────────────────────── */
        .tap-card-container,
        .tap-card-container * {
          font-family: 'Tajawal', 'Almarai', 'Roboto', sans-serif !important;
        }

        /* ─────────────────────────────────────
           goSell notification bar
           ───────────────────────────────────── */
        .gosell-gateway-msg {
          font-family: 'Tajawal', 'Almarai', sans-serif !important;
          border-radius: 8px !important;
          font-size: 12px !important;
          background: ${BRAND.mutedBg} !important;
          color: ${BRAND.foreground} !important;
          border: 1px solid ${BRAND.border} !important;
          direction: rtl !important;
          text-align: right !important;
        }
        @media (min-width: 640px) {
          .gosell-gateway-msg {
            font-size: 13px !important;
          }
        }

        /* ─────────────────────────────────────
           goSell overlay/modal theming
           ───────────────────────────────────── */
        .gosell-gateway,
        .gosell-gateway .gosell-gateway-form {
          background: ${BRAND.cardBg} !important;
          color: ${BRAND.foreground} !important;
          direction: rtl !important;
          text-align: right !important;
        }

        /* Input fields — explicit 1px solid border */
        .gosell-gateway .gosell-gateway-form input,
        .gosell-gateway .gosell-gateway-form select {
          background: ${BRAND.mutedBg} !important;
          color: ${BRAND.foreground} !important;
          border: 1px solid ${BRAND.border} !important;
          border-radius: 8px !important;
          font-size: 16px !important;
          padding: 10px 14px !important;
          direction: rtl !important;
          text-align: right !important;
          font-family: 'Tajawal', 'Almarai', sans-serif !important;
          transition: border-color 0.25s ease, box-shadow 0.25s ease !important;
        }
        .gosell-gateway .gosell-gateway-form input::placeholder {
          color: ${BRAND.mutedForeground} !important;
        }

        /* Focus state — primary brand ring */
        .gosell-gateway .gosell-gateway-form input:focus,
        .gosell-gateway .gosell-gateway-form select:focus {
          border-color: ${BRAND.primary} !important;
          box-shadow: 0 0 0 2px ${BRAND.primary}26 !important;
          outline: none !important;
        }

        /* Invalid state */
        .gosell-gateway .gosell-gateway-form input.invalid,
        .gosell-gateway .gosell-gateway-form input:invalid {
          border-color: ${BRAND.destructive} !important;
        }

        /* Labels — RTL, brand muted color */
        .gosell-gateway .gosell-gateway-form label {
          color: ${BRAND.mutedForeground} !important;
          font-family: 'Tajawal', 'Almarai', sans-serif !important;
          direction: rtl !important;
          text-align: right !important;
          font-size: 13px !important;
          font-weight: 500 !important;
        }

        /* Buttons inside goSell modal */
        .gosell-gateway .gosell-gateway-form button,
        .gosell-gateway .gosell-gateway-form .gosell-gateway-btn {
          background: ${BRAND.primary} !important;
          border-color: ${BRAND.primary} !important;
          font-family: 'Tajawal', 'Almarai', sans-serif !important;
          border-radius: 8px !important;
        }
      `}</style>
    </div>
  );
};

export default TapCardForm;
