import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import { Trophy, Sparkles, Rocket, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import confetti from 'canvas-confetti';

interface EnrollmentCelebrationProps {
  open: boolean;
  courseTitle: string;
  courseTitleAr?: string | null;
  onContinue: () => void;
}

const EnrollmentCelebration: React.FC<EnrollmentCelebrationProps> = ({
  open,
  courseTitle,
  courseTitleAr,
  onContinue,
}) => {
  const { isRTL } = useLanguage();
  const { t } = useTranslation();
  const [stage, setStage] = useState(0);
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const title = isRTL && courseTitleAr ? courseTitleAr : courseTitle;

  useEffect(() => {
    if (!open) {
      setStage(0);
      return;
    }

    // Fire confetti
    const fire = () => {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'],
      });
    };
    fire();
    const t1 = setTimeout(fire, 400);
    const t2 = setTimeout(fire, 800);

    // Animate stages
    const s1 = setTimeout(() => setStage(1), 300);
    const s2 = setTimeout(() => setStage(2), 800);
    const s3 = setTimeout(() => setStage(3), 1400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(s1);
      clearTimeout(s2);
      clearTimeout(s3);
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md p-4"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="relative w-full max-w-md mx-auto bg-card border-2 border-primary/30 rounded-3xl p-8 text-center shadow-2xl overflow-hidden"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-primary/5 pointer-events-none" />
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-primary/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-6">
              {/* Trophy icon */}
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={stage >= 0 ? { scale: 1, rotate: 0 } : {}}
                transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                className="mx-auto w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center"
              >
                <Trophy className="w-10 h-10 text-primary" />
              </motion.div>

              {/* Congrats text */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={stage >= 1 ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4 }}
              >
                <h2 className="text-2xl sm:text-3xl font-black text-foreground">
                  {t('course.enrollmentCelebration.congrats')}
                </h2>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    {t('course.enrollmentCelebration.enrolledSuccess')}
                  </p>
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
              </motion.div>

              {/* Course name */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={stage >= 2 ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4 }}
                className="bg-muted/50 rounded-2xl p-4 border border-border"
              >
                <p className="text-xs text-muted-foreground mb-1">
                  {t('course.enrollmentCelebration.courseLabel')}
                </p>
                <p className="text-lg font-bold text-foreground leading-tight">
                  {title}
                </p>
              </motion.div>

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={stage >= 3 ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4 }}
              >
                <Button
                  onClick={onContinue}
                  className="w-full h-14 text-base font-bold rounded-2xl gap-2"
                  variant="cta"
                >
                  <Rocket className="w-5 h-5" />
                  {t('course.enrollmentCelebration.startLearningNow')}
                  <ArrowIcon className="w-5 h-5" />
                </Button>
                <p className="text-xs text-muted-foreground mt-3">
                  {t('course.enrollmentCelebration.journeyStarts')}
                </p>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EnrollmentCelebration;
