import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Play,
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
  ClipboardList,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';
import bikerzLogo from '@/assets/bikerz-logo.webp';
import ChapterTest from '@/components/course/ChapterTest';
import VideoPlayer from '@/components/course/VideoPlayer';
import BunnyVideoEmbed from '@/components/course/BunnyVideoEmbed';
import LessonDiscussion from '@/components/course/LessonDiscussion';
import LessonQuiz from '@/components/course/LessonQuiz';
import ReinforcementSuggestion from '@/components/learning/ReinforcementSuggestion';
import LessonRecapInsert from '@/components/learning/LessonRecapInsert';
import NextLessonCountdown from '@/components/course/NextLessonCountdown';
import PurchaseEncouragementModal from '@/components/course/PurchaseEncouragementModal';
import ReviewPromptModal from '@/components/course/ReviewPromptModal';
import CheckoutModal from '@/components/checkout/CheckoutModal';

interface Lesson {
  id: string;
  title: string;
  title_ar: string | null;
  description: string | null;
  description_ar: string | null;
  video_url: string | null;
  video_provider: string | null;
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
  discount_percentage: number | null;
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
  const { id, lessonId: urlLessonId } = useParams<{ id: string; lessonId?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(urlLessonId || null);
  const [showTest, setShowTest] = useState<string | null>(null);
  const [showNextCountdown, setShowNextCountdown] = useState(false);
  const [autoPlayNext, setAutoPlayNext] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => searchParams.get('welcome') === '1');
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const purchaseModalShownRef = React.useRef<Set<string>>(new Set());
  const autoCompletedRef = React.useRef<Set<string>>(new Set());
  const lessonProgressRef = React.useRef<LessonProgress[]>([]);
  const initialTimeRef = React.useRef<number>(0);
  const videoContainerRef = React.useRef<HTMLDivElement>(null);

  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const ForwardIcon = isRTL ? ChevronLeft : ChevronRight;

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

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
          const { data: lessons, error: lessonsError } = await supabase
            .from('lessons')
            .select('*')
            .eq('chapter_id', chapter.id)
            .order('position', { ascending: true });

          if (lessonsError) throw lessonsError;

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

  // Fetch quiz/test attempts to track passed quizzes and allow retakes
  const { data: testAttempts = [] } = useQuery({
    queryKey: ['test-attempts', id, user?.id],
    queryFn: async () => {
      if (!user || !chapters.length) return [];
      
      const testIds = chapters
        .filter(ch => ch.test)
        .map(ch => ch.test!.id);
      
      if (!testIds.length) return [];

      // Fetch all attempts (not just passed) to track quiz history
      const { data, error } = await supabase
        .from('test_attempts')
        .select('test_id, passed, score, completed_at')
        .eq('user_id', user.id)
        .in('test_id', testIds)
        .order('completed_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!user && chapters.length > 0,
  });

  // Calculate quiz progress
  const totalQuizzes = chapters.filter(ch => ch.test).length;
  const passedQuizzes = new Set(testAttempts.filter(a => a.passed).map(a => a.test_id)).size;

  const isTestPassed = (testId: string) => {
    return testAttempts.some(a => a.test_id === testId && a.passed);
  };

  const hasAttemptedTest = (testId: string) => {
    return testAttempts.some(a => a.test_id === testId);
  };

  const getLastTestScore = (testId: string) => {
    const attempts = testAttempts.filter(a => a.test_id === testId);
    return attempts.length > 0 ? attempts[0].score : null;
  };

  // Progressive quiz locking - unlock next quiz only after passing the previous one
  const canAccessTest = (chapter: Chapter, chapterIndex: number) => {
    if (!chapter.test) return false;
    
    // First chapter quiz is always accessible
    if (chapterIndex === 0) return true;
    
    // Find the previous chapter that has a test
    for (let i = chapterIndex - 1; i >= 0; i--) {
      const prevChapter = chapters[i];
      if (prevChapter.test) {
        // Check if previous quiz was passed
        return isTestPassed(prevChapter.test.id);
      }
    }
    
    // No previous quiz exists, so this one is accessible
    return true;
  };

  // Get the required quiz name that needs to be passed to unlock a given chapter's quiz
  const getRequiredQuizName = (chapterIndex: number): string | null => {
    if (chapterIndex === 0) return null;
    
    for (let i = chapterIndex - 1; i >= 0; i--) {
      const prevChapter = chapters[i];
      if (prevChapter.test) {
        const title = isRTL && prevChapter.test.title_ar 
          ? prevChapter.test.title_ar 
          : prevChapter.test.title;
        return title;
      }
    }
    return null;
  };

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

      // Get the lesson's duration to estimate watch time if needed
      const targetLesson = chapters.flatMap(ch => ch.lessons).find(l => l.id === lessonId);
      const estimatedWatchTimeSec = (targetLesson?.duration_minutes || 5) * 60;

      if (existing) {
        // Only update watch_time if it's currently 0 (estimate from lesson duration)
        const { data: existingData } = await supabase
          .from('lesson_progress')
          .select('watch_time_seconds')
          .eq('id', existing.id)
          .single();

        const updateData: Record<string, unknown> = {
          is_completed: true,
          completed_at: new Date().toISOString(),
          last_watched_at: new Date().toISOString(),
        };
        if (!existingData?.watch_time_seconds || existingData.watch_time_seconds === 0) {
          updateData.watch_time_seconds = estimatedWatchTimeSec;
        }

        const { error } = await supabase
          .from('lesson_progress')
          .update(updateData)
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
            last_watched_at: new Date().toISOString(),
            watch_time_seconds: estimatedWatchTimeSec,
          });
        if (error) throw error;
      }

