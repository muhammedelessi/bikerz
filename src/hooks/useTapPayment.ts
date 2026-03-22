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

const GOSELL_SDK_URL = 'https://goSell.tap.company/js/gosell.js';

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
  sdkLoaded: boolean;
  loadSDK: () => Promise<void>;
  openPaymentPopup: (config: TapPaymentConfig, publicKey: string, amount: number, currency: string) => void;
  submitPayment: (config: TapPaymentConfig) => Promise<void>;
  reset: () => void;
  // Keep old API for compatibility but they are no-ops
  mountCard: (elementId: string, publicKey: string, amount: number, currency: string) => Promise<void>;
  unmountCard: () => void;
}

export function useTapPayment(): UseTapPaymentReturn {
  const { session } = useAuth();
  const { detectedCountry } = useCurrency();
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [threeDSUrl, setThreeDSUrl] = useState<string | null>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);

  const pendingConfigRef = useRef<TapPaymentConfig | null>(null);

  const verifyCharge = useCallback(async (chargeId: string) => {
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
  }, []);

  // Load the goSell SDK
  const loadSDK = useCallback(async () => {
    if (sdkLoaded) return;
    setStatus('loading_sdk');
    try {
      await loadScript(GOSELL_SDK_URL);
      setSdkLoaded(true);
      setStatus('ready');
    } catch (err: any) {
      console.error('[Tap] goSell SDK load error:', err);
      setError(err.message || 'Failed to load payment SDK');
      setStatus('failed');
    }
  }, [sdkLoaded]);

  // Open goSell lightbox popup
  const openPaymentPopup = useCallback((config: TapPaymentConfig, publicKey: string, amount: number, currency: string) => {
    const goSell = (window as any).goSell;
    if (!goSell) {
      setError('Payment SDK not loaded');
      setStatus('failed');
      return;
    }

    pendingConfigRef.current = config;
    setStatus('tokenizing');
    setError(null);

    const isArabic = document.documentElement.lang === 'ar';
    const nameParts = (config.customerName || 'Customer').split(' ');
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || '';
    const phoneNum = (config.customerPhone || '').replace(/^(\+?966|0)/, '');

    goSell.config({
      containerID: 'gosell-popup-root',
      gateway: {
        publicKey: publicKey,
        language: isArabic ? 'ar' : 'en',
        contactInfo: false,
        supportedCurrencies: [currency || 'SAR'],
        supportedPaymentMethods: 'all',
        saveCardOption: false,
        customerCards: false,
        notifications: 'standard',
        backgroundImg: {
          url: '',
          opacity: '0',
        },
        labels: {
          cardNumber: isArabic ? 'رقم البطاقة' : 'Card Number',
          expirationDate: 'MM/YY',
          cvv: 'CVV',
          cardHolder: isArabic ? 'اسم حامل البطاقة' : 'Card Holder Name',
        },
        style: {
          base: {
            color: '#535353',
            lineHeight: '18px',
            fontFamily: 'system-ui, sans-serif',
            fontSmoothing: 'antialiased',
            fontSize: '16px',
            '::placeholder': {
              color: 'rgba(0, 0, 0, 0.26)',
              fontSize: '15px',
            },
          },
          invalid: {
            color: 'red',
          },
        },
        callback: (response: any) => {
          console.log('[Tap] goSell callback:', response);
          handleGoSellCallback(response);
        },
        onClose: () => {
          console.log('[Tap] goSell popup closed');
          if (status === 'tokenizing') {
            setStatus('ready');
          }
        },
      },
      customer: {
        first_name: firstName,
        last_name: lastName,
        email: config.customerEmail,
        phone: phoneNum ? { country_code: '966', number: phoneNum } : undefined,
      },
      order: {
        amount: amount,
        currency: currency || 'SAR',
        items: [{
          id: config.courseId,
          name: 'Course Enrollment',
          quantity: 1,
          amount_per_unit: amount,
        }],
      },
      transaction: {
        mode: 'token',
      },
    });

    goSell.openLightBox();
  }, [status]);

  const handleGoSellCallback = useCallback(async (response: any) => {
    const config = pendingConfigRef.current;
    if (!config) {
      setError('Payment configuration lost');
      setStatus('failed');
      return;
    }

    // In token mode, response contains token info
    const tokenId = response?.id || response?.token?.id || response?.callback?.id;
    if (!tokenId) {
      console.error('[Tap] No token received:', response);
      setError('Card tokenization failed. Please try again.');
      setStatus('failed');
      return;
    }

    console.log('[Tap] Token received:', tokenId);
    setStatus('processing');

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) {
        setError('Please sign in to make a payment');
        setStatus('failed');
        return;
      }

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
          token_id: tokenId,
        },
      });

      if (fnError) throw new Error(fnError.message || 'Payment request failed');
      if (data?.error) throw new Error(data.error);

      console.log('[Tap] Charge response:', data?.status, data?.charge_id);

      if (data?.status === 'succeeded') {
        setStatus('succeeded');
      } else if (data?.redirect_url && data?.charge_id) {
        // 3DS required
        setThreeDSUrl(data.redirect_url);
        setStatus('threeds');
      } else if (data?.charge_id) {
        verifyCharge(data.charge_id);
      } else {
        throw new Error('Unexpected payment response');
      }
    } catch (err: any) {
      console.error('[Tap] Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
      setStatus('failed');
    }
  }, [detectedCountry, verifyCharge]);

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
  }, [verifyCharge]);

  // Legacy submitPayment — kept for the free enrollment flow
  const submitPayment = useCallback(async (config: TapPaymentConfig) => {
    // This is now only used for the free enrollment path
    // The popup flow handles paid transactions
    console.warn('[Tap] submitPayment called directly — use openPaymentPopup for paid flows');
  }, []);

  const reset = useCallback(() => {
    setStatus(sdkLoaded ? 'ready' : 'idle');
    setError(null);
    setThreeDSUrl(null);
    pendingConfigRef.current = null;
  }, [sdkLoaded]);

  // No-op stubs for backward compatibility
  const mountCard = useCallback(async () => { /* no-op */ }, []);
  const unmountCard = useCallback(() => { /* no-op */ }, []);

  return {
    status,
    error,
    isReady: status === 'ready',
    threeDSUrl,
    sdkLoaded,
    loadSDK,
    openPaymentPopup,
    mountCard,
    unmountCard,
    submitPayment,
    reset,
  };
}
