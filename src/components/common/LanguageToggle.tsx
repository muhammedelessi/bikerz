import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { stripLangPrefix } from '@/lib/i18nRouting';
import { Globe } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Language switcher — navigates to the same page in the other language.
 * e.g. /ar/courses → /en/courses (and vice versa).
 */
const LanguageToggle: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const handleToggle = () => {
    const newLang = language === 'ar' ? 'en' : 'ar';
    setLanguage(newLang);

    // Navigate to the same page with the new language prefix
    const basePath = stripLangPrefix(location.pathname);
    navigate(`/${newLang}${basePath === '/' ? '/' : basePath}${location.search}${location.hash}`, {
      replace: true,
    });
  };

  return (
    <motion.button
      type="button"
      onClick={handleToggle}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/30 border border-border/50 text-foreground hover:bg-muted/50 hover:border-primary/30 transition-all duration-300"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
    >
      <Globe className="w-4 h-4" aria-hidden />
      <span className="font-medium text-sm">
        {language === 'ar' ? 'EN' : 'عربي'}
      </span>
    </motion.button>
  );
};

export default LanguageToggle;
