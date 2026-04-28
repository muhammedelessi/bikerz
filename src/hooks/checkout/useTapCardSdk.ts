/**
 * useTapCardSdk
 * ─────────────
 * Wraps the Tap Card SDK Web v2 (window.CardSDK) lifecycle:
 *  • Fetches the publishable key from the tap-config Edge Function
 *  • Renders the secure card iframe inside a given DOM container
 *  • Exposes a Promise-based tokenize() so the Pay button can await a tok_xxx
 *  • Calls updateCardConfig() when amount/currency/locale changes
 *
 * The Secret key never touches the frontend — it lives in Supabase Secrets only.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ─── Global type for the Tap SDK ──────────────────────────────────────────────
declare global {
  interface Window {
    CardSDK?: {
      renderTapCard: (
        containerId: string,
        config: Record<string, unknown>,
      ) => {
        tokenize: () => void;
        updateCardConfig: (config: Record<string, unknown>) => void;
      };
      Themes: { DARK: string; LIGHT: string; DYNAMIC: string };
      Currencies: Record<string, string>;
      Direction: { RTL: string; LTR: string };
      Edges: { CURVED: string; FLAT: string };
      Locale: { AR: string; EN: string };
    };
  }
}

// ─── Public config the caller must supply ─────────────────────────────────────
export interface TapCardConfig {
  /** The DOM element id where the SDK mounts its iframe. */
  containerId: string;
  amount: number;
  currency: string;
  /** 'ar' or 'en' — controls SDK locale + text direction */
  locale: 'ar' | 'en';
  customerName?: string;
  customerEmail?: string;
  /** Full phone number WITHOUT country code prefix, e.g. "512345678" */
  customerPhone?: string;
  /** E.164 country code digits only, e.g. "966" for Saudi */
  phoneCountryCode?: string;
}

