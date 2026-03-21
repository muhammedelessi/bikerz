import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/contexts/CurrencyContext';

function parseDeviceInfo(): string {
  try {
    var ua = navigator.userAgent || '';
    var device = 'Unknown';
    var os = 'Unknown';
    var browser = 'Unknown';

    // Device
    if (/iPhone/.test(ua)) {
      var m = ua.match(/iPhone\s*(?:OS\s*)?/);
      device = 'iPhone';
    } else if (/iPad/.test(ua)) {
      device = 'iPad';
    } else if (/Android/.test(ua)) {
      var am = ua.match(/;\s*([^;)]+)\s*Build/);
      device = am ? am[1].trim() : 'Android Device';
    } else if (/Macintosh/.test(ua)) {
      device = 'Mac';
    } else if (/Windows/.test(ua)) {
      device = 'Windows PC';
    } else if (/Linux/.test(ua)) {
      device = 'Linux PC';
    }

    // OS
    if (/iPhone OS|CPU OS/.test(ua)) {
      var ov = ua.match(/(?:iPhone OS|CPU OS)\s+([\d_]+)/);
      os = 'iOS ' + (ov ? ov[1].replace(/_/g, '.') : '');
    } else if (/Android\s([\d.]+)/.test(ua)) {
      var av = ua.match(/Android\s([\d.]+)/);
      os = 'Android ' + (av ? av[1] : '');
    } else if (/Mac OS X\s([\d_.]+)/.test(ua)) {
      var mv = ua.match(/Mac OS X\s([\d_.]+)/);
      os = 'macOS ' + (mv ? mv[1].replace(/_/g, '.') : '');
    } else if (/Windows NT\s([\d.]+)/.test(ua)) {
      var wv = ua.match(/Windows NT\s([\d.]+)/);
      var winMap: Record<string, string> = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7' };
      os = 'Windows ' + (wv ? (winMap[wv[1]] || wv[1]) : '');
    }

    // Browser
    if (/CriOS/.test(ua)) { browser = 'Chrome'; }
    else if (/FxiOS/.test(ua)) { browser = 'Firefox'; }
    else if (/EdgiOS|Edg\//.test(ua)) { browser = 'Edge'; }
    else if (/OPiOS|OPR\//.test(ua)) { browser = 'Opera'; }
    else if (/SamsungBrowser/.test(ua)) { browser = 'Samsung Browser'; }
    else if (/Version\/.*Safari/.test(ua) && !/Chrome/.test(ua)) { browser = 'Safari'; }
    else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) { browser = 'Chrome'; }
    else if (/Firefox\//.test(ua)) { browser = 'Firefox'; }

    return [device, os, browser].filter(function (s) { return s && s !== 'Unknown'; }).join(' | ') || ua.substring(0, 120);
  } catch (e) {
    return 'Unknown';
  }
}

export type PaymentMethod = 'card' | 'apple_pay' | 'google_pay';
type PaymentStatus = 'idle' | 'processing' | 'succeeded' | 'failed';

interface TapPaymentConfig {
  courseId: string;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  couponId?: string;
  paymentMethod?: PaymentMethod;
}

interface UseTapPaymentReturn {
  status: PaymentStatus;
  error: string | null;
  isReady: boolean;
  submitPayment: (config: TapPaymentConfig) => Promise<void>;
  reset: () => void;
}

export function useTapPayment(): UseTapPaymentReturn {
  const { session } = useAuth();
  const { detectedCountry } = useCurrency();
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // For guest checkout, session may not exist when hook mounts but will be available by payment time
  const isReady = status === 'idle';

  const submitPayment = useCallback(
    async (config: TapPaymentConfig) => {
      // Get fresh session - for guest checkout, the session is created just before this call
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession?.access_token) {
        setError('Please sign in to make a payment');
        return;
      }

      setStatus('processing');
      setError(null);

      try {
        const idempotencyKey = `${config.courseId}_${currentSession.user.id}_${Date.now()}`;

        // Server computes the price — client only sends identifiers
        const { data, error: fnError } = await supabase.functions.invoke('tap-create-charge', {
          body: {
            course_id: config.courseId,
            currency: config.currency,
            customer_name: config.customerName,
            customer_email: config.customerEmail,
            customer_phone: config.customerPhone,
            idempotency_key: idempotencyKey,
            coupon_id: config.couponId || null,
            payment_method: config.paymentMethod || 'card',
            detected_country: detectedCountry || null,
          },
        });

        if (fnError) {
          throw new Error(fnError.message || 'Payment request failed');
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        console.log('[Tap] Charge response:', data?.status, data?.charge_id, 'amount:', data?.amount, 'method:', config.paymentMethod);

        if (data?.redirect_url) {
          window.location.href = data.redirect_url;
        } else if (data?.status === 'succeeded') {
          setStatus('succeeded');
        } else {
          throw new Error('No payment page URL received');
        }
      } catch (err: any) {
        console.error('[Tap] Payment error:', err);
        setError(err.message || 'Payment failed. Please try again.');
        setStatus('failed');
      }
    },
    [detectedCountry]
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return {
    status,
    error,
    isReady,
    submitPayment,
    reset,
  };
}
