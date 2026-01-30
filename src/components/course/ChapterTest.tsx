import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Trophy,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';
import confetti from 'canvas-confetti';

// Student-facing question interface (excludes correct_answer for security)
interface TestQuestion {
  id: string;
  question: string;
  question_ar: string | null;
  question_type: string;
  options: Json;
  points: number;
  position: number;
}

// Full question with correct_answer - only used in review after grading
interface TestQuestionWithAnswer extends TestQuestion {
  correct_answer: string;
}

interface ChapterTestData {
  id: string;
  title: string;
  title_ar: string | null;
  description: string | null;
  description_ar: string | null;
  passing_score: number;
  time_limit_minutes: number | null;
}

interface QuestionOption {
  id: string;
  text: string;
  text_ar?: string;
}

interface ChapterTestProps {
  testId: string;
  chapterTitle: string;
  onComplete: () => void;
  onBack: () => void;
}

// Server grading result interface
interface GradingResult {
  score: number;
  passed: boolean;
  correct_count: number;
  correct_answers: Record<string, string>;
}

const ChapterTest: React.FC<ChapterTestProps> = ({ testId, chapterTitle, onComplete, onBack }) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [testStarted, setTestStarted] = useState(false);
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);

  // Confetti celebration function
  const fireConfetti = useCallback(() => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      // Confetti from both sides
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#22c55e', '#eab308', '#3b82f6', '#f97316', '#ec4899'],
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#22c55e', '#eab308', '#3b82f6', '#f97316', '#ec4899'],
      });
    }, 250);
  }, []);

  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  // Fetch test details
  const { data: test, isLoading: testLoading } = useQuery({
    queryKey: ['chapter-test', testId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chapter_tests')
        .select('*')
        .eq('id', testId)
        .maybeSingle();

      if (error) throw error;
      return data as ChapterTestData | null;
    },
    enabled: !!testId,
  });

  // Fetch questions from secure view (excludes correct_answer)
  const { data: questions = [], isLoading: questionsLoading } = useQuery({
    queryKey: ['test-questions-student', testId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('test_questions_student' as 'test_questions')
        .select('id, test_id, question, question_ar, question_type, options, points, position')
        .eq('test_id', testId)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as TestQuestion[];
    },
    enabled: !!testId,
  });

  // Submit attempt mutation - uses server-side grading for security
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user || !test) throw new Error('Not authenticated');

      // Call server-side grading function - score is calculated on the server
      // This prevents client-side manipulation of test scores
      const { data, error } = await supabase.rpc('grade_test_attempt', {
        p_test_id: testId,
        p_user_answers: answers
      });

      if (error) throw error;
      
      // The server returns the grading result
      const result = data?.[0];
      if (!result) throw new Error('No grading result returned');
      
      return { 
        score: result.score as number, 
        passed: result.passed as boolean,
        correct_count: result.correct_count as number
      };
    },
    onSuccess: (result) => {
      // Store the grading result for display
      setGradingResult({
        score: result.score,
        passed: result.passed,
        correct_count: result.correct_count,
        correct_answers: {} // Answers are not returned for security - review is simplified
      });
      setShowResults(true);
      if (result.passed) {
        // Fire confetti celebration!
        fireConfetti();
        toast.success(isRTL ? 'مبروك! اجتزت الاختبار' : 'Congratulations! You passed!');
      } else {
        toast.error(isRTL ? 'لم تجتز الاختبار، حاول مرة أخرى' : "You didn't pass. Try again!");
      }
    },
    onError: () => {
      toast.error(isRTL ? 'حدث خطأ' : 'Something went wrong');
    },
  });

  // Timer
  useEffect(() => {
    if (!testStarted || !test?.time_limit_minutes || timeLeft === null) return;

    if (timeLeft <= 0) {
      submitMutation.mutate();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [testStarted, timeLeft, test?.time_limit_minutes]);

  const startTest = () => {
    setTestStarted(true);
    if (test?.time_limit_minutes) {
      setTimeLeft(test.time_limit_minutes * 60);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

  const handleAnswer = (value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: value,
    }));
  };

  const goNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const goPrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = () => {
    if (Object.keys(answers).length < questions.length) {
      toast.error(isRTL ? 'يرجى الإجابة على جميع الأسئلة' : 'Please answer all questions');
      return;
    }
    submitMutation.mutate();
  };

  const formatTimeLeft = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const parseOptions = (options: Json): QuestionOption[] => {
    if (Array.isArray(options)) {
      return options.map((opt) => {
        if (typeof opt === 'object' && opt !== null && 'id' in opt && 'text' in opt) {
          return opt as unknown as QuestionOption;
        }
        return { id: String(opt), text: String(opt) };
      });
    }
    return [];
  };

  // Get results from server grading (not calculated client-side for security)
  const getResults = () => {
    if (gradingResult) {
      return { 
        score: gradingResult.score, 
        passed: gradingResult.passed, 
        correctCount: gradingResult.correct_count, 
        totalQuestions: questions.length 
      };
    }
    // Fallback for display purposes only (actual scoring is server-side)
    return { score: 0, passed: false, correctCount: 0, totalQuestions: questions.length };
  };

  if (testLoading || questionsLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4">
        <Skeleton className="h-6 sm:h-8 w-48 sm:w-64 mb-4 sm:mb-6" />
        <Skeleton className="h-3 sm:h-4 w-full mb-6 sm:mb-8" />
        <Skeleton className="h-40 sm:h-48 w-full" />
      </div>
    );
  }

  if (!test || questions.length === 0) {
    return (
      <div className="max-w-3xl mx-auto text-center py-8 sm:py-12 px-4">
        <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
          {isRTL ? 'الاختبار غير متوفر' : 'Test Not Available'}
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground mb-6">
          {isRTL ? 'لا توجد أسئلة في هذا الاختبار حالياً' : 'There are no questions in this test yet'}
        </p>
        <Button variant="outline" onClick={onBack} className="h-11 sm:h-10">
          <ArrowLeft className="w-4 h-4 me-2" />
          {isRTL ? 'العودة' : 'Go Back'}
        </Button>
      </div>
    );
  }

  // Note: Answer Review with correct answers is disabled for security
  // The correct answers are never sent to the client to prevent cheating
  // Students can see their score but not which specific answers were correct

  // Results screen
  if (showResults) {
    const results = getResults();

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl mx-auto px-4"
      >
        <div className="card-premium p-5 sm:p-6 lg:p-8 text-center">
          <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full mx-auto mb-4 sm:mb-6 flex items-center justify-center ${
            results.passed ? 'bg-primary/20' : 'bg-destructive/20'
          }`}>
            {results.passed ? (
              <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
            ) : (
              <XCircle className="w-10 h-10 sm:w-12 sm:h-12 text-destructive" />
            )}
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            {results.passed
              ? (isRTL ? 'مبروك!' : 'Congratulations!')
              : (isRTL ? 'حاول مرة أخرى' : 'Try Again')}
          </h2>

          <p className="text-sm sm:text-base text-muted-foreground mb-6">
            {results.passed
              ? (isRTL ? 'لقد اجتزت الاختبار بنجاح' : 'You passed the test successfully')
              : (isRTL ? 'لم تحقق الحد الأدنى للنجاح' : "You didn't reach the passing score")}
          </p>

          <div className="bg-muted/50 rounded-xl p-4 sm:p-6 mb-6">
            <div className="text-4xl sm:text-5xl font-bold text-foreground mb-2">
              {results.score}%
            </div>
            <div className="text-sm sm:text-base text-muted-foreground">
              {results.correctCount} / {results.totalQuestions} {isRTL ? 'إجابات صحيحة' : 'correct answers'}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-2">
              {isRTL ? 'الحد الأدنى للنجاح:' : 'Passing score:'} {test.passing_score}%
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
            {!results.passed && (
              <Button
                variant="outline"
                className="h-11 sm:h-10"
                onClick={() => {
                  setShowResults(false);
                  setShowReview(false);
                  setAnswers({});
                  setCurrentQuestionIndex(0);
                  setTestStarted(false);
                  setTimeLeft(null);
                  setGradingResult(null);
                }}
              >
                {isRTL ? 'إعادة الاختبار' : 'Retry Test'}
              </Button>
            )}
            <Button onClick={onComplete} className="h-11 sm:h-10">
              {isRTL ? 'متابعة' : 'Continue'}
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Start screen
  if (!testStarted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto px-4"
      >
        <Button variant="ghost" onClick={onBack} className="mb-4 sm:mb-6 h-11 sm:h-10">
          <ArrowLeft className="w-4 h-4 me-2" />
          {isRTL ? 'العودة للدروس' : 'Back to Lessons'}
        </Button>

        <div className="card-premium p-5 sm:p-6 lg:p-8 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/20 mx-auto mb-4 sm:mb-6 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
            {isRTL && test.title_ar ? test.title_ar : test.title}
          </h1>
          
          <p className="text-xs sm:text-sm text-primary mb-4">{chapterTitle}</p>

          {test.description && (
            <p className="text-sm sm:text-base text-muted-foreground mb-6">
              {isRTL && test.description_ar ? test.description_ar : test.description}
            </p>
          )}

          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-6 sm:mb-8 text-muted-foreground text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>{questions.length} {isRTL ? 'أسئلة' : 'questions'}</span>
            </div>
            {test.time_limit_minutes && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>{test.time_limit_minutes} {isRTL ? 'دقيقة' : 'minutes'}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>{test.passing_score}% {isRTL ? 'للنجاح' : 'to pass'}</span>
            </div>
          </div>

          <Button onClick={startTest} className="btn-cta h-11 sm:h-10 w-full sm:w-auto">
            {isRTL ? 'ابدأ الاختبار' : 'Start Test'}
          </Button>
        </div>
      </motion.div>
    );
  }

  // Test screen
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-3xl mx-auto px-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-foreground">
            {isRTL && test.title_ar ? test.title_ar : test.title}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {isRTL ? 'السؤال' : 'Question'} {currentQuestionIndex + 1} / {questions.length}
          </p>
        </div>
        
        {timeLeft !== null && (
          <div className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full self-start ${
            timeLeft < 60 ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'
          }`}>
            <Clock className="w-4 h-4" />
            <span className="font-mono font-medium text-sm">{formatTimeLeft(timeLeft)}</span>
          </div>
        )}
      </div>

      {/* Progress */}
      <Progress value={progress} className="h-2 mb-6 sm:mb-8" />

      {/* Question */}
      <motion.div
        key={currentQuestion.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="card-premium p-4 sm:p-6 mb-4 sm:mb-6"
      >
        <h2 className="text-base sm:text-lg font-semibold text-foreground mb-4 sm:mb-6">
          {isRTL && currentQuestion.question_ar ? currentQuestion.question_ar : currentQuestion.question}
        </h2>

        <RadioGroup
          value={answers[currentQuestion.id] || ''}
          onValueChange={handleAnswer}
          className="space-y-2 sm:space-y-3"
        >
          {parseOptions(currentQuestion.options).map((option) => (
            <div
              key={option.id}
              className={`flex items-center gap-3 p-3 sm:p-4 rounded-lg border transition-colors cursor-pointer touch-target ${
                answers[currentQuestion.id] === option.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => handleAnswer(option.id)}
            >
              <RadioGroupItem value={option.id} id={option.id} />
              <Label htmlFor={option.id} className="flex-1 cursor-pointer text-sm sm:text-base text-foreground">
                {isRTL && option.text_ar ? option.text_ar : option.text}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </motion.div>

      {/* Navigation */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={goPrev}
          disabled={currentQuestionIndex === 0}
          className="h-11 sm:h-10 order-2 sm:order-1"
        >
          <BackIcon className="w-4 h-4 me-2" />
          {isRTL ? 'السابق' : 'Previous'}
        </Button>

        {currentQuestionIndex === questions.length - 1 ? (
          <Button
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            className="btn-cta h-11 sm:h-10 order-1 sm:order-2"
          >
            {submitMutation.isPending
              ? (isRTL ? 'جاري الإرسال...' : 'Submitting...')
              : (isRTL ? 'إرسال الإجابات' : 'Submit Answers')}
          </Button>
        ) : (
          <Button onClick={goNext} className="h-11 sm:h-10 order-1 sm:order-2">
            {isRTL ? 'التالي' : 'Next'}
            <NextIcon className="w-4 h-4 ms-2" />
          </Button>
        )}
      </div>

      {/* Question indicators */}
      <div className="flex flex-wrap justify-center gap-2 mt-6 sm:mt-8">
        {questions.map((q, index) => (
          <button
            key={q.id}
            onClick={() => setCurrentQuestionIndex(index)}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full text-xs font-medium transition-colors touch-target ${
              index === currentQuestionIndex
                ? 'bg-primary text-primary-foreground'
                : answers[q.id]
                  ? 'bg-primary/30 text-primary'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </motion.div>
  );
};

export default ChapterTest;
