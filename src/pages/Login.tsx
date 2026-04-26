import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import LanguageToggle from "@/components/common/LanguageToggle";
import { useAuthPageContent } from "@/hooks/useAuthPageContent";
import { ArrowRight, ArrowLeft, AlertCircle, Fingerprint } from "lucide-react";
import { PasswordField } from "@/components/ui/fields";
import { toast } from "sonner";
import {
  isBiometricSupported,
  isPlatformAuthenticatorAvailable,
  isBiometricEnrolled,
  getEnrolledEmail,
  authenticateBiometric,
  clearBiometric,
  normalizeBiometricError,
} from "@/lib/biometric";
const defaultHeroImage = "/hero-rider.webp";
import logoDark from '@/assets/logo-dark.webp';
import logoLight from '@/assets/logo-light.png';
import { useTheme } from '@/components/ThemeProvider';
import SEOHead from "@/components/common/SEOHead";
import { consumeReturnUrl } from "@/lib/authReturnUrl";
import { FormField, FormAlert } from "@/components/ui/form-field";

const Login: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { isRTL } = useLanguage();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const { data: authContent } = useAuthPageContent();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnrolled, setBioEnrolled] = useState<boolean>(isBiometricEnrolled());
  const [bioEmail, setBioEmail] = useState<string | null>(getEnrolledEmail());
  const [bioLoading, setBioLoading] = useState(false);
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  // Load saved credentials on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('bikerz_remember');
      if (saved) {
        const { email: savedEmail, password: savedPassword } = JSON.parse(saved);
        if (savedEmail) setEmail(savedEmail);
        if (savedPassword) setPassword(savedPassword);
        setRememberMe(true);
      }
    } catch {}
  }, []);

  // Detect biometric support
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!isBiometricSupported()) {
        if (mounted) setBioAvailable(false);
        return;
      }
      const available = await isPlatformAuthenticatorAvailable();
      if (mounted) setBioAvailable(available);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleBiometricLogin = async () => {
    setError(null);
    try {
      // Run WebAuthn first (before setState) so Safari/iOS keeps user activation for Face ID / Touch ID.
      const { email: savedEmail, password: savedPassword } = await authenticateBiometric();
      setBioLoading(true);
      const { error: signInError } = await signIn(savedEmail, savedPassword);
      if (signInError) {
        clearBiometric();
        setBioEnrolled(false);
        setBioEmail(null);
        setError(
          isRTL
            ? "تم تعطيل الدخول بالبصمة لأن كلمة المرور تغيّرت. يرجى تسجيل الدخول وإعادة التفعيل."
            : "Biometric sign-in was disabled because your password changed. Please sign in and re-enable it.",
        );
        return;
      }
      toast.success(t("auth.login.success"));
      const redirectAfterAuth = consumeReturnUrl() || returnTo;
      navigate(redirectAfterAuth || "/dashboard");
    } catch (err: unknown) {
      const { code } = normalizeBiometricError(err);
      if (code === "NOT_ALLOWED" || code === "BIOMETRIC_CANCELLED") {
        /* user dismissed prompt */
      } else if (code === "BIOMETRIC_NOT_ENROLLED") {
        setBioEnrolled(false);
      } else if (code === "BIOMETRIC_DECRYPT_FAILED") {
        clearBiometric();
        setBioEnrolled(false);
        setBioEmail(null);
        toast.error(
          isRTL
            ? "بيانات الدخول المحفوظة غير صالحة. سجّل دخولك بالبريد وكلمة المرور وأعد تفعيل البصمة من الإعدادات."
            : "Stored unlock data is invalid. Sign in with email and password, then enable biometric again in settings.",
        );
      } else if (code !== "UNKNOWN") {
        toast.error(
          isRTL ? "تعذّر استخدام البصمة على هذا الجهاز أو المتصفح." : "Biometric sign-in is not available on this device or browser.",
        );
      } else {
        toast.error(isRTL ? "فشل تسجيل الدخول بالبصمة" : "Biometric sign-in failed");
      }
    } finally {
      setBioLoading(false);
    }
  };

  const cms = authContent?.login || {};
  const heroImage = cms.image || defaultHeroImage;
  const title = (isRTL ? cms.title_ar : cms.title_en) || t("auth.login.title");
  const subtitle = (isRTL ? cms.subtitle_ar : cms.subtitle_en) || t("auth.login.subtitle");
  const buttonText = (isRTL ? cms.button_ar : cms.button_en) || t("auth.login.button");
  const forgotText = (isRTL ? cms.forgot_ar : cms.forgot_en) || t("auth.login.forgot");
  const noAccountText = (isRTL ? cms.no_account_ar : cms.no_account_en) || t("auth.login.noAccount");
  const signupLinkText = (isRTL ? cms.signup_link_ar : cms.signup_link_en) || t("auth.login.signupLink");
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEmailError(null);
    setPasswordError(null);

    let hasError = false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setEmailError(isRTL ? 'يرجى إدخال البريد الإلكتروني' : 'Please enter your email');
      hasError = true;
    } else if (!emailRegex.test(email.trim())) {
      setEmailError(isRTL ? 'البريد الإلكتروني غير صالح' : 'Invalid email address');
      hasError = true;
    }
    if (!password) {
      setPasswordError(isRTL ? 'يرجى إدخال كلمة المرور' : 'Please enter your password');
      hasError = true;
    }
    if (hasError) return;
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError(t("auth.login.invalidCredentials"));
      setIsLoading(false);
      return;
    }

    // Save or clear remembered credentials
    if (rememberMe) {
      localStorage.setItem('bikerz_remember', JSON.stringify({ email, password }));
    } else {
      localStorage.removeItem('bikerz_remember');
    }

    toast.success(t("auth.login.success"));
    const redirectAfterAuth = consumeReturnUrl() || returnTo;
    navigate(redirectAfterAuth || "/dashboard");
  };

  return (
    <div
      id="main-content"
      className="min-h-screen min-h-[100dvh] w-full overflow-x-hidden flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden"
    >
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
                width={80}
                height={32}
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

            <div className="mb-4 sm:mb-6">
              <FormAlert message={error} />
            </div>

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
              <FormField label={t("fields.email.label")} error={emailError} required>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                  placeholder={t("fields.email.placeholder")}
                  className={`form-input h-11 sm:h-12 text-base ${emailError ? 'border-destructive' : ''}`}
                />
              </FormField>

              <PasswordField
                value={password}
                onChange={(val) => { setPassword(val); setPasswordError(null); }}
                error={passwordError}
                required
              />

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

              {bioAvailable && bioEnrolled && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border/60" />
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {isRTL ? "أو" : "or"}
                    </span>
                    <div className="flex-1 h-px bg-border/60" />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 sm:h-12 text-base gap-2"
                    onClick={handleBiometricLogin}
                    disabled={bioLoading || isLoading}
                  >
                    {bioLoading ? (
                      <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    ) : (
                      <>
                        <Fingerprint className="w-5 h-5 text-primary" />
                        <span>
                          {isRTL ? "تسجيل الدخول بالبصمة" : "Sign in with biometric"}
                        </span>
                      </>
                    )}
                  </Button>
                  {bioEmail && (
                    <p className="text-[11px] text-center text-muted-foreground truncate">
                      {bioEmail}
                    </p>
                  )}
                </div>
              )}
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
            width={1920}
            height={1080}
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
