import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { BundleTierRow } from '@/types/bundle';

type Props = {
  tiers: BundleTierRow[];
  selectedCount: number;
};

export const BundleTierLadder: React.FC<Props> = ({ tiers, selectedCount }) => {
  const { isRTL } = useLanguage();
  const active = tiers.filter((t) => t.is_active !== false);

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card/50 p-4 xl:p-5 sticky top-[calc(var(--navbar-h)+1rem)]" dir={isRTL ? 'rtl' : 'ltr'}>
      <p className="text-sm font-semibold">{isRTL ? 'مستويات الخصم' : 'Discount tiers'}</p>
      <p className="text-xs text-muted-foreground">{isRTL ? 'الخصم يصبح أعلى كلما زاد عدد الكورسات' : 'Discount increases as you select more courses'}</p>
      <ul className="space-y-3">
        {active.map((t) => {
          const reached = selectedCount >= t.min_courses;
          const name = isRTL ? (t.label_ar || t.label_en) : (t.label_en || t.label_ar);
          const pct = Math.min(100, (selectedCount / t.min_courses) * 100);
          return (
            <li
              key={t.id}
              className={cn(
                'relative rounded-2xl border-2 px-4 py-3 transition-all',
                reached ? 'border-primary bg-primary/10 shadow-sm' : 'border-border/50 bg-muted/10 opacity-70',
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={cn('text-2xl font-black tabular-nums', reached ? 'text-primary' : 'text-muted-foreground')}>
                  {Number(t.discount_percentage)}%
                </span>
                {reached && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    <Check className="w-3 h-3" />
                    {isRTL ? 'مفعّل' : 'Active'}
                  </span>
                )}
              </div>
              <p className="font-semibold text-sm mb-1">{name}</p>
              <p className="text-xs text-muted-foreground mb-2">
                {isRTL ? `عند اختيار ${t.min_courses}+ كورسات` : `When selecting ${t.min_courses}+ courses`}
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', reached ? 'bg-primary' : 'bg-primary/30')}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 text-end tabular-nums">
                {Math.min(selectedCount, t.min_courses)} / {t.min_courses}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
