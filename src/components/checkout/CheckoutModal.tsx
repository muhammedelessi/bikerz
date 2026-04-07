import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import type { CheckoutCourse } from "@/types/payment";

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: CheckoutCourse;
  onSuccess: () => void;
  onPaymentStarted?: () => void;
  vatPct?: number;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  open,
  onOpenChange,
  course,
  onSuccess,
  onPaymentStarted,
  vatPct: vatPctProp,
}) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { getCoursePriceInfo, getCurrencySymbol, convertPrice, isSAR, exchangeRate } = useCurrency();
  const { sendCourseStatus } = useGHLFormWebhook();
  const { handleGuestSignup, guestSigningUp } = useGuestSignup();

  const [step] = useState<"payment">("payment");

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

  const discountAmount = promo.appliedCoupon ? promo.appliedCoupon.discount_amount : 0;
  const discountedPrice = promo.appliedCoupon ? promo.appliedCoupon.final_amount : basePrice;
  const discountLabel = promo.appliedCoupon
    ? promo.appliedCoupon.discount_type === "percentage"
      ? `${promo.appliedCoupon.discount_value}%`
      : `${promo.appliedCoupon.discount_value} ${currSym}`
    : "";

  const formatLocal = useCallback((amount: number) => `${amount} ${currSym}`, [currSym]);

  useEffect(() => {
    if (!open) {
      promo.resetPromo();
      tap.reset();
      form.resetForm();
      return;
    }
    if (user) {
      form.prefillAndAutoAdvance();
    }
  }, [open, user]);

  const handleNextStep = useCallback(() => {
    if (!form.validateInfo()) return;
    form.saveProfileData();
    setStep("payment");
  }, [form]);

  const handleSubmitPayment = useCallback(async () => {
    if (!user) {
      toast.error(t("checkout.loginRequired", "Please log in to proceed"));
      return;
    }

    onPaymentStarted?.();

    const composedAddress = [form.effectiveCity, form.effectiveCountry].filter(Boolean).join(", ");

    // Free enrollment (100% coupon)
    if (discountedPrice === 0 && promo.appliedCoupon) {
      try {
        await enrollUserInCourse(user.id, course.id);
        if (promo.appliedCoupon) {
          await incrementCouponUsage({
            couponId: promo.appliedCoupon.coupon_id,
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
    const localCurrency = priceInfo.currency as string;

    let paymentCurrency: string;
    let paymentAmount: number;

    if (TAP_SUPPORTED.includes(localCurrency)) {
      // Pay in local currency directly
      paymentCurrency = localCurrency;
      paymentAmount = discountedPrice;
    } else {
      // Unsupported currency → convert to SAR
      paymentCurrency = "SAR";
      paymentAmount = isSAR || exchangeRate <= 0 ? discountedPrice : Math.ceil(discountedPrice / exchangeRate);
    }

    sendCourseStatus(user.id, course.id, course.title, "pending", {
      full_name: form.fullName,
      email: form.email,
      phone: form.fullPhone,
      country: form.effectiveCountry,
      city: form.effectiveCity,
      address: composedAddress,
      amount: String(paymentAmount),
      dateOfBirth: profile?.date_of_birth || "",
      gender: profile?.gender || "",
      silent: true,
    });

    const courseDisplayName = isRTL && course.title_ar ? course.title_ar : course.title;

    await tap.submitPayment({
      courseId: course.id,
      currency: paymentCurrency,
      customerName: form.fullName,
      customerEmail: form.email,
      customerPhone: form.fullPhone,
      couponId: promo.appliedCoupon?.coupon_id,
      amount: paymentAmount,
      courseName: courseDisplayName,
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden border-2 border-border bg-card p-0 gap-0">
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
                appliedCoupon={promo.appliedCoupon}
                handleApplyPromo={promo.handleApplyPromo}
                clearPromo={promo.clearPromo}
                discountLabel={discountLabel}
                discountAmount={discountAmount}
                discountedPrice={discountedPrice}
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
                vatPct={vatPct}
                onSubmitPayment={handleSubmitPayment}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))] border-t-2 border-border flex-shrink-0 flex gap-2">
          {step === "payment" && (
            <Button variant="outline" onClick={() => setStep("info")} className="flex-shrink-0">
              <BackArrowIcon className="w-4 h-4" />
            </Button>
          )}
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
          ) : discountedPrice <= 0 && promo.appliedCoupon ? (
            <Button
              className="flex-1"
              variant="cta"
              onClick={handleSubmitPayment}
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
                  {isRTL ? "ادفع الآن" : "Pay Now"}
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
