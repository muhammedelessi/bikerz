import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type PaymentStatus = 'idle' | 'loading_sdk' | 'ready' | 'tokenizing' | 'processing' | 'succeeded' | 'failed' | 'requires_3ds';

interface TapPaymentConfig {
  amount: number;
  currency: string;
  courseId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
}

interface UseTapPaymentReturn {
  status: PaymentStatus;
  error: string | null;
  publicKey: string | null;
  isReady: boolean;
  initializeCard: (containerId: string) => void;
  submitPayment: (config: TapPaymentConfig) => Promise<void>;
  reset: () => void;
  redirectUrl: string | null;
}

export function useTapPayment(): UseTapPaymentReturn {
  const { session } = useAuth();
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const cardInstanceRef = useRef<any>(null);
  const scriptLoadedRef = useRef(false);

  // Fetch public key on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('tap-config');
        if (fnError) throw fnError;
        if (data?.public_key) {
          setPublicKey(data.public_key);
        }
      } catch (err) {
        console.error('Failed to fetch Tap config:', err);
      }
    };
    fetchConfig();
  }, []);

  // Load Tap Card SDK script
  const loadScript = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (scriptLoadedRef.current && (window as any).CardSDK) {
        resolve();
        return;
      }

      const existing = document.getElementById('tap-card-sdk');
      if (existing) {
        existing.remove();
      }

      const script = document.createElement('script');
      script.id = 'tap-card-sdk';
      script.src = 'https://tap-sdks.b-cdn.net/card/1.0.0/index.js';
      script.async = true;
      script.onload = () => {
        scriptLoadedRef.current = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load payment SDK'));
      document.head.appendChild(script);
    });
  }, []);

  // Initialize card form in a container
  const initializeCard = useCallback(
    async (containerId: string) => {
      if (!publicKey) {
        setError('Payment not configured');
        return;
      }

      setStatus('loading_sdk');
      setError(null);

      try {
        await loadScript();

        const CardSDK = (window as any).CardSDK;
        if (!CardSDK) {
          throw new Error('Card SDK not available');
        }

        const { renderTapCard, Theme, Currencies, Direction, Edges, Locale } = CardSDK;

        // Unmount previous instance if any
        if (cardInstanceRef.current?.unmount) {
          try { cardInstanceRef.current.unmount(); } catch {}
        }

        const cardInstance = renderTapCard(containerId, {
          publicKey,
          merchant: { id: '' },
          transaction: {
            amount: '0',
            currency: Currencies?.SAR || 'SAR',
          },
          customer: {
            editable: true,
            name: [{ lang: Locale?.EN || 'en', first: '', last: '', middle: '' }],
          },
          acceptance: {
            supportedBrands: ['VISA', 'MASTERCARD', 'MADA', 'AMERICAN_EXPRESS'],
            supportedCards: 'ALL',
          },
          fields: {
            cardHolder: true,
          },
          addons: {
            displayPaymentBrands: true,
            loader: true,
            saveCard: false,
          },
          interface: {
            locale: Locale?.EN || 'en',
            theme: Theme?.DARK || 'dark',
            edges: Edges?.CURVED || 'curved',
            direction: Direction?.LTR || 'ltr',
          },
          onReady: () => {
            setStatus('ready');
          },
          onFocus: () => {},
          onBinIdentification: () => {},
          onValidInput: () => {},
          onInvalidInput: () => {},
          onError: (err: any) => {
            console.error('Card SDK error:', err);
            setError('Card input error');
          },
          onSuccess: (tokenData: any) => {
            // Token created successfully - stored for submitPayment to use
            cardInstanceRef.current._lastToken = tokenData;
          },
        });

        cardInstanceRef.current = cardInstance;
      } catch (err: any) {
        console.error('Card init error:', err);
        setError(err.message || 'Failed to initialize payment form');
        setStatus('failed');
      }
    },
    [publicKey, loadScript]
  );

  // Submit payment
  const submitPayment = useCallback(
    async (config: TapPaymentConfig) => {
      if (!session?.access_token) {
        setError('Please sign in to make a payment');
        return;
      }

      setStatus('tokenizing');
      setError(null);

      try {
        // Tokenize the card using Tap SDK
        const CardSDK = (window as any).CardSDK;
        if (!CardSDK?.tokenize) {
          throw new Error('Card SDK tokenize not available');
        }

        const tokenResult = await CardSDK.tokenize();
        
        if (!tokenResult?.id) {
          throw new Error('Card tokenization failed');
        }

        const tokenId = tokenResult.id;

        setStatus('processing');

        // Generate idempotency key
        const idempotencyKey = `${config.courseId}_${session.user.id}_${Date.now()}`;

        // Create charge via edge function
        const { data, error: fnError } = await supabase.functions.invoke('tap-create-charge', {
          body: {
            course_id: config.courseId,
            amount: config.amount,
            currency: config.currency,
            customer_name: config.customerName,
            customer_email: config.customerEmail,
            customer_phone: config.customerPhone,
            token_id: tokenId,
            idempotency_key: idempotencyKey,
          },
        });

        if (fnError) {
          throw new Error(fnError.message || 'Payment request failed');
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        // Handle response
        if (data?.redirect_url) {
          // 3DS required - redirect in same window
          setStatus('requires_3ds');
          setRedirectUrl(data.redirect_url);
          // Open 3DS in a popup or redirect
          window.location.href = data.redirect_url;
        } else if (data?.status === 'succeeded') {
          setStatus('succeeded');
        } else if (data?.status === 'failed') {
          throw new Error('Payment was declined');
        } else {
          // Processing/pending - wait for webhook
          setStatus('processing');
          // Poll for status
          await pollChargeStatus(data.charge_id);
        }
      } catch (err: any) {
        console.error('Payment error:', err);
        setError(err.message || 'Payment failed. Please try again.');
        setStatus('failed');
      }
    },
    [session]
  );

  // Poll charge status for cases where we need to wait
  const pollChargeStatus = async (chargeId: string) => {
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      try {
        const { data } = await supabase.functions.invoke('tap-verify-charge', {
          body: { charge_id: chargeId },
        });

        if (data?.status === 'succeeded') {
          setStatus('succeeded');
          return;
        } else if (data?.status === 'failed' || data?.status === 'cancelled') {
          setError('Payment was not completed');
          setStatus('failed');
          return;
        }
      } catch {}
    }

    // Timeout - check once more
    setError('Payment verification timed out. Please check your payment history.');
    setStatus('failed');
  };

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setRedirectUrl(null);
  }, []);

  return {
    status,
    error,
    publicKey,
    isReady: status === 'ready',
    initializeCard,
    submitPayment,
    reset,
    redirectUrl,
  };
}
