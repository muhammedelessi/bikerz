import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useBundleDisplayTotals } from '@/hooks/useBundleCalculator';
import type { BundleCourseInput } from '@/types/bundle';
import type { BundleTierRow } from '@/types/bundle';
import { cn } from '@/lib/utils';

type Props = {
  selectedCourses: BundleCourseInput[];
  tiers: BundleTierRow[] | undefined;
  onClear: () => void;
  onCheckout: () => void;
  /** Optional course titles for the two-line summary */
  courseLabels?: { id: string; title: string; title_ar?: string | null }[];
};

export const BundleBottomBar: React.FC<Props> = ({
  selectedCourses,
  tiers,
  onClear,
  onCheckout,
  courseLabels,
}) => {
  const { isRTL } = useLanguage();
  const { getCurrencySymbol, currencyCode, isSAR } = useCurrency();
  const display = useBundleDisplayTotals(selectedCourses, tiers);
  const currSym = getCurrencySymbol(currencyCode, isRTL);
  const visible = selectedCourses.length > 0;

  const tierLabel = (t: BundleTierRow | undefined) => {
    if (!t) return '';
    const name = isRTL ? (t.label_ar || t.label_en) : (t.label_en || t.label_ar);
    return isRTL
      ? `${name} — خصم ${Number(t.discount_percentage)}%`
      : `${name} — ${Number(t.discount_percentage)}% off`;
  };

  const lineTitles = selectedCourses.map((c) => {
    const row = courseLabels?.find((x) => x.id === c.id);
    if (!row) return '…';
    return isRTL && row.title_ar ? row.title_ar : row.title;
  });

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur-md shadow-[0_-8px_32px_rgba(0,0,0,0.12)]',
            'pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2.5 px-3 sm:px-5',
          )}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div className="mx-auto max-w-6xl space-y-2.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex items-center justify-center w-5.5 h-5.5 rounded-full bg-primary text-primary-foreground text-[10px] font-black">
                    {selectedCourses.length}
                  </span>
                  <span className="text-xs sm:text-sm font-semibold">
                    {isRTL ? `${selectedCourses.length} كورسات مختارة` : `${selectedCourses.length} courses selected`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {lineTitles.slice(0, 3).join(isRTL ? ' · ' : ' · ')}
                  {lineTitles.length > 3 ? (isRTL ? ` +${lineTitles.length - 3}` : ` +${lineTitles.length - 3}`) : ''}
                </p>
                {selectedCourses.length === 1 && (
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-500">
                    {isRTL ? "أضف كورساً واحداً لتفعيل خصم الباقة." : "Add one more course to unlock bundle pricing."}
                  </p>
                )}
                {display.applicableTier && (
                  <p className="text-sm font-semibold text-primary">{tierLabel(display.applicableTier)}</p>
                )}
                <div className="flex flex-wrap items-baseline gap-2 text-sm">
                  {display.discountPct > 0 ? (
                    <>
                      <span className="text-muted-foreground line-through tabular-nums">
                        {display.totalOriginal} {currSym}
                      </span>
                      <span className="text-muted-foreground">→</span>
                    </>
                  ) : null}
                  <span className="text-base font-bold text-foreground tabular-nums sm:text-lg">
                    {display.finalPrice} {currSym}
                  </span>
                  {display.discountPct > 0 ? (
                    <Sparkles className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                  ) : null}
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" className="shrink-0 text-muted-foreground h-8 px-2.5" onClick={onClear}>
                <X className="w-4 h-4 me-1" />
                {isRTL ? 'إلغاء' : 'Clear'}
              </Button>
            </div>

            {display.nextTier && display.coursesNeededForNext > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs">
                <p className="text-muted-foreground mb-1">
                  {isRTL
                    ? `أضف ${display.coursesNeededForNext} ${display.coursesNeededForNext === 1 ? 'كورساً' : 'كورسات'} للحصول على خصم ${Number(display.nextTier.discount_percentage)}%`
                    : `Add ${display.coursesNeededForNext} more course${display.coursesNeededForNext > 1 ? 's' : ''} for ${Number(display.nextTier.discount_percentage)}% off`}
                </p>
                <Progress
                  value={Math.min(100, (selectedCourses.length / display.nextTier.min_courses) * 100)}
                  className="h-1.5"
                />
                <p className="mt-1 text-muted-foreground text-[10px]">
                  {selectedCourses.length} / {display.nextTier.min_courses}
                </p>
              </div>
            )}

            <Button
              type="button"
              variant="cta"
              className="h-11 w-full rounded-lg text-sm font-semibold"
              disabled={selectedCourses.length < 2}
              onClick={onCheckout}
            >
              <ShoppingBag className="me-2 h-4 w-4" aria-hidden />
              {selectedCourses.length < 2
                ? isRTL
                  ? selectedCourses.length === 0
                    ? "اختر كورسين على الأقل"
                    : "أضف كورساً واحداً للمزيد من الخصم"
                  : selectedCourses.length === 0
                    ? "Select at least 2 courses"
                    : "Add 1 more course"
                : isRTL
                  ? `شراء الباقة · ${display.finalPrice} ${currSym}`
                  : `Buy bundle · ${display.finalPrice} ${currSym}`}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BundleBottomBar;
