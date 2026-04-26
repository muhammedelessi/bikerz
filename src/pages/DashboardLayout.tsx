import React, { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import LanguageToggle from '@/components/common/LanguageToggle';
import LogoutConfirmDialog from '@/components/common/LogoutConfirmDialog';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  Home,
  GraduationCap,
  Award,
  Settings,
  ShieldCheck,
  Ticket,
  LogOut,
  Menu,
  X,
  User,
  BadgeCheck,
} from 'lucide-react';
import logoDark from '@/assets/logo-dark.webp';
import logoLight from '@/assets/logo-light.png';
import { useTheme } from '@/components/ThemeProvider';

const DashboardLayout: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, profile, signOut, isAdmin, isInstructor, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const path = location.pathname;
  const isApplyTrainerRoute = path.startsWith('/dashboard/apply-trainer');
  const isTrainerWorkspaceRoute = path.startsWith('/dashboard/trainer');
  const dashboardHomeActive = path === '/dashboard' || path === '/dashboard/';

  const navItems = [
    { icon: Home, label: t('nav.home'), to: '/', active: path === '/' },
    { icon: BookOpen, label: t('nav.courses'), to: '/courses', active: path.startsWith('/courses') },
    { icon: GraduationCap, label: t('dashboard.myCourses'), to: '/dashboard', active: dashboardHomeActive },
    ...(!isInstructor
      ? [
          {
            icon: Award,
            label: t('nav.applyTrainer'),
            to: '/dashboard/apply-trainer',
            active: isApplyTrainerRoute,
          },
        ]
      : []),
    { icon: User, label: t('profile.title'), to: '/profile', active: path.startsWith('/profile') },
    { icon: Ticket, label: t('nav.myBookings'), to: '/profile/bookings', active: path.startsWith('/profile/bookings') },
    {
      icon: ShieldCheck,
      label: isRTL ? 'الإعدادات والأمان' : 'Settings & Security',
      to: '/settings',
      active: path.startsWith('/settings'),
    },
    ...(isAdmin ? [{ icon: Settings, label: t('nav.adminPanel'), to: '/admin', active: path.startsWith('/admin') }] : []),
  ];

  const firstName = profile?.full_name?.split(' ')[0] || t('common.user');

  return (
    <div className="min-h-screen bg-background flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      <aside
        dir={isRTL ? 'rtl' : 'ltr'}
        className={`fixed inset-y-0 z-50 w-[280px] max-w-[85vw] bg-card border-e border-border transform transition-transform duration-300 ease-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : isRTL ? 'translate-x-full' : '-translate-x-full'
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
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors touch-target"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 min-h-0 p-3 sm:p-4 space-y-1 sm:space-y-2 overflow-y-auto overscroll-y-contain">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex w-full items-center justify-start gap-3 px-3 sm:px-4 py-3 sm:py-3 rounded-lg text-start transition-all duration-300 touch-target ${
                  item.active
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground active:bg-muted/70'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium flex-1 min-w-0">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="shrink-0 border-t border-border bg-muted/20 p-3 sm:p-4">
            {authLoading ? (
              <div className="h-12 w-full rounded-lg bg-muted/50 animate-pulse" aria-hidden />
            ) : !isInstructor ? (
              <Link
                to="/dashboard/apply-trainer"
                onClick={() => setSidebarOpen(false)}
                className={`flex w-full items-center justify-start gap-3 px-3 sm:px-4 py-3 sm:py-3 rounded-lg text-start transition-all duration-300 touch-target border shadow-sm ${
                  isApplyTrainerRoute
                    ? 'bg-primary/15 text-primary border-primary/30'
                    : 'border-border bg-card text-foreground hover:bg-muted/60 hover:border-primary/25'
                }`}
              >
                <Award className="w-5 h-5 flex-shrink-0" />
                <span className="font-semibold flex-1 min-w-0">{t('nav.applyTrainer')}</span>
              </Link>
            ) : (
              <Link
                to="/dashboard/trainer"
                onClick={() => setSidebarOpen(false)}
                className={`flex w-full items-center justify-start gap-3 px-3 sm:px-4 py-3 sm:py-3 rounded-lg text-start transition-all duration-300 touch-target border shadow-sm ${
                  isTrainerWorkspaceRoute
                    ? 'bg-primary/15 text-primary border-primary/30'
                    : 'border-border bg-card text-foreground hover:bg-muted/60 hover:border-primary/25'
                }`}
              >
                <BadgeCheck className="w-5 h-5 flex-shrink-0" />
                <span className="font-semibold flex-1 min-w-0">{t('nav.trainerWorkspace')}</span>
              </Link>
            )}
          </div>

          <div className="p-3 sm:p-4 border-t border-border">
            <div className="flex w-full items-center justify-start gap-3 mb-4 text-start">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center flex-shrink-0">
                <span className="text-secondary-foreground font-bold">
                  {profile?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{profile?.full_name || t('common.user')}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <LogoutConfirmDialog onConfirm={handleSignOut}>
              <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive touch-target">
                <LogOut className="w-4 h-4 me-2" />
                {t('common.logout')}
              </Button>
            </LogoutConfirmDialog>
          </div>
        </div>
      </aside>

      <main className="flex-1 lg:ms-[280px] min-w-0 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border safe-area-top shrink-0">
          <div className="flex items-center justify-between p-3 sm:p-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors touch-target flex-shrink-0"
              >
                <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">
                  {isApplyTrainerRoute
                    ? t('applyTrainer.title')
                    : isTrainerWorkspaceRoute
                      ? t('dashboard.trainerWorkspaceSeoTitle')
                      : `${t('dashboard.welcome')}, ${firstName}!`}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block truncate">
                  {isApplyTrainerRoute
                    ? t('applyTrainer.subtitle')
                    : isTrainerWorkspaceRoute
                      ? t('dashboard.trainerWorkspaceSubtitle')
                      : t('dashboard.keepUpGreatWork')}
                </p>
              </div>
            </div>
            <LanguageToggle />
          </div>
        </header>

        <div className="flex-1 min-h-0 min-w-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
