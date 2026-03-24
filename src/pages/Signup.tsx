import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useGHLFormWebhook } from '@/hooks/useGHLFormWebhook';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import LanguageToggle from '@/components/common/LanguageToggle';
import ProfileCompletionWizard from '@/components/profile/ProfileCompletionWizard';
import { useAuthPageContent } from '@/hooks/useAuthPageContent';
import { Eye, EyeOff, ArrowRight, ArrowLeft, AlertCircle, User, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';
import defaultHeroImage from '@/assets/community-ride.webp';
import SEOHead from '@/components/common/SEOHead';
import bikerzLogo from '@/assets/bikerz-logo.webp';

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

const Signup: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const { data: authContent } = useAuthPageContent();
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProfileWizard, setShowProfileWizard] = useState(false);

  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const { sendFormData } = useGHLFormWebhook();

  const cms = authContent?.signup || {};
  const heroImage = cms.image || defaultHeroImage;
  const title = (isRTL ? cms.title_ar : cms.title_en) || t('auth.signup.title');
  const subtitle = (isRTL ? cms.subtitle_ar : cms.subtitle_en) || t('auth.signup.subtitle');
  const buttonText = (isRTL ? cms.button_ar : cms.button_en) || t('auth.signup.button');
  const nameLabel = (isRTL ? cms.name_label_ar : cms.name_label_en) || t('auth.signup.name');
  const emailLabel = (isRTL ? cms.email_label_ar : cms.email_label_en) || t('auth.signup.email');
  const passwordLabel = (isRTL ? cms.password_label_ar : cms.password_label_en) || t('auth.signup.password');
  const hasAccountText = (isRTL ? cms.has_account_ar : cms.has_account_en) || t('auth.signup.hasAccount');
  const loginLinkText = (isRTL ? cms.login_link_ar : cms.login_link_en) || t('auth.signup.loginLink');

  const saveProfileAndSync = async (userId: string, fullName: string, userEmail: string) => {
    try {
      await supabase.functions.invoke('ghl-sync', {
        body: {
          action: 'create_or_update_contact',
          data: { full_name: fullName, email: userEmail },
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

    if (password.length < 6) {
      setError(t('auth.signup.passwordTooShort'));
      return;
    }

    setIsLoading(true);
    
    const { error } = await signUp(email, password, name);
    
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

      setIsGoogleLoading(false);
      await saveProfileAndSync(user.id, googleName, user.email || '');
      toast.success(isRTL ? 'تم التسجيل بنجاح!' : 'Signed up successfully!');
      setShowProfileWizard(true);
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setError(err?.message || (isRTL ? 'فشل تسجيل الدخول بجوجل' : 'Google sign-in failed'));
      setIsGoogleLoading(false);
    }
  };

  const handleProfileWizardClose = (open: boolean) => {
    setShowProfileWizard(open);
    if (!open) {
      navigate(returnTo || '/dashboard');
    }
  };

  return (
    <div className="min-h-screen min-h-[100svh] flex flex-col lg:flex-row">
      <SEOHead title="Sign Up" description="Create your BIKERZ Academy account and start learning motorcycle riding from expert instructors today." canonical="/signup" />
      {/* Image Section - Hidden on mobile */}
      <div className="hidden lg:block flex-1 relative">
        <img
          src={heroImage}
          alt="Motorcycle riders community"
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-l from-background via-background/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
      </div>

      {/* Form Section */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-background safe-area-inset">
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
                loading="lazy" />
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

            {/* Google Sign-In Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 sm:h-12 text-base mb-4 gap-3 border-border"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || isLoading}
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

            {/* Divider */}
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  {isRTL ? 'أو' : 'or'}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
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

              <div className="relative">
                <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={passwordLabel}
                  required
                  minLength={6}
                  className="form-input h-11 sm:h-12 text-base ps-10 pe-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 touch-target"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <Button
                variant="cta"
                className="w-full h-11 sm:h-12 text-base"
                disabled={isLoading || isGoogleLoading}
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
        <img
          src={heroImage}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy" />
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
