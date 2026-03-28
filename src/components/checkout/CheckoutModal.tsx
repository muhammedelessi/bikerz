import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTapPayment } from '@/hooks/useTapPayment';
import { useGHLFormWebhook } from '@/hooks/useGHLFormWebhook';
import { useCheckoutForm } from '@/hooks/checkout/useCheckoutForm';
import { useCheckoutPromo } from '@/hooks/checkout/useCheckoutPromo';
import { useGuestSignup } from '@/hooks/checkout/useGuestSignup';
import { enrollUserInCourse, incrementCouponUsage } from '@/services/supabase.service';
import { AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  CreditCard,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { trackInitiateCheckout, trackAddPaymentInfo } from '@/utils/metaPixel';
import CheckoutStatusOverlay from '@/components/checkout/CheckoutStatusOverlay';
import CheckoutInfoStep from '@/components/checkout/CheckoutInfoStep';
import CheckoutPaymentStep from '@/components/checkout/CheckoutPaymentStep';
import type { CheckoutCourse } from '@/types/payment';

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: CheckoutCourse;
  onSuccess: () => void;
  onPaymentStarted?: () => void;
}

type CheckoutStep = 'info' | 'payment';
const CHECKOUT_STEPS_DISPLAY: CheckoutStep[] = ['info', 'payment'];

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  open,
  onOpenChange,
  course,
  onSuccess,
  onPaymentStarted,
}) => {
  const { isRTL } = useLanguage();
  const { symbol, symbolAr, getCoursePriceInfo, getCourseCurrency } = useCurrency();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const {
    status: paymentStatus,
    error: paymentError,
    submitPayment,
    reset: resetPayment,
  } = useTapPayment();
  const { sendCourseStatus } = useGHLFormWebhook();
  const { guestSigningUp, handleGuestSignup } = useGuestSignup();

  const currencyLabel = isRTL ? symbolAr : symbol;
  const formatLocal = useCallback((amount: number) => `${amount} ${currencyLabel}`, [currencyLabel]);

  const [currentStep, setCurrentStep] = useState<CheckoutStep>('info');
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);

  // Price info
  const priceInfo = getCoursePriceInfo(course.id, course.price, course.discount_percentage || 0);
  const basePrice = priceInfo.finalPrice;

  // Form hook
  const form = useCheckoutForm(open);

  // Promo hook
  const promo = useCheckoutPromo(course.id, basePrice);
  const discountedPrice = promo.appliedCoupon ? promo.appliedCoupon.final_amount : basePrice;
  const discountAmount = promo.appliedCoupon ? promo.appliedCoupon.discount_amount : 0;
  const discountLabel = promo.appliedCoupon
    ? promo.appliedCoupon.discount_type === 'percentage_discount'
      ? `-${promo.appliedCoupon.discount_value}%`
      : `-${formatLocal(promo.appliedCoupon.discount_amount)}`
    : '';

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const BackArrowIcon = isRTL ? ArrowRight : ArrowLeft;
  const isPaymentReady = form.isInfoValid;

  // Pre-fill and auto-advance on open
  useEffect(() => {
    if (!open || !user) return;
    const run = async () => {
      const shouldAutoAdvance = await form.prefillAndAutoAdvance();
      if (shouldAutoAdvance) {
        setCurrentStep('payment');
      }
    };
    run();
  }, [open, user]);

  // Auto-apply saved coupon
  useEffect(() => {
    if (!open) return;
    promo.autoApplySavedCoupon();
  }, [open]);

  // iOS keyboard-safe viewport for mobile checkout
  useEffect(() => {
    if (!open || !isIOS || typeof window === 'undefined' || !window.visualViewport) {
      setKeyboardOffset(0);
      return;
    }

    const viewport = window.visualViewport;
    const updateKeyboardOffset = () => {
      const offset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardOffset(offset);
    };

    updateKeyboardOffset();
    viewport.addEventListener('resize', updateKeyboardOffset);
    viewport.addEventListener('scroll', updateKeyboardOffset);

    return () => {
      viewport.removeEventListener('resize', updateKeyboardOffset);
      viewport.removeEventListener('scroll', updateKeyboardOffset);
      setKeyboardOffset(0);
    };
  }, [open, isIOS]);

  // Meta Pixel: InitiateCheckout
  useEffect(() => {
    if (open && course) {
      trackInitiateCheckout({
        content_name: course.title,
        content_ids: [course.id],
        value: course.price,
        currency: 'SAR',
        num_items: 1,
      });
    }
  }, [open, course]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setCurrentStep('info');
      promo.resetPromo();
      form.resetForm();
      resetPayment();
    }
  }, [open, resetPayment]);

  const handleNextStep = useCallback(async () => {
    if (currentStep === 'info') {
      if (!form.validateInfo()) return;
      if (user) {
        const saved = await form.saveProfileData();
        if (!saved) {
          toast.error(isRTL ? 'فشل حفظ البيانات' : 'Failed to save profile data');
          return;
        }
      }
      setCurrentStep('payment');
    }
  }, [currentStep, form, user, isRTL]);

  const handlePrevStep = useCallback(() => {
    if (currentStep === 'payment') setCurrentStep('info');
  }, [currentStep]);

  const handleSubmitPayment = useCallback(async (tokenId?: string) => {
    if (!isPaymentReady) return;
    onPaymentStarted?.();

    const composedAddress = [form.effectiveCity, form.effectiveCountry, form.postalCode].filter(Boolean).join(', ');

    let currentUserId = user?.id;
    if (!currentUserId) {
      const newUserId = await handleGuestSignup(form.email, form.fullName, {
        phone: form.fullPhone,
        city: form.effectiveCity,
        country: form.effectiveCountry,
        postalCode: form.postalCode,
      });
      if (!newUserId) return;
      currentUserId = newUserId;
    }

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

        sendCourseStatus(currentUserId, course.id, course.title, 'purchased', {
          full_name: form.fullName,
          email: form.email,
          phone: form.fullPhone,
          city: form.effectiveCity,
          country: form.effectiveCountry,
          address: composedAddress,
          amount: '0',
          dateOfBirth: profile?.date_of_birth || '',
          gender: profile?.gender || '',
          isRTL,
          silent: true,
        });

        toast.success(isRTL ? 'تم التسجيل بنجاح! الدورة مجانية بالكامل' : 'Enrolled successfully! Course is fully free');
        onSuccess();
        onOpenChange(false);
      } catch (err: any) {
        toast.error(err.message || (isRTL ? 'فشل التسجيل' : 'Enrollment failed'));
      }
      return;
    }

    trackAddPaymentInfo({
      content_ids: [course.id],
      value: discountedPrice,
      currency: 'SAR',
    });

    sendCourseStatus(currentUserId, course.id, course.title, 'pending', {
      full_name: form.fullName,
      email: form.email,
      phone: form.fullPhone,
      city: form.effectiveCity,
      country: form.effectiveCountry,
      address: composedAddress,
      amount: String(discountedPrice),
      dateOfBirth: profile?.date_of_birth || '',
      gender: profile?.gender || '',
      isRTL,
      silent: true,
    });

    await submitPayment({
      courseId: course.id,
      currency: 'SAR',
      customerName: form.fullName,
      customerEmail: form.email,
      couponId: promo.appliedCoupon?.coupon_id,
      customerPhone: form.fullPhone,
      paymentMethod: 'card',
      tokenId: tokenId || undefined,
    });
  }, [
    isPaymentReady, user, form, promo, course, basePrice, discountedPrice,
    isRTL, profile, onPaymentStarted, onSuccess, onOpenChange,
    handleGuestSignup, resetPayment, submitPayment, sendCourseStatus,
  ]);

  const handleClose = useCallback(() => {
    if (paymentStatus === 'processing' || paymentStatus === 'verifying') return;
    onOpenChange(false);
  }, [paymentStatus, onOpenChange]);

  const currentStepIndex = CHECKOUT_STEPS_DISPLAY.indexOf(currentStep);
  const progressPercent = currentStepIndex >= 0 ? ((currentStepIndex + 1) / CHECKOUT_STEPS_DISPLAY.length) * 100 : 0;

  const stepLabels: Record<CheckoutStep, { en: string; ar: string }> = {
    info: { en: 'Personal Info', ar: 'المعلومات الشخصية' },
    payment: { en: 'Payment', ar: 'الدفع' },
  };

  const isStatusOverlay = paymentStatus === 'verifying' || paymentStatus === 'succeeded' || paymentStatus === 'failed';
  const modalHeight = isIOS && keyboardOffset > 0 ? `calc(100dvh - ${keyboardOffset}px)` : '100dvh';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-[520px] w-full max-w-full h-[100svh] sm:h-auto max-h-[100svh] sm:max-h-[92vh] bg-card border-0 sm:border-2 sm:border-border shadow-2xl p-0 overflow-hidden flex flex-col !rounded-none sm:!rounded-lg !left-0 !top-0 !translate-x-0 !translate-y-0 sm:!left-[50%] sm:!top-[50%] sm:!-translate-x-1/2 sm:!-translate-y-1/2 gap-0"
        style={!isStatusOverlay ? { height: modalHeight, maxHeight: modalHeight } : undefined}
      >
        {/* Header */}
        <div className="bg-muted/30 p-4 sm:p-5 border-b-2 border-border flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {isRTL ? 'إتمام الشراء' : 'Complete Purchase'}
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
                <span className="text-base font-bold text-primary">
                  {formatLocal(discountedPrice)}
                </span>
                {promo.promoApplied && discountLabel && (
                  <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">{discountLabel}</span>
                )}
              </div>
            </div>
          </div>

          {/* Step indicator */}
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              {CHECKOUT_STEPS_DISPLAY.map((step, i) => (
                <span
                  key={step}
                  className={`flex items-center gap-1 ${
                    i <= currentStepIndex ? 'text-primary font-medium' : ''
                  }`}
                >
                  {i < currentStepIndex ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : i === currentStepIndex ? (
                    <span className="w-3.5 h-3.5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                      {i + 1}
                    </span>
                  ) : (
                    <span className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 text-[10px] flex items-center justify-center">
                      {i + 1}
                    </span>
                  )}
                  {isRTL ? stepLabels[step].ar : stepLabels[step].en}
                </span>
              ))}
            </div>
            <Progress value={progressPercent} className="h-1.5" />
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
            onRetry={() => { resetPayment(); setCurrentStep('payment'); }}
            navigate={navigate}
          />

          {!isStatusOverlay && (
            <AnimatePresence mode="wait">
              {currentStep === 'info' && (
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
              )}

              {currentStep === 'payment' && (
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
                  paymentStatus={paymentStatus}
                  guestSigningUp={guestSigningUp}
                  isPaymentReady={isPaymentReady}
                  onSubmitPayment={handleSubmitPayment}
                />
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Footer */}
        {!isStatusOverlay && (
          <div className="p-4 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-5 border-t-2 border-border flex-shrink-0 space-y-2">
            <div className="flex gap-2">
              {currentStep !== 'info' && (
                <Button
                  variant="outline"
                  onClick={handlePrevStep}
                  disabled={paymentStatus === 'processing' || form.profileSaving}
                  className="flex-shrink-0"
                >
                  <BackArrowIcon className="w-4 h-4" />
                </Button>
              )}

              {currentStep === 'info' ? (
                <Button
                  className="flex-1 btn-cta"
                  onClick={handleNextStep}
                  disabled={form.profileSaving || !form.isInfoValid}
                >
                  {form.profileSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin me-2" />
                  ) : null}
                  {isRTL ? 'حفظ والمتابعة' : 'Save & Continue'}
                  <ArrowIcon className="w-4 h-4 ms-2" />
                </Button>
              ) : discountedPrice <= 0 && promo.appliedCoupon ? (
                <Button
                  className="flex-1"
                  variant="cta"
                  onClick={handleSubmitPayment}
                  disabled={paymentStatus === 'processing' || !isPaymentReady}
                >
                  {paymentStatus === 'processing' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin me-2" />
                      {isRTL ? 'جاري التسجيل...' : 'Enrolling...'}
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 me-2" />
                      {isRTL ? 'سجّل مجاناً' : 'Enroll for Free'}
                    </>
                  )}
                </Button>
              ) : null}
            </div>
          </div>
        )}

        {/* Close for failed */}
        {paymentStatus === 'failed' && (
          <div className="p-4 sm:p-5 border-t-2 border-border flex-shrink-0">
            <Button className="w-full" variant="outline" onClick={() => onOpenChange(false)}>
              {isRTL ? 'إغلاق' : 'Close'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutModal;
