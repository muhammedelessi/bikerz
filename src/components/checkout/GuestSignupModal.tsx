import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
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
import { AlertCircle, Eye, EyeOff, User, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

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
  const { sendFormData, sendCourseStatus } = useGHLFormWebhook();
  const { data: authContent } = useAuthPageContent();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isAndroid = typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent);

  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visualViewportHeight, setVisualViewportHeight] = useState<number | null>(null);
  const [isGoogleUser, setIsGoogleUser] = useState(false);
  const [emailChecked, setEmailChecked] = useState(false);

  const cms = authContent?.signup || {};
  const nameLabel = (isRTL ? cms.name_label_ar : cms.name_label_en) || t('auth.signup.name');
  const emailLabel = (isRTL ? cms.email_label_ar : cms.email_label_en) || t('auth.signup.email');
  const passwordLabel = (isRTL ? cms.password_label_ar : cms.password_label_en) || t('auth.signup.password');

  // Hide navbar on mobile when modal is open
  useEffect(() => {
    if (open && isMobile) {
      document.body.classList.add('guest-modal-open');
    } else {
      document.body.classList.remove('guest-modal-open');
    }
    return () => {
      document.body.classList.remove('guest-modal-open');
    };
  }, [open, isMobile]);

  useEffect(() => {
    if (!open || typeof window === 'undefined' || !window.visualViewport) {
      setVisualViewportHeight(null);
      return;
    }

    const viewport = window.visualViewport;

    const updateHeight = () => {
      // Use requestAnimationFrame for smoother updates on iOS
      requestAnimationFrame(() => {
        setVisualViewportHeight(viewport.height);
      });
    };

    updateHeight();
    viewport.addEventListener('resize', updateHeight);
    viewport.addEventListener('scroll', updateHeight);

    return () => {
      viewport.removeEventListener('resize', updateHeight);
      viewport.removeEventListener('scroll', updateHeight);
      setVisualViewportHeight(null);
    };
  }, [open]);

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

    sendCourseStatus(userId, course.id, course.title, 'not purchased', {
      full_name: fullName,
      email: userEmail,
      isRTL,
      silent: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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

      await saveProfileAndSync(signupData.user.id, name.trim(), email.trim());

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

      await saveProfileAndSync(user.id, googleName, user.email || '');

      toast.success(isRTL ? 'تم التسجيل بنجاح!' : 'Signed up successfully!');
      setIsGoogleLoading(false);
      onOpenChange(false);
      onAuthenticated();
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setError(err?.message || (isRTL ? 'فشل تسجيل الدخول بجوجل' : 'Google sign-in failed'));
      setIsGoogleLoading(false);
    }
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const input = e.target;
    setTimeout(() => {
      input.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }, 300);
  };

  const checkProviders = async (emailValue: string) => {
    if (!emailValue || !emailValue.includes('@')) {
      setIsGoogleUser(false);
      setEmailChecked(false);
      return;
    }
    try {
      const { data } = await supabase.rpc('get_auth_providers' as any, { p_email: emailValue });
      const result = data as { has_email: boolean; has_google: boolean; exists: boolean } | null;
      setIsGoogleUser(!!result?.has_google && !result?.has_email);
      setEmailChecked(true);
    } catch {
      setIsGoogleUser(false);
      setEmailChecked(true);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (emailChecked && isGoogleUser) {
      setError(isRTL ? 'هذا الحساب مسجل عبر جوجل. استخدم زر جوجل لتسجيل الدخول.' : 'This account was created with Google. Please use the Google button to sign in.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: loginError } = await (supabase.auth as any).signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) {
        if (!emailChecked) await checkProviders(email);
        if (isGoogleUser) {
          setError(isRTL ? 'هذا الحساب مسجل عبر جوجل. استخدم زر جوجل لتسجيل الدخول.' : 'This account was created with Google. Please use the Google button to sign in.');
        } else {
          setError(isRTL ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' : 'Invalid email or password');
        }
        return;
      }

      toast.success(isRTL ? 'تم تسجيل الدخول بنجاح!' : 'Logged in successfully!');
      onOpenChange(false);
      onAuthenticated();
    } catch (err: any) {
      setError(err.message || (isRTL ? 'فشل تسجيل الدخول' : 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const loginFormContent = (
    <div className="p-5 sm:p-6 space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Google Sign-In Button */}
      <Button
        type="button"
        variant="outline"
        className="w-full h-10 sm:h-11 text-sm sm:text-base gap-3 border-border"
        onClick={handleGoogleSignIn}
        disabled={isGoogleLoading || loading}
      >
        {isGoogleLoading ? (
          <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
        ) : (
          <>
            <GoogleIcon />
            {isRTL ? 'تسجيل الدخول بجوجل' : 'Sign in with Google'}
          </>
        )}
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">
            {isRTL ? 'أو' : 'or'}
          </span>
        </div>
      </div>

      <form onSubmit={handleLogin} className="space-y-3.5">
        <div className="relative">
          <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          <Input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailChecked(false); setIsGoogleUser(false); }}
            onBlur={() => checkProviders(email)}
            onFocus={handleInputFocus}
            placeholder={emailLabel}
            required
            className="form-input h-10 sm:h-11 text-sm sm:text-base ps-10"
          />
        </div>

        {emailChecked && isGoogleUser ? (
          <p className="text-sm text-muted-foreground text-center">
            {isRTL ? 'هذا الحساب مسجل عبر جوجل. استخدم زر جوجل أعلاه.' : 'This account was created with Google. Use the Google button above.'}
          </p>
        ) : (
          <>
            <div className="relative">
              <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={handleInputFocus}
                placeholder={passwordLabel}
                required
                className="form-input h-10 sm:h-11 text-sm sm:text-base ps-10 pe-12"
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

            <Button
              type="submit"
              className="w-full btn-cta h-11 text-base mt-1"
              disabled={loading || isGoogleLoading}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                isRTL ? 'تسجيل الدخول والمتابعة' : 'Login & Continue to Payment'
              )}
            </Button>
          </>
        )}

        <p className="text-sm text-center text-muted-foreground">
          {isRTL ? 'ليس لديك حساب؟' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null); setPassword(''); }}
            className="text-primary hover:underline font-medium"
          >
            {isRTL ? 'إنشاء حساب' : 'Sign up'}
          </button>
        </p>
      </form>
    </div>
  );

  const formContent = mode === 'login' ? loginFormContent : (
    <div className="p-5 sm:p-6 space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Google Sign-In Button */}
      <Button
        type="button"
        variant="outline"
        className="w-full h-10 sm:h-11 text-sm sm:text-base gap-3 border-border"
        onClick={handleGoogleSignIn}
        disabled={isGoogleLoading || loading}
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
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">
            {isRTL ? 'أو' : 'or'}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="relative">
          <User className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          <Input
            id="guest-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={handleInputFocus}
            placeholder={nameLabel}
            required
            className="form-input h-10 sm:h-11 text-sm sm:text-base ps-10"
          />
        </div>

        <div className="relative">
          <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          <Input
            id="guest-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={handleInputFocus}
            placeholder={emailLabel}
            required
            className="form-input h-10 sm:h-11 text-sm sm:text-base ps-10"
          />
        </div>

        <div className="relative">
          <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          <Input
            id="guest-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={handleInputFocus}
            placeholder={passwordLabel}
            required
            minLength={6}
            className="form-input h-10 sm:h-11 text-sm sm:text-base ps-10 pe-12"
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

        <Button
          type="submit"
          className="w-full btn-cta h-11 text-base mt-1"
          disabled={loading || isGoogleLoading}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
          ) : (
            isRTL ? 'متابعة إلى الدفع' : 'Continue to Payment'
          )}
        </Button>

        <p className="text-sm text-center text-muted-foreground">
          {isRTL ? 'لديك حساب بالفعل؟' : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); setPassword(''); }}
            className="text-primary hover:underline font-medium"
          >
            {isRTL ? 'تسجيل الدخول' : 'Login'}
          </button>
        </p>

        <p className="text-[11px] text-muted-foreground text-center">
          {isRTL
            ? 'بالتسجيل، أنت توافق على شروط الخدمة وسياسة الخصوصية'
            : 'By signing up, you agree to our Terms of Service and Privacy Policy'}
        </p>
      </form>
    </div>
  );

  const headerContent = mode === 'login' ? null : (
    <p className="text-sm text-muted-foreground text-center mt-1">
      {isRTL
        ? 'سيتم توجيهك للدفع مباشرة بعد التسجيل'
        : "You'll be directed to payment right after signing up"}
    </p>
  );

  const titleText = mode === 'login'
    ? (isRTL ? 'تسجيل الدخول للمتابعة' : 'Login to continue')
    : (isRTL ? 'أنشئ حسابك للمتابعة' : 'Create your account to continue');

  const drawerHeight = visualViewportHeight != null
    ? `${visualViewportHeight}px`
    : '100dvh';

  // On iOS, when keyboard opens the visual viewport shrinks and offsets.
  // We need to position the drawer at the top of the visual viewport, not bottom.
  const drawerStyle: React.CSSProperties = isIOS && visualViewportHeight != null
    ? {
        height: `${visualViewportHeight}px`,
        maxHeight: `${visualViewportHeight}px`,
        top: `${window.visualViewport?.offsetTop ?? 0}px`,
        bottom: 'auto',
        transition: 'height 0.1s ease, top 0.1s ease',
      }
    : {
        height: drawerHeight,
        maxHeight: drawerHeight,
        transition: 'height 0.15s ease',
      };

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className="bg-card border-border overflow-hidden flex flex-col"
          style={drawerStyle}
        >
          <DrawerHeader className="pb-1 pt-2 flex-shrink-0">
            <DrawerTitle className="text-base font-bold text-center">
              {titleText}
            </DrawerTitle>
            {headerContent}
          </DrawerHeader>
          <div
            className="overflow-y-auto overscroll-contain flex-1 min-h-0"
            style={{
              WebkitOverflowScrolling: 'touch',
              paddingBottom: `calc(env(safe-area-inset-bottom) + 24px)`,
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
      <DialogContent className="sm:max-w-[420px] bg-card border-2 border-border shadow-2xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
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
