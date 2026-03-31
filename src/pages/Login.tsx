import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import LanguageToggle from "@/components/common/LanguageToggle";
import { useAuthPageContent } from "@/hooks/useAuthPageContent";
import { Eye, EyeOff, ArrowRight, ArrowLeft, AlertCircle, Phone, Lock } from "lucide-react";
import { toast } from "sonner";
import defaultHeroImage from "@/assets/hero-rider.webp";
import logoDark from '@/assets/logo-dark.png';
import logoLight from '@/assets/logo-light.png';
import { useTheme } from '@/components/ThemeProvider';
import SEOHead from "@/components/common/SEOHead";
import SearchableDropdown from "@/components/checkout/SearchableDropdown";
import { PHONE_COUNTRIES } from "@/data/phoneCountryCodes";
import { supabase } from "@/integrations/supabase/client";

const Login: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { isRTL } = useLanguage();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const { data: authContent } = useAuthPageContent();
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [phonePrefix, setPhonePrefix] = useState("+966_SA");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  // Auto-detect country code by user location
  useEffect(() => {
    const detectCountry = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (!res.ok) return;
        const data = await res.json();
        const match = PHONE_COUNTRIES.find(c => c.code === data.country_code);
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

  const cms = authContent?.login || {};
  const heroImage = cms.image || defaultHeroImage;
  const title = (isRTL ? cms.title_ar : cms.title_en) || t("auth.login.title");
  const subtitle = (isRTL ? cms.subtitle_ar : cms.subtitle_en) || t("auth.login.subtitle");
  const buttonText = (isRTL ? cms.button_ar : cms.button_en) || t("auth.login.button");
  const forgotText = (isRTL ? cms.forgot_ar : cms.forgot_en) || t("auth.login.forgot");
  const noAccountText = (isRTL ? cms.no_account_ar : cms.no_account_en) || t("auth.login.noAccount");
  const signupLinkText = (isRTL ? cms.signup_link_ar : cms.signup_link_en) || t("auth.login.signupLink");

  const getFullPhone = () => {
    const prefix = phonePrefix.split('_')[0];
    return `${prefix}${phone.replace(/[^0-9]/g, '')}`;
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPhoneError(null);
    setPasswordError(null);

    let hasError = false;
    if (!validatePhone(phone)) hasError = true;
    if (!password) {
      setPasswordError(isRTL ? 'يرجى إدخال كلمة المرور' : 'Please enter your password');
      hasError = true;
    }
    if (hasError) return;

    setIsLoading(true);

    // Look up email by phone number using security definer function
    const fullPhone = getFullPhone();
    const { data: email, error: lookupError } = await supabase
      .rpc('get_email_by_phone', { p_phone: fullPhone });

    if (lookupError || !email) {
      setError(isRTL ? 'رقم الهاتف غير مسجل' : 'Phone number not registered');
      setIsLoading(false);
      return;
    }

    const { error } = await signIn(email, password);

    if (error) {
      setError(t("auth.login.invalidCredentials"));
      setIsLoading(false);
      return;
    }

    toast.success(t("auth.login.success"));
    navigate(returnTo || "/dashboard");
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen min-h-[100dvh] w-full overflow-x-hidden flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
      <SEOHead
        title="Login"
        description="Sign in to your BIKERZ Academy account to access your motorcycle riding courses and track your progress."
        canonical="/login"
      />
      {/* Form Section */}
      <div className="flex-1 flex items-start lg:items-center justify-center p-4 sm:p-6 lg:p-8 pb-8 sm:pb-6 bg-background safe-area-inset order-2 lg:order-1">
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
              <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">{title}</h1>
              <p className="text-sm sm:text-base text-muted-foreground">{subtitle}</p>
            </div>

            {error && (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="space-y-4 sm:space-y-6 pb-1"
              onFocusCapture={(e) => {
                const el = e.target as HTMLElement | null;
                if (!el) return;
                window.setTimeout(() => {
                  el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
                }, 50);
              }}
            >
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

              <div className="space-y-1">
                <div className="relative">
                  <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setPasswordError(null); }}
                    placeholder={t("auth.login.password")}
                    className={`form-input h-11 sm:h-12 text-base ps-10 pe-12 ${passwordError ? 'border-destructive' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 touch-target"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {passwordError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end">
                <Link to="/forgot-password" className="text-sm text-primary hover:underline touch-target py-1">
                  {forgotText}
                </Link>
              </div>

              <Button type="submit" variant="cta" className="w-full h-11 sm:h-12 text-base" disabled={isLoading}>
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
              {noAccountText}{" "}
              <Link
                to={returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : "/signup"}
                className="text-primary hover:underline font-medium"
              >
                {signupLinkText}
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
    </div>
  );
};

export default Login;
