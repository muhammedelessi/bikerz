import React, { useMemo } from "react";
import AnimatedCounter from "@/components/common/AnimatedCounter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Play, Users } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { HeroContent } from "@/hooks/useLandingContent";

interface HeroLandingContent extends HeroContent {
  defaultHeroImage?: string;
  show_stats?: boolean | string;
  show_badge?: boolean | string;
  stats_members_value?: string | number;
  stats_lessons_value?: string | number;
  stats_success_value?: string | number;
  stats_courses_value?: string | number;
}

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

const StatCard: React.FC<{
  value: string;
  label: string;
  sublabel: string;
  index: number;
  isRTL: boolean;
}> = ({ value, label, sublabel, index, isRTL }) => (
  <div className={`anim-fade-up anim-delay-${Math.min(index + 1, 8)} group`}>
    <div
      className={`
        bg-white/[0.04] hover:bg-white/[0.07]
        border border-white/[0.08]
        rounded-lg p-3 sm:p-4
        transition-all duration-300 cursor-default h-full
        ${isRTL ? 'border-r-[3px] border-r-primary' : 'border-l-[3px] border-l-primary'}
      `}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
        <span className="text-[10px] text-primary/80 uppercase tracking-[0.12em] font-bold">
          {label}
        </span>
      </div>
      <AnimatedCounter
        value={value}
        className="text-2xl sm:text-3xl font-black text-white leading-none mb-1 block"
      />
      <div className="text-[10px] text-white/30 uppercase tracking-[0.12em] font-semibold">
        {sublabel}
      </div>
    </div>
  </div>
);

interface HeroSectionProps {
  content?: HeroLandingContent;
  isLoading?: boolean;
}

