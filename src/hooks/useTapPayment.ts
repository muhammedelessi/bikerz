import { useState, useCallback, useRef, useEffect } from 'react';
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
  const statusRef = useRef<PaymentStatus>('idle');
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateStatus = useCallback((s: PaymentStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
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
      // Retry once
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

  // Listen for postMessage from popup (3DS callback)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'TAP_3DS_COMPLETE') {
        clearPoll();
        const tapId = event.data.tap_id;
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close();
        }
        popupRef.current = null;
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
  }, [verifyCharge, updateStatus, clearPoll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearPoll();
  }, [clearPoll]);

  const submitPayment = useCallback(async (config: TapPaymentConfig) => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.access_token) {
      setError('Please sign in to make a payment');
      return;
    }

    updateStatus('processing');
    setError(null);

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
        // Open popup for payment
        const w = 500;
        const h = 650;
        const left = window.screenX + (window.outerWidth - w) / 2;
        const top = window.screenY + (window.outerHeight - h) / 2;
        const popup = window.open(
          data.redirect_url,
          'TapPayment',
          `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`,
        );

        if (!popup || popup.closed) {
          // Popup blocked — fallback to redirect
          window.location.href = data.redirect_url;
          return;
        }

        popupRef.current = popup;

        // Poll for popup close (user closed without completing)
        pollRef.current = setInterval(() => {
          if (popupRef.current && popupRef.current.closed) {
            clearPoll();
            popupRef.current = null;
            if (statusRef.current === 'processing') {
              // User closed popup without completing
              setError(config.isRTL ? 'تم إغلاق نافذة الدفع' : 'Payment window was closed');
              updateStatus('failed');
            }
          }
        }, 500);
      } else {
        setError('Payment gateway did not return a payment page.');
        updateStatus('failed');
      }
    } catch (err: any) {
      console.error('[TapPayment] error:', err);
      setError(err.message || 'Payment failed. Please try again.');
      updateStatus('failed');
    }
  }, [detectedCountry, updateStatus, clearPoll]);

  const reset = useCallback(() => {
    clearPoll();
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    popupRef.current = null;
    updateStatus('idle');
    setError(null);
  }, [updateStatus, clearPoll]);

  return { status, error, submitPayment, reset };
}
