import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/components/ThemeProvider";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCheckoutForm } from "@/hooks/checkout/useCheckoutForm";
import { useCheckoutPromo } from "@/hooks/checkout/useCheckoutPromo";
import { useTapPayment } from "@/hooks/useTapPayment";
import { useTapCardSdk } from "@/hooks/checkout/useTapCardSdk";
import { useGHLFormWebhook } from "@/hooks/useGHLFormWebhook";
import { useGuestSignup } from "@/hooks/checkout/useGuestSignup";
import { enrollUserInCourse, incrementCouponUsage } from "@/services/supabase.service";
import CheckoutInfoStep from "@/components/checkout/CheckoutInfoStep";
import CheckoutPaymentStep from "@/components/checkout/CheckoutPaymentStep";
import CheckoutStatusOverlay from "@/components/checkout/CheckoutStatusOverlay";
import type { CheckoutCourse } from "@/types/payment";
import { navigateToSignup } from "@/lib/authReturnUrl";
import { recordCheckoutPaymentPageVisit } from "@/services/checkoutVisitAnalytics";

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: CheckoutCourse;
  onSuccess: () => void;
  onPaymentStarted?: () => void;
  vatPct?: number;
  /** Analytics: where checkout was opened (e.g. course page vs learn page). */
  visitSource?: string;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  open,
  onOpenChange,
  course,
  onSuccess,
  onPaymentStarted,
  vatPct: vatPctProp,
  visitSource = "course_checkout",
}) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { getCoursePriceInfo, getCurrencySymbol, isSAR, exchangeRate } = useCurrency();
  const { sendCourseStatus } = useGHLFormWebhook();
  const { handleGuestSignup, guestSigningUp } = useGuestSignup();

  const [step, setStep] = useState<"info" | "payment">("info");

  const priceInfo = useMemo(
    () => getCoursePriceInfo(course.id, course.price, course.discount_percentage || 0),
    [course.id, course.price, course.discount_percentage, getCoursePriceInfo],
  );

  const vatPct = vatPctProp ?? priceInfo.vatPct ?? 0;
  const basePrice = priceInfo.finalPrice;
  const currSym = getCurrencySymbol(priceInfo.currency, isRTL);

  const form = useCheckoutForm(open);
  const promo = useCheckoutPromo(course.id, basePrice);
  const tap = useTapPayment();
  /**
   * Lifted promo-panel state — when the user opens the discount field, the
   * footer's primary CTA swaps from "Pay Now" to "Apply code". Single, focused
   * action prevents accidental payment without applying the discount.
   */
  const [promoOpen, setPromoOpen] = useState(false);
  // Auto-close the panel once a code is applied (the green confirmation card replaces the input).
  useEffect(() => {
    if (promo.promoApplied && promoOpen) setPromoOpen(false);
  }, [promo.promoApplied, promoOpen]);

  // Discount & price — computed before tapCard so we pass the right initial amount
  const discountAmount = promo.appliedCoupon ? promo.appliedCoupon.discount_amount : 0;
  const discountedPrice = promo.appliedCoupon ? promo.appliedCoupon.final_amount : basePrice;
  const discountLabel = promo.appliedCoupon
    ? promo.appliedCoupon.discount_type === "percentage"
      ? `${promo.appliedCoupon.discount_value}%`
      : `${Math.round((promo.appliedCoupon.discount_amount / basePrice) * 100)}%`
    : "";

  // Extract phone country code digits (e.g. "+966_SA" → "966")
  const phoneCountryCode = useMemo(() => {
    const raw = form.phonePrefix || '';
    return raw.replace(/^\+/, '').split('_')[0] || '966';
  }, [form.phonePrefix]);

  const tapCard = useTapCardSdk({
    containerId: 'tap-card-element',
    amount: discountedPrice,
    currency: priceInfo.currency as string,
    locale: isRTL ? 'ar' : 'en',
    theme,
    customerName: form.fullName,
    customerEmail: form.email,
    customerPhone: form.phone,
    phoneCountryCode,
  });

  const formatLocal = useCallback((amount: number) => `${amount} ${currSym}`, [currSym]);

  useEffect(() => {
    if (!open) {
      setStep("info");
      promo.resetPromo();
      tap.reset();
      form.resetForm();
      return;
    }
    if (user) {
      form.prefillAndAutoAdvance();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  // Init Tap Card SDK only when the payment step becomes active
  // (the #tap-card-element container must be in the DOM first)
  useEffect(() => {
    if (step === "payment" && open) {
      tapCard.reinit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, open]);

  /**
   * If the URL carries `?code=XYZ`, validate and apply it as soon as the modal
   * opens for an authenticated user.
   */
  const urlCodeAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open || !user) return;
    let code: string | null = null;
    try {
      const params = new URLSearchParams(window.location.search);
      code = params.get("code") || params.get("coupon");
    } catch {
      /* ignore */
    }
    if (!code) return;
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || urlCodeAppliedRef.current === trimmed) return;
    urlCodeAppliedRef.current = trimmed;
    void promo.applyCodeFromUrl(trimmed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  // Keep SDK amount in sync when a coupon changes the price
  useEffect(() => {
    if (tapCard.sdkReady) {
      tapCard.updateAmount(discountedPrice, priceInfo.currency as string);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discountedPrice, priceInfo.currency]);

  useEffect(() => {
    if (!open || user) return;
    onOpenChange(false);
    navigateToSignup(navigate);
  }, [open, user, navigate, onOpenChange]);

  const visitLoggedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      visitLoggedRef.current = false;
      return;
    }
    if (!user) return;
    if (visitLoggedRef.current) return;
    visitLoggedRef.current = true;
    recordCheckoutPaymentPageVisit({
      userId: user.id,
      courseId: course.id,
      source: visitSource,
    });
  }, [open, user, course.id, visitSource]);

  const handleNextStep = useCallback(() => {
    if (!form.validateInfo()) return;
    form.saveProfileData();
    setStep("payment");
  }, [form]);

  const handleSubmitPayment = useCallback(async () => {
    if (!user) {
      navigateToSignup(navigate);
      return;
    }

    if (!form.validateInfo()) {
      toast.error(
        isRTL ? "يرجى تصحيح بيانات الفوترة قبل الدفع" : "Please fix your billing details before paying.",
      );
      return;
    }
    await form.saveProfileData();

    onPaymentStarted?.();

    const composedAddress = [form.effectiveCity, form.effectiveCountry].filter(Boolean).join(", ");
    const localCurrency = priceInfo.currency as string;

    // Free enrollment (100% coupon)
    if (discountedPrice === 0 && promo.appliedCoupon) {
      try {
        await enrollUserInCourse(user.id, course.id);
        if (promo.appliedCoupon?.coupon_id) {
          await incrementCouponUsage({
            couponId: promo.appliedCoupon.coupon_id,
            userId: user.id,
            courseId: course.id,
            discountAmount,
            originalAmount: basePrice,
            finalAmount: 0,
          });
        }
        if (promo.appliedCoupon?.coupon_series_id && promo.appliedCoupon?.coupon_number != null && promo.appliedCoupon?.coupon_code) {
          const { recordSeriesUsage } = await import('@/services/supabase.service');
          await recordSeriesUsage({
            seriesId: promo.appliedCoupon.coupon_series_id,
            codeUsed: promo.appliedCoupon.coupon_code,
            codeNumber: promo.appliedCoupon.coupon_number,
            userId: user.id,
            courseId: course.id,
            discountAmount,
            originalAmount: basePrice,
            finalAmount: 0,
          });
        }
        sendCourseStatus(user.id, course.id, course.title, "purchased", {
          full_name: form.fullName,
          email: form.email,
          phone: form.fullPhone,
          country: form.effectiveCountry,
          city: form.effectiveCity,
          address: composedAddress,
          amount: "0",
          currency: localCurrency,
          dateOfBirth: profile?.date_of_birth || "",
          gender: profile?.gender || "",
          silent: true,
        });
        onSuccess();
      } catch (err: any) {
        toast.error(err.message || "Enrollment failed");
      }
      return;
    }

    // Tap supported currencies
    const TAP_SUPPORTED = ["SAR", "KWD", "AED", "USD", "BHD", "QAR", "OMR", "EGP"];

    let paymentCurrency: string;
    let paymentAmount: number;

    if (TAP_SUPPORTED.includes(localCurrency)) {
      paymentCurrency = localCurrency;
      paymentAmount = discountedPrice;
    } else {
      paymentCurrency = "SAR";
      paymentAmount = isSAR || exchangeRate <= 0 ? discountedPrice : Math.ceil(discountedPrice / exchangeRate);
    }

    // Save checkout data for PaymentSuccess webhook
    try {
      sessionStorage.setItem(
        "bikerz_checkout_data",
        JSON.stringify({
          fullName: form.fullName,
          phone: form.fullPhone,
          country: form.effectiveCountry,
          city: form.effectiveCity,
          amount: String(paymentAmount),
          currency: paymentCurrency,
        }),
      );
    } catch {
      /* ignore */
    }

    sendCourseStatus(user.id, course.id, course.title, "pending", {
      full_name: form.fullName,
      email: form.email,
      phone: form.fullPhone,
      country: form.effectiveCountry,
      city: form.effectiveCity,
      address: composedAddress,
      amount: String(paymentAmount),
      currency: paymentCurrency,
      dateOfBirth: profile?.date_of_birth || "",
      gender: profile?.gender || "",
      silent: true,
    });

    const courseDisplayName = isRTL && course.title_ar ? course.title_ar : course.title;

    // ── Tokenise card before creating the charge ──────────────────────────
    let resolvedTokenId: string | undefined;
    if (tapCard.sdkReady) {
      const tokenId = await tapCard.tokenize();
      if (!tokenId) {
        // SDK will surface its own error via tapCard.sdkError
        toast.error(isRTL ? 'فشل في قراءة بيانات البطاقة، يرجى المحاولة مرة أخرى' : 'Card tokenisation failed. Please try again.');
        return;
      }
      resolvedTokenId = tokenId;
    }

    await tap.submitPayment({
      courseId: course.id,
      currency: paymentCurrency,
      customerName: form.fullName,
      customerEmail: form.email,
      customerPhone: form.fullPhone,
      billingCity: form.effectiveCity,
      billingCountry: form.effectiveCountry,
      couponId: promo.appliedCoupon?.coupon_id,
      couponSeriesId: promo.appliedCoupon?.coupon_series_id || undefined,
      couponNumber: promo.appliedCoupon?.coupon_number ?? undefined,
      couponCode: promo.appliedCoupon?.coupon_code || promo.promoCode?.trim().toUpperCase() || undefined,
      amount: paymentAmount,
      courseName: courseDisplayName,
      tokenId: resolvedTokenId,
      isRTL,
    });
  }, [
    user,
    discountedPrice,
    promo.appliedCoupon,
    course,
    form,
    tap,
    basePrice,
    discountAmount,
    isSAR,
    exchangeRate,
    isRTL,
    profile,
    onPaymentStarted,
    onSuccess,
    sendCourseStatus,
    t,
    navigate,
    isRTL,
  ]);

  useEffect(() => {
    if (tap.status === "succeeded") {
      navigate(`/payment-success?course=${course.id}&tap_id=tap_success`);
    }
  }, [tap.status, course.id, navigate]);

  // Pay button is enabled only once the card form is valid (all fields filled).
  // Also blocked while SDK is still loading to prevent falling back to src_all.
  const isPaymentReady =
    form.isInfoValid &&
    !tap.error &&
    tap.status !== "processing" &&
    tap.status !== "verifying" &&
    !tapCard.sdkLoading &&
    (tapCard.sdkReady ? tapCard.cardValid : false);

  const isStatusOverlay = tap.status === "verifying" || tap.status === "succeeded" || tap.status === "failed";

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const BackArrowIcon = isRTL ? ArrowRight : ArrowLeft;

  if (open && !user) {
    return null;
  }

  if (isStatusOverlay) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <CheckoutStatusOverlay
            paymentStatus={tap.status}
            paymentError={tap.error}
            courseId={course.id}
            onSuccess={onSuccess}
            onOpenChange={onOpenChange}
            onRetry={() => {
              tap.reset();
              setStep("payment");
            }}
            navigate={navigate}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden border-2 border-border bg-card p-0 gap-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="bg-muted/30 p-4 sm:p-5 border-b-2 border-border flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {step === "info"
                ? isRTL
                  ? "معلومات الفاتورة"
                  : "Billing Information"
                : isRTL
                  ? "بيانات البطاقة"
                  : "Card Details"}
            </DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-2">
            {/* Step 1 */}
            <div className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === "info" ? "bg-primary text-primary-foreground" : "bg-primary/20 text-primary"
              }`}>
                {step === "payment" ? "✓" : "1"}
              </div>
              <span className={`text-xs font-medium transition-colors ${
                step === "info" ? "text-foreground" : "text-muted-foreground"
              }`}>
                {isRTL ? "البيانات" : "Info"}
              </span>
            </div>
            {/* Connector */}
            <div className={`flex-1 h-px transition-colors ${step === "payment" ? "bg-primary" : "bg-border"}`} />
            {/* Step 2 */}
            <div className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === "payment" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                2
              </div>
              <span className={`text-xs font-medium transition-colors ${
                step === "payment" ? "text-foreground" : "text-muted-foreground"
              }`}>
                {isRTL ? "الدفع" : "Payment"}
              </span>
            </div>
          </div>

          {/* Course info */}
          <div className="flex items-center gap-3 mt-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              {course.thumbnail_url ? (
                <img
                  src={course.thumbnail_url}
                  alt={course.title}
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-foreground truncate">
                {isRTL && course.title_ar ? course.title_ar : course.title}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {priceInfo.discountPct > 0 && (
                  <span className="text-xs text-muted-foreground line-through">
                    {formatLocal(priceInfo.originalPrice)}
                  </span>
                )}
                <span className="text-base font-bold text-primary">{formatLocal(discountedPrice)}</span>
                {promo.promoApplied && discountLabel && (
                  <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">{discountLabel}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0">
          <AnimatePresence mode="wait">
            {step === "info" ? (
              <CheckoutInfoStep
                key="info"
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
              <CheckoutPaymentStep
                key="payment"
                isRTL={isRTL}
                currencyLabel={currSym}
                formatLocal={formatLocal}
                promoCode={promo.promoCode}
                setPromoCode={promo.setPromoCode}
                promoApplied={promo.promoApplied}
                promoLoading={promo.promoLoading}
                appliedCoupon={promo.appliedCoupon}
                invalidCode={promo.invalidCode}
                handleApplyPromo={promo.handleApplyPromo}
                clearPromo={promo.clearPromo}
                discountLabel={discountLabel}
                discountAmount={discountAmount}
                discountedPrice={discountedPrice}
                originalPrice={basePrice}
                promoOpen={promoOpen}
                onPromoOpenChange={setPromoOpen}
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
                courseTitle={course.title}
                courseTitleAr={course.title_ar}
                paymentStatus={tap.status}
                isPaymentReady={isPaymentReady}
                billingIncomplete={!form.isInfoValid}
                validateBilling={form.validateInfo}
                vatPct={vatPct}
                exchangeRate={exchangeRate}
                isSAR={isSAR}
                onSubmitPayment={handleSubmitPayment}
                tapCardContainerId="tap-card-element"
                tapCardLoading={tapCard.sdkLoading}
                tapCardValid={tapCard.cardValid}
                tapCardError={tapCard.sdkError}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))] border-t-2 border-border flex-shrink-0 flex gap-2">
          {step === "info" ? (
            /* ── Step 1: Next button (full width) ── */
            <Button
              className="flex-1 h-11 btn-cta"
              onClick={handleNextStep}
              disabled={form.profileSaving || !form.isInfoValid}
            >
              {form.profileSaving && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              {isRTL ? "التالي" : "Next"}
              <ArrowIcon className="w-4 h-4 ms-2" />
            </Button>
          ) : (
            /* ── Step 2: Back icon + CTA ── */
            <>
              {/* Back button — hidden while promo panel is open to keep footer clean */}
              {!promoOpen && (
                <Button
                  variant="outline"
                  className="h-11 px-3 rounded-xl shrink-0"
                  onClick={() => setStep("info")}
                  disabled={tap.status === "processing"}
                  aria-label={isRTL ? "رجوع" : "Back"}
                >
                  <BackArrowIcon className="w-4 h-4" />
                </Button>
              )}

              {/* CTA — Apply code / Free enroll / Pay Now */}
              {promoOpen && !promo.promoApplied ? (
                <Button
                  className="flex-1 h-11 rounded-xl text-sm font-bold"
                  variant="cta"
                  onClick={promo.handleApplyPromo}
                  disabled={!promo.promoCode || promo.promoLoading || tap.status === "processing"}
                >
                  {promo.promoLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin me-2" />
                      {isRTL ? "جارٍ التحقق..." : "Verifying…"}
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 me-2" />
                      {isRTL ? "تطبيق الكود" : "Apply code"}
                    </>
                  )}
                </Button>
              ) : discountedPrice <= 0 && promo.appliedCoupon ? (
                <Button
                  className="flex-1 h-11"
                  variant="cta"
                  onClick={handleSubmitPayment}
                  disabled={tap.status === "processing" || !isPaymentReady}
                >
                  {tap.status === "processing" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin me-2" />
                      {isRTL ? "جاري التسجيل..." : "Enrolling..."}
                    </>
                  ) : isRTL ? "سجّل مجاناً" : "Enroll for Free"}
                </Button>
              ) : (
                <Button
                  className="flex-1 h-11 rounded-xl text-sm font-bold"
                  variant="cta"
                  onClick={handleSubmitPayment}
                  disabled={tap.status === "processing" || guestSigningUp || !isPaymentReady}
                >
                  {guestSigningUp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin me-2" />
                      {isRTL ? "جاري إنشاء الحساب..." : "Creating account..."}
                    </>
                  ) : tap.status === "processing" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin me-2" />
                      {isRTL ? "جاري تجهيز الدفع..." : "Preparing payment..."}
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 me-2" />
                      {(() => {
                        const TAP_SUPPORTED = ["SAR", "KWD", "AED", "USD", "BHD", "QAR", "OMR", "EGP"];
                        const showLocal = TAP_SUPPORTED.includes(priceInfo.currency as string);
                        const displayAmt = showLocal
                          ? discountedPrice
                          : isSAR || exchangeRate <= 0
                            ? discountedPrice
                            : Math.ceil(discountedPrice / exchangeRate);
                        const displaySym = showLocal ? currSym : isRTL ? "ر.س" : "SAR";
                        return isRTL
                          ? `ادفع الآن — ${displayAmt} ${displaySym}`
                          : `Pay Now — ${displayAmt} ${displaySym}`;
                      })()}
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </div>

        {tap.status === "failed" && (
          <div className="p-4 border-t-2 border-border flex-shrink-0">
            <Button className="w-full" variant="outline" onClick={() => onOpenChange(false)}>
              {isRTL ? "إغلاق" : "Close"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutModal;
