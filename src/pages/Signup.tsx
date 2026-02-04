import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import LanguageToggle from '@/components/common/LanguageToggle';
import ProfileCompletionWizard from '@/components/profile/ProfileCompletionWizard';
import { Eye, EyeOff, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import heroImage from '@/assets/community-ride.jpg';
import bikerzLogo from '@/assets/bikerz-logo.png';

const Signup: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { signUp } = useAuth();
  const navigate = useNavigate();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(isRTL ? 'كلمات المرور غير متطابقة' : 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError(isRTL ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    
    const { error } = await signUp(email, password, name);
    
    if (error) {
      setError(error.message);
      setIsLoading(false);
      return;
    }
    
    toast.success(isRTL ? 'تم إنشاء الحساب بنجاح!' : 'Account created successfully!');
    setIsLoading(false);
    // Show profile completion wizard instead of navigating immediately
    setShowProfileWizard(true);
  };

  const handleProfileWizardClose = (open: boolean) => {
    setShowProfileWizard(open);
    if (!open) {
      // Navigate to dashboard when wizard is closed (completed or skipped)
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen min-h-[100svh] flex flex-col lg:flex-row">
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
                {t('auth.signup.title')}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                {t('auth.signup.subtitle')}
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
                <Label htmlFor="name" className="text-sm sm:text-base">{t('auth.signup.name')}</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isRTL ? 'اسمك الكامل' : 'Your full name'}
                  required
                  className="form-input h-11 sm:h-12 text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm sm:text-base">{t('auth.signup.email')}</Label>
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
                <Label htmlFor="password" className="text-sm sm:text-base">{t('auth.signup.password')}</Label>
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
                <Label htmlFor="confirmPassword" className="text-sm sm:text-base">{t('auth.signup.confirmPassword')}</Label>
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
                    {t('auth.signup.button')}
                    <Arrow className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-5 sm:mt-6 text-center text-sm sm:text-base text-muted-foreground">
              {t('auth.signup.hasAccount')}{' '}
              <Link to="/login" className="text-primary hover:underline font-medium">
                {t('auth.signup.loginLink')}
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
