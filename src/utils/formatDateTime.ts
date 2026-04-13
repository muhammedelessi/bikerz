import type { BookingTimeResult } from '@/lib/bookingTime';
import { formatBookingTime } from '@/lib/bookingTime';
import { formatTime12hClock, formatTimeAMPM, normalizeDbTime } from '@/lib/trainingBookingUtils';

export { formatBookingTime, formatTimeAMPM };
export type { BookingTimeResult };

/** Minutes since midnight from a DB time string (e.g. "09:00" / "09:00:00"). */
export function pgTimeStringToMinutes(t: string): number {
  const ns = normalizeDbTime(t).slice(0, 5);
  const [hs, ms] = ns.split(':').map((x) => parseInt(x, 10));
  return (hs || 0) * 60 + (ms || 0);
}

/** 12h clock label consistent with the rest of the app (ص/م or AM/PM). */
export function formatTimeFromMinutesSinceMidnight(totalMinutes: number, isRTL: boolean): string {
  const wrapped = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  const iso = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  return formatTime12hClock(iso, isRTL);
}
