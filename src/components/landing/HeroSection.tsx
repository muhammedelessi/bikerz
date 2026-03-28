import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import AnimatedCounter from "@/components/common/AnimatedCounter";
import { LazyMotion, domAnimation, m, useReducedMotion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Play, ShieldCheck, CreditCard, Award, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import defaultHeroImage from "@/assets/hero-rider.webp";
import { useLandingContent, HeroContent } from "@/hooks/useLandingContent";
import { Skeleton } from "@/components/ui/skeleton";
import DiscountUrgencyBanner from "@/components/landing/DiscountUrgencyBanner";

/* ── Types ── */
type HeroLandingContent = HeroContent & {
  stats_members_value?: string | number;
  stats_lessons_value?: string | number;
  stats_success_value?: string | number;
  stats_courses_value?: string | number;
  stats_members_en?: string;
  stats_members_ar?: string;
  stats_lessons_en?: string;
  stats_lessons_ar?: string;
  stats_success_en?: string;
  stats_success_ar?: string;
  stats_courses_en?: string;
  stats_courses_ar?: string;
  show_stats?: boolean | string;
  show_badge?: string | boolean;
  defaultHeroImage?: string;
};

interface HeroSlide {
  id: string;
  position: number;
  image_url: string;
  headline_en: string | null;
  headline_ar: string | null;
  subtitle_en: string | null;
  subtitle_ar: string | null;
  cta_text_en: string | null;
  cta_text_ar: string | null;
  cta_link: string | null;
}

/* ── Helpers ── */
function formatCount(count: number) {
  if (count >= 1000) return `${Math.floor(count / 1000)}K+`;
  return count > 0 ? `${count}+` : "0";
}

async function fetchHeroStats() {
  const [profilesRes, lessonsRes, enrollmentsRes, coursesRes] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("lessons").select("*", { count: "exact", head: true }).eq("is_published", true),
    supabase.from("course_enrollments").select("progress_percentage"),
    supabase.from("courses").select("*", { count: "exact", head: true }).eq("is_published", true),
  ]);
  const usersCount = profilesRes.count ?? 0;
  const lessonsCount = lessonsRes.count ?? 0;
  const coursesCount = coursesRes.count ?? 0;
  const enrollmentStats = enrollmentsRes.data ?? [];
  const successfulEnrollments = enrollmentStats.filter((e) => (e.progress_percentage ?? 0) >= 70).length;
  const successRate =
    enrollmentStats.length > 0 ? Math.round((successfulEnrollments / enrollmentStats.length) * 100) : 0;
  return { members: usersCount, lessons: lessonsCount, successRate, courses: coursesCount };
}

async function fetchHeroSlides(): Promise<HeroSlide[]> {
  const { data, error } = await supabase
    .from("hero_slides")
    .select("id, position, image_url, headline_en, headline_ar, subtitle_en, subtitle_ar, cta_text_en, cta_text_ar, cta_link")
    .eq("is_published", true)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data as HeroSlide[]) ?? [];
}

/* ── Sub-components ── */
const StatItem: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <div className="text-center">
    <AnimatedCounter value={value} className="text-xl sm:text-2xl lg:text-3xl font-black text-primary-foreground" />
    <div className="text-[9px] sm:text-[10px] text-primary-foreground/60 mt-0.5 uppercase tracking-[0.15em] font-semibold">
      {label}
    </div>
  </div>
);

/* ── Swipe hook ── */
function useSwipe(onSwipeLeft: () => void, onSwipeRight: () => void) {
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);
  const minSwipe = 50;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchEnd.current = null;
    touchStart.current = e.targetTouches[0].clientX;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    touchEnd.current = e.targetTouches[0].clientX;
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!touchStart.current || !touchEnd.current) return;
    const distance = touchStart.current - touchEnd.current;
    if (Math.abs(distance) >= minSwipe) {
      if (distance > 0) onSwipeLeft();
      else onSwipeRight();
    }
  }, [onSwipeLeft, onSwipeRight]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}

