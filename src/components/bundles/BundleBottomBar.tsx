import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useBundleCalculator } from '@/hooks/useBundleCalculator';
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
  const { getCurrencySymbol, currencyCode } = useCurrency();
  const calc = useBundleCalculator(selectedCourses, tiers);
  const sym = getCurrencySymbol(currencyCode, isRTL);
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
            'pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 px-3 sm:px-6',
          )}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div className="mx-auto max-w-5xl space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {lineTitles.slice(0, 3).join(isRTL ? ' · ' : ' · ')}
                  {lineTitles.length > 3 ? (isRTL ? ` +${lineTitles.length - 3}` : ` +${lineTitles.length - 3}`) : ''}
                </p>
                {calc.applicableTier && (
                  <p className="text-sm font-semibold text-primary">{tierLabel(calc.applicableTier)}</p>
                )}
                <div className="flex flex-wrap items-baseline gap-2 text-sm">
                  {calc.discountPct > 0 ? (
                    <>
                      <span className="text-muted-foreground line-through tabular-nums">
                        {calc.totalOriginal} {sym}
                      </span>
                      <span className="text-muted-foreground">→</span>
                    </>
                  ) : null}
                  <span className="text-lg font-bold text-foreground tabular-nums">
                    {calc.finalPrice} {sym}
                  </span>
                  {calc.discountPct > 0 ? <Sparkles className="w-4 h-4 text-amber-500 shrink-0" /> : null}
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" className="shrink-0 text-muted-foreground" onClick={onClear}>
                <X className="w-4 h-4 me-1" />
                {isRTL ? 'إلغاء' : 'Clear'}
              </Button>
            </div>

            {calc.nextTier && calc.coursesNeededForNext > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                <p className="text-muted-foreground mb-1">
                  {isRTL
                    ? `أضف ${calc.coursesNeededForNext} ${calc.coursesNeededForNext === 1 ? 'كورساً' : 'كورسات'} للحصول على خصم ${Number(calc.nextTier.discount_percentage)}%`
                    : `Add ${calc.coursesNeededForNext} more course${calc.coursesNeededForNext > 1 ? 's' : ''} for ${Number(calc.nextTier.discount_percentage)}% off`}
                </p>
                <Progress
                  value={Math.min(100, (selectedCourses.length / calc.nextTier.min_courses) * 100)}
                  className="h-1.5"
                />
                <p className="mt-1 text-muted-foreground text-[10px]">
                  {selectedCourses.length} / {calc.nextTier.min_courses}
                </p>
              </div>
            )}

            <Button
              type="button"
              variant="cta"
              className="w-full h-11 rounded-xl font-bold"
              disabled={selectedCourses.length < 2}
              onClick={onCheckout}
            >
              <ShoppingBag className="w-4 h-4 me-2" />
              {isRTL ? 'اشترِ الباقة الآن' : 'Buy bundle now'}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BundleBottomBar;
