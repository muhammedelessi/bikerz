import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useLanguage } from '@/contexts/LanguageContext';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { isRTL } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isRTL ? 'تبديل الوضع الفاتح أو الداكن' : 'Toggle light or dark theme'}
      className="touch-target relative w-10 h-10 rounded-lg border border-border/50 bg-muted/40 hover:bg-muted hover:border-primary/40 transition-all duration-300 flex items-center justify-center"
    >
      <Sun
        aria-hidden
        className={`absolute w-4 h-4 transition-all duration-300 text-[hsl(var(--accent-orange))] ${
          theme === 'light' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-0'
        }`}
      />
      <Moon
        aria-hidden
        className={`absolute w-4 h-4 transition-all duration-300 text-[hsl(var(--sand))] ${
          theme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'
        }`}
      />
    </button>
  );
};

export default ThemeToggle;
