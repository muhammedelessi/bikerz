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

/**
 * How long to wait for `onReady` before declaring the iframe stuck.
 * The SDK script is ~985KB and Tap's iframe makes additional network
 * requests on first paint; on slow mobile connections (3G, congested
 * Wi-Fi) 8s was firing prematurely while the form was still loading
 * successfully a moment later. 25s is conservative but safer than
 * showing the user a scary "reload" message on a working form.
 */
const SDK_READY_TIMEOUT_MS = 25000;

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
 * Cache the publishable key + merchant id per origin. tap-config returns a
 * different key on preview vs production, so a global cache would serve a
 * stale key after the environment shifts (e.g. opening the same dev tab on
 * two hosts).
 */
interface TapPublicConfig { publicKey: string; merchantId: string | null }
const publicConfigCache = new Map<string, TapPublicConfig>();

/**
 * Hardcoded fallback merchant ID — paired with the live publishable key
 * pk_live_7dycFMf1L4SJupgOYI5PCmbG (Bikerz Academy account).
 *
 * Why hardcode: the merchant ID is NOT a secret — it appears in every Tap
 * iframe URL as `mid=...` and in any browser network log. The Tap SDK
 * REQUIRES it in live mode (HTTP 400 otherwise). If the Supabase Edge
 * Function fails to return it (mis-deployment, env var typo, propagation
 * delay), this fallback keeps the checkout from breaking.
 *
 * Override path: setting TAP_MERCHANT_ID in Supabase Secrets always wins —
 * the fallback is only used when the backend response is null/missing.
 */
const FALLBACK_LIVE_MERCHANT_ID = "19777245";
const FALLBACK_LIVE_KEY_PREFIX = "pk_live_";

