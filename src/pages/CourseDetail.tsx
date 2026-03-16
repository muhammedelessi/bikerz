import React, { useState, useEffect, useMemo, useRef } from 'react';
import SEOHead from '@/components/common/SEOHead';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Play,
  Clock,
  BookOpen,
  CheckCircle2,
  Lock,
  ChevronLeft,
  ChevronRight,
  Video,
  AlertCircle,
  ShoppingCart,
  Target,
  Zap,
  Trophy,
  BarChart3,
  Users,
  ArrowRight,
  ArrowLeft,
  Layers,
  ClipboardList,
} from 'lucide-react';
import { toast } from 'sonner';
import heroImage from '@/assets/hero-rider.jpg';
import CheckoutModal from '@/components/checkout/CheckoutModal';
import GuestSignupModal from '@/components/checkout/GuestSignupModal';
import BunnyVideoEmbed from '@/components/course/BunnyVideoEmbed';
import PaymentMethodIcons from '@/components/checkout/PaymentMethodIcons';
import { trackViewContent } from '@/utils/metaPixel';
import CourseReviews from '@/components/course/CourseReviews';
import StarRating from '@/components/course/StarRating';


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
}

interface Course {
  id: string;
  title: string;
  title_ar: string | null;
  description: string | null;
  description_ar: string | null;
  thumbnail_url: string | null;
  preview_video_url: string | null;
  preview_video_thumbnail: string | null;
  price: number;
  discount_percentage: number | null;
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

const CourseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { formatPrice, convertPrice, formatCoursePrice, getCoursePrice, getCourseCurrency, getCoursePriceInfo } = useCurrency();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const ForwardIcon = isRTL ? ArrowLeft : ArrowRight;
  const [showCheckout, setShowCheckout] = useState(false);
  const [showGuestSignup, setShowGuestSignup] = useState(false);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [paymentVerifying, setPaymentVerifying] = useState(false);
  const [previewVideoPlaying, setPreviewVideoPlaying] = useState(false);
  const [showStickyBottom, setShowStickyBottom] = useState(false);
  const ctaCardRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Payment callback now handled by /payment-success/:courseId page


