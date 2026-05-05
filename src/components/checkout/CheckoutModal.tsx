/**
 * CheckoutModal — drawer/dialog UX for course checkout (used on mobile and
 * inline from CourseDetail / CourseLearn). Owns only the chrome: header,
 * footer, animated step transitions, status overlays, 3DS modal mount.
 *
 * All payment behaviour lives in `useCheckoutFlow` so this file and
 * CheckoutPage stay in sync — a single fix to the payment pipeline now
 * touches one hook instead of two near-identical files.
 */
import React, { useEffect } from "react";
import { useLocalizedNavigate } from "@/hooks/useLocalizedNavigate";
import { motion, AnimatePresence } from "framer-motion";

import { DialogHeader } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2, CreditCard, Check } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCheckoutFlow } from "@/hooks/checkout/useCheckoutFlow";
import { useGuestSignup } from "@/hooks/checkout/useGuestSignup";
import CheckoutInfoStep from "@/components/checkout/CheckoutInfoStep";
import CheckoutPaymentStep from "@/components/checkout/CheckoutPaymentStep";
import CheckoutStatusOverlay from "@/components/checkout/CheckoutStatusOverlay";
import CheckoutStepIndicator from "@/components/checkout/CheckoutStepIndicator";
import EmbeddedCardForm from "@/components/checkout/EmbeddedCardForm";
import Checkout3DSModal from "@/components/checkout/Checkout3DSModal";
import ResponsiveCheckoutShell from "@/components/checkout/ResponsiveCheckoutShell";
import CheckoutWhatsAppHelp from "@/components/checkout/CheckoutWhatsAppHelp";
import type { CheckoutCourse } from "@/types/payment";
import { navigateToSignup } from "@/lib/authReturnUrl";

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
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useLocalizedNavigate();
  const { isSAR, exchangeRate } = useCurrency();
  const { guestSigningUp } = useGuestSignup();
  const isMobile = useIsMobile();

  const flow = useCheckoutFlow({
    course,
    active: open,
    vatPct: vatPctProp,
    visitSource,
    onPaymentStarted,
    // Modal-specific: free enrollment fires the parent's onSuccess so the
    // hosting page can update enrollment state without a navigation.
    onFreeEnrollmentSuccess: onSuccess,
  });

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
    showEmbeddedCard,
    promoOpen,
    setPromoOpen,
    isPaymentReady,
    isStatusOverlay,
    handleNextStep,
    handleSubmitPayment,
    handleRetryAfterFailure,
  } = flow;

  // Modal-only: redirect to signup if the user is somehow viewing the
  // modal without an authenticated session.
  useEffect(() => {
    if (!open || user) return;
    onOpenChange(false);
    navigateToSignup(navigate);
  }, [open, user, navigate, onOpenChange]);

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const BackArrowIcon = isRTL ? ArrowRight : ArrowLeft;

  if (open && !user) {
    return null;
  }

  if (isStatusOverlay) {
    // Lock the modal while a charge is mid-flight — closing during
    // processing/verifying/confirming doesn't cancel the charge, it just
    // hides our status UI and confuses the user about whether they were
    // billed.
    const lockClose =
      tap.status === "processing" ||
      tap.status === "verifying" ||
      tap.status === "confirming" ||
      tap.status === "challenging_3ds";

    return (
      <>
        <ResponsiveCheckoutShell
          open={open}
          onOpenChange={onOpenChange}
          preventClose={lockClose}
          a11yLabel={isRTL ? "حالة الدفع" : "Payment status"}
          className="sm:max-w-md"
        >
          <div className="overflow-y-auto">
            <CheckoutStatusOverlay
              paymentStatus={tap.status}
              paymentError={tap.error}
              courseId={course.id}
              onSuccess={onSuccess}
              onOpenChange={onOpenChange}
              onRetry={handleRetryAfterFailure}
              onRecheck={tap.recheckStatus}
              navigate={navigate}
            />
          </div>
        </ResponsiveCheckoutShell>
        {tap.challengeUrl && (
          <Checkout3DSModal
            url={tap.challengeUrl}
            onCancel={tap.cancelChallenge}
            onVerifyNow={tap.recheckStatus}
          />
        )}
      </>
    );
  }

  return (
    <ResponsiveCheckoutShell
      open={open}
      onOpenChange={onOpenChange}
      a11yLabel={
        step === "info"
          ? (isRTL ? "معلومات الدفع" : "Billing information")
          : (isRTL ? "إتمام الشراء" : "Complete purchase")
      }
    >
      {/* ---- Header (top of modal) ----------------------------------
          Two-tier layout:
          • Top tier: title + step indicator (compact on mobile, full on desktop)
          • Bottom tier: course thumb + title + price chip
          ------------------------------------------------------------ */}
      <div className={[
        "bg-gradient-to-b from-muted/40 to-muted/15 border-b-2 border-border flex-shrink-0",
        isMobile ? "px-4 pt-3 pb-3" : "px-5 pt-5 pb-4",
      ].join(" ")}>
        {isMobile ? (
          <div className="mb-2.5">
            <CheckoutStepIndicator currentStep={step} isRTL={isRTL} compact />
          </div>
        ) : (
          <>
            <DialogHeader className="mb-3">
              <h2 className="text-xl font-extrabold tracking-tight text-foreground">
                {step === "info"
                  ? (isRTL ? "معلومات الفوترة" : "Billing Information")
                  : (isRTL ? "إتمام الشراء" : "Complete Your Purchase")}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {step === "info"
                  ? (isRTL ? "نحتاج بياناتك لإصدار الفاتورة وتأكيد التسجيل" : "We need your details to issue the invoice and confirm enrollment")
                  : (isRTL ? "ادفع بأمان واستلم وصولك للكورس فوراً" : "Pay securely and get instant access to your course")}
              </p>
            </DialogHeader>
            <CheckoutStepIndicator currentStep={step} isRTL={isRTL} />
          </>
        )}

        {/* Course info — visual product card */}
        <div className={[
          "flex items-center gap-3 rounded-xl bg-background/80 border border-border/60 shadow-sm",
          isMobile ? "p-2 mt-0" : "p-3 mt-4",
        ].join(" ")}>
          <div className={[
            "rounded-lg overflow-hidden bg-muted flex-shrink-0 ring-1 ring-border",
            isMobile ? "w-11 h-11" : "w-14 h-14",
          ].join(" ")}>
            {course.thumbnail_url ? (
              <img
                src={course.thumbnail_url}
                alt={course.title}
                width={112}
                height={112}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                <CreditCard className={isMobile ? "w-5 h-5 text-primary" : "w-6 h-6 text-primary"} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
              {isRTL ? "تشتري الآن" : "You're buying"}
            </p>
            <h3 className={[
              "font-bold text-foreground truncate leading-tight",
              isMobile ? "text-sm" : "text-base",
            ].join(" ")}>
              {isRTL && course.title_ar ? course.title_ar : course.title}
            </h3>
          </div>
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            {priceInfo.discountPct > 0 && (
              <span className="text-[10px] text-muted-foreground line-through tabular-nums">
                {formatLocal(priceInfo.originalPrice)}
              </span>
            )}
            <span className={[
              "font-extrabold text-primary tabular-nums leading-none",
              isMobile ? "text-base" : "text-lg",
            ].join(" ")}>
              {formatLocal(discountedPrice)}
            </span>
            {promo.promoApplied && discountLabel && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full tabular-nums">
                −{discountLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Step-2 status bar — confirms who's being charged + edit shortcut. */}
      {step === "payment" && (
        <div className={[
          "bg-emerald-500/5 dark:bg-emerald-500/10 border-b border-emerald-500/20 flex-shrink-0 flex items-center justify-between gap-3",
          isMobile ? "px-4 py-2" : "px-5 py-2.5",
        ].join(" ")}>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={[
              "shrink-0 inline-flex items-center justify-center rounded-full bg-emerald-500 text-white",
              isMobile ? "h-5 w-5" : "h-6 w-6",
            ].join(" ")}>
              <Check className={isMobile ? "w-3 h-3" : "w-3.5 h-3.5"} strokeWidth={3} />
            </div>
            <div className="min-w-0 flex flex-col leading-tight">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/80 dark:text-emerald-300/80">
                {isRTL ? "تم تأكيد البيانات" : "Details confirmed"}
              </span>
              <p className="text-xs font-semibold text-foreground truncate" dir="auto">
                {form.fullName || (isRTL ? "—" : "—")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStep("info")}
            className={[
              "inline-flex items-center gap-1.5 rounded-lg border border-border bg-background font-semibold text-foreground hover:bg-muted hover:border-primary/40 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              isMobile ? "h-8 px-2.5 text-[11px] min-h-[32px]" : "h-9 px-3 text-xs min-h-[36px]",
            ].join(" ")}
            aria-label={isRTL ? "رجوع للخطوة الأولى لتعديل البيانات" : "Back to step 1 to edit info"}
          >
            <BackArrowIcon className={isMobile ? "w-3 h-3" : "w-3.5 h-3.5"} />
            <span>{isRTL ? "تعديل" : "Edit"}</span>
          </button>
        </div>
      )}

      {/* Content — animated step transitions. */}
      <div className={[
        "overflow-y-auto flex-1 min-h-0 relative",
        isMobile ? "px-3 py-2.5" : "p-4 sm:p-5",
      ].join(" ")}>
        <AnimatePresence mode="wait" initial={false}>
          {step === "info" ? (
            <motion.div
              key="step-info"
              initial={{ opacity: 0, x: isRTL ? -24 : 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? 24 : -24 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            >
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
            </motion.div>
          ) : (
            <motion.div
              key="step-payment"
              initial={{ opacity: 0, x: isRTL ? -24 : 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? 24 : -24 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            >
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
                        // Apple Pay sheet completed — submit immediately,
                        // bypassing the card SDK tokenize step (we already
                        // have a tok_xxx).
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

      {/* Footer */}
      <div className={[
        "border-t-2 border-border flex-shrink-0 flex flex-col",
        isMobile
          ? "px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] gap-1.5"
          : "p-4 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))] gap-3",
      ].join(" ")}>
        <div className="flex justify-center">
          <CheckoutWhatsAppHelp
            context="idle"
            variant="inline"
            courseId={course.id}
          />
        </div>
        <div className="flex gap-2">
          {step === "info" ? (
            <Button
              className="flex-1 h-12 rounded-xl text-sm font-bold btn-cta shadow-md hover:shadow-lg transition-shadow"
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
              className="flex-1 h-12 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-shadow"
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

      {tap.status === "failed" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 sm:p-5">
          <div className="w-full max-w-md rounded-2xl border-2 border-border bg-card shadow-2xl">
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
              onRecheck={tap.recheckStatus}
              navigate={navigate}
            />
          </div>
        </div>
      )}
    </ResponsiveCheckoutShell>
  );
};

export default CheckoutModal;
