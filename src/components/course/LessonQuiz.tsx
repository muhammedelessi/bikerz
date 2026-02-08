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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle2,
  XCircle,
  Zap,
  HelpCircle,
  RotateCcw,
  Trophy,
  Lightbulb,
} from 'lucide-react';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';
import confetti from 'canvas-confetti';

// Question types
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
  correct_answers: string[];
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

const LessonQuiz: React.FC<LessonQuizProps> = ({ lessonId, isQuizOnlyLesson = false, onComplete }) => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string[]>>({});
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<string>>(new Set());
  const [showExplanation, setShowExplanation] = useState<Set<string>>(new Set());
  const [totalXpEarned, setTotalXpEarned] = useState(0);

  // Parse data from Json to QuizQuestionData
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
        correct_answers: Array.isArray(obj.correct_answers) 
          ? obj.correct_answers.map(String) 
          : (obj.correct_answer ? [String(obj.correct_answer)] : []),
        explanation: obj.explanation ? String(obj.explanation) : undefined,
        explanation_ar: obj.explanation_ar ? String(obj.explanation_ar) : undefined,
      };
    }
    return {
      question: '',
      question_type: 'single_choice',
      options: [],
      correct_answers: [],
    };
  };

  // Fetch lesson quiz questions
  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['lesson-quiz', lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lesson_activities')
        .select('*')
        .eq('lesson_id', lessonId)
        .eq('activity_type', 'lesson_quiz')
        .eq('is_published', true)
        .order('position', { ascending: true });
      if (error) throw error;
      return data.map(q => ({
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

  // Fetch existing attempts
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

  // Check if question was already answered correctly
  const isQuestionPassed = (activityId: string) => {
    return existingAttempts.some(a => a.activity_id === activityId && a.passed);
  };

  // Scroll to next question after answering
  const scrollToNextQuestion = useCallback((currentQuestionId: string) => {
    const currentIndex = questions.findIndex(q => q.id === currentQuestionId);
    const nextQuestion = questions[currentIndex + 1];
    
    if (nextQuestion && questionRefs.current[nextQuestion.id]) {
      setTimeout(() => {
        questionRefs.current[nextQuestion.id]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 500); // Delay to let the feedback animation complete
    } else if (currentIndex === questions.length - 1 && onComplete) {
      // Last question answered
      setTimeout(() => {
        onComplete(totalXpEarned);
      }, 1000);
    }
  }, [questions, onComplete, totalXpEarned]);

  // Submit answer mutation
  const submitAnswerMutation = useMutation({
    mutationFn: async ({ 
      activityId, 
      answers, 
      isCorrect, 
      xpReward 
    }: { 
      activityId: string; 
      answers: string[]; 
      isCorrect: boolean; 
      xpReward: number;
    }) => {
      if (!user) throw new Error('Not authenticated');
      
      // Get attempt count
      const { data: attempts } = await supabase
        .from('user_activity_attempts')
        .select('attempt_number')
        .eq('user_id', user.id)
        .eq('activity_id', activityId)
        .order('attempt_number', { ascending: false })
        .limit(1);
      
      const attemptNumber = attempts && attempts.length > 0 ? attempts[0].attempt_number + 1 : 1;
      const earnedXp = isCorrect ? xpReward : 0;
      
      const { error } = await supabase
        .from('user_activity_attempts')
        .insert({
          user_id: user.id,
          activity_id: activityId,
          answers: { selected: answers } as unknown as Json,
          score: isCorrect ? 100 : 0,
          max_score: 100,
          passed: isCorrect,
          xp_earned: earnedXp,
          attempt_number: attemptNumber,
        });
      if (error) throw error;
      
      return { isCorrect, earnedXp, activityId };
    },
    onSuccess: ({ isCorrect, earnedXp, activityId }) => {
      queryClient.invalidateQueries({ queryKey: ['lesson-quiz-attempts'] });
      if (isCorrect && earnedXp > 0) {
        setTotalXpEarned(prev => prev + earnedXp);
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#22c55e', '#3b82f6', '#f97316'],
        });
      }
      // Scroll to next question
      scrollToNextQuestion(activityId);
    },
  });

  const handleSelectAnswer = (questionId: string, optionId: string, questionType: QuestionType) => {
    if (submittedQuestions.has(questionId)) return;
    
    if (questionType === 'multiple_choice') {
      // Toggle selection for checkboxes
      const current = selectedAnswers[questionId] || [];
      const newSelection = current.includes(optionId)
        ? current.filter(id => id !== optionId)
        : [...current, optionId];
      setSelectedAnswers({ ...selectedAnswers, [questionId]: newSelection });
    } else {
      // Single selection for MCQ and dropdown
      setSelectedAnswers({ ...selectedAnswers, [questionId]: [optionId] });
    }
  };

  const handleSubmitAnswer = (question: LessonActivity) => {
    const answers = selectedAnswers[question.id] || [];
    if (answers.length === 0) {
      toast.error(isRTL ? 'الرجاء اختيار إجابة' : 'Please select an answer');
      return;
    }

    const correctAnswers = question.data.correct_answers;
    const isCorrect = 
      answers.length === correctAnswers.length &&
      answers.every(a => correctAnswers.includes(a));
    
    setSubmittedQuestions(prev => new Set(prev).add(question.id));
    
    if (question.data.explanation || question.data.explanation_ar) {
      setShowExplanation(prev => new Set(prev).add(question.id));
    }
    
    // Don't submit if already passed
    if (!isQuestionPassed(question.id)) {
      submitAnswerMutation.mutate({
        activityId: question.id,
        answers,
        isCorrect,
        xpReward: question.xp_reward,
      });
    } else {
      // Still scroll to next even if already passed
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
    setShowExplanation(prev => {
      const newSet = new Set(prev);
      newSet.delete(questionId);
      return newSet;
    });
  };

  const getOptionClass = (questionId: string, optionId: string, correctAnswers: string[], isSubmitted: boolean) => {
    const isSelected = (selectedAnswers[questionId] || []).includes(optionId);
    const isCorrect = correctAnswers.includes(optionId);
    
    if (!isSubmitted) {
      return isSelected
        ? 'border-primary bg-primary/10'
        : 'border-border hover:border-primary/50';
    }
    
    if (isCorrect) {
      return 'border-green-500 bg-green-500/10';
    }
    if (isSelected && !isCorrect) {
      return 'border-destructive bg-destructive/10';
    }
    return 'border-border opacity-50';
  };

  const isAnswerCorrect = (questionId: string, correctAnswers: string[]) => {
    const answers = selectedAnswers[questionId] || [];
    return answers.length === correctAnswers.length &&
      answers.every(a => correctAnswers.includes(a));
  };

  // Check if all questions are completed
  const allQuestionsCompleted = questions.length > 0 && 
    questions.every(q => submittedQuestions.has(q.id) || isQuestionPassed(q.id));

  // Call onComplete when all questions are done
  useEffect(() => {
    if (allQuestionsCompleted && onComplete && totalXpEarned > 0) {
      // Delay to let animations complete
      const timer = setTimeout(() => {
        onComplete(totalXpEarned);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [allQuestionsCompleted, onComplete, totalXpEarned]);

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-muted rounded w-1/3" />
        </CardHeader>
        <CardContent>
          <div className="h-20 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (questions.length === 0) {
    return null; // No quiz for this lesson
  }

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
              <span className="text-muted-foreground">
                {completedCount} / {questions.length}
              </span>
              {totalXpEarned > 0 && (
                <div className="flex items-center gap-1 text-primary font-bold">
                  <Zap className="w-4 h-4" />
                  <span>+{totalXpEarned}</span>
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
        const isCorrectAnswer = isSubmitted && isAnswerCorrect(question.id, question.data.correct_answers);
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
            <Card className={`transition-all duration-300 ${isSubmitted ? (isCorrectAnswer ? 'ring-2 ring-green-500/30' : 'ring-2 ring-destructive/30') : ''}`}>
              <CardContent className="pt-6 space-y-4">
                {/* Question Number & Text */}
                <div className="flex gap-3">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold
                    ${isSubmitted 
                      ? (isCorrectAnswer ? 'bg-green-500 text-white' : 'bg-destructive text-white')
                      : 'bg-primary/10 text-primary'
                    }
                  `}>
                    {isSubmitted ? (
                      isCorrectAnswer ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium leading-relaxed">
                      {isRTL && question.data.question_ar
                        ? question.data.question_ar
                        : question.data.question}
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
                    <SelectTrigger className={isSubmitted ? getOptionClass(question.id, currentAnswers[0] || '', question.data.correct_answers, true) : ''}>
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
                          ${getOptionClass(question.id, option.id, question.data.correct_answers, isSubmitted)}
                          ${!isSubmitted ? 'cursor-pointer' : 'cursor-default'}
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`
                            w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs
                            ${isSubmitted && question.data.correct_answers.includes(option.id)
                              ? 'border-green-500 bg-green-500 text-white'
                              : isSubmitted && currentAnswers.includes(option.id)
                                ? 'border-destructive bg-destructive text-white'
                                : currentAnswers.includes(option.id)
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-current'
                            }
                          `}>
                            {question.data.question_type === 'multiple_choice' ? (
                              <Checkbox 
                                checked={currentAnswers.includes(option.id)}
                                className="pointer-events-none border-0 w-4 h-4"
                              />
                            ) : isSubmitted && question.data.correct_answers.includes(option.id) ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : isSubmitted && currentAnswers.includes(option.id) ? (
                              <XCircle className="w-3 h-3" />
                            ) : (
                              <span className="font-bold">
                                {String.fromCharCode(65 + optIndex)}
                              </span>
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
                  {hasExplanation && (
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
                        {isRTL && question.data.explanation_ar
                          ? question.data.explanation_ar
                          : question.data.explanation}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Result & Actions */}
                {isSubmitted && (
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
                        <span className="font-medium">
                          {isRTL ? 'إجابة صحيحة!' : 'Correct!'}
                        </span>
                        {!isQuestionPassed(question.id) && (
                          <span className="ms-auto flex items-center gap-1 text-primary">
                            <Zap className="w-4 h-4" />
                            +{question.xp_reward} XP
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5" />
                        <span className="font-medium">
                          {isRTL ? 'إجابة خاطئة' : 'Incorrect'}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ms-auto"
                          onClick={() => handleRetry(question.id)}
                        >
                          <RotateCcw className="w-4 h-4 me-1" />
                          {isRTL ? 'أعد المحاولة' : 'Retry'}
                        </Button>
                      </>
                    )}
                  </motion.div>
                )}

                {/* Submit Button */}
                {!isSubmitted && (
                  <div className="flex justify-end ps-11">
                    <Button
                      size="sm"
                      onClick={() => handleSubmitAnswer(question)}
                      disabled={currentAnswers.length === 0}
                    >
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
        {allQuestionsCompleted && (
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