export interface UseTapCardSdkReturn {
  /** true while fetching key or initialising the SDK iframe */
  sdkLoading: boolean;
  /** true once the SDK iframe is fully ready */
  sdkReady: boolean;
  /** true once the user has filled in all required card fields */
  cardValid: boolean;
  /** Any SDK-level error string */
  sdkError: string | null;
  /**
   * Trigger tokenisation. Resolves with tok_xxx on success or null on failure.
   * Call this in the Pay button handler before submitPayment.
   */
  tokenize: () => Promise<string | null>;
  /**
   * Call to push fresh amount/currency/locale into the mounted SDK iframe
   * without a full remount (e.g. after a coupon is applied).
   */
  updateAmount: (amount: number, currency: string) => void;
  /** Destroy and re-init (used when the modal re-opens). */
  reinit: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let scriptLoadPromise: Promise<void> | null = null;

function ensureScriptLoaded(): Promise<void> {
  if (window.CardSDK) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="tap-sdks.b-cdn.net/card"]',
    );
    if (existing) {
      // Script tag already injected by index.html — wait for it
      if (window.CardSDK) { resolve(); return; }
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Tap SDK script failed to load')));
      return;
    }
    // Fallback: inject dynamically
    const script = document.createElement('script');
    script.src = 'https://tap-sdks.b-cdn.net/card/1.0.2/index.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Tap SDK script failed to load'));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTapCardSdk(config: TapCardConfig): UseTapCardSdkReturn {
  const [sdkLoading, setSdkLoading] = useState(true);
  const [sdkReady, setSdkReady] = useState(false);
  const [cardValid, setCardValid] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);

  // Refs that survive re-renders without triggering effects
  const sdkInstanceRef = useRef<{
    tokenize: () => void;
    updateCardConfig: (c: Record<string, unknown>) => void;
  } | null>(null);
  const resolveTokenRef = useRef<((token: string | null) => void) | null>(null);
  const configRef = useRef(config);
  const mountedRef = useRef(false); // true once renderTapCard succeeded

  // Keep configRef current
  useEffect(() => { configRef.current = config; }, [config]);

  // ── Build the SDK config object ──────────────────────────────────────────
  const buildSdkConfig = useCallback(
    (publicKey: string, cfg: TapCardConfig): Record<string, unknown> => {
      const sdk = window.CardSDK!;
      const { Themes, Direction, Edges, Locale } = sdk;
      const isAr = cfg.locale === 'ar';

      return {
        publicKey,
        transaction: {
          amount: cfg.amount,
          currency: cfg.currency,
        },
        customer: {
          name: [
            {
              lang: isAr ? Locale.AR : Locale.EN,
              line1: cfg.customerName?.trim() || '',
            },
          ],
          contact: {
            email: cfg.customerEmail?.trim() || '',
            phone: {
              countryCode: cfg.phoneCountryCode || '966',
              number: cfg.customerPhone?.trim() || '',
            },
          },
        },
        acceptance: {
          supportedBrands: ['VISA', 'MASTERCARD', 'MADA', 'AMEX'],
          supportedCards: ['CREDIT', 'DEBIT'],
        },
        fields: { cardHolder: true },
        addons: { loader: true, saveCard: false, scanner: true },
        interface: {
          locale: isAr ? Locale.AR : Locale.EN,
          theme: Themes.DARK,
          edges: Edges.CURVED,
          direction: isAr ? Direction.RTL : Direction.LTR,
        },
        onReady: () => {
          setSdkLoading(false);
          setSdkReady(true);
          mountedRef.current = true;
        },
        onFocus: () => { /* no-op */ },
        onBinIdentification: (_data: unknown) => { /* could detect card scheme */ },
        onValidInput: (allValid: boolean) => setCardValid(allValid),
        onError: (err: unknown) => {
          const msg =
            err && typeof err === 'object' && 'message' in err
              ? String((err as { message: string }).message)
              : 'Card error. Please re-enter your details.';
          setSdkError(msg);
          setSdkLoading(false);
          // Reject any pending tokenize() promise
          if (resolveTokenRef.current) {
            resolveTokenRef.current(null);
            resolveTokenRef.current = null;
          }
        },
        onSuccess: (token: unknown) => {
          const tokenId =
            token && typeof token === 'object' && 'id' in token
              ? String((token as { id: string }).id)
              : null;
          if (resolveTokenRef.current) {
            resolveTokenRef.current(tokenId);
            resolveTokenRef.current = null;
          }
        },
      };
    },
    [],
  );

  // ── Core init function ───────────────────────────────────────────────────
  const init = useCallback(async () => {
    setSdkLoading(true);
    setSdkReady(false);
    setCardValid(false);
    setSdkError(null);
    mountedRef.current = false;
    sdkInstanceRef.current = null;

    try {
      // 1. Resolve publishable key
      //    Priority: VITE env var (baked at build time) → tap-config Edge Function
      let publicKey: string | null =
        (import.meta.env.VITE_TAP_PUBLIC_KEY as string | undefined)?.trim() || null;

      if (!publicKey) {
        const { data, error: fnErr } = await supabase.functions.invoke('tap-config', {});
        if (fnErr || !data?.public_key) {
          throw new Error('Payment configuration missing. Set TAP_PUBLIC_KEY in Supabase Secrets or VITE_TAP_PUBLIC_KEY in .env.');
        }
        publicKey = data.public_key as string;
      }

      // 2. Ensure SDK script is loaded
      await ensureScriptLoaded();
      if (!window.CardSDK) throw new Error('Tap Card SDK is unavailable. Check CDN URL.');

      // 3. Small delay so the Dialog portal is fully flushed to the DOM
      await new Promise<void>((r) => setTimeout(r, 80));

      // 4. Verify the container element exists
      const cfg = configRef.current;
      if (!document.getElementById(cfg.containerId)) {
        throw new Error(`Card container #${cfg.containerId} not found in DOM.`);
      }

      // 5. Mount the card iframe
      sdkInstanceRef.current = window.CardSDK.renderTapCard(
        cfg.containerId,
        buildSdkConfig(publicKey, cfg),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment setup failed.';
      console.error('[TapCardSdk] init error:', msg);
      setSdkError(msg);
      setSdkLoading(false);
    }
  }, [buildSdkConfig]);

  // ── Tokenize — wraps the callback-based SDK in a Promise ────────────────
  const tokenize = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!sdkInstanceRef.current) {
        resolve(null);
        return;
      }
      resolveTokenRef.current = resolve;
      sdkInstanceRef.current.tokenize();

      // Safety timeout: reject after 30 s to prevent hanging Pay button
      setTimeout(() => {
        if (resolveTokenRef.current === resolve) {
          resolveTokenRef.current = null;
          resolve(null);
        }
      }, 30_000);
    });
  }, []);

  // ── Update amount/currency without remounting ────────────────────────────
  const updateAmount = useCallback((amount: number, currency: string) => {
    sdkInstanceRef.current?.updateCardConfig({ transaction: { amount, currency } });
  }, []);

  // ── Reinit (e.g. modal reopened) ────────────────────────────────────────
  const reinit = useCallback(() => {
    scriptLoadPromise = null; // allow re-check
    init();
  }, [init]);

  return { sdkLoading, sdkReady, cardValid, sdkError, tokenize, updateAmount, reinit };
}
