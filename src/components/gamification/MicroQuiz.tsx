import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Timer,
  CheckCircle2,
  XCircle,
  Zap,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Trophy,
  AlertTriangle,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface QuizQuestion {
  id: string;
  question: string;
  question_ar?: string;
  options: { id: string; text: string; text_ar?: string }[];
  correct_answer: string;
}

interface MicroQuizProps {
  questions: QuizQuestion[];
  timeLimit?: number; // in seconds
  xpReward: number;
  onComplete: (result: { 
    score: number; 
    passed: boolean; 
    timeTaken: number;
    answers: Record<string, string>;
  }) => void;
  onClose: () => void;
  passingScore?: number;
  title?: string;
  titleAr?: string;
}

const MicroQuiz: React.FC<MicroQuizProps> = ({
  questions,
  timeLimit = 60,
  xpReward,
  onComplete,
  onClose,
  passingScore = 70,
  title = 'Quick Quiz',
  titleAr = 'اختبار سريع',
}) => {
  const { isRTL } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [showResult, setShowResult] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [startTime] = useState(Date.now());

  const NextIcon = isRTL ? ArrowLeft : ArrowRight;

  // Timer
  useEffect(() => {
    if (showResult || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showResult]);

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  const handleSelectOption = (optionId: string) => {
    if (isAnswered) return;
    
    setSelectedOption(optionId);
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionId }));
    setIsAnswered(true);

    // Visual feedback
    const isCorrect = optionId === currentQuestion.correct_answer;
    
    // Brief delay before auto-advancing
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        setSelectedOption(null);
        setIsAnswered(false);
      } else {
        handleSubmit();
      }
    }, isCorrect ? 800 : 1500);
  };

  const handleSubmit = useCallback(() => {
    const correctCount = questions.filter(
      (q) => answers[q.id] === q.correct_answer
    ).length;
    const score = Math.round((correctCount / questions.length) * 100);
    const passed = score >= passingScore;
    const timeTaken = Math.round((Date.now() - startTime) / 1000);

    if (passed) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#3b82f6', '#f97316'],
      });
    }

    setShowResult(true);
    onComplete({ score, passed, timeTaken, answers });
  }, [answers, questions, passingScore, startTime, onComplete]);

  const getOptionClass = (optionId: string) => {
    if (!isAnswered) {
      return selectedOption === optionId
        ? 'border-primary bg-primary/10'
        : 'border-border hover:border-primary/50';
    }

    if (optionId === currentQuestion.correct_answer) {
      return 'border-green-500 bg-green-500/10';
    }
    if (optionId === selectedOption && optionId !== currentQuestion.correct_answer) {
      return 'border-destructive bg-destructive/10';
    }
    return 'border-border opacity-50';
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Result screen
  if (showResult) {
    const correctCount = questions.filter((q) => answers[q.id] === q.correct_answer).length;
    const score = Math.round((correctCount / questions.length) * 100);
    const passed = score >= passingScore;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card-premium p-6 text-center"
      >
        <div className={`
          w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center
          ${passed ? 'bg-green-500/20' : 'bg-destructive/20'}
        `}>
          {passed ? (
            <Trophy className="w-10 h-10 text-green-500" />
          ) : (
            <AlertTriangle className="w-10 h-10 text-destructive" />
          )}
        </div>

        <h3 className="text-2xl font-bold text-foreground mb-2">
          {passed
            ? (isRTL ? 'ممتاز! 🎉' : 'Excellent! 🎉')
            : (isRTL ? 'حاول مرة أخرى' : 'Try Again')}
        </h3>

        <p className="text-4xl font-black text-foreground mb-4">{score}%</p>

        <p className="text-muted-foreground mb-4">
          {isRTL
            ? `أجبت على ${correctCount} من ${questions.length} أسئلة بشكل صحيح`
            : `You got ${correctCount} out of ${questions.length} correct`}
        </p>

        {passed && (
          <div className="flex items-center justify-center gap-2 bg-primary/10 rounded-lg p-3 mb-4">
            <Zap className="w-5 h-5 text-primary" />
            <span className="font-bold text-primary">+{xpReward} XP</span>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            {isRTL ? 'إغلاق' : 'Close'}
          </Button>
          {!passed && (
            <Button onClick={() => window.location.reload()} className="flex-1">
              <RotateCcw className="w-4 h-4 me-2" />
              {isRTL ? 'أعد المحاولة' : 'Retry'}
            </Button>
          )}
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
        <h3 className="font-bold text-foreground">
          {isRTL ? titleAr : title}
        </h3>
        <div className={`
          flex items-center gap-1 px-3 py-1 rounded-full
          ${timeLeft <= 10 ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'}
        `}>
          <Timer className="w-4 h-4" />
          <span className="font-mono font-bold">{formatTime(timeLeft)}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>
            {isRTL 
              ? `السؤال ${currentIndex + 1} من ${questions.length}` 
              : `Question ${currentIndex + 1} of ${questions.length}`}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
          className="mb-6"
        >
          <p className="text-lg font-semibold text-foreground mb-4">
            {isRTL && currentQuestion.question_ar
              ? currentQuestion.question_ar
              : currentQuestion.question}
          </p>

          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => (
              <motion.button
                key={option.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleSelectOption(option.id)}
                disabled={isAnswered}
                className={`
                  w-full p-4 rounded-xl border-2 text-start transition-all
                  ${getOptionClass(option.id)}
                  ${!isAnswered ? 'cursor-pointer' : 'cursor-default'}
                `}
              >
                <div className="flex items-center gap-3">
                  <div className={`
                    w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0
                    ${isAnswered && option.id === currentQuestion.correct_answer
                      ? 'border-green-500 bg-green-500 text-white'
                      : isAnswered && option.id === selectedOption
                        ? 'border-destructive bg-destructive text-white'
                        : 'border-current'
                    }
                  `}>
                    {isAnswered && option.id === currentQuestion.correct_answer ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : isAnswered && option.id === selectedOption ? (
                      <XCircle className="w-5 h-5" />
                    ) : (
                      <span className="text-sm font-bold">
                        {String.fromCharCode(65 + index)}
                      </span>
                    )}
                  </div>
                  <span className="text-foreground">
                    {isRTL && option.text_ar ? option.text_ar : option.text}
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* XP Reward indicator */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Zap className="w-4 h-4 text-primary" />
        <span>{isRTL ? `+${xpReward} XP عند النجاح` : `+${xpReward} XP on pass`}</span>
      </div>
    </motion.div>
  );
};

export default MicroQuiz;
