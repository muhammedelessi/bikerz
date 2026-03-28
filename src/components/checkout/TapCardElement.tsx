import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    Tapjsli: any;
  }
}

interface TapCardElementProps {
  onTokenized: (tokenId: string) => void;
  onError: (error: string) => void;
  onReady?: () => void;
  disabled?: boolean;
  isRTL?: boolean;
}

let sdkLoadPromise: Promise<void> | null = null;

function loadTapSdk(): Promise<void> {
  if (sdkLoadPromise) return sdkLoadPromise;
  if (window.Tapjsli) return Promise.resolve();
  sdkLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://secure.gosell.io/js/sdk/tap.min.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Tap SDK'));
    document.head.appendChild(script);
  });
  return sdkLoadPromise;
}

const TapCardElement: React.FC<TapCardElementProps> = ({
  onTokenized,
  onError,
  onReady,
  disabled = false,
  isRTL = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tapCardRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let card: any = null;

    (async () => {
      try {
        await loadTapSdk();

        // Fetch public key from edge function
        const { data, error } = await supabase.functions.invoke('tap-config');
        if (error || !data?.public_key) {
          if (mountedRef.current) onError('Payment configuration unavailable');
          return;
        }

        if (!mountedRef.current) return;

        const tap = new window.Tapjsli(data.public_key);
        const elements = tap.elements({});

        const style = {
          base: {
            color: '#e5e5e5',
            lineHeight: '44px',
            fontFamily: 'Roboto, system-ui, sans-serif',
            fontSmoothing: 'antialiased',
            fontSize: '16px',
            '::placeholder': {
              color: '#737373',
            },
          },
          invalid: {
            color: '#ef4444',
          },
        };

        card = elements.create('card', {
          style,
          hideIcon: false,
          labels: {
            cardNumber: isRTL ? 'رقم البطاقة' : 'Card Number',
            expirationDate: isRTL ? 'تاريخ الانتهاء' : 'MM/YY',
            cvv: 'CVV',
            cardHolder: isRTL ? 'اسم حامل البطاقة' : 'Card Holder',
          },
          paymentAllowed: ['VISA', 'MASTERCARD', 'AMERICAN_EXPRESS'],
        });

        card.mount('#tap-element-container');
        tapCardRef.current = card;

        card.addEventListener('ready', () => {
          if (mountedRef.current) {
            setReady(true);
            setLoading(false);
            onReady?.();
          }
        });

        card.addEventListener('error', (err: any) => {
          if (mountedRef.current) {
            onError(err?.error?.message || 'Card input error');
          }
        });
      } catch (err: any) {
        if (mountedRef.current) {
          setLoading(false);
          onError(err.message || 'Failed to initialize payment form');
        }
      }
    })();

    return () => {
      mountedRef.current = false;
      if (card) {
        try { card.unmount(); } catch {}
      }
      tapCardRef.current = null;
    };
  }, [isRTL]);

  const tokenize = useCallback(async () => {
    if (!tapCardRef.current) {
      onError('Card form not ready');
      return;
    }
    try {
      const result = await tapCardRef.current.createToken();
      if (result?.error) {
        onError(result.error.message || 'Tokenization failed');
      } else if (result?.id) {
        onTokenized(result.id);
      } else {
        onError('Unexpected tokenization response');
      }
    } catch (err: any) {
      onError(err.message || 'Tokenization failed');
    }
  }, [onTokenized, onError]);

  // Expose tokenize via ref-like pattern
  useEffect(() => {
    if (containerRef.current) {
      (containerRef.current as any).__tokenize = tokenize;
    }
  }, [tokenize]);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        id="tap-element-container"
        className={`min-h-[50px] rounded-lg border border-border bg-[#141414] p-3 transition-opacity ${
          disabled ? 'opacity-50 pointer-events-none' : ''
        } ${loading ? 'flex items-center justify-center' : ''}`}
        dir="ltr"
      >
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
            {isRTL ? 'جاري تحميل نموذج الدفع...' : 'Loading payment form...'}
          </div>
        )}
      </div>
    </div>
  );
};

export default TapCardElement;
