import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { validateCoupon } from '@/services/supabase.service';
import type { AppliedCoupon } from '@/types/payment';

export function useCheckoutPromo(courseId: string, basePrice: number) {
  const { isRTL } = useLanguage();
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  const handleApplyPromo = useCallback(async () => {
    if (!promoCode.trim() || promoLoading) return;
    setPromoLoading(true);
    try {
      const { data, error } = await validateCoupon(promoCode.trim(), courseId, basePrice);
      if (error) {
        let errorMsg = isRTL ? 'فشل التحقق من الرمز' : 'Failed to validate code';
        try {
          if (error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            errorMsg = body?.error || errorMsg;
          }
        } catch {}
        toast.error(errorMsg);
        return;
      }
      if (data?.valid) {
        setPromoApplied(true);
        setAppliedCoupon(data);
        toast.success(isRTL ? 'تم تطبيق الخصم بنجاح!' : 'Discount applied successfully!');
      } else {
        toast.error(data?.error || (isRTL ? 'رمز الخصم غير صالح' : 'Invalid promo code'));
      }
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'فشل التحقق من الرمز' : 'Failed to validate code'));
    } finally {
      setPromoLoading(false);
    }
  }, [promoCode, promoLoading, courseId, basePrice, isRTL]);

  const autoApplySavedCoupon = useCallback(async () => {
    const savedCoupon = localStorage.getItem('profile_coupon_code');
    if (savedCoupon && !promoApplied && !promoCode) {
      setPromoCode(savedCoupon);
      setPromoLoading(true);
      try {
        const { data, error } = await validateCoupon(savedCoupon, courseId, basePrice);
        if (!error && data?.valid) {
          setPromoApplied(true);
          setAppliedCoupon(data);
          toast.success(isRTL ? 'تم تطبيق الكوبون تلقائياً!' : 'Coupon auto-applied!');
          localStorage.removeItem('profile_coupon_code');
        }
      } catch {
        // Silently fail
      } finally {
        setPromoLoading(false);
      }
    }
  }, [promoApplied, promoCode, courseId, basePrice, isRTL]);

  const clearPromo = useCallback(() => {
    setPromoCode('');
    setPromoApplied(false);
    setAppliedCoupon(null);
  }, []);

  const resetPromo = useCallback(() => {
    setPromoCode('');
    setPromoApplied(false);
    setAppliedCoupon(null);
    setPromoLoading(false);
  }, []);

  return {
    promoCode, setPromoCode,
    promoApplied,
    promoLoading,
    appliedCoupon,
    handleApplyPromo,
    autoApplySavedCoupon,
    clearPromo,
    resetPromo,
  };
}
