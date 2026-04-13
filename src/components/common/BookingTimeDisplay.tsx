import React from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatBookingTime } from '@/lib/bookingTime';
import { formatTimeAMPM } from '@/lib/trainingBookingUtils';
import { cn } from '@/lib/utils';

type BookingTimeDisplayProps = {
  date: string;
  startTime: string;
  endTime: string;
  showCountdown?: boolean;
  compact?: boolean;
};

const colorClass: Record<'green' | 'amber' | 'red', string> = {
  green: 'bg-green-500/10 text-green-600 border-green-500/20',
  amber: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  red: 'bg-red-500/10 text-red-600 border-red-500/20',
};

export const BookingTimeDisplay: React.FC<BookingTimeDisplayProps> = ({
  date,
  startTime,
  endTime,
  showCountdown = true,
  compact = false,
}) => {
  const { isRTL } = useLanguage();
  const view = formatBookingTime(date, startTime, endTime, isRTL);
  const compactDate = format(new Date(`${date}T12:00:00`), isRTL ? 'd MMMM' : 'MMM d', {
    locale: isRTL ? ar : undefined,
  });

  const timeRange = (
    <span
      dir="ltr"
      lang={isRTL ? 'ar' : 'en'}
      translate="no"
      className="inline-flex flex-row flex-nowrap items-center gap-1 tabular-nums [unicode-bidi:isolate]"
    >
      <bdi>{formatTimeAMPM(startTime, isRTL)}</bdi>
      <span aria-hidden className="text-muted-foreground">
        —
      </span>
      <bdi>{formatTimeAMPM(endTime, isRTL)}</bdi>
    </span>
  );

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('text-sm', view.isPast && 'text-muted-foreground')}>
          <span dir="auto">{compactDate}</span>
          <span className="text-muted-foreground"> · </span>
          {timeRange}
        </span>
        {showCountdown && view.countdown && view.countdownColor ? (
          <>
            <span className="text-muted-foreground text-sm">·</span>
            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', colorClass[view.countdownColor])}>
              {view.countdown}
            </Badge>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <p className={cn('text-sm font-medium', view.isPast && 'text-muted-foreground')}>{view.dateLine}</p>
      <div className="text-xs text-muted-foreground">{timeRange}</div>
      {showCountdown && view.countdown && view.countdownColor ? (
        <Badge variant="outline" className={cn('mt-1 text-[10px] px-1.5 py-0', colorClass[view.countdownColor])}>
          {view.countdown}
        </Badge>
      ) : null}
    </div>
  );
};

export default BookingTimeDisplay;
