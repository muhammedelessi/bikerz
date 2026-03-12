import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SkipForward, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface NextLessonCountdownProps {
  nextLessonTitle: string;
  onGoToNext: () => void;
  onDismiss: () => void;
}

const NextLessonCountdown: React.FC<NextLessonCountdownProps> = ({
  nextLessonTitle,
  onGoToNext,
  onDismiss,
}) => {
  const { isRTL } = useLanguage();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (countdown <= 0) {
      onGoToNext();
      return;
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, onGoToNext]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/70"
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-4 flex items-center gap-4 max-w-md w-[90%]">
        {/* Circular countdown */}
        <div className="relative w-12 h-12 flex-shrink-0">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
            <motion.circle
              cx="24" cy="24" r="20"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={125.66}
              initial={{ strokeDashoffset: 0 }}
              animate={{ strokeDashoffset: 125.66 }}
              transition={{ duration: 5, ease: 'linear' }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">
            {Math.max(0, countdown)}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">
            {isRTL ? 'الدرس التالي' : 'Up next'}
          </p>
          <p className="text-sm font-semibold text-foreground truncate">
            {nextLessonTitle}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button
            size="sm"
            onClick={onGoToNext}
            className="gap-1.5"
          >
            <SkipForward className="w-4 h-4" />
            {isRTL ? 'الآن' : 'Now'}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={onDismiss}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default NextLessonCountdown;
