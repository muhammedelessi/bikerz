import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useGHLFormWebhook } from '@/hooks/useGHLFormWebhook';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import LanguageToggle from '@/components/common/LanguageToggle';
import ProfileCompletionWizard from '@/components/ui/profile/ProfileCompletionWizard';
import { useAuthPageContent } from '@/hooks/useAuthPageContent';
import { ArrowRight, ArrowLeft, AlertCircle, User, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';
import defaultHeroImage from '@/assets/community-ride.webp';
import SEOHead from '@/components/common/SEOHead';
import logoDark from '@/assets/logo-dark.png';
import logoLight from '@/assets/logo-light.png';
import { useTheme } from '@/components/ThemeProvider';
import SearchableDropdown from '@/components/checkout/SearchableDropdown';
import { PHONE_COUNTRIES } from '@/data/phoneCountryCodes';

const generateRandomPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let password = '';
  for (let i = 0; i < 24; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const Signup: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { isRTL } = useLanguage();
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const { data: authContent } = useAuthPageContent();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phonePrefix, setPhonePrefix] = useState('+966_SA');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [showProfileWizard, setShowProfileWizard] = useState(false);

  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const { sendFormData } = useGHLFormWebhook();

  // Auto-detect country code by user location
  useEffect(() => {
    const detectCountry = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (!res.ok) return;
        const data = await res.json();
        const countryCode = data.country_code;
        const match = PHONE_COUNTRIES.find(c => c.code === countryCode);
        if (match) {
          setPhonePrefix(`${match.prefix}_${match.code}`);
        }
      } catch {
        // fallback to SA
      }
    };
    detectCountry();
  }, []);

  const phonePrefixOptions = useMemo(() =>
    PHONE_COUNTRIES.map(c => ({
      value: `${c.prefix}_${c.code}`,
      label: `${c.prefix} ${isRTL ? c.ar : c.en}`,
    })),
    [isRTL]
  );

  const cms = authContent?.signup || {};
  const heroImage = cms.image || defaultHeroImage;
  const title = (isRTL ? cms.title_ar : cms.title_en) || t('auth.signup.title');
  const subtitle = (isRTL ? cms.subtitle_ar : cms.subtitle_en) || t('auth.signup.subtitle');
  const buttonText = (isRTL ? cms.button_ar : cms.button_en) || t('auth.signup.button');
  const nameLabel = (isRTL ? cms.name_label_ar : cms.name_label_en) || t('auth.signup.name');
  const emailLabel = (isRTL ? cms.email_label_ar : cms.email_label_en) || t('auth.signup.email');
  const hasAccountText = (isRTL ? cms.has_account_ar : cms.has_account_en) || t('auth.signup.hasAccount');
  const loginLinkText = (isRTL ? cms.login_link_ar : cms.login_link_en) || t('auth.signup.loginLink');

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

  const getFullPhone = () => {
    const prefix = phonePrefix.split('_')[0];
    return `${prefix}${phone.replace(/[^0-9]/g, '')}`;
  };

  const saveProfileAndSync = async (userId: string, fullName: string, userEmail: string) => {
    // Save phone to profile
    try {
      await supabase.from('profiles').update({ phone: getFullPhone() }).eq('user_id', userId);
    } catch (e) {
      console.error('Failed to save phone to profile:', e);
    }

    try {
      await supabase.functions.invoke('ghl-sync', {
        body: {
          action: 'create_or_update_contact',
          data: { full_name: fullName, email: userEmail, phone: getFullPhone() },
        },
      });
    } catch (syncErr) {
      console.error('GHL signup sync failed:', syncErr);
    }

    sendFormData({
      full_name: fullName,
      email: userEmail,
      orderStatus: 'not purchased',
      courses: '[]',
      totalPurchased: 0,
      isRTL,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPhoneError(null);

    if (!validatePhone(phone)) return;

    setIsLoading(true);

    // Generate a random password since we don't ask the user for one
    const randomPassword = generateRandomPassword();
    const { error } = await signUp(email, randomPassword, name);

    if (error) {
      setError(error.message);
      setIsLoading(false);
      return;
    }

    try {
      const { data: { user: newUser } } = await (supabase.auth as any).getUser();
      if (newUser) {
        await saveProfileAndSync(newUser.id, name, email);
      }
    } catch (e) {
      console.error('Post-signup sync failed:', e);
    }

    toast.success(t('auth.signup.success'));
    setIsLoading(false);
    setShowProfileWizard(true);
  };

  const handleProfileWizardClose = (open: boolean) => {
    setShowProfileWizard(open);
    if (!open) {
      navigate(returnTo || '/dashboard');
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] w-full overflow-x-hidden flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
      <SEOHead title="Sign Up" description="Create your BIKERZ Academy account and start learning motorcycle riding from expert instructors today." canonical="/signup" />
      {/* Image Section - Hidden on mobile */}
      <div className="hidden lg:block flex-1 relative">
        <picture>
          <source srcSet={heroImage} type="image/webp" />
          <img
            src={heroImage}
            alt="Motorcycle riders community"
            width={1600}
            height={900}
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-l from-background via-background/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
      </div>

      {/* Form Section */}
      <div className="flex-1 flex items-start lg:items-center justify-center p-4 sm:p-6 lg:p-8 pb-8 sm:pb-6 bg-background safe-area-inset">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md mx-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <Link to="/" className="flex items-center">
              <img
                src={theme === 'light' ? logoDark : logoLight}
                alt="BIKERZ"
                className="h-6 sm:h-7 lg:h-8 w-auto object-contain"
                loading="eager"
                decoding="async"
              />
            </Link>
            <LanguageToggle />
          </div>

          {/* Form Card */}
          <div className="card-premium p-4 sm:p-6 lg:p-8 overflow-visible">
            <div className="text-center mb-6 sm:mb-8">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                {title}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                {subtitle}
              </p>
            </div>

            {error && (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="space-y-4 sm:space-y-5 pb-1"
              onFocusCapture={(e) => {
                const el = e.target as HTMLElement | null;
                if (!el) return;
                window.setTimeout(() => {
                  el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
                }, 50);
              }}
            >
              {/* Name */}
              <div className="relative">
                <User className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={nameLabel}
                  required
                  className="form-input h-11 sm:h-12 text-base ps-10"
                />
              </div>

              {/* Email */}
              <div className="relative">
                <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={emailLabel}
                  required
                  className="form-input h-11 sm:h-12 text-base ps-10"
                />
              </div>

              {/* Phone with country code */}
              <div className="space-y-1">
                <div className="flex gap-2" dir="ltr">
                  <div className="flex-shrink-0 w-[120px]">
                    <SearchableDropdown
                      options={phonePrefixOptions}
                      value={phonePrefix}
                      onChange={(val) => setPhonePrefix(val)}
                      placeholder="+---"
                      searchPlaceholder={isRTL ? 'ابحث...' : 'Search...'}
                      dir="ltr"
                    />
                  </div>
                  <div className="relative flex-1">
                    <Phone className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setPhone(val);
                        setPhoneError(null);
                      }}
                      placeholder="5XXXXXXXX"
                      required
                      className={`form-input h-11 sm:h-12 text-base ps-9 ${phoneError ? 'border-destructive' : ''}`}
                      dir="ltr"
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

              <Button
                variant="cta"
                className="w-full h-11 sm:h-12 text-base"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    {buttonText}
                    <Arrow className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-5 sm:mt-6 text-center text-sm sm:text-base text-muted-foreground">
              {hasAccountText}{' '}
              <Link to={returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'} className="text-primary hover:underline font-medium">
                {loginLinkText}
              </Link>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Mobile Hero Image */}
      <div className="lg:hidden absolute inset-0 -z-10 opacity-10">
        <picture>
          <source srcSet={heroImage} type="image/webp" />
          <img
            src={heroImage}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </picture>
      </div>

      {/* Profile Completion Wizard */}
      <ProfileCompletionWizard
        open={showProfileWizard}
        onOpenChange={handleProfileWizardClose}
      />
    </div>
  );
};

export default Signup;
