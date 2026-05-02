/**
 * Browser-friendly country / geo hints.
 * Prioritizes backend hints and fails fast when public geo providers are blocked.
 */

const BACKEND_GEO_TIMEOUT_MS = 1200;
const PUBLIC_GEO_TIMEOUT_MS = 1500;

let cachedCountryCode: string | null | undefined;
let cachedGeoHint: PublicGeoHint | null | undefined;

export function normalizeCountryCode(raw: string | null | undefined): string | null {
  const c = (raw ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

export type PublicGeoHint = {
  countryCode: string;
  countryName?: string;
  /** City string from provider (often English). */
  city?: string;
};

function getSupabaseFunctionBaseUrl(): string | null {
  const base = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
  if (!base) return null;
  return `${base}/functions/v1`;
}

function mergeSignals(signal?: AbortSignal, timeoutMs = PUBLIC_GEO_TIMEOUT_MS) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = window.setTimeout(() => controller?.abort(), timeoutMs);

  const combinedSignal = signal
    ? (typeof AbortSignal !== "undefined" && "any" in AbortSignal
        ? (AbortSignal as AbortSignalConstructor & { any: (signals: AbortSignal[]) => AbortSignal }).any(
            [signal, controller?.signal].filter(Boolean) as AbortSignal[],
          )
        : controller?.signal)
    : controller?.signal;

  return {
    signal: combinedSignal,
    cleanup: () => window.clearTimeout(timeoutId),
  };
}

function countryFromIpWhoPayload(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as { success?: boolean; country_code?: string };
  if (o.success === false) return null;
  return normalizeCountryCode(o.country_code);
}

function countryFromCountryIsPayload(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as { country?: string };
  return normalizeCountryCode(o.country);
}

function countryFromIpApiPayload(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as { country_code?: string; country?: string };
  return normalizeCountryCode(o.country_code || o.country);
}

function hintFromIpWhoPayload(data: unknown): PublicGeoHint | null {
  if (!data || typeof data !== "object") return null;
  const o = data as { success?: boolean; country_code?: string; country?: string; city?: string };
  if (o.success === false) return null;
  const countryCode = normalizeCountryCode(o.country_code);
  if (!countryCode) return null;
  return {
    countryCode,
    countryName: typeof o.country === "string" ? o.country : undefined,
    city: typeof o.city === "string" ? o.city : undefined,
  };
}

function hintFromCountryIsPayload(data: unknown): PublicGeoHint | null {
  const countryCode = countryFromCountryIsPayload(data);
  return countryCode ? { countryCode } : null;
}

function hintFromIpApiPayload(data: unknown): PublicGeoHint | null {
  if (!data || typeof data !== "object") return null;
  const o = data as { country_code?: string; country?: string; country_name?: string; city?: string };
  const countryCode = normalizeCountryCode(o.country_code || o.country);
  if (!countryCode) return null;
  return {
    countryCode,
    countryName: typeof o.country_name === "string" ? o.country_name : undefined,
    city: typeof o.city === "string" ? o.city : undefined,
  };
}

async function tryGeoResponse<T>(
  url: string,
  pick: (payload: unknown) => T | null,
  signal?: AbortSignal,
  timeoutMs = PUBLIC_GEO_TIMEOUT_MS,
): Promise<T | null> {
  const request = mergeSignals(signal, timeoutMs);

  try {
    const res = await fetch(url, request.signal ? { signal: request.signal, cache: "no-store" } : { cache: "no-store" });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("json")) {
      return pick(await res.json());
    }
    return pick(await res.text());
  } catch {
    return null;
  } finally {
    request.cleanup();
  }
}

async function firstSuccessful<T>(tasks: Array<Promise<T | null>>): Promise<T | null> {
  if (typeof Promise.any === "function") {
    try {
      return await Promise.any(
        tasks.map((task) =>
          task.then((result) => (result ? result : Promise.reject(new Error("no result")))),
        ),
      );
    } catch {
      return null;
    }
  }

  const settled = await Promise.all(tasks.map((task) => task.catch(() => null)));
  return settled.find((value): value is T => value != null) ?? null;
}

async function tryBackendGeoResponse(signal?: AbortSignal): Promise<string | null> {
  const baseUrl = getSupabaseFunctionBaseUrl();
  if (!baseUrl) return null;

  const request = mergeSignals(signal, BACKEND_GEO_TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}/geo-country`, {
      headers: {
        apikey: String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ""),
      },
      signal: request.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { countryCode?: string; country_code?: string };
    return normalizeCountryCode(data.countryCode || data.country_code);
  } catch {
    return null;
  } finally {
    request.cleanup();
  }
}

/** ISO country code only (no city). */
export async function fetchCountryCodeFromPublicGeoApis(signal?: AbortSignal): Promise<string | null> {
  if (cachedCountryCode !== undefined) return cachedCountryCode;

  const backendCountry = await tryBackendGeoResponse(signal);
  if (backendCountry) {
    cachedCountryCode = backendCountry;
    return backendCountry;
  }

  const publicCountry = await firstSuccessful<string>([
    tryGeoResponse("https://ipwho.is/", countryFromIpWhoPayload, signal),
    tryGeoResponse("https://api.country.is/", countryFromCountryIsPayload, signal),
    tryGeoResponse("https://ipapi.co/json/", countryFromIpApiPayload, signal),
  ]);

  cachedCountryCode = publicCountry;
  return publicCountry;
}

/**
 * Country + optional city/name for forms (tries richer providers in parallel, then falls back to country-only).
 */
export async function fetchPublicGeoHint(signal?: AbortSignal): Promise<PublicGeoHint | null> {
  if (cachedGeoHint !== undefined) return cachedGeoHint;
  if (cachedCountryCode) {
    cachedGeoHint = { countryCode: cachedCountryCode };
    return cachedGeoHint;
  }

  const backendCountry = await tryBackendGeoResponse(signal);
  if (backendCountry) {
    cachedCountryCode = backendCountry;
    cachedGeoHint = { countryCode: backendCountry };
    return cachedGeoHint;
  }

  const publicHint = await firstSuccessful<PublicGeoHint>([
    tryGeoResponse("https://ipwho.is/", hintFromIpWhoPayload, signal),
    tryGeoResponse("https://api.country.is/", hintFromCountryIsPayload, signal),
    tryGeoResponse("https://ipapi.co/json/", hintFromIpApiPayload, signal),
  ]);

  if (publicHint?.countryCode) {
    cachedCountryCode = publicHint.countryCode;
  }

  cachedGeoHint = publicHint;
  return publicHint;
}
