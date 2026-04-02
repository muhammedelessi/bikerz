import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, CheckCircle, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import logoDark from '@/assets/logo-dark.png';
import logoLight from '@/assets/logo-light.png';
import { useTheme } from '@/components/ThemeProvider';
import SEOHead from '@/components/common/SEOHead';

const ResetPassword: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { isRTL } = useLanguage();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState<boolean | null>(null); // null = still checking

  useEffect(() => {
    // Supabase auto-parses hash tokens on load. Check session + listen for events.
    const checkSession = async () => {
      const { data: { session } } = await (supabase.auth as any).getSession();
      if (session) {
        setReady(true);
        setValid(true);
      }
    };

    checkSession();

    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange(
      (event: string, session: any) => {
        if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
          setReady(true);
          setValid(true);
        }
        if (event === 'SIGNED_OUT') {
          setReady(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Timeout: if not ready after 5s, mark as invalid
  useEffect(() => {
    if (ready) return;
    const timeout = setTimeout(() => {
      if (!ready) setValid(false);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [ready]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      toast.error(t('validation.required'));
      return;
    }

    if (password.length < 6) {
      toast.error(isRTL ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error(isRTL ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await (supabase.auth as any).updateUser({ password });
      if (error) throw error;

      setIsSuccess(true);
      toast.success(isRTL ? 'تم تحديث كلمة المرور بنجاح' : 'Password updated successfully');
    } catch (error: any) {
      console.error('Password update error:', error);
      toast.error(error?.message || t('errors.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  const logo = theme === 'light' ? logoDark : logoLight;

  // Still checking
  if (valid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title={isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset Password'}
        description="Set a new password for your BIKERZ Academy account."
        canonical="/reset-password"
        noindex
      />

      <header className="py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link to="/">
            <img src={logo} alt="BIKERZ" width={80} height={32} className="h-6 sm:h-7 lg:h-8 w-auto object-contain" loading="eager" decoding="async" />
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 sm:p-8 shadow-xl">
            {isSuccess ? (
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-foreground">
                    {isRTL ? 'تم تحديث كلمة المرور' : 'Password Updated'}
                  </h1>
                  <p className="text-muted-foreground">
                    {isRTL ? 'تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.' : 'Your password has been changed successfully. You can now log in.'}
                  </p>
                </div>
                <Link to="/login">
                  <Button variant="cta" className="w-full h-12">
                    {isRTL ? 'تسجيل الدخول' : 'Go to Login'}
                  </Button>
                </Link>
              </div>
            ) : !valid ? (
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-8 h-8 text-destructive" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-foreground">
                    {isRTL ? 'هذا الرابط لم يعد صالحاً' : 'This reset link is no longer valid'}
                  </h1>
                  <p className="text-muted-foreground">
                    {isRTL
                      ? 'تنتهي صلاحية روابط إعادة التعيين بعد ساعة واحدة. يرجى طلب رابط جديد.'
                      : 'Reset links expire after 1 hour. Please request a new one.'}
                  </p>
                </div>
                <Link to="/forgot-password">
                  <Button variant="outline" className="w-full h-12">
                    {isRTL ? 'طلب رابط جديد' : 'Request New Link'}
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8 text-primary" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                    {isRTL ? 'كلمة مرور جديدة' : 'Set New Password'}
                  </h1>
                  <p className="text-muted-foreground">
                    {isRTL ? 'أدخل كلمة المرور الجديدة' : 'Enter your new password below'}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="password">{isRTL ? 'كلمة المرور الجديدة' : 'New Password'}</Label>
                    <div className="relative">
                      <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 pe-10" disabled={isLoading} required minLength={6} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">{isRTL ? 'تأكيد كلمة المرور' : 'Confirm Password'}</Label>
                    <div className="relative">
                      <Input id="confirmPassword" type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-12 pe-10" disabled={isLoading} required minLength={6} />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" variant="cta" className="w-full h-12" disabled={isLoading}>
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    ) : (
                      isRTL ? 'تحديث كلمة المرور' : 'Update Password'
                    )}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ResetPassword;
