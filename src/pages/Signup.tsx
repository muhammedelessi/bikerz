import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useGHLFormWebhook } from '@/hooks/useGHLFormWebhook';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import LanguageToggle from '@/components/common/LanguageToggle';
import ProfileCompletionWizard from '@/components/profile/ProfileCompletionWizard';
import { useAuthPageContent } from '@/hooks/useAuthPageContent';
import { Eye, EyeOff, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import defaultHeroImage from '@/assets/community-ride.jpg';
import SEOHead from '@/components/common/SEOHead';
import bikerzLogo from '@/assets/bikerz-logo.png';

const Signup: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const { data: authContent } = useAuthPageContent();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
  const confirmLabel = (isRTL ? cms.confirm_label_ar : cms.confirm_label_en) || t('auth.signup.confirmPassword');
  const hasAccountText = (isRTL ? cms.has_account_ar : cms.has_account_en) || t('auth.signup.hasAccount');
  const loginLinkText = (isRTL ? cms.login_link_ar : cms.login_link_en) || t('auth.signup.loginLink');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t('auth.signup.passwordMismatch'));
      return;
    }

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
    
    // Sync new contact to GHL CRM immediately after signup
    try {
      await supabase.functions.invoke('ghl-sync', {
        body: {
          action: 'create_or_update_contact',
          data: {
            full_name: name,
            email,
          },
        },
      });
    } catch (syncErr) {
      console.error('GHL signup sync failed:', syncErr);
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
    <div className="min-h-screen min-h-[100svh] flex flex-col lg:flex-row">
      <SEOHead title="Sign Up" description="Create your BIKERZ Academy account and start learning motorcycle riding from expert instructors today." canonical="/signup" />
      {/* Image Section - Hidden on mobile */}
      <div className="hidden lg:block flex-1 relative">
        <img
          src={heroImage}
          alt="Motorcycle riders community"
          className="absolute inset-0 w-full h-full object-cover"
        />
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

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm sm:text-base">{nameLabel}</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('auth.signup.namePlaceholder')}
                  required
                  className="form-input h-11 sm:h-12 text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm sm:text-base">{emailLabel}</Label>
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
                <Label htmlFor="password" className="text-sm sm:text-base">{passwordLabel}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm sm:text-base">{confirmLabel}</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="form-input h-11 sm:h-12 text-base pe-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 touch-target"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
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
              {hasAccountText}{' '}
              <Link to={returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'} className="text-primary hover:underline font-medium">
                {loginLinkText}
              </Link>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Mobile Hero Image - Visible only on mobile as subtle background */}
      <div className="lg:hidden absolute inset-0 -z-10 opacity-10">
        <img
          src={heroImage}
          alt=""
          className="w-full h-full object-cover"
        />
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
