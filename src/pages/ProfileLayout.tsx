import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import LanguageToggle from "@/components/common/LanguageToggle";
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
} from "lucide-react";
import logoDark from "@/assets/logo-dark.png";
import logoLight from "@/assets/logo-light.png";
import { useTheme } from "@/components/ThemeProvider";

const ProfileLayout: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { theme } = useTheme();
  const themeLogo = theme === "light" ? logoDark : logoLight;

  const isSurveySection = location.pathname.startsWith("/profile/surveys");
  const isQuizPlay = /\/profile\/surveys\/[^/]+\/play$/.test(location.pathname);

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  const navItems = [
    { icon: Home, label: t("nav.home"), to: "/" },
    { icon: BookOpen, label: t("nav.courses"), to: "/courses" },
    { icon: GraduationCap, label: t("dashboard.myCourses"), to: "/dashboard" },
    { icon: Users, label: t("nav.mentors"), to: "/mentors" },
    { icon: User, label: t("profile.title"), to: "/profile", active: location.pathname.startsWith("/profile") },
    { icon: ShieldCheck, label: isRTL ? "الإعدادات والأمان" : "Settings & Security", to: "/settings" },
    ...(isAdmin ? [{ icon: Settings, label: t("nav.adminPanel"), to: "/admin" }] : []),
  ];

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-[100dvh] bg-background flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 z-50 w-[280px] max-w-[85vw] bg-card border-e border-border transform transition-transform duration-300 ease-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : isRTL ? "translate-x-full" : "-translate-x-full"
        } ${isRTL ? "right-0" : "left-0"}`}
      >
        <div className="flex flex-col h-full safe-area-inset">
          <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between">
            <Link to="/" className="flex items-center">
              <img
                src={themeLogo}
                alt="BIKERZ"
                className="h-6 sm:h-7 lg:h-8 w-auto object-contain"
                loading={sidebarOpen ? "eager" : "lazy"}
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

          <nav className="flex-1 p-3 sm:p-4 space-y-1 sm:space-y-2 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-3 rounded-lg transition-all duration-300 touch-target ${
                  item.active
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground active:bg-muted/70"
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      <main className="flex-1 lg:ms-[280px] min-w-0 flex flex-col min-h-0">
        <header className="shrink-0 sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border safe-area-top">
          <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors touch-target flex-shrink-0"
              >
                <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">
                  {isSurveySection ? t("survey.title") : t("profile.title")}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground truncate hidden sm:block">
                  {isSurveySection ? t("survey.subtitle") : t("profile.subtitle")}
                </p>
              </div>
            </div>
            <LanguageToggle />
          </div>
        </header>

        <div
          className={`flex-1 min-h-0 flex flex-col ${isQuizPlay ? "overflow-hidden" : "overflow-y-auto"}`}
          id="profile-outlet-scroll"
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default ProfileLayout;