const HeroSection: React.FC<HeroSectionProps> = ({ content }) => {
  const { isRTL } = useLanguage();
  const ref = useScrollReveal() as React.RefObject<HTMLElement>;

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

  const membersValue = content?.stats_members_value
    ? String(content.stats_members_value)
    : formatCount(stats?.members ?? 0);
  const lessonsValue = content?.stats_lessons_value
    ? String(content.stats_lessons_value)
    : formatCount(stats?.lessons ?? 0);
  const successValue = content?.stats_success_value
    ? `${content.stats_success_value}%`
    : stats?.successRate
      ? `${stats.successRate}%`
      : "0%";
  const coursesValue = content?.stats_courses_value
    ? String(content.stats_courses_value)
    : formatCount(stats?.courses ?? 0);

  const displayStats = useMemo(
    () => [
      { key: "members", value: membersValue, label: "Members", sublabel: isRTL ? "عضو" : "Members" },
      { key: "success", value: successValue, label: "Success", sublabel: isRTL ? "نسبة النجاح" : "Success Rate" },
      { key: "lessons", value: lessonsValue, label: "Lessons", sublabel: isRTL ? "درس" : "Lessons" },
      { key: "courses", value: coursesValue, label: "Courses", sublabel: isRTL ? "دورة" : "Courses" },
    ],
    [membersValue, lessonsValue, successValue, coursesValue, isRTL],
  );

  const ctaText = isRTL
    ? content?.secondary_cta_ar || "استكشف الدورات"
    : content?.secondary_cta_en || "Explore Courses";

  return (
    <section
      ref={ref}
      className="relative flex flex-col overflow-hidden bg-black"
      style={{ minHeight: "100svh" }}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* ── Background Image ── */}
      <div className="absolute inset-0 z-0">
        <picture>
          {/* AVIF — preferred when supported (mobile + desktop) */}
          <source type="image/avif" media="(max-width: 768px)" srcSet="/hero-rider-mobile.avif" />
          <source type="image/avif" srcSet="/hero-rider.avif" />
          <source type="image/webp" media="(max-width: 768px)" srcSet="/hero-rider-mobile.webp" />
          <source type="image/webp" srcSet="/hero-rider.webp" />
          <img
            src="/hero-rider.jpg"
            alt={isRTL ? "أكاديمية بايكرز" : "Bikerz Academy"}
            width={1200}
            height={600}
            className="w-full h-full min-h-0 object-cover"
            loading="eager"
            decoding="async"
            sizes="100vw"
            // React 18 doesn't whitelist `fetchPriority` (camelCase) — passing it
            // raw triggers a console warning. Spread the lowercase HTML attribute
            // instead so the browser still gets `fetchpriority="high"` for LCP.
            {...({ fetchpriority: "high" } as Record<string, string>)}
          />
        </picture>
      </div>

      {/* ── Overlay Stack ── */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-black via-black/75 to-black/30" />
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/60 via-transparent to-transparent" />
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background: isRTL
            ? "linear-gradient(to left, rgba(0,0,0,0.55), transparent 55%)"
            : "linear-gradient(to right, rgba(0,0,0,0.55), transparent 55%)",
        }}
      />

      {/* ── Orange top accent line ── */}
      <div className="absolute top-0 left-0 right-0 z-[2] h-[3px] bg-gradient-to-r from-transparent via-primary to-transparent" />

      {/* ── Main Content ── */}
      <div
        className="relative z-10 flex-1 flex flex-col items-center justify-center
                      max-w-[920px] mx-auto w-full px-5 sm:px-8
                      pt-20 sm:pt-24 pb-8 sm:pb-12 text-center"
      >
        {/* Badge */}
        <div className="anim-fade-up mb-5 sm:mb-7">
          <span
            className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full
              text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em]
              bg-primary/20 text-primary
              border border-primary/50 backdrop-blur-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            {isRTL ? "أكاديمية بايكرز" : "BIKERZ Academy"}
          </span>
        </div>

        {/* Title */}
        <h1
          className="anim-fade-up anim-delay-1 text-[32px] sm:text-5xl md:text-6xl lg:text-[68px]
                     font-black leading-[1.05] tracking-tighter
                     text-white mb-4 sm:mb-5 max-w-3xl"
        >
          {isRTL ? (
            <>لنقد <span className="text-primary">بثقة</span></>
          ) : (
            <>Ride with <span className="text-primary">Confidence</span></>
          )}
        </h1>

        {/* Orange accent line */}
        <div className="anim-fade-up anim-delay-1 flex items-center gap-3 mb-5 sm:mb-6">
          <div className="h-[2px] w-12 bg-primary/40 rounded-full" />
          <div className="h-[2px] w-20 bg-primary rounded-full" />
          <div className="h-[2px] w-12 bg-primary/40 rounded-full" />
        </div>

        {/* Subtitle */}
        <p
          className="anim-fade-up anim-delay-2 text-[14px] sm:text-base md:text-lg
                     text-white/60 leading-[1.8] font-normal
                     mb-8 sm:mb-10 max-w-lg"
        >
          {isRTL
            ? content?.subtitle_ar || "انطلق في رحلتك مع أفضل مدربي الدراجات النارية"
            : content?.subtitle_en || "Start your journey with expert motorcycle instructors"}
        </p>

        {/* CTA Buttons */}
        <div className="anim-fade-up anim-delay-3 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center w-full sm:w-auto">
          <Link to="/courses" className="sm:flex-none">
            <Button
              variant="hero"
              size="default"
              className="w-full group gap-2.5 px-7 sm:px-10 py-4 sm:py-5
                         text-xs sm:text-sm font-black uppercase tracking-widest
                         shadow-[0_4px_30px_rgba(232,66,10,0.45)]
                         hover:shadow-[0_6px_40px_rgba(232,66,10,0.65)]
                         transition-all duration-300 rounded-sm"
            >
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current transition-transform group-hover:scale-125" />
              {ctaText}
            </Button>
          </Link>
          <Link to="/join-community" className="sm:flex-none">
            <Button
              variant="heroOutline"
              size="default"
              className="w-full group gap-2.5 px-7 sm:px-10 py-4 sm:py-5
                         text-xs sm:text-sm font-bold uppercase tracking-widest
                         border-white/20 text-white/70
                         hover:bg-white/[0.08] hover:border-primary/40 hover:text-white
                         transition-all duration-300 rounded-sm"
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" />
              {isRTL ? "انضم لمجتمع بايكرز" : "Join Bikerz Community"}
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="relative z-10 w-full anim-fade-up anim-delay-4">
        <div className="max-w-[860px] mx-auto px-4 sm:px-6 pb-10 sm:pb-14">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {showStats && displayStats.map((stat, i) => (
              <StatCard
                key={stat.key}
                value={stat.value}
                label={stat.label}
                sublabel={stat.sublabel}
                index={i}
                isRTL={isRTL}
              />
            ))}
          </div>
        </div>
      </div>


    </section>
  );
};

export default HeroSection;