/**
 * useTapCardSdk — lazy-loads the Tap Card SDK v2, renders the embedded iframe
 * inside the given container, and exposes a Promise-based tokenize() helper.
 *
 * Why this shape:
 * - The SDK script (~985 KB) only loads when this hook is mounted (Step 2 of
 *   checkout) so the rest of the site stays light.
 * - tokenize() returns a Promise that resolves with the tok_xxx string when the
 *   SDK fires onSuccess, or rejects on onError. This lets the caller `await` a
 *   click handler instead of juggling callbacks.
 * - Apple Pay bundle_id errors fired inside the SDK are silently swallowed,
 *   per spec — they only mean Apple Pay isn't enabled for the current domain
 *   and shouldn't bubble up to the user as a payment failure.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  TapCardConfig,
  TapCardSdkInstance,
  TapTokenizeResult,
} from "@/types/tapCardSdk";

const SDK_SRC = "https://tap-sdks.b-cdn.net/card/1.0.2/index.js";
const SCRIPT_ID = "tap-card-sdk-v2-script";

/** How long to wait for `onReady` before declaring the iframe stuck. */
const SDK_READY_TIMEOUT_MS = 8000;

/** Ensure the SDK script is in the document exactly once across the whole app. */
function loadSdkScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.CardSDK) return Promise.resolve();

  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Tap Card SDK")), { once: true });
      if (window.CardSDK) resolve();
    });
  }

  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = SDK_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Tap Card SDK"));
    document.head.appendChild(s);
  });
}

/**
 * Cache the publishable key per origin. tap-config returns a different key on
 * preview vs production, so a global cache would serve a stale key after the
 * environment shifts (e.g. opening the same dev tab on two hosts).
 */
const publicKeyCache = new Map<string, string>();
async function fetchPublicKey(): Promise<string> {
  const cacheKey = typeof window !== "undefined" ? window.location.origin : "default";
  const cached = publicKeyCache.get(cacheKey);
  if (cached) return cached;
  const { data, error } = await supabase.functions.invoke("tap-config", {});
  if (error) throw new Error(error.message || "Could not load payment configuration");
  const key = (data as { public_key?: string } | null)?.public_key;
  if (!key) throw new Error("Payment service is not configured");
  publicKeyCache.set(cacheKey, key);
  return key;
}

/** Detect whether an SDK error message is the harmless Apple Pay bundle_id mismatch. */
function isApplePayBundleError(err: unknown): boolean {
  try {
    const raw = JSON.stringify(err ?? "").toLowerCase();
    return raw.includes("bundle_id") || (raw.includes("apple") && raw.includes("pay"));
  } catch {
    return false;
  }
}

export interface UseTapCardSdkOptions {
  /** Stable id of the div that hosts the iframe. */
  containerId: string;
  /** Whether the hook should actually mount. Mount is deferred until this is true. */
  enabled: boolean;
  /** Card config (everything except publicKey, which is fetched). */
  config: Omit<TapCardConfig, "publicKey" | "onReady" | "onSuccess" | "onError" | "onValidInput" | "onInvalidInput">;
}

export interface UseTapCardSdkReturn {
  sdkLoading: boolean;
  sdkReady: boolean;
  cardValid: boolean;
  sdkError: string | null;
  /** Detected card brand from the BIN (e.g. "VISA", "MASTERCARD", "MADA"), null until typed. */
  cardBrand: string | null;
  /** Trigger tokenization. Resolves with the tok_xxx string. */
  tokenize: () => Promise<string>;
  /** Force-recreate the iframe (use after big config changes if updateCardConfiguration is unavailable). */
  reinit: () => void;
}

