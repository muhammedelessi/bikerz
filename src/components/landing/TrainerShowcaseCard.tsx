import React from 'react';
import LocalizedLink from '@/components/common/LocalizedLink';
import { Clock, Gauge, MapPin, Star, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';

export type TrainerReviewStats = { avg: number; count: number };

export type TrainerShowcaseIdentity = {
  name_ar: string;
  name_en: string;
  photo_url: string | null;
};

export type TrainerShowcaseMetaIcon = 'clock' | 'map' | 'users' | 'gauge';

export type TrainerShowcaseMetaRow = {
  id: string;
  icon: TrainerShowcaseMetaIcon;
  text: string;
};

const META_ICONS: Record<TrainerShowcaseMetaIcon, React.ComponentType<{ className?: string }>> = {
  clock: Clock,
  map: MapPin,
  users: Users,
  gauge: Gauge,
};

export type TrainerShowcaseCardProps = {
  trainer: TrainerShowcaseIdentity;
  isRTL: boolean;
  reviewStats?: TrainerReviewStats | null;
  /** Location / headline under the name (e.g. session venue or city — country) */
  headline?: string | null;
  /** Smaller line under headline (optional; avoid duplicating the same location as headline) */
  subHeadline?: string | null;
  /** Short bio (e.g. two lines) — trainers directory */
  bioPreview?: string | null;
  metaRows: TrainerShowcaseMetaRow[];
  /** When set, shows large primary price (user currency / country pricing, value then currency name) */
  priceSar?: number | null;
  /** Saudi VAT % on marked-up subtotal (admin setting); omit to use site default VAT for SAR. */
  trainingVatPercent?: number | null;
  /** Footer actions (always clickable). When `profileHref` is set, the area above the footer opens this route. */
  footer: React.ReactNode;
  className?: string;
  /** When set, the main card body (not the footer) links to the trainer profile */
  profileHref?: string | null;
};

const TrainerShowcaseCard: React.FC<TrainerShowcaseCardProps> = ({
  trainer,
  isRTL,
  reviewStats,
  headline,
  subHeadline,
  bioPreview,
  metaRows,
  priceSar,
  trainingVatPercent,
  footer,
  className,
  profileHref,
}) => {
  const { formatTrainingOfferPrice } = useCurrency();
  const primaryName = isRTL ? trainer.name_ar : trainer.name_en;
  const secondaryName = isRTL ? trainer.name_en : trainer.name_ar;
  const showSecondaryName = !isRTL && secondaryName && secondaryName !== primaryName;
  const profileLabel = isRTL ? `عرض ملف ${primaryName}` : `View ${primaryName} profile`;

  const body = (
    <>
      <div className="flex gap-3 min-w-0">
        <Avatar className="h-16 w-16 shrink-0 ring-2 ring-primary/25 bg-muted">
          {/* Trim the photo_url so a value like " " (just whitespace) doesn't
              render an empty <img>, which would briefly show a broken-image
              icon before falling back. AvatarImage hides itself on load
              error so the AvatarFallback below takes over correctly. */}
          {(() => {
            const photoUrl = (trainer.photo_url ?? '').trim();
            return photoUrl ? (
              <AvatarImage
                src={photoUrl}
                alt={primaryName}
                className="object-cover object-top"
                loading="lazy"
                decoding="async"
              />
            ) : null;
          })()}
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">{primaryName.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 text-start space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-foreground leading-tight truncate">{primaryName}</p>
              {showSecondaryName && (
                <p className="text-xs text-muted-foreground truncate mt-0.5" dir="rtl" lang="ar">
                  {secondaryName}
                </p>
              )}
            </div>
            <div className="shrink-0 flex flex-col items-start gap-0.5 text-start">
              {reviewStats && reviewStats.count > 0 ? (
                <div
                  className="flex items-center gap-0.5 text-amber-500 font-semibold text-sm tabular-nums"
                  aria-label={isRTL ? `التقييم ${reviewStats.avg.toFixed(1)}` : `Rating ${reviewStats.avg.toFixed(1)}`}
                >
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span>{reviewStats.avg.toFixed(1)}</span>
                </div>
              ) : (
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  {isRTL ? 'بدون تقييم' : 'No reviews'}
                </span>
              )}
            </div>
          </div>
          {headline ? (
            <div className="flex items-start gap-2 pt-0.5">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold text-foreground leading-snug">{headline}</p>
                {subHeadline ? (
                  <p className="text-xs text-muted-foreground leading-snug">{subHeadline}</p>
                ) : null}
              </div>
            </div>
          ) : null}
          {bioPreview && (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed pt-0.5">{bioPreview}</p>
          )}
          <div className="space-y-1.5 pt-0.5">
            {metaRows.map((row) => {
              const Icon = META_ICONS[row.icon];
              return (
                <div key={row.id} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Icon className="h-4 w-4 shrink-0 mt-0.5 text-primary/80" />
                  <span className="leading-snug">{row.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {priceSar != null && !Number.isNaN(Number(priceSar)) && (
        <div
          className={cn(
            (headline || subHeadline || bioPreview || metaRows.length > 0) && 'border-t border-border/50 pt-3 mt-0.5',
          )}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
            {isRTL ? 'السعر' : 'Price'}
          </p>
          <p className="text-lg font-bold text-primary tabular-nums" dir={isRTL ? 'rtl' : 'ltr'} lang={isRTL ? 'ar' : 'en'}>
            {formatTrainingOfferPrice(Number(priceSar), isRTL, {
              vatPercent: trainingVatPercent != null && Number.isFinite(Number(trainingVatPercent)) ? trainingVatPercent : undefined,
            })}
          </p>
        </div>
      )}
    </>
  );

  return (
    <Card
      className={cn(
        'border-border/60 shadow-sm transition-shadow hover:shadow-md',
        profileHref && 'cursor-pointer',
        className,
      )}
    >
      <CardContent className="p-4 sm:p-5 flex flex-col gap-4">
        <div className="relative flex flex-col gap-4">
          {profileHref ? (
            <LocalizedLink
              to={profileHref}
              className="absolute inset-0 z-[1] rounded-md outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={profileLabel}
            />
          ) : null}
          <div className={cn('flex flex-col gap-4', profileHref && 'relative z-0 pointer-events-none')}>{body}</div>
        </div>

        <div className="relative z-[2] mt-auto pointer-events-auto">{footer}</div>
      </CardContent>
    </Card>
  );
};

export default TrainerShowcaseCard;
