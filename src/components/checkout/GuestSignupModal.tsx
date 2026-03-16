import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useGHLFormWebhook } from '@/hooks/useGHLFormWebhook';
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
  /** Called after successful signup/login — parent should open checkout */
  onAuthenticated: () => void;
}

const GuestSignupModal: React.FC<GuestSignupModalProps> = ({
  open,
  onOpenChange,
  course,
  onAuthenticated,
}) => {
  const { isRTL } = useLanguage();
  const { sendCourseStatus } = useGHLFormWebhook();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid =
    fullName.trim().length >= 3 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    password.length >= 6;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || loading) return;

    setLoading(true);
    setError(null);

    try {
      // Try signup first
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName.trim() },
        },
      });

      if (signupError) {
        // If already registered, try logging in
        if (
          signupError.message?.includes('already registered') ||
          signupError.message?.includes('already exists') ||
          signupError.message?.includes('User already registered')
        ) {
          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

          if (loginError) {
            setError(
              isRTL
                ? 'البريد مسجل بالفعل. كلمة المرور غير صحيحة.'
                : 'Email already registered. Incorrect password.'
            );
            return;
          }

          // Logged in existing user — go to checkout
          toast.success(isRTL ? 'تم تسجيل الدخول بنجاح' : 'Logged in successfully');
          onOpenChange(false);
          onAuthenticated();
          return;
        }
        throw signupError;
      }

      if (!signupData.user) {
        throw new Error('Account creation failed');
      }

      // Wait for profile trigger
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Update profile with full name
      await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('user_id', signupData.user.id);

      // Send GHL webhook with 'not purchased'
      sendCourseStatus(
        signupData.user.id,
        course.id,
        course.title,
        'not purchased',
        {
          full_name: fullName.trim(),
          email: email.trim(),
          isRTL,
          silent: true,
        }
      );

      toast.success(isRTL ? 'تم إنشاء حسابك بنجاح!' : 'Account created successfully!');
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label htmlFor="guest-name" className="text-sm font-medium">
                {isRTL ? 'الاسم الكامل' : 'Full Name'}
              </Label>
              <Input
                id="guest-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={isRTL ? 'أدخل اسمك الكامل' : 'Enter your full name'}
                className="h-11"
                autoComplete="name"
                dir={isRTL ? 'rtl' : 'ltr'}
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="guest-email" className="text-sm font-medium">
                {isRTL ? 'البريد الإلكتروني' : 'Email'}
              </Label>
              <Input
                id="guest-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isRTL ? 'example@email.com' : 'example@email.com'}
                className="h-11"
                autoComplete="email"
                dir="ltr"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="guest-password" className="text-sm font-medium">
                {isRTL ? 'كلمة المرور' : 'Password'}
              </Label>
              <div className="relative">
                <Input
                  id="guest-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRTL ? '6 أحرف على الأقل' : 'At least 6 characters'}
                  className="h-11 pe-10"
                  autoComplete="new-password"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              className="w-full btn-cta h-12 text-base"
              disabled={!isValid || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                  {isRTL ? 'جاري إنشاء الحساب...' : 'Creating account...'}
                </>
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
