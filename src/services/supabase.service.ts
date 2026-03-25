import { supabase } from '@/integrations/supabase/client';

export interface ProfileUpdateData {
  full_name: string;
  phone: string;
  city: string;
  country: string;
  postal_code: string | null;
  profile_complete: boolean;
}

export async function updateProfile(userId: string, data: ProfileUpdateData) {
  const { error } = await supabase
    .from('profiles')
    .update(data)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function fetchProfileBillingData(userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('city, country, postal_code, phone')
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

export async function validateCoupon(code: string, courseId: string, amount: number) {
  const { data, error } = await supabase.functions.invoke('coupon-validate', {
    body: { code, course_id: courseId, amount },
  });
  return { data, error };
}

export async function enrollUserInCourse(userId: string, courseId: string) {
  const { error } = await supabase
    .from('course_enrollments')
    .insert({ user_id: userId, course_id: courseId });
  if (error && !error.message.includes('duplicate')) {
    throw new Error(error.message);
  }
}

export async function incrementCouponUsage(params: {
  couponId: string;
  userId: string;
  courseId: string;
  discountAmount: number;
  originalAmount: number;
  finalAmount: number;
}) {
  await supabase.rpc('increment_coupon_usage', {
    p_coupon_id: params.couponId,
    p_user_id: params.userId,
    p_course_id: params.courseId,
    p_order_id: null,
    p_charge_id: null,
    p_discount_amount: params.discountAmount,
    p_original_amount: params.originalAmount,
    p_final_amount: params.finalAmount,
  });
}

export async function createGuestAccount(email: string, fullName: string, password: string) {
  const { data, error } = await (supabase.auth as any).signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin,
      data: { full_name: fullName },
    },
  });
  return { data, error };
}

export async function sendPasswordReset(email: string) {
  (supabase.auth as any).resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/forgot-password`,
  }).catch(() => {});
}
