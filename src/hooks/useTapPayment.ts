import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/contexts/CurrencyContext';
import { createCharge, verifyChargeOnce } from '@/services/payment.service';
import type { PaymentStatus, TapPaymentConfig } from '@/types/payment';

export type { PaymentMethod, PaymentStatus, TapPaymentConfig } from '@/types/payment';

interface UseTapPaymentReturn {
  status: PaymentStatus;
  error: string | null;
  iframeUrl: string | null;
  submitPayment: (config: TapPaymentConfig) => Promise<void>;
  reset: () => void;
}

export function useTapPayment(): UseTapPaymentReturn {
  const { detectedCountry } = useCurrency();
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const statusRef = useRef<PaymentStatus>('idle');
  const chargeIdRef = useRef<string | null>(null);

  const updateStatus = useCallback((s: PaymentStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  const verifyCharge = useCallback(async (chargeId: string) => {
    updateStatus('verifying');
    try {
      const data = await verifyChargeOnce(chargeId);

      if (data?.status === 'succeeded') {
        updateStatus('succeeded');
        return;
      }

      if (data?.status === 'failed' || data?.status === 'cancelled') {
        setError('Payment was declined. Please try again.');
        updateStatus('failed');
        return;
      }

      // Retry once after delay
      await new Promise(r => setTimeout(r, 3000));
      const d2 = await verifyChargeOnce(chargeId);

      if (d2?.status === 'succeeded') {
        updateStatus('succeeded');
      } else {
        setError('Payment verification timed out. Please check your email for confirmation.');
        updateStatus('failed');
      }
    } catch (err: any) {
      setError(err.message || 'Payment verification failed');
      updateStatus('failed');
    }
  }, [updateStatus]);

  // Listen for postMessage from iframe (3DS callback)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'TAP_3DS_COMPLETE') {
        const tapId = event.data.tap_id;
        setIframeUrl(null);
        if (tapId) {
          verifyCharge(tapId);
        } else {
          setError('Payment response missing. Please try again.');
          updateStatus('failed');
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [verifyCharge, updateStatus]);

  const submitPayment = useCallback(async (config: TapPaymentConfig) => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.access_token) {
      setError('Please sign in to make a payment');
      return;
    }

    updateStatus('processing');
    setError(null);
    setIframeUrl(null);

    try {
      const data = await createCharge(
        config,
        currentSession.access_token,
        currentSession.user.id,
        detectedCountry,
      );

      if (data.status === 'succeeded') {
        updateStatus('succeeded');
        return;
      }

      if (data.redirect_url) {
        chargeIdRef.current = data.charge_id;
        setIframeUrl(data.redirect_url);
        // Status stays 'processing' — iframe is shown
      } else {
        setError('Payment gateway did not return a payment page.');
        updateStatus('failed');
      }
    } catch (err: any) {
      console.error('[TapPayment] error:', err);
      setError(err.message || 'Payment failed. Please try again.');
      updateStatus('failed');
    }
  }, [detectedCountry, updateStatus]);

  const reset = useCallback(() => {
    updateStatus('idle');
    setError(null);
    setIframeUrl(null);
    chargeIdRef.current = null;
  }, [updateStatus]);

  return { status, error, iframeUrl, submitPayment, reset };
}
