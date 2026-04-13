import { differenceInDays, differenceInHours, differenceInMinutes, format, isPast } from 'date-fns';
import { ar } from 'date-fns/locale';

import { formatTimeAMPM } from '@/lib/trainingBookingUtils';

export interface BookingTimeResult {
  dateLine: string;
  timeLine: string;
  countdown: string | null;
  countdownColor: 'green' | 'amber' | 'red' | null;
  isPast: boolean;
}

export type BookingSessionLike = {
  date: string;
  start_time: string;
  end_time: string;
};

export function formatBookingTime(
  bookingDate: string,
  startTime: string,
  endTime: string,
  isRTL: boolean,
): BookingTimeResult {
  const dateTimeStr = `${bookingDate}T${startTime}`;
  const bookingDateTime = new Date(dateTimeStr);
  const now = new Date();
  const past = isPast(bookingDateTime);

  const dateLine = format(new Date(`${bookingDate}T12:00:00`), isRTL ? 'EEEE، d MMMM yyyy' : 'EEE, MMM d yyyy', {
    locale: isRTL ? ar : undefined,
  });

  const timeLine = `\u200e${formatTimeAMPM(startTime, isRTL)} — ${formatTimeAMPM(endTime, isRTL)}\u200e`;

  if (past) {
    return { dateLine, timeLine, countdown: null, countdownColor: null, isPast: true };
  }

  const minutesLeft = Math.max(0, differenceInMinutes(bookingDateTime, now));
  const hoursLeft = Math.max(0, differenceInHours(bookingDateTime, now));
  const daysLeft = Math.max(0, differenceInDays(bookingDateTime, now));

  let countdown: string | null = null;
  let countdownColor: 'green' | 'amber' | 'red' | null = null;

  if (minutesLeft < 60) {
    countdown = isRTL ? `تبقى ${minutesLeft} دقيقة` : `in ${minutesLeft}m`;
    countdownColor = 'red';
  } else if (hoursLeft < 24) {
    countdown = isRTL ? `تبقى ${hoursLeft} ساعة` : `in ${hoursLeft}h`;
    countdownColor = hoursLeft < 3 ? 'red' : 'amber';
  } else if (daysLeft === 1) {
    countdown = isRTL ? 'غداً' : 'tomorrow';
    countdownColor = 'amber';
  } else if (daysLeft <= 6) {
    countdown = isRTL ? `تبقى ${daysLeft} أيام` : `in ${daysLeft} days`;
    countdownColor = 'green';
  }

  return { dateLine, timeLine, countdown, countdownColor, isPast: false };
}

export function getNextSession(sessions: BookingSessionLike[]): BookingSessionLike | null {
  if (!sessions.length) return null;
  const now = new Date();
  const sorted = [...sessions].sort(
    (a, b) => new Date(`${a.date}T${a.start_time}`).getTime() - new Date(`${b.date}T${b.start_time}`).getTime(),
  );
  const next = sorted.find((s) => new Date(`${s.date}T${s.start_time}`) > now);
  return next || sorted[sorted.length - 1];
}