  // Scroll-based sticky header
  useEffect(() => {
    const handleScroll = () => {
      setShowStickyHeader(window.scrollY > 350);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch review stats (combines real + base)
  const { data: reviewStats } = useQuery({
    queryKey: ['course-review-stats', id],
    queryFn: async () => {
      const [{ data: reviews, error }, { data: courseData }] = await Promise.all([
        supabase.from('course_reviews').select('rating').eq('course_id', id!),
        supabase.from('courses').select('base_review_count, base_rating').eq('id', id!).single(),
      ]);
      if (error) throw error;
      const realCount = (reviews || []).length;
      const realAvg = realCount > 0 ? reviews!.reduce((s, r) => s + Number(r.rating), 0) / realCount : 0;
      const baseCount = (courseData as any)?.base_review_count || 0;
      const baseRating = Number((courseData as any)?.base_rating) || 0;
      const totalCount = realCount + baseCount;
      const combinedAvg = totalCount > 0
        ? ((realAvg * realCount) + (baseRating * baseCount)) / totalCount
        : 0;
      return { count: totalCount, avg: combinedAvg };
    },
    enabled: !!id,
  });


  // Fetch course details
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', id],
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

  // Fetch chapters with lessons
  const { data: chapters = [], isLoading: chaptersLoading } = useQuery({
    queryKey: ['chapters', id],
    queryFn: async () => {
      const { data: chaptersData, error: chaptersError } = await supabase
        .from('chapters')
        .select('*')
        .eq('course_id', id)
        .order('position', { ascending: true });
      if (chaptersError) throw chaptersError;

      const chaptersWithLessons = await Promise.all(
        (chaptersData || []).map(async (chapter) => {
          const { data: lessons, error: lessonsError } = await supabase
            .from('lessons')
            .select('*')
            .eq('chapter_id', chapter.id)
            .order('position', { ascending: true });
          if (lessonsError) throw lessonsError;
          return { ...chapter, lessons: lessons || [] } as Chapter;
        })
      );
      return chaptersWithLessons;
    },
    enabled: !!id,
  });

  // Fetch enrollment status
  const { data: enrollment } = useQuery({
    queryKey: ['enrollment', id, user?.id],
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
    queryKey: ['lesson-progress', id, user?.id],
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

  // Meta Pixel: ViewContent event
  useEffect(() => {
    if (course && id) {
      trackViewContent({
        content_name: course.title,
        content_ids: [id],
        content_type: 'product',
        value: course.price,
        currency: 'SAR',
      });
    }
  }, [course, id]);

  // IntersectionObserver for sticky bottom bar on mobile
  const ctaCardCallbackRef = React.useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    ctaCardRef.current = node;
    if (node) {
      observerRef.current = new IntersectionObserver(
        ([entry]) => setShowStickyBottom(!entry.isIntersecting),
        { threshold: 0.1 }
      );
      observerRef.current.observe(node);
    }
  }, []);

  // Enroll mutation
  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!user || !id) throw new Error('User not authenticated');
      const { data, error } = await supabase
        .from('course_enrollments')
        .insert({ user_id: user.id, course_id: id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment', id, user?.id] });
      navigate(`/payment-success?course=${id}&tap_id=free_enrollment`);
    },
    onError: (error: any) => {
      toast.error(error.message || (isRTL ? 'فشل التسجيل' : 'Failed to enroll'));
    },
  });

  // Calculations
  const totalLessons = chapters.reduce((acc, ch) => acc + ch.lessons.length, 0);
  const completedLessons = lessonProgress.filter(lp => lp.is_completed).length;
  const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const isEnrolled = !!enrollment;
  const isLoading = courseLoading || chaptersLoading;

  // Dynamic estimated completion time
  const totalDurationMinutes = useMemo(() => 
    chapters.reduce((acc, ch) => 
      acc + ch.lessons.reduce((la, l) => la + (l.duration_minutes || 5), 0), 0
    ), [chapters]);

  const remainingMinutes = useMemo(() => 
    chapters.reduce((acc, ch) => 
      acc + ch.lessons
        .filter(l => !lessonProgress.some(lp => lp.lesson_id === l.id && lp.is_completed))
        .reduce((la, l) => la + (l.duration_minutes || 5), 0), 0
    ), [chapters, lessonProgress]);

  const formatDuration = (mins: number) => {
    if (mins < 60) return isRTL ? `${mins} دقيقة` : `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return isRTL ? `${h} ساعة` : `${h}h`;
    return isRTL ? `${h} ساعة ${m} دقيقة` : `${h}h ${m}m`;
  };

  const isLessonCompleted = (lessonId: string) =>
    lessonProgress.some(lp => lp.lesson_id === lessonId && lp.is_completed);

  const getLessonState = (lessonId: string): 'completed' | 'in_progress' | 'not_started' => {
    const progress = lessonProgress.find(lp => lp.lesson_id === lessonId);
    if (!progress) return 'not_started';
    if (progress.is_completed) return 'completed';
    if ((progress.watch_time_seconds || 0) > 0) return 'in_progress';
    return 'not_started';
  };

  const isLessonLocked = (lesson: Lesson, _chapter: Chapter) => {
    if (!isEnrolled && !lesson.is_free) return true;
    return false;
  };

  // Chapter progress
  const getChapterProgress = (chapter: Chapter) => {
    if (chapter.lessons.length === 0) return 0;
    const completed = chapter.lessons.filter(l => isLessonCompleted(l.id)).length;
    return Math.round((completed / chapter.lessons.length) * 100);
  };

  const getChapterDuration = (chapter: Chapter) => 
    chapter.lessons.reduce((acc, l) => acc + (l.duration_minutes || 5), 0);

  // Smart resume: find the best lesson to continue from
  const resumeLesson = useMemo(() => {
    const allLessons = chapters.flatMap(ch => ch.lessons);
    // Priority 1: In-progress lesson (has watch time but not completed)
    const inProgress = allLessons.find(l => {
      const p = lessonProgress.find(lp => lp.lesson_id === l.id);
      return p && !p.is_completed && (p.watch_time_seconds || 0) > 0;
    });
    if (inProgress) return inProgress;
    // Priority 2: First not-started lesson
    const nextLesson = allLessons.find(l => !isLessonCompleted(l.id));
    return nextLesson || allLessons[0];
  }, [chapters, lessonProgress]);

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'intermediate': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'advanced': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-primary/20 text-primary border-primary/30';
    }
  };

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="section-container min-h-[60vh] flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {t('courses.courseNotFound')}
          </h2>
          <p className="text-muted-foreground mb-6">
            {t('courses.courseNotFoundDescription')}
          </p>
          <Link to="/courses">
            <Button variant="outline">
              <BackIcon className="w-4 h-4 me-2" />
              {t('courses.backToCourses')}
            </Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const courseTitle = isRTL && course.title_ar ? course.title_ar : course.title;
  const courseDescription = isRTL && course.description_ar ? course.description_ar : course.description;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={courseTitle || 'Course Details'}
        description={courseDescription?.substring(0, 160) || 'Explore this motorcycle riding course on BIKERZ Academy.'}
        canonical={`/courses/${id}`}
        ogType="article"
        ogImage={course.thumbnail_url || undefined}
        breadcrumbs={[{ name: 'Home', url: '/' }, { name: 'Courses', url: '/courses' }, { name: courseTitle || 'Course', url: `/courses/${id}` }]}
      />
      <Navbar />

      {/* Sticky Header — appears on scroll */}
      <AnimatePresence>
        {showStickyHeader && (
          <motion.header
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed top-0 inset-x-0 z-[60] bg-card/95 backdrop-blur-xl border-b border-border safe-area-top"
          >
            <div className="page-container h-16 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Link to="/courses" className="text-muted-foreground hover:text-foreground flex-shrink-0">
                  <BackIcon className="w-5 h-5" />
                </Link>
                <h1 className="text-sm sm:text-base font-semibold text-foreground truncate">
                  {courseTitle}
                </h1>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                {isEnrolled && (
                  <div className="hidden sm:flex items-center gap-2">
                    <Progress value={progressPercentage} className="w-20 h-2" />
                    <span className="text-xs text-muted-foreground font-medium">{progressPercentage}%</span>
                  </div>
                )}
                {isEnrolled && resumeLesson ? (
                  <Button size="sm" className="btn-cta h-9 text-sm" asChild>
                    <Link to={`/courses/${id}/lessons/${resumeLesson.id}`}>
                      <Play className="w-3.5 h-3.5 me-1.5" />
                      {isRTL ? 'أكمل التعلم' : 'Resume'}
                    </Link>
                  </Button>
                ) : !isEnrolled ? (
                  course.price === 0 ? (
                    user ? (
                      <Button size="sm" className="btn-cta h-9 text-sm" onClick={() => enrollMutation.mutate()} disabled={enrollMutation.isPending}>
                        {isRTL ? 'سجّل مجاناً' : 'Enroll Free'}
                      </Button>
                    ) : (
                      <Button size="sm" className="btn-cta h-9 text-sm" asChild>
                        <Link to={`/login?returnTo=${encodeURIComponent(window.location.pathname)}`}>
                          {isRTL ? 'سجّل مجاناً' : 'Enroll Free'}
                        </Link>
                      </Button>
                    )
                  ) : (
                    <Button size="sm" className="btn-cta h-9 text-sm" onClick={() => user ? setShowCheckout(true) : setShowGuestSignup(true)}>
                      {user ? (isRTL ? 'اشترِ الآن' : 'Buy Now') : (isRTL ? 'احصل على الدورة الآن' : 'Get the course now')}
                    </Button>
                  )
                ) : null}
              </div>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      <main className="pt-16 sm:pt-20 lg:pt-24">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          {/* Mobile: Full-width image block — clean, no overlays */}
          <div className="block lg:hidden">
            <div className="relative w-full bg-card">
              <img
                src={course.thumbnail_url || heroImage}
                alt={courseTitle}
                className="w-full h-auto block"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80" />
            </div>
          </div>

          {/* Desktop: Background image with overlay */}
          <div className="hidden lg:block absolute inset-0 h-[480px]">
            <img
              src={course.thumbnail_url || heroImage}
              alt={courseTitle}
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/60 to-background" />
          </div>

          <div className="page-container relative z-10 pt-3 sm:pt-6 pb-6 sm:pb-12 px-4 sm:px-6">
            {/* Back link — below the image on mobile, inline on desktop */}
            <Link to="/courses" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-3 lg:mb-8 text-xs sm:text-sm">
              <BackIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 me-1" />
              {t('courses.backToCourses')}
            </Link>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 lg:gap-12">
              {/* Left: Course Info (3 cols) */}
              <div className="lg:col-span-3">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2 mb-3 sm:mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getDifficultyColor(course.difficulty_level)}`}>
                      {t(`courses.difficulty.${course.difficulty_level}`)}
                    </span>
                    {course.price === 0 && (
                      <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-semibold border border-primary/30">
                        {t('common.free')}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-5xl font-black text-foreground mb-2 sm:mb-4 leading-tight">
                    {courseTitle}
                  </h1>

                  {/* Rating Summary */}
                  {reviewStats && reviewStats.count > 0 && (
                    <div className="flex items-center gap-2 mb-3 sm:mb-4">
                      <StarRating rating={reviewStats.avg} size="sm" />
                      <span className="text-sm font-semibold text-foreground">{reviewStats.avg.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">
                        ({reviewStats.count} {isRTL ? 'تقييم' : reviewStats.count === 1 ? 'review' : 'reviews'})
                      </span>
                    </div>
                  )}

                  {/* Stats Row — on mobile, show before description */}
                  <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-2 sm:gap-y-3 text-xs sm:text-sm mb-3 sm:mb-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 text-foreground">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                        <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                      </div>
                      <div>
                        <span className="font-semibold">{totalLessons}</span>
                        <span className="text-muted-foreground ms-1">{isRTL ? 'درس' : 'lessons'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 text-foreground">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-secondary/30 flex items-center justify-center">
                        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-secondary-foreground" />
                      </div>
                      <div>
                        <span className="font-semibold">{formatDuration(totalDurationMinutes)}</span>
                        <span className="text-muted-foreground ms-1">{isRTL ? 'إجمالي' : 'total'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 text-foreground">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-accent/30 flex items-center justify-center">
                        <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent-foreground" />
                      </div>
                      <div>
                        <span className="font-semibold">{chapters.length}</span>
                        <span className="text-muted-foreground ms-1">{isRTL ? 'فصول' : 'chapters'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {courseDescription && (
                    <p className="text-sm sm:text-base lg:text-lg text-muted-foreground mb-4 sm:mb-8 leading-relaxed max-w-2xl">
                      {courseDescription}
                    </p>
                  )}

                  {/* Preview / Introductory Video — below description */}
                  {course.preview_video_url && (
                    <div className="mb-4 sm:mb-8">
                      <div className="flex items-center gap-3 mb-3 sm:mb-4">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-primary/15 flex items-center justify-center">
                          <Play className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                        </div>
                        <h2 className="text-lg sm:text-2xl font-bold text-foreground">
                          {isRTL ? 'نظرة على الدورة' : 'Course Preview'}
                        </h2>
                      </div>

                      <div className="rounded-xl sm:rounded-2xl overflow-hidden border border-border shadow-lg">
                        {previewVideoPlaying ? (
                          <div className="aspect-video">
                            <BunnyVideoEmbed
                              videoUrl={course.preview_video_url}
                              title={isRTL ? 'فيديو تعريفي بالدورة' : 'Course Introduction'}
                              isPreview
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() => setPreviewVideoPlaying(true)}
                            className="relative w-full aspect-video group cursor-pointer focus:outline-none"
                            aria-label={isRTL ? 'تشغيل الفيديو التعريفي' : 'Play preview video'}
                          >
                            <img
                              src={(course as any).preview_video_thumbnail || course.thumbnail_url || heroImage}
                              alt={isRTL ? 'صورة مصغرة للفيديو' : 'Video thumbnail'}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/90 group-hover:bg-primary group-hover:scale-110 transition-all duration-300 flex items-center justify-center shadow-2xl">
                                <Play className="w-7 h-7 sm:w-9 sm:h-9 text-primary-foreground ms-1" fill="currentColor" />
                              </div>
                            </div>
                            <div className="absolute bottom-4 start-4">
                              <span className="px-3 py-1.5 rounded-lg bg-black/60 text-white text-sm font-medium backdrop-blur-sm">
                                {isRTL ? 'شاهد الفيديو التعريفي' : 'Watch Preview'}
                              </span>
                            </div>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Right: Enrollment Card (2 cols, sticky) */}
              <div ref={ctaCardCallbackRef} className="lg:col-span-2 order-last lg:order-last">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="card-premium p-4 sm:p-6 lg:sticky lg:top-28 mx-0"
                >
                  {isEnrolled ? (
                    <div className="space-y-5">
                      {/* Progress ring */}
                      <div className="flex items-center gap-4">
                        <div className="relative w-16 h-16 flex-shrink-0">
                          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                            <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                            <circle
                              cx="32" cy="32" r="28" fill="none"
                              stroke="hsl(var(--primary))" strokeWidth="4"
                              strokeLinecap="round"
                              strokeDasharray={`${2 * Math.PI * 28}`}
                              strokeDashoffset={`${2 * Math.PI * 28 * (1 - progressPercentage / 100)}`}
                              className="transition-all duration-700"
                            />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">
                            {progressPercentage}%
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-primary mb-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="font-semibold text-sm">{isRTL ? 'مسجّل' : 'Enrolled'}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {completedLessons} / {totalLessons} {isRTL ? 'مكتمل' : 'completed'}
                          </p>
                        </div>
                      </div>

                      {/* Remaining time */}
                      {remainingMinutes > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 text-sm">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {isRTL ? `${formatDuration(remainingMinutes)} متبقية` : `${formatDuration(remainingMinutes)} remaining`}
                          </span>
                        </div>
                      )}

                      {/* Smart Resume Button */}
                      {resumeLesson && (
                        <Button className="w-full btn-cta h-12 text-base" asChild>
                          <Link to={`/courses/${id}/lessons/${resumeLesson.id}`}>
                            <Play className="w-5 h-5 me-2" />
                            {isRTL ? 'أكمل التعلم' : 'Resume Learning'}
                          </Link>
                        </Button>
                      )}

                      {progressPercentage === 100 && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                          <Trophy className="w-5 h-5 text-primary" />
                          <span className="text-sm font-medium text-primary">
                            {isRTL ? '🎉 أكملت الدورة!' : '🎉 Course completed!'}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Price */}
                      <div className="text-center py-2">
                        {(() => {
                          const priceInfo = getCoursePriceInfo(course.id, course.price, course.discount_percentage || 0);
                          const courseMeta = priceInfo.currency;
                          if (priceInfo.discountPct > 0 && course.price > 0) {
                            return (
                              <div className="space-y-1">
                                <div className="flex items-center justify-center gap-2">
                                  <span className="text-lg text-muted-foreground line-through">
                                    {priceInfo.originalPrice} {courseMeta}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-sm font-bold">
                                    -{priceInfo.discountPct}%
                                  </span>
                                </div>
                                <span className="text-4xl font-black text-foreground">
                                  {priceInfo.finalPrice} {courseMeta}
                                </span>
                              </div>
                            );
                          }
                          return (
                            <span className="text-4xl font-black text-foreground">
                              {course.price === 0
                                ? t('common.free')
                                : `${priceInfo.finalPrice} ${courseMeta}`}
                            </span>
                          );
                        })()}
                        {course.price > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {isRTL ? 'السعر غير شامل الضريبة' : 'Price excludes VAT'}
                          </p>
                        )}
                      </div>

                      {/* CTA */}
                      {course.price === 0 ? (
                        user ? (
                          <Button
                            className="w-full btn-cta h-12 text-base"
                            onClick={() => enrollMutation.mutate()}
                            disabled={enrollMutation.isPending}
                          >
                            <Zap className="w-5 h-5 me-2" />
                            {enrollMutation.isPending
                              ? t('courses.enrolling')
                              : t('courses.enrollForFree')}
                          </Button>
                        ) : (
                          <Button className="w-full btn-cta h-12 text-base" asChild>
                            <Link to={`/login?returnTo=${encodeURIComponent(window.location.pathname)}`}>
                              <Zap className="w-5 h-5 me-2" />
                              {t('courses.enrollForFree')}
                            </Link>
                          </Button>
                        )
                      ) : user ? (
                        <Button
                          className="w-full btn-cta h-12 text-base"
                          onClick={() => setShowCheckout(true)}
                        >
                          <ShoppingCart className="w-5 h-5 me-2" />
                          {t('courses.buyNow')}
                        </Button>
                      ) : (
                        <Button
                          className="w-full btn-cta h-12 text-base"
                          onClick={() => setShowGuestSignup(true)}
                        >
                          <Zap className="w-5 h-5 me-2" />
                          {(() => {
                            const info = getCoursePriceInfo(course.id, course.price, course.discount_percentage || 0);
                            return isRTL
                              ? `احصل على الوصول الفوري – ${info.finalPrice} ${info.currency}`
                              ? `احصل على الدورة الآن – ${info.finalPrice} ${info.currency}`
                              : `Get the course now – ${info.finalPrice} ${info.currency}`;
                          })()}
                        </Button>
                      )}

                      {/* Course includes */}
                      <div className="space-y-3 pt-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {isRTL ? 'يشمل الاشتراك' : 'This course includes'}
                        </p>
                        <div className="space-y-2.5">
                          {[
                            { icon: Video, text: isRTL ? `${totalLessons} درس فيديو` : `${totalLessons} video lessons` },
                            { icon: Clock, text: isRTL ? `${formatDuration(totalDurationMinutes)} محتوى` : `${formatDuration(totalDurationMinutes)} of content` },
                            { icon: ClipboardList, text: isRTL ? 'اختبارات تفاعلية' : 'Interactive quizzes' },
                          ].map(({ icon: Icon, text }, i) => (
                            <div key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                              <Icon className="w-4 h-4 text-primary/70 flex-shrink-0" />
                              <span>{text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>
            </div>
          </div>
        </section>


        {/* What You'll Learn */}
        {(() => {
          const outcomes = Array.isArray((course as any).learning_outcomes) && (course as any).learning_outcomes.length > 0
            ? (course as any).learning_outcomes as { text_en: string; text_ar: string }[]
            : null;
          const showSection = outcomes ? outcomes.length > 0 : chapters.length > 0;
          if (!showSection) return null;
          return (
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-14">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <div className="flex items-center gap-3 mb-4 sm:mb-6">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-primary/15 flex items-center justify-center">
                    <Target className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <h2 className="text-lg sm:text-2xl font-bold text-foreground">
                    {isRTL ? 'ماذا ستتعلم' : 'What You\'ll Learn'}
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {outcomes ? (
                    outcomes.map((item, idx) => {
                      const text = isRTL && item.text_ar ? item.text_ar : item.text_en;
                      return (
                        <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                          <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                          <p className="text-sm font-medium text-foreground">{text}</p>
                        </div>
                      );
                    })
                  ) : (
                    chapters.slice(0, 6).map((chapter) => {
                      const chTitle = isRTL && chapter.title_ar ? chapter.title_ar : chapter.title;
                      const chDesc = isRTL && chapter.description_ar ? chapter.description_ar : chapter.description;
                      return (
                        <div key={chapter.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                          <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{chTitle}</p>
                            {chDesc && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{chDesc}</p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            </section>
          );
        })()}

        {/* Chapter Roadmap Timeline */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 sm:pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-secondary/30 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-secondary-foreground" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-2xl font-bold text-foreground">
                    {isRTL ? 'خطة التعلم' : 'Learning Roadmap'}
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {chapters.length} {isRTL ? 'فصول' : 'chapters'} • {totalLessons} {isRTL ? 'دروس' : 'lessons'}
                  </p>
                </div>
              </div>
            </div>

            {chapters.length > 0 ? (
              <div className="relative">
                {/* Vertical timeline line */}
                <div className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-4 bottom-4 w-0.5 bg-border hidden sm:block`} />

                <div className="space-y-6">
                  {chapters.map((chapter, chapterIndex) => {
                    const chTitle = isRTL && chapter.title_ar ? chapter.title_ar : chapter.title;
                    const chProgress = getChapterProgress(chapter);
                    const chDuration = getChapterDuration(chapter);
                    const isComplete = chProgress === 100;
                    const isExpanded = expandedChapters.has(chapter.id);
                    const completedInChapter = chapter.lessons.filter(l => isLessonCompleted(l.id)).length;

                    return (
                      <motion.div
                        key={chapter.id}
                        initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: chapterIndex * 0.08 }}
                        className="relative"
                      >
                        <div className="flex gap-4">
                          {/* Timeline node */}
                          <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                            isComplete
                              ? 'bg-primary border-primary text-primary-foreground'
                              : chProgress > 0
                                ? 'bg-primary/20 border-primary/50 text-primary'
                                : 'bg-muted border-border text-muted-foreground'
                          }`}>
                            {isComplete ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              chapterIndex + 1
                            )}
                          </div>

                          {/* Chapter content */}
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => toggleChapter(chapter.id)}
                              className="w-full text-start card-premium p-4 sm:p-5 transition-colors hover:border-primary/30"
                            >
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="min-w-0">
                                  <h3 className="font-semibold text-foreground text-base sm:text-lg">
                                    {chTitle}
                                  </h3>
                                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <BookOpen className="w-3.5 h-3.5" />
                                      {chapter.lessons.length} {isRTL ? 'دروس' : 'lessons'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3.5 h-3.5" />
                                      {formatDuration(chDuration)}
                                    </span>
                                    {chapter.is_free && (
                                      <span className="text-primary font-medium">
                                        {isRTL ? 'مجاني' : 'Free'}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Progress badge */}
                                {isEnrolled && (
                                  <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${
                                    isComplete
                                      ? 'bg-primary/20 text-primary'
                                      : chProgress > 0
                                        ? 'bg-muted text-foreground'
                                        : 'bg-muted/50 text-muted-foreground'
                                  }`}>
                                    {completedInChapter}/{chapter.lessons.length}
                                  </span>
                                )}
                              </div>

                              {/* Progress bar */}
                              {isEnrolled && chapter.lessons.length > 0 && (
                                <Progress value={chProgress} className="h-1.5" />
                              )}
                            </button>

                            {/* Expanded lessons */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.25 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-2 ms-0 space-y-1">
                                    {chapter.lessons.map((lesson) => {
                                      const locked = isLessonLocked(lesson, chapter);
                                      const state = getLessonState(lesson.id);
                                      const lTitle = isRTL && lesson.title_ar ? lesson.title_ar : lesson.title;

                                      return (
                                        <Link
                                          key={lesson.id}
                                          to={locked ? '#' : `/courses/${id}/lessons/${lesson.id}`}
                                          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${
                                            locked
                                              ? 'opacity-50 cursor-not-allowed'
                                              : 'hover:bg-muted/50'
                                          }`}
                                          onClick={e => locked && e.preventDefault()}
                                        >
                                          <div className="flex-shrink-0">
                                            {locked ? (
                                              <Lock className="w-4 h-4 text-muted-foreground" />
                                            ) : state === 'completed' ? (
                                              <CheckCircle2 className="w-4 h-4 text-primary" />
                                            ) : state === 'in_progress' ? (
                                              <div className="w-4 h-4 rounded-full border-2 border-primary bg-primary/20" />
                                            ) : (
                                              <Play className="w-4 h-4 text-muted-foreground" />
                                            )}
                                          </div>
                                          <span className="flex-1 truncate text-foreground">{lTitle}</span>
                                          {lesson.duration_minutes && (
                                            <span className="text-xs text-muted-foreground flex-shrink-0">
                                              {lesson.duration_minutes}{isRTL ? 'د' : 'm'}
                                            </span>
                                          )}
                                          {lesson.is_free && !isEnrolled && (
                                            <span className="text-xs text-primary font-medium flex-shrink-0">
                                              {isRTL ? 'مجاني' : 'Free'}
                                            </span>
                                          )}
                                        </Link>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="card-premium p-12 text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {isRTL ? 'لا توجد فصول متاحة حتى الآن' : 'No chapters available yet'}
                </p>
              </div>
            )}
          </motion.div>
        </section>

        {/* Reviews Section */}
        <CourseReviews courseId={id!} isEnrolled={isEnrolled} />
      </main>

      <Footer />
      {/* Spacer for sticky bottom bar on mobile */}
      {!isEnrolled && course && (
        <div className="h-20 lg:hidden safe-area-bottom" />
      )}

      {/* Checkout Modal */}
      {course && (
        <>
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
              queryClient.invalidateQueries({ queryKey: ['enrollment', id, user?.id] });
              navigate(`/payment-success?course=${id}&tap_id=free_enrollment`);
            }}
          />
          <GuestSignupModal
            open={showGuestSignup}
            onOpenChange={setShowGuestSignup}
            course={{ id: course.id, title: course.title, title_ar: course.title_ar, price: course.price }}
            onAuthenticated={() => setShowCheckout(true)}
          />
        </>
      )}

      {/* Sticky Bottom Bar — mobile only, hidden when enrolled */}
      <AnimatePresence>
        {showStickyBottom && !isEnrolled && course && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-0 inset-x-0 z-[60] lg:hidden bg-card/95 backdrop-blur-xl border-t border-border safe-area-bottom"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              {/* Price */}
              <div className="flex flex-col min-w-0">
                {(() => {
                  const priceInfo = getCoursePriceInfo(course.id, course.price, course.discount_percentage || 0);
                  if (course.price === 0) {
                    return <span className="text-lg font-black text-foreground">{t('common.free')}</span>;
                  }
                  return (
                    <div className="flex items-center gap-2">
                      {priceInfo.discountPct > 0 && (
                        <span className="text-xs text-muted-foreground line-through">{priceInfo.originalPrice} {priceInfo.currency}</span>
                      )}
                      <span className="text-lg font-black text-foreground">{priceInfo.finalPrice} {priceInfo.currency}</span>
                    </div>
                  );
                })()}
              </div>

              {/* CTA Button */}
              {course.price === 0 ? (
                user ? (
                  <Button
                    className="btn-cta h-11 text-sm px-6 flex-shrink-0"
                    onClick={() => enrollMutation.mutate()}
                    disabled={enrollMutation.isPending}
                  >
                    <Zap className="w-4 h-4 me-1.5" />
                    {isRTL ? 'سجّل مجاناً' : 'Enroll Free'}
                  </Button>
                ) : (
                  <Button className="btn-cta h-11 text-sm px-6 flex-shrink-0" asChild>
                    <Link to={`/login?returnTo=${encodeURIComponent(window.location.pathname)}`}>
                      <Zap className="w-4 h-4 me-1.5" />
                      {isRTL ? 'سجّل مجاناً' : 'Enroll Free'}
                    </Link>
                  </Button>
                )
              ) : (
                <Button
                  className="btn-cta h-11 text-sm px-6 flex-shrink-0"
                  onClick={() => user ? setShowCheckout(true) : setShowGuestSignup(true)}
                >
                  <ShoppingCart className="w-4 h-4 me-1.5" />
                  {user ? (isRTL ? 'اشترِ الآن' : 'Buy Now') : (isRTL ? 'احصل على الوصول' : 'Get Access')}
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CourseDetail;
