import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useGHLFormWebhook } from '@/hooks/useGHLFormWebhook';
import { useAuthPageContent } from '@/hooks/useAuthPageContent';
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
import { Loader2, AlertCircle, Zap, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

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
  const { sendCourseStatus } = useGHLFormWebhook();
  const { data: authContent } = useAuthPageContent();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use same CMS labels as Signup page
  const cms = authContent?.signup || {};
  const nameLabel = (isRTL ? cms.name_label_ar : cms.name_label_en) || t('auth.signup.name');
  const emailLabel = (isRTL ? cms.email_label_ar : cms.email_label_en) || t('auth.signup.email');
  const passwordLabel = (isRTL ? cms.password_label_ar : cms.password_label_en) || t('auth.signup.password');
  const confirmLabel = (isRTL ? cms.confirm_label_ar : cms.confirm_label_en) || t('auth.signup.confirmPassword');

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

    setLoading(true);

    try {
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
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

      await supabase
        .from('profiles')
        .update({ full_name: name.trim() })
        .eq('user_id', signupData.user.id);

      sendCourseStatus(
        signupData.user.id,
        course.id,
        course.title,
        'not purchased',
        {
          full_name: name.trim(),
          email: email.trim(),
          isRTL,
          silent: true,
        }
      );

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] bg-card border-2 border-border shadow-2xl p-0 overflow-hidden mx-4">
        <div className="p-5 sm:p-6 space-y-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-center">
              {isRTL ? 'أنشئ حسابك للمتابعة' : 'Create your account to continue'}
            </DialogTitle>
            <p className="text-sm text-muted-foreground text-center mt-1">
              {isRTL
                ? 'سيتم توجيهك للدفع مباشرة بعد التسجيل'
                : "You'll be directed to payment right after signing up"}
            </p>
          </DialogHeader>

          {error && (
            <div className="p-3 sm:p-4 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Name — same as Signup page */}
            <div className="space-y-2">
              <Label htmlFor="guest-name" className="text-sm sm:text-base">{nameLabel}</Label>
              <Input
                id="guest-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('auth.signup.namePlaceholder')}
                required
                className="form-input h-11 sm:h-12 text-base"
              />
            </div>

            {/* Email — same as Signup page */}
            <div className="space-y-2">
              <Label htmlFor="guest-email" className="text-sm sm:text-base">{emailLabel}</Label>
              <Input
                id="guest-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="form-input h-11 sm:h-12 text-base"
              />
            </div>

            {/* Password — same as Signup page */}
            <div className="space-y-2">
              <Label htmlFor="guest-password" className="text-sm sm:text-base">{passwordLabel}</Label>
              <div className="relative">
                <Input
                  id="guest-password"
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
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password — same as Signup page */}
            <div className="space-y-2">
              <Label htmlFor="guest-confirm-password" className="text-sm sm:text-base">{confirmLabel}</Label>
              <div className="relative">
                <Input
                  id="guest-confirm-password"
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
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full btn-cta h-11 sm:h-12 text-base"
              disabled={loading}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  <Zap className="w-5 h-5 me-2" />
                  {isRTL ? 'متابعة إلى الدفع' : 'Continue to Payment'}
                </>
              )}
            </Button>

            <p className="text-[11px] text-muted-foreground text-center">
              {isRTL
                ? 'بالتسجيل، أنت توافق على شروط الخدمة وسياسة الخصوصية'
                : 'By signing up, you agree to our Terms of Service and Privacy Policy'}
            </p>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GuestSignupModal;
