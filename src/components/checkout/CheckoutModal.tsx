import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useTapPayment } from '@/hooks/useTapPayment';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  CreditCard,
  Gift,
  Shield,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: {
    id: string;
    title: string;
    title_ar: string | null;
    price: number;
    thumbnail_url: string | null;
  };
  onSuccess: () => void;
}

type CheckoutStep = 'info' | 'payment' | 'result';

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  open,
  onOpenChange,
  course,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, profile } = useAuth();
  const {
    status: paymentStatus,
    error: paymentError,
    publicKey,
    isReady,
    initializeCard,
    submitPayment,
    reset: resetPayment,
  } = useTapPayment();

  const [step, setStep] = useState<CheckoutStep>('info');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    coupon_id: string;
    discount_type: string;
    discount_value: number;
    discount_amount: number;
    final_amount: number;
  } | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const cardInitializedRef = useRef(false);

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const discountedPrice = appliedCoupon ? appliedCoupon.final_amount : course.price;
  const discountAmount = appliedCoupon ? appliedCoupon.discount_amount : 0;
  const discountLabel = appliedCoupon
    ? appliedCoupon.discount_type === 'percentage_discount'
      ? `-${appliedCoupon.discount_value}%`
      : `-${appliedCoupon.discount_amount} SAR`
    : '';

  // Pre-fill customer info
  useEffect(() => {
    if (profile?.full_name) setCustomerName(profile.full_name);
    if (user?.email) setCustomerEmail(user.email);
    if (profile?.phone) setCustomerPhone(profile.phone);
  }, [profile, user]);

  // Auto-apply PROFILE10 coupon from profile completion
  useEffect(() => {
    if (!open) return;
    const savedCoupon = localStorage.getItem('profile_coupon_code');
    if (savedCoupon && !promoApplied && !promoCode) {
      setPromoCode(savedCoupon);
      // Auto-trigger validation
      const autoApply = async () => {
        setPromoLoading(true);
        try {
          const { data, error } = await supabase.functions.invoke('coupon-validate', {
            body: { code: savedCoupon, course_id: course.id, amount: course.price },
          });
          if (error) throw error;
          if (data?.valid) {
            setPromoApplied(true);
            setAppliedCoupon(data);
            toast.success(isRTL ? 'تم تطبيق خصم إكمال الملف الشخصي تلقائياً!' : 'Profile completion discount auto-applied!');
            localStorage.removeItem('profile_coupon_code');
          }
        } catch {
          // Silently fail auto-apply
        } finally {
          setPromoLoading(false);
        }
      };
      autoApply();
    }
  }, [open]);

  // Initialize Tap Card SDK when moving to payment step
  useEffect(() => {
    if (step === 'payment' && publicKey && !cardInitializedRef.current) {
      // Wait for DOM element to be rendered
      const timer = setTimeout(() => {
        const container = document.getElementById('tap-card-container');
        if (container) {
          console.log('[Checkout] Initializing card SDK...');
          initializeCard('tap-card-container');
          cardInitializedRef.current = true;
        } else {
          console.error('[Checkout] Card container not found in DOM');
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [step, publicKey, initializeCard]);

  // Handle payment status changes
  useEffect(() => {
    if (paymentStatus === 'succeeded') {
      setStep('result');
      onSuccess();
    } else if (paymentStatus === 'failed') {
      setStep('result');
    }
  }, [paymentStatus, onSuccess]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep('info');
      setPromoCode('');
      setPromoApplied(false);
      setAppliedCoupon(null);
      setPromoLoading(false);
      cardInitializedRef.current = false;
      resetPayment();
    }
  }, [open, resetPayment]);

  const handleApplyPromo = async () => {
    if (!promoCode.trim() || promoLoading) return;
    setPromoLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('coupon-validate', {
        body: { code: promoCode.trim(), course_id: course.id, amount: course.price },
      });
      if (error) throw error;
      if (data?.valid) {
        setPromoApplied(true);
        setAppliedCoupon(data);
        toast.success(isRTL ? 'تم تطبيق الخصم بنجاح!' : 'Discount applied successfully!');
      } else {
        toast.error(data?.error || (isRTL ? 'رمز الخصم غير صالح' : 'Invalid promo code'));
      }
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'فشل التحقق من الرمز' : 'Failed to validate code'));
    } finally {
      setPromoLoading(false);
    }
  };

  const handleProceedToPayment = () => {
    if (!customerName.trim() || !customerEmail.trim()) {
      toast.error(isRTL ? 'يرجى ملء الحقول المطلوبة' : 'Please fill in the required fields');
      return;
    }
    setStep('payment');
  };

  const handleSubmitPayment = async () => {
    await submitPayment({
      courseId: course.id,
      amount: discountedPrice,
      currency: 'SAR',
      customerName,
      customerEmail,
      couponId: appliedCoupon?.coupon_id,
      customerPhone,
    });
  };

  const handleClose = () => {
    if (paymentStatus === 'processing' || paymentStatus === 'tokenizing') {
      return; // Don't close during processing
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] bg-card border-2 border-border shadow-2xl p-0 overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="bg-muted/30 p-4 sm:p-6 border-b-2 border-border flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {isRTL ? 'إتمام الشراء' : 'Complete Purchase'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-4 mt-4">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              {course.thumbnail_url ? (
                <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-primary" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {isRTL && course.title_ar ? course.title_ar : course.title}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                {promoApplied && (
                  <span className="text-sm text-muted-foreground line-through">
                    {course.price} {isRTL ? 'ر.س' : 'SAR'}
                  </span>
                )}
                <span className="text-lg font-bold text-primary">
                  {discountedPrice} {isRTL ? 'ر.س' : 'SAR'}
                </span>
                {promoApplied && discountLabel && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">{discountLabel}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-4 px-6 border-b border-border/50">
          {['info', 'payment', 'result'].map((s, index) => {
            const stepIndex = ['info', 'payment', 'result'].indexOf(step);
            const isActive = index <= stepIndex;
            const isCurrent = s === step;
            return (
              <React.Fragment key={s}>
                {index > 0 && (
                  <div className={`h-0.5 w-8 ${isActive ? 'bg-primary' : 'bg-border'}`} />
                )}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : isActive
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isActive && !isCurrent ? <Check className="w-4 h-4" /> : index + 1}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          <AnimatePresence mode="wait">
            {/* Step 1: Customer Info & Promo */}
            {step === 'info' && (
              <motion.div
                key="info"
                initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <h4 className="font-semibold text-foreground">
                  {isRTL ? 'معلومات الدفع' : 'Payment Information'}
                </h4>

                <div className="space-y-2">
                  <Label>{isRTL ? 'الاسم الكامل' : 'Full Name'} *</Label>
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={isRTL ? 'أدخل اسمك الكامل' : 'Enter your full name'}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{isRTL ? 'البريد الإلكتروني' : 'Email'} *</Label>
                  <Input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder={isRTL ? 'أدخل بريدك الإلكتروني' : 'Enter your email'}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{isRTL ? 'رقم الهاتف' : 'Phone Number'}</Label>
                  <Input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder={isRTL ? '05xxxxxxxx' : '05xxxxxxxx'}
                  />
                </div>

                {/* Promo Code */}
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    <Gift className="w-4 h-4 inline-block me-2" />
                    {isRTL ? 'رمز الخصم' : 'Promo Code'}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder={isRTL ? 'أدخل رمز الخصم' : 'Enter promo code'}
                      disabled={promoApplied}
                      className="flex-1"
                    />
                    <Button variant="outline" onClick={handleApplyPromo} disabled={!promoCode || promoApplied}>
                      {promoApplied ? (isRTL ? 'مطبق' : 'Applied') : (isRTL ? 'تطبيق' : 'Apply')}
                    </Button>
                  </div>
                  {promoApplied && appliedCoupon && (
                    <p className="text-sm text-primary flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      {isRTL 
                        ? `تم تطبيق خصم ${discountLabel} (وفّرت ${discountAmount} ر.س)` 
                        : `${discountLabel} discount applied (saved ${discountAmount} SAR)`}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 2: Embedded Card Payment */}
            {step === 'payment' && (
              <motion.div
                key="payment"
                initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <h4 className="font-semibold text-foreground">
                  {isRTL ? 'ادخل بيانات البطاقة' : 'Enter Card Details'}
                </h4>

                {/* Tap Card SDK container */}
                <div className="min-h-[200px] rounded-xl border border-border bg-background p-4">
                  {paymentStatus === 'loading_sdk' && (
                    <div className="flex items-center justify-center h-40">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="ms-2 text-muted-foreground">
                        {isRTL ? 'جاري تحميل نموذج الدفع...' : 'Loading payment form...'}
                      </span>
                    </div>
                  )}
                  <div
                    id="tap-card-container"
                    ref={cardContainerRef}
                    className={paymentStatus === 'loading_sdk' ? 'hidden' : ''}
                  />
                </div>

                {paymentError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{paymentError}</span>
                  </div>
                )}

                {/* Order summary */}
                <div className="p-4 rounded-xl bg-muted/30 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{isRTL ? 'الدورة' : 'Course'}</span>
                    <span className="font-medium truncate max-w-[200px]">
                      {isRTL && course.title_ar ? course.title_ar : course.title}
                    </span>
                  </div>
                  {promoApplied && appliedCoupon && (
                    <div className="flex justify-between text-sm text-primary">
                      <span>{isRTL ? 'الخصم' : 'Discount'} ({discountLabel})</span>
                      <span>-{discountAmount} {isRTL ? 'ر.س' : 'SAR'}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>{isRTL ? 'الإجمالي' : 'Total'}</span>
                    <span className="text-primary">{discountedPrice} {isRTL ? 'ر.س' : 'SAR'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                  <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>
                    {isRTL
                      ? 'مدفوعاتك آمنة ومشفرة عبر Tap Payments'
                      : 'Your payment is secure and encrypted via Tap Payments'}
                  </span>
                </div>
              </motion.div>
            )}

            {/* Step 3: Result */}
            {step === 'result' && (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center py-8 text-center"
              >
                {paymentStatus === 'succeeded' ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                    <h4 className="text-xl font-bold text-foreground mb-2">
                      {isRTL ? 'تم الدفع بنجاح!' : 'Payment Successful!'}
                    </h4>
                    <p className="text-muted-foreground">
                      {isRTL
                        ? 'تم تسجيلك في الدورة. يمكنك البدء بالتعلم الآن.'
                        : 'You are now enrolled. You can start learning now.'}
                    </p>
                  </>
                ) : paymentStatus === 'processing' ? (
                  <>
                    <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                    <h4 className="text-xl font-bold text-foreground mb-2">
                      {isRTL ? 'جاري معالجة الدفع...' : 'Processing Payment...'}
                    </h4>
                    <p className="text-muted-foreground">
                      {isRTL ? 'يرجى الانتظار...' : 'Please wait...'}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                      <XCircle className="w-8 h-8 text-destructive" />
                    </div>
                    <h4 className="text-xl font-bold text-foreground mb-2">
                      {isRTL ? 'فشل الدفع' : 'Payment Failed'}
                    </h4>
                    <p className="text-muted-foreground mb-4">
                      {paymentError || (isRTL ? 'حدث خطأ أثناء الدفع. يرجى المحاولة مرة أخرى.' : 'An error occurred. Please try again.')}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        cardInitializedRef.current = false;
                        resetPayment();
                        setStep('payment');
                      }}
                    >
                      {isRTL ? 'حاول مرة أخرى' : 'Try Again'}
                    </Button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {step !== 'result' && (
          <div className="p-4 sm:p-6 border-t-2 border-border flex-shrink-0">
            <div className="flex gap-3">
              {step === 'payment' && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    cardInitializedRef.current = false;
                    setStep('info');
                  }}
                  disabled={paymentStatus === 'processing' || paymentStatus === 'tokenizing'}
                >
                  {isRTL ? 'رجوع' : 'Back'}
                </Button>
              )}

              {step === 'info' && (
                <Button className="flex-1" variant="cta" onClick={handleProceedToPayment}>
                  {isRTL ? 'متابعة للدفع' : 'Proceed to Payment'}
                  <ArrowIcon className="w-4 h-4 ms-2" />
                </Button>
              )}

              {step === 'payment' && (
                <Button
                  className="flex-1"
                  variant="cta"
                  onClick={handleSubmitPayment}
                  disabled={
                    !isReady ||
                    paymentStatus === 'processing' ||
                    paymentStatus === 'tokenizing'
                  }
                >
                  {paymentStatus === 'tokenizing' || paymentStatus === 'processing' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin me-2" />
                      {isRTL ? 'جاري المعالجة...' : 'Processing...'}
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 me-2" />
                      {isRTL ? `ادفع ${discountedPrice} ر.س` : `Pay ${discountedPrice} SAR`}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Close button for result step */}
        {step === 'result' && paymentStatus !== 'processing' && (
          <div className="p-4 sm:p-6 border-t-2 border-border flex-shrink-0">
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              {paymentStatus === 'succeeded'
                ? (isRTL ? 'ابدأ التعلم' : 'Start Learning')
                : (isRTL ? 'إغلاق' : 'Close')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutModal;
