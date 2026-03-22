import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/contexts/CurrencyContext';

// ── Helpers ──

function parseDeviceInfo(): string {
  try {
    var ua = navigator.userAgent || '';
    var device = 'Unknown';
    var os = 'Unknown';
    var browser = 'Unknown';
    if (/iPhone/.test(ua)) device = 'iPhone';
    else if (/iPad/.test(ua)) device = 'iPad';
    else if (/Android/.test(ua)) { var am = ua.match(/;\s*([^;)]+)\s*Build/); device = am ? am[1].trim() : 'Android Device'; }
    else if (/Macintosh/.test(ua)) device = 'Mac';
    else if (/Windows/.test(ua)) device = 'Windows PC';
    else if (/Linux/.test(ua)) device = 'Linux PC';
    if (/iPhone OS|CPU OS/.test(ua)) { var ov = ua.match(/(?:iPhone OS|CPU OS)\s+([\d_]+)/); os = 'iOS ' + (ov ? ov[1].replace(/_/g, '.') : ''); }
    else if (/Android\s([\d.]+)/.test(ua)) { var av = ua.match(/Android\s([\d.]+)/); os = 'Android ' + (av ? av[1] : ''); }
    else if (/Mac OS X\s([\d_.]+)/.test(ua)) { var mv = ua.match(/Mac OS X\s([\d_.]+)/); os = 'macOS ' + (mv ? mv[1].replace(/_/g, '.') : ''); }
    else if (/Windows NT\s([\d.]+)/.test(ua)) { var wv = ua.match(/Windows NT\s([\d.]+)/); var winMap: Record<string, string> = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7' }; os = 'Windows ' + (wv ? (winMap[wv[1]] || wv[1]) : ''); }
    if (/CriOS/.test(ua)) browser = 'Chrome';
    else if (/FxiOS/.test(ua)) browser = 'Firefox';
    else if (/EdgiOS|Edg\//.test(ua)) browser = 'Edge';
    else if (/OPiOS|OPR\//.test(ua)) browser = 'Opera';
    else if (/SamsungBrowser/.test(ua)) browser = 'Samsung Browser';
    else if (/Version\/.*Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
    else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = 'Chrome';
    else if (/Firefox\//.test(ua)) browser = 'Firefox';
    return [device, os, browser].filter(s => s && s !== 'Unknown').join(' | ') || ua.substring(0, 120);
  } catch { return 'Unknown'; }
}

const TAP_ELEMENTS_SDK_URL = 'https://tap-sdks.b-cdn.net/elements/1.0.0/index.js';
const TAP_BLUEBIRD_URL = 'https://cdnjs.cloudflare.com/ajax/libs/bluebird/3.3.4/bluebird.min.js';

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = function () { resolve(); };
    s.onerror = function () { reject(new Error('Failed to load: ' + src)); };
    document.head.appendChild(s);
  });
}

// ── Types ──

export type PaymentMethod = 'card' | 'apple_pay' | 'google_pay';
export type PaymentStatus = 'idle' | 'loading_sdk' | 'ready' | 'tokenizing' | 'processing' | 'threeds' | 'verifying' | 'succeeded' | 'failed';

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
  threeDSUrl: string | null;
  mountCard: (elementId: string, publicKey: string, amount: number, currency: string) => Promise<void>;
  unmountCard: () => void;
  submitPayment: (config: TapPaymentConfig) => Promise<void>;
  reset: () => void;
}

