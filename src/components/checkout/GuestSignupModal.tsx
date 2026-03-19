import React, { useEffect, useState } from 'react';
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
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Zap, Eye, EyeOff } from 'lucide-react';
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
  const isMobile = useIsMobile();
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const cms = authContent?.signup || {};
  const nameLabel = (isRTL ? cms.name_label_ar : cms.name_label_en) || t('auth.signup.name');
  const emailLabel = (isRTL ? cms.email_label_ar : cms.email_label_en) || t('auth.signup.email');
  const passwordLabel = (isRTL ? cms.password_label_ar : cms.password_label_en) || t('auth.signup.password');
  const confirmLabel = (isRTL ? cms.confirm_label_ar : cms.confirm_label_en) || t('auth.signup.confirmPassword');

  useEffect(() => {
    if (!open || !isIOS || typeof window === 'undefined' || !window.visualViewport) {
      setKeyboardOffset(0);
      return;
    }

    const viewport = window.visualViewport;

    const updateKeyboardOffset = () => {
      const offset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardOffset(offset);
    };

    updateKeyboardOffset();
    viewport.addEventListener('resize', updateKeyboardOffset);
    viewport.addEventListener('scroll', updateKeyboardOffset);

    return () => {
      viewport.removeEventListener('resize', updateKeyboardOffset);
      viewport.removeEventListener('scroll', updateKeyboardOffset);
      setKeyboardOffset(0);
    };
  }, [open, isIOS]);

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

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!isIOS) return;

    const input = e.target;

    requestAnimationFrame(() => {
      input.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      setTimeout(() => {
        input.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }, 250);
    });
  };

  const formContent = (
    <div className="p-5 sm:p-6 space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="guest-name" className="text-sm">{nameLabel}</Label>
          <Input
            id="guest-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={handleInputFocus}
            placeholder={t('auth.signup.namePlaceholder')}
            required
            className="form-input h-10 sm:h-11 text-sm sm:text-base"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="guest-email" className="text-sm">{emailLabel}</Label>
          <Input
            id="guest-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={handleInputFocus}
            placeholder="your@email.com"
            required
            className="form-input h-10 sm:h-11 text-sm sm:text-base"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="guest-password" className="text-sm">{passwordLabel}</Label>
          <div className="relative">
            <Input
              id="guest-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={handleInputFocus}
              placeholder="••••••••"
              required
              minLength={6}
              className="form-input h-10 sm:h-11 text-sm sm:text-base pe-12"
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
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="guest-confirm-password" className="text-sm">{confirmLabel}</Label>
          <div className="relative">
            <Input
              id="guest-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onFocus={handleInputFocus}
              placeholder="••••••••"
              required
              className="form-input h-10 sm:h-11 text-sm sm:text-base pe-12"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full btn-cta h-11 text-base mt-1"
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
  );

  const headerContent = (
    <>
      <p className="text-sm text-muted-foreground text-center mt-1">
        {isRTL
          ? 'سيتم توجيهك للدفع مباشرة بعد التسجيل'
          : "You'll be directed to payment right after signing up"}
      </p>
    </>
  );

  const titleText = isRTL ? 'أنشئ حسابك للمتابعة' : 'Create your account to continue';

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className="bg-card border-border h-[100dvh] max-h-[100dvh] overflow-hidden"
          style={{ height: '100dvh', maxHeight: '100dvh' }}
        >
          <DrawerHeader className="pb-1 pt-2 flex-shrink-0">
            <DrawerTitle className="text-base font-bold text-center">
              {titleText}
            </DrawerTitle>
            {headerContent}
          </DrawerHeader>
          <div
            className="overflow-y-auto pb-safe overscroll-contain flex-1"
            style={{
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              scrollPaddingBottom: `${keyboardOffset + 24}px`,
              paddingBottom: `calc(env(safe-area-inset-bottom) + ${keyboardOffset + 24}px)`,
            }}
          >
            {formContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] bg-card border-2 border-border shadow-2xl p-0 overflow-hidden">
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
