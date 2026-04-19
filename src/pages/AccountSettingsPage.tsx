import React, { useState, useEffect } from 'react';
import SEOHead from '@/components/common/SEOHead';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Skeleton } from '@/components/ui/skeleton';
import LanguageToggle from '@/components/common/LanguageToggle';
import { AccountSettings } from '@/components/ui/profile/AccountSettings';
import {
  Menu,
  X,
  Home,
  BookOpen,
  GraduationCap,
  Users,
  Settings,
  ShieldCheck,
  User,
} from 'lucide-react';
import logoDark from '@/assets/logo-dark.png';
import logoLight from '@/assets/logo-light.png';
import { useTheme } from '@/components/ThemeProvider';

const AccountSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { profile, isLoading, isUpdating, updateProfile } = useUserProfile();

  const { theme } = useTheme();
  const themeLogo = theme === 'light' ? logoDark : logoLight;

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const settingsLabel = isRTL ? 'الإعدادات والأمان' : 'Settings & Security';
  const settingsSubtitle = isRTL
    ? 'إدارة حسابك وتفضيلاتك وأمان تسجيل الدخول'
    : 'Manage your account, preferences, and sign-in security';

  const navItems = [
    { icon: Home, label: t('nav.home'), to: '/' },
    { icon: BookOpen, label: t('nav.courses'), to: '/courses' },
    { icon: GraduationCap, label: t('dashboard.myCourses'), to: '/dashboard' },
    { icon: Users, label: t('nav.mentors'), to: '/mentors' },
    { icon: User, label: t('profile.title'), to: '/profile' },
    { icon: ShieldCheck, label: settingsLabel, to: '/settings', active: true },
    ...(isAdmin ? [{ icon: Settings, label: t('nav.adminPanel'), to: '/admin' }] : []),
  ];

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex">
      <SEOHead
        title={settingsLabel}
        description="Manage your BIKERZ Academy account, preferences, and biometric sign-in."
        noindex
      />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 z-50 w-[280px] max-w-[85vw] bg-card border-e border-border transform transition-transform duration-300 ease-out lg:translate-x-0 ${
          sidebarOpen
            ? 'translate-x-0'
            : isRTL
              ? 'translate-x-full'
              : '-translate-x-full'
        } ${isRTL ? 'right-0' : 'left-0'}`}
      >
        <div className="flex flex-col h-full safe-area-inset">
          <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between">
            <Link to="/" className="flex items-center">
              <img
                src={themeLogo}
                alt="BIKERZ"
                className="h-6 sm:h-7 lg:h-8 w-auto object-contain"
                loading={sidebarOpen ? 'eager' : 'lazy'}
                decoding="async"
              />
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors touch-target"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 p-3 sm:p-4 space-y-1 sm:space-y-2 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-3 rounded-lg transition-all duration-300 touch-target ${
                  item.active
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground active:bg-muted/70'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      <main className="flex-1 lg:ms-[280px] min-w-0">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border safe-area-top">
          <div className="flex items-center justify-between p-3 sm:p-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors touch-target flex-shrink-0"
                aria-label="Open sidebar"
              >
                <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">
                  {settingsLabel}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  {settingsSubtitle}
                </p>
              </div>
            </div>
            <LanguageToggle />
          </div>
        </header>

        <div className="p-4 sm:p-6 space-y-6 safe-area-bottom max-w-3xl">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
            </div>
          ) : profile ? (
            <AccountSettings
              profile={profile}
              onUpdate={updateProfile}
              isUpdating={isUpdating}
            />
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {t('profile.notFound')}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AccountSettingsPage;
