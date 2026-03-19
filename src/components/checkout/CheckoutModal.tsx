import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { COUNTRIES, OTHER_OPTION, type CountryEntry } from '@/data/countryCityData';
import SearchableDropdown from '@/components/checkout/SearchableDropdown';
import type { DropdownOption } from '@/components/checkout/SearchableDropdown';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useTapPayment, PaymentMethod } from '@/hooks/useTapPayment';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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
import { Progress } from '@/components/ui/progress';
import {
  CreditCard,
  Gift,
  Shield,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  XCircle,
  User,
  MapPin,
  
} from 'lucide-react';
import { toast } from 'sonner';
import { trackInitiateCheckout, trackAddPaymentInfo } from '@/utils/metaPixel';
import { useGHLFormWebhook } from '@/hooks/useGHLFormWebhook';
import { usePaymentMethodDetection } from '@/hooks/usePaymentMethodDetection';
import { ApplePayIcon, GooglePayIcon, VisaIcon, MastercardIcon } from '@/components/checkout/PaymentMethodIcons';

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: {
    id: string;
    title: string;
    title_ar: string | null;
    price: number;
    discount_percentage?: number | null;
    thumbnail_url: string | null;
  };
  onSuccess: () => void;
  onPaymentStarted?: () => void;
}

type CheckoutStep = 'profile' | 'billing' | 'payment';

const CHECKOUT_STEPS_DISPLAY: CheckoutStep[] = ['profile', 'billing', 'payment'];


