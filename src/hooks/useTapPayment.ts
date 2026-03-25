import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/contexts/CurrencyContext';
import { createCharge, verifyChargeOnce } from '@/services/payment.service';
import type { PaymentStatus, TapPaymentConfig } from '@/types/payment';

export type { PaymentMethod, PaymentStatus, TapPaymentConfig } from '@/types/payment';

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

  const verifyCharge = useCallback(async (chargeId: string) => {
    setStatus('verifying');
    try {
      const data = await verifyChargeOnce(chargeId);

      if (data?.status === 'succeeded') {
        setStatus('succeeded');
        return;
      }

      if (data?.status === 'failed' || data?.status === 'cancelled') {
        setError('Payment was declined. Please try again.');
        setStatus('failed');
        return;
      }

      // Retry once after delay
      await new Promise(r => setTimeout(r, 3000));
      const d2 = await verifyChargeOnce(chargeId);

      if (d2?.status === 'succeeded') {
        setStatus('succeeded');
      } else {
        setError('Payment verification timed out. Please check your email for confirmation.');
        setStatus('failed');
      }
    } catch (err: any) {
      setError(err.message || 'Payment verification failed');
      setStatus('failed');
    }
  }, []);

  const submitPayment = useCallback(async (config: TapPaymentConfig) => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.access_token) {
      setError('Please sign in to make a payment');
      return;
    }

    setStatus('processing');
    setError(null);

    try {
      const data = await createCharge(
        config,
        currentSession.access_token,
        currentSession.user.id,
        detectedCountry,
      );

      if (data?.status === 'succeeded') {
        setStatus('succeeded');
      } else if (data?.redirect_url) {
        const inIframe = window.top !== window.self;
        if (inIframe) {
          window.open(data.redirect_url, '_blank');
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
  }, [detectedCountry, verifyCharge]);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return { status, error, submitPayment, reset };
}