      // Recalculate and update course enrollment progress
      if (id) {
        // Get all lesson IDs for this course
        const { data: courseChapters } = await supabase
          .from('chapters')
          .select('id')
          .eq('course_id', id);
        
        if (courseChapters && courseChapters.length > 0) {
          const chapterIds = courseChapters.map(ch => ch.id);
          
          const { data: courseLessons } = await supabase
            .from('lessons')
            .select('id')
            .in('chapter_id', chapterIds)
            .eq('is_published', true);
          
          const totalLessons = courseLessons?.length || 0;
          
          if (totalLessons > 0) {
            const lessonIds = courseLessons!.map(l => l.id);
            
            const { count: completedCount } = await supabase
              .from('lesson_progress')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('is_completed', true)
              .in('lesson_id', lessonIds);
            
            const progressPct = Math.round(((completedCount || 0) / totalLessons) * 100);
            const isFullyComplete = progressPct >= 100;
            
            await supabase
              .from('course_enrollments')
              .update({ 
                progress_percentage: progressPct,
                ...(isFullyComplete ? { completed_at: new Date().toISOString() } : {})
              })
              .eq('user_id', user.id)
              .eq('course_id', id);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-progress-learn'] });
      toast.success(isRTL ? 'تم إكمال الدرس!' : 'Lesson completed!');
    },
  });