interface ValidationErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  open,
  onOpenChange,
  course,
  onSuccess,
  onPaymentStarted,
}) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { currencyCode, symbol, symbolAr, convertPrice, formatPrice, calculateTax, calculateTotalWithTax, getSarTotalWithVat, vatLabel, vatLabelAr, isSAR, getCoursePriceInfo, getCourseCurrency } = useCurrency();
  
  // Helper: format an already-converted local price (no re-conversion)
  const courseCurrency = getCourseCurrency(course.id);
  const currencyLabel = isRTL ? symbolAr : symbol;
  const formatLocal = (amount: number) => `${amount} ${currencyLabel}`;
  const { user, profile, session } = useAuth();
  const navigate = useNavigate();
  const {
    status: paymentStatus,
    error: paymentError,
    isReady,
    submitPayment,
    reset: resetPayment,
  } = useTapPayment();
  const { sendCourseStatus } = useGHLFormWebhook();
  const { supportsApplePay, supportsGooglePay } = usePaymentMethodDetection();
  const [guestSigningUp, setGuestSigningUp] = useState(false);

  const [currentStep, setCurrentStep] = useState<CheckoutStep>('profile');
  
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

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [cityManual, setCityManual] = useState('');
  const [isOtherCity, setIsOtherCity] = useState(false);
  const [country, setCountry] = useState('');
  const [countryManual, setCountryManual] = useState('');
  const [isOtherCountry, setIsOtherCountry] = useState(false);
  const [selectedCountryCode, setSelectedCountryCode] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [profileSaving, setProfileSaving] = useState(false);

  const selectedCountry = useMemo(
    () => COUNTRIES.find(function (c) { return c.code === selectedCountryCode; }) || null,
    [selectedCountryCode]
  );

  const handleCountryChange = function (code: string) {
    if (code === '__other__') {
      setIsOtherCountry(true);
      setSelectedCountryCode('');
      setCountry('');
      setCountryManual('');
    } else {
      setIsOtherCountry(false);
      setSelectedCountryCode(code);
      setCountryManual('');
      var found = COUNTRIES.find(function (c) { return c.code === code; });
      if (found) {
        setCountry(isRTL ? found.ar : found.en);
      }
    }
    setCity('');
    setCityManual('');
    setIsOtherCity(false);
    setErrors(function (prev) { return Object.assign({}, prev, { country: undefined, city: undefined }); });
  };

  var handleCityChange = function (val: string) {
    if (val === '__other__') {
      setIsOtherCity(true);
      setCity('');
      setCityManual('');
    } else {
      setIsOtherCity(false);
      setCity(val);
      setCityManual('');
    }
    setErrors(function (prev) { return Object.assign({}, prev, { city: undefined }); });
  };

  var countryOptions = useMemo(function (): DropdownOption[] {
    var items = COUNTRIES.map(function (c) {
      return { value: c.code, label: isRTL ? c.ar : c.en };
    });
    items.push({ value: '__other__', label: isRTL ? OTHER_OPTION.ar : OTHER_OPTION.en });
    return items;
  }, [isRTL]);

  var cityOptions = useMemo(function (): DropdownOption[] {
    if (!selectedCountry) return [];
    var items = selectedCountry.cities.map(function (ct) {
      var label = isRTL ? ct.ar : ct.en;
      return { value: label, label: label };
    });
    items.push({ value: '__other__', label: isRTL ? OTHER_OPTION.ar : OTHER_OPTION.en });
    return items;
  }, [selectedCountry, isRTL]);

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const BackArrowIcon = isRTL ? ArrowRight : ArrowLeft;

  // Get full price info — country-specific price takes priority over SAR conversion
  const priceInfo = getCoursePriceInfo(course.id, course.price, course.discount_percentage || 0);

  // basePrice = final price after country or course discount (before coupon)
  const basePrice = priceInfo.finalPrice;

  // Then apply coupon discount on top of the already-discounted base price
  const discountedPrice = appliedCoupon ? appliedCoupon.final_amount : basePrice;
  const discountAmount = appliedCoupon ? appliedCoupon.discount_amount : 0;
  const discountLabel = appliedCoupon
    ? appliedCoupon.discount_type === 'percentage_discount'
      ? `-${appliedCoupon.discount_value}%`
      : `-${formatLocal(appliedCoupon.discount_amount)}`
    : '';

  // Pre-fill from profile (only for logged-in users)
  useEffect(() => {
    if (!open) return;
    if (!user) return; // Guest users fill the form themselves
    if (profile?.full_name) setFullName(profile.full_name);
    if (user?.email) setEmail(user.email);
    if (profile?.phone) setPhone(profile.phone || '');
    // Load billing and bike info from profile
    const loadProfileData = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('city, country, postal_code')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        if (data.city) setCity(data.city);
        if (data.country) setCountry(data.country);
        if (data.postal_code) setPostalCode(data.postal_code);
      }
    };
    loadProfileData();
  }, [profile, user, open]);

  // Auto-apply saved coupon
  useEffect(() => {
    if (!open) return;
    const savedCoupon = localStorage.getItem('profile_coupon_code');
    if (savedCoupon && !promoApplied && !promoCode) {
      setPromoCode(savedCoupon);
      const autoApply = async () => {
        setPromoLoading(true);
        try {
          const { data, error } = await supabase.functions.invoke('coupon-validate', {
            body: { code: savedCoupon, course_id: course.id, amount: basePrice },
          });
          if (!error && data?.valid) {
            setPromoApplied(true);
            setAppliedCoupon(data);
            toast.success(isRTL ? 'تم تطبيق الكوبون تلقائياً!' : 'Coupon auto-applied!');
            localStorage.removeItem('profile_coupon_code');
          }
        } catch {
          // Silently fail
        } finally {
          setPromoLoading(false);
        }
      };
      autoApply();
    }
  }, [open]);

  // Meta Pixel: InitiateCheckout when modal opens
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
      setCurrentStep('profile');
      setPromoCode('');
      setPromoApplied(false);
      setAppliedCoupon(null);
      setPromoLoading(false);
      setErrors({});
      resetPayment();
    }
  }, [open, resetPayment]);

  // Validation
  const validateProfile = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};
    if (!fullName.trim() || fullName.trim().length < 3) {
      newErrors.fullName = isRTL ? 'الاسم الكامل مطلوب (3 أحرف على الأقل)' : 'Full name required (min 3 chars)';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email)) {
      newErrors.email = isRTL ? 'بريد إلكتروني صحيح مطلوب' : 'Valid email required';
    }
    const phoneRegex = /^[0-9+\s()-]{7,15}$/;
    if (!phone.trim() || !phoneRegex.test(phone)) {
      newErrors.phone = isRTL ? 'رقم هاتف صحيح مطلوب' : 'Valid phone number required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [fullName, email, phone, isRTL]);

  const effectiveCity = isOtherCity ? cityManual.trim() : city.trim();
  const effectiveCountry = isOtherCountry ? countryManual.trim() : country.trim();

  const validateBilling = useCallback(function (): boolean {
    var newErrors: ValidationErrors = {};
    var c = isOtherCity ? cityManual.trim() : city.trim();
    if (!c) {
      newErrors.city = isRTL ? 'المدينة مطلوبة' : 'City is required';
    }
    var cn = isOtherCountry ? countryManual.trim() : country.trim();
    if (!cn) {
      newErrors.country = isRTL ? 'الدولة مطلوبة' : 'Country is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [city, cityManual, isOtherCity, country, countryManual, isOtherCountry, isRTL]);

  const isProfileValid = fullName.trim().length >= 3 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && /^[0-9+\s()-]{7,15}$/.test(phone);
  const isBillingValid = (isOtherCity ? cityManual.trim().length > 0 : city.trim().length > 0) && (isOtherCountry ? countryManual.trim().length > 0 : country.trim().length > 0);
  // For guest users, isReady won't be true yet - we'll handle signup before payment
  const isPaymentReady = isProfileValid && isBillingValid && (user ? isReady : true);

  // Save profile data to DB
  const saveProfileData = async (userId?: string) => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return false;
    setProfileSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          city: effectiveCity,
          country: effectiveCountry,
          postal_code: postalCode.trim() || null,
          profile_complete: true,
        })
        .eq('user_id', targetUserId);

      if (error) throw error;
      return true;
    } catch (err: any) {
      toast.error(isRTL ? 'فشل حفظ البيانات' : 'Failed to save profile data');
      return false;
    } finally {
      setProfileSaving(false);
    }
  };

  // Generate a random password for guest signup
  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, b => chars[b % chars.length]).join('');
  };

  // Auto-create account for guest users
  const handleGuestSignup = async (): Promise<string | null> => {
    setGuestSigningUp(true);
    try {
      const password = generatePassword();
      const { data, error } = await (supabase.auth as any).signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName.trim() },
        },
      });

      if (error) {
        // If user already exists, try signing in or prompt
        if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
          toast.error(isRTL 
            ? 'هذا البريد مسجل بالفعل. يرجى تسجيل الدخول أولاً.' 
            : 'This email is already registered. Please log in first.');
          return null;
        }
        throw error;
      }

      if (!data.user) {
        throw new Error('Account creation failed');
      }

      // Wait a moment for the profile trigger to create the profile row
      await new Promise(resolve => setTimeout(resolve, 500));

      // Save profile data using the new user ID
      await saveProfileData(data.user.id);

      // Send password reset email so user can set their own password
      (supabase.auth as any).resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/forgot-password`,
      }).catch(() => { /* silent - non-critical */ });

      return data.user.id;
    } catch (err: any) {
      console.error('Guest signup error:', err);
      toast.error(err.message || (isRTL ? 'فشل إنشاء الحساب' : 'Failed to create account'));
      return null;
    } finally {
      setGuestSigningUp(false);
    }
  };


  const handleNextStep = async () => {
    if (currentStep === 'profile') {
      if (!validateProfile()) return;
      setCurrentStep('billing');
    } else if (currentStep === 'billing') {
      if (!validateBilling()) return;
      // For logged-in users, save profile immediately
      if (user) {
        const saved = await saveProfileData();
        if (!saved) return;
      }
      setCurrentStep('payment');
    }
  };

  const handlePrevStep = () => {
    if (currentStep === 'billing') setCurrentStep('profile');
    else if (currentStep === 'payment') setCurrentStep('billing');
  };

  const currentStepIndex = CHECKOUT_STEPS_DISPLAY.indexOf(currentStep as any);
  const progressPercent = currentStepIndex >= 0 ? ((currentStepIndex + 1) / CHECKOUT_STEPS_DISPLAY.length) * 100 : 0;

  // Promo code
  const handleApplyPromo = async () => {
    if (!promoCode.trim() || promoLoading) return;
    setPromoLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('coupon-validate', {
        body: { code: promoCode.trim(), course_id: course.id, amount: basePrice },
      });
      if (error) {
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

  // Submit payment
  const handleSubmitPayment = async (method: PaymentMethod = 'card') => {
    if (!isPaymentReady) return;
    onPaymentStarted?.();

    // Compose address from billing fields
    const composedAddress = [effectiveCity, effectiveCountry, postalCode].filter(Boolean).join(', ');

    // For guest users: auto-create account first
    let currentUserId = user?.id;
    if (!currentUserId) {
      const newUserId = await handleGuestSignup();
      if (!newUserId) return; // signup failed
      currentUserId = newUserId;
    }

    // If 100% discount, enroll directly
    if (discountedPrice <= 0 && appliedCoupon) {
      try {
        resetPayment();
        const { error: enrollError } = await supabase
          .from('course_enrollments')
          .insert({ user_id: currentUserId, course_id: course.id });

        if (enrollError && !enrollError.message.includes('duplicate')) {
          throw new Error(enrollError.message);
        }

        await supabase.rpc('increment_coupon_usage', {
          p_coupon_id: appliedCoupon.coupon_id,
          p_user_id: currentUserId,
          p_course_id: course.id,
          p_order_id: null,
          p_charge_id: null,
          p_discount_amount: appliedCoupon.discount_amount,
          p_original_amount: basePrice,
          p_final_amount: 0,
        });

        // Send GHL webhook for free enrollment with per-course tracking
        sendCourseStatus(
          currentUserId,
          course.id,
          course.title,
          'purchased',
          {
            full_name: fullName,
            email,
            phone,
            city: effectiveCity,
            country: effectiveCountry,
            address: composedAddress,
            amount: '0',
            dateOfBirth: profile?.date_of_birth || '',
            gender: profile?.gender || '',
            isRTL,
            silent: true,
          }
        );

        toast.success(isRTL ? 'تم التسجيل بنجاح! الدورة مجانية بالكامل' : 'Enrolled successfully! Course is fully free');
        onSuccess();
        onOpenChange(false);
      } catch (err: any) {
        toast.error(err.message || (isRTL ? 'فشل التسجيل' : 'Enrollment failed'));
      }
      return;
    }

    // Meta Pixel: AddPaymentInfo
    trackAddPaymentInfo({
      content_ids: [course.id],
      value: discountedPrice,
      currency: 'SAR',
    });

    // Send GHL webhook with "pending" status when initiating payment
    sendCourseStatus(
      currentUserId,
      course.id,
      course.title,
      'pending',
      {
        full_name: fullName,
        email,
        phone,
        city: effectiveCity,
        country: effectiveCountry,
        address: composedAddress,
        amount: String(discountedPrice),
        dateOfBirth: profile?.date_of_birth || '',
        gender: profile?.gender || '',
        isRTL,
        silent: true,
      }
    );

    await submitPayment({
      courseId: course.id,
      currency: 'SAR',
      customerName: fullName,
      customerEmail: email,
      couponId: appliedCoupon?.coupon_id,
      customerPhone: phone,
      paymentMethod: method,
    });
  };

  const handleClose = () => {
    if (paymentStatus === 'processing') return;
    onOpenChange(false);
  };

  // Step labels
  const stepLabels: Record<CheckoutStep, { en: string; ar: string }> = {
    profile: { en: 'Personal Info', ar: 'المعلومات الشخصية' },
    billing: { en: 'Billing Address', ar: 'عنوان الفاتورة' },
    
    payment: { en: 'Payment', ar: 'الدفع' },
  };

  const renderFieldError = (field: keyof ValidationErrors) => {
    if (!errors[field]) return null;
    return (
      <p className="text-xs text-destructive flex items-center gap-1 mt-1">
        <AlertCircle className="w-3 h-3" />
        {errors[field]}
      </p>
    );
  };

  // No auth guard — guest checkout is supported

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px] w-full max-w-full h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[92vh] bg-card border-0 sm:border-2 sm:border-border shadow-2xl p-0 overflow-hidden flex flex-col !rounded-none sm:!rounded-lg !left-0 !top-0 !translate-x-0 !translate-y-0 sm:!left-[50%] sm:!top-[50%] sm:!-translate-x-1/2 sm:!-translate-y-1/2 gap-0">
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
                <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
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
                {promoApplied && discountLabel && (
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
              <Button variant="outline" onClick={() => { resetPayment(); setCurrentStep('payment'); }}>
                {isRTL ? 'حاول مرة أخرى' : 'Try Again'}
              </Button>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              {/* Step 1: Personal Info */}
              {currentStep === 'profile' && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-primary" />
                    <h4 className="font-semibold text-foreground">
                      {isRTL ? 'المعلومات الشخصية' : 'Personal Information'}
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? 'يجب تعبئة جميع الحقول لإتمام الشراء' : 'All fields are required to proceed with payment'}
                  </p>

                  <div className="space-y-2">
                    <Label>{isRTL ? 'الاسم الكامل' : 'Full Name'} <span className="text-destructive">*</span></Label>
                    <Input
                      value={fullName}
                      onChange={(e) => { setFullName(e.target.value); setErrors(prev => ({ ...prev, fullName: undefined })); }}
                      placeholder={isRTL ? 'أدخل اسمك الكامل' : 'Enter your full legal name'}
                      className={errors.fullName ? 'border-destructive' : ''}
                    />
                    {renderFieldError('fullName')}
                  </div>

                  <div className="space-y-2">
                    <Label>{isRTL ? 'البريد الإلكتروني' : 'Email'} <span className="text-destructive">*</span></Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: undefined })); }}
                      placeholder={isRTL ? 'أدخل بريدك الإلكتروني' : 'Enter your email'}
                      className={errors.email ? 'border-destructive' : ''}
                      disabled={!!user} // Locked for logged-in users
                    />
                    {!user && (
                      <p className="text-[11px] text-muted-foreground">
                        {isRTL ? 'سيتم إنشاء حساب لك تلقائياً باستخدام هذا البريد' : 'An account will be created automatically with this email'}
                      </p>
                    )}
                    {renderFieldError('email')}
                  </div>

                  <div className="space-y-2">
                    <Label>{isRTL ? 'رقم الهاتف' : 'Phone Number'} <span className="text-destructive">*</span></Label>
                    <Input
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); setErrors(prev => ({ ...prev, phone: undefined })); }}
                      placeholder={isRTL ? '05xxxxxxxx' : '05xxxxxxxx'}
                      className={errors.phone ? 'border-destructive' : ''}
                    />
                    {renderFieldError('phone')}
                  </div>
                </motion.div>
              )}

              {/* Step 2: Billing */}
              {currentStep === 'billing' && (
                <motion.div
                  key="billing"
                  initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-primary" />
                    <h4 className="font-semibold text-foreground">
                      {isRTL ? 'عنوان الفاتورة' : 'Billing Address'}
                    </h4>
                  </div>

                  <div className="space-y-2">
                    <Label>{isRTL ? 'الدولة' : 'Country'} <span className="text-destructive">*</span></Label>
                    <SearchableDropdown
                      options={countryOptions}
                      value={selectedCountryCode}
                      onChange={handleCountryChange}
                      placeholder={isRTL ? 'اختر الدولة' : 'Select country'}
                      searchPlaceholder={isRTL ? 'ابحث عن دولة...' : 'Search country...'}
                      hasError={!!errors.country}
                      dir={isRTL ? 'rtl' : 'ltr'}
                    />
                    {renderFieldError('country')}
                  </div>

                  <div className="space-y-2">
                    <Label>{isRTL ? 'المدينة' : 'City'} <span className="text-destructive">*</span></Label>
                    <SearchableDropdown
                      options={cityOptions}
                      value={isOtherCity ? '__other__' : city}
                      onChange={handleCityChange}
                      placeholder={isRTL ? (selectedCountry ? 'اختر المدينة' : 'اختر الدولة أولاً') : (selectedCountry ? 'Select city' : 'Select a country first')}
                      searchPlaceholder={isRTL ? 'ابحث عن مدينة...' : 'Search city...'}
                      hasError={!!errors.city}
                      disabled={!selectedCountry}
                      dir={isRTL ? 'rtl' : 'ltr'}
                    />
                    {isOtherCity && (
                      <Input
                        value={cityManual}
                        onChange={function (e) { setCityManual(e.target.value); setErrors(function (prev) { return Object.assign({}, prev, { city: undefined }); }); }}
                        placeholder={isRTL ? 'أدخل اسم المدينة' : 'Enter city name'}
                        className={errors.city ? 'border-destructive' : ''}
                        autoFocus
                      />
                    )}
                    {renderFieldError('city')}
                  </div>


                  {/* Summary preview */}
                  <div className="p-3 rounded-lg bg-muted/30 mt-2">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">{isRTL ? 'ملخص البيانات' : 'Data Summary'}</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{isRTL ? 'الاسم' : 'Name'}</span>
                        <span className="font-medium">{fullName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{isRTL ? 'الهاتف' : 'Phone'}</span>
                        <span className="font-medium" dir="ltr">{phone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{isRTL ? 'البريد' : 'Email'}</span>
                        <span className="font-medium truncate max-w-[180px]" dir="ltr">{email}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}


              {/* Step 3: Payment */}
              {currentStep === 'payment' && (
                <motion.div
                  key="payment"
                  initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="w-4 h-4 text-primary" />
                    <h4 className="font-semibold text-foreground">
                      {isRTL ? 'تأكيد الدفع' : 'Confirm Payment'}
                    </h4>
                  </div>


                  {/* Promo Code */}
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
                        {promoCode && !promoApplied && (
                          <button
                            type="button"
                            onClick={() => setPromoCode('')}
                            className="absolute end-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                        {promoApplied && (
                          <button
                            type="button"
                            onClick={() => { setPromoCode(''); setPromoApplied(false); setAppliedCoupon(null); }}
                            className="absolute end-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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
                          ? `تم تطبيق خصم ${discountLabel} (وفّرت ${formatLocal(discountAmount)})` 
                          : `${discountLabel} discount applied (saved ${formatLocal(discountAmount)})`}
                      </p>
                    )}
                  </div>

                  {/* Order Summary with Tax Breakdown */}
                  {(() => {
                    // Tax computed directly on the already-converted local price
                    const subtotal = discountedPrice;
                    const tax = Math.ceil(subtotal * 0.15);
                    const total = subtotal + tax;
                    return (
                      <div className="p-4 rounded-xl bg-muted/30 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{isRTL ? 'الدورة' : 'Course'}</span>
                          <span className="font-medium truncate max-w-[200px]">
                            {isRTL && course.title_ar ? course.title_ar : course.title}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{isRTL ? 'العميل' : 'Customer'}</span>
                          <span className="font-medium">{fullName}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{isRTL ? 'الموقع' : 'Location'}</span>
                          <span className="font-medium">{city}{country ? `, ${country}` : ''}</span>
                        </div>
                        <Separator />
                        {/* Price breakdown */}
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{isRTL ? 'المبلغ الأصلي' : 'Original Price'}</span>
                          <span className="font-medium">{formatLocal(basePrice)}</span>
                        </div>
                        {promoApplied && appliedCoupon && (
                          <div className="flex justify-between text-sm text-primary">
                            <span>{isRTL ? 'الخصم' : 'Discount'} ({discountLabel})</span>
                            <span>-{formatLocal(discountAmount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{isRTL ? 'المبلغ قبل الضريبة' : 'Subtotal (excl. tax)'}</span>
                          <span className="font-medium">{subtotal} {currencyLabel}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{isRTL ? vatLabelAr : vatLabel}</span>
                          <span className="font-medium">{tax} {currencyLabel}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold">
                          <span>{isRTL ? 'الإجمالي' : 'Total'}</span>
                          <span className="text-primary">{total} {currencyLabel}</span>
                        </div>
                        {!isSAR && (() => {
                          // Compute SAR equivalent: apply same course discount to SAR base price
                          let sarBase = Math.ceil(course.price);
                          const courseDpct = course.discount_percentage || 0;
                          if (courseDpct > 0) sarBase = Math.ceil(sarBase * (1 - courseDpct / 100));
                          // Apply coupon discount proportionally if present
                          if (appliedCoupon && basePrice > 0) {
                            const couponRatio = discountedPrice / basePrice;
                            sarBase = Math.ceil(sarBase * couponRatio);
                          }
                          const sarTotal = Math.ceil(sarBase * 1.15);
                          return (
                            <p className="text-[10px] text-muted-foreground text-center mt-1">
                              {isRTL ? `* سيتم تحصيل المبلغ بالريال السعودي (${sarTotal} ر.س)` : `* You will be charged in SAR (${sarTotal} SAR)`}
                            </p>
                          );
                        })()}
                      </div>
                    );
                  })()}

                  {/* Pay Now - redirects to Tap hosted payment page */}
                  {discountedPrice > 0 && (
                    <Button
                      className="w-full h-12 rounded-lg btn-cta"
                      onClick={() => handleSubmitPayment('card')}
                      disabled={paymentStatus === 'processing' || guestSigningUp || !isPaymentReady}
                    >
                      {guestSigningUp ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin me-2" />
                          <span>{isRTL ? 'جاري إنشاء الحساب...' : 'Creating account...'}</span>
                        </>
                      ) : paymentStatus === 'processing' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin me-2" />
                          <span>{isRTL ? 'جاري التوجيه للدفع...' : 'Redirecting to payment...'}</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4 me-2" />
                          <span>{isRTL ? 'ادفع الآن' : 'Pay Now'}</span>
                        </>
                      )}
                    </Button>
                  )}

                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                    <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>
                      {isRTL
                        ? 'جميع المدفوعات آمنة ومشفرة عبر بوابة الدفع'
                        : 'All payments are secure and encrypted via the payment gateway'}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Footer */}
        {paymentStatus !== 'failed' && (
          <div className="p-4 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-5 border-t-2 border-border flex-shrink-0 space-y-2">
            <div className="flex gap-2">
              {currentStep !== 'profile' && (
                <Button
                  variant="outline"
                  onClick={handlePrevStep}
                  disabled={paymentStatus === 'processing' || profileSaving}
                  className="flex-shrink-0"
                >
                  <BackArrowIcon className="w-4 h-4" />
                </Button>
              )}

              {currentStep !== 'payment' ? (
                <Button
                  className="flex-1 btn-cta"
                  onClick={handleNextStep}
                  disabled={
                    profileSaving ||
                    (currentStep === 'profile' && !isProfileValid) ||
                    (currentStep === 'billing' && !isBillingValid)
                  }
                >
                  {profileSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin me-2" />
                  ) : null}
                  {currentStep === 'billing'
                    ? (isRTL ? 'حفظ والمتابعة' : 'Save & Continue')
                    : (isRTL ? 'التالي' : 'Next')}
                  <ArrowIcon className="w-4 h-4 ms-2" />
                </Button>
              ) : discountedPrice <= 0 && appliedCoupon ? (
                <Button
                  className="flex-1"
                  variant="cta"
                  onClick={() => handleSubmitPayment('card')}
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
              ) : paymentStatus === 'processing' ? (
                <Button className="flex-1" variant="cta" disabled>
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                  {isRTL ? 'جاري التوجيه للدفع...' : 'Redirecting to payment...'}
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
