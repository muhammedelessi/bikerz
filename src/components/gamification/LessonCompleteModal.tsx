import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  Zap,
  Flame,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Star,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface LessonCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNextLesson?: () => void;
  onRetakeActivity?: () => void;
  xpEarned: number;
  streakDays: number;
  multiplier: number;
  isPerfect?: boolean;
  lessonTitle: string;
  hasNextLesson?: boolean;
}

const LessonCompleteModal: React.FC<LessonCompleteModalProps> = ({
  isOpen,
  onClose,
  onNextLesson,
  onRetakeActivity,
  xpEarned,
  streakDays,
  multiplier,
  isPerfect = false,
  lessonTitle,
  hasNextLesson = true,
}) => {
  const { isRTL } = useLanguage();
  const NextIcon = isRTL ? ArrowLeft : ArrowRight;

  useEffect(() => {
    if (isOpen) {
      // Celebration confetti
      const duration = 1500;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 20, spread: 180, ticks: 50, zIndex: 9999 };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }
        confetti({
          ...defaults,
          particleCount: 30,
          origin: { x: 0.5, y: 0.7 },
          colors: isPerfect 
            ? ['#fbbf24', '#f59e0b', '#eab308', '#facc15'] 
            : ['#22c55e', '#3b82f6', '#f97316'],
        });
      }, 200);
    }
  }, [isOpen, isPerfect]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.8, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 50 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl"
          >
            {/* Success Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="flex justify-center mb-6"
            >
              <div className={`
                w-20 h-20 rounded-full flex items-center justify-center
                ${isPerfect 
                  ? 'bg-gradient-to-br from-yellow-400 to-orange-500' 
                  : 'bg-gradient-to-br from-green-400 to-green-600'
                }
              `}>
                {isPerfect ? (
                  <Star className="w-10 h-10 text-white" />
                ) : (
                  <CheckCircle2 className="w-10 h-10 text-white" />
                )}
              </div>
            </motion.div>

            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-center mb-6"
            >
              <h2 className="text-2xl font-black text-foreground mb-1">
                {isPerfect 
                  ? (isRTL ? '🌟 أداء مثالي!' : '🌟 Perfect!')
                  : (isRTL ? '🎉 أحسنت!' : '🎉 Great Job!')
                }
              </h2>
              <p className="text-muted-foreground text-sm">
                {isRTL ? 'أكملت الدرس' : 'Lesson completed'}: {lessonTitle}
              </p>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="grid grid-cols-2 gap-3 mb-6"
            >
              {/* XP Earned */}
              <div className="bg-primary/10 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Zap className="w-5 h-5 text-primary" />
                  <span className="text-2xl font-black text-primary">+{xpEarned}</span>
                </div>
                <p className="text-xs text-muted-foreground">XP</p>
              </div>

              {/* Streak */}
              <div className="bg-orange-500/10 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Flame className="w-5 h-5 text-orange-400" />
                  <span className="text-2xl font-black text-orange-400">{streakDays}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? 'يوم سلسلة' : 'Day Streak'}
                </p>
              </div>
            </motion.div>

            {/* Multiplier Badge */}
            {multiplier > 1 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: 'spring' }}
                className="flex justify-center mb-6"
              >
                <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-full px-4 py-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-bold text-yellow-400">
                    {isRTL ? `مضاعف x${multiplier.toFixed(1)}` : `${multiplier.toFixed(1)}x Multiplier`}
                  </span>
                </div>
              </motion.div>
            )}

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="space-y-2"
            >
              {hasNextLesson && onNextLesson && (
                <Button
                  onClick={onNextLesson}
                  className="w-full h-12 text-base font-bold"
                >
                  {isRTL ? 'الدرس التالي' : 'Next Lesson'}
                  <NextIcon className="w-5 h-5 ms-2" />
                </Button>
              )}

              {onRetakeActivity && (
                <Button
                  variant="outline"
                  onClick={onRetakeActivity}
                  className="w-full h-10"
                >
                  <RotateCcw className="w-4 h-4 me-2" />
                  {isRTL ? 'أعد النشاط للتحسين' : 'Redo for Better Score'}
                </Button>
              )}

              <Button
                variant="ghost"
                onClick={onClose}
                className="w-full"
              >
                {isRTL ? 'إغلاق' : 'Close'}
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LessonCompleteModal;
