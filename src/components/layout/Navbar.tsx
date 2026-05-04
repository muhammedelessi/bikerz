import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import { ChevronRight, LogOut, Menu, X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import LanguageToggle from "@/components/common/LanguageToggle";
import LogoutConfirmDialog from "@/components/common/LogoutConfirmDialog";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationsDropdown from "@/components/admin/NotificationsDropdown";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/ThemeProvider";
import logoDark from "@/assets/logo-dark.webp";
import logoLight from "@/assets/logo-light.png";

interface MenuItem {
  id: string;
  title_en: string;
  title_ar: string;
  link: string;
  is_visible: boolean;
  open_in_new_tab: boolean;
}

interface HeaderContent {
  logo_url?: string;
  logo_alt_en?: string;
  logo_alt_ar?: string;
  show_language_toggle?: boolean;
  menu_items?: MenuItem[];
  cta_button?: {
    text_en: string;
    text_ar: string;
    link: string;
    is_visible: boolean;
    style?: string;
  };
  login_button?: {
    text_en: string;
    text_ar: string;
    link: string;
    is_visible: boolean;
  };
}

const ALLOWED_TRAINER_FEATURES_IPS = new Set<string>(["51.36.221.220"]);

function extraAfterCoursesNav(
  t: (key: string, opts?: { lng?: string }) => string,
  showTrainerFeatures: boolean,
): MenuItem[] {
  return [
    ...(showTrainerFeatures
      ? [
          {
            id: "trainings",
            title_en: t("nav.trainings", { lng: "en" }),
            title_ar: t("nav.trainings", { lng: "ar" }),
            link: "/trainings",
            is_visible: true,
            open_in_new_tab: false,
          },
          {
            id: "trainers",
            title_en: t("nav.trainers", { lng: "en" }),
            title_ar: t("nav.trainers", { lng: "ar" }),
            link: "/trainers",
            is_visible: true,
            open_in_new_tab: false,
          },
        ]
      : []),
    {
      id: "bundles",
      title_en: t("nav.bundles", { lng: "en" }),
      title_ar: t("nav.bundles", { lng: "ar" }),
      link: "/bundles",
      is_visible: true,
      open_in_new_tab: false,
    },
    {
      id: "champions",
      title_en: t("nav.champions", { lng: "en" }),
      title_ar: t("nav.champions", { lng: "ar" }),
      link: "/community-champions",
      is_visible: true,
      open_in_new_tab: false,
    },
  ];
}

const Navbar: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { theme } = useTheme();
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const mainEl = document.querySelector("main");
    if (!mainEl) return;
    mainEl.id = "main-content";
  }, [location.pathname]);

  const { data: headerContent } = useQuery({
    queryKey: ["header-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "header")
        .eq("category", "landing")
        .single();
      if (error) throw error;
      return data?.value as HeaderContent;
    },
  });

  // Drives the Honda Owners CTA visibility. We hide the chip once the user
  // is approved (they already have free access to "What If") to avoid
  // sending them through the form a second time.
  // The query is cheap because of the (user_id, status) index in the
  // honda_applications table; result is cached per-user via the key.
  const { data: hondaStatus } = useQuery({
    queryKey: ["honda-status", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      if (!user) return null;
      const { data } = await (supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => {
            eq: (k: string, v: string) => {
              order: (c: string, o: { ascending: boolean }) => {
                limit: (n: number) => {
                  maybeSingle: () => Promise<{ data: { status?: string } | null }>;
                };
              };
            };
          };
        };
      })
        .from("honda_applications")
        .select("status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data?.status as string | undefined) ?? null;
    },
  });
  const showHondaCTA = !user || hondaStatus !== "approved";

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const update = () => {
      document.documentElement.style.setProperty(
        "--navbar-h",
        `${el.offsetHeight}px`,
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
    setIsMobileMenuOpen(false);
  };

  const { data: clientIp } = useQuery({
    queryKey: ["client-ip"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const j = await res.json();
        return (j?.ip as string) || "";
      } catch {
        return "";
      }
    },
  });

  const showTrainerFeatures = import.meta.env.DEV || (!!clientIp && ALLOWED_TRAINER_FEATURES_IPS.has(clientIp));

  const menuItems = useMemo(() => {
    const hiddenLinks = new Set<string>(["/mentors"]);
    if (!showTrainerFeatures) {
      hiddenLinks.add("/trainings");
      hiddenLinks.add("/trainers");
    }
    const defaultItems: MenuItem[] = [
      {
        id: "home",
        title_en: t("nav.home", { lng: "en" }),
        title_ar: t("nav.home", { lng: "ar" }),
        link: "/",
        is_visible: true,
        open_in_new_tab: false,
      },
      {
        id: "courses",
        title_en: t("nav.courses", { lng: "en" }),
        title_ar: t("nav.courses", { lng: "ar" }),
        link: "/courses",
        is_visible: true,
        open_in_new_tab: false,
      },
      ...extraAfterCoursesNav(t, showTrainerFeatures),
      {
        id: "about",
        title_en: t("nav.about", { lng: "en" }),
        title_ar: t("nav.about", { lng: "ar" }),
        link: "/about",
        is_visible: true,
        open_in_new_tab: false,
      },
    ].filter((item) => !hiddenLinks.has(item.link));

    const cmsItems = headerContent?.menu_items?.filter(
      (item) => item.is_visible && !hiddenLinks.has(item.link),
    );
    if (!cmsItems?.length) return defaultItems;

    const merged = [...cmsItems];
    const links = new Set(merged.map((item) => item.link));
    const missing = extraAfterCoursesNav(t, showTrainerFeatures).filter(
      (item) => !hiddenLinks.has(item.link) && !links.has(item.link),
    );
    if (missing.length === 0) return merged;

    const coursesIdx = merged.findIndex((item) => item.link === "/courses");
    if (coursesIdx >= 0) merged.splice(coursesIdx + 1, 0, ...missing);
    else merged.push(...missing);

    return merged;
  }, [headerContent?.menu_items, t, showTrainerFeatures]);

  const ctaButton = headerContent?.cta_button || {
    text_en: "Start Now",
    text_ar: "ابدأ الآن",
    link: "/signup",
    is_visible: true,
    style: "cta",
  };

  const loginButton = headerContent?.login_button || {
    text_en: t("nav.login", { lng: "en" }),
    text_ar: t("nav.login", { lng: "ar" }),
    link: "/login",
    is_visible: true,
  };

  const showLanguageToggle = headerContent?.show_language_toggle !== false;
  const themeLogo = theme === "light" ? logoDark : logoLight;
  const logoUrl = headerContent?.logo_url || themeLogo;
  const logoAlt =
    (isRTL ? headerContent?.logo_alt_ar : headerContent?.logo_alt_en) ||
    t("common.bikerz");
  const isActive = (path: string) => location.pathname === path;
  const isHome = location.pathname === "/";

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[200] focus:m-0 focus:inline-flex focus:h-auto focus:w-auto focus:overflow-visible focus:whitespace-normal focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-background focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {isRTL ? "انتقل إلى المحتوى" : "Skip to main content"}
      </a>
      <nav
        ref={navRef}
        className={`fixed top-0 left-0 right-0 z-50 safe-area-top transition-all duration-500 ${
          isScrolled || isMobileMenuOpen
            ? "bg-background/95 backdrop-blur-md shadow-md border-b border-border/30"
            : isHome
            ? "bg-transparent"
            : "bg-background/80 backdrop-blur-sm"
        }`}
      >
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          {/* dir=ltr keeps physical layout: logo left, burger & actions right (flex start/end are not flipped in site RTL) */}
          <div className="flex h-14 items-center justify-between gap-2 lg:h-16 lg:gap-4" dir="ltr">
            {/* Logo */}
            <Link
              to="/"
              className="flex items-center flex-shrink-0 relative z-10 lg:min-w-max"
            >
              <img
                src={logoUrl}
                alt={logoAlt}
                width={80}
                height={80}
                loading="eager"
                decoding="async"
                className="h-6 sm:h-7 lg:h-8 w-auto object-contain"
              />
            </Link>

            {/* Desktop Nav Links — centered, visual order reversed (last CMS/default item appears leftmost) */}
            <div className="hidden lg:flex flex-1 min-w-0 justify-center">
              <div className="flex max-w-full flex-row-reverse items-center gap-0.5 overflow-x-auto px-2 no-scrollbar">
                {menuItems.map((item) => {
                  const active = isActive(item.link);
                  const label = isRTL ? item.title_ar : item.title_en;
                  const className =
                    `relative px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-300 ${
                      active
                        ? "text-primary"
                        : "text-foreground/80 hover:text-primary"
                    }`;

                  const content = (
                    <>
                      {label}
                      {active && (
                        <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary transition-all duration-300" />
                      )}
                    </>
                  );

                  if (item.open_in_new_tab) {
                    return (
                      <a
                        key={item.id}
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={className}
                      >
                        {content}
                      </a>
                    );
                  }
                  return (
                    <Link key={item.id} to={item.link} className={className}>
                      {content}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Right Side — inherit RTL for control labels inside; bar order stays LTR */}
            <div
              className="relative z-10 flex shrink-0 items-center gap-2 sm:gap-3"
              dir={isRTL ? "rtl" : "ltr"}
            >
              <div className="hidden lg:flex items-center gap-2">
                <ThemeToggle />
                {showLanguageToggle && <LanguageToggle />}
              </div>
              <div className="hidden lg:flex items-center gap-2">
                {/* Honda Owners chip — visible to everyone (logged-in or not).
                    Hidden once the current user has an `approved` Honda
                    application, since the CTA's purpose has been served
                    (the "What If" course is now free for them). The chip
                    sits before the login/dashboard cluster so it reads
                    naturally next to the login button per spec. */}
                {showHondaCTA && (
                  <Link to="/honda/apply">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-red-500/40 text-red-600 hover:bg-red-500/10 hover:text-red-700 hover:border-red-500/60 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <ShieldCheck className="w-4 h-4" aria-hidden />
                      <span className="text-sm font-semibold">
                        {isRTL ? "ملاك هوندا" : "Honda Owners"}
                      </span>
                    </Button>
                  </Link>
                )}
                {user
                  ? (
                    <>
                      {/* Notifications bell — same component as admin uses,
                          reads admin_notifications filtered by auth.uid().
                          Works for trainers + students because the DB
                          triggers (booking lifecycle + skill evaluations)
                          insert rows for trainer.user_id and
                          training_bookings.user_id. */}
                      <NotificationsDropdown />
                      <Link to="/dashboard">
                        <Button variant="ghost" size="sm" className="gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary-foreground">
                              {profile?.full_name?.charAt(0) ||
                                user.email?.charAt(0) || "U"}
                            </span>
                          </div>
                          <span className="hidden xl:inline text-sm">
                            {profile?.full_name?.split(" ")[0] ||
                              t("nav.dashboard")}
                          </span>
                        </Button>
                      </Link>
                      <LogoutConfirmDialog onConfirm={handleSignOut}>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t("common.logout")}
                          aria-label={isRTL ? "تسجيل الخروج" : t("common.logout")}
                        >
                          <LogOut className="w-4 h-4" aria-hidden />
                        </Button>
                      </LogoutConfirmDialog>
                    </>
                  )
                  : (
                    <>
                      {loginButton.is_visible && (
                        <Link to={loginButton.link}>
                          <Button variant="ghost" size="sm" className="text-sm">
                            {isRTL ? loginButton.text_ar : loginButton.text_en}
                          </Button>
                        </Link>
                      )}
                      {ctaButton.is_visible && (
                        <Link to={ctaButton.link}>
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold px-5 py-2 text-sm shadow-[0_0_20px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_30px_hsl(var(--primary)/0.5)] hover:scale-105 transition-all duration-300"
                          >
                            {isRTL ? ctaButton.text_ar : ctaButton.text_en}
                          </Button>
                        </Link>
                      )}
                    </>
                  )}
              </div>

              {/* Mobile: Sign up (guest) to the left of burger; dir=ltr keeps order in site RTL */}
              <div className="flex items-center gap-2 lg:hidden" dir="ltr">
                {!user && ctaButton.is_visible && (
                  <Link to={ctaButton.link} className="shrink-0">
                    <Button
                      size="sm"
                      className="whitespace-nowrap bg-gradient-to-r from-primary to-primary/80 px-3 py-2 text-xs font-bold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.3)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_hsl(var(--primary)/0.5)] sm:px-4 sm:text-sm"
                    >
                      {isRTL ? ctaButton.text_ar : ctaButton.text_en}
                    </Button>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg p-2 text-foreground transition-colors hover:bg-muted/50"
                  aria-label={isRTL ? "فتح أو إغلاق القائمة" : "Open or close menu"}
                  aria-expanded={isMobileMenuOpen}
                >
                  {isMobileMenuOpen
                    ? <X className="h-6 w-6" aria-hidden />
                    : <Menu className="h-6 w-6" aria-hidden />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Backdrop */}
      <div
        role="presentation"
        aria-hidden={!isMobileMenuOpen}
        onClick={() => setIsMobileMenuOpen(false)}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-200 ${
          isMobileMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      />
      {/* Mobile Menu Drawer — always from the right edge; dir controls text alignment inside */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-nav-title"
        dir={isRTL ? "rtl" : "ltr"}
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-[320px] border-s border-border/50 bg-background shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden safe-area-top ${
          isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <p id="mobile-nav-title" className="sr-only">
            {isRTL ? "قائمة التنقل" : "Navigation menu"}
          </p>
          {/* Drawer Header */}
          <div className="flex items-center justify-between px-4 h-14 border-b border-border/30">
            <Link to="/" onClick={() => setIsMobileMenuOpen(false)}>
              <img
                src={logoUrl}
                alt={logoAlt}
                width={80}
                height={32}
                className="h-6 w-auto object-contain"
                loading="eager"
                decoding="async"
              />
            </Link>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-muted/50 text-foreground"
              aria-label={isRTL ? "إغلاق القائمة" : "Close menu"}
            >
              <X className="w-5 h-5" aria-hidden />
            </button>
          </div>
          {/* Nav Links */}
          <nav className="flex-1 overflow-y-auto py-3 px-3">
            {/* Honda Owners CTA — same visibility rule as desktop. Pinned
                to the top of the drawer because it's a feature highlight,
                not a routine menu link. */}
            {showHondaCTA && (
              <Link
                to="/honda/apply"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex w-full items-center gap-3 py-3.5 px-4 rounded-xl mb-2 text-start min-h-[48px] border-2 border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-300 transition-colors hover:bg-red-500/10"
              >
                <ShieldCheck className="w-5 h-5 shrink-0" aria-hidden />
                <span className="font-semibold flex-1 min-w-0">
                  {isRTL ? "مالك هوندا — تسجيل" : "Honda Owner — register"}
                </span>
                <ChevronRight className={`w-4 h-4 shrink-0 ${isRTL ? "rotate-180" : ""}`} />
              </Link>
            )}
            <div className="space-y-0.5">
              {menuItems.map((item) => {
                const active = isActive(item.link);
                const label = isRTL ? item.title_ar : item.title_en;
                const linkClass =
                  `flex w-full items-center justify-between gap-2 py-3.5 px-4 rounded-xl text-start transition-all duration-200 min-h-[48px] ${
                    active
                      ? "bg-primary/10 text-primary font-semibold border-s-2 border-primary"
                      : "text-foreground hover:bg-muted/40 hover:text-primary"
                  }`;
                if (item.open_in_new_tab) {
                  return (
                    <a
                      key={item.id}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={linkClass}
                    >
                      <span className="text-base">{label}</span>
                      <ChevronRight
                        className={`w-4 h-4 text-muted-foreground ${
                          isRTL ? "rotate-180" : ""
                        }`}
                      />
                    </a>
                  );
                }
                return (
                  <Link
                    key={item.id}
                    to={item.link}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={linkClass}
                  >
                    <span className="text-base flex-1 min-w-0">{label}</span>
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 text-muted-foreground ${
                        isRTL ? "rotate-180" : ""
                      }`}
                    />
                  </Link>
                );
              })}
            </div>
            <div className="mt-4 space-y-2">
              {showLanguageToggle && (
                <div className="px-4 py-3 rounded-xl bg-muted/20 flex w-full items-center justify-between gap-3 text-start">
                  <span className="text-sm text-muted-foreground">
                    {t("common.language", "Language")}
                  </span>
                  <LanguageToggle />
                </div>
              )}
              <div className="px-4 py-3 rounded-xl bg-muted/20 flex w-full items-center justify-between gap-3 text-start">
                <span className="text-sm text-muted-foreground">
                  {isRTL ? "الوضع" : "Theme"}
                </span>
                <ThemeToggle />
              </div>
            </div>
          </nav>
          {/* Footer Auth */}
          <div className="p-4 border-t border-border/30 space-y-2.5 safe-area-bottom">
            {user
              ? (
                <>
                  <Link
                    to="/dashboard"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block"
                  >
                    <Button
                      variant="outline"
                      className="w-full h-12 justify-start text-start text-base gap-3 border-border/50"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary-foreground">
                          {profile?.full_name?.charAt(0) ||
                            user.email?.charAt(0) || "U"}
                        </span>
                      </div>
                      {profile?.full_name || t("nav.dashboard")}
                    </Button>
                  </Link>
                  <LogoutConfirmDialog onConfirm={handleSignOut}>
                    <Button
                      variant="ghost"
                      className="w-full h-11 justify-start text-start text-sm text-muted-foreground"
                    >
                      <LogOut className="w-4 h-4 me-2" />
                      {t("common.logout")}
                    </Button>
                  </LogoutConfirmDialog>
                </>
              )
              : (
                <>
                  {loginButton.is_visible && (
                    <Link
                      to={loginButton.link}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block"
                    >
                      <Button
                        variant="outline"
                        className="w-full h-12 justify-start text-start text-base border-border/50"
                      >
                        {isRTL ? loginButton.text_ar : loginButton.text_en}
                      </Button>
                    </Link>
                  )}
                  {ctaButton.is_visible && (
                    <Link
                      to={ctaButton.link}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block"
                    >
                      <Button className="w-full h-12 justify-start text-start text-base font-bold bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.3)]">
                        {isRTL ? ctaButton.text_ar : ctaButton.text_en}
                      </Button>
                    </Link>
                  )}
                </>
              )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
