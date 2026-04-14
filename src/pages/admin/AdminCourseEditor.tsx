import React, { useState, Suspense } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
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
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import BunnyVideoUploader from '@/components/admin/BunnyVideoUploader';
import TestQuestionManager from '@/components/admin/TestQuestionManager';
import LessonQuizManager from '@/components/admin/LessonQuizManager';
const RichTextEditor = React.lazy(() => import('@/components/admin/RichTextEditor'));
import ImageUploader from '@/components/admin/content/ImageUploader';
import BunnyVideoEmbed from '@/components/course/BunnyVideoEmbed';

interface ChapterTest {
  id: string;
  title: string;
  title_ar: string | null;
}

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
  video_thumbnail: string | null;
  duration_minutes: number | null;
  position: number;
  is_published: boolean;
  is_free: boolean;
}

const AdminCourseEditor: React.FC = () => {
  const useRQ = useQuery;
  const useRM = useMutation;
  const queryClient = useQueryClient();
  const dbFrom = (table: string) => supabase.from(table as any);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  const [isChapterDialogOpen, setIsChapterDialogOpen] = useState(false);
  const [isLessonDialogOpen, setIsLessonDialogOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  
  // Quiz/Test management state
  const [selectedTest, setSelectedTest] = useState<{ id: string; title: string } | null>(null);
  const [selectedLessonQuiz, setSelectedLessonQuiz] = useState<{ id: string; title: string } | null>(null);
  
  // Confirmation dialogs
  const [deleteChapterConfirm, setDeleteChapterConfirm] = useState<{ id: string; title: string } | null>(null);
  const [deleteLessonConfirm, setDeleteLessonConfirm] = useState<{ id: string; title: string } | null>(null);
  const [previewVideoReplacing, setPreviewVideoReplacing] = useState(false);

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
  const [lessonForm, setLessonForm] = useState<{
    title: string;
    title_ar: string;
    description: string;
    description_ar: string;
    video_url: string;
    video_provider: string;
    video_thumbnail: string;
    duration_minutes: number;
    is_published: boolean;
    is_free: boolean;
    _replacingVideo?: boolean;
  }>({
    title: '',
    title_ar: '',
    description: '',
    description_ar: '',
    video_url: '',
    video_provider: 'youtube',
    video_thumbnail: '',
    duration_minutes: 0,
    is_published: false,
    is_free: false,
  });

  // Fetch course
  const { data: course, isLoading: courseLoading } = useRQ({
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
  const { data: chapters = [], isLoading: chaptersLoading } = useRQ({
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
  const { data: lessons = [] } = useRQ({
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

  // Fetch chapter tests
  const { data: chapterTests = [] } = useRQ({
    queryKey: ['admin-chapter-tests', id],
    queryFn: async () => {
      const chapterIds = chapters.map(c => c.id);
      if (chapterIds.length === 0) return [];

      const { data, error } = await supabase
        .from('chapter_tests')
        .select('id, chapter_id, title, title_ar')
        .in('chapter_id', chapterIds);
      if (error) throw error;
      return data as (ChapterTest & { chapter_id: string })[];
    },
    enabled: chapters.length > 0,
  });

  const getTestForChapter = (chapterId: string) => {
    return chapterTests.find(t => t.chapter_id === chapterId);
  };

  // Create chapter mutation
  const createChapterMutation = useRM({
    mutationFn: async (data: typeof chapterForm) => {
      const maxPosition = chapters.reduce((max, ch) => Math.max(max, ch.position), -1);
      const { error } = await dbFrom('chapters').insert({
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
  const updateChapterMutation = useRM({
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
  const deleteChapterMutation = useRM({
    mutationFn: async (chapterId: string) => {
      const { error } = await dbFrom('chapters').delete().eq('id', chapterId);
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
  const createLessonMutation = useRM({
    mutationFn: async ({ chapterId, data }: { chapterId: string; data: typeof lessonForm }) => {
      const chapterLessons = lessons.filter(l => l.chapter_id === chapterId);
      const maxPosition = chapterLessons.reduce((max, l) => Math.max(max, l.position), -1);
      
      const { error } = await dbFrom('lessons').insert({
        chapter_id: chapterId,
        title: data.title,
        title_ar: data.title_ar || null,
        description: data.description || null,
        description_ar: data.description_ar || null,
        video_url: data.video_url || null,
        video_provider: data.video_provider,
        video_thumbnail: data.video_thumbnail || null,
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
  const updateLessonMutation = useRM({
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
          video_thumbnail: data.video_thumbnail || null,
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
  const deleteLessonMutation = useRM({
    mutationFn: async (lessonId: string) => {
      const { error } = await dbFrom('lessons').delete().eq('id', lessonId);
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

  // Reorder chapters mutation
  const reorderChaptersMutation = useRM({
    mutationFn: async (reorderedChapters: Chapter[]) => {
      const updates = reorderedChapters.map((chapter, index) => 
        dbFrom('chapters').update({ position: index }).eq('id', chapter.id)
      );
      const results = await Promise.all(updates);
      const error = results.find(r => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-chapters'] });
      toast.success(isRTL ? 'تم إعادة ترتيب الفصول' : 'Chapters reordered');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Reorder lessons mutation
  const reorderLessonsMutation = useRM({
    mutationFn: async ({ chapterId, reorderedLessons }: { chapterId: string; reorderedLessons: Lesson[] }) => {
      const updates = reorderedLessons.map((lesson, index) => 
        dbFrom('lessons').update({ position: index }).eq('id', lesson.id)
      );
      const results = await Promise.all(updates);
      const error = results.find(r => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lessons'] });
      toast.success(isRTL ? 'تم إعادة ترتيب الدروس' : 'Lessons reordered');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const moveChapter = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= chapters.length) return;
    
    const newChapters = [...chapters];
    const [removed] = newChapters.splice(fromIndex, 1);
    newChapters.splice(toIndex, 0, removed);
    reorderChaptersMutation.mutate(newChapters);
  };

  const moveLesson = (chapterId: string, fromIndex: number, direction: 'up' | 'down') => {
    const chapterLessons = getLessonsForChapter(chapterId);
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= chapterLessons.length) return;
    
    const newLessons = [...chapterLessons];
    const [removed] = newLessons.splice(fromIndex, 1);
    newLessons.splice(toIndex, 0, removed);
    reorderLessonsMutation.mutate({ chapterId, reorderedLessons: newLessons });
  };

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
      video_thumbnail: '',
      duration_minutes: 0,
      is_published: false,
      is_free: false,
      _replacingVideo: false,
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
      video_thumbnail: lesson.video_thumbnail || '',
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

      {/* Preview / Introductory Video */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5 text-primary" />
            {isRTL ? 'فيديو تعريفي بالدورة' : 'Course Introductory Video'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isRTL
              ? 'هذا الفيديو يظهر في صفحة الدورة لجميع الزوار لتعريفهم بمحتوى الدورة'
              : 'This video is shown on the course page for all visitors to preview the course content'}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {course.preview_video_url && !previewVideoReplacing ? (
            <div className="space-y-4">
              <div className="aspect-video rounded-xl overflow-hidden bg-muted border border-border">
                <BunnyVideoEmbed
                  videoUrl={course.preview_video_url}
                  title={isRTL ? 'فيديو تعريفي' : 'Preview Video'}
                />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-green-500 border-green-500">
                  <CheckCircle2 className="w-3 h-3 me-1" />
                  {isRTL ? 'تم الرفع' : 'Uploaded'}
                </Badge>
                <div className="flex-1" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewVideoReplacing(true)}
                >
                  <Upload className="w-4 h-4 me-2" />
                  {isRTL ? 'استبدال الفيديو' : 'Replace Video'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={async () => {
                    await dbFrom('courses').update({ preview_video_url: null }).eq('id', id);
                    queryClient.invalidateQueries({ queryKey: ['admin-course', id] });
                    toast.success(isRTL ? 'تم حذف الفيديو التعريفي' : 'Preview video removed');
                  }}
                >
                  <Trash2 className="w-4 h-4 me-2" />
                  {isRTL ? 'حذف' : 'Remove'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <BunnyVideoUploader
                onUploadComplete={async (videoId, playbackUrl) => {
                  await dbFrom('courses').update({ preview_video_url: playbackUrl }).eq('id', id);
                  queryClient.invalidateQueries({ queryKey: ['admin-course', id] });
                  setPreviewVideoReplacing(false);
                  toast.success(isRTL ? 'تم رفع الفيديو التعريفي بنجاح' : 'Preview video uploaded successfully');
                }}
                isRTL={isRTL}
              />
              {previewVideoReplacing && (
                <Button variant="ghost" size="sm" onClick={() => setPreviewVideoReplacing(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Button>
              )}
            </div>
          )}

          {/* Preview Video Thumbnail */}
          <div className="border-t border-border pt-4">
            <ImageUploader
              value={(course as any).preview_video_thumbnail || ''}
              onChange={async (url) => {
                await dbFrom('courses').update({ preview_video_thumbnail: url }).eq('id', id);
                queryClient.invalidateQueries({ queryKey: ['admin-course', id] });
                toast.success(isRTL ? 'تم تحديث صورة الفيديو المصغرة' : 'Video thumbnail updated');
              }}
              label={isRTL ? 'صورة مصغرة للفيديو التعريفي' : 'Preview Video Thumbnail'}
              bucket="course-thumbnails"
              folder="preview-thumbnails"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {isRTL
                ? 'هذه الصورة تظهر قبل تشغيل الفيديو التعريفي. إذا لم يتم تعيينها، سيتم استخدام صورة الدورة الرئيسية.'
                : 'This image is shown before the preview video plays. If not set, the course thumbnail will be used.'}
            </p>
          </div>
        </CardContent>
      </Card>

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
                  <div className="flex flex-col gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => { e.stopPropagation(); moveChapter(index, 'up'); }}
                      disabled={index === 0}
                    >
                      <ChevronUp className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => { e.stopPropagation(); moveChapter(index, 'down'); }}
                      disabled={index === chapters.length - 1}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </div>
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
                      onClick={() => setDeleteChapterConfirm({ 
                        id: chapter.id, 
                        title: isRTL && chapter.title_ar ? chapter.title_ar : chapter.title 
                      })}
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
                  {getLessonsForChapter(chapter.id).map((lesson, lessonIndex) => {
                    const chapterLessons = getLessonsForChapter(chapter.id);
                    return (
                      <div
                        key={lesson.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 group hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex flex-col gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => moveLesson(chapter.id, lessonIndex, 'up')}
                            disabled={lessonIndex === 0}
                          >
                            <ChevronUp className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => moveLesson(chapter.id, lessonIndex, 'down')}
                            disabled={lessonIndex === chapterLessons.length - 1}
                          >
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </div>
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
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7"
                                  onClick={() => setSelectedLessonQuiz({
                                    id: lesson.id,
                                    title: isRTL && lesson.title_ar ? lesson.title_ar : lesson.title,
                                  })}
                                >
                                  <ClipboardList className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {isRTL ? 'إدارة الأسئلة' : 'Manage Questions'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditLesson(lesson)}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-destructive"
                            onClick={() => setDeleteLessonConfirm({
                              id: lesson.id,
                              title: isRTL && lesson.title_ar ? lesson.title_ar : lesson.title
                            })}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {getLessonsForChapter(chapter.id).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {isRTL ? 'لا توجد دروس في هذا الفصل' : 'No lessons in this chapter'}
                    </p>
                  )}
                </div>

                {/* Chapter Quiz/Test */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">
                        {isRTL ? 'اختبار الفصل' : 'Chapter Quiz'}
                      </span>
                    </div>
                    {getTestForChapter(chapter.id) ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const test = getTestForChapter(chapter.id);
                          if (test) {
                            setSelectedTest({
                              id: test.id,
                              title: isRTL && test.title_ar ? test.title_ar : test.title,
                            });
                          }
                        }}
                      >
                        <Edit className="w-4 h-4 me-1" />
                        {isRTL ? 'إدارة الأسئلة' : 'Manage Questions'}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {isRTL ? 'لا يوجد اختبار' : 'No quiz configured'}
                      </span>
                    )}
                  </div>
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
            <Suspense fallback={<div className="h-[120px] animate-pulse bg-muted rounded-md" />}>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isRTL ? 'الوصف (إنجليزي)' : 'Description (English)'}</Label>
                  <RichTextEditor
                    value={chapterForm.description}
                    onChange={(val) => setChapterForm({ ...chapterForm, description: val })}
                    placeholder="Description"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? 'الوصف (عربي)' : 'Description (Arabic)'}</Label>
                  <RichTextEditor
                    value={chapterForm.description_ar}
                    onChange={(val) => setChapterForm({ ...chapterForm, description_ar: val })}
                    placeholder="الوصف"
                    dir="rtl"
                  />
                </div>
              </div>
            </Suspense>
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
        <DialogContent className="max-w-4xl w-[95vw] max-h-[95vh] overflow-y-auto overflow-x-hidden">
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
            <Suspense fallback={<div className="h-[120px] animate-pulse bg-muted rounded-md" />}>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isRTL ? 'الوصف (إنجليزي)' : 'Description (English)'}</Label>
                  <RichTextEditor
                    value={lessonForm.description}
                    onChange={(val) => setLessonForm({ ...lessonForm, description: val })}
                    placeholder="Description"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? 'الوصف (عربي)' : 'Description (Arabic)'}</Label>
                  <RichTextEditor
                    value={lessonForm.description_ar}
                    onChange={(val) => setLessonForm({ ...lessonForm, description_ar: val })}
                    placeholder="الوصف"
                    dir="rtl"
                  />
                </div>
              </div>
            </Suspense>
            <div className="space-y-3">
              <Label>{isRTL ? 'الفيديو' : 'Video'}</Label>
              
              {/* Show existing video if present */}
              {lessonForm.video_url && !lessonForm._replacingVideo && (
                <div className="p-4 bg-muted/50 border border-border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Video className="w-5 h-5 text-green-500" />
                      <span className="font-medium text-green-600">
                        {isRTL ? 'فيديو مرفق' : 'Video Attached'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLessonForm({ ...lessonForm, _replacingVideo: true } as any)}
                      >
                        <Upload className="w-4 h-4 me-1" />
                        {isRTL ? 'استبدال الفيديو' : 'Replace Video'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setLessonForm({ ...lessonForm, video_url: '', video_provider: 'bunny' })}
                      >
                        <Trash2 className="w-4 h-4 me-1" />
                        {isRTL ? 'إزالة' : 'Remove'}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground break-all">{lessonForm.video_url}</p>
                </div>
              )}
              
              {/* Upload new / replacement video */}
              {(!lessonForm.video_url || (lessonForm as any)._replacingVideo) && (
                <div className="space-y-2">
                  {(lessonForm as any)._replacingVideo && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {isRTL ? 'رفع فيديو بديل' : 'Upload replacement video'}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const { _replacingVideo, ...rest } = lessonForm as any;
                          setLessonForm(rest);
                        }}
                      >
                        {isRTL ? 'إلغاء الاستبدال' : 'Cancel Replace'}
                      </Button>
                    </div>
                  )}
                  <BunnyVideoUploader
                    onUploadComplete={(videoId, playbackUrl) => {
                      const { _replacingVideo, ...rest } = lessonForm as any;
                      setLessonForm({ 
                        ...rest, 
                        video_url: playbackUrl, 
                        video_provider: 'bunny' 
                      });
                    }}
                  />
                </div>
              )}
            </div>
            
            {/* Video Thumbnail */}
            <ImageUploader
              value={lessonForm.video_thumbnail}
              onChange={(url) => setLessonForm({ ...lessonForm, video_thumbnail: url })}
              label={isRTL ? 'صورة مصغرة للفيديو' : 'Video Thumbnail'}
              bucket="course-thumbnails"
              folder="lesson-thumbnails"
            />

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

      {/* Test Question Manager */}
      {selectedTest && (
        <TestQuestionManager
          testId={selectedTest.id}
          testTitle={selectedTest.title}
          isOpen={!!selectedTest}
          onClose={() => setSelectedTest(null)}
        />
      )}

      {/* Lesson Quiz Manager */}
      {selectedLessonQuiz && (
        <LessonQuizManager
          lessonId={selectedLessonQuiz.id}
          lessonTitle={selectedLessonQuiz.title}
          isOpen={!!selectedLessonQuiz}
          onClose={() => setSelectedLessonQuiz(null)}
        />
      )}

      {/* Delete Chapter Confirmation */}
      <Dialog open={!!deleteChapterConfirm} onOpenChange={(open) => !open && setDeleteChapterConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              {isRTL ? 'حذف الفصل' : 'Delete Chapter'}
            </DialogTitle>
            <DialogDescription>
              {isRTL 
                ? `هل أنت متأكد من حذف "${deleteChapterConfirm?.title}"؟ سيتم حذف جميع الدروس والفيديوهات المرتبطة بهذا الفصل. لا يمكن التراجع عن هذا الإجراء.`
                : `Are you sure you want to delete "${deleteChapterConfirm?.title}"? All lessons and videos in this chapter will be deleted. This action cannot be undone.`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteChapterConfirm(null)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (deleteChapterConfirm) {
                  deleteChapterMutation.mutate(deleteChapterConfirm.id);
                  setDeleteChapterConfirm(null);
                }
              }}
              disabled={deleteChapterMutation.isPending}
            >
              <Trash2 className="w-4 h-4 me-2" />
              {isRTL ? 'حذف' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Lesson Confirmation */}
      <Dialog open={!!deleteLessonConfirm} onOpenChange={(open) => !open && setDeleteLessonConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              {isRTL ? 'حذف الدرس' : 'Delete Lesson'}
            </DialogTitle>
            <DialogDescription>
              {isRTL 
                ? `هل أنت متأكد من حذف "${deleteLessonConfirm?.title}"؟ سيتم حذف الفيديو المرتبط بهذا الدرس. لا يمكن التراجع عن هذا الإجراء.`
                : `Are you sure you want to delete "${deleteLessonConfirm?.title}"? The video attached to this lesson will be removed. This action cannot be undone.`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteLessonConfirm(null)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (deleteLessonConfirm) {
                  deleteLessonMutation.mutate(deleteLessonConfirm.id);
                  setDeleteLessonConfirm(null);
                }
              }}
              disabled={deleteLessonMutation.isPending}
            >
              <Trash2 className="w-4 h-4 me-2" />
              {isRTL ? 'حذف' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCourseEditor;
