import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { validateCoupon } from '@/services/supabase.service';
import type { AppliedCoupon } from '@/types/payment';
import { translateCouponValidationMessage } from '@/lib/userFacingServerMessages';

export function useCheckoutPromo(courseId: string, basePrice: number) {
  const { t } = useTranslation();
  const [promoCode, _setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  /** Last failed validation message (used to highlight the input + show inline error). */
  const [invalidCode, setInvalidCode] = useState<string | null>(null);

  /** Always store the code uppercase so the UI shows it consistently as the user types. */
  const setPromoCode = useCallback((v: string) => {
    _setPromoCode(v.toUpperCase());
    // Typing again clears any previous invalid-code highlight.
    setInvalidCode(null);
  }, []);

  /** Validate a code and apply it if valid. Used by both the manual button and the URL auto-apply. */
  const applyCode = useCallback(
    async (rawCode: string, opts: { silentSuccess?: boolean } = {}) => {
      const code = rawCode.trim().toUpperCase();
      if (!code || promoLoading) return false;
      setPromoLoading(true);
      setInvalidCode(null);
      try {
        const { data, error } = await validateCoupon(code, courseId, basePrice);
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
          const msg = raw ? translateCouponValidationMessage(raw, t) : t('checkout.failedToValidateCode');
          setInvalidCode(msg);
          toast.error(msg);
          return false;
        }
        if (data?.valid) {
          setPromoApplied(true);
          setAppliedCoupon({
            ...data,
            coupon_code: data?.coupon_code || code,
          });
          if (!opts.silentSuccess) toast.success(t('checkout.discountApplied'));
          return true;
        } else {
          const errText = typeof data?.error === 'string' ? data.error : undefined;
          const msg = translateCouponValidationMessage(errText, t);
          setInvalidCode(msg);
          toast.error(msg);
          return false;
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : '';
        const msg = errMsg ? translateCouponValidationMessage(errMsg, t) : t('checkout.failedToValidateCode');
        setInvalidCode(msg);
        toast.error(msg);
        return false;
      } finally {
        setPromoLoading(false);
      }
    },
    [promoLoading, courseId, basePrice, t],
  );

  const handleApplyPromo = useCallback(async () => {
    if (!promoCode.trim()) return;
    await applyCode(promoCode);
  }, [applyCode, promoCode]);

  /**
   * Apply a code that came from a URL (?code=X). Sets the promo code state too
   * so the UI shows the chip even if the user opens the panel afterwards.
   * Silent success — no extra toast needed since the success state already
   * speaks for itself when the page loads.
   */
  const applyCodeFromUrl = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim().toUpperCase();
      if (!code) return;
      _setPromoCode(code);
      await applyCode(code, { silentSuccess: true });
    },
    [applyCode],
  );

  const autoApplySavedCoupon = useCallback(async () => {
    // No-op: auto-apply coupon feature removed
  }, []);

  const clearPromo = useCallback(() => {
    _setPromoCode('');
    setPromoApplied(false);
    setAppliedCoupon(null);
    setInvalidCode(null);
  }, []);

  const resetPromo = useCallback(() => {
    _setPromoCode('');
    setPromoApplied(false);
    setAppliedCoupon(null);
    setPromoLoading(false);
    setInvalidCode(null);
  }, []);

  return {
    promoCode, setPromoCode,
    promoApplied,
    promoLoading,
    appliedCoupon,
    invalidCode,
    handleApplyPromo,
    applyCodeFromUrl,
    autoApplySavedCoupon,
    clearPromo,
    resetPromo,
  };
}
