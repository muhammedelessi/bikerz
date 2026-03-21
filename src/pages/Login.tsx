import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import LanguageToggle from '@/components/common/LanguageToggle';
import { useAuthPageContent } from '@/hooks/useAuthPageContent';
import { Eye, EyeOff, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import defaultHeroImage from '@/assets/hero-rider.jpg';
import bikerzLogo from '@/assets/bikerz-logo.png';
import SEOHead from '@/components/common/SEOHead';

const Login: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const { data: authContent } = useAuthPageContent();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGoogleUser, setIsGoogleUser] = useState(false);
  const [emailChecked, setEmailChecked] = useState(false);
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const checkIfGoogleUser = useCallback(async (emailValue: string) => {
    if (!emailValue || !emailValue.includes('@')) {
      setIsGoogleUser(false);
      setEmailChecked(false);
      return;
    }
    try {
      const { data } = await supabase.rpc('check_google_provider' as any, { p_email: emailValue });
      const result = data as boolean;
      setIsGoogleUser(!!result);
      setEmailChecked(true);
    } catch {
      setIsGoogleUser(false);
      setEmailChecked(true);
    }
  }, []);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError(null);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
        extraParams: email ? { login_hint: email } : undefined,
      });
      if (result.error) {
        setError(isRTL ? 'فشل تسجيل الدخول بجوجل' : 'Google sign-in failed');
      }
    } catch {
      setError(isRTL ? 'فشل تسجيل الدخول بجوجل' : 'Google sign-in failed');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const cms = authContent?.login || {};
  const heroImage = cms.image || defaultHeroImage;
  const title = (isRTL ? cms.title_ar : cms.title_en) || t('auth.login.title');
  const subtitle = (isRTL ? cms.subtitle_ar : cms.subtitle_en) || t('auth.login.subtitle');
  const buttonText = (isRTL ? cms.button_ar : cms.button_en) || t('auth.login.button');
  const forgotText = (isRTL ? cms.forgot_ar : cms.forgot_en) || t('auth.login.forgot');
  const noAccountText = (isRTL ? cms.no_account_ar : cms.no_account_en) || t('auth.login.noAccount');
  const signupLinkText = (isRTL ? cms.signup_link_ar : cms.signup_link_en) || t('auth.login.signupLink');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      setError(t('auth.login.invalidCredentials'));
      setIsLoading(false);
      return;
    }
    
    toast.success(t('auth.login.success'));
    navigate(returnTo || '/dashboard');
  };

  return (
    <div className="min-h-screen min-h-[100svh] flex flex-col lg:flex-row">
      <SEOHead title="Login" description="Sign in to your BIKERZ Academy account to access your motorcycle riding courses and track your progress." canonical="/login" />
      {/* Form Section */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-background safe-area-inset order-2 lg:order-1">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <Link to="/" className="flex items-center">
              <img
                src={bikerzLogo}
                alt="BIKERZ"
                className="h-10 sm:h-12 lg:h-14 w-auto object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
              />
            </Link>
            <LanguageToggle />
          </div>

          {/* Form Card */}
          <div className="card-premium p-5 sm:p-6 lg:p-8">
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

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm sm:text-base">{t('auth.login.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="form-input h-11 sm:h-12 text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm sm:text-base">{t('auth.login.password')}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="form-input h-11 sm:h-12 text-base pe-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 touch-target"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <Link to="/forgot-password" className="text-sm text-primary hover:underline touch-target py-1">
                  {forgotText}
                </Link>
              </div>

              <Button
                type="submit"
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
              {noAccountText}{' '}
              <Link to={returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : '/signup'} className="text-primary hover:underline font-medium">
                {signupLinkText}
              </Link>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Image Section - Hidden on mobile, visible on desktop */}
      <div className="hidden lg:block flex-1 relative order-1 lg:order-2">
        <img
          src={heroImage}
          alt="Motorcycle rider"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
      </div>

      {/* Mobile Hero Image - Visible only on mobile as subtle background */}
      <div className="lg:hidden absolute inset-0 -z-10 opacity-10">
        <img
          src={heroImage}
          alt=""
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
};

export default Login;
