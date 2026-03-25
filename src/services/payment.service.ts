import { supabase } from '@/integrations/supabase/client';
import type { TapPaymentConfig } from '@/types/payment';

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
  const idempotencyKey = `${config.courseId}_${userId}_${Date.now()}`;

  const { data, error } = await supabase.functions.invoke('tap-create-charge', {
    body: {
      course_id: config.courseId,
      currency: config.currency,
      customer_name: config.customerName,
      customer_email: config.customerEmail,
      customer_phone: config.customerPhone,
      idempotency_key: idempotencyKey,
      coupon_id: config.couponId || null,
      payment_method: config.paymentMethod || 'card',
      detected_country: detectedCountry || null,
      device_info: parseDeviceInfo(),
    },
  });

  if (error) throw new Error(error.message || 'Payment request failed');
  if (data?.error) throw new Error(data.error);

  return data;
}

export async function verifyChargeOnce(chargeId: string) {
  const { data, error } = await supabase.functions.invoke('tap-verify-charge', {
    body: { charge_id: chargeId },
  });
  if (error) throw new Error(error.message);
  return data;
}
