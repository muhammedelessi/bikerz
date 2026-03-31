import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useGHLFormWebhook } from '@/hooks/useGHLFormWebhook';
import { useAuthPageContent } from '@/hooks/useAuthPageContent';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Eye, EyeOff, User, Mail, Lock, ArrowLeft, Phone, Globe, MapPin, ChevronDown, Search } from 'lucide-react';
import { toast } from 'sonner';
import SearchableDropdown from '@/components/checkout/SearchableDropdown';
import { PHONE_COUNTRIES } from '@/data/phoneCountryCodes';
import { COUNTRIES, OTHER_OPTION } from '@/data/countryCityData';

const OTHER_VALUE = '__other__';

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

interface GuestSignupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: {
    id: string;
    title: string;
    title_ar: string | null;
    price: number;
  };
  onAuthenticated: () => void;
}

const GuestSignupModal: React.FC<GuestSignupModalProps> = ({
  open,
  onOpenChange,
  course,
  onAuthenticated,
}) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { sendFormData, sendCourseStatus } = useGHLFormWebhook();
  const { data: authContent } = useAuthPageContent();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phonePrefix, setPhonePrefix] = useState('+966_SA');
  const [country, setCountry] = useState('SA');
  const [city, setCity] = useState('');
  const [customCountry, setCustomCountry] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [countryError, setCountryError] = useState<string | null>(null);
  const [cityError, setCityError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [visualViewportHeight, setVisualViewportHeight] = useState<number | null>(null);
  const [isGoogleUser, setIsGoogleUser] = useState(false);
  const [emailChecked, setEmailChecked] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [cityOpen, setCityOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');

  const cms = authContent?.signup || {};
  const nameLabel = (isRTL ? cms.name_label_ar : cms.name_label_en) || t('auth.signup.name');
  const emailLabel = (isRTL ? cms.email_label_ar : cms.email_label_en) || t('auth.signup.email');
  const passwordLabel = (isRTL ? cms.password_label_ar : cms.password_label_en) || t('auth.signup.password');

  const isOtherCountry = country === OTHER_VALUE;
  const isOtherCity = city === OTHER_VALUE;

  const selectedCountryEntry = useMemo(
    () => COUNTRIES.find(c => c.code === country),
    [country]
  );

  const phonePrefixOptions = useMemo(() =>
    PHONE_COUNTRIES.map(c => ({
      value: `${c.prefix}_${c.code}`,
      label: `${c.prefix} ${isRTL ? c.ar : c.en}`,
    })),
    [isRTL]
  );

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const q = countrySearch.toLowerCase();
    return COUNTRIES.filter(c => c.en.toLowerCase().includes(q) || c.ar.includes(q));
  }, [countrySearch]);

  const cities = useMemo(() => selectedCountryEntry?.cities || [], [selectedCountryEntry]);

  const filteredCities = useMemo(() => {
    if (!citySearch.trim()) return cities;
    const q = citySearch.toLowerCase();
    return cities.filter(c => c.en.toLowerCase().includes(q) || c.ar.includes(q));
  }, [cities, citySearch]);

  const hasCities = cities.length > 0 && !isOtherCountry;

  const getFullPhone = () => {
    const prefix = phonePrefix.split('_')[0];
    return `${prefix}${phone.replace(/[^0-9]/g, '')}`;
  };

  const getCountryName = () => {
    if (isOtherCountry) return customCountry.trim();
    return selectedCountryEntry ? (isRTL ? selectedCountryEntry.ar : selectedCountryEntry.en) : '';
  };

  const getCityName = () => {
    if (isOtherCity || isOtherCountry) return customCity.trim();
    return city;
  };

  // Auto-detect country
  useEffect(() => {
    if (!open) return;
    const detectCountry = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (!res.ok) return;
        const data = await res.json();
        const countryCode = data.country_code;
        const phoneMatch = PHONE_COUNTRIES.find(c => c.code === countryCode);
        if (phoneMatch) setPhonePrefix(`${phoneMatch.prefix}_${phoneMatch.code}`);
        const countryMatch = COUNTRIES.find(c => c.code === countryCode);
        if (countryMatch) {
          setCountry(countryCode);
          if (data.city) {
            const cityMatch = countryMatch.cities.find(c => c.en.toLowerCase() === data.city.toLowerCase());
            if (cityMatch) setCity(isRTL ? cityMatch.ar : cityMatch.en);
          }
        } else {
          setCountry(OTHER_VALUE);
          setCustomCountry(data.country_name || '');
        }
      } catch {}
    };
    detectCountry();
  }, [open]);

  // Hide navbar on mobile
  useEffect(() => {
    if (open && isMobile) {
      document.body.classList.add('guest-modal-open');
    } else {
      document.body.classList.remove('guest-modal-open');
    }
    return () => { document.body.classList.remove('guest-modal-open'); };
  }, [open, isMobile]);

  useEffect(() => {
    if (!open || typeof window === 'undefined' || !window.visualViewport) {
      setVisualViewportHeight(null);
      return;
    }
    const viewport = window.visualViewport;
    const updateHeight = () => setVisualViewportHeight(viewport.height);
    updateHeight();
    viewport.addEventListener('resize', updateHeight);
    viewport.addEventListener('scroll', updateHeight);
    return () => {
      viewport.removeEventListener('resize', updateHeight);
      viewport.removeEventListener('scroll', updateHeight);
      setVisualViewportHeight(null);
    };
  }, [open]);

  const validatePhone = (phoneValue: string): boolean => {
    const digitsOnly = phoneValue.replace(/[^0-9]/g, '');
    if (digitsOnly.length < 7) {
      setPhoneError(isRTL ? 'رقم الهاتف قصير جداً (7 أرقام على الأقل)' : 'Phone number too short (min 7 digits)');
      return false;
    }
    if (digitsOnly.length > 15) {
      setPhoneError(isRTL ? 'رقم الهاتف طويل جداً (15 رقم كحد أقصى)' : 'Phone number too long (max 15 digits)');
      return false;
    }
    setPhoneError(null);
    return true;
  };

  const saveProfileAndSync = async (userId: string, fullName: string, userEmail: string) => {
    try {
      await supabase.from('profiles').update({
        full_name: fullName,
        phone: getFullPhone(),
        country: getCountryName(),
        city: getCityName(),
      }).eq('user_id', userId);
    } catch (e) {
      console.error('Failed to save profile:', e);
    }

    try {
      await supabase.functions.invoke('ghl-sync', {
        body: {
          action: 'create_or_update_contact',
          data: { full_name: fullName, email: userEmail, phone: getFullPhone(), country: getCountryName(), city: getCityName() },
        },
      });
    } catch (syncErr) {
      console.error('GHL signup sync failed:', syncErr);
    }

    sendCourseStatus(userId, course.id, course.title, 'not purchased', {
      full_name: fullName,
      email: userEmail,
      isRTL,
      silent: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNameError(null);
    setEmailError(null);
    setPhoneError(null);
    setCountryError(null);
    setCityError(null);
    setPasswordError(null);

    let hasError = false;

    if (!name.trim()) {
      setNameError(isRTL ? 'يرجى إدخال الاسم' : 'Please enter your name');
      hasError = true;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setEmailError(isRTL ? 'يرجى إدخال البريد الإلكتروني' : 'Please enter your email');
      hasError = true;
    } else if (!emailRegex.test(email.trim())) {
      setEmailError(isRTL ? 'البريد الإلكتروني غير صالح' : 'Invalid email address');
      hasError = true;
    }

    if (!validatePhone(phone)) hasError = true;

    if (!/^\d{6}$/.test(password)) {
      setPasswordError(isRTL ? 'كلمة المرور يجب أن تتكون من 6 أرقام' : 'Password must be exactly 6 digits');
      hasError = true;
    }

    const finalCountry = getCountryName();
    const finalCity = getCityName();
    if (!finalCountry) {
      setCountryError(isRTL ? 'يرجى اختيار أو إدخال الدولة' : 'Please select or enter your country');
      hasError = true;
    }
    if (!finalCity) {
      setCityError(isRTL ? 'يرجى اختيار أو إدخال المدينة' : 'Please select or enter your city');
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);

    try {
      const { data: signupData, error: signupError } = await (supabase.auth as any).signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: name.trim() },
        },
      });

      if (signupError) {
        if (
          signupError.message?.includes('already registered') ||
          signupError.message?.includes('already exists') ||
          signupError.message?.includes('User already registered')
        ) {
          setError(
            isRTL
              ? 'لديك حساب بالفعل. يرجى تسجيل الدخول للمتابعة.'
              : 'You already have an account. Please log in to continue.'
          );
          setTimeout(() => {
            onOpenChange(false);
            navigate(`/login?returnTo=/courses/${course.id}`);
          }, 2000);
          return;
        }
        throw signupError;
      }

      if (!signupData.user) {
        throw new Error('Account creation failed');
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
      await saveProfileAndSync(signupData.user.id, name.trim(), email.trim());

      toast.success(t('auth.signup.success'));
      onOpenChange(false);
      onAuthenticated();
    } catch (err: any) {
      console.error('Guest signup error:', err);
      setError(err.message || (isRTL ? 'فشل إنشاء الحساب' : 'Failed to create account'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);

    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });

      if (result.redirected) return;

      if (result.error) {
        setError(result.error.message || (isRTL ? 'فشل تسجيل الدخول بجوجل' : 'Google sign-in failed'));
        setIsGoogleLoading(false);
        return;
      }

      const { data: { user } } = await (supabase.auth as any).getUser();
      if (!user) {
        setError(isRTL ? 'فشل في الحصول على بيانات المستخدم' : 'Failed to get user data');
        setIsGoogleLoading(false);
        return;
      }

      const googleName = user.user_metadata?.full_name || user.user_metadata?.name || '';
      const googleAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';

      try {
        const updateData: Record<string, any> = {};
        if (googleName) updateData.full_name = googleName;
        if (googleAvatar) updateData.avatar_url = googleAvatar;
        if (Object.keys(updateData).length > 0) {
          await supabase.from('profiles').update(updateData).eq('user_id', user.id);
        }
      } catch (e) {
        console.error('Failed to update profile with Google data:', e);
      }

      await saveProfileAndSync(user.id, googleName, user.email || '');

      toast.success(isRTL ? 'تم التسجيل بنجاح!' : 'Signed up successfully!');
      setIsGoogleLoading(false);
      onOpenChange(false);
      onAuthenticated();
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setError(err?.message || (isRTL ? 'فشل تسجيل الدخول بجوجل' : 'Google sign-in failed'));
      setIsGoogleLoading(false);
    }
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const input = e.target;
    setTimeout(() => {
      input.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }, 300);
  };

  const checkProviders = async (emailValue: string) => {
    if (!emailValue || !emailValue.includes('@')) {
      setIsGoogleUser(false);
      setEmailChecked(false);
      return;
    }
    try {
      const { data } = await supabase.rpc('get_auth_providers' as any, { p_email: emailValue });
      const result = data as { has_email: boolean; has_google: boolean; exists: boolean } | null;
      setIsGoogleUser(!!result?.has_google && !result?.has_email);
      setEmailChecked(true);
    } catch {
      setIsGoogleUser(false);
      setEmailChecked(true);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (emailChecked && isGoogleUser) {
      setError(isRTL ? 'هذا الحساب مسجل عبر جوجل. استخدم زر جوجل لتسجيل الدخول.' : 'This account was created with Google. Please use the Google button to sign in.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: loginError } = await (supabase.auth as any).signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) {
        if (!emailChecked) await checkProviders(email);
        if (isGoogleUser) {
          setError(isRTL ? 'هذا الحساب مسجل عبر جوجل. استخدم زر جوجل لتسجيل الدخول.' : 'This account was created with Google. Please use the Google button to sign in.');
        } else {
          setError(isRTL ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' : 'Invalid email or password');
        }
        return;
      }

      toast.success(isRTL ? 'تم تسجيل الدخول بنجاح!' : 'Logged in successfully!');
      onOpenChange(false);
      onAuthenticated();
    } catch (err: any) {
      setError(err.message || (isRTL ? 'فشل تسجيل الدخول' : 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const loginFormContent = (
    <div className="p-5 sm:p-6 space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full h-10 sm:h-11 text-sm sm:text-base gap-3 border-border"
        onClick={handleGoogleSignIn}
        disabled={isGoogleLoading || loading}
      >
        {isGoogleLoading ? (
          <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
        ) : (
          <>
            <GoogleIcon />
            {isRTL ? 'تسجيل الدخول بجوجل' : 'Sign in with Google'}
          </>
        )}
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">{isRTL ? 'أو' : 'or'}</span>
        </div>
      </div>

      <form onSubmit={handleLogin} className="space-y-3.5">
        <div className="relative">
          <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          <Input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailChecked(false); setIsGoogleUser(false); }}
            onBlur={() => checkProviders(email)}
            onFocus={handleInputFocus}
            placeholder={emailLabel}
            required
            className="form-input h-10 sm:h-11 text-sm sm:text-base ps-10"
          />
        </div>

        {emailChecked && isGoogleUser ? (
          <p className="text-sm text-muted-foreground text-center">
            {isRTL ? 'هذا الحساب مسجل عبر جوجل. استخدم زر جوجل أعلاه.' : 'This account was created with Google. Use the Google button above.'}
          </p>
        ) : (
          <>
            <div className="relative">
              <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={handleInputFocus}
                placeholder={passwordLabel}
                required
                className="form-input h-10 sm:h-11 text-sm sm:text-base ps-10 pe-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <Button
              type="submit"
              className="w-full btn-cta h-11 text-base mt-1"
              disabled={loading || isGoogleLoading}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                isRTL ? 'تسجيل الدخول والمتابعة' : 'Login & Continue to Payment'
              )}
            </Button>
          </>
        )}

        <p className="text-sm text-center text-muted-foreground">
          {isRTL ? 'ليس لديك حساب؟' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null); setPassword(''); }}
            className="text-primary hover:underline font-medium"
          >
            {isRTL ? 'إنشاء حساب' : 'Sign up'}
          </button>
        </p>
      </form>
    </div>
  );

  const signupFormContent = (
    <div className="p-5 sm:p-6 space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full h-10 sm:h-11 text-sm sm:text-base gap-3 border-border"
        onClick={handleGoogleSignIn}
        disabled={isGoogleLoading || loading}
      >
        {isGoogleLoading ? (
          <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
        ) : (
          <>
            <GoogleIcon />
            {isRTL ? 'التسجيل بحساب جوجل' : 'Sign up with Google'}
          </>
        )}
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">{isRTL ? 'أو' : 'or'}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Name */}
        <div className="space-y-1">
          <div className="relative">
            <User className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(null); }}
              onFocus={handleInputFocus}
              placeholder={nameLabel}
              className={`ps-9 h-10 sm:h-11 text-sm sm:text-base ${nameError ? 'border-destructive' : ''}`}
            />
          </div>
          {nameError && (
            <p className="text-xs text-destructive flex items-center gap-1 mt-1">
              <AlertCircle className="w-3 h-3" />
              {nameError}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1">
          <div className="relative">
            <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
              onFocus={handleInputFocus}
              placeholder={emailLabel}
              className={`ps-9 h-10 sm:h-11 text-sm sm:text-base ${emailError ? 'border-destructive' : ''}`}
            />
          </div>
          {emailError && (
            <p className="text-xs text-destructive flex items-center gap-1 mt-1">
              <AlertCircle className="w-3 h-3" />
              {emailError}
            </p>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-1">
          <div className={`flex gap-2 ${isRTL ? "flex-row-reverse" : ""}`} dir="ltr">
            <div className="flex-shrink-0 w-[110px]">
              <SearchableDropdown
                options={phonePrefixOptions}
                value={phonePrefix}
                onChange={(val) => { setPhonePrefix(val); setPhoneError(null); }}
                placeholder="+---"
                searchPlaceholder={isRTL ? 'ابحث...' : 'Search...'}
                hasError={!!phoneError}
                dir="ltr"
              />
            </div>
            <div className="relative flex-1">
              <Phone className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none ${isRTL ? "right-3" : "left-3"}`} />
              <Input
                type="tel"
                value={phone}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setPhone(val);
                  setPhoneError(null);
                }}
                onFocus={handleInputFocus}
                placeholder={isRTL ? 'رقم الهاتف' : 'Phone Number'}
                className={`${isRTL ? "pr-9 text-right" : "pl-9 text-left"} h-10 sm:h-11 text-sm sm:text-base ${phoneError ? 'border-destructive' : ''}`}
                dir={isRTL ? "rtl" : "ltr"}
              />
            </div>
          </div>
          {phoneError && (
            <p className="text-xs text-destructive flex items-center gap-1 mt-1">
              <AlertCircle className="w-3 h-3" />
              {phoneError}
            </p>
          )}
        </div>

        {/* Password — 6 digits */}
        <div className="space-y-1">
          <div className="relative">
            <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              type={showPassword ? "text" : "password"}
              inputMode="numeric"
              maxLength={6}
              value={password}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setPassword(val);
                setPasswordError(null);
              }}
              onFocus={handleInputFocus}
              placeholder={isRTL ? 'كلمة المرور (6 أرقام)' : 'Password (6 digits)'}
              className={`ps-9 pe-10 h-10 sm:h-11 text-sm sm:text-base ${passwordError ? 'border-destructive' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {passwordError ? (
            <p className="text-xs text-destructive flex items-center gap-1 mt-1">
              <AlertCircle className="w-3 h-3" />
              {passwordError}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              {isRTL ? 'يجب أن تتكون من 6 أرقام — ستستخدمها لتسجيل الدخول لاحقاً' : 'Must be 6 digits — you will use it to log in later'}
            </p>
          )}
        </div>

        {/* Country & City */}
        <div className="grid grid-cols-2 gap-3">
          {/* Country */}
          <div className="space-y-1">
            <div className="relative">
              <button
                type="button"
                onClick={() => { setCountryOpen(!countryOpen); setCityOpen(false); }}
                className={`flex h-10 sm:h-11 w-full items-center rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${countryError ? "border-destructive" : "border-input"}`}
              >
                <Globe className="w-4 h-4 text-muted-foreground me-2 flex-shrink-0" />
                <span className={`flex-1 text-start truncate ${selectedCountryEntry ? "text-foreground" : "text-muted-foreground"}`}>
                  {selectedCountryEntry ? (isRTL ? selectedCountryEntry.ar : selectedCountryEntry.en) : (isRTL ? 'الدولة' : 'Country')}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
              {countryOpen && (
                <div className="absolute z-50 mt-1 w-full min-w-[200px] rounded-md border border-border bg-popover shadow-lg max-h-60 overflow-hidden">
                  <div className="p-2 border-b border-border">
                    <div className="relative">
                      <Search className="absolute start-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        className="w-full ps-8 pe-3 py-1.5 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                        placeholder={isRTL ? 'بحث...' : 'Search...'}
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredCountries.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        className={`w-full text-start px-3 py-2 text-sm hover:bg-accent transition-colors ${country === c.code ? "bg-accent text-accent-foreground" : ""}`}
                        onClick={() => {
                          setCountry(c.code);
                          setCity('');
                          setCustomCity('');
                          setCountryOpen(false);
                          setCountrySearch('');
                          setCountryError(null);
                          setCityError(null);
                          setCustomCountry('');
                        }}
                      >
                        {isRTL ? c.ar : c.en}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`w-full text-start px-3 py-2 text-sm hover:bg-accent transition-colors text-muted-foreground ${country === OTHER_VALUE ? "bg-accent text-accent-foreground" : ""}`}
                      onClick={() => {
                        setCountry(OTHER_VALUE);
                        setCity('');
                        setCustomCity('');
                        setCountryOpen(false);
                        setCountrySearch('');
                        setCountryError(null);
                      }}
                    >
                      {isRTL ? OTHER_OPTION.ar : OTHER_OPTION.en}
                    </button>
                  </div>
                </div>
              )}
            </div>
            {isOtherCountry && (
              <Input
                type="text"
                value={customCountry}
                onChange={(e) => { setCustomCountry(e.target.value); setCountryError(null); }}
                placeholder={isRTL ? 'اسم الدولة' : 'Country name'}
                className={`text-sm ${countryError ? 'border-destructive' : ''}`}
              />
            )}
            {countryError && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3" />
                {countryError}
              </p>
            )}
          </div>

          {/* City */}
          <div className="space-y-1">
            {hasCities ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setCityOpen(!cityOpen); setCountryOpen(false); }}
                  className={`flex h-10 sm:h-11 w-full items-center rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${cityError ? "border-destructive" : "border-input"}`}
                >
                  <MapPin className="w-4 h-4 text-muted-foreground me-2 flex-shrink-0" />
                  <span className={`flex-1 text-start truncate ${city && city !== OTHER_VALUE ? "text-foreground" : "text-muted-foreground"}`}>
                    {city && city !== OTHER_VALUE ? city : (isRTL ? 'المدينة' : 'City')}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
                {cityOpen && (
                  <div className="absolute z-50 mt-1 w-full min-w-[200px] rounded-md border border-border bg-popover shadow-lg max-h-60 overflow-hidden">
                    <div className="p-2 border-b border-border">
                      <div className="relative">
                        <Search className="absolute start-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          className="w-full ps-8 pe-3 py-1.5 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                          placeholder={isRTL ? 'بحث...' : 'Search...'}
                          value={citySearch}
                          onChange={(e) => setCitySearch(e.target.value)}
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {filteredCities.map((c) => (
                        <button
                          key={c.en}
                          type="button"
                          className={`w-full text-start px-3 py-2 text-sm hover:bg-accent transition-colors ${city === (isRTL ? c.ar : c.en) ? "bg-accent text-accent-foreground" : ""}`}
                          onClick={() => {
                            setCity(isRTL ? c.ar : c.en);
                            setCityOpen(false);
                            setCitySearch('');
                            setCityError(null);
                          }}
                        >
                          {isRTL ? c.ar : c.en}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="w-full text-start px-3 py-2 text-sm hover:bg-accent transition-colors text-muted-foreground"
                        onClick={() => {
                          setCity(OTHER_VALUE);
                          setCityOpen(false);
                          setCitySearch('');
                        }}
                      >
                        {isRTL ? OTHER_OPTION.ar : OTHER_OPTION.en}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative">
                <MapPin className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={isOtherCountry ? customCity : city}
                  onChange={(e) => {
                    if (isOtherCountry) { setCustomCity(e.target.value); }
                    else { setCity(e.target.value); }
                    setCityError(null);
                  }}
                  onFocus={handleInputFocus}
                  placeholder={isRTL ? 'المدينة' : 'City'}
                  className={`ps-9 h-10 sm:h-11 text-sm sm:text-base ${cityError ? "border-destructive" : ""}`}
                />
              </div>
            )}
            {!isOtherCountry && isOtherCity && (
              <Input
                type="text"
                value={customCity}
                onChange={(e) => { setCustomCity(e.target.value); setCityError(null); }}
                placeholder={isRTL ? 'اسم المدينة' : 'City name'}
                className={`text-sm ${cityError ? 'border-destructive' : ''}`}
              />
            )}
            {cityError && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3" />
                {cityError}
              </p>
            )}
          </div>
        </div>

        <Button
          type="submit"
          className="w-full btn-cta h-11 text-base mt-1"
          disabled={loading || isGoogleLoading}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
          ) : (
            isRTL ? 'متابعة إلى الدفع' : 'Continue to Payment'
          )}
        </Button>

        <p className="text-sm text-center text-muted-foreground">
          {isRTL ? 'لديك حساب بالفعل؟' : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); setPassword(''); }}
            className="text-primary hover:underline font-medium"
          >
            {isRTL ? 'تسجيل الدخول' : 'Login'}
          </button>
        </p>

        <p className="text-[11px] text-muted-foreground text-center">
          {isRTL
            ? 'بالتسجيل، أنت توافق على شروط الخدمة وسياسة الخصوصية'
            : 'By signing up, you agree to our Terms of Service and Privacy Policy'}
        </p>
      </form>
    </div>
  );

  const formContent = mode === 'login' ? loginFormContent : signupFormContent;

  const headerContent = mode === 'login' ? null : (
    <p className="text-sm text-muted-foreground text-center mt-1">
      {isRTL
        ? 'سيتم توجيهك للدفع مباشرة بعد التسجيل'
        : "You'll be directed to payment right after signing up"}
    </p>
  );

  const titleText = mode === 'login'
    ? (isRTL ? 'تسجيل الدخول للمتابعة' : 'Login to continue')
    : (isRTL ? 'أنشئ حسابك للمتابعة' : 'Create your account to continue');

  if (!open) return null;

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-foreground text-center flex-1">
            {titleText}
          </h1>
          <div className="w-7" />
        </div>
        {headerContent && (
          <div className="px-4 pt-2 flex-shrink-0">{headerContent}</div>
        )}
        <div
          className="overflow-y-auto overscroll-contain flex-1 min-h-0"
          style={{
            WebkitOverflowScrolling: 'touch',
            paddingBottom: `calc(env(safe-area-inset-bottom) + 24px)`,
          }}
        >
          {formContent}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] bg-card border-2 border-border shadow-2xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg font-bold text-center">
            {titleText}
          </DialogTitle>
          {headerContent}
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
};

export default GuestSignupModal;
