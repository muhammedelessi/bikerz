import { supabase } from '@/integrations/supabase/client';
import type { TapPaymentConfig } from '@/types/payment';

async function messageFromFunctionsHttpError(error: unknown): Promise<string | null> {
  if (!error || typeof error !== 'object') return null;
  const ctx = (error as { context?: unknown }).context;
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
  const bundleIds = (config.bundleCourseIds ?? []).map((x) => String(x).trim()).filter(Boolean);
  /** Bundle path if kind is set or we have ≥2 ids (covers lost `paymentKind` in some clients/proxies). */
  const isBundleCharge =
    explicitKind === 'course_bundle' ||
    (bundleIds.length >= 2 && explicitKind !== 'training_booking');

  if (isBundleCharge) {
    if (bundleIds.length < 2) {
      throw new Error('At least two courses are required for a bundle payment');
    }
    const idPart = `bundle_${[...new Set(bundleIds)].sort().join('_')}`;
    const idempotencyKey = `course_bundle_${idPart}_${userId}_${Date.now()}`;
    const body = {
      currency: config.currency,
      amount: config.amount ?? null,
      customer_name: config.customerName,
      customer_email: config.customerEmail,
      customer_phone: config.customerPhone,
      idempotency_key: idempotencyKey,
      idempotencyKey,
      coupon_id: null,
      payment_method: config.paymentMethod || 'card',
      detected_country: detectedCountry || null,
      device_info: parseDeviceInfo(),
      token_id: config.tokenId || null,
      payment_kind: 'course_bundle' as const,
      paymentKind: 'course_bundle',
      booking_type: 'course_bundle',
      bookingType: 'course_bundle',
      bundle_course_ids: bundleIds,
      bundleCourseIds: bundleIds,
      bundle_original_sar: config.bundleOriginalSar ?? null,
      bundle_discount_pct: config.bundleDiscountPct ?? null,
      bundle_final_sar: config.bundleFinalSar ?? null,
      currency_code_for_pricing: config.currencyCodeForPricing ?? null,
      currencyCodeForPricing: config.currencyCodeForPricing ?? null,
      exchange_rate_per_sar: config.exchangeRatePerSar ?? null,
      exchangeRatePerSar: config.exchangeRatePerSar ?? null,
    };
    const { data, error } = await supabase.functions.invoke('tap-create-charge', { body });
    if (data && typeof data === 'object' && 'error' in data && data.error) {
      throw new Error(String(data.error));
    }
    if (error) {
      const detail = await messageFromFunctionsHttpError(error);
      throw new Error(detail || error.message || 'Payment request failed');
    }
    return data;
  }

  // Practical booking: explicit kind, or trainer offer + program id (covers lost `paymentKind` in transit).
  // Some proxies force `payment_kind: "course"` — if both trainer offer + program ids are present, always use training path.
  const wantsTrainingBooking =
    explicitKind === 'training_booking' || (Boolean(trainerId) && Boolean(trainingId));
  const kind: 'course' | 'training_booking' = wantsTrainingBooking ? 'training_booking' : 'course';

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
    coupon_series_id: config.couponSeriesId || null,
    coupon_number: config.couponNumber ?? null,
    coupon_code: config.couponCode || null,
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

  if (data && typeof data === 'object' && 'error' in data && data.error) {
    const msg = String(data.error);
    if (
      msg === 'Course not found' &&
      (explicitKind === 'training_booking' || Boolean(trainerId || trainingId))
    ) {
      throw new Error(
        'Training payment was routed as a video course (missing or stripped trainer_course_id / payment_kind). ' +
          'Try again, or deploy the latest tap-create-charge edge function.',
      );
    }
    throw new Error(msg);
  }
  if (error) {
    const detail = await messageFromFunctionsHttpError(error);
    const msg = detail || error.message || 'Payment request failed';
    if (
      msg === 'Course not found' &&
      (explicitKind === 'training_booking' || Boolean(trainerId || trainingId))
    ) {
      throw new Error(
        'Training payment was routed as a video course (missing or stripped trainer_course_id / payment_kind). ' +
          'Try again, or deploy the latest tap-create-charge edge function.',
      );
    }
    throw new Error(msg);
  }

  return data;
}

export async function verifyChargeOnce(chargeId: string) {
  const { data, error } = await supabase.functions.invoke('tap-verify-charge', {
    body: { charge_id: chargeId },
  });
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
  if (error) {
    const detail = await messageFromFunctionsHttpError(error);
    throw new Error(detail || error.message || 'Verification request failed');
  }
  return data;
}
