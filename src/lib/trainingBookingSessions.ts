import { format, startOfDay } from 'date-fns';
import { stripClockFromDbTime } from '@/lib/trainingBookingUtils';

export type BookingSessionDraft = {
  date: string;
  start: string;
  end: string;
};

/** Stored in `training_bookings.sessions` JSONB */
export type TrainingBookingSessionRecord = {
  session_number: number;
  date: string;
  start_time: string;
  end_time: string;
  status?: 'pending' | 'completed';
  completed_at?: string | null;
};

export function toDbSessionsJson(picks: BookingSessionDraft[]): TrainingBookingSessionRecord[] {
  return picks.map((p, i) => ({
    session_number: i + 1,
    date: p.date.slice(0, 10),
    start_time: stripClockFromDbTime(p.start).slice(0, 8),
    end_time: stripClockFromDbTime(p.end).slice(0, 8),
    status: 'pending',
    completed_at: null,
  }));
}

export type NormalizedBookingSession = TrainingBookingSessionRecord;

/**
 * Normalize sessions for display: prefer JSONB array; otherwise single row from legacy columns.
 */
export function normalizeBookingSessions(
  sessions: unknown,
  booking_date: string | null,
  start_time: string | null,
  end_time: string | null,
  bookingStatus?: string,
): NormalizedBookingSession[] {
  const st = bookingStatus ?? 'confirmed';
  if (sessions && Array.isArray(sessions) && sessions.length > 0) {
    return (sessions as unknown[])
      .map((raw, idx) => {
        const o = raw as Record<string, unknown>;
        const date = String(o.date ?? '').slice(0, 10);
        const start = String(o.start_time ?? o.start ?? '').trim();
        const end = String(o.end_time ?? o.end ?? '').trim();
        const sn = Number(o.session_number ?? idx + 1);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !start || !end) return null;
        return {
          session_number: Number.isFinite(sn) ? sn : idx + 1,
          date,
          start_time: stripClockFromDbTime(start).slice(0, 8),
          end_time: stripClockFromDbTime(end).slice(0, 8),
          status: String(o.status ?? st) === 'completed' ? 'completed' : 'pending',
          completed_at: o.completed_at ? String(o.completed_at) : null,
        } satisfies NormalizedBookingSession;
      })
      .filter((x): x is NormalizedBookingSession => x != null);
  }
  if (booking_date && start_time && end_time) {
    return [
      {
        session_number: 1,
        date: booking_date.slice(0, 10),
        start_time: stripClockFromDbTime(start_time).slice(0, 8),
        end_time: stripClockFromDbTime(end_time).slice(0, 8),
        status: st === 'completed' ? 'completed' : 'pending',
        completed_at: null,
      },
    ];
  }
  return [];
}

export function sessionCountLabel(count: number, isRTL: boolean): string {
  const n = Math.max(1, count);
  if (isRTL) return `${n} ${n === 1 ? 'جلسة' : 'جلسات'}`;
  return `${n} ${n === 1 ? 'session' : 'sessions'}`;
}

/** Earliest session on or after today (by calendar date); if all past, returns the last session. */
export function pickNextUpcomingSession(sessions: NormalizedBookingSession[]): NormalizedBookingSession | null {
  if (!sessions.length) return null;
  const todayYmd = format(startOfDay(new Date()), 'yyyy-MM-dd');
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
  const next = sorted.find((s) => s.date >= todayYmd);
  return next ?? sorted[sorted.length - 1];
}
