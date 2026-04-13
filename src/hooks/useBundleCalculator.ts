import { useMemo } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import type { BundleCourseInput, BundleTierRow } from '@/types/bundle';

function effectiveCourseDiscount(course: BundleCourseInput): number {
  const expired =
    course.discount_expires_at && new Date(course.discount_expires_at).getTime() <= Date.now();
  return expired ? 0 : course.discount_percentage || 0;
}

export function useBundleCalculator(selectedCourses: BundleCourseInput[], tiers: BundleTierRow[] | undefined) {
  const { getCoursePriceInfo } = useCurrency();

  return useMemo(() => {
    const totalOriginal = selectedCourses.reduce((sum, course) => {
      const d = effectiveCourseDiscount(course);
      const vat = course.vat_percentage ?? 15;
      const priceInfo = getCoursePriceInfo(course.id, course.price, d, { vatPercent: vat });
      return sum + priceInfo.finalPrice;
    }, 0);

    const activeTiers = (tiers ?? []).filter((t) => t.is_active !== false);

    const applicableTier = activeTiers
      .filter((t) => selectedCourses.length >= t.min_courses)
      .sort((a, b) => b.min_courses - a.min_courses)[0];

    const nextTier = activeTiers
      .filter((t) => t.min_courses > selectedCourses.length)
      .sort((a, b) => a.min_courses - b.min_courses)[0];

    const discountPct = applicableTier ? Number(applicableTier.discount_percentage) : 0;
    const discountAmount = Math.round(totalOriginal * (discountPct / 100));
    const finalPrice = Math.max(0, totalOriginal - discountAmount);
    const coursesNeededForNext = nextTier ? nextTier.min_courses - selectedCourses.length : 0;

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
