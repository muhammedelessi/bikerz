import React, { useState, useEffect, useMemo, useRef } from "react";
import SEOHead from "@/components/common/SEOHead";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
  Star,
  Zap,
  Trophy,
  BarChart3,
  Users,
  ArrowRight,
  ArrowLeft,
  Layers,
  ClipboardList,
  Infinity,
  MonitorPlay,
  Eye,
  Unlock,
  Gift,
  MousePointerClick,
} from "lucide-react";
import { toast } from "sonner";
const heroImage = "/hero-rider.webp";
import CheckoutModal from "@/components/checkout/CheckoutModal";
import PromoPopup from "@/components/common/PromoPopup";

import BunnyVideoEmbed from "@/components/course/BunnyVideoEmbed";
import PaymentMethodIcons from "@/components/checkout/PaymentMethodIcons";
import { trackViewContent } from "@/utils/metaPixel";
import CourseReviews from "@/components/course/CourseReviews";
import StarRating from "@/components/course/StarRating";
import CourseCard from "@/components/course/CourseCard";
import { fetchEnrollmentsWithLiveProgress, type EnrollmentWithProgress } from "@/lib/enrollmentProgress";

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
  vat_percentage?: number | null;
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
  const {
    formatPrice,
    convertPrice,
    formatCoursePrice,
    getCoursePrice,
    getCourseCurrency,
    getCoursePriceInfo,
    getCurrencySymbol,
  } = useCurrency();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const ForwardIcon = isRTL ? ArrowLeft : ArrowRight;
  const [showCheckout, setShowCheckout] = useState(false);

  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [autoExpandedOnce, setAutoExpandedOnce] = useState(false);
  const [paymentVerifying, setPaymentVerifying] = useState(false);
  const [previewVideoPlaying, setPreviewVideoPlaying] = useState(false);
  const [showStickyBottom, setShowStickyBottom] = useState(false);
  const ctaCardRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const THINK_WHAT_IF_YOUTUBE_ID = "00BxMrjssbU";

  const getYouTubeEmbedUrl = (url: string): string | null => {
    const isThinkWhatIfCourse =
      course?.title?.toLowerCase().includes("what if") || course?.title_ar?.includes("ماذا لو");

    if (isThinkWhatIfCourse) {
      return `https://www.youtube.com/embed/${THINK_WHAT_IF_YOUTUBE_ID}?rel=0`;
    }

    if (!url) return null;
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return ytMatch ? `https://www.youtube.com/embed/${ytMatch[1]}?rel=0` : null;
  };

  // Payment callback now handled by /payment-success/:courseId page

  // Scroll-based sticky header
  useEffect(() => {
    const handleScroll = () => {
      setShowStickyHeader(window.scrollY > 350);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fetch review stats (combines real + base)
  const { data: reviewStats } = useQuery({
    queryKey: ["course-review-stats", id],
    queryFn: async () => {
      const [{ data: reviews, error }, { data: courseData }] = await Promise.all([
        supabase.from("course_reviews").select("rating").eq("course_id", id!),
        supabase.from("courses").select("base_review_count, base_rating").eq("id", id!).single(),
      ]);
      if (error) throw error;
      const realCount = (reviews || []).length;
      const realAvg = realCount > 0 ? reviews!.reduce((s, r) => s + Number(r.rating), 0) / realCount : 0;
      const baseCount = (courseData as any)?.base_review_count || 0;
      const baseRating = Number((courseData as any)?.base_rating) || 0;
      const totalCount = realCount + baseCount;
      const combinedAvg = totalCount > 0 ? (realAvg * realCount + baseRating * baseCount) / totalCount : 0;
      return { count: totalCount, avg: combinedAvg };
    },
    enabled: !!id,
  });

  // Fetch course details
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ["course", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Course | null;
    },
    enabled: !!id,
  });

  // Fetch chapters with lessons
  const { data: chapters = [], isLoading: chaptersLoading } = useQuery({
    queryKey: ["chapters", id],
    queryFn: async () => {
      const { data: chaptersData, error: chaptersError } = await supabase
        .from("chapters")
        .select("*")
        .eq("course_id", id)
        .order("position", { ascending: true });
      if (chaptersError) throw chaptersError;

      const chaptersWithLessons = await Promise.all(
        (chaptersData || []).map(async (chapter) => {
          const { data: lessons, error: lessonsError } = await supabase
            .from("lessons")
            .select("*")
            .eq("chapter_id", chapter.id)
            .order("position", { ascending: true });
          if (lessonsError) throw lessonsError;
          return { ...chapter, lessons: lessons || [] } as Chapter;
        }),
      );
      return chaptersWithLessons;
    },
    enabled: !!id,
  });

  // Fetch enrollment status
  const { data: enrollment } = useQuery({
    queryKey: ["enrollment", id, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("course_enrollments")
        .select("*")
        .eq("course_id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  // Fetch lesson progress
  const { data: lessonProgress = [] } = useQuery({
    queryKey: ["lesson-progress", id, user?.id],
    queryFn: async () => {
      if (!user || !chapters.length) return [];
      const lessonIds = chapters.flatMap((ch) => ch.lessons.map((l) => l.id));
      if (!lessonIds.length) return [];
      const { data, error } = await supabase
        .from("lesson_progress")
        .select("lesson_id, is_completed, watch_time_seconds")
        .eq("user_id", user.id)
        .in("lesson_id", lessonIds);
      if (error) throw error;
      return (data || []) as LessonProgress[];
    },
    enabled: !!id && !!user && chapters.length > 0,
  });

  // Check if user has reviewed this course
  const { data: hasReviewed = false } = useQuery({
    queryKey: ["user-review-check", id, user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { count, error } = await supabase
        .from("course_reviews")
        .select("id", { count: "exact", head: true })
        .eq("course_id", id!)
        .eq("user_id", user.id);
      if (error) return false;
      return (count || 0) > 0;
    },
    enabled: !!id && !!user,
  });

  // Fetch related courses ("You Might Also Like")
  const { data: relatedCourses = [] } = useQuery({
    queryKey: ["related-courses", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(
          `
          id, title, title_ar, description, description_ar,
          thumbnail_url, difficulty_level, price, is_published,
          discount_percentage, discount_expires_at,
          base_rating, base_review_count,
          chapters (
            id, is_published,
            lessons ( id, duration_minutes, is_published, is_free )
          )
        `,
        )
        .eq("is_published", true)
        .neq("id", id!)
        .order("created_at", { ascending: true })
        .limit(4);
      if (error) throw error;
      return (data || []).map((c: any) => {
        let lessonCount = 0;
        let totalMinutes = 0;
        let freeLessonCount = 0;
        (c.chapters || []).forEach((ch: any) => {
          if (ch.is_published) {
            (ch.lessons || []).forEach((l: any) => {
              if (l.is_published) {
                lessonCount++;
                totalMinutes += l.duration_minutes || 0;
                if (l.is_free) freeLessonCount++;
              }
            });
          }
        });
        return { ...c, lessonCount, totalMinutes, freeLessonCount };
      });
    },
    enabled: !!id,
  });

  // Fetch enrollments for related courses
  const { data: relatedEnrollments = [] } = useQuery({
    queryKey: ["related-enrollments", user?.id, id],
    queryFn: async () => {
      if (!user) return [];
      return (await fetchEnrollmentsWithLiveProgress(user.id)) as EnrollmentWithProgress[];
    },
    enabled: !!user,
  });

  const getRelatedEnrollment = (courseId: string) => relatedEnrollments.find((e) => e.course_id === courseId);

  useEffect(() => {
    if (course && id) {
      trackViewContent({
        content_name: course.title,
        content_ids: [id],
        content_type: "product",
        value: course.price,
        currency: "SAR",
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
      observerRef.current = new IntersectionObserver(([entry]) => setShowStickyBottom(!entry.isIntersecting), {
        threshold: 0.1,
      });
      observerRef.current.observe(node);
    }
  }, []);

  // Enroll mutation
  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!user || !id) throw new Error("User not authenticated");
      const { data, error } = await supabase
        .from("course_enrollments")
        .insert({ user_id: user.id, course_id: id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollment", id, user?.id] });
      navigate(`/payment-success?course=${id}&tap_id=free_enrollment`);
    },
    onError: (error: any) => {
      toast.error(error.message || t("courseDetail.failedToEnroll"));
    },
  });

  // Effective discount (check if expired)
  const discountExpiresAt = (course as any)?.discount_expires_at;
  const isDiscountExpired = discountExpiresAt ? new Date(discountExpiresAt).getTime() <= Date.now() : false;
  const effectiveDiscount = isDiscountExpired ? 0 : course?.discount_percentage || 0;
  const courseVat = (course as any)?.vat_percentage ?? 15;

  // Calculations
  const totalLessons = chapters.reduce((acc, ch) => acc + ch.lessons.length, 0);
  const totalFreeLessons = chapters.reduce((acc, ch) => acc + ch.lessons.filter((l) => l.is_free).length, 0);
  const completedLessons = lessonProgress.filter((lp) => lp.is_completed).length;
  const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const isEnrolled = !!enrollment;
  const isLoading = courseLoading || chaptersLoading;

  // Auto-expand chapters that contain free videos
  useEffect(() => {
    if (!autoExpandedOnce && chapters.length > 0) {
      const chaptersWithFree = chapters.filter((ch) => ch.lessons.some((l) => l.is_free)).map((ch) => ch.id);
      if (chaptersWithFree.length > 0) {
        setExpandedChapters((prev) => {
          const next = new Set(prev);
          chaptersWithFree.forEach((id) => next.add(id));
          return next;
        });
      }
      setAutoExpandedOnce(true);
    }
  }, [chapters, autoExpandedOnce]);

  useEffect(() => {
    if (searchParams.get("checkout") === "true" && course && !isEnrolled) {
      if (user) {
        setShowCheckout(true);
      } else {
        navigate(`/signup?returnTo=${encodeURIComponent(`/courses/${id}?checkout=true`)}`);
      }
      searchParams.delete("checkout");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, course, user, isEnrolled, setSearchParams]);

  const totalDurationMinutes = useMemo(
    () => chapters.reduce((acc, ch) => acc + ch.lessons.reduce((la, l) => la + (l.duration_minutes || 5), 0), 0),
    [chapters],
  );

  const remainingMinutes = useMemo(
    () =>
      chapters.reduce(
        (acc, ch) =>
          acc +
          ch.lessons
            .filter((l) => !lessonProgress.some((lp) => lp.lesson_id === l.id && lp.is_completed))
            .reduce((la, l) => la + (l.duration_minutes || 5), 0),
        0,
      ),
    [chapters, lessonProgress],
  );

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins} ${t("courseDetail.minuteAbbr")}`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return `${h}${t("courses.hour")}`;
    return `${h}${t("courses.hour")} ${m}${t("courses.minutes")}`;
  };

  const isLessonCompleted = (lessonId: string) =>
    lessonProgress.some((lp) => lp.lesson_id === lessonId && lp.is_completed);

  const getLessonState = (lessonId: string): "completed" | "in_progress" | "not_started" => {
    const progress = lessonProgress.find((lp) => lp.lesson_id === lessonId);
    if (!progress) return "not_started";
    if (progress.is_completed) return "completed";
    if ((progress.watch_time_seconds || 0) > 0) return "in_progress";
    return "not_started";
  };

  const isLessonLocked = (lesson: Lesson, _chapter: Chapter) => {
    if (!isEnrolled && !lesson.is_free) return true;
    return false;
  };

  // Chapter progress
  const getChapterProgress = (chapter: Chapter) => {
    if (chapter.lessons.length === 0) return 0;
    const completed = chapter.lessons.filter((l) => isLessonCompleted(l.id)).length;
    return Math.round((completed / chapter.lessons.length) * 100);
  };

  const getChapterDuration = (chapter: Chapter) =>
    chapter.lessons.reduce((acc, l) => acc + (l.duration_minutes || 5), 0);

  // Smart resume: find the best lesson to continue from
  const resumeLesson = useMemo(() => {
    const allLessons = chapters.flatMap((ch) => ch.lessons);
    // Priority 1: In-progress lesson (has watch time but not completed)
    const inProgress = allLessons.find((l) => {
      const p = lessonProgress.find((lp) => lp.lesson_id === l.id);
      return p && !p.is_completed && (p.watch_time_seconds || 0) > 0;
    });
    if (inProgress) return inProgress;
    // Priority 2: First not-started lesson
    const nextLesson = allLessons.find((l) => !isLessonCompleted(l.id));
    return nextLesson || allLessons[0];
  }, [chapters, lessonProgress]);

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case "beginner":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "intermediate":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "advanced":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-primary/20 text-primary border-primary/30";
    }
  };

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) => {
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
        <div className="pt-[var(--navbar-h)] min-h-[60vh] flex items-center justify-center">
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
        <div className="pt-[var(--navbar-h)] section-container min-h-[60vh] flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">{t("courses.courseNotFound")}</h2>
          <p className="text-muted-foreground mb-6">{t("courses.courseNotFoundDescription")}</p>
          <Link to="/courses">
            <Button variant="outline">
              <BackIcon className="w-4 h-4 me-2" />
              {t("courses.backToCourses")}
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
    <>
      <PromoPopup trigger="exit" />
      <div className="min-h-screen bg-background">
        <SEOHead
          title={courseTitle || "Course Details"}
          description={
            courseDescription?.substring(0, 160) || "Explore this motorcycle riding course on BIKERZ Academy."
          }
          canonical={`/courses/${id}`}
          ogType="article"
          ogImage={course.thumbnail_url || undefined}
          breadcrumbs={[
            { name: "Home", url: "/" },
            { name: "Courses", url: "/courses" },
            { name: courseTitle || "Course", url: `/courses/${id}` },
          ]}
        />
        <Navbar />
        <div className="pt-[var(--navbar-h)]">
          {/* Sticky Header — appears on scroll */}
          <AnimatePresence>
            {showStickyHeader && !showCheckout && !isPaymentProcessing && (
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
                    <h1 className="text-sm sm:text-base font-semibold text-foreground truncate">{courseTitle}</h1>
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
                          {t("courseDetail.resume")}
                        </Link>
                      </Button>
                    ) : !isEnrolled ? (
                      course.price === 0 ? (
                        user ? (
                          <Button
                            size="sm"
                            className="btn-cta h-9 text-sm"
                            onClick={() => enrollMutation.mutate()}
                            disabled={enrollMutation.isPending}
                          >
                            {t("courseDetail.enrollFree")}
                          </Button>
                        ) : (
                          <Button size="sm" className="btn-cta h-9 text-sm" asChild>
                            <Link to={`/login?returnTo=${encodeURIComponent(window.location.pathname)}`}>
                              {t("courseDetail.enrollFree")}
                            </Link>
                          </Button>
                        )
                      ) : (
                        <Button
                          size="sm"
                          className="btn-cta h-9 text-sm hidden lg:inline-flex"
                          onClick={() =>
                            user
                              ? setShowCheckout(true)
                              : navigate(`/signup?returnTo=${encodeURIComponent(`/courses/${id}?checkout=true`)}`)
                          }
                        >
                          {(() => {
                            const info = getCoursePriceInfo(course.id, course.price, effectiveDiscount);
                            const sym = getCurrencySymbol(info.currency, isRTL);
                            return isRTL
                              ? `اشترك الآن – ${info.finalPrice} ${sym}`
                              : `Subscribe now – ${info.finalPrice} ${sym}`;
                          })()}
                        </Button>
                      )
                    ) : null}
                  </div>
                </div>
              </motion.header>
            )}
          </AnimatePresence>

          {/* Breadcrumbs */}
          <nav className="page-container py-3">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/">{isRTL ? "الرئيسية" : "Home"}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/courses">{isRTL ? "الدورات" : "Courses"}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="truncate max-w-[200px] sm:max-w-none">{courseTitle}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </nav>

          <main>
            {/* Hero Section */}
            <section className="relative overflow-hidden">
              {/* Mobile: stacked video on top */}
              <div className="md:hidden">
                {course.preview_video_url ? (
                  (() => {
                    const ytEmbedUrl = getYouTubeEmbedUrl(course.preview_video_url);
                    if (ytEmbedUrl) {
                      return (
                        <div className="aspect-video w-full overflow-hidden">
                          <iframe
                            width="100%"
                            height="100%"
                            src={ytEmbedUrl}
                            frameBorder="0"
                            allow="autoplay; encrypted-media"
                            allowFullScreen
                            style={{ display: "block" }}
                          />
                        </div>
                      );
                    }
                    return (
                      <div className="aspect-video w-full relative">
                        <BunnyVideoEmbed
                          videoUrl={course.preview_video_url}
                          title={t("courseDetail.courseIntroduction")}
                          isPreview
                        />
                        <motion.div
                          className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
                          initial={{ opacity: 1 }}
                          animate={{ opacity: 0 }}
                          transition={{ delay: 4, duration: 0.5 }}
                        >
                          <motion.div
                            className="relative"
                            animate={{ x: [0, 6, 0], y: [0, -4, 0] }}
                            transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.2, ease: "easeInOut" }}
                          >
                            <span className="text-4xl drop-shadow-lg" role="img" aria-label="point">
                              👆
                            </span>
                          </motion.div>
                        </motion.div>
                      </div>
                    );
                  })()
                ) : course.thumbnail_url ? (
                  <div className="relative w-full">
                    <picture>
                      <source srcSet={course.thumbnail_url} type="image/webp" />
                      <img
                        src={course.thumbnail_url}
                        alt={courseTitle}
                        width={1280}
                        height={720}
                        className="w-full aspect-video object-cover"
                        loading="eager"
                        decoding="async"
                      />
                    </picture>
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/60" />
                  </div>
                ) : null}
              </div>

              <div className="page-container relative z-10 pt-1 sm:pt-3 pb-6 lg:pb-16 px-4 sm:px-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-8 lg:gap-10">
                  {/* Left: Video (desktop) + Course Info */}
                  <div className="md:col-span-7">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      {/* Desktop Video — inline in left column */}
                      <div className="hidden md:block">
                        {course.preview_video_url ? (
                          (() => {
                            const ytEmbedUrl = getYouTubeEmbedUrl(course.preview_video_url);
                            if (ytEmbedUrl) {
                              return (
                                <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-lg ring-1 ring-border/50">
                                  <iframe
                                    width="100%"
                                    height="100%"
                                    src={ytEmbedUrl}
                                    frameBorder="0"
                                    allow="autoplay; encrypted-media"
                                    allowFullScreen
                                    style={{ display: "block" }}
                                  />
                                </div>
                              );
                            }
                            return (
                              <div className="aspect-video w-full rounded-2xl overflow-hidden relative shadow-lg ring-1 ring-border/50">
                                <BunnyVideoEmbed
                                  videoUrl={course.preview_video_url}
                                  title={t("courseDetail.courseIntroduction")}
                                  isPreview
                                />
                                <motion.div
                                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
                                  initial={{ opacity: 1 }}
                                  animate={{ opacity: 0 }}
                                  transition={{ delay: 4, duration: 0.5 }}
                                >
                                  <motion.div
                                    className="relative"
                                    animate={{ x: [0, 6, 0], y: [0, -4, 0] }}
                                    transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.2, ease: "easeInOut" }}
                                  >
                                    <span className="text-4xl drop-shadow-lg" role="img" aria-label="point">
                                      👆
                                    </span>
                                  </motion.div>
                                </motion.div>
                              </div>
                            );
                          })()
                        ) : course.thumbnail_url ? (
                          <div className="relative rounded-2xl overflow-hidden shadow-lg ring-1 ring-border/50">
                            <picture>
                              <source srcSet={course.thumbnail_url} type="image/webp" />
                              <img
                                src={course.thumbnail_url}
                                alt={courseTitle}
                                width={1280}
                                height={720}
                                className="w-full aspect-video object-cover"
                                loading="eager"
                                decoding="async"
                              />
                            </picture>
                          </div>
                        ) : null}
                      </div>

                      {/* Course Info — directly below video */}
                      <div className="md:mt-6 space-y-3 sm:space-y-4">
                        {/* Badges */}
                        {course.price === 0 && (
                          <div className="flex flex-wrap gap-2">
                            <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-semibold border border-primary/30">
                              {t("common.free")}
                            </span>
                          </div>
                        )}

                        {/* Title */}
                        <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-foreground leading-tight">
                          {courseTitle}
                        </h1>

                        {/* Rating Summary */}
                        {reviewStats && reviewStats.count > 0 && (
                          <div className="flex items-center gap-2">
                            <StarRating rating={reviewStats.avg} size="sm" />
                            <span className="text-sm font-semibold text-foreground">{reviewStats.avg.toFixed(1)}</span>
                            <span className="text-xs text-muted-foreground">
                              ({reviewStats.count}{" "}
                              {isRTL
                                ? t("courseDetail.reviews")
                                : reviewStats.count === 1
                                  ? t("courseDetail.review")
                                  : t("courseDetail.reviews")}
                              )
                            </span>
                          </div>
                        )}

                        {/* Stats Row — compact pill layout */}
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 text-xs sm:text-sm">
                            <BookOpen className="w-3.5 h-3.5 text-primary" />
                            <span className="font-semibold text-foreground">{totalLessons}</span>
                            <span className="text-muted-foreground">{t("courseDetail.lessons")}</span>
                          </div>
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 text-xs sm:text-sm">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-semibold text-foreground">
                              {formatDuration(totalDurationMinutes)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 text-xs sm:text-sm">
                            <Layers className="w-3.5 h-3.5 text-accent-foreground" />
                            <span className="font-semibold text-foreground">{chapters.length}</span>
                            <span className="text-muted-foreground">{t("courseDetail.chapters")}</span>
                          </div>
                          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 text-xs sm:text-sm">
                            <Infinity className="w-3.5 h-3.5 text-primary" />
                            <span className="text-muted-foreground">{t("courseDetail.lifetimeAccess")}</span>
                          </div>
                        </div>

                        {/* Free Videos Banner — for non-enrolled visitors */}
                        {!isEnrolled && totalFreeLessons > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="flex items-center gap-3 p-3 sm:p-4 rounded-xl bg-green-500/10 border border-green-500/20"
                          >
                            <div className="w-9 h-9 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                              <Gift className="w-4 h-4 text-green-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-green-600 dark:text-green-400">
                                {t("courseDetail.freeVideosIncluded", { count: totalFreeLessons })}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {t("courseDetail.noAccountNeeded")}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-shrink-0 text-green-600 dark:text-green-400 hover:bg-green-500/10 text-xs font-semibold gap-1"
                              onClick={() =>
                                document
                                  .getElementById("free-videos-section")
                                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
                              }
                            >
                              {isRTL ? "شاهد الآن" : "Watch Now"}
                              {isRTL ? (
                                <ChevronLeft className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </motion.div>
                        )}

                        {/* Description */}
                        {courseDescription && (
                          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
                            {courseDescription}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  </div>

                  {/* Right: Enrollment Card — aligned with video top on desktop */}
                  <div ref={ctaCardCallbackRef} className="md:col-span-5">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                      className="card-premium p-5 sm:p-6 lg:p-8 md:sticky md:top-28 mx-0 md:rounded-2xl shadow-lg"
                    >
                      {isEnrolled ? (
                        <div className="space-y-5">
                          {/* Progress ring */}
                          <div className="flex items-center gap-4">
                            <div className="relative w-16 h-16 flex-shrink-0">
                              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                                <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                                <circle
                                  cx="32"
                                  cy="32"
                                  r="28"
                                  fill="none"
                                  stroke="hsl(var(--primary))"
                                  strokeWidth="4"
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
                              <div className="flex items-center gap-2 mb-1">
                                {progressPercentage >= 100 ? (
                                  <>
                                    <Trophy className="w-4 h-4 text-green-500" />
                                    <span className="font-semibold text-sm text-green-600 dark:text-green-400">
                                      {t("courseDetail.completed")}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-4 h-4 text-primary" />
                                    <span className="font-semibold text-sm text-primary">
                                      {t("courseDetail.enrolled")}
                                    </span>
                                  </>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {completedLessons} / {totalLessons} {t("courseDetail.lessonsCompleted")}
                              </p>
                            </div>
                          </div>
                          {remainingMinutes > 0 && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 text-sm">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                {t("courseDetail.remaining", { duration: formatDuration(remainingMinutes) })}
                              </span>
                            </div>
                          )}
                          {progressPercentage >= 100 ? (
                            <>
                              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                                <Trophy className="w-5 h-5 text-green-500" />
                                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                  {t("courseDetail.courseCompleted")}
                                </span>
                              </div>
                              {resumeLesson && (
                                <Button className="w-full h-12 text-base font-bold" asChild>
                                  <Link to={`/courses/${id}/lessons/${resumeLesson.id}`}>
                                    <BookOpen className="w-5 h-5 me-2" />
                                    {t("courseDetail.viewCourse")}
                                  </Link>
                                </Button>
                              )}
                              {!hasReviewed && (
                                <Button
                                  className="w-full h-12 text-base font-bold border-yellow-500/50 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10"
                                  variant="outline"
                                  onClick={() => {
                                    document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" });
                                  }}
                                >
                                  <Star className="w-5 h-5 me-2 fill-yellow-500 text-yellow-500" />
                                  {t("courseDetail.rateThisCourse")}
                                </Button>
                              )}
                            </>
                          ) : resumeLesson ? (
                            <Button className="w-full btn-cta h-12 text-base" asChild>
                              <Link to={`/courses/${id}/lessons/${resumeLesson.id}`}>
                                <Play className="w-5 h-5 me-2" />
                                {t("courseDetail.resumeLearning")}
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <div className="space-y-5">
                          {/* Price display */}
                          <div className="text-center py-2">
                            {(() => {
                              const priceInfo = getCoursePriceInfo(course.id, course.price, effectiveDiscount);
                              const sym = getCurrencySymbol(priceInfo.currency, isRTL);
                              if (priceInfo.discountPct > 0 && course.price > 0) {
                                return (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-center gap-2">
                                      <span
                                        className="text-lg text-muted-foreground line-through tabular-nums"
                                        dir="ltr"
                                      >
                                        {priceInfo.originalPrice} {sym}
                                      </span>
                                      <span className="px-2.5 py-0.5 rounded-full bg-destructive/10 text-destructive text-sm font-bold">
                                        -{priceInfo.discountPct}%
                                      </span>
                                    </div>
                                    <div
                                      className="text-4xl sm:text-5xl font-black text-foreground tabular-nums"
                                      dir="ltr"
                                    >
                                      {priceInfo.finalPrice}{" "}
                                      <span className="text-2xl text-muted-foreground font-bold">{sym}</span>
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <div className="text-4xl sm:text-5xl font-black text-foreground tabular-nums" dir="ltr">
                                  {course.price === 0 ? (
                                    t("common.free")
                                  ) : (
                                    <>
                                      {priceInfo.finalPrice}{" "}
                                      <span className="text-2xl text-muted-foreground font-bold">{sym}</span>
                                    </>
                                  )}
                                </div>
                              );
                            })()}
                            {course.price > 0 && (
                              <p className="text-xs text-muted-foreground mt-2">{t("courseDetail.priceIncludesVAT")}</p>
                            )}
                          </div>

                          {/* CTA Button */}
                          {course.price === 0 ? (
                            user ? (
                              <Button
                                className="w-full btn-cta h-12 sm:h-14 text-base sm:text-lg font-bold"
                                onClick={() => enrollMutation.mutate()}
                                disabled={enrollMutation.isPending}
                              >
                                <Zap className="w-5 h-5 me-2" />
                                {enrollMutation.isPending ? t("courses.enrolling") : t("courses.enrollForFree")}
                              </Button>
                            ) : (
                              <Button className="w-full btn-cta h-12 sm:h-14 text-base sm:text-lg font-bold" asChild>
                                <Link to={`/login?returnTo=${encodeURIComponent(window.location.pathname)}`}>
                                  <Zap className="w-5 h-5 me-2" />
                                  {t("courses.enrollForFree")}
                                </Link>
                              </Button>
                            )
                          ) : user ? (
                            <Button
                              className="w-full btn-cta h-12 sm:h-14 text-base sm:text-lg font-bold"
                              onClick={() => setShowCheckout(true)}
                            >
                              <ShoppingCart className="w-5 h-5 me-2" />
                              {(() => {
                                const info = getCoursePriceInfo(course.id, course.price, effectiveDiscount);
                                const sym = getCurrencySymbol(info.currency, isRTL);
                                return isRTL
                                  ? `اشترك الآن – ${info.finalPrice} ${sym}`
                                  : `Subscribe now – ${info.finalPrice} ${sym}`;
                              })()}
                            </Button>
                          ) : (
                            <Button
                              className="w-full btn-cta h-12 sm:h-14 text-base sm:text-lg font-bold"
                              onClick={() =>
                                navigate(`/signup?returnTo=${encodeURIComponent(`/courses/${id}?checkout=true`)}`)
                              }
                            >
                              <Zap className="w-5 h-5 me-2" />
                              {(() => {
                                const info = getCoursePriceInfo(course.id, course.price, effectiveDiscount);
                                const sym = getCurrencySymbol(info.currency, isRTL);
                                return isRTL
                                  ? `اشترك الآن – ${info.finalPrice} ${sym}`
                                  : `Subscribe now – ${info.finalPrice} ${sym}`;
                              })()}
                            </Button>
                          )}

                          {/* Divider */}
                          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

                          {/* Course includes */}
                          <div className="space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              {t("courseDetail.thisCourseIncludes")}
                            </p>
                            <div className="space-y-2.5">
                              {[
                                { icon: Video, text: t("courseDetail.videoLessons", { count: totalLessons }) },
                                {
                                  icon: Clock,
                                  text: t("courseDetail.contentOf", { duration: formatDuration(totalDurationMinutes) }),
                                },
                                { icon: ClipboardList, text: t("courseDetail.interactiveQuizzes") },
                                { icon: Infinity, text: t("courseDetail.lifetimeAccess") },
                                { icon: MonitorPlay, text: t("courseDetail.watchOnAnyDevice") },
                              ].map(({ icon: Icon, text }, i) => (
                                <div key={i} className="flex items-center gap-3 text-sm text-foreground/80">
                                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <Icon className="w-3.5 h-3.5 text-primary" />
                                  </div>
                                  <span className="font-medium">{text}</span>
                                </div>
                              ))}
                            </div>
                            {course.price > 0 && (
                              <div className="pt-3 border-t border-border/50">
                                <PaymentMethodIcons />
                              </div>
                            )}
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
              const outcomes =
                Array.isArray((course as any).learning_outcomes) && (course as any).learning_outcomes.length > 0
                  ? ((course as any).learning_outcomes as { text_en: string; text_ar: string }[])
                  : null;
              const showSection = outcomes ? outcomes.length > 0 : chapters.length > 0;
              if (!showSection) return null;
              return (
                <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-14 lg:py-16">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                  >
                    <div className="flex items-center justify-between mb-5 sm:mb-8">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/15 flex items-center justify-center">
                          <Target className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                        </div>
                        <div>
                          <h2 className="text-lg sm:text-2xl lg:text-3xl font-bold text-foreground">
                            {t("courseDetail.whatYoullLearn")}
                          </h2>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                            {t("courseDetail.skillsYoullGain")}
                          </p>
                        </div>
                      </div>
                      <div className="flex sm:hidden items-center gap-1.5 text-xs text-muted-foreground">
                        <MousePointerClick className="w-3.5 h-3.5" />
                        <span>{isRTL ? "اسحب للتصفح" : "Swipe to browse"}</span>
                      </div>
                    </div>

                    {(() => {
                      const items = outcomes
                        ? outcomes.map((item, idx) => ({
                            id: String(idx),
                            text: isRTL && item.text_ar ? item.text_ar : item.text_en,
                          }))
                        : chapters.slice(0, 6).map((ch) => ({
                            id: ch.id,
                            text: isRTL && ch.title_ar ? ch.title_ar : ch.title,
                            desc: isRTL && ch.description_ar ? ch.description_ar : ch.description,
                          }));
                      const totalSlides = items.length;

                      return (
                        <>
                          {/* Mobile: horizontal slider */}
                          <div className="sm:hidden relative">
                            <div
                              className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4"
                              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                              onScroll={(e) => {
                                const el = e.currentTarget;
                                const cardWidth = el.firstElementChild
                                  ? (el.firstElementChild as HTMLElement).offsetWidth + 12
                                  : 1;
                                const rawScroll = Math.abs(el.scrollLeft);
                                const idx = Math.round(rawScroll / cardWidth);
                                const counter = el.parentElement?.querySelector("[data-slide-counter]");
                                if (counter) counter.textContent = `${Math.min(idx + 1, totalSlides)} / ${totalSlides}`;
                              }}
                            >
                              {items.map((item, idx) => (
                                <div key={item.id} className="flex-shrink-0 snap-start w-[85%]">
                                  <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-card via-card to-muted/30 p-5 h-full transition-all duration-300 hover:border-primary/30">
                                    <div className="absolute top-3 end-3 w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                                      <span className="text-xs font-bold text-primary">{idx + 1}</span>
                                    </div>
                                    <div className="flex items-start gap-3 pe-8">
                                      <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <CheckCircle2 className="w-4 h-4 text-primary" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-sm font-semibold text-foreground leading-relaxed">
                                          {item.text}
                                        </p>
                                        {"desc" in item && (item as any).desc && (
                                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                                            {(item as any).desc}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-center mt-3">
                              <span
                                data-slide-counter
                                className="text-xs font-medium text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-full tabular-nums"
                              >
                                1 / {totalSlides}
                              </span>
                            </div>
                          </div>

                          {/* Desktop: full grid */}
                          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                            {items.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border/50 hover:border-primary/20 hover:shadow-sm transition-all"
                              >
                                <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground leading-relaxed">{item.text}</p>
                                  {"desc" in item && (item as any).desc && (
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                      {(item as any).desc}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </motion.div>
                </section>
              );
            })()}

            {/* Chapter Roadmap Timeline */}
            <section
              id="free-videos-section"
              className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 sm:pb-20 lg:pb-24"
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <div className="flex items-center justify-between mb-6 sm:mb-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-secondary/30 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-secondary-foreground" />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-2xl lg:text-3xl font-bold text-foreground">
                        {t("courseDetail.learningRoadmap")}
                      </h2>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {chapters.length} {t("courseDetail.chapters")} • {totalLessons} {t("courseDetail.lessons")}
                      </p>
                    </div>
                  </div>
                </div>

                {chapters.length > 0 ? (
                  <div className="relative">
                    {/* Vertical timeline line */}
                    <div
                      className={`absolute ${isRTL ? "right-4" : "left-4"} top-4 bottom-4 w-0.5 bg-border hidden sm:block`}
                    />

                    <div className="space-y-4 lg:space-y-5">
                      {chapters.map((chapter, chapterIndex) => {
                        const chTitle = isRTL && chapter.title_ar ? chapter.title_ar : chapter.title;
                        const chProgress = getChapterProgress(chapter);
                        const chDuration = getChapterDuration(chapter);
                        const isComplete = chProgress === 100;
                        const isExpanded = expandedChapters.has(chapter.id);
                        const completedInChapter = chapter.lessons.filter((l) => isLessonCompleted(l.id)).length;

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
                              <div
                                className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                                  isComplete
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : chProgress > 0
                                      ? "bg-primary/20 border-primary/50 text-primary"
                                      : "bg-muted border-border text-muted-foreground"
                                }`}
                              >
                                {isComplete ? <CheckCircle2 className="w-4 h-4" /> : chapterIndex + 1}
                              </div>

                              {/* Chapter content */}
                              <div className="flex-1 min-w-0">
                                <button
                                  onClick={() => toggleChapter(chapter.id)}
                                  className="w-full text-start card-premium p-4 sm:p-5 lg:p-6 transition-all hover:border-primary/30 hover:shadow-md"
                                >
                                  <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="min-w-0">
                                      <h3 className="font-semibold text-foreground text-base sm:text-lg">{chTitle}</h3>
                                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                          <BookOpen className="w-3.5 h-3.5" />
                                          {chapter.lessons.length} {t("courseDetail.lessons")}
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <Clock className="w-3.5 h-3.5" />
                                          {formatDuration(chDuration)}
                                        </span>
                                        {!isEnrolled && chapter.lessons.some((l) => l.is_free) && (
                                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-semibold">
                                            <Unlock className="w-3.5 h-3.5" />
                                            {chapter.lessons.filter((l) => l.is_free).length}{" "}
                                            {t("courseDetail.freePreview")}
                                          </span>
                                        )}
                                        {chapter.is_free && isEnrolled && (
                                          <span className="text-primary font-medium">{t("courseDetail.free")}</span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Progress badge */}
                                    {isEnrolled && (
                                      <span
                                        className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${
                                          isComplete
                                            ? "bg-primary/20 text-primary"
                                            : chProgress > 0
                                              ? "bg-muted text-foreground"
                                              : "bg-muted/50 text-muted-foreground"
                                        }`}
                                      >
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
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.25 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="mt-2 ms-0 space-y-1">
                                        {/* Sort free lessons first for non-enrolled users */}
                                        {[...chapter.lessons]
                                          .sort((a, b) => {
                                            if (!isEnrolled) {
                                              if (a.is_free && !b.is_free) return -1;
                                              if (!a.is_free && b.is_free) return 1;
                                            }
                                            return 0;
                                          })
                                          .map((lesson) => {
                                            const locked = isLessonLocked(lesson, chapter);
                                            const state = getLessonState(lesson.id);
                                            const lTitle = isRTL && lesson.title_ar ? lesson.title_ar : lesson.title;

                                            return (
                                              <Link
                                                key={lesson.id}
                                                to={locked ? "#" : `/courses/${id}/lessons/${lesson.id}`}
                                                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${
                                                  locked
                                                    ? "opacity-60 cursor-not-allowed"
                                                    : lesson.is_free && !isEnrolled
                                                      ? "bg-green-500/5 hover:bg-green-500/10 border border-green-500/15"
                                                      : "hover:bg-muted/50"
                                                }`}
                                                onClick={(e) => locked && e.preventDefault()}
                                              >
                                                <div className="flex-shrink-0">
                                                  {locked ? (
                                                    <Lock className="w-4 h-4 text-muted-foreground" />
                                                  ) : lesson.is_free && !isEnrolled ? (
                                                    <Unlock className="w-4 h-4 text-green-500" />
                                                  ) : state === "completed" ? (
                                                    <CheckCircle2 className="w-4 h-4 text-primary" />
                                                  ) : state === "in_progress" ? (
                                                    <div className="w-4 h-4 rounded-full border-2 border-primary bg-primary/20" />
                                                  ) : (
                                                    <Play className="w-4 h-4 text-muted-foreground" />
                                                  )}
                                                </div>
                                                <span
                                                  className={`flex-1 truncate ${lesson.is_free && !isEnrolled ? "text-foreground font-medium" : "text-foreground"}`}
                                                >
                                                  {lTitle}
                                                </span>
                                                {lesson.duration_minutes && (
                                                  <span className="text-xs text-muted-foreground flex-shrink-0">
                                                    {lesson.duration_minutes}
                                                    {t("courseDetail.minuteAbbr")}
                                                  </span>
                                                )}
                                                {lesson.is_free && !isEnrolled ? (
                                                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 flex-shrink-0 flex items-center gap-1">
                                                    <Eye className="w-3 h-3" />
                                                    {t("courseDetail.freePreview")}
                                                  </span>
                                                ) : locked ? (
                                                  <Lock className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                                                ) : null}
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
                    <p className="text-muted-foreground">{t("courseDetail.noChaptersYet")}</p>
                  </div>
                )}
              </motion.div>
            </section>

            {/* Reviews Section */}
            <CourseReviews courseId={id!} isEnrolled={isEnrolled} />

            {/* You Might Also Like Section */}
            {relatedCourses.length > 0 && (
              <section className="section-container">
                <div className="flex items-center justify-between mb-6 sm:mb-8">
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                    {isRTL ? "قد يعجبك أيضاً" : "You Might Also Like"}
                  </h2>
                  <Button variant="outline" size="sm" className="text-xs" asChild>
                    <Link to="/courses">
                      <Eye className="w-3.5 h-3.5 me-1.5" />
                      {isRTL ? "عرض الكل" : "View All"}
                    </Link>
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-7">
                  {relatedCourses.slice(0, 4).map((rc: any, idx: number) => (
                    <CourseCard key={rc.id} course={rc} index={idx} enrollment={getRelatedEnrollment(rc.id)} />
                  ))}
                </div>
              </section>
            )}
          </main>

          <Footer />
        </div>

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
                discount_percentage: effectiveDiscount,
                thumbnail_url: course.thumbnail_url,
              }}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["enrollment", id, user?.id] });
                navigate(`/payment-success?course=${id}&tap_id=free_enrollment`);
              }}
              onPaymentStarted={() => setIsPaymentProcessing(true)}
            />
          </>
        )}

        {/* Spacer for sticky bottom bar on mobile */}
        {!isEnrolled && course && <div className="h-20 lg:hidden safe-area-bottom" />}

        {/* Sticky Bottom Bar — mobile only, hidden when enrolled */}
        <AnimatePresence>
          {showStickyBottom && !isEnrolled && !showCheckout && !isPaymentProcessing && course && (
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
                    const priceInfo = getCoursePriceInfo(course.id, course.price, effectiveDiscount);
                    const sym = getCurrencySymbol(priceInfo.currency, isRTL);
                    if (course.price === 0) {
                      return <span className="text-lg font-black text-foreground">{t("common.free")}</span>;
                    }
                    return (
                      <div className="flex items-center gap-2">
                        {priceInfo.discountPct > 0 && (
                          <span className="text-xs text-muted-foreground line-through">
                            {priceInfo.originalPrice} {sym}
                          </span>
                        )}
                        <span className="text-lg font-black text-foreground">
                          {priceInfo.finalPrice} {sym}
                        </span>
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
                      {t("courseDetail.enrollFree")}
                    </Button>
                  ) : (
                    <Button className="btn-cta h-11 text-sm px-6 flex-shrink-0" asChild>
                      <Link to={`/login?returnTo=${encodeURIComponent(window.location.pathname)}`}>
                        <Zap className="w-4 h-4 me-1.5" />
                        {t("courseDetail.enrollFree")}
                      </Link>
                    </Button>
                  )
                ) : (
                  <Button
                    className="btn-cta h-11 text-sm px-6 flex-shrink-0"
                    onClick={() =>
                      user
                        ? setShowCheckout(true)
                        : navigate(`/signup?returnTo=${encodeURIComponent(`/courses/${id}?checkout=true`)}`)
                    }
                  >
                    <ShoppingCart className="w-4 h-4 me-1.5" />
                    {(() => {
                      const info = getCoursePriceInfo(course.id, course.price, effectiveDiscount);
                      const sym = getCurrencySymbol(info.currency, isRTL);
                      return isRTL
                        ? `اشترك الآن – ${info.finalPrice} ${sym}`
                        : `Subscribe now – ${info.finalPrice} ${sym}`;
                    })()}
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default CourseDetail;