/* ── Main component ── */
const HeroSection: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const prefersReducedMotion = useReducedMotion();

  /* ── CMS content ── */
  const { data: content, isLoading: contentLoading } = useLandingContent<HeroLandingContent>("hero");

  /* ── Slides from DB ── */
  const { data: slides = [] } = useQuery({
    queryKey: ["hero-slides"],
    queryFn: fetchHeroSlides,
    staleTime: 5 * 60 * 1000,
  });

  const hasSlides = slides.length > 0;
  const slideCount = hasSlides ? slides.length : 1;

  /* ── Slider state ── */
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide((index + slideCount) % slideCount);
  }, [slideCount]);

  const nextSlide = useCallback(() => goToSlide(currentSlide + 1), [currentSlide, goToSlide]);
  const prevSlide = useCallback(() => goToSlide(currentSlide - 1), [currentSlide, goToSlide]);

  // Swipe for RTL: swap directions
  const swipeHandlers = useSwipe(
    isRTL ? prevSlide : nextSlide,
    isRTL ? nextSlide : prevSlide,
  );

  // Auto-advance every 5s
  useEffect(() => {
    if (slideCount <= 1 || isPaused || prefersReducedMotion) return;
    intervalRef.current = setInterval(nextSlide, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [slideCount, isPaused, nextSlide, prefersReducedMotion]);

  /* ── Stats ── */
  const showStats = content?.show_stats !== false && content?.show_stats !== "false";
  const needsLiveStats = useMemo(() => {
    if (!content) return true;
    if (!showStats) return false;
    return !content.stats_members_value || !content.stats_lessons_value || !content.stats_success_value;
  }, [content, showStats]);

  const { data: stats } = useQuery({
    queryKey: ["hero-stats"],
    queryFn: fetchHeroStats,
    staleTime: 5 * 60 * 1000,
    enabled: needsLiveStats,
  });

  const membersValue = content?.stats_members_value ? String(content.stats_members_value) : formatCount(stats?.members ?? 0);
  const lessonsValue = content?.stats_lessons_value ? String(content.stats_lessons_value) : formatCount(stats?.lessons ?? 0);
  const successValue = content?.stats_success_value ? `${content.stats_success_value}%` : stats?.successRate ? `${stats.successRate}%` : "0%";
  const coursesValue = content?.stats_courses_value ? String(content.stats_courses_value) : formatCount(stats?.courses ?? 0);

  const displayStats = useMemo(
    () => [
      { key: "members", value: membersValue, label: isRTL ? content?.stats_members_ar || "عضو" : content?.stats_members_en || "Members" },
      { key: "success", value: successValue, label: isRTL ? content?.stats_success_ar || "نسبة النجاح" : content?.stats_success_en || "Success" },
      { key: "lessons", value: lessonsValue, label: isRTL ? content?.stats_lessons_ar || "درس" : content?.stats_lessons_en || "Lessons" },
      { key: "courses", value: coursesValue, label: isRTL ? content?.stats_courses_ar || "دورة" : content?.stats_courses_en || "Courses" },
    ],
    [membersValue, lessonsValue, successValue, coursesValue, isRTL, content],
  );

  /* ── Text helpers ── */
  const getText = (enKey: keyof HeroContent, arKey: keyof HeroContent, fallbackEn: string, fallbackAr: string) => {
    if (!content) return isRTL ? fallbackAr : fallbackEn;
    return isRTL ? content[arKey] || fallbackAr : content[enKey] || fallbackEn;
  };

  const defaultTitle = getText("title_en", "title_ar", t("hero.title", { lng: "en" }), t("hero.title", { lng: "ar" }));
  const defaultSubtitle = getText("subtitle_en", "subtitle_ar", t("hero.subtitle", { lng: "en" }), t("hero.subtitle", { lng: "ar" }));
  const defaultCta = getText("secondary_cta_en", "secondary_cta_ar", t("hero.secondaryCta", { lng: "en" }), t("hero.secondaryCta", { lng: "ar" }));
  const heroImage = content?.defaultHeroImage ?? defaultHeroImage;

  // Current slide data
  const activeSlide = hasSlides ? slides[currentSlide] : null;
  const slideTitle = activeSlide
    ? (isRTL ? activeSlide.headline_ar : activeSlide.headline_en) || defaultTitle
    : defaultTitle;
  const slideSubtitle = activeSlide
    ? (isRTL ? activeSlide.subtitle_ar : activeSlide.subtitle_en) || defaultSubtitle
    : defaultSubtitle;
  const slideCta = activeSlide
    ? (isRTL ? activeSlide.cta_text_ar : activeSlide.cta_text_en) || defaultCta
    : defaultCta;
  const slideLink = activeSlide?.cta_link || "/courses";
  const slideBg = activeSlide?.image_url || heroImage;

  const fade = (dur: number, delay = 0) => (prefersReducedMotion ? { duration: 0 } : { duration: dur, delay });

  return (
    <LazyMotion features={domAnimation} strict>
      <section
        className="relative min-h-[90svh] lg:min-h-[85svh] flex flex-col overflow-hidden"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        {...swipeHandlers}
      >
        {/* ═══ Slide Backgrounds ═══ */}
        <AnimatePresence mode="wait">
          <m.div
            key={currentSlide}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.8 }}
            className="absolute inset-0"
          >
            <img
              src={slideBg}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              loading={currentSlide === 0 ? "eager" : "lazy"}
            />
            {/* Cinematic overlays */}
            <div className="absolute inset-0 bg-near-black/60" />
            <div className="absolute inset-0 bg-gradient-to-t from-near-black via-near-black/50 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-near-black/90 via-near-black/40 to-transparent lg:via-transparent lg:to-near-black/20" />
            <div className="absolute bottom-0 left-0 w-[60%] h-[40%] bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--primary)/0.15),transparent_70%)] pointer-events-none" />
          </m.div>
        </AnimatePresence>

        {/* Grain */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay z-[1]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* ═══ Floating Discount Banner ═══ */}
        <m.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={fade(0.5, 0.1)}
          className="relative z-20 pt-3 sm:pt-4 px-4"
        >
          <DiscountUrgencyBanner floating />
        </m.div>

        {/* ═══ Main Content ═══ */}
        <div className="relative z-10 flex-1 flex items-center">
          <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-8 lg:py-0">
            <div className="flex flex-col items-center text-center lg:items-start lg:text-start lg:max-w-[55%]">
              {/* Title */}
              <AnimatePresence mode="wait">
                {contentLoading ? (
                  <Skeleton className="h-14 sm:h-20 w-[85%] mb-4" />
                ) : (
                  <m.h1
                    key={`title-${currentSlide}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
                    className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.5rem] xl:text-6xl font-black leading-[1.1] tracking-tight mb-4 sm:mb-5 text-primary-foreground"
                  >
                    {slideTitle}
                  </m.h1>
                )}
              </AnimatePresence>

              {/* Subtitle */}
              <AnimatePresence mode="wait">
                {contentLoading ? (
                  <Skeleton className="h-6 w-[70%] mb-6" />
                ) : (
                  <m.p
                    key={`sub-${currentSlide}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.4, delay: 0.1 }}
                    className="text-sm sm:text-base lg:text-lg text-sand/80 leading-relaxed max-w-lg mb-6 sm:mb-8"
                  >
                    {slideSubtitle}
                  </m.p>
                )}
              </AnimatePresence>

              {/* CTA */}
              <m.div
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={fade(0.6, 0.65)}
                className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto mb-6 sm:mb-8"
              >
                <Link to={slideLink} className="w-full sm:w-auto">
                  <Button
                    variant="hero"
                    size="lg"
                    className="group w-full sm:w-auto min-h-[48px] sm:min-h-[52px] text-sm sm:text-base shadow-[0_4px_32px_hsl(var(--primary)/0.5)] hover:shadow-[0_6px_40px_hsl(var(--primary)/0.6)] transition-shadow"
                  >
                    <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                    {slideCta}
                  </Button>
                </Link>
              </m.div>
            </div>
          </div>
        </div>

        {/* ═══ Slider Controls ═══ */}
        {slideCount > 1 && (
          <>
            {/* Desktop arrows */}
            <button
              onClick={isRTL ? nextSlide : prevSlide}
              aria-label="Previous slide"
              className="hidden lg:flex absolute start-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-background/20 backdrop-blur-sm border border-border/20 text-primary-foreground/70 hover:bg-background/40 hover:text-primary-foreground transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={isRTL ? prevSlide : nextSlide}
              aria-label="Next slide"
              className="hidden lg:flex absolute end-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-background/20 backdrop-blur-sm border border-border/20 text-primary-foreground/70 hover:bg-background/40 hover:text-primary-foreground transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Dots */}
            <div className="absolute bottom-[calc(theme(spacing.16)+theme(spacing.4))] left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
              {Array.from({ length: slideCount }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToSlide(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`rounded-full transition-all duration-300 ${
                    i === currentSlide
                      ? "w-7 h-2 bg-primary"
                      : "w-2 h-2 bg-primary-foreground/30 hover:bg-primary-foreground/50"
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {/* ═══ Stats Bar ═══ */}
        {showStats && (
          <m.div
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fade(0.7, 0.9)}
            className="relative z-10"
          >
            <div className="bg-primary/10 backdrop-blur-lg border-t border-primary/20">
              <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-3 sm:py-4">
                <div className="grid grid-cols-4 gap-2 sm:gap-4">
                  {displayStats.map((stat) => (
                    <StatItem key={stat.key} value={stat.value} label={stat.label} />
                  ))}
                </div>
              </div>
            </div>
          </m.div>
        )}

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none z-[5]" />
      </section>
    </LazyMotion>
  );
};

export default HeroSection;
