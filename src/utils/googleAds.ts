/**
 * Google Ads conversion event tracking.
 *
 * gtag.js is loaded once in `bikerzProductionTrackers.js` (production hostname,
 * non-staff users only). The Google Ads conversion ID `AW-310996704` is
 * registered alongside GA4. This module exposes typed helpers for firing the
 * "Purchase" conversion event (`AW-310996704/qcM7CKCW2KMcEODdpZQB`).
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const PURCHASE_SEND_TO = "AW-310996704/qcM7CKCW2KMcEODdpZQB";

function gtag(...args: unknown[]) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag(...args);
  }
}

export interface GoogleAdsPurchaseParams {
  /** Unique transaction id — the Ads dashboard uses it to deduplicate the same conversion. */
  transaction_id: string;
  /** Optional purchase value (helps Smart Bidding). */
  value?: number;
  /** ISO currency, e.g. "SAR". */
  currency?: string;
  /** Optional flag for first-time vs. returning customers. */
  new_customer?: boolean;
}

/**
 * Fire the "Purchase" Google Ads conversion event. No-op if gtag.js hasn't
 * loaded yet (i.e. on dev, non-prod hostnames, or for staff users).
 */
export function trackGoogleAdsPurchase(params: GoogleAdsPurchaseParams): void {
  const payload: Record<string, unknown> = {
    send_to: PURCHASE_SEND_TO,
    transaction_id: params.transaction_id || "",
  };
  if (typeof params.value === "number") payload.value = params.value;
  if (params.currency) payload.currency = params.currency;
  if (typeof params.new_customer === "boolean") payload.new_customer = params.new_customer;

  gtag("event", "conversion", payload);
}
