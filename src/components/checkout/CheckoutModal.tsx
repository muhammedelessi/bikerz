import React, { memo, useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
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
}

const CheckoutModal: React.FC<CheckoutModalProps> = memo(({
  open,
  onOpenChange,
  course,
  onSuccess,
  onPaymentStarted,
}) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { getCoursePriceInfo, getCurrencySymbol, convertPrice, isSAR } = useCurrency();
  const { sendCourseStatus } = useGHLFormWebhook();
  const { handleGuestSignup, guestSigningUp } = useGuestSignup();

  const [step, setStep] = useState<"info" | "payment">("info");

  const priceInfo = useMemo(
    () => getCoursePriceInfo(course.id, course.price, course.discount_percentage || 0),
    [course.id, course.price, course.discount_percentage, getCoursePriceInfo],
  );

  const basePrice = priceInfo.finalPrice;
  const currSym = getCurrencySymbol(priceInfo.currency, isRTL);

  const form = useCheckoutForm(open);
  const promo = useCheckoutPromo(course.id, basePrice);
  const tap = useTapPayment();

  // Compute discount values from promo
  const discountAmount = promo.appliedCoupon ? promo.appliedCoupon.discount_amount : 0;
  const discountedPrice = promo.appliedCoupon ? promo.appliedCoupon.final_amount : basePrice;
  const discountLabel = promo.appliedCoupon
    ? promo.appliedCoupon.discount_type === "percentage"
      ? `${promo.appliedCoupon.discount_value}%`
      : `${promo.appliedCoupon.discount_value} ${currSym}`
    : "";

  const formatLocal = useCallback(
    (amount: number) => `${amount} ${currSym}`,
    [currSym],
  );

  // Auto prefill and advance
  useEffect(() => {
    if (!open) {
      setStep("info");
      promo.resetPromo();
      tap.reset();
      form.resetForm();
      return;
    }
    if (user) {
      form.prefillAndAutoAdvance().then((canSkip) => {
        if (canSkip) setStep("payment");
      });
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
        // Send GHL webhook
        sendCourseStatus(user.id, course.id, course.title, "purchased", {
          full_name: form.fullName,
          email: form.email,
          phone: form.fullPhone,
          country: form.effectiveCountry,
          city: form.effectiveCity,
          address: [form.effectiveCity, form.effectiveCountry].filter(Boolean).join(", "),
          amount: "0",
          dateOfBirth: "",
          gender: "",
          silent: true,
        });
        onSuccess();
      } catch (err: any) {
        toast.error(err.message || "Enrollment failed");
      }
      return;
    }

    // Calculate SAR amount for Tap — discountedPrice is in local currency
    let sarAmount: number;
    if (priceInfo.isCountryPrice) {
      // Country has custom pricing — convert local price back to SAR
      sarAmount = Math.ceil(discountedPrice / convertPrice(1));
    } else {
      sarAmount = isSAR ? discountedPrice : Math.ceil(discountedPrice / convertPrice(1));
    }

    // Paid checkout via Tap
    await tap.submitPayment({
      courseId: course.id,
      currency: 'SAR',
      customerName: form.fullName,
      customerEmail: form.email,
      customerPhone: form.fullPhone,
      couponId: promo.appliedCoupon?.coupon_id,
      amount: sarAmount,
      courseName: course.title,
      isRTL,
    });
  }, [
    user, discountedPrice, promo.appliedCoupon, course, form, tap,
    basePrice, discountAmount, priceInfo, isRTL, isSAR, convertPrice,
    onSuccess, onPaymentStarted, sendCourseStatus, t,
  ]);

  // Handle tap payment success
  useEffect(() => {
    if (tap.status === "succeeded") {
      navigate(`/payment-success?course=${course.id}&tap_id=tap_success`);
    }
  }, [tap.status, course.id, navigate]);

  const isPaymentReady =
    form.isInfoValid && !tap.error && tap.status !== "processing" && tap.status !== "verifying";

  // Show status overlay for non-idle tap states
  if (tap.status !== "idle" && tap.status !== "succeeded") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <CheckoutStatusOverlay
            paymentStatus={tap.status}
            paymentError={tap.error}
            courseId={course.id}
            onSuccess={onSuccess}
            onOpenChange={onOpenChange}
            onRetry={() => tap.reset()}
            navigate={navigate}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden border-2 border-border bg-card">
        <DialogHeader className="flex-shrink-0 pb-2 border-b border-border">
          <DialogTitle className="text-lg font-bold">
            {step === "info"
              ? isRTL ? "معلومات الدفع" : "Billing Information"
              : isRTL ? "إتمام الشراء" : "Complete Purchase"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1 py-4 space-y-4">
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
                phone={form.phone}
                phonePrefix={form.phonePrefix}
                isOtherCountry={form.isOtherCountry}
                isOtherCity={form.isOtherCity}
                countryManual={form.countryManual}
                country={form.country}
                cityManual={form.cityManual}
                city={form.city}
                courseTitle={course.title}
                courseTitleAr={course.title_ar}
                paymentStatus={tap.status}
                guestSigningUp={guestSigningUp}
                isPaymentReady={isPaymentReady}
                onSubmitPayment={handleSubmitPayment}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Footer buttons */}
        <div className="flex-shrink-0 border-t border-border pt-3 flex gap-2">
          {step === "payment" && (
            <Button
              variant="outline"
              onClick={() => setStep("info")}
              className="gap-1"
            >
              {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
              {isRTL ? "رجوع" : "Back"}
            </Button>
          )}
          <Button
            className="flex-1"
            disabled={
              step === "info"
                ? !form.isInfoValid
                : !isPaymentReady || guestSigningUp
            }
            onClick={step === "info" ? handleNextStep : handleSubmitPayment}
          >
            {guestSigningUp && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
            {step === "info"
              ? isRTL ? "التالي" : "Next"
              : discountedPrice === 0
                ? isRTL ? "تسجيل مجاني" : "Enroll Free"
                : isRTL ? `ادفع ${formatLocal(discountedPrice)}` : `Pay ${formatLocal(discountedPrice)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});

CheckoutModal.displayName = "CheckoutModal";

export default CheckoutModal;
