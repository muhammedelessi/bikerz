import { useMemo } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { localBundleTotalToSar } from '@/lib/bundleCheckoutSar';
import { BUNDLE_FALLBACK_RATES } from '@/lib/bundleFallbackRates';
import type { BundleCourseInput, BundleTierRow } from '@/types/bundle';

function effectiveCourseDiscount(course: BundleCourseInput): number {
  const expired =
    course.discount_expires_at && new Date(course.discount_expires_at).getTime() <= Date.now();
  return expired ? 0 : course.discount_percentage || 0;
}

function resolveBundleTierState(selectedCount: number, tiers: BundleTierRow[] | undefined) {
  const activeTiers = (tiers ?? []).filter((t) => t.is_active !== false);
  const applicableTier = activeTiers
    .filter((t) => selectedCount >= t.min_courses)
    .sort((a, b) => b.min_courses - a.min_courses)[0];
  const nextTier = activeTiers
    .filter((t) => t.min_courses > selectedCount)
    .sort((a, b) => a.min_courses - b.min_courses)[0];
  const discountPct = applicableTier ? Number(applicableTier.discount_percentage) : 0;
  const coursesNeededForNext = nextTier ? nextTier.min_courses - selectedCount : 0;
  return { applicableTier, nextTier, discountPct, coursesNeededForNext };
}

/**
 * Bundle totals in the user's display currency / country course pricing (same rules as course cards).
 * Tier discount % is applied to this sum — for browsing only; Tap charges SAR from the server.
 */
export function useBundleDisplayTotals(selectedCourses: BundleCourseInput[], tiers: BundleTierRow[] | undefined) {
  const { getCoursePriceInfo } = useCurrency();

  return useMemo(() => {
    const { applicableTier, nextTier, discountPct, coursesNeededForNext } = resolveBundleTierState(
      selectedCourses.length,
      tiers,
    );

    const totalOriginal = selectedCourses.reduce((sum, course) => {
      const d = effectiveCourseDiscount(course);
      const vat = course.vat_percentage ?? 15;
      return sum + getCoursePriceInfo(course.id, course.price, d, { vatPercent: vat }).finalPrice;
    }, 0);

    const discountAmount = Math.round(totalOriginal * (discountPct / 100));
    const finalPrice = Math.max(0, totalOriginal - discountAmount);

    return {
      totalOriginal,
      discountPct,
      discountAmount,
      finalPrice,
      applicableTier,
      nextTier,
      coursesNeededForNext,
    };
  }, [selectedCourses, tiers, getCoursePriceInfo]);
}

/**
 * Tap bundle amount in SAR: same display math as `useBundleDisplayTotals`, then convert with
 * the same fallback rates as `tap-create-charge` (not live FX) so checkout matches the server.
 */
export function useBundleCalculator(selectedCourses: BundleCourseInput[], tiers: BundleTierRow[] | undefined) {
  const display = useBundleDisplayTotals(selectedCourses, tiers);
  const { currencyCode, exchangeRate } = useCurrency();
  /** Must match `getCoursePriceInfo` (same units per 1 SAR); fallback keeps parity with tap-create-charge when rate missing */
  const ratePerSar =
    exchangeRate > 0 && Number.isFinite(exchangeRate)
      ? exchangeRate
      : BUNDLE_FALLBACK_RATES[currencyCode] ?? 1;

  return useMemo(() => {
    const totalOriginal = localBundleTotalToSar(display.totalOriginal, currencyCode, ratePerSar);
    const finalPrice = localBundleTotalToSar(display.finalPrice, currencyCode, ratePerSar);
    const discountAmount = Math.max(0, totalOriginal - finalPrice);

    return {
      display,
      totalOriginal,
      discountPct: display.discountPct,
      discountAmount,
      finalPrice,
      applicableTier: display.applicableTier,
      nextTier: display.nextTier,
      coursesNeededForNext: display.coursesNeededForNext,
      vatPercentApplied: currencyCode === 'SAR' ? 15 : 0,
    };
  }, [display, currencyCode, ratePerSar]);
}