export function useTapPayment(): UseTapPaymentReturn {
  const { session } = useAuth();
  const { detectedCountry } = useCurrency();
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [threeDSUrl, setThreeDSUrl] = useState<string | null>(null);

  const tokenizeRef = useRef<(() => Promise<any>) | null>(null);
  const unmountRef = useRef<(() => void) | null>(null);
  const tapInstanceRef = useRef<any>(null);
  const cardElementRef = useRef<any>(null);

  // Listen for 3DS completion postMessage
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type !== 'TAP_3DS_COMPLETE') return;
      const tapId = e.data.tap_id;
      setThreeDSUrl(null);
      if (tapId) {
        verifyCharge(tapId);
      } else {
        setError('3D Secure verification failed');
        setStatus('failed');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const verifyCharge = async (chargeId: string) => {
    setStatus('verifying');
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('tap-verify-charge', {
        body: { charge_id: chargeId },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.status === 'succeeded') {
        setStatus('succeeded');
      } else if (data?.status === 'failed' || data?.status === 'cancelled') {
        setError('Payment was declined. Please try again.');
        setStatus('failed');
      } else {
        await new Promise(r => setTimeout(r, 3000));
        const { data: d2 } = await supabase.functions.invoke('tap-verify-charge', {
          body: { charge_id: chargeId },
        });
        if (d2?.status === 'succeeded') {
          setStatus('succeeded');
        } else {
          setError('Payment verification timed out. Please check your email for confirmation.');
          setStatus('failed');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Payment verification failed');
      setStatus('failed');
    }
  };

  const mountCard = useCallback(async (elementId: string, publicKey: string, amount: number, currency: string) => {
    setStatus('loading_sdk');
    setError(null);
    try {
      // Load bluebird polyfill (required by Tap Elements on iOS 14+)
      await loadScript(TAP_BLUEBIRD_URL);
      await loadScript(TAP_ELEMENTS_SDK_URL);

      var TapjsliFn = (window as any).Tapjsli;
      if (!TapjsliFn) throw new Error('Tap Elements SDK not available');

      var tap = TapjsliFn(publicKey);
      tapInstanceRef.current = tap;
      var elements = tap.elements({});

      var isDark = document.documentElement.classList.contains('dark');
      var style = {
        base: {
          color: isDark ? '#e5e5e5' : '#1c1d1d',
          lineHeight: '24px',
          fontFamily: 'Roboto, system-ui, sans-serif',
          fontSmoothing: 'antialiased',
          fontSize: '16px',
          '::placeholder': {
            color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.26)',
          },
        },
        invalid: {
          color: '#ef4444',
        },
      };

      var paymentOptions = {
        currencyCode: [currency || 'SAR'],
        labels: {
          cardNumber: document.documentElement.lang === 'ar' ? 'رقم البطاقة' : 'Card Number',
          expirationDate: 'MM/YY',
          cvv: 'CVV',
          cardHolder: document.documentElement.lang === 'ar' ? 'اسم حامل البطاقة' : 'Card Holder Name',
        },
        TextDirection: document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr',
      };

      var card = elements.create('card', { style: style }, paymentOptions);
      card.mount('#' + elementId);
      cardElementRef.current = card;

      card.addEventListener('change', function (e: any) {
        if (e.error) {
          // Don't overwrite status, just surface inline error from SDK
        }
      });

      // Wait a tick for the iframe to render
      await new Promise(function (r) { setTimeout(r, 300); });

      tokenizeRef.current = function () {
        return tap.createToken(card);
      };
      unmountRef.current = function () {
        try { card.unmount(); } catch (_e) { /* safe */ }
      };
      setStatus('ready');
    } catch (err: any) {
      console.error('[Tap] SDK mount error:', err);
      setError(err.message || 'Failed to load payment form');
      setStatus('failed');
    }
  }, []);

  const unmountCard = useCallback(() => {
    if (unmountRef.current) {
      try { unmountRef.current(); } catch (_e) { /* safe */ }
      unmountRef.current = null;
    }
    tokenizeRef.current = null;
    cardElementRef.current = null;
    tapInstanceRef.current = null;
  }, []);

  const submitPayment = useCallback(async (config: TapPaymentConfig) => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.access_token) {
      setError('Please sign in to make a payment');
      return;
    }

    if (!tokenizeRef.current) {
      setError('Payment form not ready');
      setStatus('failed');
      return;
    }

    setStatus('tokenizing');
    setError(null);

    try {
      // Step 1: Tokenize card via SDK
      const tokenResult = await tokenizeRef.current();
      console.log('[Tap] Token result:', tokenResult?.id, tokenResult?.status);

      if (!tokenResult?.id) {
        throw new Error('Card tokenization failed. Please check your card details.');
      }

      setStatus('processing');

      // Step 2: Create charge with token
      const idempotencyKey = `${config.courseId}_${currentSession.user.id}_${Date.now()}`;
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
          device_info: parseDeviceInfo(),
          token_id: tokenResult.id,
        },
      });

      if (fnError) throw new Error(fnError.message || 'Payment request failed');
      if (data?.error) throw new Error(data.error);

      console.log('[Tap] Charge response:', data?.status, data?.charge_id);

      if (data?.status === 'succeeded') {
        setStatus('succeeded');
      } else if (data?.redirect_url && data?.charge_id) {
        // 3DS required — show iframe
        setThreeDSUrl(data.redirect_url);
        setStatus('threeds');
      } else if (data?.charge_id) {
        // Charge created but not captured yet — verify
        verifyCharge(data.charge_id);
      } else {
        throw new Error('Unexpected payment response');
      }
    } catch (err: any) {
      console.error('[Tap] Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
      setStatus('failed');
    }
  }, [detectedCountry]);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setThreeDSUrl(null);
  }, []);

  return {
    status,
    error,
    isReady: status === 'ready',
    threeDSUrl,
    mountCard,
    unmountCard,
    submitPayment,
    reset,
  };
}
