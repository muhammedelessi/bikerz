import React, { useState, useEffect } from 'react';
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
    isReady,
    submitPayment,
    reset: resetPayment,
  } = useTapPayment();

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
      const autoApply = async () => {
        setPromoLoading(true);
        try {
          const { data, error } = await supabase.functions.invoke('coupon-validate', {
            body: { code: savedCoupon, course_id: course.id, amount: course.price },
          });
          if (!error && data?.valid) {
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

  // Reset on close
  useEffect(() => {
    if (!open) {
      setPromoCode('');
      setPromoApplied(false);
      setAppliedCoupon(null);
      setPromoLoading(false);
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
      // supabase.functions.invoke returns { data: null, error } for non-2xx responses
      // The error.context may contain the actual JSON response body
      if (error) {
        // Try to extract the error message from the response body
        let errorMsg = isRTL ? 'فشل التحقق من الرمز' : 'Failed to validate code';
        try {
          if (error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            errorMsg = body?.error || errorMsg;
          }
        } catch {}
        toast.error(errorMsg);
        return;
      }
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

  const handleSubmitPayment = async () => {
    if (!customerName.trim() || !customerEmail.trim()) {
      toast.error(isRTL ? 'يرجى ملء الحقول المطلوبة' : 'Please fill in required fields');
      return;
    }

    // If 100% discount, enroll directly without payment
    if (discountedPrice <= 0 && appliedCoupon) {
      try {
        resetPayment();
        // Insert enrollment directly
        const { error: enrollError } = await supabase
          .from('course_enrollments')
          .insert({ user_id: user!.id, course_id: course.id });

        if (enrollError && !enrollError.message.includes('duplicate')) {
          throw new Error(enrollError.message);
        }

        // Log coupon usage and increment counter
        await supabase.rpc('increment_coupon_usage', {
          p_coupon_id: appliedCoupon.coupon_id,
          p_user_id: user!.id,
          p_course_id: course.id,
          p_order_id: null,
          p_charge_id: null,
          p_discount_amount: appliedCoupon.discount_amount,
          p_original_amount: course.price,
          p_final_amount: 0,
        });

        toast.success(isRTL ? 'تم التسجيل بنجاح! الدورة مجانية بالكامل' : 'Enrolled successfully! Course is fully free');
        onSuccess();
        onOpenChange(false);
      } catch (err: any) {
        toast.error(err.message || (isRTL ? 'فشل التسجيل' : 'Enrollment failed'));
      }
      return;
    }

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
    if (paymentStatus === 'processing') return;
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

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          {paymentStatus === 'failed' ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-8 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
              <h4 className="text-xl font-bold text-foreground mb-2">
                {isRTL ? 'فشل الدفع' : 'Payment Failed'}
              </h4>
              <p className="text-muted-foreground mb-4">
                {paymentError || (isRTL ? 'حدث خطأ أثناء الدفع. يرجى المحاولة مرة أخرى.' : 'An error occurred. Please try again.')}
              </p>
              <Button variant="outline" onClick={() => resetPayment()}>
                {isRTL ? 'حاول مرة أخرى' : 'Try Again'}
              </Button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
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
                  disabled={paymentStatus === 'processing'}
                />
              </div>

              <div className="space-y-2">
                <Label>{isRTL ? 'البريد الإلكتروني' : 'Email'} *</Label>
                <Input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder={isRTL ? 'أدخل بريدك الإلكتروني' : 'Enter your email'}
                  disabled={paymentStatus === 'processing'}
                />
              </div>

              <div className="space-y-2">
                <Label>{isRTL ? 'رقم الهاتف' : 'Phone Number'}</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder={isRTL ? '05xxxxxxxx' : '05xxxxxxxx'}
                  disabled={paymentStatus === 'processing'}
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
                  <div className="relative flex-1">
                    <Input
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder={isRTL ? 'أدخل رمز الخصم' : 'Enter promo code'}
                      disabled={promoApplied || paymentStatus === 'processing'}
                      className="w-full pe-9"
                    />
                    {(promoCode && !promoApplied) && (
                      <button
                        type="button"
                        onClick={() => setPromoCode('')}
                        className="absolute end-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        aria-label={isRTL ? 'مسح' : 'Clear'}
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                    {promoApplied && (
                      <button
                        type="button"
                        onClick={() => {
                          setPromoCode('');
                          setPromoApplied(false);
                          setAppliedCoupon(null);
                        }}
                        className="absolute end-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        aria-label={isRTL ? 'إزالة الخصم' : 'Remove coupon'}
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <Button variant="outline" onClick={handleApplyPromo} disabled={!promoCode || promoApplied || paymentStatus === 'processing'}>
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

              {/* Order Summary */}
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
                    ? 'سيتم توجيهك إلى صفحة الدفع الآمنة لإدخال بيانات البطاقة'
                    : 'You will be redirected to a secure payment page to enter your card details'}
                </span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        {paymentStatus !== 'failed' && (
          <div className="p-4 sm:p-6 border-t-2 border-border flex-shrink-0">
            <Button
              className="w-full"
              variant="cta"
              onClick={handleSubmitPayment}
              disabled={paymentStatus === 'processing' || !customerName.trim() || !customerEmail.trim()}
            >
              {paymentStatus === 'processing' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                  {isRTL ? 'جاري التوجيه للدفع...' : 'Redirecting to payment...'}
                </>
              ) : discountedPrice <= 0 && appliedCoupon ? (
                <>
                  <Check className="w-4 h-4 me-2" />
                  {isRTL ? 'سجّل مجاناً' : 'Enroll for Free'}
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 me-2" />
                  {isRTL ? `ادفع ${discountedPrice} ر.س` : `Pay ${discountedPrice} SAR`}
                </>
              )}
            </Button>
          </div>
        )}

        {/* Close for failed */}
        {paymentStatus === 'failed' && (
          <div className="p-4 sm:p-6 border-t-2 border-border flex-shrink-0">
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
