import React, { useState, useEffect } from 'react';
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
  ChevronRight,
  ChevronLeft,
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
  onComplete?: (totalXp: number) => void;
}

const LessonQuiz: React.FC<LessonQuizProps> = ({ lessonId, onComplete }) => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string[]>>({});
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<string>>(new Set());
  const [showExplanation, setShowExplanation] = useState<string | null>(null);
  const [totalXpEarned, setTotalXpEarned] = useState(0);

  const NextIcon = isRTL ? ChevronLeft : ChevronRight;
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;

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
      
      return { isCorrect, earnedXp };
    },
    onSuccess: ({ isCorrect, earnedXp }) => {
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
    },
  });

  const currentQuestion = questions[currentIndex];
  
  const handleSelectAnswer = (optionId: string) => {
    if (!currentQuestion || submittedQuestions.has(currentQuestion.id)) return;
    
    const questionType = currentQuestion.data.question_type;
    
    if (questionType === 'multiple_choice') {
      // Toggle selection for checkboxes
      const current = selectedAnswers[currentQuestion.id] || [];
      const newSelection = current.includes(optionId)
        ? current.filter(id => id !== optionId)
        : [...current, optionId];
      setSelectedAnswers({ ...selectedAnswers, [currentQuestion.id]: newSelection });
    } else {
      // Single selection for MCQ and dropdown
      setSelectedAnswers({ ...selectedAnswers, [currentQuestion.id]: [optionId] });
    }
  };

  const handleSubmitAnswer = () => {
    if (!currentQuestion) return;
    
    const answers = selectedAnswers[currentQuestion.id] || [];
    if (answers.length === 0) {
      toast.error(isRTL ? 'الرجاء اختيار إجابة' : 'Please select an answer');
      return;
    }

    const correctAnswers = currentQuestion.data.correct_answers;
    const isCorrect = 
      answers.length === correctAnswers.length &&
      answers.every(a => correctAnswers.includes(a));
    
    setSubmittedQuestions(prev => new Set(prev).add(currentQuestion.id));
    
    if (currentQuestion.data.explanation || currentQuestion.data.explanation_ar) {
      setShowExplanation(currentQuestion.id);
    }
    
    // Don't submit if already passed
    if (!isQuestionPassed(currentQuestion.id)) {
      submitAnswerMutation.mutate({
        activityId: currentQuestion.id,
        answers,
        isCorrect,
        xpReward: currentQuestion.xp_reward,
      });
    }
  };

  const handleNext = () => {
    setShowExplanation(null);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (onComplete) {
      onComplete(totalXpEarned);
    }
  };

  const handlePrevious = () => {
    setShowExplanation(null);
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleRetry = () => {
    if (!currentQuestion) return;
    setSubmittedQuestions(prev => {
      const newSet = new Set(prev);
      newSet.delete(currentQuestion.id);
      return newSet;
    });
    setSelectedAnswers({ ...selectedAnswers, [currentQuestion.id]: [] });
    setShowExplanation(null);
  };

  const getOptionClass = (optionId: string, isSubmitted: boolean) => {
    if (!currentQuestion) return '';
    
    const isSelected = (selectedAnswers[currentQuestion.id] || []).includes(optionId);
    const isCorrect = currentQuestion.data.correct_answers.includes(optionId);
    
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

  const isSubmitted = submittedQuestions.has(currentQuestion?.id || '');
  const currentAnswers = selectedAnswers[currentQuestion?.id || ''] || [];
  const isCorrectAnswer = isSubmitted && 
    currentAnswers.length === currentQuestion?.data.correct_answers.length &&
    currentAnswers.every(a => currentQuestion?.data.correct_answers.includes(a));

  return (
    <Card className="card-premium">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <HelpCircle className="w-5 h-5 text-primary" />
            {isRTL ? 'اختبر معلوماتك' : 'Test Your Knowledge'}
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{currentIndex + 1} / {questions.length}</span>
            {totalXpEarned > 0 && (
              <div className="flex items-center gap-1 text-primary">
                <Zap className="w-4 h-4" />
                <span className="font-bold">+{totalXpEarned}</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {currentQuestion && (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
              className="space-y-4"
            >
              {/* Question */}
              <p className="text-foreground font-medium">
                {isRTL && currentQuestion.data.question_ar
                  ? currentQuestion.data.question_ar
                  : currentQuestion.data.question}
              </p>

              {/* Options */}
              {currentQuestion.data.question_type === 'dropdown' ? (
                <Select
                  value={currentAnswers[0] || ''}
                  onValueChange={(value) => handleSelectAnswer(value)}
                  disabled={isSubmitted}
                >
                  <SelectTrigger className={isSubmitted ? getOptionClass(currentAnswers[0] || '', true) : ''}>
                    <SelectValue placeholder={isRTL ? 'اختر إجابة...' : 'Select an answer...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {currentQuestion.data.options.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {isRTL && option.text_ar ? option.text_ar : option.text}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-2">
                  {currentQuestion.data.options.map((option, index) => (
                    <motion.button
                      key={option.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleSelectAnswer(option.id)}
                      disabled={isSubmitted}
                      className={`
                        w-full p-3 rounded-lg border-2 text-start transition-all
                        ${getOptionClass(option.id, isSubmitted)}
                        ${!isSubmitted ? 'cursor-pointer' : 'cursor-default'}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0
                          ${isSubmitted && currentQuestion.data.correct_answers.includes(option.id)
                            ? 'border-green-500 bg-green-500 text-white'
                            : isSubmitted && currentAnswers.includes(option.id)
                              ? 'border-destructive bg-destructive text-white'
                              : currentAnswers.includes(option.id)
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-current'
                          }
                        `}>
                          {currentQuestion.data.question_type === 'multiple_choice' ? (
                            <Checkbox 
                              checked={currentAnswers.includes(option.id)}
                              className="pointer-events-none border-0"
                            />
                          ) : isSubmitted && currentQuestion.data.correct_answers.includes(option.id) ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : isSubmitted && currentAnswers.includes(option.id) ? (
                            <XCircle className="w-4 h-4" />
                          ) : (
                            <span className="text-xs font-bold">
                              {String.fromCharCode(65 + index)}
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
              {showExplanation === currentQuestion.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className={`
                    p-3 rounded-lg flex items-start gap-2
                    ${isCorrectAnswer ? 'bg-green-500/10 border border-green-500/20' : 'bg-amber-500/10 border border-amber-500/20'}
                  `}
                >
                  <Lightbulb className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isCorrectAnswer ? 'text-green-500' : 'text-amber-500'}`} />
                  <p className="text-sm">
                    {isRTL && currentQuestion.data.explanation_ar
                      ? currentQuestion.data.explanation_ar
                      : currentQuestion.data.explanation}
                  </p>
                </motion.div>
              )}

              {/* Result feedback */}
              {isSubmitted && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`
                    flex items-center gap-2 p-3 rounded-lg
                    ${isCorrectAnswer ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}
                  `}
                >
                  {isCorrectAnswer ? (
                    <>
                      <Trophy className="w-5 h-5" />
                      <span className="font-medium">
                        {isRTL ? 'إجابة صحيحة!' : 'Correct!'}
                      </span>
                      {!isQuestionPassed(currentQuestion.id) && (
                        <span className="ms-auto flex items-center gap-1">
                          <Zap className="w-4 h-4" />
                          +{currentQuestion.xp_reward} XP
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
                        onClick={handleRetry}
                      >
                        <RotateCcw className="w-4 h-4 me-1" />
                        {isRTL ? 'أعد المحاولة' : 'Retry'}
                      </Button>
                    </>
                  )}
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            <PrevIcon className="w-4 h-4 me-1" />
            {isRTL ? 'السابق' : 'Previous'}
          </Button>
          
          {!isSubmitted ? (
            <Button
              size="sm"
              onClick={handleSubmitAnswer}
              disabled={currentAnswers.length === 0}
            >
              {isRTL ? 'تحقق' : 'Check'}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleNext}
            >
              {currentIndex < questions.length - 1 ? (
                <>
                  {isRTL ? 'التالي' : 'Next'}
                  <NextIcon className="w-4 h-4 ms-1" />
                </>
              ) : (
                isRTL ? 'إنهاء' : 'Finish'
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LessonQuiz;
