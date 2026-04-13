import React from 'react';
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
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card/50 p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <p className="text-sm font-semibold">{isRTL ? 'مستويات الخصم' : 'Discount tiers'}</p>
      <ul className="space-y-3">
        {active.map((t) => {
          const reached = selectedCount >= t.min_courses;
          const name = isRTL ? (t.label_ar || t.label_en) : (t.label_en || t.label_ar);
          const pct = Math.min(100, (selectedCount / t.min_courses) * 100);
          return (
            <li
              key={t.id}
              className={cn(
                'rounded-xl border px-3 py-2 transition-colors',
                reached ? 'border-primary bg-primary/10' : 'border-border/70 bg-muted/20',
              )}
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className={cn('font-medium', reached && 'text-primary')}>
                  {t.min_courses}+ {isRTL ? 'كورسات' : 'courses'}
                </span>
                <span className="tabular-nums font-bold">{Number(t.discount_percentage)}%</span>
              </div>
              {name ? <p className="text-xs text-muted-foreground mt-0.5">{name}</p> : null}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-all', reached ? 'bg-primary' : 'bg-primary/40')}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
