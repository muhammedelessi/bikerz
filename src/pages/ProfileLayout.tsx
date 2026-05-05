import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useLocalizedNavigate } from "@/hooks/useLocalizedNavigate";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import LanguageToggle from "@/components/common/LanguageToggle";
import AppSidebar from "@/components/layout/AppSidebar";
import { Menu } from "lucide-react";

const ProfileLayout: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useLocalizedNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const path = location.pathname;
  const isSurveySection = path.startsWith("/profile/surveys");
  const isBookingsSection = path.startsWith("/profile/bookings");

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-dvh min-h-0 w-full overflow-hidden bg-background" dir={isRTL ? "rtl" : "ltr"}>
      <AppSidebar sidebarOpen={sidebarOpen} onSidebarOpenChange={setSidebarOpen} />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden lg:ms-[280px] min-w-0">
        <header className="shrink-0 sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border safe-area-top">
          <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors touch-target flex-shrink-0"
                aria-label="Toggle sidebar"
              >
                <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">
                  {isSurveySection ? t("survey.title") : isBookingsSection ? t("nav.myBookings") : t("profile.title")}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground truncate hidden sm:block">
                  {isSurveySection
                    ? t("survey.subtitle")
                    : isBookingsSection
                      ? t("myBookings.layoutSubtitle")
                      : t("profile.subtitle")}
                </p>
              </div>
            </div>
            <LanguageToggle />
          </div>
        </header>

        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-y-contain" id="profile-outlet-scroll">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default ProfileLayout;
