import React, { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTapPayment } from "@/hooks/useTapPayment";
import { useGHLFormWebhook } from "@/hooks/useGHLFormWebhook";
import { useCheckoutForm } from "@/hooks/checkout/useCheckoutForm";
import { useCheckoutPromo } from "@/hooks/checkout/useCheckoutPromo";
import { enrollUserInCourse, incrementCouponUsage } from "@/services/supabase.service";
import { AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trackInitiateCheckout, trackAddPaymentInfo } from "@/utils/metaPixel";
import CheckoutStatusOverlay from "@/components/checkout/CheckoutStatusOverlay";
import CheckoutPaymentStep from "@/components/checkout/CheckoutPaymentStep";
import type { CheckoutCourse } from "@/types/payment";

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: CheckoutCourse;
  onSuccess: () => void;
  onPaymentStarted?: () => void;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ open, onOpenChange, course, onSuccess, onPaymentStarted }) => {
  const { isRTL } = useLanguage();
  const { symbol, symbolAr, getCoursePriceInfo } = useCurrency();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const { status: paymentStatus, error: paymentError, submitPayment, reset: resetPayment } = useTapPayment();
  const { sendCourseStatus } = useGHLFormWebhook();

  const currencyLabel = isRTL ? symbolAr : symbol;
  const formatLocal = useCallback((amount: number) => `${amount} ${currencyLabel}`, [currencyLabel]);

  const isIOS = typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const priceInfo = getCoursePriceInfo(course.id, course.price, course.discount_percentage || 0);
  const basePrice = priceInfo.finalPrice;

  const form = useCheckoutForm(open);
  const promo = useCheckoutPromo(course.id, basePrice);
  const discountedPrice = promo.appliedCoupon ? promo.appliedCoupon.final_amount : basePrice;
  const discountAmount = promo.appliedCoupon ? promo.appliedCoupon.discount_amount : 0;
  const discountLabel = promo.appliedCoupon
    ? promo.appliedCoupon.discount_type === "percentage_discount"
      ? `-${promo.appliedCoupon.discount_value}%`
      : `-${formatLocal(promo.appliedCoupon.discount_amount)}`
    : "";

  const isPaymentReady = form.isInfoValid;

  // Redirect to signup if not logged in
  useEffect(() => {
    if (open && !user) {
      onOpenChange(false);
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      navigate(`/signup?returnTo=${returnTo}`);
    }
  }, [open, user]);

  // Pre-fill billing data on open
  useEffect(() => {
    if (!open || !user) return;
    form.prefillAndAutoAdvance();
  }, [open, user]);

  // Auto-apply saved coupon
  useEffect(() => {
    if (!open) return;
    promo.autoApplySavedCoupon();
  }, [open]);

  // iOS keyboard offset
  useEffect(() => {
    if (!open || !isIOS || typeof window === "undefined" || !window.visualViewport) {
      setKeyboardOffset(0);
      return;
    }
    const viewport = window.visualViewport;
    const update = () => {
      setKeyboardOffset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      setKeyboardOffset(0);
    };
  }, [open, isIOS]);

  // Meta Pixel
  useEffect(() => {
    if (open && course) {
      trackInitiateCheckout({
        content_name: course.title,
        content_ids: [course.id],
        value: course.price,
        currency: "SAR",
        num_items: 1,
      });
    }
  }, [open, course]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      promo.resetPromo();
      form.resetForm();
      resetPayment();
    }
  }, [open, resetPayment]);

  const handleSubmitPayment = useCallback(async () => {
    if (!isPaymentReady) return;
    onPaymentStarted?.();

    const composedAddress = [form.effectiveCity, form.effectiveCountry, form.postalCode].filter(Boolean).join(", ");
    const currentUserId = user?.id;
    if (!currentUserId) {
      toast.error(isRTL ? "يجب تسجيل الدخول أولاً" : "Please sign in first");
      onOpenChange(false);
      navigate("/signup");
      return;
    }

    // Save profile data before payment
    await form.saveProfileData(currentUserId);

    // 100% discount → enroll directly
    if (discountedPrice <= 0 && promo.appliedCoupon) {
      try {
        resetPayment();
        await enrollUserInCourse(currentUserId, course.id);
        await incrementCouponUsage({
          couponId: promo.appliedCoupon.coupon_id,
          userId: currentUserId,
          courseId: course.id,
          discountAmount: promo.appliedCoupon.discount_amount,
          originalAmount: basePrice,
          finalAmount: 0,
        });
        sendCourseStatus(currentUserId, course.id, course.title, "purchased", {
          full_name: form.fullName,
          email: form.email,
          phone: form.fullPhone,
          city: form.effectiveCity,
          country: form.effectiveCountry,
          address: composedAddress,
          amount: "0",
          dateOfBirth: profile?.date_of_birth || "",
          gender: profile?.gender || "",
          isRTL,
          silent: true,
        });
        toast.success(
          isRTL ? "تم التسجيل بنجاح! الدورة مجانية بالكامل" : "Enrolled successfully! Course is fully free",
        );
        onSuccess();
        onOpenChange(false);
      } catch (err: any) {
        toast.error(err.message || (isRTL ? "فشل التسجيل" : "Enrollment failed"));
      }
      return;
    }

    trackAddPaymentInfo({
      content_ids: [course.id],
      value: discountedPrice,
      currency: "SAR",
    });

    sendCourseStatus(currentUserId, course.id, course.title, "pending", {
      full_name: form.fullName,
      email: form.email,
      phone: form.fullPhone,
      city: form.effectiveCity,
      country: form.effectiveCountry,
      address: composedAddress,
      amount: String(discountedPrice),
      dateOfBirth: profile?.date_of_birth || "",
      gender: profile?.gender || "",
      isRTL,
      silent: true,
    });

    const courseDisplayName = isRTL && course.title_ar ? course.title_ar : course.title;

    await submitPayment({
      courseId: course.id,
      currency: "SAR",
      customerName: form.fullName,
      customerEmail: form.email,
      couponId: promo.appliedCoupon?.coupon_id,
      customerPhone: form.fullPhone,
      paymentMethod: "card",
      amount: discountedPrice,
      courseName: courseDisplayName,
      isRTL,
    });
  }, [
    isPaymentReady,
    user,
    form,
    promo,
    course,
    basePrice,
    discountedPrice,
    isRTL,
    profile,
    onPaymentStarted,
    onSuccess,
    onOpenChange,
    resetPayment,
    submitPayment,
    sendCourseStatus,
    navigate,
  ]);

  const handleClose = useCallback(() => {
    if (paymentStatus === "processing" || paymentStatus === "verifying") return;
    onOpenChange(false);
  }, [paymentStatus, onOpenChange]);

  const isStatusOverlay = paymentStatus === "verifying" || paymentStatus === "succeeded" || paymentStatus === "failed";
  const modalHeight = isIOS && keyboardOffset > 0 ? `calc(100dvh - ${keyboardOffset}px)` : "100dvh";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-[520px] w-full max-w-full h-[100svh] sm:h-auto max-h-[100svh] sm:max-h-[92vh] bg-card border-0 sm:border-2 sm:border-border shadow-2xl p-0 overflow-hidden flex flex-col !rounded-none sm:!rounded-lg !left-0 !top-0 !translate-x-0 !translate-y-0 sm:!left-[50%] sm:!top-[50%] sm:!-translate-x-1/2 sm:!-translate-y-1/2 gap-0"
        style={!isStatusOverlay ? { height: modalHeight, maxHeight: modalHeight } : undefined}
      >
        {/* Header */}
        <div className="bg-muted/30 p-4 sm:p-5 border-b-2 border-border flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{isRTL ? "إتمام الشراء" : "Complete Purchase"}</DialogTitle>
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
          <CheckoutStatusOverlay
            paymentStatus={paymentStatus}
            paymentError={paymentError}
            courseId={course.id}
            onSuccess={onSuccess}
            onOpenChange={onOpenChange}
            onRetry={() => resetPayment()}
            navigate={navigate}
          />

          {!isStatusOverlay && (
            <AnimatePresence mode="wait">
              <CheckoutPaymentStep
                isRTL={isRTL}
                currencyLabel={currencyLabel}
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
                email={form.email}
                phone={form.phone}
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
                setPhone={form.setPhone}
                setFullName={form.setFullName}
                errors={form.errors}
                setErrors={form.setErrors}
                courseTitle={course.title}
                courseTitleAr={course.title_ar}
                paymentStatus={paymentStatus}
                isPaymentReady={isPaymentReady}
                onSubmitPayment={handleSubmitPayment}
              />
            </AnimatePresence>
          )}
        </div>

        {/* Footer */}
        {!isStatusOverlay && (
          <div className="p-4 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-5 border-t-2 border-border flex-shrink-0">
            {discountedPrice <= 0 && promo.appliedCoupon ? (
              <Button
                className="w-full"
                variant="cta"
                onClick={handleSubmitPayment}
                disabled={paymentStatus === "processing" || !isPaymentReady}
              >
                {paymentStatus === "processing" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin me-2" />
                    {isRTL ? "جاري التسجيل..." : "Enrolling..."}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 me-2" />
                    {isRTL ? "سجّل مجاناً" : "Enroll for Free"}
                  </>
                )}
              </Button>
            ) : (
              <Button
                className="w-full h-11 rounded-xl text-sm font-bold shadow-glow hover:shadow-glow-lg transition-all duration-300"
                variant="cta"
                onClick={handleSubmitPayment}
                disabled={paymentStatus === "processing" || !isPaymentReady}
              >
                {paymentStatus === "processing" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin me-2" />
                    <span>{isRTL ? "جاري تجهيز الدفع..." : "Preparing payment..."}</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 me-2" />
                    <span>
                      {isRTL
                        ? `ادفع الآن ${discountedPrice} ${currencyLabel}`
                        : `Pay Now ${discountedPrice} ${currencyLabel}`}
                    </span>
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {paymentStatus === "failed" && (
          <div className="p-4 sm:p-5 border-t-2 border-border flex-shrink-0">
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
