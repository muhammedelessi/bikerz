import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/contexts/CurrencyContext';
import { verifyChargeOnce } from '@/services/payment.service';
import type { PaymentStatus, TapPaymentConfig } from '@/types/payment';

export type { PaymentMethod, PaymentStatus, TapPaymentConfig } from '@/types/payment';

declare global {
  interface Window {
    GoSell: any;
  }
}

let goSellLoadPromise: Promise<void> | null = null;

function loadGoSellSdk(): Promise<void> {
  if (goSellLoadPromise) return goSellLoadPromise;
  if (window.GoSell) return Promise.resolve();
  goSellLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://goSellSDK.b-cdn.net/v2.0.0/js/gosell.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load payment SDK'));
    document.head.appendChild(script);
  });
  return goSellLoadPromise;
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
  const publicKeyRef = useRef<string | null>(null);
  const statusRef = useRef<PaymentStatus>('idle');

  // Keep statusRef in sync
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

  const submitPayment = useCallback(async (config: TapPaymentConfig) => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.access_token) {
      setError('Please sign in to make a payment');
      return;
    }

    updateStatus('processing');
    setError(null);

    try {
      // Load GoSell SDK
      await loadGoSellSdk();

      // Fetch public key if not cached
      if (!publicKeyRef.current) {
        const { data, error: configErr } = await supabase.functions.invoke('tap-config');
        if (configErr || !data?.public_key) {
          throw new Error('Payment configuration unavailable');
        }
        publicKeyRef.current = data.public_key;
      }

      const nameParts = (config.customerName || 'Customer').split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '';
      const phoneNum = (config.customerPhone || '').replace(/^(\+?966|0)/, '');
      const courseName = config.courseName || 'Course';
      const finalAmount = config.amount || 0;
      const isRTL = config.isRTL || false;

      window.GoSell.config({
        gateway: {
          publicKey: publicKeyRef.current,
          language: isRTL ? 'ar' : 'en',
          supportedCurrencies: 'all',
          supportedPaymentMethods: 'all',
          notifications: 'standard',
          callback: (response: any) => {
            console.log('[GoSell] callback:', response);
            const chargeId = response?.callback?.id || response?.id;
            const chargeStatus = (response?.callback?.status || response?.status || '').toUpperCase();

            if (chargeStatus === 'CAPTURED') {
              verifyCharge(chargeId);
            } else if (chargeStatus === 'FAILED' || chargeStatus === 'DECLINED') {
              setError('Payment was declined. Please try again.');
              updateStatus('failed');
            } else if (chargeId) {
              verifyCharge(chargeId);
            } else {
              setError('Unexpected payment response');
              updateStatus('failed');
            }
          },
          onClose: () => {
            // Only reset if still processing (user closed LightBox without completing)
            if (statusRef.current === 'processing') {
              updateStatus('idle');
            }
          },
        },
        customer: {
          first_name: firstName,
          last_name: lastName,
          email: config.customerEmail,
          phone: { country_code: '966', number: phoneNum },
        },
        order: {
          amount: finalAmount,
          currency: config.currency || 'SAR',
          items: [{
            id: config.courseId,
            name: courseName,
            description: courseName,
            quantity: 1,
            amount_per_unit: finalAmount,
            total_amount: finalAmount,
          }],
          shipping: null,
          taxes: null,
        },
        transaction: {
          mode: 'charge',
          charge: {
            saveCard: false,
            threeDSecure: true,
            description: courseName,
            statement_descriptor: 'BIKERZ',
            reference: {
              transaction: `TXN-${config.courseId}-${Date.now()}`,
              order: `ORD-${currentSession.user.id}-${Date.now()}`,
            },
            metadata: {
              user_id: currentSession.user.id,
              course_id: config.courseId,
              coupon_id: config.couponId || null,
              email: config.customerEmail,
              detected_country: detectedCountry || null,
            },
            receipt: { email: true, sms: false },
            redirect: {
              url: `${window.location.origin}/payment-success?course=${config.courseId}`,
            },
          },
        },
      });

      window.GoSell.openLightBox();
    } catch (err: any) {
      console.error('[GoSell] Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
      updateStatus('failed');
    }
  }, [detectedCountry, verifyCharge, updateStatus]);

  const reset = useCallback(() => {
    updateStatus('idle');
    setError(null);
  }, [updateStatus]);

  return { status, error, submitPayment, reset };
}
