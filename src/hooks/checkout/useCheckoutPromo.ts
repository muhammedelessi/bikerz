import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { validateCoupon } from '@/services/supabase.service';
import type { AppliedCoupon } from '@/types/payment';
import { translateCouponValidationMessage } from '@/lib/userFacingServerMessages';

export function useCheckoutPromo(courseId: string, basePrice: number) {
  const { t } = useTranslation();
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
        let raw: string | undefined;
        try {
          if (error.context && typeof error.context.json === 'function') {
            const body = (await error.context.json()) as { error?: string };
            raw = typeof body?.error === 'string' ? body.error : undefined;
          }
        } catch {
          /* ignore */
        }
        toast.error(
          raw ? translateCouponValidationMessage(raw, t) : t('checkout.failedToValidateCode'),
        );
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
        const errText = typeof data?.error === "string" ? data.error : undefined;
        toast.error(translateCouponValidationMessage(errText, t));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      toast.error(msg ? translateCouponValidationMessage(msg, t) : t('checkout.failedToValidateCode'));
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
