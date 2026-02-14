import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type PaymentStatus = 'idle' | 'processing' | 'succeeded' | 'failed';

interface TapPaymentConfig {
  amount: number;
  currency: string;
  courseId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  couponId?: string;
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
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Check readiness - just need a session
  const isReady = status === 'idle' && !!session?.access_token;

  // Submit payment - creates a charge with src_all and redirects to Tap hosted page
  const submitPayment = useCallback(
    async (config: TapPaymentConfig) => {
      if (!session?.access_token) {
        setError('Please sign in to make a payment');
        return;
      }

      setStatus('processing');
      setError(null);

      try {
        // Generate idempotency key
        const idempotencyKey = `${config.courseId}_${session.user.id}_${Date.now()}`;

        // Create charge via backend - no token needed, uses src_all for redirect
        const { data, error: fnError } = await supabase.functions.invoke('tap-create-charge', {
          body: {
            course_id: config.courseId,
            amount: config.amount,
            currency: config.currency,
            customer_name: config.customerName,
            customer_email: config.customerEmail,
            customer_phone: config.customerPhone,
            idempotency_key: idempotencyKey,
            coupon_id: config.couponId || null,
          },
        });

        if (fnError) {
          throw new Error(fnError.message || 'Payment request failed');
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        console.log('[Tap] Charge response:', data?.status, data?.charge_id);

        // Redirect to Tap hosted payment page
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
