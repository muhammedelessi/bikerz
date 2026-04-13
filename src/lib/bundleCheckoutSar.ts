/**
 * Convert bundle total from user's display currency (same integer totals as getCoursePriceInfo)
 * to SAR for Tap. `rate` = local currency units per 1 SAR (see CurrencyContext exchangeRate).
 */
export function localBundleTotalToSar(finalLocal: number, currencyCode: string, ratePerSar: number): number {
  const ccy = currencyCode.toUpperCase();
  if (ccy === 'SAR') return Math.ceil(finalLocal);
  if (!ratePerSar || ratePerSar <= 0) return Math.ceil(finalLocal);
  return Math.max(1, Math.ceil(finalLocal / ratePerSar));
}
