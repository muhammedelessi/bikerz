import React, { useState, useEffect } from 'react';
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

  // Fetch header content from database
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
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
    setIsMobileMenuOpen(false);
  };

  // Use dynamic menu items from database or fallback to defaults
  const menuItems = headerContent?.menu_items?.filter(item => item.is_visible) || [
    { id: 'home', title_en: t('nav.home', { lng: 'en' }), title_ar: t('nav.home', { lng: 'ar' }), link: '/', is_visible: true, open_in_new_tab: false },
    { id: 'courses', title_en: t('nav.courses', { lng: 'en' }), title_ar: t('nav.courses', { lng: 'ar' }), link: '/courses', is_visible: true, open_in_new_tab: false },
    { id: 'mentors', title_en: t('nav.mentors', { lng: 'en' }), title_ar: t('nav.mentors', { lng: 'ar' }), link: '/mentors', is_visible: true, open_in_new_tab: false },
    { id: 'about', title_en: t('nav.about', { lng: 'en' }), title_ar: t('nav.about', { lng: 'ar' }), link: '/about', is_visible: true, open_in_new_tab: false },
  ];

  const ctaButton = headerContent?.cta_button || {
    text_en: t('nav.signup', { lng: 'en' }),
    text_ar: t('nav.signup', { lng: 'ar' }),
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

  const renderLink = (item: MenuItem, className: string, children: React.ReactNode) => {
    if (item.open_in_new_tab) {
      return (
        <a
          key={item.id}
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
        >
          {children}
        </a>
      );
    }
    return (
      <Link
        key={item.id}
        to={item.link}
        className={className}
      >
        {children}
      </Link>
    );
  };

  // Publish navbar height as CSS variable
  const navRef = React.useRef<HTMLElement>(null);
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

  return (
    <>
      <nav
        ref={navRef}
        className={`fixed top-0 left-0 right-0 z-50 safe-area-top transition-colors duration-300 ${
          isScrolled || isMobileMenuOpen
            ? 'bg-background/95 backdrop-blur-xl border-b border-border/50 shadow-lg'
            : 'bg-background/80 backdrop-blur-sm'
        }`}
      >
        <div className="page-container">
          <div className="flex items-center justify-between h-16 sm:h-20 lg:h-24">
            {/* Logo */}
            <Link to="/" className="flex items-center flex-shrink-0">
              <picture>
                <source srcSet={logoUrl} type="image/webp" />
                <img
                  src={logoUrl}
                  alt={logoAlt}
                  width={96}
                  height={96}
                  loading="eager"
                  decoding="async"
                  className="h-12 sm:h-16 md:h-20 lg:h-24 w-auto object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]"
                />
              </picture>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {menuItems.map((item) => (
                renderLink(
                  item,
                  `nav-link ${isActive(item.link) ? 'active' : ''}`,
                  isRTL ? item.title_ar : item.title_en
                )
              ))}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* <ThemeToggle /> */}
              {showLanguageToggle && <LanguageToggle />}
              
              <div className="hidden md:flex items-center gap-2">
                {user ? (
                  <>
                    <Link to="/dashboard">
                      <Button variant="ghost" size="sm" className="gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center">
                          <span className="text-xs font-bold text-secondary-foreground">
                            {profile?.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                          </span>
                        </div>
                        <span className="hidden sm:inline">
                          {profile?.full_name?.split(' ')[0] || t('nav.dashboard')}
                        </span>
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" onClick={handleSignOut} title={t('common.logout')}>
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    {loginButton.is_visible && (
                      <Link to={loginButton.link}>
                        <Button variant="ghost" size="sm">
                          {isRTL ? loginButton.text_ar : loginButton.text_en}
                        </Button>
                      </Link>
                    )}
                    {ctaButton.is_visible && (
                      <Link to={ctaButton.link}>
                        <Button variant="cta" size="sm" className="px-4 py-2 text-sm">
                          {isRTL ? ctaButton.text_ar : ctaButton.text_en}
                        </Button>
                      </Link>
                    )}
                  </>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-muted/50 transition-colors"
                aria-label="Toggle menu"
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu - Full Screen Slide-in */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
            />
            
            {/* Slide-in Menu */}
            <motion.div
              initial={{ x: isRTL ? '-100%' : '100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? '-100%' : '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className={`fixed top-0 ${isRTL ? 'left-0' : 'right-0'} z-50 w-full max-w-sm h-full bg-background border-s border-border shadow-2xl lg:hidden safe-area-top`}
            >
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <Link to="/" onClick={() => setIsMobileMenuOpen(false)}>
                    <picture>
                      <source srcSet={logoUrl} type="image/webp" />
                      <img
                        src={logoUrl}
                        alt={logoAlt}
                        width={40}
                        height={40}
                        loading="eager"
                        decoding="async"
                        className="h-10 w-auto object-contain"
                      />
                    </picture>
                  </Link>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-muted/50"
                    aria-label="Close menu"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 overflow-y-auto py-4 px-4">
                  <div className="space-y-1">
                    {menuItems.map((item) => (
                      item.open_in_new_tab ? (
                        <a
                          key={item.id}
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`flex items-center justify-between py-4 px-4 rounded-xl transition-colors min-h-[52px] ${
                            isActive(item.link)
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-foreground hover:bg-muted/50'
                          }`}
                        >
                          <span className="text-lg">{isRTL ? item.title_ar : item.title_en}</span>
                          <ChevronRight className={`w-5 h-5 text-muted-foreground ${isRTL ? 'rotate-180' : ''}`} />
                        </a>
                      ) : (
                        <Link
                          key={item.id}
                          to={item.link}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`flex items-center justify-between py-4 px-4 rounded-xl transition-colors min-h-[52px] ${
                            isActive(item.link)
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-foreground hover:bg-muted/50'
                          }`}
                        >
                          <span className="text-lg">{isRTL ? item.title_ar : item.title_en}</span>
                          <ChevronRight className={`w-5 h-5 text-muted-foreground ${isRTL ? 'rotate-180' : ''}`} />
                        </Link>
                      )
                    ))}
                  </div>
                </nav>

                {/* Theme Toggle Row */}
                {/* <div className="px-4 pb-2">
                  <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-muted/30">
                    <span className="text-base text-foreground">{t('common.darkMode')}</span>
                    <ThemeToggle />
                  </div>
                </div> */}

                {/* Footer - Auth Buttons */}
                <div className="p-4 border-t border-border space-y-3 safe-area-bottom">
                  {user ? (
                    <>
                      <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="block">
                        <Button variant="outline" className="w-full h-12 text-base gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center">
                            <span className="text-sm font-bold text-secondary-foreground">
                              {profile?.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                            </span>
                          </div>
                          {profile?.full_name || t('nav.dashboard')}
                        </Button>
                      </Link>
                      <Button variant="ghost" onClick={handleSignOut} className="w-full h-12 text-base text-muted-foreground">
                        <LogOut className="w-5 h-5 me-2" />
                        {t('common.logout')}
                      </Button>
                    </>
                  ) : (
                    <>
                      {loginButton.is_visible && (
                        <Link to={loginButton.link} onClick={() => setIsMobileMenuOpen(false)} className="block">
                          <Button variant="outline" className="w-full h-12 text-base">
                            {isRTL ? loginButton.text_ar : loginButton.text_en}
                          </Button>
                        </Link>
                      )}
                      {ctaButton.is_visible && (
                        <Link to={ctaButton.link} onClick={() => setIsMobileMenuOpen(false)} className="block">
                          <Button variant="cta" className="w-full h-12 text-base">
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
