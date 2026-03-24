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

/** Convert an HSL CSS variable value like "180 5% 14%" to a hex string */
function hslVarToHex(hslStr: string): string {
  const parts = hslStr.replace(/%/g, '').split(/\s+/).map(Number);
  if (parts.length < 3) return '#C6BFAA';
  const [h, s, l] = parts;
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

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
      const { data, error: fnErr } = await supabase.functions.invoke('tap-config');
      if (fnErr || !data?.public_key) {
        throw new Error(isRTL ? 'فشل تحميل إعدادات الدفع' : 'Failed to load payment config');
      }

      const publicKey = data.public_key;

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

      let attempts = 0;
      while (!window.goSell && attempts < 30) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }

      if (!window.goSell) {
        throw new Error(isRTL ? 'فشل تهيئة بوابة الدفع' : 'Payment gateway failed to initialize');
      }

      // Resolve theme-aware colors from CSS variables at init time
      const root = document.documentElement;
      const getVar = (name: string) => getComputedStyle(root).getPropertyValue(name).trim();

      const fgHex = hslVarToHex(getVar('--foreground'));
      const mutedFgHex = hslVarToHex(getVar('--muted-foreground'));
      const destructiveHex = hslVarToHex(getVar('--destructive'));

      window.goSell.goSellElements({
        containerID: 'tap-card-container',
        gateway: {
          publicKey,
          language: 'ar',
          supportedCurrencies: ['SAR', 'KWD', 'USD', 'AED', 'BHD', 'QAR', 'OMR', 'EGP'],
          supportedPaymentMethods: 'all',
          notifications: 'msg',
          labels: {
            cardNumber: isRTL ? 'رقم البطاقة' : 'Card Number',
            expirationDate: 'MM/YY',
            cvv: 'CVV',
            cardHolder: isRTL ? 'اسم حامل البطاقة' : 'Name on Card',
            actionButton: isRTL ? 'ادفع' : 'Pay',
          },
          style: {
            base: {
              color: fgHex,
              lineHeight: '22px',
              fontFamily: "'Tajawal', 'Almarai', 'Roboto', sans-serif",
              fontSmoothing: 'antialiased',
              fontSize: '16px',
              '::placeholder': {
                color: mutedFgHex,
                fontSize: '14px',
              },
            },
            invalid: {
              color: destructiveHex,
              iconColor: destructiveHex,
            },
          },
          callback: (response: any) => {
            setIsSubmitting(false);
            if (response?.id) {
              onToken(response.id);
            } else if (response?.error) {
              onError(response.error?.message || (isRTL ? 'فشل معالجة البطاقة' : 'Card processing failed'));
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
      <div
        id="tap-card-container"
        ref={containerRef}
        className={`tap-card-container ${loading ? 'hidden' : ''}`}
        dir="rtl"
      />
      <style>{`
        .tap-card-container {
          min-height: 160px;
          border-radius: 0.75rem;
          padding: 12px;
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
          overflow: hidden;
        }
        @media (min-width: 640px) {
          .tap-card-container {
            min-height: 180px;
            padding: 16px;
          }
        }
        .tap-card-container:focus-within {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 2px hsl(var(--primary) / 0.15);
        }
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
        .tap-card-container,
        .tap-card-container * {
          font-family: 'Tajawal', 'Almarai', 'Roboto', sans-serif !important;
        }
        /* goSell notification bar */
        .gosell-gateway-msg {
          font-family: 'Tajawal', 'Almarai', sans-serif !important;
          border-radius: 8px !important;
          font-size: 12px !important;
          background: hsl(var(--muted)) !important;
          color: hsl(var(--foreground)) !important;
          border: 1px solid hsl(var(--border)) !important;
        }
        @media (min-width: 640px) {
          .gosell-gateway-msg {
            font-size: 13px !important;
          }
        }
        /* goSell overlay/modal dark theming */
        .gosell-gateway,
        .gosell-gateway .gosell-gateway-form {
          background: hsl(var(--card)) !important;
          color: hsl(var(--foreground)) !important;
        }
        .gosell-gateway .gosell-gateway-form input,
        .gosell-gateway .gosell-gateway-form select {
          background: hsl(var(--muted)) !important;
          color: hsl(var(--foreground)) !important;
          border-color: hsl(var(--border)) !important;
          border-radius: 8px !important;
          font-size: 16px !important;
        }
        .gosell-gateway .gosell-gateway-form input:focus,
        .gosell-gateway .gosell-gateway-form select:focus {
          border-color: hsl(var(--primary)) !important;
          box-shadow: 0 0 0 2px hsl(var(--primary) / 0.15) !important;
        }
        .gosell-gateway .gosell-gateway-form label {
          color: hsl(var(--muted-foreground)) !important;
          font-family: 'Tajawal', 'Almarai', sans-serif !important;
        }
      `}</style>
    </div>
  );
};

export default TapCardForm;
