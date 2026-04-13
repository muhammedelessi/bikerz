import React from 'react';
import { Check, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';

export type BundleSelectableCourse = {
  id: string;
  title: string;
  title_ar?: string | null;
  thumbnail_url?: string | null;
  preview_video_thumbnail?: string | null;
  price: number;
  discount_percentage?: number | null;
  discount_expires_at?: string | null;
  vat_percentage?: number | null;
};

type Props = {
  course: BundleSelectableCourse;
  selected: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onToggle: () => void;
};

const fallbackImg = '/hero-rider.webp';

export const SelectableBundleCourseCard: React.FC<Props> = ({
  course,
  selected,
  disabled,
  disabledReason,
  onToggle,
}) => {
  const { isRTL } = useLanguage();
  const { getCoursePriceInfo, getCurrencySymbol, currencyCode } = useCurrency();
  const title = isRTL && course.title_ar ? course.title_ar : course.title;
  const thumb = course.preview_video_thumbnail || course.thumbnail_url || fallbackImg;
  const expired = course.discount_expires_at && new Date(course.discount_expires_at).getTime() <= Date.now();
  const disc = expired ? 0 : course.discount_percentage || 0;
  const vat = course.vat_percentage ?? 15;
  const priceInfo = getCoursePriceInfo(course.id, course.price, disc, { vatPercent: vat });
  const sym = getCurrencySymbol(currencyCode, isRTL);

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && onToggle()}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        'relative text-start rounded-2xl border transition-all w-full overflow-hidden cursor-pointer h-full',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        disabled && 'opacity-60 cursor-not-allowed',
        selected && !disabled && 'border-primary bg-primary/5 scale-[1.01] shadow-md',
        !selected && !disabled && 'border-border/70 bg-card hover:border-primary/40',
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {selected && !disabled && (
        <span className="absolute top-2 end-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
          <Check className="w-4 h-4" />
        </span>
      )}
      <div className="relative aspect-video w-full bg-muted">
        <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="p-3 pb-12 space-y-1">
        <h3 className="font-semibold text-sm line-clamp-2 leading-snug">{title}</h3>
        <p className="text-sm font-bold text-primary tabular-nums">
          {priceInfo.finalPrice} {sym}
        </p>
        {disabled && disabledReason && (
          <span className="inline-block text-[10px] rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">{disabledReason}</span>
        )}
      </div>
      <Link
        to={`/courses/${course.id}`}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'absolute bottom-2 inset-x-2 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-background/80 backdrop-blur-sm border border-border text-xs transition-colors',
          'text-foreground lg:text-muted-foreground lg:hover:text-foreground lg:hover:border-primary/50',
        )}
      >
        <Eye className="w-3 h-3" />
        {isRTL ? 'عرض التفاصيل' : 'View Details'}
      </Link>
    </div>
  );
};
