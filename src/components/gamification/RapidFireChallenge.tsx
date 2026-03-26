import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Zap,
  Timer,
  CheckCircle2,
  XCircle,
  Trophy,
  Flame,
  RotateCcw,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface RapidQuestion {
  id: string;
  question: string;
  question_ar?: string;
  options: { id: string; text: string; text_ar?: string }[];
  correct_answer: string;
}

interface RapidFireChallengeProps {
  questions: RapidQuestion[];
  timePerQuestion?: number; // seconds per question
  xpReward: number;
  onComplete: (result: {
    score: number;
    streak: number;
    maxStreak: number;
    timeTaken: number;
  }) => void;
  onClose: () => void;
}

const RapidFireChallenge: React.FC<RapidFireChallengeProps> = ({
  questions,
  timePerQuestion = 8,
  xpReward,
  onComplete,
  onClose,
}) => {
  const { isRTL } = useLanguage();
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timePerQuestion);
  const [score, setScore] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [startTime] = useState(Date.now());
  const [isActive, setIsActive] = useState(true);

  const currentQuestion = questions[currentIndex];

  // Timer countdown
  useEffect(() => {
    if (!isActive || showResult || feedback) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleTimeout();
          return timePerQuestion;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, showResult, feedback, currentIndex]);

  const handleTimeout = useCallback(() => {
    setFeedback('wrong');
    setCurrentStreak(0);
    
    setTimeout(() => {
      goToNext();
    }, 500);
  }, [currentIndex, questions.length]);

  const handleAnswer = (optionId: string) => {
    if (feedback || !isActive) return;

    const isCorrect = optionId === currentQuestion.correct_answer;
    setFeedback(isCorrect ? 'correct' : 'wrong');

    if (isCorrect) {
      setScore((prev) => prev + 1);
      setCurrentStreak((prev) => {
        const newStreak = prev + 1;
        setMaxStreak((max) => Math.max(max, newStreak));
        return newStreak;
      });

      // Mini celebration for streak
      if ((currentStreak + 1) % 5 === 0) {
        confetti({
          particleCount: 30,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#f97316', '#eab308'],
        });
      }
    } else {
      setCurrentStreak(0);
    }

    setTimeout(() => {
      goToNext();
    }, isCorrect ? 400 : 800);
  };

  const goToNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setTimeLeft(timePerQuestion);
      setFeedback(null);
    } else {
      finishChallenge();
    }
  };

  const finishChallenge = () => {
    setIsActive(false);
    setShowResult(true);
    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    
    if (score >= questions.length * 0.7) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }

    onComplete({ score, streak: currentStreak, maxStreak, timeTaken });
  };

  const getTimerColor = () => {
    if (timeLeft <= 2) return 'text-destructive';
    if (timeLeft <= 4) return 'text-yellow-500';
    return 'text-primary';
  };

  // Result screen
  if (showResult) {
    const percentage = Math.round((score / questions.length) * 100);

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card-premium p-6 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mx-auto mb-4"
        >
          <Trophy className="w-12 h-12 text-white" />
        </motion.div>

        <h3 className="text-2xl font-bold text-foreground mb-2">
          {t('gamification.rapidFireChallenge.completeTitle')}
        </h3>

        <p className="text-5xl font-black text-primary mb-4">{percentage}%</p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-muted/50 rounded-xl p-3">
            <p className="text-sm text-muted-foreground">
              {t('gamification.rapidFireChallenge.scoreLabel')}
            </p>
            <p className="text-xl font-bold text-foreground">
              {score}/{questions.length}
            </p>
          </div>
          <div className="bg-orange-500/10 rounded-xl p-3">
            <div className="flex items-center justify-center gap-1">
              <Flame className="w-4 h-4 text-orange-500" />
              <p className="text-sm text-muted-foreground">
                {t('gamification.rapidFireChallenge.bestStreakLabel')}
              </p>
            </div>
            <p className="text-xl font-bold text-orange-500">{maxStreak}</p>
          </div>
        </div>

        {percentage >= 70 && (
          <div className="flex items-center justify-center gap-2 bg-primary/10 rounded-lg p-3 mb-4">
            <Zap className="w-5 h-5 text-primary" />
            <span className="font-bold text-primary">+{xpReward} XP</span>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            {t('gamification.rapidFireChallenge.close')}
          </Button>
          <Button onClick={() => window.location.reload()} className="flex-1">
            <RotateCcw className="w-4 h-4 me-2" />
            {t('gamification.rapidFireChallenge.tryAgain')}
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-premium p-4 sm:p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <span className="font-bold text-foreground">
            {t('gamification.rapidFireChallenge.title')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Streak */}
          {currentStreak > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 bg-orange-500/20 px-2 py-1 rounded-full"
            >
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-bold text-orange-400">{currentStreak}</span>
            </motion.div>
          )}
          {/* Timer */}
          <motion.div
            animate={timeLeft <= 3 ? { scale: [1, 1.1, 1] } : {}}
            transition={{ repeat: timeLeft <= 3 ? Infinity : 0, duration: 0.5 }}
            className={`flex items-center gap-1 font-mono font-bold ${getTimerColor()}`}
          >
            <Timer className="w-4 h-4" />
            <span>{timeLeft}s</span>
          </motion.div>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1 mb-6 justify-center">
        {questions.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${
              i < currentIndex
                ? 'bg-primary'
                : i === currentIndex
                  ? 'bg-primary scale-125'
                  : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="mb-6"
        >
          <p className="text-lg font-semibold text-foreground text-center mb-6">
            {isRTL && currentQuestion.question_ar
              ? currentQuestion.question_ar
              : currentQuestion.question}
          </p>

          <div className="grid grid-cols-2 gap-3">
            {currentQuestion.options.map((option) => (
              <motion.button
                key={option.id}
                whileHover={!feedback ? { scale: 1.02 } : {}}
                whileTap={!feedback ? { scale: 0.98 } : {}}
                onClick={() => handleAnswer(option.id)}
                disabled={!!feedback}
                className={`
                  p-4 rounded-xl border-2 text-center transition-all
                  ${feedback === 'correct' && option.id === currentQuestion.correct_answer
                    ? 'border-green-500 bg-green-500/10'
                    : feedback === 'wrong' && option.id === currentQuestion.correct_answer
                      ? 'border-green-500 bg-green-500/10'
                      : feedback === 'wrong' && option.id !== currentQuestion.correct_answer
                        ? 'border-border opacity-50'
                        : 'border-border hover:border-primary bg-card'
                  }
                `}
              >
                <span className="text-foreground font-medium">
                  {isRTL && option.text_ar ? option.text_ar : option.text}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Feedback overlay */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
          >
            <div className={`
              w-24 h-24 rounded-full flex items-center justify-center
              ${feedback === 'correct' ? 'bg-green-500' : 'bg-destructive'}
            `}>
              {feedback === 'correct' ? (
                <CheckCircle2 className="w-12 h-12 text-white" />
              ) : (
                <XCircle className="w-12 h-12 text-white" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Score */}
      <div className="flex justify-center">
        <div className="bg-muted/50 px-4 py-2 rounded-full">
          <span className="text-sm text-muted-foreground">
            {t('gamification.rapidFireChallenge.scorePrefix')}{' '}
            <span className="font-bold text-foreground">{score}</span>
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default RapidFireChallenge;
