import React from 'react';
import SEOHead from '@/components/common/SEOHead';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import LanguageToggle from '@/components/common/LanguageToggle';
import { RiderIdentity } from '@/components/ui/profile/RiderIdentity';
import { BikeInformation } from '@/components/ui/profile/BikeInformation';
import { LearningProgress } from '@/components/ui/profile/LearningProgress';
import { ProfileAchievements } from '@/components/ui/profile/ProfileAchievements';
import { ActivityTimeline } from '@/components/ui/profile/ActivityTimeline';
import { AccountSettings } from '@/components/ui/profile/AccountSettings';
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Home,
  BookOpen,
  GraduationCap,
  Users,
  Settings,
  User,
} from 'lucide-react';
import logoDark from '@/assets/logo-dark.png';
import logoLight from '@/assets/logo-light.png';
import { useTheme } from '@/components/ThemeProvider';
import { useState, useEffect } from 'react';

const Profile: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    profile,
    learningStats,
    activities,
    isLoading,
    isUpdating,
    updateProfile,
    uploadAvatar,
  } = useUserProfile();

  const { theme } = useTheme();
  const themeLogo = theme === 'light' ? logoDark : logoLight;
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  // Lock body scroll when sidebar is open on mobile
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

  // Redirect to login if no user
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const navItems = [
    { icon: Home, label: t('nav.home'), to: '/' },
    { icon: BookOpen, label: t('nav.courses'), to: '/courses' },
    { icon: GraduationCap, label: t('dashboard.myCourses'), to: '/dashboard' },
    { icon: Users, label: t('nav.mentors'), to: '/mentors' },
    { icon: User, label: t('profile.title'), to: '/profile', active: true },
    ...(isAdmin ? [{ icon: Settings, label: t('nav.adminPanel'), to: '/admin' }] : []),
  ];

  // Show nothing while redirecting
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex">
      <SEOHead title="My Profile" description="Manage your BIKERZ Academy profile, achievements, and rider identity." noindex />
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
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
          {/* Logo */}
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
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav Items */}
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

      {/* Main Content */}
      <main className="flex-1 lg:ms-[280px] min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border safe-area-top">
          <div className="flex items-center justify-between p-3 sm:p-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors touch-target flex-shrink-0"
              >
                <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">
                  {t('profile.title')}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  {t('profile.subtitle')}
                </p>
              </div>
            </div>
            <LanguageToggle />
          </div>
        </header>

        {/* Profile Content */}
        <div className="p-6 space-y-8 safe-area-bottom">
          {isLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-60 rounded-xl" />
            </div>
          ) : profile ? (
            <>
              {/* A. Rider Identity */}
              <RiderIdentity
                profile={profile}
                onUpdate={updateProfile}
                onAvatarUpload={uploadAvatar}
                isUpdating={isUpdating}
              />

              {/* B. Bike Information */}
              <BikeInformation
                profile={profile}
                onUpdate={updateProfile}
                isUpdating={isUpdating}
              />

              {/* C. Learning Progress */}
              {learningStats && (
                <LearningProgress stats={learningStats} />
              )}

              {/* D. Achievements */}
              <ProfileAchievements />

              {/* E. Activity Timeline */}
              <ActivityTimeline activities={activities} />

              {/* F. Account & Settings */}
              <AccountSettings
                profile={profile}
                onUpdate={updateProfile}
                isUpdating={isUpdating}
              />
            </>
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

export default Profile;
