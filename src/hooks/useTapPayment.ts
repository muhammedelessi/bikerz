import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/contexts/CurrencyContext';

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
    [session]
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
