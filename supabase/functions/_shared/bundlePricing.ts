/**
 * Mirrors CurrencyContext getCoursePriceInfo (video courses, non-training) for bundle charging.
 * `rate` = local units per 1 SAR (same as client FALLBACK_RATES / exchangeRate).
 * Country prices are already stored as final localized prices, so VAT must not be added again here.
 */

export const BUNDLE_VAT_RATE_SA = 15;

/** SAR → local; same keys as client CurrencyContext FALLBACK_RATES */
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

export type CourseRow = {
  id: string;
  price: number;
  discount_percentage?: number | null;
  discount_expires_at?: string | null;
};

export type CountryPriceRow = {
  course_id: string;
  country_code: string;
  price: number;
  original_price?: number;
  discount_percentage?: number;
  vat_percentage?: number | null;
  currency?: string | null;
};

function effectiveCourseDiscount(course: Pick<CourseRow, "discount_percentage" | "discount_expires_at">): number {
  const ex = course.discount_expires_at;
  const expired = ex && new Date(ex).getTime() <= Date.now();
  return expired ? 0 : Number(course.discount_percentage || 0);
}

export function computeBundleLineLocalFinal(
  course: CourseRow,
  countryRow: CountryPriceRow | null,
  detectedCountryUpper: string,
  currencyCode: string,
  rate: number,
): number {
  if (countryRow) {
    const price = Number(countryRow.price ?? 0);
    return Math.ceil(price);
  }
  const sarPrice = Number(course.price);
  const dPct = effectiveCourseDiscount(course);
  const ccy = currencyCode.toUpperCase();
  const convertedBase = ccy === "SAR" ? Math.ceil(sarPrice) : Math.ceil(sarPrice * rate);
  const finalBeforeVat = dPct > 0 ? Math.ceil(convertedBase * (1 - dPct / 100)) : convertedBase;
  const vatForFallback = ccy === "SAR" ? BUNDLE_VAT_RATE_SA : 0;
  return vatForFallback > 0 ? Math.ceil(finalBeforeVat * (1 + vatForFallback / 100)) : finalBeforeVat;
}

export function localBundleTotalToSar(finalLocal: number, currencyCode: string, rate: number): number {
  const ccy = currencyCode.toUpperCase();
  if (ccy === "SAR") return Math.ceil(finalLocal);
  if (!rate || rate <= 0) return Math.ceil(finalLocal);
  return Math.max(1, Math.ceil(finalLocal / rate));
}
