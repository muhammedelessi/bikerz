import React from "react";
import { Check, Circle } from "lucide-react";
import LocalizedLink from "@/components/common/LocalizedLink";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";

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

const fallbackImg = "/hero-rider.webp";

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
      role="checkbox"
      aria-checked={selected}
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && onToggle()}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card text-start transition-[border-color,box-shadow] duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        disabled && "cursor-not-allowed opacity-55",
        !disabled && "cursor-pointer",
        selected && !disabled && "border-primary ring-1 ring-primary/30",
        !selected && !disabled && "border-border/80 hover:border-primary/40 hover:shadow-sm",
      )}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Selection indicator (card handles toggle) */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute end-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full border shadow-sm transition-colors",
          selected && !disabled
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border/80 bg-background/90 backdrop-blur-sm text-muted-foreground",
          disabled && "opacity-50",
        )}
      >
        {selected && !disabled ? (
          <Check className="h-4 w-4 stroke-[2.5]" />
        ) : (
          <Circle className="h-4 w-4 opacity-40" />
        )}
      </span>

      <div className="relative aspect-video w-full bg-muted">
        <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3 pt-3.5">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-foreground">{title}</h3>
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <p className="text-sm font-bold tabular-nums text-primary">
            {priceInfo.finalPrice} {sym}
          </p>
          <LocalizedLink
            to={`/courses/${course.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
          >
            {isRTL ? "تفاصيل" : "Details"}
          </LocalizedLink>
        </div>
        {disabled && disabledReason && (
          <p className="text-[11px] text-muted-foreground">{disabledReason}</p>
        )}
      </div>
    </div>
  );
};
