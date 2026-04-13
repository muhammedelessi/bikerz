import React, { useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CreditCard } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCheckoutForm } from '@/hooks/checkout/useCheckoutForm';
import { useTapPayment } from '@/hooks/useTapPayment';
import { useGHLFormWebhook } from '@/hooks/useGHLFormWebhook';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useBundleCalculator } from '@/hooks/useBundleCalculator';
import type { CheckoutCourse } from '@/types/payment';
import type { BundleTierRow } from '@/types/bundle';
import CheckoutPaymentStep from '@/components/checkout/CheckoutPaymentStep';
import { navigateToSignup } from '@/lib/authReturnUrl';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: CheckoutCourse[];
  tiers: BundleTierRow[] | undefined;
};

function effectiveCourseDiscountCheckout(c: CheckoutCourse): number {
  const ex = c.discount_expires_at;
  const expired = ex && new Date(ex).getTime() <= Date.now();
  return expired ? 0 : c.discount_percentage || 0;
}

const BundleCheckoutModal: React.FC<Props> = ({ open, onOpenChange, courses, tiers }) => {
  const { isRTL } = useLanguage();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { sendWithCourses } = useGHLFormWebhook();
  const tap = useTapPayment();
  const { getCoursePriceInfo, getCurrencySymbol, currencyCode, exchangeRate } = useCurrency();

  const bundleInputs = useMemo(
    () =>
      courses.map((c) => ({
        id: c.id,
        price: c.price,
        discount_percentage: c.discount_percentage,
        discount_expires_at: c.discount_expires_at ?? null,
        vat_percentage: c.vat_percentage ?? 15,
      })),
    [courses],
  );

  const calc = useBundleCalculator(bundleInputs, tiers);

  /** Bundle charges are always computed and billed in SAR (same as edge function). */
  const sarLabel = isRTL ? 'ر.س' : 'SAR';
  const formatLocal = useCallback((amount: number) => `${amount} ${sarLabel}`, [sarLabel]);
  const currSym = getCurrencySymbol(currencyCode, isRTL);
  const formatDisplay = useCallback((amount: number) => `${amount} ${currSym}`, [currSym]);

  const form = useCheckoutForm(open);

  useEffect(() => {
    if (!open) {
      tap.reset();
      form.resetForm();
      return;
    }
    if (user) form.prefillAndAutoAdvance();
  }, [open, user]);

  useEffect(() => {
    if (!open || user) return;
    onOpenChange(false);
    navigateToSignup(navigate);
  }, [open, user, navigate, onOpenChange]);

  const handleSubmitPayment = useCallback(async () => {
    if (!user) {
      navigateToSignup(navigate);
      return;
    }
    if (!form.validateInfo()) return;
    form.saveProfileData();

    const composedAddress = [form.effectiveCity, form.effectiveCountry].filter(Boolean).join(', ');

    try {
      sessionStorage.setItem(
        'bikerz_checkout_data',
        JSON.stringify({
          fullName: form.fullName,
          phone: form.fullPhone,
          country: form.effectiveCountry,
          city: form.effectiveCity,
          amount: String(calc.finalPrice),
          currency: 'SAR',
        }),
      );
    } catch {
      /* ignore */
    }

    void sendWithCourses(user.id, {
      full_name: form.fullName,
      email: form.email,
      phone: form.fullPhone,
      country: form.effectiveCountry,
      city: form.effectiveCity,
      address: composedAddress,
      amount: String(calc.finalPrice),
      currency: 'SAR',
      orderStatus: 'pending',
      courseName: isRTL ? 'باقة كورسات' : 'Course bundle',
      dateOfBirth: profile?.date_of_birth || '',
      gender: profile?.gender || '',
      silent: true,
    });

    await tap.submitPayment({
      paymentKind: 'course_bundle',
      bundleCourseIds: courses.map((c) => c.id),
      bundleOriginalSar: calc.totalOriginal,
      bundleDiscountPct: calc.discountPct,
      bundleFinalSar: calc.finalPrice,
      currency: 'SAR',
      amount: calc.finalPrice,
      currencyCodeForPricing: currencyCode,
      exchangeRatePerSar: exchangeRate > 0 ? exchangeRate : undefined,
      customerName: form.fullName,
      customerEmail: form.email,
      customerPhone: form.fullPhone,
      courseName: isRTL ? 'باقة كورسات' : 'Course bundle',
      isRTL,
    });
  }, [
    user,
    form,
    courses,
    calc.finalPrice,
    calc.totalOriginal,
    calc.discountPct,
    tap,
    sendWithCourses,
    profile,
    isRTL,
    navigate,
    currencyCode,
    exchangeRate,
  ]);

  const isPaymentReady = form.isInfoValid && !tap.error && tap.status !== 'processing' && tap.status !== 'verifying';

  const firstTitle = courses[0] ? (isRTL && courses[0].title_ar ? courses[0].title_ar : courses[0].title) : '';

  if (open && !user) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden border-2 border-border bg-card p-0 gap-0"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-muted/30 p-4 sm:p-5 border-b-2 border-border flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {isRTL ? 'باقتك المخصصة' : 'Your custom bundle'}
            </DialogTitle>
            <p className="text-xs text-muted-foreground leading-relaxed mt-1.5 font-normal">
              {isRTL
                ? 'أسعار الكورسات بعملة العرض؛ المبلغ المستحق على البطاقة بالريال السعودي في الأسفل.'
                : 'Course prices are in your display currency; the card charge in SAR is shown below.'}
            </p>
          </DialogHeader>
          <ul className="mt-3 space-y-2 text-sm max-h-36 overflow-y-auto">
            {courses.map((c) => {
              const title = isRTL && c.title_ar ? c.title_ar : c.title;
              const pi = getCoursePriceInfo(c.id, c.price, effectiveCourseDiscountCheckout(c), {
                vatPercent: c.vat_percentage ?? 15,
              });
              return (
                <li key={c.id} className="flex justify-between gap-2">
                  <span className="truncate">{title}</span>
                  <span className="tabular-nums shrink-0">{formatDisplay(pi.finalPrice)}</span>
                </li>
              );
            })}
          </ul>
          {calc.discountPct > 0 && calc.applicableTier && (
            <p className="text-xs text-primary mt-2">
              {isRTL ? calc.applicableTier.label_ar || calc.applicableTier.label_en : calc.applicableTier.label_en || calc.applicableTier.label_ar}{' '}
              — −{formatDisplay(calc.display.discountAmount)}
            </p>
          )}
          <div className="mt-3 rounded-xl border border-border/70 bg-card/60 px-3 py-3 space-y-2.5">
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground shrink-0">{isRTL ? 'إجمالي العرض' : 'Display total'}</span>
              <span className="tabular-nums font-semibold text-end">{formatDisplay(calc.display.finalPrice)}</span>
            </div>
            <div className="flex justify-between gap-3 text-base font-bold text-primary pt-2 border-t border-border/60">
              <span className="leading-snug">{isRTL ? 'المبلغ المستحق (ريال سعودي)' : 'Amount due (SAR)'}</span>
              <span className="tabular-nums shrink-0">{formatLocal(calc.finalPrice)}</span>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0">
          <CheckoutPaymentStep
            bundleMode
            isRTL={isRTL}
            currencyLabel={sarLabel}
            formatLocal={formatLocal}
            promoCode=""
            setPromoCode={() => {}}
            promoApplied={false}
            appliedCoupon={null}
            handleApplyPromo={() => {}}
            clearPromo={() => {}}
            discountLabel=""
            discountAmount={0}
            discountedPrice={calc.finalPrice}
            fullName={form.fullName}
            setFullName={form.setFullName}
            email={form.email}
            phone={form.phone}
            setPhone={form.setPhone}
            phonePrefix={form.phonePrefix}
            setPhonePrefix={form.setPhonePrefix}
            phonePrefixOptions={form.phonePrefixOptions}
            isOtherCountry={form.isOtherCountry}
            isOtherCity={form.isOtherCity}
            countryManual={form.countryManual}
            setCountryManual={form.setCountryManual}
            country={form.country}
            setCountry={form.setCountry}
            cityManual={form.cityManual}
            setCityManual={form.setCityManual}
            city={form.city}
            countryOptions={form.countryOptions}
            cityOptions={form.cityOptions}
            selectedCountryCode={form.selectedCountryCode}
            handleCountryChange={form.handleCountryChange}
            handleCityChange={form.handleCityChange}
            errors={form.errors}
            setErrors={form.setErrors}
            courseTitle={firstTitle || 'Bundle'}
            courseTitleAr={courses[0]?.title_ar ?? null}
            paymentStatus={tap.status}
            isPaymentReady={isPaymentReady}
            vatPct={calc.vatPercentApplied}
            exchangeRate={1}
            isSAR
            onSubmitPayment={() => void handleSubmitPayment()}
          />
        </div>

        <div className="p-4 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))] border-t-2 border-border flex-shrink-0">
          <Button
            type="button"
            className="w-full h-11 rounded-xl text-sm font-bold"
            variant="cta"
            onClick={() => void handleSubmitPayment()}
            disabled={tap.status === 'processing' || tap.status === 'verifying' || !isPaymentReady}
          >
            {tap.status === 'processing' || tap.status === 'verifying' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin me-2" />
                {isRTL ? 'جاري تجهيز الدفع...' : 'Preparing payment...'}
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 me-2" />
                {isRTL ? 'ادفع الآن' : 'Pay Now'}
              </>
            )}
          </Button>
        </div>

        {tap.status === 'failed' && (
          <div className="px-4 pb-4 flex-shrink-0">
            <Button className="w-full" variant="outline" onClick={() => onOpenChange(false)}>
              {isRTL ? 'إغلاق' : 'Close'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BundleCheckoutModal;