export function useTapCardSdk(opts: UseTapCardSdkOptions): UseTapCardSdkReturn {
  const { containerId, enabled, config } = opts;

  const [sdkLoading, setSdkLoading] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [cardValid, setCardValid] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [cardBrand, setCardBrand] = useState<string | null>(null);
  const [reinitNonce, setReinitNonce] = useState(0);

  const instanceRef = useRef<TapCardSdkInstance | null>(null);
  const tokenizeResolversRef = useRef<{
    resolve: (token: string) => void;
    reject: (err: Error) => void;
  } | null>(null);

  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let readyTimeoutId: ReturnType<typeof setTimeout> | undefined;
    setSdkLoading(true);
    setSdkError(null);
    setSdkReady(false);
    setCardValid(false);
    setCardBrand(null);

    (async () => {
      try {
        const [publicKey] = await Promise.all([fetchPublicKey(), loadSdkScript()]);
        if (cancelled) return;
        if (!window.CardSDK?.renderTapCard) {
          throw new Error("Tap Card SDK did not initialize");
        }

        await new Promise((r) => requestAnimationFrame(() => r(undefined)));
        if (cancelled) return;

        const container = document.getElementById(containerId);
        if (!container) {
          throw new Error("Card form container not ready");
        }
        container.innerHTML = "";

        const readBooleanFromPayload = (payload: unknown): boolean | undefined => {
          if (typeof payload === "boolean") return payload;
          if (!payload || typeof payload !== "object") return undefined;

          const record = payload as Record<string, unknown>;
          const nestedCandidates = [record, record.data, record.payload]
            .filter((value): value is Record<string, unknown> => !!value && typeof value === "object");

          for (const candidate of nestedCandidates) {
            if (typeof candidate.valid === "boolean") return candidate.valid;
            if (typeof candidate.isValid === "boolean") return candidate.isValid;
            if (typeof candidate.invalid === "boolean") return !candidate.invalid;
            if (typeof candidate.isInvalid === "boolean") return !candidate.isInvalid;
          }

          return undefined;
        };

        const fullConfig = {
          publicKey,
          ...configRef.current,
          onReady: () => {
            if (cancelled) return;
            if (readyTimeoutId) clearTimeout(readyTimeoutId);
            setSdkReady(true);
          },
          onValidInput: (data: unknown) => {
            const next = readBooleanFromPayload(data);
            if (!cancelled && typeof next === "boolean") setCardValid(next);
          },
          onValidInputChange: (data: unknown) => {
            const next = readBooleanFromPayload(data);
            if (!cancelled && typeof next === "boolean") setCardValid(next);
          },
          onInvalidInput: (data: unknown) => {
            const next = readBooleanFromPayload(data);
            if (!cancelled && typeof next === "boolean") setCardValid(!next);
          },
          onInvalidInputChange: (data: unknown) => {
            const next = readBooleanFromPayload(data);
            if (!cancelled && typeof next === "boolean") setCardValid(!next);
          },
          // BIN identification: emits the card scheme as the user types so we
          // can show a tiny brand chip ("VISA detected") for instant feedback.
          onBinIdentification: (data: unknown) => {
            if (cancelled) return;
            try {
              const r = (data && typeof data === "object" ? (data as Record<string, unknown>) : {}) as Record<string, unknown>;
              const inner = (r.data && typeof r.data === "object" ? (r.data as Record<string, unknown>) : r);
              const scheme =
                (typeof inner.scheme === "string" && inner.scheme) ||
                (typeof inner.brand === "string" && inner.brand) ||
                (typeof inner.card_brand === "string" && inner.card_brand) ||
                (typeof inner.cardBrand === "string" && inner.cardBrand) ||
                null;
              setCardBrand(scheme ? scheme.toUpperCase() : null);
            } catch {
              /* ignore */
            }
          },
          onError: (err: unknown) => {
            if (cancelled) return;
            if (isApplePayBundleError(err)) return;
            const message =
              (err && typeof err === "object" && "message" in (err as Record<string, unknown>)
                ? String((err as { message?: unknown }).message ?? "")
                : "") || "Card form error. Please try again.";
            setSdkError(message);
            const pending = tokenizeResolversRef.current;
            if (pending) {
              tokenizeResolversRef.current = null;
              pending.reject(new Error(message));
            }
          },
          onSuccess: (data: TapTokenizeResult) => {
            if (cancelled) return;
            const tokenId = data?.id;
            const pending = tokenizeResolversRef.current;
            if (!pending) return;
            tokenizeResolversRef.current = null;
            if (tokenId && typeof tokenId === "string") {
              pending.resolve(tokenId);
            } else {
              pending.reject(new Error("Tokenization returned no token id"));
            }
          },
        };

        const inst = window.CardSDK.renderTapCard(containerId, fullConfig);
        instanceRef.current = inst ?? null;

        // Real readiness deadline: if `onReady` has not fired within 8 s,
        // surface a clear error with a Reload button (handled by EmbeddedCardForm).
        // Previously we set sdkReady=true after 1.2 s unconditionally, which
        // lied to the parent and let the user click Pay against an unmounted
        // iframe. Trust the SDK's onReady — if it never comes, fail loudly.
        readyTimeoutId = setTimeout(() => {
          if (cancelled) return;
          if (sdkReady) return; // already fired in onReady
          setSdkError(
            "Card form is taking too long to load. Please reload the form or check your internet connection.",
          );
        }, SDK_READY_TIMEOUT_MS);
      } catch (err) {
        if (cancelled) return;
        setSdkError(err instanceof Error ? err.message : "Could not load secure card form");
      } finally {
        if (!cancelled) setSdkLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (readyTimeoutId) clearTimeout(readyTimeoutId);
      try {
        instanceRef.current?.unmount?.();
      } catch {
        /* ignore */
      }
      instanceRef.current = null;
      const pending = tokenizeResolversRef.current;
      if (pending) {
        tokenizeResolversRef.current = null;
        pending.reject(new Error("Card form was closed"));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, containerId, reinitNonce]);



  const tokenize = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!sdkReady) {
        reject(new Error("Card form is not ready yet"));
        return;
      }
      // Reject overlapping tokenize calls instead of overwriting the previous
      // resolver. Without this, a double-click on "Pay Now" leaves the first
      // promise hanging forever and the user sees a stuck spinner.
      if (tokenizeResolversRef.current) {
        reject(new Error("Tokenization already in progress"));
        return;
      }
      // Note: we intentionally don't gate on `cardValid` here. Some Tap SDK
      // builds don't emit onValidInput/onInvalidInput; in that case the SDK's
      // own tokenize() will reject with a validation error, which is the
      // authoritative signal.
      if (!window.CardSDK?.tokenize) {
        reject(new Error("Card SDK is not available"));
        return;
      }
      tokenizeResolversRef.current = { resolve, reject };
      try {
        window.CardSDK.tokenize();
      } catch (err) {
        tokenizeResolversRef.current = null;
        reject(err instanceof Error ? err : new Error("Tokenization failed"));
      }
    });
    // sdkReady is the only state we need to gate on; other deps cause
    // unnecessary re-creations and break stable refs in callers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkReady]);

  const reinit = useCallback(() => {
    // Bust the public-key cache too — if the SDK failed because of a stale
    // key (e.g. preview→prod env switch), reinit should re-fetch.
    publicKeyCache.clear();
    setReinitNonce((n) => n + 1);
  }, []);

  return { sdkLoading, sdkReady, cardValid, sdkError, cardBrand, tokenize, reinit };
}
