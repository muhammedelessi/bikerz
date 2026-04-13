import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { PendingTrainingBookingPayload } from '@/lib/trainingBookingStorage';
import { stripClockFromDbTime } from '@/lib/trainingBookingUtils';
import { toDbSessionsJson, type BookingSessionDraft } from '@/lib/trainingBookingSessions';

export type InsertUserTrainingBookingParams = {
  userId: string;
  pending: PendingTrainingBookingPayload;
  paymentId: string | null;
  paymentStatus: string;
  bookingStatus?: string;
};

/**
 * Creates a `training_bookings` row for the signed-in user (RLS: user_id must match session).
 * Used after successful Tap payment and for zero-SAR (free) bookings without Tap.
 */
export async function insertUserTrainingBooking(
  params: InsertUserTrainingBookingParams,
): Promise<{ id: string } | { error: string }> {
  const { userId, pending, paymentId, paymentStatus, bookingStatus = 'confirmed' } = params;

  const slotDrafts: BookingSessionDraft[] =
    Array.isArray(pending.sessions) && pending.sessions.length > 0
      ? pending.sessions.map((s) => ({
          date: s.date,
          start: s.start_time,
          end: s.end_time,
        }))
      : [
          {
            date: pending.booking_date,
            start: pending.start_time,
            end: pending.end_time,
          },
        ];

  const sessionsPayload = toDbSessionsJson(slotDrafts) as unknown as Json;
  const first = slotDrafts[0];

  const { data, error } = await supabase
    .from('training_bookings')
    .insert({
      user_id: userId,
      trainer_id: pending.trainer_id,
      training_id: pending.training_id,
      trainer_course_id: pending.trainer_course_id,
      booking_date: first.date,
      start_time: stripClockFromDbTime(first.start),
      end_time: stripClockFromDbTime(first.end),
      sessions: sessionsPayload,
      amount: pending.payment_amount,
      currency: pending.payment_currency || 'SAR',
      status: bookingStatus,
      payment_status: paymentStatus,
      payment_id: paymentId,
      notes: pending.notes?.trim() || null,
      full_name: pending.full_name.trim(),
      phone: pending.phone.trim(),
      email: pending.email.trim(),
      preferred_date: first.date,
    })
    .select('id')
    .single();

  if (error) {
    console.error(error);
    return { error: error.message || 'Could not save booking' };
  }
  if (!data?.id) return { error: 'No booking id returned' };
  return { id: data.id as string };
}
