import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { validateCoupon } from '@/services/supabase.service';
import type { AppliedCoupon } from '@/types/payment';

export function useCheckoutPromo(courseId: string, basePrice: number) {
  const { t } = useTranslation();
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
        let errorMsg = t('checkout.failedToValidateCode');
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
        setAppliedCoupon({
          ...data,
          coupon_code: data?.coupon_code || promoCode.trim().toUpperCase(),
        });
        toast.success(t('checkout.discountApplied'));
      } else {
        toast.error(data?.error || t('checkout.invalidPromoCode'));
      }
    } catch (err: any) {
      toast.error(err.message || t('checkout.failedToValidateCode'));
    } finally {
      setPromoLoading(false);
    }
  }, [promoCode, promoLoading, courseId, basePrice, t]);

  const autoApplySavedCoupon = useCallback(async () => {
    // No-op: auto-apply coupon feature removed
  }, []);

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
