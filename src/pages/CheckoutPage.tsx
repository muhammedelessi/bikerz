/**
 * CheckoutPage — full-page checkout for desktop (and as a fallback on mobile
 * when the user lands here directly from a deep link).
 *
 * Why a page instead of a modal:
 * - More room on wide viewports for a 2-column layout (form + summary)
 * - Real URL means refreshes / deep links / back-button-after-success all work
 * - Better for SEO / analytics (separate page hit)
 *
 * Mobile UX is unchanged — the Enroll buttons in CourseDetail/CourseLearn
 * still open the existing CheckoutModal drawer on mobile. The desktop
 * navigation handler routes here instead. See `useIsMobile()` in the
 * CourseDetail "Enroll" click handler for the branching.
 *
 * State + flow logic mirrors CheckoutModal closely (the same hooks, the same
 * Tap-1126 retry path, the same 3DS modal). The only thing that's different
 * is the chrome: this is a plain page section instead of a Dialog/Drawer.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState, Suspense, lazy } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useLocalizedNavigate } from "@/hooks/useLocalizedNavigate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Loader2, CreditCard, Check, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCheckoutForm } from "@/hooks/checkout/useCheckoutForm";
import { useCheckoutPromo } from "@/hooks/checkout/useCheckoutPromo";
import { useTapPayment } from "@/hooks/useTapPayment";
import { useGHLFormWebhook } from "@/hooks/useGHLFormWebhook";
import { enrollUserInCourse, incrementCouponUsage } from "@/services/supabase.service";
import { recordCheckoutPaymentPageVisit } from "@/services/checkoutVisitAnalytics";
import { navigateToSignup } from "@/lib/authReturnUrl";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CheckoutInfoStep from "@/components/checkout/CheckoutInfoStep";
import CheckoutPaymentStep from "@/components/checkout/CheckoutPaymentStep";
import CheckoutStepIndicator from "@/components/checkout/CheckoutStepIndicator";
import EmbeddedCardForm from "@/components/checkout/EmbeddedCardForm";
import Checkout3DSModal from "@/components/checkout/Checkout3DSModal";
import CheckoutStatusOverlay from "@/components/checkout/CheckoutStatusOverlay";
import CheckoutOrderSummary from "@/components/checkout/CheckoutOrderSummary";

interface CourseRow {
  id: string;
  title: string;
  title_ar: string | null;
  price: number;
  discount_percentage?: number | null;
  discount_expires_at?: string | null;
  thumbnail_url: string | null;
  vat_percentage?: number | null;
}

const CheckoutPageInner: React.FC<{ course: CourseRow }> = ({ course }) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, profile } = useAuth();
  const navigate = useLocalizedNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { getCoursePriceInfo, getCurrencySymbol, isSAR, exchangeRate } = useCurrency();
  const { sendCourseStatus } = useGHLFormWebhook();

  // ----- Step + card state -----
  const [step, setStep] = useState<"info" | "payment">("info");
  const cardApiRef = useRef<{ tokenize: () => Promise<string>; reinit: () => void } | null>(null);
  const lastTokenIdRef = useRef<string | null>(null);
  const [cardSdkStatus, setCardSdkStatus] = useState<{
    sdkLoading: boolean; sdkReady: boolean; cardValid: boolean; sdkError: string | null;
  }>({ sdkLoading: false, sdkReady: false, cardValid: false, sdkError: null });
  const [tokenizing, setTokenizing] = useState(false);
  const submittingRef = useRef(false);

  const tap = useTapPayment();

  const handleCardApiReady = useCallback(
    (api: { tokenize: () => Promise<string>; reinit: () => void }) => {
      cardApiRef.current = api;
      // Wire reinit into useTapPayment so cancelChallenge can auto-refresh
      // the card form on cancel (prevents Tap error 1126 on retry).
      tap.registerCardReinit(() => {
        try {
          cardApiRef.current?.reinit();
          // Clear the cached token. Without this the next Pay click
          // detects lastTokenIdRef and reinits AGAIN on top of this
          // refresh, leaving the user staring at "Validating card…"
          // while two iframe lifecycles race.
          lastTokenIdRef.current = null;
        } catch (e) {
          console.warn('[CheckoutPage] cardApi.reinit() threw:', e);
        }
      });
    },
    [tap],
  );
  const handleCardSdkStatusChange = useCallback(
    (s: { sdkLoading: boolean; sdkReady: boolean; cardValid: boolean; sdkError: string | null }) => {
      setCardSdkStatus(s);
    },
    [],
  );

  // ----- Pricing -----
  const priceInfo = useMemo(
    () => getCoursePriceInfo(course.id, course.price, course.discount_percentage || 0),
    [course.id, course.price, course.discount_percentage, getCoursePriceInfo],
  );
  const vatPct = priceInfo.vatPct ?? 0;
  const basePrice = priceInfo.finalPrice;
  const currSym = getCurrencySymbol(priceInfo.currency, isRTL);

  const form = useCheckoutForm(true);
  const promo = useCheckoutPromo(course.id, basePrice);

  const [promoOpen, setPromoOpen] = useState(false);
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

  // Tap iframe charge info — what the SDK iframe shows on the card form
  const tapChargeInfo = useMemo(() => {
    const TAP_SUPPORTED = ["SAR", "KWD", "AED", "USD", "BHD", "QAR", "OMR", "EGP"];
    const localCurrency = priceInfo.currency as string;
    if (TAP_SUPPORTED.includes(localCurrency)) {
      return { currency: localCurrency, amount: discountedPrice };
    }
    const sarAmt = isSAR || exchangeRate <= 0 ? discountedPrice : Math.ceil(discountedPrice / exchangeRate);
    return { currency: "SAR", amount: sarAmt };
  }, [priceInfo.currency, discountedPrice, isSAR, exchangeRate]);

  const cardPhoneCountryCode = useMemo(() => {
    const raw = form.actualPrefix || "";
    return raw.replace(/^\+/, "").trim();
  }, [form.actualPrefix]);
  const cardPhoneNumber = useMemo(() => {
    const v = (form.phone || "").trim().replace(/[^0-9]/g, "");
    return v.startsWith("0") ? v.slice(1) : v;
  }, [form.phone]);

  const isFreeEnrollment = discountedPrice <= 0 && !!promo.appliedCoupon;
  const showEmbeddedCard = step === "payment" && !isFreeEnrollment;

  // ----- Effects -----
  // Prefill form when user is loaded
  useEffect(() => {
    if (user) {
      void form.prefillAndAutoAdvance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // URL `?code=XYZ` → auto-apply coupon
  const urlCodeAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user) return;
    let code: string | null = null;
    try {
      const params = new URLSearchParams(window.location.search);
      code = params.get("code") || params.get("coupon");
    } catch { /* ignore */ }
    if (!code) return;
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || urlCodeAppliedRef.current === trimmed) return;
    urlCodeAppliedRef.current = trimmed;
    void promo.applyCodeFromUrl(trimmed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Redirect to signup when not logged in
  useEffect(() => {
    if (!user) {
      navigateToSignup(navigate);
    }
  }, [user, navigate]);

  // Visit log
  const visitLoggedRef = useRef(false);
  const [searchParams] = useSearchParams();
  const visitSource = searchParams.get("source") || "checkout_page";
  useEffect(() => {
    if (!user || visitLoggedRef.current) return;
    visitLoggedRef.current = true;
    recordCheckoutPaymentPageVisit({
      userId: user.id,
      courseId: course.id,
      source: visitSource,
    });
  }, [user, course.id, visitSource]);

  // Proactive form reset on payment failure — prevents the "Validating
  // card…" stuck state on the next Pay click. See CheckoutModal for the
  // full reasoning; tl;dr: lastTokenIdRef being non-null sends the
  // tokenize wrapper through reinit+wait+tokenize, which races visibly.
  const lastFailedReinitRef = useRef<string | null>(null);
  useEffect(() => {
    if (tap.status !== "failed") return;
    const tag = tap.chargeId ?? `t-${Date.now()}`;
    if (lastFailedReinitRef.current === tag) return;
    lastFailedReinitRef.current = tag;
    try {
      cardApiRef.current?.reinit();
      lastTokenIdRef.current = null;
    } catch (e) {
      console.warn('[CheckoutPage] post-failure reinit threw:', e);
    }
  }, [tap.status, tap.chargeId]);

  // Redirect to success page on charge success
  useEffect(() => {
    if (tap.status === "succeeded") {
      const chargeParam = tap.chargeId ? `&tap_id=${encodeURIComponent(tap.chargeId)}` : "";
      navigate(`/payment-success?course=${course.id}${chargeParam}`);
    }
  }, [tap.status, tap.chargeId, course.id, navigate]);

  // ----- Handlers -----
  const handleNextStep = useCallback(() => {
    if (!form.validateInfo()) return;
    form.saveProfileData();
    setStep("payment");
    // Scroll to top so the user sees the payment form properly
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [form]);

  const handleSubmitPayment = useCallback(async (preTokenizedTokenId?: string) => {
    if (submittingRef.current) {
      console.warn("[CheckoutPage] handleSubmitPayment called while already submitting — ignoring");
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
      toast.error(
        isRTL ? "يرجى تصحيح بيانات الفوترة قبل الدفع" : "Please fix your billing details before paying.",
      );
      setStep("info");
      return;
    }
    await form.saveProfileData();

    const localCurrency = priceInfo.currency as string;

    // Free enrollment (100% coupon)
    if (discountedPrice === 0 && promo.appliedCoupon) {
      try {
        await enrollUserInCourse(user.id, course.id, promo.appliedCoupon?.coupon_code);
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
        if (
          promo.appliedCoupon?.coupon_series_id &&
          promo.appliedCoupon?.coupon_number != null &&
          promo.appliedCoupon?.coupon_code
        ) {
          const { recordSeriesUsage } = await import("@/services/supabase.service");
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
          amount: "0",
          currency: localCurrency,
          silent: true,
        });
        queryClient.invalidateQueries({ queryKey: ["enrollment", course.id, user?.id] });
        navigate(`/payment-success?course=${course.id}&tap_id=free_enrollment`);
      } catch (err: any) {
        toast.error(err.message || "Enrollment failed");
      } finally {
        submittingRef.current = false;
      }
      return;
    }

    // Card-based charge
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
    } catch { /* ignore */ }

    sendCourseStatus(user.id, course.id, course.title, "pending", {
      full_name: form.fullName,
      email: form.email,
      phone: form.fullPhone,
      country: form.effectiveCountry,
      city: form.effectiveCity,
      amount: String(paymentAmount),
      currency: paymentCurrency,
      silent: true,
    });

    const courseDisplayName = isRTL && course.title_ar ? course.title_ar : course.title;

    // Tokenize card client-side (single-use Tap token)
    let tokenId: string | undefined = preTokenizedTokenId;
    if (!tokenId && cardApiRef.current) {
      try {
        setTokenizing(true);
        if (lastTokenIdRef.current) {
          cardApiRef.current.reinit();
          await new Promise((r) => setTimeout(r, 250));
        }
        tokenId = await cardApiRef.current.tokenize();
        lastTokenIdRef.current = tokenId;
      } catch (err: any) {
        setTokenizing(false);
        submittingRef.current = false;
        const fallback = isRTL ? "تعذّر التحقق من بيانات البطاقة" : "Could not validate card details";
        const friendly = err?.message || fallback;
        console.error("[CheckoutPage] tokenize() rejected:", err);
        tap.setExternalError(friendly);
        toast.error(friendly);
        return;
      } finally {
        setTokenizing(false);
      }
    } else if (tokenId) {
      lastTokenIdRef.current = tokenId;
    }

    const buildSubmit = (tid: string | undefined) => ({
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
      couponCode:
        promo.appliedCoupon?.coupon_code ||
        promo.promoCode?.trim().toUpperCase() ||
        undefined,
      amount: paymentAmount,
      courseName: courseDisplayName,
      isRTL,
      tokenId: tid,
    });

    try {
      try {
        await tap.submitPayment(buildSubmit(tokenId));
      } catch (err: any) {
        const msg = String(err?.message || "");
        const errName = String(err?.name || "");
        const errCode = String(err?.code || "");
        const isReused =
          errName === "RecoverableTapSourceUsedError" ||
          errCode === "1126" ||
          /Source already used/i.test(msg) ||
          /\b1126\b/.test(msg);
        if (!isReused || !cardApiRef.current || preTokenizedTokenId) throw err;

        try {
          cardApiRef.current.reinit();
          await new Promise((r) => setTimeout(r, 700));
          const freshToken = await cardApiRef.current.tokenize();
          lastTokenIdRef.current = freshToken;
          await tap.submitPayment(buildSubmit(freshToken));
        } catch (retryErr: any) {
          console.error("[CheckoutPage] Auto-retry after Tap 1126 failed:", retryErr);
          const friendly = isRTL
            ? "تعذّرت إعادة المحاولة تلقائياً. الرجاء إدخال بيانات البطاقة من جديد ثم اضغط ادفع."
            : "Couldn't retry automatically. Please re-enter your card details and tap Pay again.";
          tap.setExternalError(friendly);
          try { cardApiRef.current?.reinit(); } catch { /* ignore */ }
        }
      }
    } finally {
      submittingRef.current = false;
    }
  }, [
    user, discountedPrice, promo.appliedCoupon, course.id, course.title, course.title_ar,
    form, tap, basePrice, discountAmount, isSAR, exchangeRate, isRTL,
    sendCourseStatus, navigate, queryClient, priceInfo.currency,
  ]);

  // ----- Computed UI flags -----
  const isPaymentReady =
    form.isInfoValid &&
    !tap.error &&
    tap.status !== "processing" &&
    tap.status !== "verifying" &&
    tap.status !== "confirming" &&
    tap.status !== "challenging_3ds";

  const isStatusOverlay =
    tap.status === "processing" ||
    tap.status === "verifying" ||
    tap.status === "confirming" ||
    tap.status === "challenging_3ds" ||
    tap.status === "succeeded";

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  // ----- Render -----
  if (!user) {
    return null; // useEffect above redirects to signup
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 pt-[var(--navbar-h)] pb-6">
        <div className="page-container py-3 sm:py-4">
          {/* Header row: back link + step indicator. Compact — keeps the
              form + Pay button above the fold on a 900px-tall laptop. */}
          <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4 flex-wrap">
            <button
              type="button"
              onClick={() => navigate(`/courses/${course.id}`)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className={isRTL ? "w-4 h-4 rotate-180" : "w-4 h-4"} />
              {isRTL ? "العودة للكورس" : "Back to course"}
            </button>

            <div className="flex-1 max-w-md">
              <CheckoutStepIndicator currentStep={step} isRTL={isRTL} />
            </div>
          </div>

          {/* 2-column layout — form on left, summary on right (desktop) */}
          <div className="grid lg:grid-cols-[1fr_320px] gap-4 lg:gap-5 items-start">
            {/* MAIN: form / payment */}
            <div className="rounded-2xl border-2 border-border bg-card shadow-sm overflow-hidden">
              <div className="bg-gradient-to-b from-muted/40 to-muted/15 border-b border-border px-4 py-3 sm:px-5 sm:py-3.5">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-foreground">
                  {step === "info"
                    ? (isRTL ? "معلومات الفوترة" : "Billing Information")
                    : (isRTL ? "إتمام الشراء" : "Complete Your Purchase")}
                </h1>
              </div>

              {/* Step 2 status pill */}
              {step === "payment" && (
                <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border-b border-emerald-500/20 px-4 sm:px-5 py-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="shrink-0 inline-flex items-center justify-center rounded-full bg-emerald-500 text-white h-5 w-5">
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </div>
                    <p className="text-xs font-semibold text-foreground truncate" dir="auto">
                      <span className="text-[10px] uppercase tracking-wider text-emerald-700/80 dark:text-emerald-300/80 me-2">
                        {isRTL ? "البيانات" : "Details"}
                      </span>
                      {form.fullName || "—"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-[11px]"
                    onClick={() => setStep("info")}
                  >
                    {isRTL ? "تعديل" : "Edit"}
                  </Button>
                </div>
              )}

              {/* Content area with animated step transitions. Tighter padding
                  than the modal so the Pay button stays above the fold on
                  laptop displays. */}
              <div className="p-4 sm:p-5">
                <AnimatePresence mode="wait" initial={false}>
                  {step === "info" ? (
                    <motion.div
                      key="step-info"
                      initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
                      transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                    >
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
                    </motion.div>
                  ) : (
                    <motion.div
                      key="step-payment"
                      initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
                      transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                    >
                      <CheckoutPaymentStep
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
                        onSubmitPayment={() => handleSubmitPayment()}
                        hideInlineSummary
                        hideTrustBadges
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
                                void handleSubmitPayment(tokenId);
                              }}
                            />
                          ) : null
                        }
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* CTA footer */}
              <div className="border-t border-border px-4 py-3 sm:px-5 sm:py-3.5 bg-muted/20">
                {step === "info" ? (
                  <Button
                    className="w-full h-11 rounded-xl text-sm font-bold btn-cta shadow-md hover:shadow-lg transition-shadow"
                    onClick={handleNextStep}
                    disabled={form.profileSaving || !form.isInfoValid}
                  >
                    {form.profileSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin me-2" />
                        {isRTL ? "جاري الحفظ..." : "Saving..."}
                      </>
                    ) : (
                      <>
                        {isRTL ? "متابعة للدفع" : "Continue to Payment"}
                        <ArrowIcon className="w-4 h-4 ms-2" />
                      </>
                    )}
                  </Button>
                ) : promoOpen && !promo.promoApplied ? (
                  <Button
                    className="w-full h-11 rounded-xl text-sm font-bold"
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
                ) : isFreeEnrollment ? (
                  <Button
                    className="w-full h-11 rounded-xl text-sm font-bold"
                    variant="cta"
                    onClick={() => handleSubmitPayment()}
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
                    className="w-full h-11 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-shadow"
                    variant="cta"
                    onClick={() => handleSubmitPayment()}
                    disabled={
                      tap.status === "processing" ||
                      !isPaymentReady ||
                      tokenizing ||
                      (showEmbeddedCard && (!cardSdkStatus.sdkReady || !cardSdkStatus.cardValid))
                    }
                  >
                    {tokenizing ? (
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
            </div>

            {/* SIDEBAR: order summary */}
            <CheckoutOrderSummary
              isRTL={isRTL}
              sticky={!isMobile}
              courseTitle={isRTL && course.title_ar ? course.title_ar : course.title}
              courseThumbnailUrl={course.thumbnail_url}
              originalPrice={basePrice}
              discountedPrice={discountedPrice}
              discountAmount={discountAmount}
              discountLabel={discountLabel}
              promoApplied={promo.promoApplied}
              currencyLabel={currSym}
              vatPct={vatPct}
              isSAR={isSAR}
              exchangeRate={exchangeRate}
              showEditBilling={step === "payment"}
              onEditBilling={() => setStep("info")}
              courseId={course.id}
            />
          </div>
        </div>
      </main>

      <Footer />

      {/* Status overlay — full-screen on processing/3DS/success */}
      {isStatusOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border-2 border-border bg-card shadow-2xl">
            <CheckoutStatusOverlay
              paymentStatus={tap.status}
              paymentError={tap.error}
              courseId={course.id}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["enrollment", course.id, user?.id] });
              }}
              onOpenChange={(open) => {
                if (!open) navigate(`/courses/${course.id}`);
              }}
              onRetry={() => {
                tap.reset();
                cardApiRef.current?.reinit();
                submittingRef.current = false;
                setStep("payment");
              }}
              onRecheck={tap.recheckStatus}
              navigate={navigate}
            />
          </div>
        </div>
      )}

      {/* Inline 3DS — opens when Tap returns a redirect_url */}
      {tap.challengeUrl && (
        <Checkout3DSModal url={tap.challengeUrl} onCancel={tap.cancelChallenge} onVerifyNow={tap.recheckStatus} />
      )}

      {/* Failure overlay (different state — shown above the form) */}
      {tap.status === "failed" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border-2 border-border bg-card shadow-2xl">
            <CheckoutStatusOverlay
              paymentStatus={tap.status}
              paymentError={tap.error}
              courseId={course.id}
              onSuccess={() => { /* no-op */ }}
              onOpenChange={(open) => {
                if (!open) navigate(`/courses/${course.id}`);
              }}
              onRetry={() => {
                tap.reset();
                cardApiRef.current?.reinit();
                submittingRef.current = false;
                setStep("payment");
              }}
              onRecheck={tap.recheckStatus}
              navigate={navigate}
            />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Outer route wrapper — fetches the course by URL param, handles loading +
 * not-found states, then mounts the inner component once we have data.
 */
const CheckoutPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { isRTL } = useLanguage();
  const navigate = useLocalizedNavigate();

  const { data: course, isLoading, isError } = useQuery({
    queryKey: ["course", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("id", courseId!)
        .maybeSingle();
      if (error) throw error;
      return data as CourseRow | null;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 pt-[var(--navbar-h)] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  if (isError || !course) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 pt-[var(--navbar-h)] flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold mb-2">
              {isRTL ? "لم نجد الكورس" : "Course not found"}
            </h1>
            <p className="text-muted-foreground mb-4">
              {isRTL
                ? "ربما تم حذف الكورس أو الرابط غير صحيح."
                : "The course may have been removed, or the link is incorrect."}
            </p>
            <Button onClick={() => navigate("/courses")}>
              {isRTL ? "تصفّح الكورسات" : "Browse courses"}
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return <CheckoutPageInner course={course} />;
};

export default CheckoutPage;
