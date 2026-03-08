/**
 * Meta Pixel (Facebook Pixel) event tracking utility.
 * Pixel is initialized in index.html with ID 2072521093528197.
 * This module provides typed helpers for standard events.
 */

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

function fbq(...args: any[]) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq(...args);
  }
}

/** Fired on course detail page load */
export function trackViewContent(params: {
  content_name: string;
  content_ids: string[];
  content_type: string;
  value?: number;
  currency?: string;
}) {
  fbq('track', 'ViewContent', params);
}

/** Fired when user opens the checkout modal */
export function trackInitiateCheckout(params: {
  content_name: string;
  content_ids: string[];
  value: number;
  currency: string;
  num_items?: number;
}) {
  fbq('track', 'InitiateCheckout', params);
}

/** Fired when user clicks pay / submits payment */
export function trackAddPaymentInfo(params: {
  content_ids: string[];
  value: number;
  currency: string;
}) {
  fbq('track', 'AddPaymentInfo', params);
}

/** Fired on successful enrollment / payment */
export function trackPurchase(params: {
  content_name: string;
  content_ids: string[];
  content_type: string;
  value: number;
  currency: string;
}) {
  fbq('track', 'Purchase', params);
}

/** Generic custom event */
export function trackCustomEvent(eventName: string, params?: Record<string, any>) {
  fbq('trackCustom', eventName, params);
}
