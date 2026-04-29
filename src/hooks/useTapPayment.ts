import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/contexts/CurrencyContext';
import { createCharge, verifyChargeOnce } from '@/services/payment.service';
import type { PaymentStatus, TapPaymentConfig } from '@/types/payment';

export type { PaymentMethod, PaymentStatus, TapPaymentConfig } from '@/types/payment';

interface UseTapPaymentReturn {
  status: PaymentStatus;
  error: string | null;
  chargeId: string | null;
  /** Tap 3-DS challenge URL — render in an in-page iframe (Option B custom UI). */
  challengeUrl: string | null;
  submitPayment: (config: TapPaymentConfig) => Promise<void>;
  cancelChallenge: () => void;
  reset: () => void;
}

export function useTapPayment(): UseTapPaymentReturn {
  const { detectedCountry } = useCurrency();
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [chargeId, setChargeId] = useState<string | null>(null);
  const [challengeUrl, setChallengeUrl] = useState<string | null>(null);
  const statusRef = useRef<PaymentStatus>('idle');

  const updateStatus = useCallback((s: PaymentStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  const verifyCharge = useCallback(async (cid: string) => {
    updateStatus('verifying');
    try {
      const maxAttempts = 5;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const data = await verifyChargeOnce(cid);
        if (data?.status === 'succeeded') {
          updateStatus('succeeded');
          return;
        }
        if (data?.status === 'failed' || data?.status === 'cancelled') {
          setError(data?.message || 'Payment was declined. Please try again.');
          updateStatus('failed');
          return;
        }
        if (attempt < maxAttempts - 1) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }
      setError('Payment is still being confirmed. Please wait a moment and try again.');
      updateStatus('failed');
    } catch (err: any) {
      setError(err.message || 'Payment verification failed');
      updateStatus('failed');
    }
  }, [updateStatus]);

  // Listen for postMessage from the in-page 3-DS iframe (or popup fallback).
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'TAP_3DS_COMPLETE') return;
      const tapId = event.data.tap_id;
      console.log('[TapPayment] 3DS callback received, tap_id=', tapId);
      setChallengeUrl(null);
      if (tapId) {
        setChargeId(tapId);
        verifyCharge(tapId);
      } else {
        setError('Payment response missing. Please try again.');
        updateStatus('failed');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [verifyCharge, updateStatus]);

  const submitPayment = useCallback(async (config: TapPaymentConfig) => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.access_token) {
      setError('Please sign in to make a payment');
      updateStatus('failed');
      return;
    }

    updateStatus('processing');
    setError(null);
    setChallengeUrl(null);

    try {
      const data: any = await createCharge(
        config,
        currentSession.access_token,
        currentSession.user.id,
        detectedCountry,
      );

      console.log('[TapPayment] createCharge response:', { status: data?.status, hasRedirect: !!data?.redirect_url, msg: data?.tap_message });
      setChargeId(data?.charge_id ?? null);

      if (data.status === 'succeeded') {
        updateStatus('succeeded');
        return;
      }

      // Immediate decline / cancel — surface our own branded failure overlay
      // instead of redirecting to Tap's hosted result page.
      if (data.status === 'failed' || data.status === 'cancelled') {
        setError(
          data.tap_message ||
            (config.isRTL ? 'تم رفض الدفع. يرجى المحاولة مرة أخرى.' : 'Payment was declined. Please try again.'),
        );
        updateStatus('failed');
        return;
      }

      if (data.redirect_url) {
        // Render Tap's 3-DS challenge inside our own modal iframe — user never
        // sees a Tap-hosted page; on completion the static callback page posts
        // back the tap_id and our overlay verifies + finishes the flow.
        setChallengeUrl(data.redirect_url);
        updateStatus('challenging_3ds');
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

  const cancelChallenge = useCallback(() => {
    setChallengeUrl(null);
    setError('Payment was cancelled.');
    updateStatus('failed');
  }, [updateStatus]);

  const reset = useCallback(() => {
    setChallengeUrl(null);
    setChargeId(null);
    updateStatus('idle');
    setError(null);
  }, [updateStatus]);

  return { status, error, chargeId, challengeUrl, submitPayment, cancelChallenge, reset };
}
