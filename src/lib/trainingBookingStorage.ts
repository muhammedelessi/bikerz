export const PENDING_TRAINING_BOOKING_KEY = "bikerz_pending_training_booking";

/** When package has multiple sessions, all slots (order = session order). Omitted or length≤1 = legacy single session. */
export type PendingTrainingSessionSlot = {
  date: string;
  start_time: string;
  end_time: string;
};

export type PendingTrainingBookingPayload = {
  trainer_course_id: string;
  trainer_id: string;
  training_id: string;
  /** First session (backward compatible) */
  booking_date: string;
  start_time: string;
  end_time: string;
  /** Multi-session packages: full list; must align with first session fields when present */
  sessions?: PendingTrainingSessionSlot[];
  notes: string;
  full_name: string;
  phone: string;
  email: string;
  payment_amount: number;
  payment_currency: string;
};

export function readPendingTrainingBooking(): PendingTrainingBookingPayload | null {
  try {
    const raw = sessionStorage.getItem(PENDING_TRAINING_BOOKING_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as PendingTrainingBookingPayload;
    if (!o?.trainer_course_id || !o?.trainer_id || !o?.training_id) return null;
    if (Array.isArray(o.sessions) && o.sessions.length > 0) {
      for (const s of o.sessions) {
        if (!s?.date || !s?.start_time || !s?.end_time) return null;
      }
      return o;
    }
    if (!o.booking_date || !o.start_time || !o.end_time) return null;
    return o;
  } catch {
    return null;
  }
}

export function writePendingTrainingBooking(payload: PendingTrainingBookingPayload) {
  sessionStorage.setItem(PENDING_TRAINING_BOOKING_KEY, JSON.stringify(payload));
}

export function clearPendingTrainingBooking() {
  sessionStorage.removeItem(PENDING_TRAINING_BOOKING_KEY);
}
