import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Edit,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  HelpCircle,
  CheckCircle2,
  ListChecks,
  ChevronDownSquare,
  CircleDot,
} from 'lucide-react';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

// Question types
type QuestionType = 'single_choice' | 'multiple_choice' | 'dropdown' | 'yes_no';

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
  correct_answers: string[]; // Array to support multiple correct answers for checkboxes
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

interface LessonQuizManagerProps {
  lessonId: string;
  lessonTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

const LessonQuizManager: React.FC<LessonQuizManagerProps> = ({
  lessonId,
  lessonTitle,
  isOpen,
  onClose,
}) => {
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();

  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<LessonActivity | null>(null);
  const [questionForm, setQuestionForm] = useState<{
    title: string;
    title_ar: string;
    question_type: QuestionType;
    question: string;
    question_ar: string;
    options: QuestionOption[];
    correct_answers: string[];
    explanation: string;
    explanation_ar: string;
    xp_reward: number;
    is_published: boolean;
  }>({
    title: '',
    title_ar: '',
    question_type: 'single_choice',
    question: '',
    question_ar: '',
    options: [
      { id: 'a', text: '', text_ar: '' },
      { id: 'b', text: '', text_ar: '' },
      { id: 'c', text: '', text_ar: '' },
      { id: 'd', text: '', text_ar: '' },
    ],
    correct_answers: [],
    explanation: '',
    explanation_ar: '',
    xp_reward: 10,
    is_published: true,
  });

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

  // Fetch lesson quiz questions (activities with type 'lesson_quiz')
  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['lesson-quiz-questions', lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lesson_activities')
        .select('*')
        .eq('lesson_id', lessonId)
        .eq('activity_type', 'lesson_quiz')
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
    enabled: isOpen && !!lessonId,
  });

