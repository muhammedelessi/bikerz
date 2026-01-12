import React, { useState, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Play,
  Pause,
  Clock,
  BookOpen,
  CheckCircle2,
  Lock,
  ChevronLeft,
  ChevronRight,
  FileText,
  Video,
  AlertCircle,
  Menu,
  X,
  Maximize,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  ClipboardList,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';
import bikerzLogo from '@/assets/bikerz-logo.png';
import ChapterTest from '@/components/course/ChapterTest';

interface Lesson {
  id: string;
  title: string;
  title_ar: string | null;
  description: string | null;
  description_ar: string | null;
  video_url: string | null;
  duration_minutes: number | null;
  position: number;
  is_published: boolean;
  is_free: boolean;
  chapter_id: string;
}

interface ChapterTest {
  id: string;
  title: string;
  title_ar: string | null;
  passing_score: number;
  time_limit_minutes: number | null;
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
  lessons: Lesson[];
  test?: ChapterTest | null;
}

interface Course {
  id: string;
  title: string;
  title_ar: string | null;
  description: string | null;
  description_ar: string | null;
  thumbnail_url: string | null;
  price: number;
  difficulty_level: string;
  duration_hours: number | null;
  total_lessons: number | null;
  instructor_id: string | null;
}

interface LessonProgress {
  lesson_id: string;
  is_completed: boolean;
  watch_time_seconds: number | null;
}

interface LessonResource {
  id: string;
  title: string;
  resource_type: string;
  resource_url: string;
}

const CourseLearn: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [showTest, setShowTest] = useState<string | null>(null); // chapter id
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const ForwardIcon = isRTL ? ChevronLeft : ChevronRight;

  // Fetch course details
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course-learn', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as Course | null;
    },
    enabled: !!id,
  });

  // Fetch chapters with lessons and tests
  const { data: chapters = [], isLoading: chaptersLoading } = useQuery({
    queryKey: ['chapters-learn', id],
    queryFn: async () => {
      const { data: chaptersData, error: chaptersError } = await supabase
        .from('chapters')
        .select('*')
        .eq('course_id', id)
        .order('position', { ascending: true });

      if (chaptersError) throw chaptersError;

      const chaptersWithData = await Promise.all(
        (chaptersData || []).map(async (chapter) => {
          // Fetch lessons
          const { data: lessons, error: lessonsError } = await supabase
            .from('lessons')
            .select('*')
            .eq('chapter_id', chapter.id)
            .order('position', { ascending: true });

          if (lessonsError) throw lessonsError;

          // Fetch test for this chapter
          const { data: test, error: testError } = await supabase
            .from('chapter_tests')
            .select('id, title, title_ar, passing_score, time_limit_minutes')
            .eq('chapter_id', chapter.id)
            .eq('is_published', true)
            .maybeSingle();

          return {
            ...chapter,
            lessons: lessons || [],
            test: test || null,
          } as Chapter;
        })
      );

      return chaptersWithData;
    },
    enabled: !!id,
  });

  // Fetch enrollment status
  const { data: enrollment, isLoading: enrollmentLoading } = useQuery({
    queryKey: ['enrollment-learn', id, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('course_enrollments')
        .select('*')
        .eq('course_id', id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  // Fetch lesson progress
  const { data: lessonProgress = [] } = useQuery({
    queryKey: ['lesson-progress-learn', id, user?.id],
    queryFn: async () => {
      if (!user || !chapters.length) return [];
      
      const lessonIds = chapters.flatMap(ch => ch.lessons.map(l => l.id));
      if (!lessonIds.length) return [];

      const { data, error } = await supabase
        .from('lesson_progress')
        .select('lesson_id, is_completed, watch_time_seconds')
        .eq('user_id', user.id)
        .in('lesson_id', lessonIds);

      if (error) throw error;
      return (data || []) as LessonProgress[];
    },
    enabled: !!id && !!user && chapters.length > 0,
  });

  // Fetch current lesson resources
  const { data: resources = [] } = useQuery({
    queryKey: ['lesson-resources', currentLessonId],
    queryFn: async () => {
      if (!currentLessonId) return [];
      const { data, error } = await supabase
        .from('lesson_resources')
        .select('*')
        .eq('lesson_id', currentLessonId);

      if (error) throw error;
      return data as LessonResource[];
    },
    enabled: !!currentLessonId,
  });

  // Mark lesson as complete mutation
  const completeLessonMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data: existing } = await supabase
        .from('lesson_progress')
        .select('id')
        .eq('lesson_id', lessonId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('lesson_progress')
          .update({ is_completed: true, completed_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('lesson_progress')
          .insert({
            lesson_id: lessonId,
            user_id: user.id,
            is_completed: true,
            completed_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-progress-learn'] });
      toast.success(isRTL ? 'تم إكمال الدرس!' : 'Lesson completed!');
    },
  });

  // Set initial lesson
  useEffect(() => {
    if (chapters.length > 0 && !currentLessonId) {
      const firstLesson = chapters[0]?.lessons[0];
      if (firstLesson) {
        setCurrentLessonId(firstLesson.id);
      }
    }
  }, [chapters, currentLessonId]);

  // Current lesson
  const currentLesson = chapters
    .flatMap(ch => ch.lessons)
    .find(l => l.id === currentLessonId);

  const currentChapter = chapters.find(ch => 
    ch.lessons.some(l => l.id === currentLessonId)
  );

  // Calculate progress
  const totalLessons = chapters.reduce((acc, ch) => acc + ch.lessons.length, 0);
  const completedLessons = lessonProgress.filter(lp => lp.is_completed).length;
  const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const isEnrolled = !!enrollment;
  const isLoading = courseLoading || chaptersLoading || enrollmentLoading;

  const isLessonCompleted = (lessonId: string) => {
    return lessonProgress.some(lp => lp.lesson_id === lessonId && lp.is_completed);
  };

  const isLessonLocked = (lesson: Lesson, chapter: Chapter) => {
    if (!isEnrolled && !lesson.is_free && !chapter.is_free) return true;
    return false;
  };

  // Navigation
  const allLessons = chapters.flatMap(ch => ch.lessons);
  const currentIndex = allLessons.findIndex(l => l.id === currentLessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  const goToLesson = (lessonId: string) => {
    setCurrentLessonId(lessonId);
    setShowTest(null);
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Video controls
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const skip = (amount: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += amount;
    }
  };

  // Check if all lessons in chapter are complete
  const isChapterComplete = (chapter: Chapter) => {
    return chapter.lessons.every(l => isLessonCompleted(l.id));
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-8">
          <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {isRTL ? 'يرجى تسجيل الدخول' : 'Please Login'}
          </h2>
          <p className="text-muted-foreground mb-6">
            {isRTL ? 'يجب تسجيل الدخول للوصول إلى الدورة' : 'You need to login to access this course'}
          </p>
          <Button asChild>
            <Link to="/login">{isRTL ? 'تسجيل الدخول' : 'Login'}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex h-screen">
          <div className="flex-1 p-8">
            <Skeleton className="w-full aspect-video rounded-xl" />
            <Skeleton className="h-8 w-1/2 mt-6" />
            <Skeleton className="h-4 w-full mt-4" />
          </div>
          <div className="w-80 border-s border-border p-4">
            <Skeleton className="h-6 w-32 mb-4" />
            {[1,2,3].map(i => (
              <Skeleton key={i} className="h-16 w-full mb-2" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!course || !isEnrolled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-8">
          <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {!course 
              ? (isRTL ? 'الدورة غير موجودة' : 'Course Not Found')
              : (isRTL ? 'غير مسجل في الدورة' : 'Not Enrolled')}
          </h2>
          <p className="text-muted-foreground mb-6">
            {!course 
              ? (isRTL ? 'لم نتمكن من العثور على هذه الدورة' : "We couldn't find this course")
              : (isRTL ? 'يرجى التسجيل في الدورة أولاً' : 'Please enroll in this course first')}
          </p>
          <Button asChild>
            <Link to={`/courses/${id}`}>
              <BackIcon className="w-4 h-4 me-2" />
              {isRTL ? 'العودة لصفحة الدورة' : 'Back to Course'}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-border bg-card/80 backdrop-blur-xl flex items-center justify-between px-4 lg:px-6 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          
          <Link to="/courses" className="flex items-center gap-2">
            <img src={bikerzLogo} alt="BIKERZ" className="h-10" />
          </Link>
          
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
            <span>/</span>
            <span className="text-foreground font-medium truncate max-w-[200px]">
              {isRTL && course.title_ar ? course.title_ar : course.title}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {progressPercentage}%
            </span>
            <Progress value={progressPercentage} className="w-24 h-2" />
          </div>
          
          <Button variant="outline" size="sm" asChild>
            <Link to={`/courses/${id}`}>
              {isRTL ? 'تفاصيل الدورة' : 'Course Details'}
            </Link>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <main className={`flex-1 overflow-auto transition-all duration-300 ${sidebarOpen ? 'lg:me-80' : ''}`}>
          <AnimatePresence mode="wait">
            {showTest && currentChapter?.test ? (
              <motion.div
                key="test"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-4 lg:p-8"
              >
                <ChapterTest
                  testId={currentChapter.test.id}
                  chapterTitle={isRTL && currentChapter.title_ar ? currentChapter.title_ar : currentChapter.title}
                  onComplete={() => {
                    setShowTest(null);
                    toast.success(isRTL ? 'أحسنت! أكملت الاختبار' : 'Great job! Test completed');
                  }}
                  onBack={() => setShowTest(null)}
                />
              </motion.div>
            ) : (
              <motion.div
                key="lesson"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* Video Player */}
                <div className="relative bg-black aspect-video">
                  {currentLesson?.video_url ? (
                    <>
                      <video
                        ref={videoRef}
                        src={currentLesson.video_url}
                        className="w-full h-full"
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => {
                          setIsPlaying(false);
                          if (!isLessonCompleted(currentLesson.id)) {
                            completeLessonMutation.mutate(currentLesson.id);
                          }
                        }}
                      />
                      
                      {/* Video Controls Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          {/* Progress Bar */}
                          <input
                            type="range"
                            min={0}
                            max={duration || 100}
                            value={currentTime}
                            onChange={handleSeek}
                            className="w-full h-1 mb-4 accent-primary cursor-pointer"
                          />
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="icon" onClick={() => skip(-10)}>
                                <SkipBack className="w-5 h-5 text-white" />
                              </Button>
                              
                              <Button variant="ghost" size="icon" onClick={togglePlay}>
                                {isPlaying ? (
                                  <Pause className="w-6 h-6 text-white" />
                                ) : (
                                  <Play className="w-6 h-6 text-white ms-0.5" />
                                )}
                              </Button>
                              
                              <Button variant="ghost" size="icon" onClick={() => skip(10)}>
                                <SkipForward className="w-5 h-5 text-white" />
                              </Button>
                              
                              <Button variant="ghost" size="icon" onClick={toggleMute}>
                                {isMuted ? (
                                  <VolumeX className="w-5 h-5 text-white" />
                                ) : (
                                  <Volume2 className="w-5 h-5 text-white" />
                                )}
                              </Button>
                              
                              <span className="text-white text-sm ms-2">
                                {formatTime(currentTime)} / {formatTime(duration)}
                              </span>
                            </div>
                            
                            <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
                              <Maximize className="w-5 h-5 text-white" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <div className="text-center">
                        <Video className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">
                          {isRTL ? 'لا يوجد فيديو لهذا الدرس' : 'No video available for this lesson'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Lesson Content */}
                <div className="p-4 lg:p-8">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
                    <div>
                      <span className="text-sm text-primary font-medium">
                        {currentChapter && (isRTL && currentChapter.title_ar ? currentChapter.title_ar : currentChapter.title)}
                      </span>
                      <h1 className="text-2xl lg:text-3xl font-bold text-foreground mt-1">
                        {currentLesson && (isRTL && currentLesson.title_ar ? currentLesson.title_ar : currentLesson.title)}
                      </h1>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {currentLesson && !isLessonCompleted(currentLesson.id) && (
                        <Button
                          variant="outline"
                          onClick={() => completeLessonMutation.mutate(currentLesson.id)}
                          disabled={completeLessonMutation.isPending}
                        >
                          <CheckCircle2 className="w-4 h-4 me-2" />
                          {isRTL ? 'وضع علامة مكتمل' : 'Mark Complete'}
                        </Button>
                      )}
                      
                      {currentLesson && isLessonCompleted(currentLesson.id) && (
                        <div className="flex items-center gap-2 text-primary">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="font-medium">{isRTL ? 'مكتمل' : 'Completed'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {currentLesson?.description && (
                    <div className="prose prose-invert max-w-none mb-8">
                      <p className="text-muted-foreground">
                        {isRTL && currentLesson.description_ar ? currentLesson.description_ar : currentLesson.description}
                      </p>
                    </div>
                  )}

                  {/* Resources */}
                  {resources.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-lg font-semibold text-foreground mb-4">
                        {isRTL ? 'الموارد' : 'Resources'}
                      </h3>
                      <div className="grid gap-2">
                        {resources.map((resource) => (
                          <a
                            key={resource.id}
                            href={resource.resource_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                          >
                            <FileText className="w-5 h-5 text-primary" />
                            <span className="text-foreground">{resource.title}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Navigation */}
                  <div className="flex items-center justify-between pt-6 border-t border-border">
                    {prevLesson ? (
                      <Button variant="outline" onClick={() => goToLesson(prevLesson.id)}>
                        <BackIcon className="w-4 h-4 me-2" />
                        {isRTL ? 'الدرس السابق' : 'Previous'}
                      </Button>
                    ) : (
                      <div />
                    )}
                    
                    {nextLesson ? (
                      <Button onClick={() => goToLesson(nextLesson.id)}>
                        {isRTL ? 'الدرس التالي' : 'Next'}
                        <ForwardIcon className="w-4 h-4 ms-2" />
                      </Button>
                    ) : currentChapter?.test && isChapterComplete(currentChapter) ? (
                      <Button onClick={() => setShowTest(currentChapter.id)} className="btn-cta">
                        <ClipboardList className="w-4 h-4 me-2" />
                        {isRTL ? 'ابدأ الاختبار' : 'Take Test'}
                      </Button>
                    ) : (
                      <Button disabled>
                        <Trophy className="w-4 h-4 me-2" />
                        {isRTL ? 'أكمل الدورة' : 'Course Complete'}
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Sidebar */}
        <aside
          className={`fixed lg:fixed top-16 end-0 h-[calc(100vh-4rem)] w-80 bg-card border-s border-border transform transition-transform duration-300 z-40 ${
            sidebarOpen ? 'translate-x-0' : isRTL ? '-translate-x-full' : 'translate-x-full'
          }`}
        >
          <ScrollArea className="h-full">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-foreground">
                  {isRTL ? 'محتوى الدورة' : 'Course Content'}
                </h2>
                <span className="text-sm text-muted-foreground">
                  {completedLessons}/{totalLessons}
                </span>
              </div>

              <Accordion type="multiple" defaultValue={chapters.map(c => c.id)} className="space-y-2">
                {chapters.map((chapter, chapterIndex) => (
                  <AccordionItem
                    key={chapter.id}
                    value={chapter.id}
                    className="border border-border/50 rounded-lg overflow-hidden"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 text-sm">
                      <div className="flex items-center gap-3 text-start">
                        <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isChapterComplete(chapter) 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {isChapterComplete(chapter) ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            chapterIndex + 1
                          )}
                        </span>
                        <span className="font-medium text-foreground">
                          {isRTL && chapter.title_ar ? chapter.title_ar : chapter.title}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-0 pb-0">
                      <div className="border-t border-border/50">
                        {chapter.lessons.map((lesson) => {
                          const locked = isLessonLocked(lesson, chapter);
                          const completed = isLessonCompleted(lesson.id);
                          const isActive = lesson.id === currentLessonId;

                          return (
                            <button
                              key={lesson.id}
                              disabled={locked}
                              onClick={() => !locked && goToLesson(lesson.id)}
                              className={`w-full flex items-center gap-3 px-4 py-3 text-start text-sm transition-colors ${
                                isActive 
                                  ? 'bg-primary/10 border-s-2 border-primary' 
                                  : locked 
                                    ? 'opacity-50 cursor-not-allowed' 
                                    : 'hover:bg-muted/50'
                              }`}
                            >
                              <div className="flex-shrink-0">
                                {locked ? (
                                  <Lock className="w-4 h-4 text-muted-foreground" />
                                ) : completed ? (
                                  <CheckCircle2 className="w-4 h-4 text-primary" />
                                ) : isActive ? (
                                  <Play className="w-4 h-4 text-primary" />
                                ) : (
                                  <Video className="w-4 h-4 text-muted-foreground" />
                                )}
                              </div>
                              <span className={`flex-1 truncate ${isActive ? 'text-primary font-medium' : 'text-foreground'}`}>
                                {isRTL && lesson.title_ar ? lesson.title_ar : lesson.title}
                              </span>
                              {lesson.duration_minutes && (
                                <span className="text-xs text-muted-foreground">
                                  {lesson.duration_minutes}m
                                </span>
                              )}
                            </button>
                          );
                        })}
                        
                        {/* Chapter Test */}
                        {chapter.test && (
                          <button
                            onClick={() => isChapterComplete(chapter) && setShowTest(chapter.id)}
                            disabled={!isChapterComplete(chapter)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-start text-sm transition-colors border-t border-border/30 ${
                              !isChapterComplete(chapter)
                                ? 'opacity-50 cursor-not-allowed'
                                : showTest === chapter.id
                                  ? 'bg-primary/10 border-s-2 border-primary'
                                  : 'hover:bg-muted/50'
                            }`}
                          >
                            <ClipboardList className={`w-4 h-4 ${
                              isChapterComplete(chapter) ? 'text-primary' : 'text-muted-foreground'
                            }`} />
                            <span className={`flex-1 ${
                              showTest === chapter.id ? 'text-primary font-medium' : 'text-foreground'
                            }`}>
                              {isRTL && chapter.test.title_ar ? chapter.test.title_ar : chapter.test.title}
                            </span>
                            {!isChapterComplete(chapter) && (
                              <Lock className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
};

export default CourseLearn;
