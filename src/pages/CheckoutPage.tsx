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
 * navigation handler routes here instead.
 *
 * State + flow logic is OWNED by `useCheckoutFlow` (shared with
 * CheckoutModal). This file is just chrome: navbar, footer, layout,
 * scroll-to-top, status overlays.
 */
import React from "react";
import { useParams } from "react-router-dom";
import { useLocalizedNavigate } from "@/hooks/useLocalizedNavigate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2, CreditCard, Check, ChevronLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCheckoutFlow } from "@/hooks/checkout/useCheckoutFlow";
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
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useLocalizedNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { isSAR, exchangeRate } = useCurrency();

  // Page-only: redirect to signup if user is missing.
  React.useEffect(() => {
    if (!user) {
      navigateToSignup(navigate);
    }
  }, [user, navigate]);

  const flow = useCheckoutFlow({
    course: course as unknown as Parameters<typeof useCheckoutFlow>[0]["course"],
    active: true,
    // Page-style behaviour: scroll the form into view on step transition.
    onAdvanceToPayment: () => window.scrollTo({ top: 0, behavior: "smooth" }),
    // No onFreeEnrollmentSuccess → hook navigates to /payment-success itself.
  });

  // Invalidate enrollment query when the user lands on the page after
  // success (mirrors the legacy in-line invalidation that lived in this file).
  React.useEffect(() => {
    if (flow.tap.status === "succeeded") {
      queryClient.invalidateQueries({ queryKey: ["enrollment", course.id, user?.id] });
    }
  }, [flow.tap.status, course.id, user?.id, queryClient]);

  const {
    step,
    setStep,
    form,
    promo,
    tap,
    cardSdkStatus,
    tokenizing,
    handleCardApiReady,
    handleCardSdkStatusChange,
    priceInfo,
    vatPct,
    basePrice,
    currSym,
    discountAmount,
    discountedPrice,
    discountLabel,
    formatLocal,
    tapChargeInfo,
    cardPhoneCountryCode,
    cardPhoneNumber,
    isFreeEnrollment,
    showEmbeddedCard,
    promoOpen,
    setPromoOpen,
    isPaymentReady,
    isStatusOverlay,
    handleNextStep,
    handleSubmitPayment,
    handleRetryAfterFailure,
  } = flow;

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  if (!user) {
    return null; // useEffect above redirects to signup
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 pt-[var(--navbar-h)] pb-6">
        <div className="page-container py-3 sm:py-4">
          {/* Header row: back link + step indicator. */}
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

              {/* Content area */}
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
              onRetry={handleRetryAfterFailure}
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
              onRetry={handleRetryAfterFailure}
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
