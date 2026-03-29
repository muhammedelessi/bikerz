import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import logoDark from '@/assets/logo-dark.png';
import logoLight from '@/assets/logo-light.png';
import { useTheme } from '@/components/ThemeProvider';
import SEOHead from '@/components/common/SEOHead';

const ForgotPassword: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { isRTL } = useLanguage();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error(t('validation.required'));
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await (supabase.auth as any).resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      setIsSuccess(true);
      toast.success(t('auth.forgotPassword.emailSent'));
    } catch (error: unknown) {
      console.error('Password reset error:', error);
      toast.error(t('errors.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead title="Reset Password" description="Reset your BIKERZ Academy password. Enter your email to receive a password reset link." canonical="/forgot-password" noindex />
      {/* Header */}
      <header className="py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link to="/">
            <img
              src={theme === 'light' ? logoDark : logoLight}
              alt="BIKERZ"
              className="h-6 sm:h-7 lg:h-8 w-auto object-contain"
              loading="eager"
              decoding="async"
            />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 sm:p-8 shadow-xl">
            {isSuccess ? (
              // Success State
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-foreground">
                    {t('auth.forgotPassword.checkEmail')}
                  </h1>
                  <p className="text-muted-foreground">
                    {t('auth.forgotPassword.emailSentDescription')}
                  </p>
                  <p className="text-sm text-muted-foreground mt-4">
                    {email}
                  </p>
                </div>
                <div className="space-y-3">
                  <Link to="/login">
                    <Button variant="outline" className="w-full">
                      {t('auth.forgotPassword.backToLogin')}
                    </Button>
                  </Link>
                  <button
                    onClick={() => setIsSuccess(false)}
                    className="text-sm text-primary hover:underline"
                  >
                    {t('auth.forgotPassword.tryDifferentEmail')}
                  </button>
                </div>
              </div>
            ) : (
              // Form State
              <>
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-8 h-8 text-primary" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                    {t('auth.forgotPassword.title')}
                  </h1>
                  <p className="text-muted-foreground">
                    {t('auth.forgotPassword.subtitle')}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('auth.login.email')}</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={t('auth.emailPlaceholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12"
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="cta"
                    className="w-full h-12"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    ) : (
                      <>
                        {t('auth.forgotPassword.sendLink')}
                        <Arrow className="w-5 h-5" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <Link
                    to="/login"
                    className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                    {t('auth.forgotPassword.backToLogin')}
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ForgotPassword;