  // Create question mutation
  const createQuestionMutation = useMutation({
    mutationFn: async (data: typeof questionForm) => {
      const maxPosition = questions.reduce((max, q) => Math.max(max, q.position), -1);
      const { error } = await supabase.from('lesson_activities').insert({
        lesson_id: lessonId,
        activity_type: 'lesson_quiz',
        title: data.title,
        title_ar: data.title_ar || null,
        data: {
          question: data.question,
          question_ar: data.question_ar || null,
          question_type: data.question_type,
          options: data.options,
          correct_answers: data.correct_answers,
          explanation: data.explanation || null,
          explanation_ar: data.explanation_ar || null,
        } as unknown as Json,
        xp_reward: data.xp_reward,
        position: maxPosition + 1,
        is_published: data.is_published,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-quiz-questions'] });
      setIsQuestionDialogOpen(false);
      resetQuestionForm();
      toast.success(isRTL ? 'تم إضافة السؤال بنجاح' : 'Question added successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update question mutation
  const updateQuestionMutation = useMutation({
    mutationFn: async ({ questionId, data }: { questionId: string; data: typeof questionForm }) => {
      const { error } = await supabase
        .from('lesson_activities')
        .update({
          title: data.title,
          title_ar: data.title_ar || null,
          data: {
            question: data.question,
            question_ar: data.question_ar || null,
            question_type: data.question_type,
            options: data.options,
            correct_answers: data.correct_answers,
            explanation: data.explanation || null,
            explanation_ar: data.explanation_ar || null,
          } as unknown as Json,
          xp_reward: data.xp_reward,
          is_published: data.is_published,
        })
        .eq('id', questionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-quiz-questions'] });
      setIsQuestionDialogOpen(false);
      setEditingQuestion(null);
      resetQuestionForm();
      toast.success(isRTL ? 'تم تحديث السؤال بنجاح' : 'Question updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete question mutation
  const deleteQuestionMutation = useMutation({
    mutationFn: async (questionId: string) => {
      const { error } = await supabase.from('lesson_activities').delete().eq('id', questionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-quiz-questions'] });
      toast.success(isRTL ? 'تم حذف السؤال بنجاح' : 'Question deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Reorder questions mutation
  const reorderQuestionsMutation = useMutation({
    mutationFn: async (reorderedQuestions: LessonActivity[]) => {
      const updates = reorderedQuestions.map((question, index) =>
        supabase.from('lesson_activities').update({ position: index }).eq('id', question.id)
      );
      const results = await Promise.all(updates);
      const error = results.find(r => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-quiz-questions'] });
      toast.success(isRTL ? 'تم إعادة ترتيب الأسئلة' : 'Questions reordered');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const moveQuestion = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= questions.length) return;

    const newQuestions = [...questions];
    const [removed] = newQuestions.splice(fromIndex, 1);
    newQuestions.splice(toIndex, 0, removed);
    reorderQuestionsMutation.mutate(newQuestions);
  };

  const resetQuestionForm = () => {
    setQuestionForm({
      title: '',
      title_ar: '',
      question_type: 'single_choice',
      question: '',
      question_ar: '',
      options: [
        { id: 'a', text: '', text_ar: '' },
        { id: 'b', text: '', text_ar: '' },
        { id: 'c', text: '', text_ar: '' },
        { id: 'd', text: '', text_ar: '' },
      ],
      correct_answers: [],
      explanation: '',
      explanation_ar: '',
      xp_reward: 10,
      is_published: true,
    });
  };

  const openEditQuestion = (question: LessonActivity) => {
    setQuestionForm({
      title: question.title,
      title_ar: question.title_ar || '',
      question_type: question.data.question_type,
      question: question.data.question,
      question_ar: question.data.question_ar || '',
      options: question.data.options.length > 0 ? question.data.options : [
        { id: 'a', text: '', text_ar: '' },
        { id: 'b', text: '', text_ar: '' },
        { id: 'c', text: '', text_ar: '' },
        { id: 'd', text: '', text_ar: '' },
      ],
      correct_answers: question.data.correct_answers,
      explanation: question.data.explanation || '',
      explanation_ar: question.data.explanation_ar || '',
      xp_reward: question.xp_reward,
      is_published: question.is_published,
    });
    setEditingQuestion(question);
    setIsQuestionDialogOpen(true);
  };

  const handleQuestionSubmit = () => {
    if (!questionForm.question.trim()) {
      toast.error(isRTL ? 'نص السؤال مطلوب' : 'Question text is required');
      return;
    }
    if (!questionForm.title.trim()) {
      toast.error(isRTL ? 'عنوان السؤال مطلوب' : 'Question title is required');
      return;
    }
    if (questionForm.correct_answers.length === 0) {
      toast.error(isRTL ? 'الإجابة الصحيحة مطلوبة' : 'Correct answer is required');
      return;
    }
    if (editingQuestion) {
      updateQuestionMutation.mutate({ questionId: editingQuestion.id, data: questionForm });
    } else {
      createQuestionMutation.mutate(questionForm);
    }
  };

  const updateOption = (index: number, field: 'text' | 'text_ar', value: string) => {
    const newOptions = [...questionForm.options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setQuestionForm({ ...questionForm, options: newOptions });
  };

  const addOption = () => {
    const nextId = String.fromCharCode(97 + questionForm.options.length); // a, b, c, d, e...
    setQuestionForm({
      ...questionForm,
      options: [...questionForm.options, { id: nextId, text: '', text_ar: '' }],
    });
  };

  const removeOption = (index: number) => {
    if (questionForm.options.length <= 2) return;
    const newOptions = questionForm.options.filter((_, i) => i !== index);
    const removedId = questionForm.options[index].id;
    setQuestionForm({
      ...questionForm,
      options: newOptions,
      correct_answers: questionForm.correct_answers.filter(id => id !== removedId),
    });
  };

  const toggleCorrectAnswer = (optionId: string) => {
    if (questionForm.question_type === 'multiple_choice') {
      // Multiple selection allowed
      setQuestionForm({
        ...questionForm,
        correct_answers: questionForm.correct_answers.includes(optionId)
          ? questionForm.correct_answers.filter(id => id !== optionId)
          : [...questionForm.correct_answers, optionId],
      });
    } else {
      // Single selection only
      setQuestionForm({
        ...questionForm,
        correct_answers: [optionId],
      });
    }
  };

  const getQuestionTypeIcon = (type: QuestionType) => {
    switch (type) {
      case 'single_choice':
        return <CircleDot className="w-4 h-4" />;
      case 'multiple_choice':
        return <ListChecks className="w-4 h-4" />;
      case 'dropdown':
        return <ChevronDownSquare className="w-4 h-4" />;
      case 'yes_no':
        return <CheckCircle2 className="w-4 h-4" />;
    }
  };

  const getQuestionTypeLabel = (type: QuestionType) => {
    switch (type) {
      case 'single_choice':
        return isRTL ? 'اختيار واحد' : 'Single Choice';
      case 'multiple_choice':
        return isRTL ? 'اختيار متعدد' : 'Multiple Choice';
      case 'dropdown':
        return isRTL ? 'قائمة منسدلة' : 'Dropdown';
      case 'yes_no':
        return isRTL ? 'نعم / لا' : 'Yes / No';
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              {isRTL ? 'أسئلة الدرس' : 'Lesson Questions'} - {lessonTitle}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {questions.length} {isRTL ? 'سؤال' : 'questions'}
              </p>
              <Button
                size="sm"
                onClick={() => {
                  resetQuestionForm();
                  setEditingQuestion(null);
                  setIsQuestionDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4 me-1" />
                {isRTL ? 'إضافة سؤال' : 'Add Question'}
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                {isRTL ? 'جاري التحميل...' : 'Loading...'}
              </div>
            ) : questions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <HelpCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{isRTL ? 'لا توجد أسئلة' : 'No questions yet'}</p>
                <p className="text-xs mt-2">
                  {isRTL 
                    ? 'أضف أسئلة لجعل الدرس تفاعلياً' 
                    : 'Add questions to make the lesson interactive'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {questions.map((question, index) => (
                  <div
                    key={question.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 group hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex flex-col gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => moveQuestion(index, 'up')}
                        disabled={index === 0}
                      >
                        <ChevronUp className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => moveQuestion(index, 'down')}
                        disabled={index === questions.length - 1}
                      >
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </div>
                    <span className="text-sm text-muted-foreground w-6">{index + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">
                        {isRTL && question.title_ar ? question.title_ar : question.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {getQuestionTypeIcon(question.data.question_type)}
                        <span>{getQuestionTypeLabel(question.data.question_type)}</span>
                        <span>•</span>
                        <span>{question.xp_reward} XP</span>
                      </div>
                    </div>
                    {!question.is_published && (
                      <Badge variant="secondary" className="text-xs">
                        {isRTL ? 'مسودة' : 'Draft'}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      <CheckCircle2 className="w-3 h-3 me-1" />
                      {question.data.correct_answers.join(', ').toUpperCase()}
                    </Badge>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEditQuestion(question)}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteQuestionMutation.mutate(question.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              {isRTL ? 'إغلاق' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Question Form Dialog */}
      <Dialog open={isQuestionDialogOpen} onOpenChange={setIsQuestionDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion
                ? (isRTL ? 'تعديل السؤال' : 'Edit Question')
                : (isRTL ? 'إضافة سؤال جديد' : 'Add New Question')}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Title */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isRTL ? 'العنوان (إنجليزي)' : 'Title (English)'}</Label>
                <Input
                  value={questionForm.title}
                  onChange={(e) => setQuestionForm({ ...questionForm, title: e.target.value })}
                  placeholder="Question title..."
                />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? 'العنوان (عربي)' : 'Title (Arabic)'}</Label>
                <Input
                  value={questionForm.title_ar}
                  onChange={(e) => setQuestionForm({ ...questionForm, title_ar: e.target.value })}
                  placeholder="عنوان السؤال..."
                  dir="rtl"
                />
              </div>
            </div>

            {/* Question Text */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isRTL ? 'السؤال (إنجليزي)' : 'Question (English)'}</Label>
                <Textarea
                  value={questionForm.question}
                  onChange={(e) => setQuestionForm({ ...questionForm, question: e.target.value })}
                  placeholder="Enter question..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? 'السؤال (عربي)' : 'Question (Arabic)'}</Label>
                <Textarea
                  value={questionForm.question_ar}
                  onChange={(e) => setQuestionForm({ ...questionForm, question_ar: e.target.value })}
                  placeholder="أدخل السؤال..."
                  dir="rtl"
                  rows={2}
                />
              </div>
            </div>

            {/* Question Type & XP */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isRTL ? 'نوع السؤال' : 'Question Type'}</Label>
                <Select
                  value={questionForm.question_type}
                  onValueChange={(value: QuestionType) => {
                    setQuestionForm({ 
                      ...questionForm, 
                      question_type: value,
                      // Reset correct answers when changing type
                      correct_answers: value === 'multiple_choice' ? questionForm.correct_answers : 
                        (questionForm.correct_answers.length > 0 ? [questionForm.correct_answers[0]] : [])
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_choice">
                      <div className="flex items-center gap-2">
                        <CircleDot className="w-4 h-4" />
                        {isRTL ? 'اختيار واحد (MCQ)' : 'Single Choice (MCQ)'}
                      </div>
                    </SelectItem>
                    <SelectItem value="multiple_choice">
                      <div className="flex items-center gap-2">
                        <ListChecks className="w-4 h-4" />
                        {isRTL ? 'اختيار متعدد (Checkbox)' : 'Multiple Choice (Checkbox)'}
                      </div>
                    </SelectItem>
                    <SelectItem value="dropdown">
                      <div className="flex items-center gap-2">
                        <ChevronDownSquare className="w-4 h-4" />
                        {isRTL ? 'قائمة منسدلة' : 'Dropdown'}
                      </div>
                    </SelectItem>
                    <SelectItem value="yes_no">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        {isRTL ? 'نعم / لا' : 'Yes / No'}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? 'نقاط XP' : 'XP Points'}</Label>
                <Input
                  type="number"
                  value={questionForm.xp_reward}
                  onChange={(e) => setQuestionForm({ ...questionForm, xp_reward: parseInt(e.target.value) || 10 })}
                  min={1}
                />
              </div>
            </div>

            {/* Options */}
            {questionForm.question_type === 'yes_no' ? (
              <div className="space-y-3">
                <Label>{isRTL ? 'الخيارات' : 'Options'}</Label>
                <div className="p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground">
                  {isRTL ? 'سيتم عرض زري "نعم" و"لا" تلقائياً للمستخدم' : 'Yes and No buttons will be shown automatically to the user'}
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? 'الإجابة الصحيحة' : 'Correct Answer'}</Label>
                  <div className="flex gap-3">
                    {[
                      { value: 'yes', label: isRTL ? 'نعم' : 'Yes' },
                      { value: 'no', label: isRTL ? 'لا' : 'No' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setQuestionForm({ ...questionForm, correct_answers: [opt.value] })}
                        className={`flex-1 p-3 rounded-lg border-2 font-medium transition-all ${
                          questionForm.correct_answers.includes(opt.value)
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary/50 text-foreground'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{isRTL ? 'الخيارات' : 'Options'}</Label>
                <Button type="button" variant="outline" size="sm" onClick={addOption}>
                  <Plus className="w-4 h-4 me-1" />
                  {isRTL ? 'إضافة خيار' : 'Add Option'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {questionForm.question_type === 'multiple_choice'
                  ? (isRTL ? 'حدد جميع الإجابات الصحيحة' : 'Select all correct answers')
                  : (isRTL ? 'حدد الإجابة الصحيحة' : 'Select the correct answer')}
              </p>
              {questionForm.options.map((option, index) => (
                <div key={option.id} className="flex items-center gap-2">
                  <div 
                    className={`
                      w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer transition-colors
                      ${questionForm.correct_answers.includes(option.id)
                        ? 'bg-green-500 text-white'
                        : 'bg-muted hover:bg-muted/80'}
                    `}
                    onClick={() => toggleCorrectAnswer(option.id)}
                  >
                    {questionForm.question_type === 'multiple_choice' ? (
                      <Checkbox 
                        checked={questionForm.correct_answers.includes(option.id)}
                        className="pointer-events-none"
                      />
                    ) : (
                      <span className="font-bold">{option.id.toUpperCase()}</span>
                    )}
                  </div>
                  <Input
                    value={option.text}
                    onChange={(e) => updateOption(index, 'text', e.target.value)}
                    placeholder={`Option ${option.id.toUpperCase()} (English)`}
                    className="flex-1"
                  />
                  <Input
                    value={option.text_ar || ''}
                    onChange={(e) => updateOption(index, 'text_ar', e.target.value)}
                    placeholder={`الخيار ${option.id.toUpperCase()} (عربي)`}
                    dir="rtl"
                    className="flex-1"
                  />
                  {questionForm.options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => removeOption(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            )}

            {/* Explanation */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isRTL ? 'الشرح (إنجليزي) - اختياري' : 'Explanation (English) - Optional'}</Label>
                <Textarea
                  value={questionForm.explanation}
                  onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
                  placeholder="Explain the correct answer..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? 'الشرح (عربي) - اختياري' : 'Explanation (Arabic) - Optional'}</Label>
                <Textarea
                  value={questionForm.explanation_ar}
                  onChange={(e) => setQuestionForm({ ...questionForm, explanation_ar: e.target.value })}
                  placeholder="اشرح الإجابة الصحيحة..."
                  dir="rtl"
                  rows={2}
                />
              </div>
            </div>

            {/* Published Switch */}
            <div className="flex items-center gap-3">
              <Switch
                checked={questionForm.is_published}
                onCheckedChange={(checked) => setQuestionForm({ ...questionForm, is_published: checked })}
              />
              <Label>{isRTL ? 'منشور' : 'Published'}</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuestionDialogOpen(false)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={handleQuestionSubmit}
              disabled={createQuestionMutation.isPending || updateQuestionMutation.isPending}
            >
              <Save className="w-4 h-4 me-2" />
              {isRTL ? 'حفظ' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LessonQuizManager;
