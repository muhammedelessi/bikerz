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
      const isAr = cfg.locale === 'ar';
      // Normalize to uppercase ISO-4217 — fallback to SAR for safety
      const normalizedCurrency = (cfg.currency || '').toString().trim().toUpperCase();
      const safeCurrency = /^[A-Z]{3}$/.test(normalizedCurrency) ? normalizedCurrency : 'SAR';

      return {
        publicKey,
        transaction: {
          // Round to 2 decimal places — Tap rejects amounts with excessive precision
          amount: Math.round(cfg.amount * 100) / 100,
          currency: safeCurrency,
        },
        customer: {
          name: [
            {
              lang: isAr ? 'AR' : 'EN',
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
        // NOTE: omitting `acceptance` entirely — passing explicit brand/card lists
        // causes "No payment options available" when the test account doesn't have
        // those methods enabled. Tap will show whatever is active on the account.
        fields: { cardHolder: true },
        addons: { loader: true, saveCard: false, scanner: true },
        interface: {
          locale: isAr ? 'AR' : 'EN',
          theme: 'DARK',
          edges: 'CURVED',
          direction: isAr ? 'RTL' : 'LTR',
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
          // Tap SDK may emit errors as strings, Error objects, or nested
          // payloads like { error: { message } } / { errors: [{ description }] }.
          // Extract the most useful text we can find before falling back.
          const extractMsg = (e: unknown): string | null => {
            if (!e) return null;
            if (typeof e === 'string') return e;
            if (e instanceof Error) return e.message;
            if (typeof e === 'object') {
              const o = e as Record<string, any>;
              if (typeof o.message === 'string') return o.message;
              if (typeof o.description === 'string') return o.description;
              if (typeof o.code === 'string') return `Card error (${o.code})`;
              if (o.error) return extractMsg(o.error);
              if (Array.isArray(o.errors) && o.errors.length) return extractMsg(o.errors[0]);
            }
            return null;
          };
          const msg = extractMsg(err) || 'Card error. Please re-enter your details.';
          // Surface the raw payload to the console so we can diagnose silent SDK failures.
          console.error('[TapCardSdk] onError payload:', err);
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

      // 3. Wait for the container element to appear in the DOM.
      //    The payment step may not be rendered yet (user could be on the
      //    info/guest-signup step), so we observe the DOM until the container
      //    mounts instead of giving up after a fixed timeout.
      const cfg = configRef.current;
      const waitForContainer = (): Promise<HTMLElement | null> =>
        new Promise((resolve) => {
          const existing = document.getElementById(cfg.containerId);
          if (existing) { resolve(existing); return; }

          let settled = false;
          const finish = (el: HTMLElement | null) => {
            if (settled) return;
            settled = true;
            observer.disconnect();
            clearTimeout(timer);
            resolve(el);
          };

          const observer = new MutationObserver(() => {
            const el = document.getElementById(cfg.containerId);
            if (el) finish(el);
          });
          observer.observe(document.body, { childList: true, subtree: true });

          // Hard ceiling of 30 s — if the user never reaches the payment step
          // we silently bail out instead of leaving the observer in memory.
          const timer = setTimeout(() => finish(null), 30_000);
        });

      const containerEl = await waitForContainer();
      if (!containerEl) {
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
