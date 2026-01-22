import React, { useState, useEffect } from 'react';
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

interface TestQuestion {
  id: string;
  question: string;
  question_ar: string | null;
  question_type: string;
  options: Json;
  correct_answer: string;
  points: number;
  position: number;
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

  // Fetch questions
  const { data: questions = [], isLoading: questionsLoading } = useQuery({
    queryKey: ['test-questions', testId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('test_questions')
        .select('*')
        .eq('test_id', testId)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as TestQuestion[];
    },
    enabled: !!testId,
  });

  // Submit attempt mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user || !test) throw new Error('Not authenticated');

      let correctCount = 0;
      let totalPoints = 0;

      questions.forEach((q) => {
        totalPoints += q.points;
        if (answers[q.id] === q.correct_answer) {
          correctCount += q.points;
        }
      });

      const score = totalPoints > 0 ? Math.round((correctCount / totalPoints) * 100) : 0;
      const passed = score >= test.passing_score;

      const { error } = await supabase
        .from('test_attempts')
        .insert({
          test_id: testId,
          user_id: user.id,
          answers: answers as unknown as Json,
          score,
          passed,
          completed_at: new Date().toISOString(),
        });

      if (error) throw error;
      return { score, passed };
    },
    onSuccess: (result) => {
      setShowResults(true);
      if (result.passed) {
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

  const calculateResults = () => {
    let correctCount = 0;
    let totalPoints = 0;

    questions.forEach((q) => {
      totalPoints += q.points;
      if (answers[q.id] === q.correct_answer) {
        correctCount += q.points;
      }
    });

    const score = totalPoints > 0 ? Math.round((correctCount / totalPoints) * 100) : 0;
    const passed = test ? score >= test.passing_score : false;

    return { score, passed, correctCount, totalQuestions: questions.length };
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

  // Answer Review Screen
  if (showReview) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-3xl mx-auto px-4"
      >
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => setShowReview(false)} className="h-11 sm:h-10">
            <ArrowLeft className="w-4 h-4 me-2" />
            {isRTL ? 'العودة للنتائج' : 'Back to Results'}
          </Button>
          <h1 className="text-lg sm:text-xl font-bold text-foreground">
            {isRTL ? 'مراجعة الإجابات' : 'Answer Review'}
          </h1>
        </div>

        <div className="space-y-4">
          {questions.map((question, index) => {
            const userAnswer = answers[question.id];
            const isCorrect = userAnswer === question.correct_answer;
            const options = parseOptions(question.options);
            const correctOption = options.find(o => o.id === question.correct_answer);
            const userOption = options.find(o => o.id === userAnswer);

            return (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`card-premium p-4 sm:p-5 border-2 ${
                  isCorrect ? 'border-primary/50 bg-primary/5' : 'border-destructive/50 bg-destructive/5'
                }`}
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    isCorrect ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground'
                  }`}>
                    {isCorrect ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">
                      {isRTL ? `السؤال ${index + 1}` : `Question ${index + 1}`}
                    </p>
                    <h3 className="text-sm sm:text-base font-medium text-foreground">
                      {isRTL && question.question_ar ? question.question_ar : question.question}
                    </h3>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {options.map((option) => {
                    const isUserAnswer = option.id === userAnswer;
                    const isCorrectAnswer = option.id === question.correct_answer;
                    
                    let optionClass = 'border-border bg-background';
                    if (isCorrectAnswer) {
                      optionClass = 'border-primary bg-primary/10';
                    } else if (isUserAnswer && !isCorrect) {
                      optionClass = 'border-destructive bg-destructive/10';
                    }

                    return (
                      <div
                        key={option.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${optionClass}`}
                      >
                        <div className="flex-shrink-0">
                          {isCorrectAnswer ? (
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                          ) : isUserAnswer ? (
                            <XCircle className="w-4 h-4 text-destructive" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                          )}
                        </div>
                        <span className={`text-sm ${
                          isCorrectAnswer ? 'text-primary font-medium' : 
                          isUserAnswer && !isCorrect ? 'text-destructive' : 'text-foreground'
                        }`}>
                          {isRTL && option.text_ar ? option.text_ar : option.text}
                        </span>
                        {isUserAnswer && (
                          <span className="ms-auto text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {isRTL ? 'إجابتك' : 'Your answer'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                <div className={`p-3 rounded-lg ${isCorrect ? 'bg-primary/10' : 'bg-muted/50'}`}>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {isCorrect ? (
                      <>
                        <span className="font-medium text-primary">
                          {isRTL ? '✓ صحيح!' : '✓ Correct!'}
                        </span>
                        {' '}
                        {isRTL 
                          ? `الإجابة الصحيحة هي "${correctOption ? (isRTL && correctOption.text_ar ? correctOption.text_ar : correctOption.text) : ''}".`
                          : `The correct answer is "${correctOption ? correctOption.text : ''}".`
                        }
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-destructive">
                          {isRTL ? '✗ غير صحيح.' : '✗ Incorrect.'}
                        </span>
                        {' '}
                        {userOption ? (
                          isRTL 
                            ? `أجبت "${isRTL && userOption.text_ar ? userOption.text_ar : userOption.text}"، لكن الإجابة الصحيحة هي "${correctOption ? (isRTL && correctOption.text_ar ? correctOption.text_ar : correctOption.text) : ''}".`
                            : `You answered "${userOption.text}", but the correct answer is "${correctOption ? correctOption.text : ''}".`
                        ) : (
                          isRTL 
                            ? `لم تجب على هذا السؤال. الإجابة الصحيحة هي "${correctOption ? (isRTL && correctOption.text_ar ? correctOption.text_ar : correctOption.text) : ''}".`
                            : `You didn't answer this question. The correct answer is "${correctOption ? correctOption.text : ''}".`
                        )}
                      </>
                    )}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-center">
          <Button onClick={() => setShowReview(false)} className="h-11 sm:h-10">
            {isRTL ? 'العودة للنتائج' : 'Back to Results'}
          </Button>
        </div>
      </motion.div>
    );
  }

  // Results screen
  if (showResults) {
    const results = calculateResults();

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

          {/* Review Answers Button */}
          <Button
            variant="outline"
            className="w-full mb-4 h-11 sm:h-10"
            onClick={() => setShowReview(true)}
          >
            <CheckCircle2 className="w-4 h-4 me-2" />
            {isRTL ? 'مراجعة الإجابات' : 'Review Answers'}
          </Button>

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
