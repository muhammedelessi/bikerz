import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/contexts/CurrencyContext';

function parseDeviceInfo(): string {
  try {
    const ua = navigator.userAgent || '';
    const parts: string[] = [];
    if (/iPhone/.test(ua)) parts.push('iPhone');
    else if (/iPad/.test(ua)) parts.push('iPad');
    else if (/Android/.test(ua)) parts.push('Android');
    else if (/Macintosh/.test(ua)) parts.push('Mac');
    else if (/Windows/.test(ua)) parts.push('Windows');
    else if (/Linux/.test(ua)) parts.push('Linux');

    if (/Chrome/.test(ua) && !/Edg/.test(ua)) parts.push('Chrome');
    else if (/Safari/.test(ua) && !/Chrome/.test(ua)) parts.push('Safari');
    else if (/Firefox/.test(ua)) parts.push('Firefox');
    else if (/Edg/.test(ua)) parts.push('Edge');

    return parts.join(' | ') || ua.substring(0, 120);
  } catch {
    return 'Unknown';
  }
}

export type PaymentMethod = 'card' | 'apple_pay' | 'google_pay';
export type PaymentStatus = 'idle' | 'processing' | 'verifying' | 'succeeded' | 'failed';

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
  submitPayment: (config: TapPaymentConfig) => Promise<void>;
  reset: () => void;
}

export function useTapPayment(): UseTapPaymentReturn {
  const { detectedCountry } = useCurrency();
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Note: tap_id return handling is done in PaymentSuccess page
  // The checkout modal is closed after redirect, so this hook
  // only handles direct/inline payment responses

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
        // Retry once after delay
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

  const submitPayment = useCallback(async (config: TapPaymentConfig) => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.access_token) {
      setError('Please sign in to make a payment');
      return;
    }

    setStatus('processing');
    setError(null);

    try {
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
          // No token_id → edge function uses src_all → Tap redirect page
        },
      });

      if (fnError) throw new Error(fnError.message || 'Payment request failed');
      if (data?.error) throw new Error(data.error);

      if (data?.status === 'succeeded') {
        setStatus('succeeded');
      } else if (data?.redirect_url) {
        // Redirect to Tap hosted payment page
        // If we're in an iframe (Lovable preview), open in new tab
        // because Tap's checkout page blocks iframe loading (X-Frame-Options)
        const inIframe = window.top !== window.self;
        if (inIframe) {
          window.open(data.redirect_url, '_blank');
          // Reset status so user can retry if they close the tab
          setStatus('idle');
        } else {
          window.location.href = data.redirect_url;
        }
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
  }, [detectedCountry]);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return { status, error, submitPayment, reset };
}
