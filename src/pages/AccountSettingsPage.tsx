import React, { useState, useEffect } from 'react';
import SEOHead from '@/components/common/SEOHead';
import { useTranslation } from 'react-i18next';
import { useLocalizedNavigate } from '@/hooks/useLocalizedNavigate';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Skeleton } from '@/components/ui/skeleton';
import LanguageToggle from '@/components/common/LanguageToggle';
import { AccountSettings } from '@/components/ui/profile/AccountSettings';
import AppSidebar from '@/components/layout/AppSidebar';
import { Menu } from 'lucide-react';

const AccountSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useLocalizedNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { profile, isLoading, isUpdating, updateProfile } = useUserProfile();

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const settingsLabel = isRTL ? 'الإعدادات والأمان' : 'Settings & Security';
  const settingsSubtitle = isRTL
    ? 'إدارة حسابك وتفضيلاتك وأمان تسجيل الدخول'
    : 'Manage your account, preferences, and sign-in security';

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex" dir={isRTL ? 'rtl' : 'ltr'}>
      <SEOHead
        title={settingsLabel}
        description="Manage your BIKERZ Academy account, preferences, and biometric sign-in."
        noindex
      />

      <AppSidebar sidebarOpen={sidebarOpen} onSidebarOpenChange={setSidebarOpen} />

      <main className="flex-1 lg:ms-[280px] min-w-0">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border safe-area-top">
          <div className="flex items-center justify-between p-3 sm:p-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors touch-target flex-shrink-0"
                aria-label="Open sidebar"
              >
                <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">{settingsLabel}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">{settingsSubtitle}</p>
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
            <AccountSettings profile={profile} onUpdate={updateProfile} isUpdating={isUpdating} />
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t('profile.notFound')}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AccountSettingsPage;
