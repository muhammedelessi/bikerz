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
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCheckoutForm } from "@/hooks/checkout/useCheckoutForm";
import { useCheckoutPromo } from "@/hooks/checkout/useCheckoutPromo";
import { useTapPayment } from "@/hooks/useTapPayment";
import { useGHLFormWebhook } from "@/hooks/useGHLFormWebhook";
import { useGuestSignup } from "@/hooks/checkout/useGuestSignup";
import { enrollUserInCourse, incrementCouponUsage } from "@/services/supabase.service";
import CheckoutInfoStep from "@/components/checkout/CheckoutInfoStep";
import CheckoutPaymentStep from "@/components/checkout/CheckoutPaymentStep";
import CheckoutStatusOverlay from "@/components/checkout/CheckoutStatusOverlay";
import CheckoutStepIndicator from "@/components/checkout/CheckoutStepIndicator";
import EmbeddedCardForm from "@/components/checkout/EmbeddedCardForm";
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
  const navigate = useNavigate();
  const { getCoursePriceInfo, getCurrencySymbol, isSAR, exchangeRate } = useCurrency();
  const { sendCourseStatus } = useGHLFormWebhook();
  const { handleGuestSignup, guestSigningUp } = useGuestSignup();

  // Default to "info" — for returning customers with a complete profile, the
  // open-effect below auto-advances to "payment" right after prefillAndAutoAdvance().
  const [step, setStep] = useState<"info" | "payment">("info");
  /** True once we've evaluated the profile completeness on open. Hides Step 1 indicator
   *  when the user was auto-skipped past it. */
  const [autoSkippedInfo, setAutoSkippedInfo] = useState(false);
  /** Tokenize handle wired up from the embedded card form. */
  const cardApiRef = useRef<{ tokenize: () => Promise<string> } | null>(null);
  const [cardSdkStatus, setCardSdkStatus] = useState<{
    sdkLoading: boolean; sdkReady: boolean; cardValid: boolean; sdkError: string | null;
  }>({ sdkLoading: false, sdkReady: false, cardValid: false, sdkError: null });
  const [tokenizing, setTokenizing] = useState(false);
  const handleCardApiReady = useCallback((api: { tokenize: () => Promise<string> }) => {
    cardApiRef.current = api;
  }, []);
  const handleCardSdkStatusChange = useCallback(
    (s: { sdkLoading: boolean; sdkReady: boolean; cardValid: boolean; sdkError: string | null }) => {
      setCardSdkStatus(s);
    },
    [],
  );

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

  const discountAmount = promo.appliedCoupon ? promo.appliedCoupon.discount_amount : 0;
  const discountedPrice = promo.appliedCoupon ? promo.appliedCoupon.final_amount : basePrice;
  const discountLabel = promo.appliedCoupon
    ? promo.appliedCoupon.discount_type === "percentage"
      ? `${promo.appliedCoupon.discount_value}%`
      : `${Math.round((promo.appliedCoupon.discount_amount / basePrice) * 100)}%`
    : "";

  const formatLocal = useCallback((amount: number) => `${amount} ${currSym}`, [currSym]);

  /**
   * Compute the actual currency + amount that will be charged on the card.
   * Mirrors the same fallback logic used in handleSubmitPayment so the embedded
   * Tap iframe always shows the user the exact amount they're about to pay.
   */
  const tapChargeInfo = useMemo(() => {
    const TAP_SUPPORTED = ["SAR", "KWD", "AED", "USD", "BHD", "QAR", "OMR", "EGP"];
    const localCurrency = priceInfo.currency as string;
    if (TAP_SUPPORTED.includes(localCurrency)) {
      return { currency: localCurrency, amount: discountedPrice };
    }
    const sarAmt = isSAR || exchangeRate <= 0 ? discountedPrice : Math.ceil(discountedPrice / exchangeRate);
    return { currency: "SAR", amount: sarAmt };
  }, [priceInfo.currency, discountedPrice, isSAR, exchangeRate]);

  /** Phone country code for the SDK (e.g. "966" without the +). */
  const cardPhoneCountryCode = useMemo(() => {
    const raw = form.actualPrefix || "";
    return raw.replace(/^\+/, "").trim();
  }, [form.actualPrefix]);
  const cardPhoneNumber = useMemo(() => {
    const v = (form.phone || "").trim().replace(/[^0-9]/g, "");
    return v.startsWith("0") ? v.slice(1) : v;
  }, [form.phone]);

  /** Skip the embedded SDK entirely when the order is free (100%-off coupon). */
  const isFreeEnrollment = discountedPrice <= 0 && !!promo.appliedCoupon;
  const showEmbeddedCard = step === "payment" && !isFreeEnrollment;

  useEffect(() => {
    if (!open) {
      setStep("info");
      setAutoSkippedInfo(false);
      promo.resetPromo();
      tap.reset();
      form.resetForm();
      return;
    }
    if (user) {
      // prefillAndAutoAdvance() returns true when the profile already has full name +
      // billing — in that case skip Step 1 to preserve the conversion-friendly flow.
      void form.prefillAndAutoAdvance().then((complete) => {
        if (complete) {
          setStep("payment");
          setAutoSkippedInfo(true);
        } else {
          setStep("info");
          setAutoSkippedInfo(false);
        }
      });
    }
  }, [open, user]);

  /**
   * If the URL carries `?code=XYZ`, validate and apply it as soon as the modal
   * opens for an authenticated user. The hook silently shows the discounted
   * summary on success — and on failure it just leaves the field collapsed
   * (the user sees no confusing prefilled-but-broken code).
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

  const handleSubmitPayment = useCallback(async (preTokenizedTokenId?: string) => {
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

    // Tokenize the card client-side first so the secret-key backend only ever
    // sees a tok_xxx — raw card details never leave Tap's iframe. Apple Pay
    // already supplies a token (preTokenizedTokenId), so skip the card SDK call.
    let tokenId: string | undefined = preTokenizedTokenId;
    if (!tokenId && cardApiRef.current) {
      try {
        setTokenizing(true);
        tokenId = await cardApiRef.current.tokenize();
      } catch (err: any) {
        setTokenizing(false);
        toast.error(err?.message || (isRTL ? "تعذّر التحقق من بيانات البطاقة" : "Could not validate card details"));
        return;
      } finally {
        setTokenizing(false);
      }
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
      isRTL,
      tokenId,
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

  const isPaymentReady = form.isInfoValid && !tap.error && tap.status !== "processing" && tap.status !== "verifying";

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
                  ? "معلومات الدفع"
                  : "Billing Information"
                : isRTL
                  ? "إتمام الشراء"
                  : "Complete Purchase"}
            </DialogTitle>
          </DialogHeader>

          {/* Step 1 / Step 2 indicator (hidden when the user was auto-skipped past Step 1) */}
          <div className="mt-3">
            <CheckoutStepIndicator currentStep={step} isRTL={isRTL} hideInfoStep={autoSkippedInfo} />
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

        {/* Pinned Back-to-Step-1 bar — sits between header and scrollable content on Step 2,
            so it stays visible while card details / promo code scroll beneath it. */}
        {step === "payment" && !autoSkippedInfo && (
          <div className="px-4 sm:px-5 py-2.5 bg-muted/30 border-b border-border flex-shrink-0">
            <button
              type="button"
              onClick={() => setStep("info")}
              className="inline-flex items-center gap-2 h-10 px-3.5 rounded-lg border-2 border-border bg-background text-sm font-semibold text-foreground hover:bg-muted hover:border-primary/40 active:scale-[0.98] transition-all shadow-sm min-h-[40px]"
              aria-label={isRTL ? "رجوع للخطوة الأولى لتعديل البيانات" : "Back to step 1 to edit info"}
            >
              <BackArrowIcon className="w-4 h-4" />
              <span>{isRTL ? "رجوع لتعديل البيانات" : "Back to edit info"}</span>
            </button>
          </div>
        )}

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
                cardFormSlot={
                  showEmbeddedCard ? (
                    <EmbeddedCardForm
                      isRTL={isRTL}
                      active={showEmbeddedCard}
                      amount={tapChargeInfo.amount}
                      currency={tapChargeInfo.currency}
                      customerName={form.fullName}
                      customerEmail={form.email}
                      customerPhoneCountryCode={cardPhoneCountryCode}
                      customerPhoneNumber={cardPhoneNumber}
                      onApiReady={handleCardApiReady}
                      onStatusChange={handleCardSdkStatusChange}
                      onApplePayToken={(tokenId) => {
                        // Apple Pay sheet completed — submit immediately, bypassing
                        // the card SDK tokenize step (we already have a tok_xxx).
                        void handleSubmitPayment(tokenId);
                      }}
                    />
                  ) : null
                }
              />
            )}
          </AnimatePresence>
        </div>



        {/* Footer */}
        <div className="p-4 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))] border-t-2 border-border flex-shrink-0 flex gap-2">
          {step === "info" ? (
            <Button
              className="flex-1 btn-cta"
              onClick={handleNextStep}
              disabled={form.profileSaving || !form.isInfoValid}
            >
              {form.profileSaving && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              {isRTL ? "التالي" : "Next"}
              <ArrowIcon className="w-4 h-4 ms-2" />
            </Button>
          ) : promoOpen && !promo.promoApplied ? (
            /*
              Promo panel is open — swap the Pay button for an Apply button so the
              user has a single, focused CTA. After successful apply, the panel
              auto-closes (see useEffect above) and the footer reverts to "Pay Now".
            */
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
              className="flex-1"
              variant="cta"
              onClick={() => handleSubmitPayment()}
              disabled={tap.status === "processing" || !isPaymentReady}
            >
              {tap.status === "processing" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                  {isRTL ? "جاري التسجيل..." : "Enrolling..."}
                </>
              ) : isRTL ? (
                "سجّل مجاناً"
              ) : (
                "Enroll for Free"
              )}
            </Button>
          ) : (
            <Button
              className="flex-1 h-11 rounded-xl text-sm font-bold"
              variant="cta"
              onClick={() => handleSubmitPayment()}
              disabled={tap.status === "processing" || guestSigningUp || !isPaymentReady || tokenizing || (showEmbeddedCard && (!cardSdkStatus.sdkReady || !cardSdkStatus.cardValid))}
            >
              {guestSigningUp ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                  {isRTL ? "جاري إنشاء الحساب..." : "Creating account..."}
                </>
              ) : tokenizing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                  {isRTL ? "جاري التحقق من البطاقة..." : "Validating card..."}
                </>
              ) : showEmbeddedCard && !cardSdkStatus.sdkReady ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                  {isRTL ? "جاري تحميل نموذج الدفع..." : "Loading payment form..."}
                </>
              ) : showEmbeddedCard && !cardSdkStatus.cardValid ? (
                <>
                  <CreditCard className="w-4 h-4 me-2" />
                  {isRTL ? "أكمل بيانات البطاقة" : "Complete card details"}
                </>
              ) : tap.status === "processing" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                  {isRTL ? "جاري تجهيز الدفع..." : "Preparing payment..."}
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 me-2" />
                  {/*
                    Pay button must always carry the actual amount the user is about to pay,
                    so they never doubt whether the discount applied. Use the same fallback
                    logic the order summary uses (local currency when Tap supports it,
                    otherwise show the SAR equivalent).
                  */}
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