async function fetchPublicConfig(): Promise<TapPublicConfig> {
  const cacheKey = typeof window !== "undefined" ? window.location.origin : "default";
  const cached = publicConfigCache.get(cacheKey);
  if (cached) return cached;
  const { data, error } = await supabase.functions.invoke("tap-config", {});
  if (error) {
    console.error("[useTapCardSdk] tap-config invoke failed:", error);
    throw new Error(error.message || "Could not load payment configuration");
  }
  const payload = (data as { public_key?: string; merchant_id?: string | null } | null) || {};
  const key = payload.public_key;
  if (!key) {
    console.error("[useTapCardSdk] tap-config returned no public_key:", payload);
    throw new Error("Payment service is not configured");
  }

  let merchantId =
    typeof payload.merchant_id === "string" && payload.merchant_id.trim()
      ? payload.merchant_id.trim()
      : null;

  // Defensive fallback: in live mode Tap rejects the iframe load with 400
  // when `mid` is empty. If the backend didn't supply one but we recognize
  // the live key prefix, use the known account merchant ID. This unblocks
  // production checkout even when Supabase env vars are mis-configured.
  if (!merchantId && key.startsWith(FALLBACK_LIVE_KEY_PREFIX)) {
    console.warn(
      "[useTapCardSdk] tap-config returned no merchant_id for a live key — " +
      "using hardcoded fallback. Set TAP_MERCHANT_ID in Supabase Secrets to override."
    );
    merchantId = FALLBACK_LIVE_MERCHANT_ID;
  }

  console.info(
    "[useTapCardSdk] tap-config:",
    `keyPrefix=${key.slice(0, 8)}...`,
    `mid=${merchantId || "(none)"}`,
  );

  const cfg: TapPublicConfig = { publicKey: key, merchantId };
  publicConfigCache.set(cacheKey, cfg);
  return cfg;
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

/**
 * Translate raw SDK error payloads (often axios-style "Request failed with
 * status code 400") into actionable, multilingual user-facing strings.
 *
 * The Tap CardSDK iframe makes its own HTTP calls; when those fail it bubbles
 * up an axios error verbatim. Showing "Request failed with status code 400"
 * to the user is hostile and unactionable. Map known shapes to friendly
 * messages and fall back to a generic-but-helpful default.
 *
 * The `isTestMode` flag adds a hint to 4xx errors that the user might be
 * entering a real card while we're on a test publishable key — Tap's
 * tokenize endpoint rejects real cards in test mode with a generic 400.
 */
function friendlySdkError(err: unknown, isRTL: boolean, isTestMode: boolean): string {
  // Best-effort message extraction.
  let raw = "";
  let statusCode: number | null = null;
  try {
    if (typeof err === "string") raw = err;
    else if (err && typeof err === "object") {
      const o = err as Record<string, unknown>;
      if (typeof o.statusCode === "number") statusCode = o.statusCode;
      raw =
        (typeof o.message === "string" && o.message) ||
        (typeof o.description === "string" && o.description) ||
        JSON.stringify(err);
    }
  } catch {
    raw = String(err ?? "");
  }
  const lower = raw.toLowerCase();
  const statusMatch = raw.match(/status code\s*(\d+)/i);
  if (statusMatch) statusCode = Number(statusMatch[1]);

  // 400/422 from tokenize: the Tap iframe POSTs to /v2/card/token and the
  // response body has the real cause (currency-not-allowed, card-not-allowed,
  // missing-required-field, domain-not-whitelisted…) but the SDK swallows it.
  //
  // Domain check: when running on localhost / preview origins with a LIVE key
  // (because TAP_PUBLIC_TEST_KEY isn't configured in Supabase), Tap rejects
  // tokenization unless the dev domain is whitelisted in the live merchant
  // dashboard — which it shouldn't be. The right answer is "use a test key in
  // dev". Detect this case and show a developer-friendly hint.
  if (statusCode === 400 || statusCode === 422) {
    const host = typeof window !== "undefined" ? window.location.hostname : "";
    const isDevHost =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".lovableproject.com") ||
      host.endsWith(".lovable.app") ||
      host.endsWith(".lovable.dev");

    if (!isTestMode && isDevHost) {
      return isRTL
        ? `Tap يرفض التوكينة على هذا الدومين (${host}) لأنك تستخدم مفتاح Live. أضف TAP_PUBLIC_TEST_KEY و TAP_MERCHANT_TEST_ID في Supabase Secrets لتفعيل وضع الاختبار في التطوير.`
        : `Tap is rejecting tokenization on this dev domain (${host}) because you're on the LIVE key. Add TAP_PUBLIC_TEST_KEY + TAP_MERCHANT_TEST_ID to Supabase Secrets to enable test mode for development.`;
    }
    if (isTestMode) {
      return isRTL
        ? "تعذّر التحقق من بطاقتك. استخدم بطاقة اختبار Tap: ‎4508 7500 1574 1019‎، انتهاء ‎01/39‎، CVV ‎100‎. إذا استمر الخطأ تواصل معنا."
        : "Could not validate your card. Use a Tap test card: 4508 7500 1574 1019, expiry 01/39, CVV 100. If the error persists, contact support.";
    }
    return isRTL
      ? "تعذّر التحقق من بيانات البطاقة. الرجاء التأكد من الرقم وتاريخ الانتهاء وCVV ثم إعادة المحاولة."
      : "Could not validate card details. Please re-check the number, expiry, and CVV.";
  }

  // Axios-style network failure — Tap SDK's HTTP request was rejected.
  if (
    /request failed with status code\s*\d+/i.test(raw) ||
    lower.includes("network error") ||
    lower.includes("failed to fetch")
  ) {
    return isRTL
      ? "تعذّر الاتصال بمزود الدفع. تأكد من الاتصال بالإنترنت ثم اضغط إعادة المحاولة."
      : "Could not reach the payment provider. Check your connection and tap Reload.";
  }

  // Tap surfaces validation issues with this exact text in some builds.
  if (lower.includes("invalid") && (lower.includes("card") || lower.includes("number"))) {
    return isRTL
      ? "بيانات البطاقة غير صحيحة. الرجاء التأكد من رقم البطاقة وتاريخ الانتهاء."
      : "Card details are invalid. Please re-check your card number and expiry.";
  }

  // Generic fallback — short, suggests action.
  return isRTL
    ? "تعذّر تحميل نموذج الدفع. حاول إعادة التحميل أو تواصل معنا عبر واتساب."
    : "Could not load the payment form. Please reload or contact support.";
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
  const readyFiredRef = useRef(false);
  // Mirror sdkReady in a ref so tokenize() can poll for readiness after a
  // reinit() (recovery from "Source already used") without needing to be
  // re-created via the useCallback dep array.
  const sdkReadyRef = useRef(false);
  useEffect(() => {
    sdkReadyRef.current = sdkReady;
  }, [sdkReady]);
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
    readyFiredRef.current = false;

    (async () => {
      try {
        const [{ publicKey, merchantId }] = await Promise.all([fetchPublicConfig(), loadSdkScript()]);
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

        // Strip any caller-supplied empty merchant.id and override with the
        // one returned from tap-config (Tap requires a real `mid` in live mode
        // — passing an empty string makes the iframe POST `mid=` and the SDK
        // request comes back as 400).
        const { merchant: _ignoredMerchant, ...restConfig } = configRef.current as Record<string, unknown>;
        void _ignoredMerchant;
        const fullConfig = {
          publicKey,
          ...(restConfig as typeof configRef.current),
          ...(merchantId ? { merchant: { id: merchantId } } : {}),
          onReady: () => {
            if (cancelled) return;
            if (readyTimeoutId) clearTimeout(readyTimeoutId);
            readyFiredRef.current = true;
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
            // Always log the raw payload — operators need this for diagnosis.
            // Tap's SDK is opaque about what went wrong, so we keep the full
            // shape available in the console even though we hide it from users.
            try {
              console.error("[TapCardSdk] onError payload:", err);
            } catch { /* ignore */ }
            const isRTL =
              typeof document !== "undefined" &&
              document.documentElement.getAttribute("dir") === "rtl";
            const isTestMode = publicKey.startsWith("pk_test");
            const message = friendlySdkError(err, isRTL, isTestMode);
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

        // Fallback readiness detection: some SDK builds (and some
        // domain configurations on live mode) never fire `onReady`,
        // even though the iframe renders and is fully usable. Poll the
        // container for an iframe child and flip `sdkReady` ourselves
        // once one appears with a non-zero size. This prevents the
        // "Card form is taking too long…" error from showing on a
        // form that's actually working.
        const readyPollStart = Date.now();
        const readyPollId = window.setInterval(() => {
          if (cancelled || readyFiredRef.current) {
            window.clearInterval(readyPollId);
            return;
          }
          const host = document.getElementById(containerId);
          const iframe = host?.querySelector("iframe") as HTMLIFrameElement | null;
          if (iframe && iframe.offsetHeight > 40) {
            readyFiredRef.current = true;
            setSdkReady(true);
            window.clearInterval(readyPollId);
            if (readyTimeoutId) clearTimeout(readyTimeoutId);
          } else if (Date.now() - readyPollStart > SDK_READY_TIMEOUT_MS + 5000) {
            window.clearInterval(readyPollId);
          }
        }, 500);

        // Real readiness deadline: if neither `onReady` nor the iframe
        // poll has flipped readiness within the timeout, surface a
        // clear error with a Reload button (handled by EmbeddedCardForm).
        readyTimeoutId = setTimeout(() => {
          if (cancelled) return;
          if (readyFiredRef.current) return;
          // Final last-ditch check: if the iframe exists at all, accept it
          // as ready rather than blocking the user. Better to let them try
          // the form than show a scary error on a working iframe.
          const host = document.getElementById(containerId);
          const iframe = host?.querySelector("iframe") as HTMLIFrameElement | null;
          if (iframe) {
            readyFiredRef.current = true;
            setSdkReady(true);
            window.clearInterval(readyPollId);
            return;
          }
          window.clearInterval(readyPollId);
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
      // Reject overlapping tokenize calls instead of overwriting the previous
      // resolver. Without this, a double-click on "Pay Now" leaves the first
      // promise hanging forever and the user sees a stuck spinner.
      if (tokenizeResolversRef.current) {
        reject(new Error("Tokenization already in progress"));
        return;
      }

      // Wait for SDK readiness with a short poll. After reinit() (used to
      // recover from Tap error 1126 "Source already used"), the iframe needs
      // a moment to remount and fire onReady — a hard reject here would
      // surface a misleading "Card form is not ready yet" to the user.
      const start = Date.now();
      const WAIT_MS = 8000;
      const tryStart = () => {
        if (sdkReadyRef.current && window.CardSDK?.tokenize) {
          tokenizeResolversRef.current = { resolve, reject };
          try {
            window.CardSDK.tokenize();
          } catch (err) {
            tokenizeResolversRef.current = null;
            reject(err instanceof Error ? err : new Error("Tokenization failed"));
          }
          return;
        }
        if (Date.now() - start >= WAIT_MS) {
          reject(new Error("Card form is not ready yet"));
          return;
        }
        setTimeout(tryStart, 100);
      };
      tryStart();
    });
    // No deps — tokenize reads readiness from sdkReadyRef so the callback
    // identity stays stable across re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reinit = useCallback(() => {
    // Bust the public-key cache too — if the SDK failed because of a stale
    // key (e.g. preview→prod env switch), reinit should re-fetch.
    publicConfigCache.clear();
    setReinitNonce((n) => n + 1);
  }, []);

  return { sdkLoading, sdkReady, cardValid, sdkError, cardBrand, tokenize, reinit };
}
