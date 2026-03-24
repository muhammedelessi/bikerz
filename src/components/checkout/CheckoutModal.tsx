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
  Lock,
  Pencil,
  Phone,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import { trackInitiateCheckout, trackAddPaymentInfo } from '@/utils/metaPixel';
import { useGHLFormWebhook } from '@/hooks/useGHLFormWebhook';
import { usePaymentMethodDetection } from '@/hooks/usePaymentMethodDetection';
import { ApplePayIcon, GooglePayIcon, VisaIcon, MastercardIcon } from '@/components/checkout/PaymentMethodIcons';

// Country code to phone prefix mapping
const COUNTRY_PHONE_PREFIXES: Record<string, string> = {
  SA: '+966', AE: '+971', KW: '+965', BH: '+973', QA: '+974', OM: '+968',
  JO: '+962', EG: '+20', IQ: '+964', SY: '+963', LB: '+961', YE: '+967',
  LY: '+218', TN: '+216', DZ: '+213', MA: '+212', SD: '+249', PS: '+970',
  US: '+1', GB: '+44', TR: '+90', DE: '+49', FR: '+33',
};

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

type CheckoutStep = 'info' | 'payment';

const CHECKOUT_STEPS_DISPLAY: CheckoutStep[] = ['info', 'payment'];


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
  const { currencyCode, symbol, symbolAr, convertPrice, formatPrice, calculateTax, calculateTotalWithTax, getSarTotalWithVat, vatLabel, vatLabelAr, isSAR, getCoursePriceInfo, getCourseCurrency, detectedCountry } = useCurrency();
  
  // Helper: format an already-converted local price (no re-conversion)
  const courseCurrency = getCourseCurrency(course.id);
  const currencyLabel = isRTL ? symbolAr : symbol;
  const formatLocal = (amount: number) => `${amount} ${currencyLabel}`;
  const { user, profile, session } = useAuth();
  const navigate = useNavigate();
  const {
    status: paymentStatus,
    error: paymentError,
    submitPayment,
    reset: resetPayment,
  } = useTapPayment();
  const { sendCourseStatus } = useGHLFormWebhook();
  const { supportsApplePay, supportsGooglePay } = usePaymentMethodDetection();
  const [guestSigningUp, setGuestSigningUp] = useState(false);

  const [currentStep, setCurrentStep] = useState<CheckoutStep>('info');
  
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
  const [isEditingName, setIsEditingName] = useState(false);
  const [phonePrefix, setPhonePrefix] = useState('');

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

  // Set phone prefix based on detected country
  useEffect(() => {
    if (detectedCountry) {
      const code = detectedCountry.toUpperCase();
      const prefix = COUNTRY_PHONE_PREFIXES[code];
      if (prefix) {
        setPhonePrefix(prefix);
      }
    }
  }, [detectedCountry]);

  // Pre-fill from profile (only for logged-in users) and auto-advance if complete
  useEffect(() => {
    if (!open) return;
    if (!user) return;
    if (profile?.full_name) setFullName(profile.full_name);
    if (user?.email) setEmail(user.email);
    if (profile?.phone) {
      // Strip known prefix so it works with the split prefix+number input
      let rawPhone = profile.phone;
      for (const prefix of Object.values(COUNTRY_PHONE_PREFIXES)) {
        if (rawPhone.startsWith(prefix)) {
          rawPhone = rawPhone.slice(prefix.length);
          break;
        }
      }
      setPhone(rawPhone);
    }
    const loadProfileData = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('city, country, postal_code, phone')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        if (data.city) setCity(data.city);
        if (data.country) setCountry(data.country);
        if (data.postal_code) setPostalCode(data.postal_code);
        
        // Match country to dropdown
        if (data.country) {
          const matched = COUNTRIES.find(c => c.en === data.country || c.ar === data.country);
          if (matched) {
            setSelectedCountryCode(matched.code);
            setIsOtherCountry(false);
          } else {
            setIsOtherCountry(true);
            setCountryManual(data.country);
          }
        }
        
        // Match city for "other" case
        if (data.city && data.country) {
          const matchedCountry = COUNTRIES.find(c => c.en === data.country || c.ar === data.country);
          if (matchedCountry) {
            const cityMatch = matchedCountry.cities.find(ct => ct.en === data.city || ct.ar === data.city);
            if (!cityMatch) {
              setIsOtherCity(true);
              setCityManual(data.city);
            }
          } else {
            setCityManual(data.city);
          }
        }

        // Auto-advance: if all fields already filled, skip to payment
        const hasProfile = (profile?.full_name && profile.full_name.trim().length >= 3) 
          && user.email 
          && (data.phone || profile?.phone);
        const hasBilling = data.city && data.country;
        
        if (hasProfile && hasBilling) {
          setCurrentStep('payment');
        }
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
      setCurrentStep('info');
      setPromoCode('');
      setPromoApplied(false);
      setAppliedCoupon(null);
      setPromoLoading(false);
      setErrors({});
      setIsEditingName(false);
      resetPayment();
    }
  }, [open, resetPayment]);

  // Validation
  const validateInfo = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};
    if (!fullName.trim() || fullName.trim().length < 3) {
      newErrors.fullName = isRTL ? 'الاسم الكامل مطلوب (3 أحرف على الأقل)' : 'Full name required (min 3 chars)';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email)) {
      newErrors.email = isRTL ? 'بريد إلكتروني صحيح مطلوب' : 'Valid email required';
    }
    // Build full phone for validation
    const fullPhone = getFullPhone();
    const phoneRegex = /^[0-9+\s()-]{7,15}$/;
    if (!fullPhone || !phoneRegex.test(fullPhone)) {
      newErrors.phone = isRTL ? 'رقم هاتف صحيح مطلوب' : 'Valid phone number required';
    }
    // Billing
    const c = (isOtherCity || isOtherCountry) ? cityManual.trim() : city.trim();
    if (!c) {
      newErrors.city = isRTL ? 'المدينة مطلوبة' : 'City is required';
    }
    const cn = isOtherCountry ? countryManual.trim() : country.trim();
    if (!cn) {
      newErrors.country = isRTL ? 'الدولة مطلوبة' : 'Country is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [fullName, email, phone, phonePrefix, city, cityManual, isOtherCity, country, countryManual, isOtherCountry, isRTL]);

  const effectiveCity = (isOtherCity || isOtherCountry) ? cityManual.trim() : city.trim();
  const effectiveCountry = isOtherCountry ? countryManual.trim() : country.trim();

  // Helper to get the full phone number with prefix
  const getFullPhone = useCallback(() => {
    const rawPhone = phone.trim();
    if (!rawPhone) return '';
    // If user already typed a + prefix, don't double-add
    if (rawPhone.startsWith('+')) return rawPhone;
    if (phonePrefix && !rawPhone.startsWith(phonePrefix)) {
      return `${phonePrefix}${rawPhone}`;
    }
    return rawPhone;
  }, [phone, phonePrefix]);

  const hasNamePrefilled = !!(profile?.full_name && profile.full_name.trim().length >= 3);
  

  const fullPhone = getFullPhone();
  const isInfoValid = fullName.trim().length >= 3 
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) 
    && /^[0-9+\s()-]{7,15}$/.test(fullPhone)
    && ((isOtherCity || isOtherCountry) ? cityManual.trim().length > 0 : city.trim().length > 0) 
    && (isOtherCountry ? countryManual.trim().length > 0 : country.trim().length > 0);
  const isPaymentReady = isInfoValid;

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
          phone: fullPhone,
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

      await new Promise(resolve => setTimeout(resolve, 500));
      await saveProfileData(data.user.id);

      (supabase.auth as any).resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/forgot-password`,
      }).catch(() => {});

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
    if (currentStep === 'info') {
      if (!validateInfo()) return;
      // Save profile for logged-in users
      if (user) {
        const saved = await saveProfileData();
        if (!saved) return;
      }
      setCurrentStep('payment');
    }
  };

  const handlePrevStep = () => {
    if (currentStep === 'payment') setCurrentStep('info');
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

    const composedAddress = [effectiveCity, effectiveCountry, postalCode].filter(Boolean).join(', ');

    let currentUserId = user?.id;
    if (!currentUserId) {
      const newUserId = await handleGuestSignup();
      if (!newUserId) return;
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

        sendCourseStatus(
          currentUserId,
          course.id,
          course.title,
          'purchased',
          {
            full_name: fullName,
            email,
            phone: fullPhone,
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

    trackAddPaymentInfo({
      content_ids: [course.id],
      value: discountedPrice,
      currency: 'SAR',
    });

    sendCourseStatus(
      currentUserId,
      course.id,
      course.title,
      'pending',
      {
        full_name: fullName,
        email,
        phone: fullPhone,
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
      customerPhone: fullPhone,
      paymentMethod: method,
    });
  };

  const handleClose = () => {
    if (paymentStatus === 'processing' || paymentStatus === 'verifying') return;
    onOpenChange(false);
  };

  // Step labels
  const stepLabels: Record<CheckoutStep, { en: string; ar: string }> = {
    info: { en: 'Personal Info', ar: 'المعلومات الشخصية' },
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
                <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" loading="lazy" />
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
          {/* Verifying state */}
          {paymentStatus === 'verifying' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <h4 className="text-lg font-bold text-foreground mb-1">
                {isRTL ? 'جاري التحقق من الدفع...' : 'Verifying payment...'}
              </h4>
              <p className="text-sm text-muted-foreground">
                {isRTL ? 'يرجى الانتظار لحظة' : 'Please wait a moment'}
              </p>
            </motion.div>
          )}

          {/* Success state */}
          {paymentStatus === 'succeeded' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-8 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h4 className="text-xl font-bold text-foreground mb-2">
                {isRTL ? '🎉 تم الدفع بنجاح!' : '🎉 Payment Successful!'}
              </h4>
              <p className="text-muted-foreground mb-4">
                {isRTL ? 'تم تسجيلك في الدورة بنجاح' : 'You have been enrolled in the course'}
              </p>
              <Button
                variant="cta"
                onClick={() => {
                  onSuccess();
                  onOpenChange(false);
                  navigate(`/courses/${course.id}/learn?welcome=1`);
                }}
              >
                <Sparkles className="w-4 h-4 me-2" />
                {isRTL ? 'ابدأ التعلم الآن' : 'Start Learning Now'}
              </Button>
            </motion.div>
          )}

          {/* Failed state */}
          {paymentStatus === 'failed' && (
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
          )}

          {/* Normal step flow */}
          {paymentStatus !== 'verifying' && paymentStatus !== 'succeeded' && paymentStatus !== 'failed' && (
            <AnimatePresence mode="wait">
              {/* Step 1: Personal Info + Billing combined */}
              {currentStep === 'info' && (
                <motion.div
                  key="info"
                  initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
                  className="space-y-4"
                >
                  {/* Personal Information Section */}
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-primary" />
                    <h4 className="font-semibold text-foreground">
                      {isRTL ? 'المعلومات الشخصية' : 'Personal Information'}
                    </h4>
                  </div>

                  {/* Name: read-only if prefilled, with edit button */}
                  <div className="space-y-1">
                    {hasNamePrefilled && !isEditingName ? (
                      <div className="flex items-center justify-between rounded-md border border-input bg-muted/30 px-3 py-2 h-10">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm font-medium text-foreground">{fullName}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsEditingName(true)}
                          className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <User className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input
                          value={fullName}
                          onChange={(e) => { setFullName(e.target.value); setErrors(prev => ({ ...prev, fullName: undefined })); }}
                          placeholder={isRTL ? 'الاسم الكامل' : 'Full name'}
                          className={`ps-9 ${errors.fullName ? 'border-destructive' : ''}`}
                          autoFocus={isEditingName}
                        />
                      </div>
                    )}
                    {renderFieldError('fullName')}
                  </div>

                  {/* Email: display only for logged-in, editable for guests */}
                  <div className="space-y-1">
                    {user ? (
                      <div className="flex items-center rounded-md border border-input bg-muted/30 px-3 py-2 h-10">
                        <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0 me-2" />
                        <span className="text-sm text-foreground truncate" dir="ltr">{email}</span>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                          <Input
                            type="email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: undefined })); }}
                            placeholder={isRTL ? 'البريد الإلكتروني' : 'Email address'}
                            className={`ps-9 ${errors.email ? 'border-destructive' : ''}`}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {isRTL ? 'سيتم إنشاء حساب لك تلقائياً باستخدام هذا البريد' : 'An account will be created automatically with this email'}
                        </p>
                      </>
                    )}
                    {renderFieldError('email')}
                  </div>

                  {/* Phone: always editable with country code prefix */}
                  <div className="space-y-1">
                    <div className="flex gap-2" dir="ltr">
                      <select
                        value={phonePrefix}
                        onChange={(e) => setPhonePrefix(e.target.value)}
                        className="flex items-center rounded-md border border-input bg-muted/30 px-2 h-10 text-sm font-medium text-foreground flex-shrink-0 min-w-[85px] appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                        dir="ltr"
                      >
                        <option value="" disabled>{'+---'}</option>
                        {Object.entries(COUNTRY_PHONE_PREFIXES).map(([code, prefix]) => (
                          <option key={code} value={prefix}>
                            {prefix} {code}
                          </option>
                        ))}
                      </select>
                      <Input
                        value={phone}
                        onChange={(e) => { 
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setPhone(val); 
                          setErrors(prev => ({ ...prev, phone: undefined })); 
                        }}
                        placeholder="5XXXXXXXX"
                        className={`flex-1 ${errors.phone ? 'border-destructive' : ''}`}
                        dir="ltr"
                      />
                    </div>
                    {renderFieldError('phone')}
                  </div>

                  {/* Billing Address Section */}
                  <div className="rounded-lg border border-border p-3 space-y-3 mt-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      <h4 className="font-semibold text-foreground text-sm">
                        {isRTL ? 'عنوان الفاتورة' : 'Billing Address'}
                      </h4>
                    </div>

                    {/* Country & City side by side */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Country */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">{isRTL ? 'الدولة' : 'Country'} <span className="text-destructive">*</span></Label>
                        <SearchableDropdown
                          options={countryOptions}
                          value={isOtherCountry ? '__other__' : selectedCountryCode}
                          onChange={handleCountryChange}
                          placeholder={isRTL ? 'اختر الدولة' : 'Select country'}
                          searchPlaceholder={isRTL ? 'ابحث...' : 'Search...'}
                          hasError={!!errors.country}
                          dir={isRTL ? 'rtl' : 'ltr'}
                        />
                        {isOtherCountry && (
                          <Input
                            value={countryManual}
                            onChange={function (e) { setCountryManual(e.target.value); setCountry(e.target.value); setErrors(function (prev) { return Object.assign({}, prev, { country: undefined }); }); }}
                            placeholder={isRTL ? 'اسم الدولة' : 'Country name'}
                            className={`text-sm ${errors.country ? 'border-destructive' : ''}`}
                            autoFocus
                          />
                        )}
                        {renderFieldError('country')}
                      </div>

                      {/* City */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">{isRTL ? 'المدينة' : 'City'} <span className="text-destructive">*</span></Label>
                        {isOtherCountry ? (
                          <Input
                            value={cityManual}
                            onChange={function (e) { setCityManual(e.target.value); setErrors(function (prev) { return Object.assign({}, prev, { city: undefined }); }); }}
                            placeholder={isRTL ? 'اسم المدينة' : 'City name'}
                            className={`text-sm ${errors.city ? 'border-destructive' : ''}`}
                          />
                        ) : (
                          <>
                            <SearchableDropdown
                              options={cityOptions}
                              value={isOtherCity ? '__other__' : city}
                              onChange={handleCityChange}
                              placeholder={isRTL ? 'اختر المدينة' : 'Select city'}
                              searchPlaceholder={isRTL ? 'ابحث...' : 'Search...'}
                              hasError={!!errors.city}
                              dir={isRTL ? 'rtl' : 'ltr'}
                            />
                            {isOtherCity && (
                              <Input
                                value={cityManual}
                                onChange={function (e) { setCityManual(e.target.value); setErrors(function (prev) { return Object.assign({}, prev, { city: undefined }); }); }}
                                placeholder={isRTL ? 'اسم المدينة' : 'City name'}
                                className={`text-sm ${errors.city ? 'border-destructive' : ''}`}
                                autoFocus
                              />
                            )}
                          </>
                        )}
                        {renderFieldError('city')}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Payment */}
              {currentStep === 'payment' && (
                <motion.div
                  key="payment"
                  initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
                  className="space-y-5"
                >
                  {/* Accepted Payment Methods */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-primary" />
                      <h4 className="font-semibold text-foreground text-sm">
                        {isRTL ? 'طرق الدفع المتاحة' : 'Accepted Payment Methods'}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center px-3 py-2 rounded-lg border border-border bg-muted/20">
                        <VisaIcon className="h-5 w-auto" />
                      </div>
                      <div className="flex items-center px-3 py-2 rounded-lg border border-border bg-muted/20">
                        <MastercardIcon className="h-5 w-auto" />
                      </div>
                      <div className="flex items-center px-3 py-2 rounded-lg border border-border bg-muted/20">
                        <ApplePayIcon className="h-5 w-auto" />
                      </div>
                      <div className="flex items-center px-3 py-2 rounded-lg border border-border bg-muted/20">
                        <GooglePayIcon className="h-5 w-auto" />
                      </div>
                    </div>
                  </div>

                  {/* Promo Code */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-primary" />
                      {isRTL ? 'رمز الخصم' : 'Promo Code'}
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value)}
                          placeholder={isRTL ? 'أدخل رمز الخصم' : 'Enter promo code'}
                          disabled={promoApplied || paymentStatus === 'processing'}
                          className="w-full pe-9 h-10"
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
                      <Button variant="outline" size="default" onClick={handleApplyPromo} disabled={!promoCode || promoApplied || paymentStatus === 'processing'}>
                        {promoApplied ? (isRTL ? 'مطبق' : 'Applied') : (isRTL ? 'تطبيق' : 'Apply')}
                      </Button>
                    </div>
                    {promoApplied && appliedCoupon && (
                      <p className="text-xs text-primary flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        {isRTL 
                          ? `تم تطبيق خصم ${discountLabel} (وفّرت ${formatLocal(discountAmount)})` 
                          : `${discountLabel} discount applied (saved ${formatLocal(discountAmount)})`}
                      </p>
                    )}
                  </div>

                  {/* Order Summary */}
                  {(() => {
                    const subtotal = discountedPrice;
                    const tax = Math.ceil(subtotal * 0.15);
                    const total = subtotal + tax;
                    return (
                      <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
                        <div className="px-4 py-3 bg-muted/30 border-b border-border">
                          <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                            {isRTL ? 'ملخص الطلب' : 'Order Summary'}
                          </p>
                        </div>
                        <div className="p-4 space-y-2.5">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{isRTL ? 'الدورة' : 'Course'}</span>
                            <span className="font-medium truncate max-w-[200px]">
                              {isRTL && course.title_ar ? course.title_ar : course.title}
                            </span>
                          </div>
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
                            <span className="text-muted-foreground">{isRTL ? 'المبلغ قبل الضريبة' : 'Subtotal'}</span>
                            <span className="font-medium">{subtotal} {currencyLabel}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{isRTL ? vatLabelAr : vatLabel}</span>
                            <span className="font-medium">{tax} {currencyLabel}</span>
                          </div>
                          <Separator className="my-1" />
                          <div className="flex justify-between font-bold text-base">
                            <span>{isRTL ? 'الإجمالي' : 'Total'}</span>
                            <span className="text-primary">{total} {currencyLabel}</span>
                          </div>
                          {!isSAR && (() => {
                            let sarBase = Math.ceil(course.price);
                            const courseDpct = course.discount_percentage || 0;
                            if (courseDpct > 0) sarBase = Math.ceil(sarBase * (1 - courseDpct / 100));
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
                      </div>
                    );
                  })()}

                  {/* Pay Now CTA */}
                  {discountedPrice > 0 && (() => {
                    const total = discountedPrice + Math.ceil(discountedPrice * 0.15);
                    return (
                      <Button
                        className="w-full h-12 rounded-xl text-base font-bold shadow-glow hover:shadow-glow-lg transition-all duration-300"
                        variant="cta"
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
                            <span>{isRTL ? 'جاري التحويل لصفحة الدفع...' : 'Redirecting to payment...'}</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4 me-2" />
                            <span>
                              {isRTL
                                ? `ادفع الآن ${total} ${currencyLabel}`
                                : `Pay Now ${total} ${currencyLabel}`}
                            </span>
                          </>
                        )}
                      </Button>
                    );
                  })()}

                  {/* Trust Badge */}
                  <div className="flex flex-col items-center gap-2 pt-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Lock className="w-3.5 h-3.5 text-primary" />
                      <span>🔒 {isRTL ? 'مُؤمّن بواسطة Tap Payments' : 'Secured by Tap Payments'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                        <Shield className="w-3 h-3" />
                        <span>3D Secure</span>
                      </div>
                      <span className="text-muted-foreground/20">|</span>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                        <Shield className="w-3 h-3" />
                        <span>PCI DSS</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Footer */}
        {paymentStatus !== 'failed' && paymentStatus !== 'succeeded' && paymentStatus !== 'verifying' && (
          <div className="p-4 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-5 border-t-2 border-border flex-shrink-0 space-y-2">
            <div className="flex gap-2">
              {currentStep !== 'info' && (
                <Button
                  variant="outline"
                  onClick={handlePrevStep}
                  disabled={paymentStatus === 'processing' || profileSaving}
                  className="flex-shrink-0"
                >
                  <BackArrowIcon className="w-4 h-4" />
                </Button>
              )}

              {currentStep === 'info' ? (
                <Button
                  className="flex-1 btn-cta"
                  onClick={handleNextStep}
                  disabled={profileSaving || !isInfoValid}
                >
                  {profileSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin me-2" />
                  ) : null}
                  {isRTL ? 'حفظ والمتابعة' : 'Save & Continue'}
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
