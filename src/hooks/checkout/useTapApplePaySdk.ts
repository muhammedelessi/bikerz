/**
 * useTapApplePaySdk — lazy-loads Tap's Apple Pay SDK and renders the native
 * Apple Pay button inside the given container.
 *
 * The SDK does its own browser/device capability detection: on a non-Apple
 * device or a browser without `window.ApplePaySession`, the button simply
 * never appears (the SDK silently no-ops). The consumer hides the wrapper
 * when `available` is false to avoid empty space.
 *
 * On success the SDK fires onSuccess with `{ id: "tok_xxx", ... }` — the same
 * token shape used by the embedded card flow, so `tap-create-charge` accepts
 * it transparently with no backend changes.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const SDK_SRC = "https://tap-sdks.b-cdn.net/apple-pay/1.0.0/index.js";
const SCRIPT_ID = "tap-apple-pay-sdk-script";

interface ApplePaySdkSuccess {
  id?: string;
  [k: string]: unknown;
}

interface ApplePaySdkConfig {
  publicKey: string;
  merchant?: { id?: string; domain?: string };
  transaction: { amount: number; currency: string };
  customer?: {
    name?: Array<{ lang: "EN" | "AR"; first?: string; last?: string }>;
    contact?: { email?: string; phone?: { countryCode: string; number: string } };
  };
  acceptance?: { supportedBrands?: string[]; supportedCards?: "ALL" | string[] };
  interface?: {
    locale?: "EN" | "AR";
    theme?: "LIGHT" | "DARK";
    type?: "buy" | "subscribe" | "donate" | "plain";
    edges?: "CURVED" | "STRAIGHT";
  };
  onReady?: () => void;
  onCancel?: () => void;
  onError?: (err: unknown) => void;
  onSuccess?: (data: ApplePaySdkSuccess) => void;
  onCanMakePayments?: (canPay: boolean) => void;
}

interface ApplePaySdkGlobal {
  renderApplePayButton: (containerId: string, config: ApplePaySdkConfig) => { unmount?: () => void } | undefined;
  /** Some SDK builds expose a static capability check; we still gate via onCanMakePayments. */
  canMakePayments?: () => boolean;
}

declare global {
  interface Window {
    ApplePaySDK?: ApplePaySdkGlobal;
    ApplePaySession?: { canMakePayments?: () => boolean };
  }
}

function loadSdkScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.ApplePaySDK) return Promise.resolve();

  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Apple Pay SDK")), { once: true });
      if (window.ApplePaySDK) resolve();
    });
  }

  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = SDK_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Apple Pay SDK"));
    document.head.appendChild(s);
  });
}

let cachedPublicKey: string | null = null;
async function fetchPublicKey(): Promise<string> {
  if (cachedPublicKey) return cachedPublicKey;
  const { data, error } = await supabase.functions.invoke("tap-config", {});
  if (error) throw new Error(error.message || "Could not load payment configuration");
  const key = (data as { public_key?: string } | null)?.public_key;
  if (!key) throw new Error("Payment service is not configured");
  cachedPublicKey = key;
  return key;
}

export interface UseTapApplePayOptions {
  containerId: string;
  enabled: boolean;
  config: Omit<ApplePaySdkConfig, "publicKey" | "onReady" | "onCancel" | "onError" | "onSuccess" | "onCanMakePayments">;
  /** Called with the tok_xxx string when the user completes Apple Pay. */
  onToken: (tokenId: string) => void;
  onError?: (message: string) => void;
}

export interface UseTapApplePayReturn {
  loading: boolean;
  /** True only when the device + browser actually support Apple Pay AND the SDK rendered the button. */
  available: boolean;
  error: string | null;
}

export function useTapApplePaySdk(opts: UseTapApplePayOptions): UseTapApplePayReturn {
  const { containerId, enabled, config, onToken, onError } = opts;
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);
  onTokenRef.current = onToken;
  onErrorRef.current = onError;

  const configRef = useRef(config);
  configRef.current = config;

  const instanceRef = useRef<{ unmount?: () => void } | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Hard browser capability gate: on non-Safari/Chromium-without-Apple-Pay,
    // skip script load entirely. Saves a network request and prevents the
    // SDK from logging warnings.
    const hasApplePay = typeof window !== "undefined" && !!window.ApplePaySession?.canMakePayments?.();
    if (!hasApplePay) {
      setAvailable(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setAvailable(false);

    (async () => {
      try {
        const [publicKey] = await Promise.all([fetchPublicKey(), loadSdkScript()]);
        if (cancelled) return;
        if (!window.ApplePaySDK?.renderApplePayButton) {
          throw new Error("Apple Pay SDK did not initialize");
        }

        await new Promise((r) => requestAnimationFrame(() => r(undefined)));
        if (cancelled) return;

        const container = document.getElementById(containerId);
        if (!container) throw new Error("Apple Pay container not ready");
        container.innerHTML = "";

        const inst = window.ApplePaySDK.renderApplePayButton(containerId, {
          publicKey,
          ...configRef.current,
          onCanMakePayments: (canPay) => {
            if (!cancelled) setAvailable(!!canPay);
          },
          onReady: () => {
            if (!cancelled) setAvailable(true);
          },
          onSuccess: (data) => {
            if (cancelled) return;
            const tokenId = data?.id;
            if (typeof tokenId === "string" && tokenId) {
              onTokenRef.current(tokenId);
            } else {
              const msg = "Apple Pay returned no token";
              setError(msg);
              onErrorRef.current?.(msg);
            }
          },
          onCancel: () => {
            /* user cancelled — silent */
          },
          onError: (err) => {
            if (cancelled) return;
            const message =
              (err && typeof err === "object" && "message" in (err as Record<string, unknown>)
                ? String((err as { message?: unknown }).message ?? "")
                : "") || "Apple Pay failed. Please try a card instead.";
            setError(message);
            onErrorRef.current?.(message);
          },
        });
        instanceRef.current = inst ?? null;

        // Some SDK builds don't fire onReady; assume the button is up after a grace period.
        setTimeout(() => {
          if (!cancelled) setAvailable((curr) => curr || !!container.firstChild);
        }, 800);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Could not load Apple Pay";
        setError(msg);
        setAvailable(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      try {
        instanceRef.current?.unmount?.();
      } catch {
        /* ignore */
      }
      instanceRef.current = null;
    };
  }, [enabled, containerId]);

  return { loading, available, error };
}
