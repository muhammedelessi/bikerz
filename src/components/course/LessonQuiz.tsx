import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle2, XCircle, Zap, HelpCircle, RotateCcw, Trophy, Lightbulb,
} from 'lucide-react';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';
import confetti from 'canvas-confetti';
import { useGamification } from '@/hooks/useGamification';

type QuestionType = 'single_choice' | 'multiple_choice' | 'dropdown';

interface QuestionOption {
  id: string;
  text: string;
  text_ar?: string;
}

interface QuizQuestionData {
  question: string;
  question_ar?: string;
  question_type: QuestionType;
  options: QuestionOption[];
  explanation?: string;
  explanation_ar?: string;
}

interface LessonActivity {
  id: string;
  lesson_id: string;
  activity_type: string;
  title: string;
  title_ar: string | null;
  data: QuizQuestionData;
  xp_reward: number;
  position: number;
  is_published: boolean;
}

interface LessonQuizProps {
  lessonId: string;
  isQuizOnlyLesson?: boolean;
  onComplete?: (totalXp: number) => void;
}

// Track server-graded results per question
interface GradedResult {
  isCorrect: boolean;
  xpEarned: number;
}

const LessonQuiz: React.FC<LessonQuizProps> = ({ lessonId, isQuizOnlyLesson = false, onComplete }) => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { checkBadges, gamificationData } = useGamification();

  const queryClient = useQueryClient();

  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string[]>>({});
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<string>>(new Set());
  const [gradedResults, setGradedResults] = useState<Record<string, GradedResult>>({});
  const [showExplanation, setShowExplanation] = useState<Set<string>>(new Set());
  const [totalXpEarned, setTotalXpEarned] = useState(0);

  const parseData = (data: Json): QuizQuestionData => {
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      const obj = data as Record<string, unknown>;
      return {
        question: String(obj.question || ''),
        question_ar: obj.question_ar ? String(obj.question_ar) : undefined,
        question_type: (obj.question_type as QuestionType) || 'single_choice',
        options: Array.isArray(obj.options) ? obj.options.map((opt: unknown) => {
          const o = opt as Record<string, unknown>;
          return {
            id: String(o.id || ''),
            text: String(o.text || ''),
            text_ar: o.text_ar ? String(o.text_ar) : undefined,
          };
        }) : [],
        // correct_answers is NOT available from the view — grading is server-side
        explanation: obj.explanation ? String(obj.explanation) : undefined,
        explanation_ar: obj.explanation_ar ? String(obj.explanation_ar) : undefined,
      };
    }
    return {
      question: '',
      question_type: 'single_choice',
      options: [],
    };
  };

  // Fetch from the SAFE student view (no correct answers)
  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['lesson-quiz', lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lesson_activities_student' as any)
        .select('*')
        .eq('lesson_id', lessonId)
        .eq('activity_type', 'lesson_quiz')
        .eq('is_published', true)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data || []).map((q: any) => ({
        id: q.id,
        lesson_id: q.lesson_id,
        activity_type: q.activity_type,
        title: q.title,
        title_ar: q.title_ar,
        data: parseData(q.data),
        xp_reward: q.xp_reward,
        position: q.position,
        is_published: q.is_published,
      })) as LessonActivity[];
    },
    enabled: !!lessonId,
  });

  // Fetch existing attempts to know which are already passed
  const { data: existingAttempts = [] } = useQuery({
    queryKey: ['lesson-quiz-attempts', lessonId, user?.id],
    queryFn: async () => {
      if (!user) return [];
      const activityIds = questions.map(q => q.id);
      if (activityIds.length === 0) return [];
      const { data, error } = await supabase
        .from('user_activity_attempts')
        .select('activity_id, passed, xp_earned')
        .eq('user_id', user.id)
        .in('activity_id', activityIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && questions.length > 0,
  });

  const isQuestionPassed = (activityId: string) => {
    return existingAttempts.some(a => a.activity_id === activityId && a.passed);
  };

  const scrollToNextQuestion = useCallback((currentQuestionId: string) => {
    const currentIndex = questions.findIndex(q => q.id === currentQuestionId);
    const nextQuestion = questions[currentIndex + 1];
    if (nextQuestion && questionRefs.current[nextQuestion.id]) {
      setTimeout(() => {
        questionRefs.current[nextQuestion.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500);
    } else if (currentIndex === questions.length - 1 && onComplete) {
      setTimeout(() => { onComplete(totalXpEarned); }, 1000);
    }
  }, [questions, onComplete, totalXpEarned]);

  // Server-side grading via RPC
  const submitAnswerMutation = useMutation({
    mutationFn: async ({ activityId, answers }: { activityId: string; answers: string[] }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('grade_lesson_activity', {
        p_activity_id: activityId,
        p_user_answers: answers,
      });

      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      return {
        activityId,
        isCorrect: result.is_correct as boolean,
        xpEarned: result.xp_earned as number,
      };
    },
    onSuccess: ({ activityId, isCorrect, xpEarned }) => {
      setGradedResults(prev => ({ ...prev, [activityId]: { isCorrect, xpEarned } }));
      queryClient.invalidateQueries({ queryKey: ['lesson-quiz-attempts'] });

      if (isCorrect && xpEarned > 0) {
        setTotalXpEarned(prev => prev + xpEarned);
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 }, colors: ['#22c55e', '#3b82f6', '#f97316'] });
      
        const newTotalXP = (gamificationData?.total_xp || 0) + xpEarned;
        checkBadges({
          quizzesPassed: 1,
          perfectScore: true,
          totalXP: newTotalXP,
          streakDays: gamificationData?.current_streak || 1,
        });
      }
      scrollToNextQuestion(activityId);
    },
    onError: () => {
      toast.error(isRTL ? 'حدث خطأ أثناء التحقق' : 'Error checking answer');
    },
  });

  const handleSelectAnswer = (questionId: string, optionId: string, questionType: QuestionType) => {
    if (submittedQuestions.has(questionId)) return;
    if (questionType === 'multiple_choice') {
      const current = selectedAnswers[questionId] || [];
      const newSelection = current.includes(optionId)
        ? current.filter(id => id !== optionId)
        : [...current, optionId];
      setSelectedAnswers({ ...selectedAnswers, [questionId]: newSelection });
    } else {
      setSelectedAnswers({ ...selectedAnswers, [questionId]: [optionId] });
    }
  };

  const handleSubmitAnswer = (question: LessonActivity) => {
    const answers = selectedAnswers[question.id] || [];
    if (answers.length === 0) {
      toast.error(isRTL ? 'الرجاء اختيار إجابة' : 'Please select an answer');
      return;
    }

    setSubmittedQuestions(prev => new Set(prev).add(question.id));

    if (question.data.explanation || question.data.explanation_ar) {
      setShowExplanation(prev => new Set(prev).add(question.id));
    }

    if (!isQuestionPassed(question.id)) {
      submitAnswerMutation.mutate({ activityId: question.id, answers });
    } else {
      // Already passed — just mark and scroll
      setGradedResults(prev => ({ ...prev, [question.id]: { isCorrect: true, xpEarned: 0 } }));
      scrollToNextQuestion(question.id);
    }
  };

  const handleRetry = (questionId: string) => {
    setSubmittedQuestions(prev => {
      const newSet = new Set(prev);
      newSet.delete(questionId);
      return newSet;
    });
    setSelectedAnswers({ ...selectedAnswers, [questionId]: [] });
    setGradedResults(prev => {
      const copy = { ...prev };
      delete copy[questionId];
      return copy;
    });
    setShowExplanation(prev => {
      const newSet = new Set(prev);
      newSet.delete(questionId);
      return newSet;
    });
  };

  // Option styling — after submission, we only know correct/incorrect from server result
  const getOptionClass = (questionId: string, optionId: string, isSubmitted: boolean) => {
    const isSelected = (selectedAnswers[questionId] || []).includes(optionId);
    if (!isSubmitted || !gradedResults[questionId]) {
      return isSelected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50';
    }
    const { isCorrect } = gradedResults[questionId];
    // After grading: if correct, highlight selected as green; if wrong, highlight selected as red
    if (isCorrect && isSelected) return 'border-green-500 bg-green-500/10';
    if (!isCorrect && isSelected) return 'border-destructive bg-destructive/10';
    return 'border-border opacity-50';
  };

  const getOptionIndicator = (questionId: string, optionId: string, isSubmitted: boolean, questionType: QuestionType, optIndex: number) => {
    const isSelected = (selectedAnswers[questionId] || []).includes(optionId);
    if (!isSubmitted || !gradedResults[questionId]) {
      if (isSelected) return 'border-primary bg-primary text-primary-foreground';
      return 'border-current';
    }
    const { isCorrect } = gradedResults[questionId];
    if (isCorrect && isSelected) return 'border-green-500 bg-green-500 text-white';
    if (!isCorrect && isSelected) return 'border-destructive bg-destructive text-white';
    return 'border-current';
  };

  const isQuestionCorrect = (questionId: string) => {
    return gradedResults[questionId]?.isCorrect || isQuestionPassed(questionId);
  };

  const allQuestionsCompleted = questions.length > 0 &&
    questions.every(q => submittedQuestions.has(q.id) || isQuestionPassed(q.id));

  const allQuestionsCorrect = allQuestionsCompleted &&
    questions.every(q => isQuestionCorrect(q.id));

  useEffect(() => {
    if (allQuestionsCompleted && onComplete && totalXpEarned > 0) {
      const timer = setTimeout(() => { onComplete(totalXpEarned); }, 1500);
      return () => clearTimeout(timer);
    }
  }, [allQuestionsCompleted, onComplete, totalXpEarned]);

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader><div className="h-6 bg-muted rounded w-1/3" /></CardHeader>
        <CardContent><div className="h-20 bg-muted rounded" /></CardContent>
      </Card>
    );
  }

  if (questions.length === 0) return null;

  const completedCount = questions.filter(q => submittedQuestions.has(q.id) || isQuestionPassed(q.id)).length;

  return (
    <div className={`space-y-6 ${isQuizOnlyLesson ? 'pt-4' : ''}`}>
      {/* Header */}
      <Card className="card-premium">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <HelpCircle className="w-5 h-5 text-primary" />
              {isRTL ? 'اختبر معلوماتك' : 'Test Your Knowledge'}
            </CardTitle>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">{completedCount} / {questions.length}</span>
              {totalXpEarned > 0 && (
                <div className="flex items-center gap-1 text-primary font-bold">
                  <Zap className="w-4 h-4" /><span>+{totalXpEarned}</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Questions List */}
      {questions.map((question, index) => {
        const isSubmitted = submittedQuestions.has(question.id) || isQuestionPassed(question.id);
        const currentAnswers = selectedAnswers[question.id] || [];
        const isCorrectAnswer = isSubmitted && isQuestionCorrect(question.id);
        const isWaiting = isSubmitted && !gradedResults[question.id] && !isQuestionPassed(question.id);
        const hasExplanation = showExplanation.has(question.id) &&
          (question.data.explanation || question.data.explanation_ar);

        return (
          <motion.div
            key={question.id}
            ref={el => questionRefs.current[question.id] = el}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className={`transition-all duration-300 ${isSubmitted && !isWaiting ? (isCorrectAnswer ? 'ring-2 ring-green-500/30' : 'ring-2 ring-destructive/30') : ''}`}>
              <CardContent className="pt-6 space-y-4">
                {/* Question Number & Text */}
                <div className="flex gap-3">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold
                    ${isSubmitted && !isWaiting
                      ? (isCorrectAnswer ? 'bg-green-500 text-white' : 'bg-destructive text-white')
                      : 'bg-primary/10 text-primary'
                    }
                  `}>
                    {isSubmitted && !isWaiting ? (
                      isCorrectAnswer ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium leading-relaxed">
                      {isRTL && question.data.question_ar ? question.data.question_ar : question.data.question}
                    </p>
                  </div>
                </div>

                {/* Options */}
                {question.data.question_type === 'dropdown' ? (
                  <Select
                    value={currentAnswers[0] || ''}
                    onValueChange={(value) => handleSelectAnswer(question.id, value, question.data.question_type)}
                    disabled={isSubmitted}
                  >
                    <SelectTrigger className={isSubmitted ? getOptionClass(question.id, currentAnswers[0] || '', true) : ''}>
                      <SelectValue placeholder={isRTL ? 'اختر إجابة...' : 'Select an answer...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {question.data.options.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {isRTL && option.text_ar ? option.text_ar : option.text}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-2 ps-11">
                    {question.data.options.map((option, optIndex) => (
                      <motion.button
                        key={option.id}
                        initial={{ opacity: 0, x: isRTL ? 10 : -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 + optIndex * 0.05 }}
                        onClick={() => handleSelectAnswer(question.id, option.id, question.data.question_type)}
                        disabled={isSubmitted}
                        className={`
                          w-full p-3 rounded-lg border-2 text-start transition-all
                          ${getOptionClass(question.id, option.id, isSubmitted)}
                          ${!isSubmitted ? 'cursor-pointer' : 'cursor-default'}
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`
                            w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs
                            ${getOptionIndicator(question.id, option.id, isSubmitted, question.data.question_type, optIndex)}
                          `}>
                            {question.data.question_type === 'multiple_choice' ? (
                              <Checkbox
                                checked={currentAnswers.includes(option.id)}
                                className="pointer-events-none border-0 w-4 h-4"
                              />
                            ) : isSubmitted && gradedResults[question.id]?.isCorrect && currentAnswers.includes(option.id) ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : isSubmitted && !gradedResults[question.id]?.isCorrect && currentAnswers.includes(option.id) ? (
                              <XCircle className="w-3 h-3" />
                            ) : (
                              <span className="font-bold">{String.fromCharCode(65 + optIndex)}</span>
                            )}
                          </div>
                          <span className="text-sm">
                            {isRTL && option.text_ar ? option.text_ar : option.text}
                          </span>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}

                {/* Explanation */}
                <AnimatePresence>
                  {hasExplanation && !isWaiting && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`
                        p-3 rounded-lg flex items-start gap-2 ms-11
                        ${isCorrectAnswer ? 'bg-green-500/10 border border-green-500/20' : 'bg-amber-500/10 border border-amber-500/20'}
                      `}
                    >
                      <Lightbulb className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isCorrectAnswer ? 'text-green-500' : 'text-amber-500'}`} />
                      <p className="text-sm">
                        {isRTL && question.data.explanation_ar ? question.data.explanation_ar : question.data.explanation}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Result & Actions */}
                {isSubmitted && !isWaiting && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`
                      flex items-center gap-2 p-3 rounded-lg ms-11
                      ${isCorrectAnswer ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}
                    `}
                  >
                    {isCorrectAnswer ? (
                      <>
                        <Trophy className="w-5 h-5" />
                        <span className="font-medium">{isRTL ? 'إجابة صحيحة!' : 'Correct!'}</span>
                        {gradedResults[question.id]?.xpEarned > 0 && (
                          <span className="ms-auto flex items-center gap-1 text-primary">
                            <Zap className="w-4 h-4" />+{gradedResults[question.id].xpEarned} XP
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5" />
                        <span className="font-medium">{isRTL ? 'إجابة خاطئة' : 'Incorrect'}</span>
                        <Button variant="ghost" size="sm" className="ms-auto" onClick={() => handleRetry(question.id)}>
                          <RotateCcw className="w-4 h-4 me-1" />{isRTL ? 'أعد المحاولة' : 'Retry'}
                        </Button>
                      </>
                    )}
                  </motion.div>
                )}

                {/* Waiting for server */}
                {isWaiting && (
                  <div className="flex items-center justify-center py-2 ms-11">
                    <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                )}

                {/* Submit Button */}
                {!isSubmitted && (
                  <div className="flex justify-end ps-11">
                    <Button size="sm" onClick={() => handleSubmitAnswer(question)} disabled={currentAnswers.length === 0}>
                      {isRTL ? 'تحقق' : 'Check'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        );
      })}

      {/* Completion Message */}
      <AnimatePresence>
        {allQuestionsCorrect && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 text-center"
          >
            <Trophy className="w-12 h-12 text-primary mx-auto mb-3" />
            <h3 className="text-lg font-bold text-foreground mb-1">
              {isRTL ? 'أحسنت! أكملت جميع الأسئلة' : 'Great job! You completed all questions'}
            </h3>
            {totalXpEarned > 0 && (
              <p className="text-primary font-medium flex items-center justify-center gap-2">
                <Zap className="w-5 h-5" />
                {isRTL ? `حصلت على ${totalXpEarned} نقطة XP` : `You earned ${totalXpEarned} XP`}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LessonQuiz;
