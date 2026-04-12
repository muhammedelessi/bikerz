export const PENDING_TRAINING_BOOKING_KEY = "bikerz_pending_training_booking";

export type PendingTrainingBookingPayload = {
  trainer_course_id: string;
  trainer_id: string;
  training_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
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
    if (!o?.trainer_course_id || !o?.trainer_id || !o?.training_id || !o?.booking_date || !o?.start_time || !o?.end_time) {
      return null;
    }
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
