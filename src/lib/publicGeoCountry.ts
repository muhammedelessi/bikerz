/**
 * Browser-friendly country / geo hints.
 * Uses multiple fallback APIs for reliability.
 */

export function normalizeCountryCode(raw: string | null | undefined): string | null {
  const c = (raw ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
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

async function tryGeoResponse(
  url: string,
  pick: (j: unknown) => string | null,
  signal?: AbortSignal,
  timeoutMs = 5000,
): Promise<string | null> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), timeoutMs);

  // Combine external signal with timeout
  const combinedSignal = signal
    ? (typeof AbortSignal !== "undefined" && "any" in AbortSignal
        ? (AbortSignal as any).any([signal, controller?.signal].filter(Boolean))
        : controller?.signal)
    : controller?.signal;

  try {
    const res = await fetch(url, combinedSignal ? { signal: combinedSignal } : undefined);
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("json")) {
      const j: unknown = await res.json();
      return pick(j);
    }
    return normalizeCountryCode(await res.text());
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/** ISO country code only (no city). */
export async function fetchCountryCodeFromPublicGeoApis(signal?: AbortSignal): Promise<string | null> {
  // Strategy: try primary, then fallbacks sequentially
  const apis: { url: string; pick: (j: unknown) => string | null }[] = [
    { url: "https://ipwho.is/", pick: countryFromIpWhoPayload },
    { url: "https://api.country.is/", pick: countryFromCountryIsPayload },
    { url: "https://ipapi.co/json/", pick: countryFromIpApiPayload },
  ];

  for (const api of apis) {
    try {
      const result = await tryGeoResponse(api.url, api.pick, signal);
      if (result) return result;
    } catch {
      /* next */
    }
  }

  return null;
}

export type PublicGeoHint = {
  countryCode: string;
  countryName?: string;
  /** City string from provider (often English). */
  city?: string;
};

/**
 * Country + optional city/name for forms (prefers ipwho.is payload; falls back to country code only).
 */
export async function fetchPublicGeoHint(signal?: AbortSignal): Promise<PublicGeoHint | null> {
  try {
    const res = await fetch("https://ipwho.is/", signal ? { signal } : undefined);
    if (!res.ok) throw new Error("not ok");
    const data = (await res.json()) as Record<string, unknown>;
    if (data.success === false) throw new Error("failed");
    const countryCode = normalizeCountryCode(String(data.country_code ?? ""));
    if (!countryCode) throw new Error("no code");
    return {
      countryCode,
      countryName: typeof data.country === "string" ? data.country : undefined,
      city: typeof data.city === "string" ? data.city : undefined,
    };
  } catch {
    /* fallback */
  }

  // Fallback: country.is (has no city)
  try {
    const res = await fetch("https://api.country.is/", signal ? { signal } : undefined);
    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      const code = normalizeCountryCode(String(data.country ?? ""));
      if (code) return { countryCode: code };
    }
  } catch {
    /* fallback */
  }

  // Last resort: ipapi.co
  try {
    const res = await fetch("https://ipapi.co/json/", signal ? { signal } : undefined);
    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      const code = normalizeCountryCode(String(data.country_code ?? data.country ?? ""));
      if (code) {
        return {
          countryCode: code,
          countryName: typeof data.country_name === "string" ? data.country_name : undefined,
          city: typeof data.city === "string" ? data.city : undefined,
        };
      }
    }
  } catch {
    /* give up */
  }

  return null;
}
