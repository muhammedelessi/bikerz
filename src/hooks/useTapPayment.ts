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

declare global {
  interface Window {
    CardSDK: any;
  }
}

export function useTapPayment(): UseTapPaymentReturn {
  const { session } = useAuth();
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const cardInstanceRef = useRef<any>(null);
  const scriptLoadedRef = useRef(false);
  const tokenResultRef = useRef<any>(null);

  // Fetch public key on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('tap-config');
        if (fnError) throw fnError;
        if (data?.public_key) {
          setPublicKey(data.public_key);
          console.log('[Tap] Public key loaded, env:', data.environment);
        }
      } catch (err) {
        console.error('[Tap] Failed to fetch config:', err);
        setError('Payment system unavailable');
      }
    };
    fetchConfig();
  }, []);

  // Load Tap Card SDK v2 script
  const loadScript = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (scriptLoadedRef.current && window.CardSDK) {
        resolve();
        return;
      }

      // Remove any previous script
      const existing = document.getElementById('tap-card-sdk');
      if (existing) existing.remove();

      const script = document.createElement('script');
      script.id = 'tap-card-sdk';
      // Official Tap Card SDK v2
      script.src = 'https://tap-sdks.b-cdn.net/card/1.0.0/index.js';
      script.async = true;
      script.onload = () => {
        scriptLoadedRef.current = true;
        console.log('[Tap] SDK script loaded');
        resolve();
      };
      script.onerror = () => {
        console.error('[Tap] SDK script failed to load');
        reject(new Error('Failed to load payment SDK'));
      };
      document.head.appendChild(script);
    });
  }, []);

  // Initialize card form in a container element
  const initializeCard = useCallback(
    async (containerId: string) => {
      if (!publicKey) {
        setError('Payment not configured');
        return;
      }

      setStatus('loading_sdk');
      setError(null);
      tokenResultRef.current = null;

      try {
        await loadScript();

        if (!window.CardSDK) {
          throw new Error('Card SDK not available after script load');
        }

        const { renderTapCard, Theme, Currencies, Direction, Edges, Locale } = window.CardSDK;

        if (!renderTapCard) {
          throw new Error('renderTapCard not found in SDK');
        }

        // Unmount previous instance
        if (cardInstanceRef.current?.unmount) {
          try { cardInstanceRef.current.unmount(); } catch (e) { /* ignore */ }
        }

        console.log('[Tap] Initializing card in #' + containerId);

        // Render Tap Card form - pass element ID with # prefix
        const card = renderTapCard('#' + containerId, {
          publicKey,
          merchant: { id: '' },
          transaction: {
            amount: '1',
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
            theme: Theme?.LIGHT || 'light',
            edges: Edges?.CURVED || 'curved',
            direction: Direction?.LTR || 'ltr',
          },
          onReady: () => {
            console.log('[Tap] Card form ready');
            setStatus('ready');
          },
          onFocus: () => {},
          onBinIdentification: (data: any) => {
            console.log('[Tap] BIN identified:', data?.scheme);
          },
          onValidInput: (valid: any) => {
            console.log('[Tap] Valid input:', valid);
          },
          onInvalidInput: (invalid: any) => {
            console.log('[Tap] Invalid input:', invalid);
          },
          onError: (err: any) => {
            console.error('[Tap] Card SDK error:', err);
            setError(typeof err === 'string' ? err : 'Card form error. Please try again.');
          },
          onSuccess: (tokenData: any) => {
            console.log('[Tap] Token created:', tokenData?.id);
            tokenResultRef.current = tokenData;
          },
        });

        cardInstanceRef.current = card;
      } catch (err: any) {
        console.error('[Tap] Card init error:', err);
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
        // Tokenize the card - use the SDK global tokenize
        if (!window.CardSDK?.tokenize) {
          throw new Error('Card SDK tokenize not available');
        }

        console.log('[Tap] Starting tokenization...');
        const tokenResult = await window.CardSDK.tokenize();
        
        if (!tokenResult?.id) {
          throw new Error('Card tokenization failed - no token received');
        }

        console.log('[Tap] Token received:', tokenResult.id);
        const tokenId = tokenResult.id;

        setStatus('processing');

        // Generate idempotency key
        const idempotencyKey = `${config.courseId}_${session.user.id}_${Date.now()}`;

        // Create charge via backend
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

        console.log('[Tap] Charge response:', data?.status, data?.charge_id);

        // Handle response based on status
        if (data?.redirect_url) {
          // 3DS required - redirect
          setStatus('requires_3ds');
          setRedirectUrl(data.redirect_url);
          window.location.href = data.redirect_url;
        } else if (data?.status === 'succeeded') {
          setStatus('succeeded');
        } else if (data?.status === 'failed') {
          throw new Error('Payment was declined');
        } else {
          // Processing/pending - poll for result
          setStatus('processing');
          await pollChargeStatus(data.charge_id);
        }
      } catch (err: any) {
        console.error('[Tap] Payment error:', err);
        setError(err.message || 'Payment failed. Please try again.');
        setStatus('failed');
      }
    },
    [session]
  );

  // Poll charge status
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
      } catch { /* retry */ }
    }

    setError('Payment verification timed out. Please check your payment history.');
    setStatus('failed');
  };

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setRedirectUrl(null);
    tokenResultRef.current = null;
    // Unmount card instance
    if (cardInstanceRef.current?.unmount) {
      try { cardInstanceRef.current.unmount(); } catch { /* ignore */ }
    }
    cardInstanceRef.current = null;
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
