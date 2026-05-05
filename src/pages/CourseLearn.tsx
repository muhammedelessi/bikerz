import React, { useState, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { useParams, useSearchParams } from 'react-router-dom';
import { useLocalizedNavigate } from '@/hooks/useLocalizedNavigate';
import LocalizedLink from '@/components/common/LocalizedLink';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useGamification } from '@/hooks/useGamification';
import { useIsMobile } from '@/hooks/use-mobile';

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
import logoDark from '@/assets/logo-dark.webp';
import logoLight from '@/assets/logo-light.png';
import { useTheme } from '@/components/ThemeProvider';
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
import GuestPreviewSoftGate from '@/components/course/GuestPreviewSoftGate';
import GuestPreviewHardGate from '@/components/course/GuestPreviewHardGate';
import {
  getGuestPreviewState,
  getActiveFreeTrial,
  setGuestPreviewState,
  checkGuestPreviewOnServer,
  recordGuestPreviewOnServer,
  markTrialOfferPending,
  type GuestPreviewState
} from '@/lib/guestPreview';
import { setReturnUrl, setSignupOrigin } from '@/lib/authReturnUrl';

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
  const navigate = useLocalizedNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { getCoursePriceInfo, getCurrencySymbol } = useCurrency();
  const { user } = useAuth();
  const { checkBadges, gamificationData, addXP } = useGamification();
  const { theme } = useTheme();
  const themeLogo = theme === 'light' ? logoDark : logoLight;
  const queryClient = useQueryClient();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(urlLessonId || null);
  const [showTest, setShowTest] = useState<string | null>(null);
  const [showNextCountdown, setShowNextCountdown] = useState(false);
  const [autoPlayNext, setAutoPlayNext] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => searchParams.get('welcome') === '1');
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const isMobileLearn = useIsMobile();
  /** Desktop: navigate to /checkout/:id page. Mobile: open the existing drawer modal. */
  const openCheckoutFromLearn = useCallback(() => {
    if (isMobileLearn) {
      setShowCheckout(true);
    } else if (id) {
      navigate(`/checkout/${id}?source=course_learn`);
    }
  }, [isMobileLearn, id, navigate]);
  const [guestPreview, setGuestPreview] = useState<GuestPreviewState | null>(null);
  const [showGuestSoftGate, setShowGuestSoftGate] = useState(false);
  const [guestSoftDismissed, setGuestSoftDismissed] = useState(false);
  const [showGuestHardGate, setShowGuestHardGate] = useState(false);
  const [isGuestBlockedByIpLimit, setIsGuestBlockedByIpLimit] = useState(false);
  const recordInFlightRef = React.useRef(false);
  const purchaseModalShownRef = React.useRef<Set<string>>(new Set());
  const autoCompletedRef = React.useRef<Set<string>>(new Set());
  const lessonProgressRef = React.useRef<LessonProgress[]>([]);
  const initialTimeRef = React.useRef<number>(0);
  const videoContainerRef = React.useRef<HTMLDivElement>(null);
  const mainScrollRef = React.useRef<HTMLElement | null>(null);

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

  useEffect(() => {
    if (user || !id) {
      setGuestPreview(null);
      setIsGuestBlockedByIpLimit(false);
      return;
    }

    let cancelled = false;

    const checkGuestAccess = async () => {
      const localState = getGuestPreviewState(id);
      if (localState) {
        if (!cancelled) setGuestPreview(localState);
        return;
      }

      const serverResult = await checkGuestPreviewOnServer(id);
      if (cancelled) return;

      if (!serverResult.allowed) {
        if (serverResult.reason === "ip_limit") {
          setIsGuestBlockedByIpLimit(true);
          return;
        }

        if (serverResult.video_id) {
          const nextState: GuestPreviewState = {
            watchedVideoId: serverResult.video_id,
            startedAt: serverResult.started_at || new Date().toISOString(),
          };
          setGuestPreviewState(id, nextState);
          setGuestPreview(nextState);
        }
      }
    };

    checkGuestAccess();

    return () => {
      cancelled = true;
    };
  }, [user, id]);

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
            .from('lessons_public' as 'lessons')
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
            .from('lessons_public' as 'lessons')
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
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-progress-learn'] });
      toast.success(t('courseLearn.lessonCompleted'));
    
      // Award XP for completing a lesson
      await addXP({ amount: 20, sourceType: 'lesson_complete' });
    
      // Check lesson & XP badges
      const { data: completedLessons } = await supabase
        .from('lesson_progress')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('is_completed', true);
    
      checkBadges({
        lessonsCompleted: completedLessons?.length || 0,
        totalXP: (gamificationData?.total_xp || 0) + 20,
        streakDays: gamificationData?.current_streak || 1,
      });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : '';
      if (message === 'Not authenticated') {
        toast.error(t('courseLearn.loginRequired'));
        return;
      }
      toast.error(t('courseLearn.saveProgressFailed'));
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

    // Guest limiter: first free lesson is "used" after 10 seconds watched.
    if (!user && lessonId && timeSeconds >= 10 && id && !guestPreview && !recordInFlightRef.current) {
      recordInFlightRef.current = true;

      const nextState: GuestPreviewState = {
        watchedVideoId: lessonId,
        startedAt: new Date().toISOString(),
      };

      recordGuestPreviewOnServer(id, lessonId)
        .then((result) => {
          if (result.reason === "ip_limit") {
            setIsGuestBlockedByIpLimit(true);
            return;
          }

          setGuestPreviewState(id, nextState);
          setGuestPreview(nextState);
        })
        .finally(() => {
          recordInFlightRef.current = false;
        });
    }
  };

  // Improve UX on lesson change: scroll main content to top
  useEffect(() => {
    if (!currentLessonId) return;
    const el = mainScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentLessonId, showTest]);

  useEffect(() => {
    setShowGuestSoftGate(false);
    setGuestSoftDismissed(false);
    setShowGuestHardGate(false);
  }, [currentLessonId]);

  // Current lesson
  const currentLesson = chapters
    .flatMap(ch => ch.lessons)
    .find(l => l.id === currentLessonId);

  const currentChapter = chapters.find(ch => 
    ch.lessons.some(l => l.id === currentLessonId)
  );
  const isGuestTrackedPreviewLesson =
    !user &&
    !!guestPreview &&
    !!currentLesson &&
    currentLesson.is_free &&
    currentLesson.id === guestPreview.watchedVideoId;
  const hardGatePriceInfo = course
    ? getCoursePriceInfo(course.id, course.price, course.discount_percentage || 0)
    : null;
  const hardGateCurrencySymbol = hardGatePriceInfo ? getCurrencySymbol(hardGatePriceInfo.currency, isRTL) : "";

  // Chapter for the currently shown test (may differ from currentChapter)
  const testChapter = showTest ? chapters.find(ch => ch.id === showTest) : null;

  // Calculate progress
  const totalLessons = chapters.reduce((acc, ch) => acc + ch.lessons.length, 0);
  const completedLessons = lessonProgress.filter(lp => lp.is_completed).length;
  const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const allLessons = chapters.flatMap(ch => ch.lessons);

  const isEnrolled = !!enrollment;
  const isLoading = courseLoading || chaptersLoading || enrollmentLoading;
  const activeTrial = user ? getActiveFreeTrial() : null;
  const firstFullLesson = allLessons.find((lesson) => !lesson.is_free) || null;
  const has24hTrialAccess =
    !!user &&
    !!activeTrial &&
    activeTrial.free_trial_course_id === id &&
    !!firstFullLesson &&
    currentLessonId === firstFullLesson.id;

  const isLessonCompleted = (lessonId: string) => {
    return lessonProgress.some(lp => lp.lesson_id === lessonId && lp.is_completed);
  };

  const isLessonLocked = useCallback(
    (lesson: Lesson, _chapter: Chapter) => {
      if (!isEnrolled && !lesson.is_free) {
        if (has24hTrialAccess && firstFullLesson?.id === lesson.id) {
          return false;
        }
        return true;
      }
      if (!user && lesson.is_free && isGuestBlockedByIpLimit) {
        return true;
      }
      if (!user && lesson.is_free && guestPreview) {
        return guestPreview.watchedVideoId !== lesson.id;
      }
      return false;
    },
    [isEnrolled, user, guestPreview, isGuestBlockedByIpLimit, has24hTrialAccess, firstFullLesson],
  );

  const currentLessonLocked =
    !!currentLesson && !!currentChapter && isLessonLocked(currentLesson, currentChapter);

  // Set lesson from URL or first accessible lesson — block paywalled deep links (direct URL / in-app browsers)
  useEffect(() => {
    if (chapters.length === 0 || !id) return;

    const chapterForLesson = (lessonId: string) =>
      chapters.find((ch) => ch.lessons.some((l) => l.id === lessonId));
    const lessonById = (lessonId: string) =>
      chapters.flatMap((ch) => ch.lessons).find((l) => l.id === lessonId);

    const firstAccessibleLesson = (): Lesson | null => {
      for (const ch of chapters) {
        for (const l of ch.lessons) {
          if (!isLessonLocked(l, ch)) return l;
        }
      }
      return null;
    };

    if (urlLessonId) {
      const lesson = lessonById(urlLessonId);
      const ch = chapterForLesson(urlLessonId);
      if (lesson && ch) {
        if (isLessonLocked(lesson, ch)) {
          const alt = firstAccessibleLesson();
          if (alt) {
            setCurrentLessonId(alt.id);
            navigate(`/courses/${id}/lessons/${alt.id}`, { replace: true });
          } else {
            navigate(`/courses/${id}`, { replace: true });
          }
          return;
        }
        if (currentLessonId !== urlLessonId) {
          setCurrentLessonId(urlLessonId);
        }
        return;
      }
    }

    if (!currentLessonId) {
      const alt = firstAccessibleLesson();
      if (alt) {
        setCurrentLessonId(alt.id);
        navigate(`/courses/${id}/lessons/${alt.id}`, { replace: true });
      }
    }
  }, [chapters, urlLessonId, currentLessonId, id, navigate, isLessonLocked]);

  // Navigation
  const currentIndex = allLessons.findIndex(l => l.id === currentLessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  const goToLesson = (lessonId: string, autoPlay = false) => {
    const targetLesson = allLessons.find(l => l.id === lessonId);
    const targetChapter = chapters.find(ch => ch.lessons.some(l => l.id === lessonId));
    if (targetLesson && targetChapter && isLessonLocked(targetLesson, targetChapter)) {
      toast.error(t('courseLearn.purchaseRequired'));
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
      if (!user) {
        toast.error(t('courseLearn.loginRequired'));
      } else {
        completeLessonMutation.mutate(currentLessonId);
      }
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
  }, [currentLessonId, nextLesson, chapters, isEnrolled, course, user, t]);

  // Track video progress (watch time only, no auto-complete)
  const handleVideoProgress = useCallback((_progress: number) => {
    // Progress tracking only — completion is handled in handleVideoEnded
  }, []);

  const handleGuestPreviewProgress = useCallback((progress: number) => {
    if (!isGuestTrackedPreviewLesson || guestSoftDismissed || showGuestHardGate) return;
    if (progress >= 85) {
      setShowGuestSoftGate(true);
    }
  }, [isGuestTrackedPreviewLesson, guestSoftDismissed, showGuestHardGate]);

  const handleGuestPreviewEnded = useCallback(() => {
    if (!isGuestTrackedPreviewLesson) return;
    setShowGuestSoftGate(false);
    setShowGuestHardGate(true);
  }, [isGuestTrackedPreviewLesson]);

  const handleGuestCreateAccount = useCallback(() => {
    if (!id) return;
    setReturnUrl(`/courses/${id}`);
    markTrialOfferPending(id);
    // Tag as course_page — the user is already engaged with this
    // course's content (free preview), so this is high-intent.
    setSignupOrigin("course_page");
    navigate('/signup');
  }, [id, navigate]);

  const handleGuestLogin = useCallback(() => {
    if (!id) return;
    setReturnUrl(`/courses/${id}`);
    navigate('/login');
  }, [id, navigate]);

  const handleGuestBuyCourse = useCallback(() => {
    if (!id) return;
    setReturnUrl(`/courses/${id}?checkout=true`);
    // NOT tagged as "course_page" — that label is reserved for the
    // post-free-preview "create account to keep watching" CTA per spec.
    // Buy-course click is its own intent signal that GHL tracks via
    // checkout/payment webhooks, not the signup webhook.
    navigate('/signup');
  }, [id, navigate]);

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
            {t('courses.courseNotFound')}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-6">
            {t('courses.courseNotFoundDescription')}
          </p>
          <Button asChild className="h-11">
            <LocalizedLink to="/courses">
              <BackIcon className="w-4 h-4 me-2" />
              {t('courses.backToCourses')}
            </LocalizedLink>
          </Button>
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <ScrollArea className="h-full">
      <div className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm sm:text-base text-foreground">
            {t('courses.courseContent')}
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
                  {t('courseLearn.quizProgress')}
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
                {t('courseLearn.allQuizzesCompleted')}
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
                              {t('courseLearn.lastScoreRetry', { score: lastScore })}
                            </span>
                          )}
                          {!canAccess && requiredQuizName && (
                            <span className="text-xs text-muted-foreground block mt-0.5">
                                {t('courseLearn.passFirst', { name: requiredQuizName })}
                            </span>
                          )}
                        </div>
                        {testPassed ? (
                          <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                        ) : hasFailed && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive flex-shrink-0">
                            {t('courseLearn.retry')}
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
                                  {t('courseLearn.mustPassToUnlock', { name: requiredQuizName })}
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
  );

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
                src={themeLogo}
                alt="Bikerz"
                className="h-6 sm:h-7 mx-auto"
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
                  {t('courseLearn.welcomeMessage')}
                </h1>
                <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-md mx-auto">
                  {t('courseLearn.welcomeDescription')}
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
                    <span>{totalLessons} {t('courseLearn.lessonsCount')}</span>
                  </div>
                  {totalQuizzes > 0 && (
                    <div className="flex items-center gap-1.5">
                      <ClipboardList className="w-4 h-4" />
                      <span>{totalQuizzes} {t('courseLearn.quizzesCount')}</span>
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
                  {t('courseLearn.startFirstLesson')}
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
                {t('courseLearn.freePreviewMessage')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="font-semibold"
                onClick={() => {
                  setReturnUrl(`/courses/${id}`);
                  navigate("/signup");
                }}
              >
                {t('courseLearn.registerNow')}
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
          
          <LocalizedLink to="/courses" className="flex items-center gap-2 flex-shrink-0">
              <img
                src={themeLogo}
                alt="BIKERZ"
                className="h-6 sm:h-7 lg:h-8 w-auto object-contain"
                loading="eager"
                decoding="async"
              />
          </LocalizedLink>
          
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
            <LocalizedLink to={`/courses/${id}`}>
              {t('courseLearn.courseDetails')}
            </LocalizedLink>
          </Button>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-14 sm:h-16 flex-shrink-0" />

      <div className="flex flex-1 overflow-hidden relative lg:grid lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content - scrolls independently, leaves space for fixed sidebar on desktop */}
        <main ref={(node) => { mainScrollRef.current = node; }} className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            {showTest && testChapter?.test ? (
              <motion.div
                key="test"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-4 sm:p-6 lg:p-8"
              >
                <div className="mx-auto w-full max-w-5xl">
                  <ChapterTest
                    testId={testChapter.test.id}
                    chapterTitle={isRTL && testChapter.title_ar ? testChapter.title_ar : testChapter.title}
                    onComplete={() => {
                      setShowTest(null);
                      queryClient.invalidateQueries({ queryKey: ['test-attempts'] });
                      toast.success(t('courseLearn.testCompleted'));
                    }}
                    onBack={() => setShowTest(null)}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="lesson"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="mx-auto w-full max-w-5xl">
                  {/* Video Player — never render paywalled media (URL deep-link bypass defense) */}
                  {currentLessonLocked && (
                    <div className="relative bg-muted w-full aspect-video sm:rounded-2xl overflow-hidden sm:mt-6 sm:mx-6 lg:mx-8 flex flex-col items-center justify-center gap-4 p-6 text-center border border-border">
                      <Lock className="w-12 h-12 text-muted-foreground" aria-hidden />
                      <p className="text-sm sm:text-base font-medium text-foreground max-w-md">
                        {t("courseLearn.purchaseRequired")}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button variant="cta" asChild>
                          <LocalizedLink to={`/courses/${id}`}>{t("courseLearn.courseDetails")}</LocalizedLink>
                        </Button>
                        {!user ? (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setReturnUrl(`/courses/${id}`);
                              navigate("/signup");
                            }}
                          >
                            {t("courseLearn.registerNow")}
                          </Button>
                        ) : (
                          <Button variant="outline" asChild>
                            <LocalizedLink to={`/courses/${id}?checkout=true`}>{t("courseLearn.requiresEnrollment")}</LocalizedLink>
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  {currentLesson?.video_url && !currentLessonLocked && (
                    <div className="relative bg-black w-full aspect-video sm:rounded-2xl overflow-hidden sm:mt-6 sm:mx-6 lg:mx-8">
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
                        onProgress={(progress) => {
                          handleVideoProgress(progress);
                          handleGuestPreviewProgress(progress);
                        }}
                        onEnded={() => {
                          handleVideoEnded();
                          handleGuestPreviewEnded();
                        }}
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
                          onProgress={(progress) => {
                            handleVideoProgress(progress);
                            handleGuestPreviewProgress(progress);
                          }}
                          onEnded={() => {
                            handleVideoEnded();
                            handleGuestPreviewEnded();
                          }}
                        />
                      </div>
                    )}
                    <GuestPreviewSoftGate
                      open={showGuestSoftGate && isGuestTrackedPreviewLesson}
                      isRTL={isRTL}
                      onContinueWatching={() => {
                        setShowGuestSoftGate(false);
                        setGuestSoftDismissed(true);
                      }}
                      onCreateAccount={handleGuestCreateAccount}
                    />
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
                      {currentLesson && !currentLessonLocked && !isLessonCompleted(currentLesson.id) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (!user) {
                              toast.error(t('courseLearn.loginRequired'));
                              return;
                            }
                            completeLessonMutation.mutate(currentLesson.id);
                          }}
                          disabled={completeLessonMutation.isPending}
                          className="h-10 sm:h-9"
                        >
                          <CheckCircle2 className="w-4 h-4 me-2" />
                          {t('courseLearn.markComplete')}
                        </Button>
                      )}
                      
                      {currentLesson && !currentLessonLocked && isLessonCompleted(currentLesson.id) && (
                        <div className="flex items-center gap-2 text-primary">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="font-medium text-sm sm:text-base">{t('courseLearn.completed')}</span>
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
                        {t('courseLearn.content')}
                      </Button>
                    </div>
                  </div>

                  {/* Description */}
                  {currentLesson?.description && !currentLessonLocked && (
                    <div 
                      className="prose dark:prose-invert max-w-none mb-6 sm:mb-8 text-sm sm:text-base text-muted-foreground"
                      dangerouslySetInnerHTML={{ 
                        __html: DOMPurify.sanitize(
                          isRTL && currentLesson.description_ar 
                            ? currentLesson.description_ar 
                            : currentLesson.description ?? ''
                        )
                      }}
                    />
                  )}

                  {/* Lesson Quiz - Interactive questions embedded in the lesson */}
                  {currentLesson && !currentLessonLocked && (
                    <div className="mb-6 sm:mb-8">
                      <LessonQuiz
                        lessonId={currentLesson.id}
                        isQuizOnlyLesson={!currentLesson.video_url}
                        onComplete={() => {}}
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
                  {resources.length > 0 && !currentLessonLocked && (
                    <div className="mb-6 sm:mb-8">
                      <h3 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">
                        {t('courseLearn.resourcesTab')}
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
                  {currentChapter?.test && !currentLessonLocked && isChapterComplete(currentChapter) && !isTestPassed(currentChapter.test.id) && (
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
                            {t('courseLearn.readyForQuiz')}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {t('courseLearn.readyForQuizDescription')}
                          </p>
                        </div>
                        <Button 
                          onClick={() => setShowTest(currentChapter.id)} 
                          className="btn-cta h-11 w-full sm:w-auto"
                        >
                          <Trophy className="w-4 h-4 me-2" />
                          {t('courseLearn.takeQuiz')}
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* Quiz Retake CTA - appears when quiz was attempted but not passed */}
                  {currentChapter?.test && !currentLessonLocked && hasAttemptedTest(currentChapter.test.id) && !isTestPassed(currentChapter.test.id) && (
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
                            {t('courseLearn.tryAgain')}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {t('courseLearn.lastScore', { score: getLastTestScore(currentChapter.test.id) })}
                          </p>
                        </div>
                        <Button 
                          onClick={() => setShowTest(currentChapter.id)} 
                          variant="destructive"
                          className="h-11 w-full sm:w-auto"
                        >
                          <ClipboardList className="w-4 h-4 me-2" />
                          {t('courseLearn.retakeTest')}
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* Navigation */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-6 border-t border-border">
                    {prevLesson ? (
                      <Button variant="outline" onClick={() => goToLesson(prevLesson.id)} className="h-11 sm:h-10 order-2 sm:order-1">
                        <BackIcon className="w-4 h-4 me-2" />
                        <span className="truncate">{t('courses.prevLesson')}</span>
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
                          <span className="truncate">{t('courseLearn.nextLessonLocked')}</span>
                        </Button>
                      ) : (
                        <Button onClick={() => goToLesson(nextLesson.id)} className="h-11 sm:h-10 order-1 sm:order-2">
                          <span className="truncate">{t('courses.nextLesson')}</span>
                          <ForwardIcon className="w-4 h-4 ms-2" />
                        </Button>
                      );
                    })()
                     : currentChapter?.test && isChapterComplete(currentChapter) ? (
                      <Button onClick={() => setShowTest(currentChapter.id)} className="btn-cta h-11 sm:h-10 order-1 sm:order-2">
                        <ClipboardList className="w-4 h-4 me-2" />
                        {t('courseLearn.takeTest')}
                      </Button>
                    ) : (
                      <Button disabled className="h-11 sm:h-10 order-1 sm:order-2">
                        <Trophy className="w-4 h-4 me-2" />
                        {t('courseLearn.courseComplete')}
                      </Button>
                    )}
                  </div>

                  {/* Lesson Discussion / Q&A Section */}
                  {currentLesson && !currentLessonLocked && (
                    <LessonDiscussion 
                      lessonId={currentLesson.id}
                      lessonTitle={isRTL && currentLesson.title_ar ? currentLesson.title_ar : currentLesson.title}
                    />
                  )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile sticky navigation (faster lesson switching) */}
          {!showTest && (
            <div className="sm:hidden sticky bottom-0 z-20 border-t border-border bg-background/90 backdrop-blur-xl safe-area-bottom">
              <div className="px-3 py-3 flex items-center gap-2">
                <Button
                  variant="outline"
                  className="h-11 flex-1"
                  disabled={!prevLesson}
                  onClick={() => prevLesson && goToLesson(prevLesson.id)}
                >
                  <BackIcon className="w-4 h-4 me-2" />
                  <span className="truncate">{t('courses.prevLesson')}</span>
                </Button>

                {nextLesson ? (() => {
                  const nextChapter = chapters.find(ch => ch.lessons.some(l => l.id === nextLesson.id));
                  const nextLocked = nextChapter ? isLessonLocked(nextLesson, nextChapter) : false;
                  return (
                    <Button
                      className="h-11 flex-1"
                      variant={nextLocked ? 'outline' : 'default'}
                      disabled={nextLocked}
                      onClick={() => !nextLocked && goToLesson(nextLesson.id)}
                    >
                      {nextLocked ? <Lock className="w-4 h-4 me-2" /> : null}
                      <span className="truncate">{nextLocked ? t('courseLearn.nextLessonLocked') : t('courses.nextLesson')}</span>
                      {!nextLocked ? <ForwardIcon className="w-4 h-4 ms-2" /> : null}
                    </Button>
                  );
                })() : (
                  <Button className="h-11 flex-1" disabled>
                    <Trophy className="w-4 h-4 me-2" />
                    <span className="truncate">{t('courseLearn.courseComplete')}</span>
                  </Button>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Desktop Sidebar - Udemy-like (always visible) */}
        <aside className="hidden lg:block border-s border-border bg-card">
          <div className="sticky top-16 h-[calc(100svh-4rem)]">
            {sidebarContent}
          </div>
        </aside>

        {/* Mobile Sidebar - slide-in drawer */}
        <aside
          className={`fixed top-14 sm:top-16 bottom-0 w-[300px] sm:w-80 max-w-[85vw] bg-card border-s border-border transform transition-transform duration-300 ease-out z-50 lg:hidden ${
            sidebarOpen ? 'translate-x-0' : isRTL ? '-translate-x-full' : 'translate-x-full'
          } ${isRTL ? 'left-0' : 'right-0'}`}
        >
          {sidebarContent}
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
              openCheckoutFromLearn();
            } else {
              navigate('/login', { state: { from: `/courses/${id}` } });
            }
          }}
          course={{
            id: course.id,
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
          visitSource="course_learn"
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

      {showGuestHardGate && isGuestTrackedPreviewLesson && (
        <GuestPreviewHardGate
          isRTL={isRTL}
          thumbnailUrl={course?.thumbnail_url}
          originalPriceText={String(hardGatePriceInfo?.originalPrice || "0")}
          finalPriceText={String(hardGatePriceInfo?.finalPrice || "0")}
          discountPercentage={course?.discount_percentage || 0}
          currencySymbol={hardGateCurrencySymbol}
          onCreateAccount={handleGuestCreateAccount}
          onBuyCourse={handleGuestBuyCourse}
          onLogin={handleGuestLogin}
        />
      )}

    </div>
  );
};

export default CourseLearn;
