import { FunctionsHttpError } from '@supabase/functions-js';
import { supabase } from '@/integrations/supabase/client';
import type { TapPaymentConfig } from '@/types/payment';

async function messageFromFunctionsHttpError(error: unknown): Promise<string | null> {
  if (!(error instanceof FunctionsHttpError)) return null;
  const ctx = error.context;
  if (!(ctx instanceof Response)) return null;
  try {
    const text = await ctx.clone().text();
    if (!text?.trim()) return null;
    const parsed = JSON.parse(text) as { error?: unknown };
    if (typeof parsed?.error === 'string' && parsed.error.trim()) return parsed.error.trim();
  } catch {
    return null;
  }
  return null;
}

export function parseDeviceInfo(): string {
  try {
    const ua = navigator.userAgent || '';
    const parts: string[] = [];
    if (/iPhone/.test(ua)) parts.push('iPhone');
    else if (/iPad/.test(ua)) parts.push('iPad');
    else if (/Android/.test(ua)) parts.push('Android');
    else if (/Macintosh/.test(ua)) parts.push('Mac');
    else if (/Windows/.test(ua)) parts.push('Windows');
    else if (/Linux/.test(ua)) parts.push('Linux');

    if (/Chrome/.test(ua) && !/Edg/.test(ua)) parts.push('Chrome');
    else if (/Safari/.test(ua) && !/Chrome/.test(ua)) parts.push('Safari');
    else if (/Firefox/.test(ua)) parts.push('Firefox');
    else if (/Edg/.test(ua)) parts.push('Edge');

    return parts.join(' | ') || ua.substring(0, 120);
  } catch {
    return 'Unknown';
  }
}

export async function createCharge(
  config: TapPaymentConfig,
  accessToken: string,
  userId: string,
  detectedCountry: string | null,
) {
  const trainerId = config.trainerCourseId?.trim();
  const courseId = config.courseId?.trim();
  const trainingId = config.trainingId?.trim();
  const explicitKind = String(config.paymentKind || '').trim().toLowerCase();
  // Practical booking: explicit kind, or trainer offer + program id (covers lost `paymentKind` in transit).
  // Never treat as video-only when a trainer offer id is present (proxies sometimes force `payment_kind: "course"`).
  const kind: 'course' | 'training_booking' =
    explicitKind === 'course' && !trainerId
      ? 'course'
      : explicitKind === 'training_booking' || (Boolean(trainerId) && Boolean(trainingId))
        ? 'training_booking'
        : 'course';

  if (kind === 'course' && !courseId) {
    throw new Error('courseId is required for course payments');
  }
  if (kind === 'training_booking' && !trainerId) {
    throw new Error('trainerCourseId is required for training booking payments');
  }
  if (kind === 'training_booking' && !trainingId) {
    throw new Error('trainingId is required for training booking payments');
  }
  const idPart =
    kind === 'training_booking'
      ? `tb_${trainerId || 'unknown'}`
      : String(courseId || 'unknown');
  const idempotencyKey = `${kind}_${idPart}_${userId}_${Date.now()}`;

  // Some proxies require `course_id` on every charge request. For trainer bookings we send
  // `trainings.id` here; `tap-create-charge` still stores `tap_charges.course_id` as null and
  // uses `trainer_courses` + `training_id` for pricing (see edge `dbCourseId`).
  const common = {
    currency: config.currency,
    amount: config.amount ?? null,
    customer_name: config.customerName,
    customer_email: config.customerEmail,
    customer_phone: config.customerPhone,
    idempotency_key: idempotencyKey,
    idempotencyKey: idempotencyKey,
    coupon_id: config.couponId || null,
    payment_method: config.paymentMethod || 'card',
    detected_country: detectedCountry || null,
    device_info: parseDeviceInfo(),
    token_id: config.tokenId || null,
    payment_kind: kind,
    paymentKind: kind,
    booking_type: kind,
    bookingType: kind,
  };

  const body =
    kind === 'training_booking'
      ? {
          ...common,
          course_id: trainingId,
          training_id: trainingId,
          trainer_course_id: trainerId,
          trainerCourseId: trainerId,
          tc: trainerId,
        }
      : {
          ...common,
          course_id: courseId,
        };

  const { data, error } = await supabase.functions.invoke('tap-create-charge', {
    body,
  });

  if (error) {
    const detail = await messageFromFunctionsHttpError(error);
    throw new Error(detail || error.message || 'Payment request failed');
  }
  if (data?.error) throw new Error(data.error);

  return data;
}

export async function verifyChargeOnce(chargeId: string) {
  const { data, error } = await supabase.functions.invoke('tap-verify-charge', {
    body: { charge_id: chargeId },
  });
  if (error) {
    const detail = await messageFromFunctionsHttpError(error);
    throw new Error(detail || error.message || 'Verification request failed');
  }
  return data;
}
