import React, { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CreditCard } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCheckoutForm } from '@/hooks/checkout/useCheckoutForm';
import { useTapPayment } from '@/hooks/useTapPayment';
import { useGHLFormWebhook } from '@/hooks/useGHLFormWebhook';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useBundleCalculator } from '@/hooks/useBundleCalculator';
import type { CheckoutCourse } from '@/types/payment';
import type { BundleTierRow } from '@/types/bundle';
import CheckoutInfoStep from '@/components/checkout/CheckoutInfoStep';
import CheckoutPaymentStep from '@/components/checkout/CheckoutPaymentStep';
import EmbeddedCardForm from '@/components/checkout/EmbeddedCardForm';
import Checkout3DSModal from '@/components/checkout/Checkout3DSModal';
import { navigateToSignup } from '@/lib/authReturnUrl';
import { recordCheckoutPaymentPageVisit } from '@/services/checkoutVisitAnalytics';

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
  const [step, setStep] = useState<'info' | 'payment'>('info');

  // Embedded card form state
  const cardApiRef = useRef<{ tokenize: () => Promise<string>; reinit: () => void } | null>(null);
  /** Last token we sent — Tap rejects reuse with code 1126, so if we see the
   *  same token come back from the SDK we force a reinit before submitting. */
  const lastTokenIdRef = useRef<string | null>(null);
  const [cardSdkStatus, setCardSdkStatus] = useState<{
    sdkLoading: boolean; sdkReady: boolean; cardValid: boolean; sdkError: string | null;
  }>({ sdkLoading: false, sdkReady: false, cardValid: false, sdkError: null });
  const [tokenizing, setTokenizing] = useState(false);
  /** Idempotency guard against duplicate Pay clicks — see CheckoutModal.tsx
   *  for full reasoning (Tap error 1126: "Source already used"). */
  const submittingRef = useRef(false);

  const handleCardApiReady = useCallback((api: { tokenize: () => Promise<string>; reinit: () => void }) => {
    cardApiRef.current = api;
  }, []);
  const handleCardSdkStatusChange = useCallback(
    (s: { sdkLoading: boolean; sdkReady: boolean; cardValid: boolean; sdkError: string | null }) => {
      setCardSdkStatus(s);
    },
    [],
  );

  const showEmbeddedCard = step === 'payment';

  /** Phone country code for the SDK (e.g. "966" without the +). */
  const cardPhoneCountryCode = useMemo(() => {
    const raw = form.actualPrefix || '';
    return raw.replace(/^\+/, '').trim();
  }, [form.actualPrefix]);
  const cardPhoneNumber = useMemo(() => {
    const v = (form.phone || '').trim().replace(/[^0-9]/g, '');
    return v.startsWith('0') ? v.slice(1) : v;
  }, [form.phone]);

  // `form` and `tap` are fresh objects every render (returned from custom hooks).
  // Including them in the dep array causes an infinite loop. Stash them in refs
  // and only re-run the effect when the actual triggers (`open`, `user`) change.
  const formRef = useRef(form);
  formRef.current = form;
  const tapRef = useRef(tap);
  tapRef.current = tap;

  useEffect(() => {
    if (!open) {
      setStep('info');
      tapRef.current.reset();
      formRef.current.resetForm();
      return;
    }
    if (user) {
      formRef.current.prefillAndAutoAdvance();
      if (formRef.current.fullName && formRef.current.effectiveCountry) {
        setStep('payment');
      }
    }
  }, [open, user]);

  useEffect(() => {
    if (!open || user) return;
    onOpenChange(false);
    navigateToSignup(navigate);
  }, [open, user, navigate, onOpenChange]);

  const bundleVisitLoggedRef = useRef(false);
  const primaryCourseId = courses[0]?.id ?? null;
  useEffect(() => {
    if (!open) {
      bundleVisitLoggedRef.current = false;
      return;
    }
    if (!user) return;
    if (bundleVisitLoggedRef.current) return;
    bundleVisitLoggedRef.current = true;
    recordCheckoutPaymentPageVisit({
      userId: user.id,
      courseId: primaryCourseId,
      source: 'bundle_checkout',
    });
  }, [open, user, primaryCourseId]);

  const handleSubmitPayment = useCallback(async () => {
    // Idempotency guard — see CheckoutModal.tsx for context (Tap error 1126).
    if (submittingRef.current) {
      console.warn("[BundleCheckout] handleSubmitPayment called while already submitting — ignoring");
      return;
    }
    submittingRef.current = true;

    if (!user) {
      submittingRef.current = false;
      navigateToSignup(navigate);
      return;
    }
    if (!form.validateInfo()) {
      submittingRef.current = false;
      return;
    }
    await form.saveProfileData();

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

    // Tokenize card client-side first (same pattern as single-course checkout)
    let tokenId: string | undefined;
    if (cardApiRef.current) {
      try {
        setTokenizing(true);
        // Force a fresh card iframe on retry — Tap rejects token reuse
        // with code 1126 "Source already used".
        if (lastTokenIdRef.current) {
          cardApiRef.current.reinit();
          await new Promise((r) => setTimeout(r, 250));
        }
        tokenId = await cardApiRef.current.tokenize();
        lastTokenIdRef.current = tokenId;
      } catch (err: any) {
        setTokenizing(false);
        submittingRef.current = false;
        const fallback = isRTL ? 'تعذّر التحقق من بيانات البطاقة' : 'Could not validate card details';
        tap.setExternalError(err?.message || fallback);
        return;
      } finally {
        setTokenizing(false);
      }
    }

    const buildSubmit = (tid: string | undefined) => ({
      paymentKind: 'course_bundle' as const,
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
      billingCity: form.effectiveCity,
      billingCountry: form.effectiveCountry,
      courseName: isRTL ? 'باقة كورسات' : 'Course bundle',
      isRTL,
      tokenId: tid,
    });

    try {
      try {
        await tap.submitPayment(buildSubmit(tokenId));
      } catch (err: any) {
        // Auto-recover from Tap error 1126 "Source already used" — the SDK
        // occasionally hands back a previously-consumed token. Reinit the
        // iframe, get a fresh tok_xxx, and resubmit ONCE.
        const msg = String(err?.message || '');
        const errName = String(err?.name || '');
        const errCode = String(err?.code || '');
        const isReused =
          errName === 'RecoverableTapSourceUsedError' ||
          errCode === '1126' ||
          /Source already used/i.test(msg) ||
          /\b1126\b/.test(msg);
        if (!isReused || !cardApiRef.current) throw err;

        try {
          cardApiRef.current.reinit();
          await new Promise((r) => setTimeout(r, 700));
          const freshToken = await cardApiRef.current.tokenize();
          lastTokenIdRef.current = freshToken;
          await tap.submitPayment(buildSubmit(freshToken));
        } catch (retryErr: any) {
          console.error('[BundleCheckout] Auto-retry after Tap 1126 failed:', retryErr);
          const friendly = isRTL
            ? 'تعذّرت إعادة المحاولة تلقائياً. الرجاء إدخال بيانات البطاقة من جديد ثم اضغط ادفع.'
            : "Couldn't retry automatically. Please re-enter your card details and tap Pay again.";
          tap.setExternalError(friendly);
          try { cardApiRef.current?.reinit(); } catch { /* ignore */ }
        }
      }
    } finally {
      submittingRef.current = false;
    }
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

  const isPaymentReady =
    form.isInfoValid &&
    !tap.error &&
    tap.status !== 'processing' &&
    tap.status !== 'verifying' &&
    tap.status !== 'challenging_3ds';

  const firstTitle = courses[0] ? (isRTL && courses[0].title_ar ? courses[0].title_ar : courses[0].title) : '';
  const handleNextToPayment = useCallback(() => {
    if (!form.validateInfo()) return;
    form.saveProfileData();
    setStep('payment');
  }, [form]);

  if (open && !user) {
    return null;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden border-2 border-border bg-card p-0 gap-0"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div className="bg-muted/30 p-4 sm:p-5 border-b-2 border-border flex-shrink-0">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2">
                <DialogTitle className="text-lg font-bold">
                  {step === 'info'
                    ? isRTL
                      ? 'معلومات الدفع'
                      : 'Billing Info'
                    : isRTL
                      ? 'إتمام الدفع'
                      : 'Complete Payment'}
                </DialogTitle>
                {step === 'payment' && (
                  <Button variant="ghost" size="sm" onClick={() => setStep('info')}>
                    {isRTL ? '← رجوع' : '← Back'}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1.5 font-normal">
                {isRTL
                  ? 'أسعار الكورسات بعملة العرض؛ المبلغ المستحق على البطاقة بالريال السعودي في الأسفل.'
                  : 'Course prices are in your display currency; the card charge in SAR is shown below.'}
              </p>
            </DialogHeader>
            {step === 'info' && (
              <>
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
              </>
            )}
          </div>

          <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0">
            {step === 'info' ? (
              <CheckoutInfoStep
                isRTL={isRTL}
                user={user}
                fullName={form.fullName}
                setFullName={form.setFullName}
                hasNamePrefilled={form.hasNamePrefilled}
                isEditingName={form.isEditingName}
                setIsEditingName={form.setIsEditingName}
                email={form.email}
                setEmail={form.setEmail}
                phone={form.phone}
                setPhone={form.setPhone}
                phonePrefix={form.phonePrefix}
                setPhonePrefix={form.setPhonePrefix}
                phonePrefixOptions={form.phonePrefixOptions}
                countryOptions={form.countryOptions}
                cityOptions={form.cityOptions}
                selectedCountryCode={form.selectedCountryCode}
                isOtherCountry={form.isOtherCountry}
                isOtherCity={form.isOtherCity}
                countryManual={form.countryManual}
                setCountryManual={form.setCountryManual}
                setCountry={form.setCountry}
                cityManual={form.cityManual}
                setCityManual={form.setCityManual}
                handleCountryChange={form.handleCountryChange}
                handleCityChange={form.handleCityChange}
                city={form.city}
                errors={form.errors}
                setErrors={form.setErrors}
              />
            ) : (
              <>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2 mb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    {isRTL ? 'ملخص الباقة' : 'Bundle Summary'}
                  </p>
                  {courses.map((course) => {
                    const priceInfo = getCoursePriceInfo(course.id, course.price, effectiveCourseDiscountCheckout(course), {
                      vatPercent: course.vat_percentage ?? 0,
                    });
                    return (
                      <div key={course.id} className="flex items-center justify-between text-sm">
                        <span className="text-foreground truncate me-2">{isRTL ? course.title_ar || course.title : course.title}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{formatLocal(priceInfo.finalPrice)}</span>
                      </div>
                    );
                  })}
                  <Separator className="my-2" />
                  {calc.discountPct > 0 && (
                    <div className="flex justify-between text-sm text-emerald-600">
                      <span>{isRTL ? `خصم الباقة (${calc.discountPct}%)` : `Bundle discount (${calc.discountPct}%)`}</span>
                      <span className="tabular-nums">−{formatLocal(calc.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-1">
                    <span>{isRTL ? 'الإجمالي' : 'Total'}</span>
                    <span className="text-primary tabular-nums">{formatLocal(calc.finalPrice)}</span>
                  </div>
                </div>
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
                  billingIncomplete={!form.isInfoValid}
                  validateBilling={form.validateInfo}
                  vatPct={calc.vatPercentApplied}
                  exchangeRate={1}
                  isSAR
                  onSubmitPayment={() => void handleSubmitPayment()}
                  cardFormSlot={
                    showEmbeddedCard ? (
                      <EmbeddedCardForm
                        isRTL={isRTL}
                        active={showEmbeddedCard}
                        amount={calc.finalPrice}
                        currency="SAR"
                        customerName={form.fullName}
                        customerEmail={form.email}
                        customerPhoneCountryCode={cardPhoneCountryCode}
                        customerPhoneNumber={cardPhoneNumber}
                        onApiReady={handleCardApiReady}
                        onStatusChange={handleCardSdkStatusChange}
                      />
                    ) : null
                  }
                />
              </>
            )}
          </div>

          <div className="p-4 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))] border-t-2 border-border flex-shrink-0">
            {step === 'info' ? (
              <Button
                type="button"
                className="w-full h-11 rounded-xl text-sm font-bold"
                variant="cta"
                onClick={handleNextToPayment}
                disabled={form.profileSaving || !form.isInfoValid}
              >
                {form.profileSaving && <Loader2 className="w-4 h-4 animate-spin me-2" />}
                {isRTL ? 'التالي' : 'Next'}
              </Button>
            ) : (
              <Button
                type="button"
                className="w-full h-11 rounded-xl text-sm font-bold"
                variant="cta"
                onClick={() => void handleSubmitPayment()}
                disabled={
                  tap.status === 'processing' ||
                  tap.status === 'verifying' ||
                  tap.status === 'challenging_3ds' ||
                  !isPaymentReady ||
                  tokenizing ||
                  (showEmbeddedCard && (!cardSdkStatus.sdkReady || !cardSdkStatus.cardValid))
                }
              >
                {tap.status === 'processing' || tap.status === 'verifying' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin me-2" />
                    {isRTL ? 'جاري تجهيز الدفع...' : 'Preparing payment...'}
                  </>
                ) : tokenizing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin me-2" />
                    {isRTL ? 'جاري التحقق من البطاقة...' : 'Validating card...'}
                  </>
                ) : showEmbeddedCard && !cardSdkStatus.sdkReady ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin me-2" />
                    {isRTL ? 'جاري تحميل نموذج الدفع...' : 'Loading payment form...'}
                  </>
                ) : showEmbeddedCard && !cardSdkStatus.cardValid ? (
                  <>
                    <CreditCard className="w-4 h-4 me-2" />
                    {isRTL ? 'أكمل بيانات البطاقة' : 'Complete card details'}
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 me-2" />
                    {isRTL
                      ? `ادفع الآن — ${calc.finalPrice} ${sarLabel}`
                      : `Pay Now — ${calc.finalPrice} ${sarLabel}`}
                  </>
                )}
              </Button>
            )}
          </div>

          {tap.status === 'failed' && (
            <div className="px-4 pb-4 flex-shrink-0">
              <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive text-center">
                <p className="font-semibold mb-1">{isRTL ? 'تعذّر إتمام الدفع' : 'Payment failed'}</p>
                {tap.error && <p className="text-xs opacity-80 mb-2">{tap.error}</p>}
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1"
                  onClick={() => {
                    // Reset state + reinit the embedded card form so the next
                    // attempt produces a FRESH token (Tap tokens are single-use;
                    // retrying with a stale token = error 1126).
                    tap.reset();
                    cardApiRef.current?.reinit();
                    submittingRef.current = false;
                    setCardSdkStatus({ sdkLoading: false, sdkReady: false, cardValid: false, sdkError: null });
                  }}
                >
                  {isRTL ? 'حاول مجدداً' : 'Try again'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Inline 3DS modal — opens when Tap returns a redirect_url for card verification */}
      {tap.challengeUrl && (
        <Checkout3DSModal url={tap.challengeUrl} onCancel={tap.cancelChallenge} />
      )}
    </>
  );
};

export default BundleCheckoutModal;
