import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

interface QuestionOption {
  id: string;
  text: string;
  text_ar?: string;
}

interface TestQuestion {
  id: string;
  test_id: string;
  question: string;
  question_ar: string | null;
  question_type: string;
  options: QuestionOption[];
  correct_answer: string;
  points: number;
  position: number;
}

interface TestQuestionManagerProps {
  testId: string;
  testTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

const TestQuestionManager: React.FC<TestQuestionManagerProps> = ({
  testId,
  testTitle,
  isOpen,
  onClose,
}) => {
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();

  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<TestQuestion | null>(null);
  const [questionForm, setQuestionForm] = useState({
    question: '',
    question_ar: '',
    question_type: 'multiple_choice',
    options: [
      { id: 'a', text: '', text_ar: '' },
      { id: 'b', text: '', text_ar: '' },
      { id: 'c', text: '', text_ar: '' },
      { id: 'd', text: '', text_ar: '' },
    ] as QuestionOption[],
    correct_answer: '',
    points: 1,
  });

  // Parse options from Json to QuestionOption[]
  const parseOptions = (options: Json): QuestionOption[] => {
    if (Array.isArray(options)) {
      return options.map((opt) => {
        if (typeof opt === 'object' && opt !== null && 'id' in opt && 'text' in opt) {
          return {
            id: String((opt as Record<string, unknown>).id),
            text: String((opt as Record<string, unknown>).text),
            text_ar: (opt as Record<string, unknown>).text_ar ? String((opt as Record<string, unknown>).text_ar) : undefined,
          };
        }
        return { id: String(opt), text: String(opt) };
      });
    }
    return [];
  };

  // Fetch questions
  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['admin-test-questions', testId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('test_questions')
        .select('*')
        .eq('test_id', testId)
        .order('position', { ascending: true });
      if (error) throw error;
      return data.map(q => ({
        id: q.id,
        test_id: q.test_id,
        question: q.question,
        question_ar: q.question_ar,
        question_type: q.question_type,
        options: parseOptions(q.options),
        correct_answer: q.correct_answer,
        points: q.points,
        position: q.position,
      })) as TestQuestion[];
    },
    enabled: isOpen && !!testId,
  });

  // Create question mutation
  const createQuestionMutation = useMutation({
    mutationFn: async (data: typeof questionForm) => {
      const maxPosition = questions.reduce((max, q) => Math.max(max, q.position), -1);
      const { error } = await supabase.from('test_questions').insert({
        test_id: testId,
        question: data.question,
        question_ar: data.question_ar || null,
        question_type: data.question_type,
        options: data.options as unknown as Json,
        correct_answer: data.correct_answer,
        points: data.points,
        position: maxPosition + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-test-questions'] });
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
        .from('test_questions')
        .update({
          question: data.question,
          question_ar: data.question_ar || null,
          question_type: data.question_type,
          options: data.options as unknown as Json,
          correct_answer: data.correct_answer,
          points: data.points,
        })
        .eq('id', questionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-test-questions'] });
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
      const { error } = await supabase.from('test_questions').delete().eq('id', questionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-test-questions'] });
      toast.success(isRTL ? 'تم حذف السؤال بنجاح' : 'Question deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Reorder questions mutation
  const reorderQuestionsMutation = useMutation({
    mutationFn: async (reorderedQuestions: TestQuestion[]) => {
      const updates = reorderedQuestions.map((question, index) =>
        supabase.from('test_questions').update({ position: index }).eq('id', question.id)
      );
      const results = await Promise.all(updates);
      const error = results.find(r => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-test-questions'] });
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
      question: '',
      question_ar: '',
      question_type: 'multiple_choice',
      options: [
        { id: 'a', text: '', text_ar: '' },
        { id: 'b', text: '', text_ar: '' },
        { id: 'c', text: '', text_ar: '' },
        { id: 'd', text: '', text_ar: '' },
      ],
      correct_answer: '',
      points: 1,
    });
  };

  const openEditQuestion = (question: TestQuestion) => {
    setQuestionForm({
      question: question.question,
      question_ar: question.question_ar || '',
      question_type: question.question_type,
      options: question.options.length > 0 ? question.options : [
        { id: 'a', text: '', text_ar: '' },
        { id: 'b', text: '', text_ar: '' },
        { id: 'c', text: '', text_ar: '' },
        { id: 'd', text: '', text_ar: '' },
      ],
      correct_answer: question.correct_answer,
      points: question.points,
    });
    setEditingQuestion(question);
    setIsQuestionDialogOpen(true);
  };

  const handleQuestionSubmit = () => {
    if (!questionForm.question.trim()) {
      toast.error(isRTL ? 'نص السؤال مطلوب' : 'Question text is required');
      return;
    }
    if (!questionForm.correct_answer) {
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

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              {isRTL ? 'إدارة الأسئلة' : 'Manage Questions'} - {testTitle}
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
                        {isRTL && question.question_ar ? question.question_ar : question.question}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {question.question_type === 'true_false'
                          ? (isRTL ? 'صح/خطأ' : 'True/False')
                          : question.question_type === 'yes_no'
                          ? (isRTL ? 'نعم / لا' : 'Yes / No')
                          : (isRTL ? 'اختيار متعدد' : 'Multiple Choice')}
                        {' • '}
                        {question.points} {isRTL ? 'نقطة' : 'pt'}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      <CheckCircle2 className="w-3 h-3 me-1" />
                      {question.correct_answer.toUpperCase()}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion
                ? (isRTL ? 'تعديل السؤال' : 'Edit Question')
                : (isRTL ? 'إضافة سؤال جديد' : 'Add New Question')}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isRTL ? 'نوع السؤال' : 'Question Type'}</Label>
                <Select
                  value={questionForm.question_type}
                  onValueChange={(value) => setQuestionForm({ ...questionForm, question_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">
                      {isRTL ? 'اختيار متعدد' : 'Multiple Choice'}
                    </SelectItem>
                    <SelectItem value="true_false">
                      {isRTL ? 'صح/خطأ' : 'True/False'}
                    </SelectItem>
                    <SelectItem value="yes_no">
                      {isRTL ? 'نعم / لا' : 'Yes / No'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? 'النقاط' : 'Points'}</Label>
                <Input
                  type="number"
                  value={questionForm.points}
                  onChange={(e) => setQuestionForm({ ...questionForm, points: parseInt(e.target.value) || 1 })}
                  min={1}
                />
              </div>
            </div>

            {questionForm.question_type === 'multiple_choice' && (
              <div className="space-y-3">
                <Label>{isRTL ? 'الخيارات' : 'Options'}</Label>
                {questionForm.options.map((option, index) => (
                  <div key={option.id} className="grid grid-cols-2 gap-2">
                    <Input
                      value={option.text}
                      onChange={(e) => updateOption(index, 'text', e.target.value)}
                      placeholder={`Option ${option.id.toUpperCase()} (English)`}
                    />
                    <Input
                      value={option.text_ar || ''}
                      onChange={(e) => updateOption(index, 'text_ar', e.target.value)}
                      placeholder={`الخيار ${option.id.toUpperCase()} (عربي)`}
                      dir="rtl"
                    />
                  </div>
                ))}
              </div>
            )}

            {questionForm.question_type === 'yes_no' && (
              <div className="p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground">
                {isRTL ? 'سيتم عرض زري "نعم" و"لا" تلقائياً للمستخدم' : 'Yes and No buttons will be shown automatically to the user'}
              </div>
            )}

            <div className="space-y-2">
              <Label>{isRTL ? 'الإجابة الصحيحة' : 'Correct Answer'}</Label>
              <Select
                value={questionForm.correct_answer}
                onValueChange={(value) => setQuestionForm({ ...questionForm, correct_answer: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isRTL ? 'اختر الإجابة الصحيحة' : 'Select correct answer'} />
                </SelectTrigger>
                <SelectContent>
                {questionForm.question_type === 'yes_no' ? (
                    <>
                      <SelectItem value="yes">{isRTL ? 'نعم' : 'Yes'}</SelectItem>
                      <SelectItem value="no">{isRTL ? 'لا' : 'No'}</SelectItem>
                    </>
                  ) : questionForm.question_type === 'true_false' ? (
                    <>
                      <SelectItem value="true">{isRTL ? 'صح' : 'True'}</SelectItem>
                      <SelectItem value="false">{isRTL ? 'خطأ' : 'False'}</SelectItem>
                    </>
                  ) : (
                    questionForm.options.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.id.toUpperCase()}: {option.text || (isRTL ? '(فارغ)' : '(empty)')}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
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

export default TestQuestionManager;
