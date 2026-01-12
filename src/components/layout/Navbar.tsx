import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LogOut, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LanguageToggle from '@/components/common/LanguageToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import bikerzLogo from '@/assets/bikerz-logo.png';

const Navbar: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
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

  const navLinks = [
    { to: '/', label: t('nav.home') },
    { to: '/courses', label: t('nav.courses') },
    { to: '/mentors', label: isRTL ? 'المدربون' : 'Mentors' },
    { to: '/about', label: t('nav.about') },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 safe-area-top ${
          isScrolled || isMobileMenuOpen
            ? 'bg-background/95 backdrop-blur-xl border-b border-border/50 shadow-lg'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20 lg:h-24">
            {/* Logo */}
            <Link to="/" className="flex items-center flex-shrink-0">
              <motion.img
                src={bikerzLogo}
                alt="BIKERZ"
                whileHover={{ scale: 1.05 }}
                className="h-12 sm:h-16 md:h-20 lg:h-24 w-auto object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]"
              />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`nav-link ${isActive(link.to) ? 'active' : ''}`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              <LanguageToggle />
              
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
                    <Button variant="ghost" size="icon" onClick={handleSignOut} title={isRTL ? 'تسجيل الخروج' : 'Logout'}>
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Link to="/login">
                      <Button variant="ghost" size="sm">
                        {t('nav.login')}
                      </Button>
                    </Link>
                    <Link to="/signup">
                      <Button variant="cta" size="sm" className="px-4 py-2 text-sm">
                        {t('nav.signup')}
                      </Button>
                    </Link>
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
      </motion.nav>

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
                    <img
                      src={bikerzLogo}
                      alt="BIKERZ"
                      className="h-10 w-auto object-contain"
                    />
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
                    {navLinks.map((link) => (
                      <Link
                        key={link.to}
                        to={link.to}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center justify-between py-4 px-4 rounded-xl transition-colors min-h-[52px] ${
                          isActive(link.to)
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-foreground hover:bg-muted/50'
                        }`}
                      >
                        <span className="text-lg">{link.label}</span>
                        <ChevronRight className={`w-5 h-5 text-muted-foreground ${isRTL ? 'rotate-180' : ''}`} />
                      </Link>
                    ))}
                  </div>
                </nav>

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
                        {isRTL ? 'تسجيل الخروج' : 'Logout'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="block">
                        <Button variant="outline" className="w-full h-12 text-base">
                          {t('nav.login')}
                        </Button>
                      </Link>
                      <Link to="/signup" onClick={() => setIsMobileMenuOpen(false)} className="block">
                        <Button variant="cta" className="w-full h-12 text-base">
                          {t('nav.signup')}
                        </Button>
                      </Link>
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
