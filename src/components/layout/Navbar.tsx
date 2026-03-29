import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LogOut, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LanguageToggle from '@/components/common/LanguageToggle';
import ThemeToggle from '@/components/ThemeToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import bikerzLogo from '@/assets/bikerz-logo.webp';

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

const Navbar: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  const { data: headerContent } = useQuery({
    queryKey: ['header-content'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'header')
        .eq('category', 'landing')
        .single();
      if (error) throw error;
      return data?.value as HeaderContent;
    },
  });

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const update = () => {
      document.documentElement.style.setProperty('--navbar-h', `${el.offsetHeight}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
    setIsMobileMenuOpen(false);
  };

  const menuItems = headerContent?.menu_items?.filter(item => item.is_visible) || [
    { id: 'home', title_en: t('nav.home', { lng: 'en' }), title_ar: t('nav.home', { lng: 'ar' }), link: '/', is_visible: true, open_in_new_tab: false },
    { id: 'courses', title_en: t('nav.courses', { lng: 'en' }), title_ar: t('nav.courses', { lng: 'ar' }), link: '/courses', is_visible: true, open_in_new_tab: false },
    { id: 'mentors', title_en: t('nav.mentors', { lng: 'en' }), title_ar: t('nav.mentors', { lng: 'ar' }), link: '/mentors', is_visible: true, open_in_new_tab: false },
    { id: 'about', title_en: t('nav.about', { lng: 'en' }), title_ar: t('nav.about', { lng: 'ar' }), link: '/about', is_visible: true, open_in_new_tab: false },
  ];

  const ctaButton = headerContent?.cta_button || {
    text_en: 'Start Now',
    text_ar: 'ابدأ الآن',
    link: '/signup',
    is_visible: true,
    style: 'cta'
  };

  const loginButton = headerContent?.login_button || {
    text_en: t('nav.login', { lng: 'en' }),
    text_ar: t('nav.login', { lng: 'ar' }),
    link: '/login',
    is_visible: true
  };

  const showLanguageToggle = headerContent?.show_language_toggle !== false;
  const logoUrl = headerContent?.logo_url || bikerzLogo;
  const logoAlt = (isRTL ? headerContent?.logo_alt_ar : headerContent?.logo_alt_en) || t('common.bikerz');
  const isActive = (path: string) => location.pathname === path;
  const isHome = location.pathname === '/';

  return (
    <>
      <nav
        ref={navRef}
        className={`fixed top-0 left-0 right-0 z-50 safe-area-top transition-all duration-500 ${
          isScrolled || isMobileMenuOpen
            ? 'bg-background/95 backdrop-blur-md shadow-md border-b border-border/30'
            : isHome
              ? 'bg-transparent'
              : 'bg-background/80 backdrop-blur-sm'
        }`}
      >
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 lg:h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center flex-shrink-0 relative z-10">
              <img
                src={logoUrl}
                alt={logoAlt}
                width={80}
                height={80}
                loading="eager"
                decoding="async"
                className="h-12 sm:h-14 lg:h-16 w-auto object-contain"
              />
            </Link>

            {/* Desktop Nav Links — Centered */}
            <div className="hidden lg:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
              {menuItems.map((item) => {
                const active = isActive(item.link);
                const label = isRTL ? item.title_ar : item.title_en;
                const className = `relative px-4 py-2 text-sm font-medium transition-colors duration-300 ${
                  active
                    ? 'text-primary'
                    : 'text-foreground/80 hover:text-primary'
                }`;

                const content = (
                  <>
                    {label}
                    {active && (
                      <motion.span
                        layoutId="nav-underline"
                        className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                  </>
                );

                if (item.open_in_new_tab) {
                  return (
                    <a key={item.id} href={item.link} target="_blank" rel="noopener noreferrer" className={className}>
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

            {/* Right Side */}
            <div className="flex items-center gap-2 sm:gap-3 relative z-10">
              <ThemeToggle />
              {showLanguageToggle && <LanguageToggle />}

              <div className="hidden lg:flex items-center gap-2">
                {user ? (
                  <>
                    <Link to="/dashboard">
                      <Button variant="ghost" size="sm" className="gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary-foreground">
                            {profile?.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                          </span>
                        </div>
                        <span className="hidden xl:inline text-sm">
                          {profile?.full_name?.split(' ')[0] || t('nav.dashboard')}
                        </span>
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleSignOut}
                      title={t('common.logout')}
                    >
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
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

              {/* Hamburger */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={`lg:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors text-foreground hover:bg-muted/50`}
                aria-label="Toggle menu"
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />

            <motion.div
              initial={{ x: isRTL ? '-100%' : '100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? '-100%' : '100%' }}
              transition={{ type: 'tween', duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              className={`fixed top-0 ${isRTL ? 'left-0' : 'right-0'} z-50 w-full max-w-[320px] h-full bg-background border-s border-border/50 shadow-2xl lg:hidden safe-area-top`}
            >
              <div className="flex flex-col h-full">
                {/* Drawer Header */}
                <div className="flex items-center justify-between px-4 h-14 border-b border-border/30">
                  <Link to="/" onClick={() => setIsMobileMenuOpen(false)}>
                    <img
                      src={logoUrl}
                      alt={logoAlt}
                      className="h-10 w-auto object-contain"
                      loading="eager"
                    />
                  </Link>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-muted/50 text-foreground"
                    aria-label="Close menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 overflow-y-auto py-3 px-3">
                  <div className="space-y-0.5">
                    {menuItems.map((item) => {
                      const active = isActive(item.link);
                      const label = isRTL ? item.title_ar : item.title_en;
                      const linkClass = `flex items-center justify-between py-3.5 px-4 rounded-xl transition-all duration-200 min-h-[48px] ${
                        active
                          ? 'bg-primary/10 text-primary font-semibold border-s-2 border-primary'
                          : 'text-foreground hover:bg-muted/40 hover:text-primary'
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
                            <ChevronRight className={`w-4 h-4 text-muted-foreground ${isRTL ? 'rotate-180' : ''}`} />
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
                          <span className="text-base">{label}</span>
                          <ChevronRight className={`w-4 h-4 text-muted-foreground ${isRTL ? 'rotate-180' : ''}`} />
                        </Link>
                      );
                    })}
                  </div>

                  {/* Language Toggle in drawer */}
                  <div className="mt-4 space-y-2">
                    {showLanguageToggle && (
                      <div className="px-4 py-3 rounded-xl bg-muted/20 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{t('common.language', 'Language')}</span>
                        <LanguageToggle />
                      </div>
                    )}
                    <div className="px-4 py-3 rounded-xl bg-muted/20 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{isRTL ? 'الوضع' : 'Theme'}</span>
                      <ThemeToggle />
                    </div>
                  </div>
                </nav>

                {/* Footer Auth */}
                <div className="p-4 border-t border-border/30 space-y-2.5 safe-area-bottom">
                  {user ? (
                    <>
                      <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="block">
                        <Button variant="outline" className="w-full h-12 text-base gap-3 border-border/50">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                            <span className="text-sm font-bold text-primary-foreground">
                              {profile?.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                            </span>
                          </div>
                          {profile?.full_name || t('nav.dashboard')}
                        </Button>
                      </Link>
                      <Button variant="ghost" onClick={handleSignOut} className="w-full h-11 text-sm text-muted-foreground">
                        <LogOut className="w-4 h-4 me-2" />
                        {t('common.logout')}
                      </Button>
                    </>
                  ) : (
                    <>
                      {loginButton.is_visible && (
                        <Link to={loginButton.link} onClick={() => setIsMobileMenuOpen(false)} className="block">
                          <Button variant="outline" className="w-full h-12 text-base border-border/50">
                            {isRTL ? loginButton.text_ar : loginButton.text_en}
                          </Button>
                        </Link>
                      )}
                      {ctaButton.is_visible && (
                        <Link to={ctaButton.link} onClick={() => setIsMobileMenuOpen(false)} className="block">
                          <Button className="w-full h-12 text-base font-bold bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.3)]">
                            {isRTL ? ctaButton.text_ar : ctaButton.text_en}
                          </Button>
                        </Link>
                      )}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
