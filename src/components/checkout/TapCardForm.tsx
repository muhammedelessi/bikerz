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
      // Fetch public key from edge function
      const { data, error: fnErr } = await supabase.functions.invoke('tap-config');
      if (fnErr || !data?.public_key) {
        throw new Error(isRTL ? 'فشل تحميل إعدادات الدفع' : 'Failed to load payment config');
      }

      const publicKey = data.public_key;

      // Load goSell.js script
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

      // Wait for goSell to be available
      let attempts = 0;
      while (!window.goSell && attempts < 30) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }

      if (!window.goSell) {
        throw new Error(isRTL ? 'فشل تهيئة بوابة الدفع' : 'Payment gateway failed to initialize');
      }

      // Brand orange from CSS: hsl(18 78% 45%) ≈ #CC4E1D
      const brandColor = '#CC4E1D';
      const cardBg = 'transparent';

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
              color: '#C6BFAA',
              lineHeight: '22px',
              fontFamily: "'Tajawal', 'Almarai', 'Roboto', sans-serif",
              fontSmoothing: 'antialiased',
              fontSize: '16px',
              '::placeholder': {
                color: 'rgba(141, 141, 141, 0.6)',
                fontSize: '14px',
              },
            },
            invalid: {
              color: '#ef4444',
              iconColor: '#ef4444',
            },
          },
          callback: (response: any) => {
            setIsSubmitting(false);
            if (response?.id) {
              // Token received
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

  // Expose submit method
  const handleSubmit = useCallback(() => {
    if (!window.goSell) {
      onError(isRTL ? 'بوابة الدفع غير جاهزة' : 'Payment gateway not ready');
      return;
    }
    setIsSubmitting(true);
    window.goSell.submit();
  }, [isRTL, onError, setIsSubmitting]);

  // Expose submit via ref-like pattern using a global
  useEffect(() => {
    (window as any).__tapCardSubmit = handleSubmit;
    return () => { delete (window as any).__tapCardSubmit; };
  }, [handleSubmit]);

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="tap-card-wrapper space-y-3">
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <span className="ms-2 text-sm text-muted-foreground">
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
          min-height: 180px;
          border-radius: 12px;
          padding: 16px;
          background: hsl(180 5% 14%);
          border: 1px solid hsl(180 3% 22%);
          transition: border-color 0.3s ease;
        }
        .tap-card-container:focus-within {
          border-color: #CC4E1D;
          box-shadow: 0 0 0 2px rgba(204, 78, 29, 0.15);
        }
        /* goSell internal iframe styling overrides */
        .tap-card-container iframe {
          min-height: 160px !important;
        }
        /* Tajawal font for the form */
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap');
        .tap-card-container,
        .tap-card-container * {
          font-family: 'Tajawal', 'Almarai', 'Roboto', sans-serif !important;
        }
        /* goSell notification styling */
        .gosell-gateway-msg {
          font-family: 'Tajawal', 'Almarai', sans-serif !important;
          border-radius: 8px !important;
          font-size: 13px !important;
        }
      `}</style>
    </div>
  );
};

export default TapCardForm;
