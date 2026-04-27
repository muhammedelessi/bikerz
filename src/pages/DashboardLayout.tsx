import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import LanguageToggle from "@/components/common/LanguageToggle";
import AppSidebar from "@/components/layout/AppSidebar";
import { Menu } from "lucide-react";

const DashboardLayout: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { profile } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const path = location.pathname;
  const isApplyTrainerRoute = path.startsWith("/dashboard/apply-trainer");
  const isTrainerWorkspaceRoute = path.startsWith("/dashboard/trainer");

  const firstName = profile?.full_name?.split(" ")[0] || t("common.user");

  return (
    <div className="min-h-screen bg-background flex" dir={isRTL ? "rtl" : "ltr"}>
      <AppSidebar sidebarOpen={sidebarOpen} onSidebarOpenChange={setSidebarOpen} />

      <main className="flex-1 lg:ms-[280px] min-w-0 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border safe-area-top shrink-0">
          <div className="flex items-center justify-between p-3 sm:p-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors touch-target flex-shrink-0"
                aria-label="Toggle sidebar"
              >
                <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">
                  {isApplyTrainerRoute
                    ? t("applyTrainer.title")
                    : isTrainerWorkspaceRoute
                      ? t("dashboard.trainerWorkspaceSeoTitle")
                      : `${t("dashboard.welcome")}, ${firstName}!`}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block truncate">
                  {isApplyTrainerRoute
                    ? t("applyTrainer.subtitle")
                    : isTrainerWorkspaceRoute
                      ? t("dashboard.trainerWorkspaceSubtitle")
                      : t("dashboard.keepUpGreatWork")}
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