  // Save watch time mutation (debounced, no toast)
  const saveWatchTimeMutation = useMutation({
    mutationFn: async ({ lessonId, watchTimeSeconds }: { lessonId: string; watchTimeSeconds: number }) => {
      if (!user) return;
      
      const { data: existing } = await supabase
        .from('lesson_progress')
        .select('id')
        .eq('lesson_id', lessonId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('lesson_progress')
          .update({ 
            watch_time_seconds: watchTimeSeconds,
            last_watched_at: new Date().toISOString()
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('lesson_progress')
          .insert({
            lesson_id: lessonId,
            user_id: user.id,
            watch_time_seconds: watchTimeSeconds,
            last_watched_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      // Silently invalidate without showing toast
      queryClient.invalidateQueries({ queryKey: ['lesson-progress-learn'] });
    },
  });

  // Keep ref in sync with latest lessonProgress to avoid stale closures
  useEffect(() => {
    lessonProgressRef.current = lessonProgress;
  }, [lessonProgress]);

  // Store initialTime in ref so it only updates on lesson change, not on progress updates
  useEffect(() => {
    initialTimeRef.current = getSavedWatchTime(currentLessonId || '');
  }, [currentLessonId]);



  // Get saved watch time for current lesson
  const getSavedWatchTime = (lessonId: string): number => {
    const progress = lessonProgress.find(lp => lp.lesson_id === lessonId);
    return progress?.watch_time_seconds || 0;
  };

  // Handle watch time update from video player
  const handleWatchTimeUpdate = (lessonId: string, timeSeconds: number) => {
    if (user && lessonId) {
      saveWatchTimeMutation.mutate({ lessonId, watchTimeSeconds: timeSeconds });
    }
  };

  // Set initial lesson from URL or default to first lesson
  useEffect(() => {
    if (chapters.length > 0) {
      // If URL has a lesson ID, validate and use it
      if (urlLessonId) {
        const lessonExists = chapters.some(ch => ch.lessons.some(l => l.id === urlLessonId));
        if (lessonExists) {
          setCurrentLessonId(urlLessonId);
          return;
        }
      }
      // Fallback to first lesson if no valid URL lesson ID
      if (!currentLessonId) {
        const firstLesson = chapters[0]?.lessons[0];
        if (firstLesson) {
          setCurrentLessonId(firstLesson.id);
          // Update URL to include the lesson ID
          navigate(`/courses/${id}/lessons/${firstLesson.id}`, { replace: true });
        }
      }
    }
  }, [chapters, urlLessonId, currentLessonId, id, navigate]);

  // Current lesson
  const currentLesson = chapters
    .flatMap(ch => ch.lessons)
    .find(l => l.id === currentLessonId);

  const currentChapter = chapters.find(ch => 
    ch.lessons.some(l => l.id === currentLessonId)
  );

  // Chapter for the currently shown test (may differ from currentChapter)
  const testChapter = showTest ? chapters.find(ch => ch.id === showTest) : null;

  // Calculate progress
  const totalLessons = chapters.reduce((acc, ch) => acc + ch.lessons.length, 0);
  const completedLessons = lessonProgress.filter(lp => lp.is_completed).length;
  const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const isEnrolled = !!enrollment;
  const isLoading = courseLoading || chaptersLoading || enrollmentLoading;

  const isLessonCompleted = (lessonId: string) => {
    return lessonProgress.some(lp => lp.lesson_id === lessonId && lp.is_completed);
  };

  const isLessonLocked = (lesson: Lesson, _chapter: Chapter) => {
    if (!isEnrolled && !lesson.is_free) return true;
    return false;
  };

  // Navigation
  const allLessons = chapters.flatMap(ch => ch.lessons);
  const currentIndex = allLessons.findIndex(l => l.id === currentLessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  const goToLesson = (lessonId: string, autoPlay = false) => {
    const targetLesson = allLessons.find(l => l.id === lessonId);
    const targetChapter = chapters.find(ch => ch.lessons.some(l => l.id === lessonId));
    if (targetLesson && targetChapter && isLessonLocked(targetLesson, targetChapter)) {
      toast.error(isRTL ? 'يجب عليك شراء الدورة للوصول لهذا الدرس' : 'You need to purchase the course to access this lesson');
      return;
    }
    setShowNextCountdown(false);
    setAutoPlayNext(autoPlay);
    setCurrentLessonId(lessonId);
    setShowTest(null);
    setSidebarOpen(false);
    // Reset ended fallback marker for target lesson
    autoCompletedRef.current.delete(`${lessonId}_ended`);
    navigate(`/courses/${id}/lessons/${lessonId}`, { replace: true });
  };

  const handleVideoEnded = useCallback(() => {
    console.log("[CourseLearn] handleVideoEnded called, currentLessonId:", currentLessonId, "nextLesson:", nextLesson?.id);

    if (
      currentLessonId &&
      !lessonProgressRef.current.some(lp => lp.lesson_id === currentLessonId && lp.is_completed)
    ) {
      completeLessonMutation.mutate(currentLessonId);
    }

    // Show purchase encouragement when ALL free lessons are completed (non-enrolled users only)
    if (!isEnrolled && currentLessonId && course?.price && course.price > 0 && !purchaseModalShownRef.current.has('__all_free_done__')) {
      const freeLessons = allLessons.filter(l => {
        return l.is_free;
      });

      if (freeLessons.length > 0) {
        // Include the lesson that just ended as completed (progress state may not have updated yet)
        const completedIds = new Set(
          lessonProgressRef.current.filter(lp => lp.is_completed).map(lp => lp.lesson_id)
        );
        completedIds.add(currentLessonId);

        const allFreeCompleted = freeLessons.every(l => completedIds.has(l.id));

        if (allFreeCompleted) {
          purchaseModalShownRef.current.add('__all_free_done__');
          setTimeout(() => setShowPurchaseModal(true), 800);
          return;
        }
      }
    }

    if (nextLesson) {
      const nextChapter = chapters.find(ch => ch.lessons.some(l => l.id === nextLesson.id));
      if (nextChapter && !isLessonLocked(nextLesson, nextChapter)) {
        console.log("[CourseLearn] Setting showNextCountdown = true");
        setShowNextCountdown(true);
      } else {
        console.log("[CourseLearn] Next lesson is locked or no chapter found");
      }
    } else {
      console.log("[CourseLearn] No next lesson available");
    }
  }, [currentLessonId, nextLesson, chapters, isEnrolled, course]);

  // Track video progress (watch time only, no auto-complete)
  const handleVideoProgress = useCallback((_progress: number) => {
    // Progress tracking only — completion is handled in handleVideoEnded
  }, []);

  // Interval-based ended fallback for .mp4 videos (triggers only when video fully ends)
  useEffect(() => {
    if (!currentLessonId || !currentLesson?.video_url || currentLesson?.video_provider === 'bunny') return;

    const interval = setInterval(() => {
      const container = videoContainerRef.current;
      if (!container) return;
      const videoEl = container.querySelector('video');
      if (!videoEl || !videoEl.duration || videoEl.paused) return;

      if (videoEl.duration - videoEl.currentTime <= 1.5 && !autoCompletedRef.current.has(currentLessonId + '_ended')) {
        autoCompletedRef.current.add(currentLessonId + '_ended');
        handleVideoEnded();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentLessonId, currentLesson, handleVideoEnded]);

  // Helper to extract YouTube video ID
  const getYouTubeVideoId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const isYouTubeUrl = (url: string | null): boolean => {
    if (!url) return false;
    return url.includes('youtube.com') || url.includes('youtu.be');
  };

  const isChapterComplete = (chapter: Chapter) => {
    return chapter.lessons.every(l => isLessonCompleted(l.id));
  };

  // Removed login requirement - allow anyone to view lessons

  if (isLoading) {
    return (
      <div className="min-h-screen min-h-[100svh] bg-background">
        <div className="flex flex-col lg:flex-row h-screen">
          <div className="flex-1 p-4 sm:p-8">
            <Skeleton className="w-full aspect-video rounded-xl" />
            <Skeleton className="h-6 sm:h-8 w-1/2 mt-4 sm:mt-6" />
            <Skeleton className="h-4 w-full mt-3 sm:mt-4" />
          </div>
          <div className="hidden lg:block w-80 border-s border-border p-4">
            <Skeleton className="h-6 w-32 mb-4" />
            {[1,2,3].map(i => (
              <Skeleton key={i} className="h-16 w-full mb-2" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen min-h-[100svh] bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
            {isRTL ? 'الدورة غير موجودة' : 'Course Not Found'}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-6">
            {isRTL ? 'لم نتمكن من العثور على هذه الدورة' : "We couldn't find this course"}
          </p>
          <Button asChild className="h-11">
            <Link to="/courses">
              <BackIcon className="w-4 h-4 me-2" />
              {isRTL ? 'العودة للدورات' : 'Back to Courses'}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen min-h-[100svh] bg-background flex flex-col select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Welcome Screen */}
      <AnimatePresence>
        {showWelcome && course && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-background p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: -10 }}
              transition={{ type: 'spring', damping: 22, stiffness: 260, delay: 0.1 }}
              className="w-full max-w-lg text-center space-y-8"
            >
              {/* Logo */}
              <motion.img
                src={bikerzLogo}
                alt="Bikerz"
                className="h-12 sm:h-14 mx-auto"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              />

              {/* Welcome message */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-3"
              >
                <h1 className="text-3xl sm:text-4xl font-black text-foreground">
                  {isRTL ? 'أهلاً بك! 👋' : 'Welcome! 👋'}
                </h1>
                <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-md mx-auto">
                  {isRTL 
                    ? 'أنت على وشك بدء رحلة تعليمية ممتعة. استمتع بتعلم كل ما تحتاجه عن عالم الدراجات النارية.'
                    : "You're about to start an exciting learning journey. Enjoy mastering everything about the motorcycle world."}
                </p>
              </motion.div>

              {/* Course card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-card border-2 border-border rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" />
                    <span>{totalLessons} {isRTL ? 'درس' : 'lessons'}</span>
                  </div>
                  {totalQuizzes > 0 && (
                    <div className="flex items-center gap-1.5">
                      <ClipboardList className="w-4 h-4" />
                      <span>{totalQuizzes} {isRTL ? 'اختبار' : 'quizzes'}</span>
                    </div>
                  )}
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  {isRTL && course.title_ar ? course.title_ar : course.title}
                </h2>
              </motion.div>

              {/* Start button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                <Button
                  variant="cta"
                  className="w-full h-14 text-base font-bold rounded-2xl gap-2"
                  onClick={() => {
                    setShowWelcome(false);
                    // Clean up URL param
                    searchParams.delete('welcome');
                    setSearchParams(searchParams, { replace: true });
                  }}
                >
                  <Play className="w-5 h-5" />
                  {isRTL ? 'ابدأ الدرس الأول' : 'Start First Lesson'}
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enrollment Banner for non-enrolled users */}
      {!isEnrolled && (
        <div className="bg-gradient-to-r from-primary/90 to-primary text-primary-foreground py-3 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-center sm:text-start">
              <BookOpen className="w-5 h-5 hidden sm:block" />
              <p className="text-sm sm:text-base font-medium">
                {isRTL 
                  ? 'أنت تشاهد معاينة مجانية. سجل الآن للحصول على الوصول الكامل!'
                  : "You're watching a free preview. Enroll now for full access!"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="secondary"
                className="font-semibold"
                asChild
              >
                <Link to="/signup">
                  {isRTL ? 'سجل الآن' : 'Register Now'}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="h-14 sm:h-16 border-b border-border bg-card/80 backdrop-blur-xl flex items-center justify-between px-3 sm:px-4 lg:px-6 fixed top-0 left-0 right-0 z-50 safe-area-top">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden touch-target flex-shrink-0"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          
          <Link to="/courses" className="flex items-center gap-2 flex-shrink-0">
            <img src={bikerzLogo} alt="BIKERZ" className="h-8 sm:h-10"  loading="lazy" />
          </Link>
          
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground min-w-0">
            <span>/</span>
            <span className="text-foreground font-medium truncate max-w-[200px]">
              {isRTL && course.title_ar ? course.title_ar : course.title}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">
              {progressPercentage}%
            </span>
            <Progress value={progressPercentage} className="w-16 sm:w-24 h-2" />
          </div>
          
          <Button variant="outline" size="sm" asChild className="hidden sm:flex">
            <Link to={`/courses/${id}`}>
              {isRTL ? 'تفاصيل الدورة' : 'Course Details'}
            </Link>
          </Button>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-14 sm:h-16 flex-shrink-0" />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content - scrolls independently, leaves space for fixed sidebar on desktop */}
        <main className={`flex-1 overflow-auto ${isRTL ? 'lg:me-80' : 'lg:me-80'}`}>
          <AnimatePresence mode="wait">
            {showTest && testChapter?.test ? (
              <motion.div
                key="test"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-4 sm:p-6 lg:p-8"
              >
                <ChapterTest
                  testId={testChapter.test.id}
                  chapterTitle={isRTL && testChapter.title_ar ? testChapter.title_ar : testChapter.title}
                  onComplete={() => {
                    setShowTest(null);
                    queryClient.invalidateQueries({ queryKey: ['test-attempts'] });
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
                {/* Video Player - Compact size */}
                {currentLesson?.video_url && (
                  <div className="relative bg-black w-full aspect-video">
                    {/* Next Lesson Countdown - overlay on video */}
                    <AnimatePresence>
                      {showNextCountdown && nextLesson && (
                        <NextLessonCountdown
                          nextLessonTitle={isRTL && nextLesson.title_ar ? nextLesson.title_ar : nextLesson.title}
                          onGoToNext={() => goToLesson(nextLesson.id, true)}
                          onDismiss={() => setShowNextCountdown(false)}
                        />
                      )}
                    </AnimatePresence>
                    {isYouTubeUrl(currentLesson.video_url) ? (
                      <div className="aspect-video">
                        <iframe
                          src={`https://www.youtube.com/embed/${getYouTubeVideoId(currentLesson.video_url)}?rel=0&modestbranding=1`}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                          title={currentLesson.title}
                        />
                      </div>
                    ) : (currentLesson.video_provider === 'bunny' || 
                         currentLesson.video_url?.includes('b-cdn.net') || 
                         currentLesson.video_url?.includes('mediadelivery.net')) ? (
                      <BunnyVideoEmbed
                        key={currentLesson.id}
                        videoUrl={currentLesson.video_url}
                        title={isRTL && currentLesson.title_ar ? currentLesson.title_ar : currentLesson.title}
                        initialTime={initialTimeRef.current}
                        autoPlay={autoPlayNext}
                        onTimeUpdate={(time) => handleWatchTimeUpdate(currentLesson.id, time)}
                        onProgress={handleVideoProgress}
                        onEnded={handleVideoEnded}
                        lessonId={currentLesson.id}
                        courseId={id}
                      />
                    ) : (
                      <div ref={videoContainerRef} className="w-full h-full">
                        <VideoPlayer
                          key={currentLesson.id}
                          src={currentLesson.video_url}
                          title={isRTL && currentLesson.title_ar ? currentLesson.title_ar : currentLesson.title}
                          initialTime={initialTimeRef.current}
                          onTimeUpdate={(time) => handleWatchTimeUpdate(currentLesson.id, time)}
                          onProgress={handleVideoProgress}
                          onEnded={handleVideoEnded}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Lesson Content */}
                <div className="p-4 sm:p-6 lg:p-8 safe-area-bottom">
                  {/* Lesson Title & Chapter */}
                  <div className="flex flex-col gap-4 mb-6">
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm text-primary font-medium">
                        {currentChapter && (isRTL && currentChapter.title_ar ? currentChapter.title_ar : currentChapter.title)}
                      </span>
                      <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground mt-1">
                        {currentLesson && (isRTL && currentLesson.title_ar ? currentLesson.title_ar : currentLesson.title)}
                      </h1>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      {currentLesson && !isLessonCompleted(currentLesson.id) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => completeLessonMutation.mutate(currentLesson.id)}
                          disabled={completeLessonMutation.isPending}
                          className="h-10 sm:h-9"
                        >
                          <CheckCircle2 className="w-4 h-4 me-2" />
                          {isRTL ? 'وضع علامة مكتمل' : 'Mark Complete'}
                        </Button>
                      )}
                      
                      {currentLesson && isLessonCompleted(currentLesson.id) && (
                        <div className="flex items-center gap-2 text-primary">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="font-medium text-sm sm:text-base">{isRTL ? 'مكتمل' : 'Completed'}</span>
                        </div>
                      )}

                      {/* Mobile sidebar toggle */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSidebarOpen(true)}
                        className="lg:hidden h-10 sm:h-9 ms-auto"
                      >
                        <BookOpen className="w-4 h-4 me-2" />
                        {isRTL ? 'المحتوى' : 'Content'}
                      </Button>
                    </div>
                  </div>

                  {/* Description */}
                  {currentLesson?.description && (
                    <div 
                      className="prose prose-invert max-w-none mb-6 sm:mb-8 text-sm sm:text-base text-muted-foreground"
                      dangerouslySetInnerHTML={{ 
                        __html: isRTL && currentLesson.description_ar 
                          ? currentLesson.description_ar 
                          : currentLesson.description 
                      }}
                    />
                  )}

                  {/* Lesson Quiz - Interactive questions embedded in the lesson */}
                  {currentLesson && (
                    <div className="mb-6 sm:mb-8">
                      <LessonQuiz
                        lessonId={currentLesson.id}
                        isQuizOnlyLesson={!currentLesson.video_url}
                        onComplete={(totalXp) => {
                          if (totalXp > 0) {
                            toast.success(isRTL ? `أحسنت! حصلت على ${totalXp} نقطة XP` : `Great job! You earned ${totalXp} XP`);
                          }
                        }}
                      />
                    </div>
                  )}

                  {/* Coach-like reinforcement suggestion - non-intrusive */}
                  {user && currentLesson && currentChapter && (
                    <ReinforcementSuggestion
                      lessonId={currentLesson.id}
                      chapterId={currentChapter.id}
                      variant="card"
                      className="mb-6 sm:mb-8"
                    />
                  )}

                  {/* Resources */}
                  {resources.length > 0 && (
                    <div className="mb-6 sm:mb-8">
                      <h3 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">
                        {isRTL ? 'الموارد' : 'Resources'}
                      </h3>
                      <div className="grid gap-2">
                        {resources.map((resource) => (
                          <a
                            key={resource.id}
                            href={resource.resource_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors touch-target"
                          >
                            <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                            <span className="text-sm sm:text-base text-foreground truncate">{resource.title}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Take Quiz CTA - appears when all chapter lessons are completed */}
                  {currentChapter?.test && isChapterComplete(currentChapter) && !isTestPassed(currentChapter.test.id) && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-6 sm:mb-8 p-4 sm:p-6 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20"
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/20">
                          <ClipboardList className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-foreground mb-1">
                            {isRTL ? 'جاهز للاختبار!' : 'Ready for the Quiz!'}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {isRTL 
                              ? `أكملت جميع دروس هذا الفصل. اختبر معلوماتك الآن!`
                              : `You've completed all lessons in this chapter. Test your knowledge now!`}
                          </p>
                        </div>
                        <Button 
                          onClick={() => setShowTest(currentChapter.id)} 
                          className="btn-cta h-11 w-full sm:w-auto"
                        >
                          <Trophy className="w-4 h-4 me-2" />
                          {isRTL ? 'ابدأ الاختبار' : 'Take Quiz'}
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* Quiz Retake CTA - appears when quiz was attempted but not passed */}
                  {currentChapter?.test && hasAttemptedTest(currentChapter.test.id) && !isTestPassed(currentChapter.test.id) && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-6 sm:mb-8 p-4 sm:p-6 rounded-xl bg-gradient-to-r from-destructive/10 via-destructive/5 to-transparent border border-destructive/20"
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/20">
                          <AlertCircle className="w-6 h-6 text-destructive" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-foreground mb-1">
                            {isRTL ? 'حاول مرة أخرى!' : 'Try Again!'}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {isRTL 
                              ? `نتيجتك الأخيرة: ${getLastTestScore(currentChapter.test.id)}%. راجع الدروس وحاول مرة أخرى.`
                              : `Your last score: ${getLastTestScore(currentChapter.test.id)}%. Review the lessons and try again.`}
                          </p>
                        </div>
                        <Button 
                          onClick={() => setShowTest(currentChapter.id)} 
                          variant="destructive"
                          className="h-11 w-full sm:w-auto"
                        >
                          <ClipboardList className="w-4 h-4 me-2" />
                          {isRTL ? 'إعادة الاختبار' : 'Retake Quiz'}
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* Navigation */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-6 border-t border-border">
                    {prevLesson ? (
                      <Button variant="outline" onClick={() => goToLesson(prevLesson.id)} className="h-11 sm:h-10 order-2 sm:order-1">
                        <BackIcon className="w-4 h-4 me-2" />
                        <span className="truncate">{isRTL ? 'الدرس السابق' : 'Previous'}</span>
                      </Button>
                    ) : (
                      <div className="hidden sm:block" />
                    )}
                    
                    {nextLesson ? (() => {
                      const nextChapter = chapters.find(ch => ch.lessons.some(l => l.id === nextLesson.id));
                      const nextLocked = nextChapter ? isLessonLocked(nextLesson, nextChapter) : false;
                      return nextLocked ? (
                        <Button variant="outline" disabled className="h-11 sm:h-10 order-1 sm:order-2 opacity-50">
                          <Lock className="w-4 h-4 me-2" />
                          <span className="truncate">{isRTL ? 'الدرس التالي مقفل' : 'Next Lesson Locked'}</span>
                        </Button>
                      ) : (
                        <Button onClick={() => goToLesson(nextLesson.id)} className="h-11 sm:h-10 order-1 sm:order-2">
                          <span className="truncate">{isRTL ? 'الدرس التالي' : 'Next'}</span>
                          <ForwardIcon className="w-4 h-4 ms-2" />
                        </Button>
                      );
                    })()
                     : currentChapter?.test && isChapterComplete(currentChapter) ? (
                      <Button onClick={() => setShowTest(currentChapter.id)} className="btn-cta h-11 sm:h-10 order-1 sm:order-2">
                        <ClipboardList className="w-4 h-4 me-2" />
                        {isRTL ? 'ابدأ الاختبار' : 'Take Test'}
                      </Button>
                    ) : (
                      <Button disabled className="h-11 sm:h-10 order-1 sm:order-2">
                        <Trophy className="w-4 h-4 me-2" />
                        {isRTL ? 'أكمل الدورة' : 'Course Complete'}
                      </Button>
                    )}
                  </div>

                  {/* Lesson Discussion / Q&A Section */}
                  {currentLesson && (
                    <LessonDiscussion 
                      lessonId={currentLesson.id}
                      lessonTitle={isRTL && currentLesson.title_ar ? currentLesson.title_ar : currentLesson.title}
                    />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Sidebar - Fixed on desktop like Udemy, slide-in drawer on mobile */}
        <aside
          className={`fixed top-14 sm:top-16 bottom-0 w-[300px] sm:w-80 max-w-[85vw] bg-card border-s border-border transform transition-transform duration-300 ease-out z-50 lg:z-40 ${
            sidebarOpen ? 'translate-x-0' : isRTL ? '-translate-x-full lg:translate-x-0' : 'translate-x-full lg:translate-x-0'
          } ${isRTL ? 'left-0' : 'right-0'}`}
        >
          <ScrollArea className="h-full">
            <div className="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm sm:text-base text-foreground">
                  {isRTL ? 'محتوى الدورة' : 'Course Content'}
                </h2>
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {completedLessons}/{totalLessons}
                </span>
              </div>

              {/* Quiz Progress Indicator */}
              {totalQuizzes > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-primary" />
                      <span className="text-xs sm:text-sm font-medium text-foreground">
                        {isRTL ? 'تقدم الاختبارات' : 'Quiz Progress'}
                      </span>
                    </div>
                    <span className={`text-xs sm:text-sm font-bold ${passedQuizzes === totalQuizzes ? 'text-primary' : 'text-muted-foreground'}`}>
                      {passedQuizzes}/{totalQuizzes}
                    </span>
                  </div>
                  <Progress 
                    value={totalQuizzes > 0 ? (passedQuizzes / totalQuizzes) * 100 : 0} 
                    className="h-2" 
                  />
                  {passedQuizzes === totalQuizzes && totalQuizzes > 0 && (
                    <p className="text-xs text-primary mt-2 font-medium">
                      {isRTL ? '🎉 أكملت جميع الاختبارات!' : '🎉 All quizzes completed!'}
                    </p>
                  )}
                </div>
              )}

              <Accordion type="multiple" defaultValue={chapters.map(c => c.id)} className="space-y-2">
                {chapters.map((chapter, chapterIndex) => (
                  <AccordionItem
                    key={chapter.id}
                    value={chapter.id}
                    className="border border-border/50 rounded-lg overflow-hidden"
                  >
                    <AccordionTrigger className="px-3 sm:px-4 py-3 hover:no-underline hover:bg-muted/30 text-xs sm:text-sm">
                      <div className="flex items-center gap-2 sm:gap-3 text-start min-w-0">
                        <span className={`flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isChapterComplete(chapter) 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {isChapterComplete(chapter) ? (
                            <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" />
                          ) : (
                            chapterIndex + 1
                          )}
                        </span>
                        <span className="font-medium text-foreground break-words line-clamp-2">
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
                              className={`w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 text-start text-xs sm:text-sm transition-colors touch-target ${
                                isActive 
                                  ? 'bg-primary/10 border-s-2 border-primary' 
                                  : locked 
                                    ? 'opacity-50 cursor-not-allowed' 
                                    : 'hover:bg-muted/50 active:bg-muted/70'
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
                              <span className={`flex-1 break-words line-clamp-2 ${isActive ? 'text-primary font-medium' : 'text-foreground'}`}>
                                {isRTL && lesson.title_ar ? lesson.title_ar : lesson.title}
                              </span>
                              {lesson.duration_minutes && (
                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                  {lesson.duration_minutes}m
                                </span>
                              )}
                            </button>
                          );
                        })}
                        
                        {/* Chapter Test */}
                        {chapter.test && (() => {
                          const testPassed = isTestPassed(chapter.test.id);
                          const canAccess = canAccessTest(chapter, chapterIndex);
                          const lastScore = getLastTestScore(chapter.test.id);
                          const hasFailed = hasAttemptedTest(chapter.test.id) && !testPassed;
                          const requiredQuizName = !canAccess ? getRequiredQuizName(chapterIndex) : null;

                          const testButton = (
                            <button
                              onClick={() => canAccess && setShowTest(chapter.id)}
                              disabled={!canAccess}
                              className={`w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 text-start text-xs sm:text-sm transition-colors border-t border-border/30 touch-target ${
                                !canAccess
                                  ? 'opacity-50 cursor-not-allowed'
                                  : showTest === chapter.id
                                    ? 'bg-primary/10 border-s-2 border-primary'
                                    : hasFailed
                                      ? 'hover:bg-destructive/10 active:bg-destructive/20'
                                      : 'hover:bg-muted/50 active:bg-muted/70'
                              }`}
                            >
                              <div className="flex-shrink-0">
                                {testPassed ? (
                                  <Trophy className="w-4 h-4 text-primary" />
                                ) : hasFailed ? (
                                  <ClipboardList className="w-4 h-4 text-destructive" />
                                ) : !canAccess ? (
                                  <Lock className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ClipboardList className="w-4 h-4 text-primary" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className={`block truncate ${
                                  showTest === chapter.id ? 'text-primary font-medium' : 
                                  hasFailed ? 'text-destructive' : 'text-foreground'
                                }`}>
                                  {isRTL && chapter.test.title_ar ? chapter.test.title_ar : chapter.test.title}
                                </span>
                                {hasFailed && lastScore !== null && (
                                  <span className="text-xs text-destructive/80">
                                    {isRTL ? `آخر نتيجة: ${lastScore}% - حاول مرة أخرى` : `Last score: ${lastScore}% - Retry`}
                                  </span>
                                )}
                                {!canAccess && requiredQuizName && (
                                  <span className="text-xs text-muted-foreground block mt-0.5">
                                    {isRTL 
                                      ? `🔒 اجتز "${requiredQuizName}" أولاً`
                                      : `🔒 Pass "${requiredQuizName}" first`}
                                  </span>
                                )}
                              </div>
                              {testPassed ? (
                                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                              ) : hasFailed && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive flex-shrink-0">
                                  {isRTL ? 'إعادة' : 'Retry'}
                                </span>
                              )}
                            </button>
                          );

                          // Wrap locked quizzes in a tooltip for additional context
                          if (!canAccess && requiredQuizName) {
                            return (
                              <TooltipProvider key={chapter.test.id}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    {testButton}
                                  </TooltipTrigger>
                                  <TooltipContent side={isRTL ? 'left' : 'right'} className="max-w-[250px]">
                                    <p className="text-sm">
                                      {isRTL 
                                        ? `يجب اجتياز "${requiredQuizName}" لفتح هذا الاختبار`
                                        : `You must pass "${requiredQuizName}" to unlock this quiz`}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          }

                          return testButton;
                        })()}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </ScrollArea>
        </aside>
      </div>

      {/* Review Prompt Modal */}
      {course && isEnrolled && user && (
        <ReviewPromptModal
          courseId={course.id}
          progressPercentage={progressPercentage}
          isEnrolled={isEnrolled}
        />
      )}

      {/* Purchase Encouragement Modal */}
      {course && !isEnrolled && (
        <PurchaseEncouragementModal
          open={showPurchaseModal}
          onClose={() => setShowPurchaseModal(false)}
          onBuyNow={() => {
            setShowPurchaseModal(false);
            if (user) {
              setShowCheckout(true);
            } else {
              navigate('/login', { state: { from: `/courses/${id}` } });
            }
          }}
          course={{
            title: course.title,
            title_ar: course.title_ar,
            thumbnail_url: course.thumbnail_url,
            price: course.price,
            discount_percentage: course.discount_percentage,
          }}
          
        />
      )}

      {/* Checkout Modal */}
      {course && (
        <CheckoutModal
          open={showCheckout}
          onOpenChange={setShowCheckout}
          course={{
            id: course.id,
            title: course.title,
            title_ar: course.title_ar,
            price: course.price,
            discount_percentage: course.discount_percentage,
            thumbnail_url: course.thumbnail_url,
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['enrollment-learn', id, user?.id] });
            navigate(`/payment-success?course=${id}&tap_id=free_enrollment`);
          }}
        />
      )}

    </div>
  );
};

export default CourseLearn;
