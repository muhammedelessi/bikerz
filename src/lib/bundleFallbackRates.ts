/**
 * Must stay in sync with `supabase/functions/_shared/bundlePricing.ts` (BUNDLE_FALLBACK_RATES).
 * Used to convert bundle display totals → SAR for Tap; matches edge bundle charging.
 */
export const BUNDLE_FALLBACK_RATES: Record<string, number> = {
  SAR: 1,
  AED: 0.979,
  KWD: 0.082,
  BHD: 0.1,
  QAR: 0.971,
  OMR: 0.103,
  JOD: 0.189,
  EGP: 13.97,
  IQD: 348.89,
  SYP: 30.37,
  LBP: 23867,
  YER: 63.58,
  LYD: 1.694,
  TND: 0.782,
  DZD: 35.08,
  MAD: 2.511,
  SDG: 135.35,
  SOS: 152,
  MRU: 10.651,
  KMF: 114.55,
  DJF: 47.39,
  ILS: 0.837,
  USD: 0.267,
  GBP: 0.211,
};
