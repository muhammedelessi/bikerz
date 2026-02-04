import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  GripVertical,
  Play,
  FileText,
  Video,
  ClipboardList,
  Save,
  Eye,
  ArrowLeft,
  ArrowRight,
  Upload,
  Link as LinkIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import VideoUploader from '@/components/admin/VideoUploader';

interface Chapter {
  id: string;
  title: string;
  title_ar: string | null;
  description: string | null;
  description_ar: string | null;
  position: number;
  is_published: boolean;
  is_free: boolean;
}

interface Lesson {
  id: string;
  chapter_id: string;
  title: string;
  title_ar: string | null;
  description: string | null;
  description_ar: string | null;
  video_url: string | null;
  video_provider: string;
  duration_minutes: number | null;
  position: number;
  is_published: boolean;
  is_free: boolean;
}

const AdminCourseEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();

  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  const [isChapterDialogOpen, setIsChapterDialogOpen] = useState(false);
  const [isLessonDialogOpen, setIsLessonDialogOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  // Chapter form state
  const [chapterForm, setChapterForm] = useState({
    title: '',
    title_ar: '',
    description: '',
    description_ar: '',
    is_published: false,
    is_free: false,
  });

  // Lesson form state
  const [lessonForm, setLessonForm] = useState({
    title: '',
    title_ar: '',
    description: '',
    description_ar: '',
    video_url: '',
    video_provider: 'youtube',
    duration_minutes: 0,
    is_published: false,
    is_free: false,
  });

  // Fetch course
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['admin-course', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch chapters with lessons
  const { data: chapters = [], isLoading: chaptersLoading } = useQuery({
    queryKey: ['admin-chapters', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chapters')
        .select('*')
        .eq('course_id', id)
        .order('position', { ascending: true });
      if (error) throw error;
      return data as Chapter[];
    },
    enabled: !!id,
  });

  // Fetch lessons
  const { data: lessons = [] } = useQuery({
    queryKey: ['admin-lessons', id],
    queryFn: async () => {
      const chapterIds = chapters.map(c => c.id);
      if (chapterIds.length === 0) return [];

      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .in('chapter_id', chapterIds)
        .order('position', { ascending: true });
      if (error) throw error;
      return data as Lesson[];
    },
    enabled: chapters.length > 0,
  });

  // Create chapter mutation
  const createChapterMutation = useMutation({
    mutationFn: async (data: typeof chapterForm) => {
      const maxPosition = chapters.reduce((max, ch) => Math.max(max, ch.position), -1);
      const { error } = await supabase.from('chapters').insert({
        course_id: id,
        title: data.title,
        title_ar: data.title_ar || null,
        description: data.description || null,
        description_ar: data.description_ar || null,
        position: maxPosition + 1,
        is_published: data.is_published,
        is_free: data.is_free,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-chapters'] });
      setIsChapterDialogOpen(false);
      resetChapterForm();
      toast.success(isRTL ? 'تم إنشاء الفصل بنجاح' : 'Chapter created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Update chapter mutation
  const updateChapterMutation = useMutation({
    mutationFn: async ({ chapterId, data }: { chapterId: string; data: typeof chapterForm }) => {
      const { error } = await supabase
        .from('chapters')
        .update({
          title: data.title,
          title_ar: data.title_ar || null,
          description: data.description || null,
          description_ar: data.description_ar || null,
          is_published: data.is_published,
          is_free: data.is_free,
        })
        .eq('id', chapterId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-chapters'] });
      setIsChapterDialogOpen(false);
      setEditingChapter(null);
      resetChapterForm();
      toast.success(isRTL ? 'تم تحديث الفصل بنجاح' : 'Chapter updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Delete chapter mutation
  const deleteChapterMutation = useMutation({
    mutationFn: async (chapterId: string) => {
      const { error } = await supabase.from('chapters').delete().eq('id', chapterId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-chapters'] });
      toast.success(isRTL ? 'تم حذف الفصل بنجاح' : 'Chapter deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Create lesson mutation
  const createLessonMutation = useMutation({
    mutationFn: async ({ chapterId, data }: { chapterId: string; data: typeof lessonForm }) => {
      const chapterLessons = lessons.filter(l => l.chapter_id === chapterId);
      const maxPosition = chapterLessons.reduce((max, l) => Math.max(max, l.position), -1);
      
      const { error } = await supabase.from('lessons').insert({
        chapter_id: chapterId,
        title: data.title,
        title_ar: data.title_ar || null,
        description: data.description || null,
        description_ar: data.description_ar || null,
        video_url: data.video_url || null,
        video_provider: data.video_provider,
        duration_minutes: data.duration_minutes || null,
        position: maxPosition + 1,
        is_published: data.is_published,
        is_free: data.is_free,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lessons'] });
      setIsLessonDialogOpen(false);
      resetLessonForm();
      toast.success(isRTL ? 'تم إنشاء الدرس بنجاح' : 'Lesson created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Update lesson mutation
  const updateLessonMutation = useMutation({
    mutationFn: async ({ lessonId, data }: { lessonId: string; data: typeof lessonForm }) => {
      const { error } = await supabase
        .from('lessons')
        .update({
          title: data.title,
          title_ar: data.title_ar || null,
          description: data.description || null,
          description_ar: data.description_ar || null,
          video_url: data.video_url || null,
          video_provider: data.video_provider,
          duration_minutes: data.duration_minutes || null,
          is_published: data.is_published,
          is_free: data.is_free,
        })
        .eq('id', lessonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lessons'] });
      setIsLessonDialogOpen(false);
      setEditingLesson(null);
      resetLessonForm();
      toast.success(isRTL ? 'تم تحديث الدرس بنجاح' : 'Lesson updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Delete lesson mutation
  const deleteLessonMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      const { error } = await supabase.from('lessons').delete().eq('id', lessonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lessons'] });
      toast.success(isRTL ? 'تم حذف الدرس بنجاح' : 'Lesson deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const resetChapterForm = () => {
    setChapterForm({
      title: '',
      title_ar: '',
      description: '',
      description_ar: '',
      is_published: false,
      is_free: false,
    });
  };

  const resetLessonForm = () => {
    setLessonForm({
      title: '',
      title_ar: '',
      description: '',
      description_ar: '',
      video_url: '',
      video_provider: 'youtube',
      duration_minutes: 0,
      is_published: false,
      is_free: false,
    });
  };

  const openEditChapter = (chapter: Chapter) => {
    setChapterForm({
      title: chapter.title,
      title_ar: chapter.title_ar || '',
      description: chapter.description || '',
      description_ar: chapter.description_ar || '',
      is_published: chapter.is_published,
      is_free: chapter.is_free,
    });
    setEditingChapter(chapter);
    setIsChapterDialogOpen(true);
  };

  const openAddLesson = (chapterId: string) => {
    setSelectedChapterId(chapterId);
    resetLessonForm();
    setIsLessonDialogOpen(true);
  };

  const openEditLesson = (lesson: Lesson) => {
    setLessonForm({
      title: lesson.title,
      title_ar: lesson.title_ar || '',
      description: lesson.description || '',
      description_ar: lesson.description_ar || '',
      video_url: lesson.video_url || '',
      video_provider: lesson.video_provider || 'youtube',
      duration_minutes: lesson.duration_minutes || 0,
      is_published: lesson.is_published,
      is_free: lesson.is_free,
    });
    setEditingLesson(lesson);
    setSelectedChapterId(lesson.chapter_id);
    setIsLessonDialogOpen(true);
  };

  const handleChapterSubmit = () => {
    if (!chapterForm.title.trim()) {
      toast.error(isRTL ? 'عنوان الفصل مطلوب' : 'Chapter title is required');
      return;
    }
    if (editingChapter) {
      updateChapterMutation.mutate({ chapterId: editingChapter.id, data: chapterForm });
    } else {
      createChapterMutation.mutate(chapterForm);
    }
  };

  const handleLessonSubmit = () => {
    if (!lessonForm.title.trim()) {
      toast.error(isRTL ? 'عنوان الدرس مطلوب' : 'Lesson title is required');
      return;
    }
    if (editingLesson) {
      updateLessonMutation.mutate({ lessonId: editingLesson.id, data: lessonForm });
    } else if (selectedChapterId) {
      createLessonMutation.mutate({ chapterId: selectedChapterId, data: lessonForm });
    }
  };

  const getLessonsForChapter = (chapterId: string) => {
    return lessons.filter(l => l.chapter_id === chapterId).sort((a, b) => a.position - b.position);
  };

  if (courseLoading || chaptersLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">{isRTL ? 'الدورة غير موجودة' : 'Course not found'}</h2>
        <Button variant="outline" onClick={() => navigate('/admin/courses')} className="mt-4">
          <BackArrow className="w-4 h-4 me-2" />
          {isRTL ? 'العودة' : 'Go Back'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/courses')}>
            <BackIcon className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isRTL && course.title_ar ? course.title_ar : course.title}
            </h1>
            <p className="text-muted-foreground">
              {isRTL ? 'تعديل محتوى الدورة' : 'Edit course content'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to={`/courses/${id}`} target="_blank">
              <Eye className="w-4 h-4 me-2" />
              {isRTL ? 'معاينة' : 'Preview'}
            </Link>
          </Button>
          <Button onClick={() => {
            resetChapterForm();
            setEditingChapter(null);
            setIsChapterDialogOpen(true);
          }}>
            <Plus className="w-4 h-4 me-2" />
            {isRTL ? 'إضافة فصل' : 'Add Chapter'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{chapters.length}</p>
            <p className="text-sm text-muted-foreground">{isRTL ? 'فصول' : 'Chapters'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{lessons.length}</p>
            <p className="text-sm text-muted-foreground">{isRTL ? 'دروس' : 'Lessons'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-500">
              {lessons.reduce((sum, l) => sum + (l.duration_minutes || 0), 0)}
            </p>
            <p className="text-sm text-muted-foreground">{isRTL ? 'دقائق' : 'Minutes'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-500">
              {lessons.filter(l => l.video_url).length}
            </p>
            <p className="text-sm text-muted-foreground">{isRTL ? 'فيديوهات' : 'Videos'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Chapters */}
      {chapters.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {isRTL ? 'لا توجد فصول' : 'No chapters yet'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {isRTL ? 'ابدأ بإضافة أول فصل للدورة' : 'Start by adding your first chapter'}
            </p>
            <Button onClick={() => {
              resetChapterForm();
              setEditingChapter(null);
              setIsChapterDialogOpen(true);
            }}>
              <Plus className="w-4 h-4 me-2" />
              {isRTL ? 'إضافة فصل' : 'Add Chapter'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {chapters.map((chapter, index) => (
            <AccordionItem
              key={chapter.id}
              value={chapter.id}
              className="border rounded-lg bg-card overflow-hidden"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                <div className="flex items-center gap-3 flex-1 text-start">
                  <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                  <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">
                      {isRTL && chapter.title_ar ? chapter.title_ar : chapter.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {getLessonsForChapter(chapter.id).length} {isRTL ? 'دروس' : 'lessons'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {chapter.is_free && (
                      <Badge variant="outline" className="text-green-500 border-green-500">
                        {isRTL ? 'مجاني' : 'Free'}
                      </Badge>
                    )}
                    {chapter.is_published ? (
                      <Badge className="bg-green-500/10 text-green-500">{isRTL ? 'منشور' : 'Published'}</Badge>
                    ) : (
                      <Badge variant="secondary">{isRTL ? 'مسودة' : 'Draft'}</Badge>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="flex justify-between items-center mb-4 pt-2 border-t">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEditChapter(chapter)}>
                      <Edit className="w-4 h-4 me-1" />
                      {isRTL ? 'تعديل' : 'Edit'}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-destructive"
                      onClick={() => deleteChapterMutation.mutate(chapter.id)}
                    >
                      <Trash2 className="w-4 h-4 me-1" />
                      {isRTL ? 'حذف' : 'Delete'}
                    </Button>
                  </div>
                  <Button size="sm" onClick={() => openAddLesson(chapter.id)}>
                    <Plus className="w-4 h-4 me-1" />
                    {isRTL ? 'إضافة درس' : 'Add Lesson'}
                  </Button>
                </div>

                {/* Lessons */}
                <div className="space-y-2">
                  {getLessonsForChapter(chapter.id).map((lesson, lessonIndex) => (
                    <div
                      key={lesson.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 group hover:bg-muted/50 transition-colors"
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                      <span className="text-sm text-muted-foreground w-6">{lessonIndex + 1}.</span>
                      {lesson.video_url ? (
                        <Video className="w-4 h-4 text-primary" />
                      ) : (
                        <FileText className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="flex-1 font-medium truncate">
                        {isRTL && lesson.title_ar ? lesson.title_ar : lesson.title}
                      </span>
                      {lesson.duration_minutes && (
                        <span className="text-sm text-muted-foreground">
                          {lesson.duration_minutes} {isRTL ? 'د' : 'min'}
                        </span>
                      )}
                      {lesson.is_free && (
                        <Badge variant="outline" className="text-green-500 border-green-500 text-xs">
                          {isRTL ? 'مجاني' : 'Free'}
                        </Badge>
                      )}
                      {lesson.is_published ? (
                        <Badge className="bg-green-500/10 text-green-500 text-xs">{isRTL ? 'منشور' : 'Published'}</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">{isRTL ? 'مسودة' : 'Draft'}</Badge>
                      )}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditLesson(lesson)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-destructive"
                          onClick={() => deleteLessonMutation.mutate(lesson.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {getLessonsForChapter(chapter.id).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {isRTL ? 'لا توجد دروس في هذا الفصل' : 'No lessons in this chapter'}
                    </p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Chapter Dialog */}
      <Dialog open={isChapterDialogOpen} onOpenChange={setIsChapterDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingChapter ? (isRTL ? 'تعديل الفصل' : 'Edit Chapter') : (isRTL ? 'إضافة فصل جديد' : 'Add New Chapter')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isRTL ? 'العنوان (إنجليزي)' : 'Title (English)'}</Label>
                <Input
                  value={chapterForm.title}
                  onChange={(e) => setChapterForm({ ...chapterForm, title: e.target.value })}
                  placeholder="Chapter title"
                />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? 'العنوان (عربي)' : 'Title (Arabic)'}</Label>
                <Input
                  value={chapterForm.title_ar}
                  onChange={(e) => setChapterForm({ ...chapterForm, title_ar: e.target.value })}
                  placeholder="عنوان الفصل"
                  dir="rtl"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isRTL ? 'الوصف (إنجليزي)' : 'Description (English)'}</Label>
                <Textarea
                  value={chapterForm.description}
                  onChange={(e) => setChapterForm({ ...chapterForm, description: e.target.value })}
                  placeholder="Description"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? 'الوصف (عربي)' : 'Description (Arabic)'}</Label>
                <Textarea
                  value={chapterForm.description_ar}
                  onChange={(e) => setChapterForm({ ...chapterForm, description_ar: e.target.value })}
                  placeholder="الوصف"
                  dir="rtl"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-3">
                <Switch
                  checked={chapterForm.is_published}
                  onCheckedChange={(checked) => setChapterForm({ ...chapterForm, is_published: checked })}
                />
                <Label>{isRTL ? 'منشور' : 'Published'}</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={chapterForm.is_free}
                  onCheckedChange={(checked) => setChapterForm({ ...chapterForm, is_free: checked })}
                />
                <Label>{isRTL ? 'مجاني' : 'Free'}</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChapterDialogOpen(false)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleChapterSubmit} disabled={createChapterMutation.isPending || updateChapterMutation.isPending}>
              <Save className="w-4 h-4 me-2" />
              {isRTL ? 'حفظ' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson Dialog */}
      <Dialog open={isLessonDialogOpen} onOpenChange={setIsLessonDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>
              {editingLesson ? (isRTL ? 'تعديل الدرس' : 'Edit Lesson') : (isRTL ? 'إضافة درس جديد' : 'Add New Lesson')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isRTL ? 'العنوان (إنجليزي)' : 'Title (English)'}</Label>
                <Input
                  value={lessonForm.title}
                  onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                  placeholder="Lesson title"
                />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? 'العنوان (عربي)' : 'Title (Arabic)'}</Label>
                <Input
                  value={lessonForm.title_ar}
                  onChange={(e) => setLessonForm({ ...lessonForm, title_ar: e.target.value })}
                  placeholder="عنوان الدرس"
                  dir="rtl"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isRTL ? 'الوصف (إنجليزي)' : 'Description (English)'}</Label>
                <Textarea
                  value={lessonForm.description}
                  onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                  placeholder="Description"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? 'الوصف (عربي)' : 'Description (Arabic)'}</Label>
                <Textarea
                  value={lessonForm.description_ar}
                  onChange={(e) => setLessonForm({ ...lessonForm, description_ar: e.target.value })}
                  placeholder="الوصف"
                  dir="rtl"
                  rows={2}
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label>{isRTL ? 'الفيديو' : 'Video'}</Label>
              <Tabs defaultValue="upload" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload" className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    {isRTL ? 'رفع فيديو' : 'Upload Video'}
                  </TabsTrigger>
                  <TabsTrigger value="url" className="flex items-center gap-2">
                    <LinkIcon className="w-4 h-4" />
                    {isRTL ? 'رابط خارجي' : 'External URL'}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="upload" className="mt-3">
                  <VideoUploader
                    currentVideoUrl={lessonForm.video_provider === 'upload' ? lessonForm.video_url : undefined}
                    isRTL={isRTL}
                    onUploadComplete={(url) => {
                      setLessonForm({ 
                        ...lessonForm, 
                        video_url: url, 
                        video_provider: url ? 'upload' : 'youtube' 
                      });
                    }}
                  />
                </TabsContent>
                <TabsContent value="url" className="mt-3 space-y-4">
                  <div className="space-y-2">
                    <Label>{isRTL ? 'رابط الفيديو' : 'Video URL'}</Label>
                    <Input
                      value={lessonForm.video_provider !== 'upload' ? lessonForm.video_url : ''}
                      onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })}
                      placeholder="https://youtube.com/watch?v=..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? 'مزود الفيديو' : 'Video Provider'}</Label>
                    <Select
                      value={lessonForm.video_provider === 'upload' ? 'youtube' : lessonForm.video_provider}
                      onValueChange={(value) => setLessonForm({ ...lessonForm, video_provider: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="youtube">YouTube</SelectItem>
                        <SelectItem value="vimeo">Vimeo</SelectItem>
                        <SelectItem value="cloudflare">Cloudflare</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'المدة (دقائق)' : 'Duration (minutes)'}</Label>
              <Input
                type="number"
                value={lessonForm.duration_minutes}
                onChange={(e) => setLessonForm({ ...lessonForm, duration_minutes: parseInt(e.target.value) || 0 })}
                min={0}
              />
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-3">
                <Switch
                  checked={lessonForm.is_published}
                  onCheckedChange={(checked) => setLessonForm({ ...lessonForm, is_published: checked })}
                />
                <Label>{isRTL ? 'منشور' : 'Published'}</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={lessonForm.is_free}
                  onCheckedChange={(checked) => setLessonForm({ ...lessonForm, is_free: checked })}
                />
                <Label>{isRTL ? 'مجاني' : 'Free'}</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLessonDialogOpen(false)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleLessonSubmit} disabled={createLessonMutation.isPending || updateLessonMutation.isPending}>
              <Save className="w-4 h-4 me-2" />
              {isRTL ? 'حفظ' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCourseEditor;
