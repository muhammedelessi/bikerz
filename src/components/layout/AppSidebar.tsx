import React, { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentTrainer } from "@/hooks/useCurrentTrainer";
import { useTheme } from "@/components/ThemeProvider";
import LogoutConfirmDialog from "@/components/common/LogoutConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  X,
  Home,
  BookOpen,
  GraduationCap,
  Settings,
  ShieldCheck,
  Ticket,
  User,
  Award,
  BadgeCheck,
  LogOut,
} from "lucide-react";
import logoDark from "@/assets/logo-dark.webp";
import logoLight from "@/assets/logo-light.png";

export interface AppSidebarProps {
  sidebarOpen: boolean;
  onSidebarOpenChange: (open: boolean) => void;
}

/**
 * Shared sidebar used by both DashboardLayout (/dashboard/*) and ProfileLayout (/profile/*).
 * Items, footer (user card + trainer link + logout) and styling stay in sync between both
 * layouts so navigation feels seamless.
 */
const AppSidebar: React.FC<AppSidebarProps> = ({ sidebarOpen, onSidebarOpenChange }) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, profile, hasAnyRole, signOut } = useAuth();
  // Show "Admin Panel" only for true admin roles — not for instructor/finance/support/moderator,
  // who are technically in ADMIN_ROLES for route-guard purposes but aren't "admins" in the UI sense.
  const showAdminLink = hasAnyRole(["super_admin", "developer", "academy_admin"]);
  const { trainer } = useCurrentTrainer();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const themeLogo = theme === "light" ? logoDark : logoLight;
  const path = location.pathname;
  const profilePathNorm = path.replace(/\/$/, "") || "/";
  const isProfileHome = profilePathNorm === "/profile";
  const isApplyTrainerRoute = path.startsWith("/dashboard/apply-trainer");
  const isTrainerWorkspaceRoute = path.startsWith("/dashboard/trainer");
  const dashboardHomeActive = path === "/dashboard" || path === "/dashboard/";

  // Lock body scroll while the sidebar overlay is open on mobile
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

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const navItems = [
    { icon: Home, label: t("nav.home"), to: "/", active: path === "/" },
    { icon: BookOpen, label: t("nav.courses"), to: "/courses", active: path.startsWith("/courses") },
    { icon: GraduationCap, label: t("dashboard.myCourses"), to: "/dashboard", active: dashboardHomeActive },
    { icon: User, label: t("profile.title"), to: "/profile", active: isProfileHome },
    { icon: Ticket, label: t("nav.myBookings"), to: "/profile/bookings", active: path.startsWith("/profile/bookings") },
    {
      icon: ShieldCheck,
      label: isRTL ? "الإعدادات والأمان" : "Settings & Security",
      to: "/settings",
      active: path.startsWith("/settings"),
    },
    ...(showAdminLink
      ? [{ icon: Settings, label: t("nav.adminPanel"), to: "/admin", active: path.startsWith("/admin") }]
      : []),
  ];

  return (
    <>
      {sidebarOpen ? (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => onSidebarOpenChange(false)}
          aria-hidden
        />
      ) : null}

      <aside
        dir={isRTL ? "rtl" : "ltr"}
        className={`fixed inset-y-0 z-50 w-[280px] max-w-[85vw] bg-card border-e border-border transform transition-transform duration-300 ease-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : isRTL ? "translate-x-full" : "-translate-x-full"
        } ${isRTL ? "right-0" : "left-0"}`}
      >
        <div className="flex flex-col h-full safe-area-inset">
          {/* Logo header */}
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
              onClick={() => onSidebarOpenChange(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors touch-target"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main nav */}
          <nav className="flex-1 min-h-0 p-3 sm:p-4 space-y-1 sm:space-y-2 overflow-y-auto overscroll-y-contain">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => onSidebarOpenChange(false)}
                className={`flex w-full items-center justify-start gap-3 px-3 sm:px-4 py-3 sm:py-3 rounded-lg text-start transition-all duration-300 touch-target ${
                  item.active
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground active:bg-muted/70"
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium flex-1 min-w-0">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Footer: user card + trainer link + logout */}
          <div className="p-3 sm:p-4 border-t border-border">
            <div className="flex w-full items-center justify-start gap-3 text-start">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center flex-shrink-0">
                <span className="text-secondary-foreground font-bold">
                  {profile?.full_name?.charAt(0) || user?.email?.charAt(0) || "U"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{profile?.full_name || t("common.user")}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>

            {/*
              Always render one of the two links — never show a loading skeleton in its place,
              so new users immediately see "Apply as Trainer" the moment auth resolves.
              We swap to "Trainer Dashboard" only when a trainer record is actually loaded.
            */}
            <div className="mt-3 space-y-2">
              {trainer ? (
                <Link
                  to="/dashboard/trainer"
                  onClick={() => onSidebarOpenChange(false)}
                  className={`flex w-full items-center justify-start gap-3 px-3 sm:px-4 py-3 sm:py-3 rounded-lg text-start transition-all duration-300 touch-target border shadow-sm ${
                    isTrainerWorkspaceRoute
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "border-border bg-card text-foreground hover:bg-muted/60 hover:border-primary/25"
                  }`}
                >
                  <BadgeCheck className="w-5 h-5 flex-shrink-0" />
                  <span className="font-semibold flex-1 min-w-0">{t("nav.trainerWorkspace")}</span>
                </Link>
              ) : (
                <Link
                  to="/dashboard/apply-trainer"
                  onClick={() => onSidebarOpenChange(false)}
                  className={`flex w-full items-center justify-start gap-3 px-3 sm:px-4 py-3 sm:py-3 rounded-lg text-start transition-all duration-300 touch-target border shadow-sm ${
                    isApplyTrainerRoute
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "border-border bg-card text-foreground hover:bg-muted/60 hover:border-primary/25"
                  }`}
                >
                  <Award className="w-5 h-5 flex-shrink-0" />
                  <span className="font-semibold flex-1 min-w-0">{t("nav.applyTrainer")}</span>
                </Link>
              )}
            </div>

            <LogoutConfirmDialog onConfirm={handleSignOut}>
              <Button
                variant="ghost"
                className="mt-3 w-full justify-start text-muted-foreground hover:text-destructive touch-target"
              >
                <LogOut className="w-4 h-4 me-2" />
                {t("common.logout")}
              </Button>
            </LogoutConfirmDialog>
          </div>
        </div>
      </aside>
    </>
  );
};

export default AppSidebar;
