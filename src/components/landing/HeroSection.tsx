import React, { useMemo } from "react";
import AnimatedCounter from "@/components/common/AnimatedCounter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Play,
  Users,
  GraduationCap,
  PlayCircle,
  BookOpen,
} from "lucide-react";
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

/* ─────────────────────────────────────────────
   Stat Card — redesigned: clean glass pill
   ───────────────────────────────────────────── */
const StatCard: React.FC<{
  value: string;
  label: string;
  icon: React.ElementType;
  index: number;
}> = ({ value, label, icon: Icon, index }) => (
  <div
    className={`anim-fade-up anim-delay-${Math.min(index + 1, 8)} group relative flex flex-col items-center text-center`}
  >
    {/* Icon */}
    <div
      className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-primary/10 border border-primary/20
                    flex items-center justify-center mb-2 sm:mb-3
                    group-hover:bg-primary/20 group-hover:border-primary/40
                    group-hover:scale-105 transition-all duration-300"
    >
      <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
    </div>

    {/* Value */}
    <AnimatedCounter
      value={value}
      className="text-xl sm:text-2xl md:text-[28px] font-black text-white leading-none tracking-tight"
    />

    {/* Label */}
    <span className="mt-1 text-[9px] sm:text-[10px] text-white/40 uppercase tracking-[0.16em] font-semibold">
      {label}
    </span>
  </div>
);

/* ─────────────────────────────────────────────
   Hero Section
   ───────────────────────────────────────────── */
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
      { key: "members", value: membersValue, label: isRTL ? "عضو" : "Members", icon: Users },
      { key: "success", value: successValue, label: isRTL ? "نسبة النجاح" : "Success", icon: GraduationCap },
      { key: "lessons", value: lessonsValue, label: isRTL ? "درس" : "Lessons", icon: PlayCircle },
      { key: "courses", value: coursesValue, label: isRTL ? "دورة" : "Courses", icon: BookOpen },
    ],
    [membersValue, lessonsValue, successValue, coursesValue, isRTL],
  );

  const title = isRTL ? content?.title_ar || "لنقد بثقة" : content?.title_en || "Ride with Confidence";
  const subtitle = isRTL
    ? content?.subtitle_ar || "انطلق في رحلتك مع أفضل مدربي الدراجات النارية"
    : content?.subtitle_en || "Start your journey with expert motorcycle instructors";
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
      {/* ── Background Image with Ken Burns ── */}
      <div className="absolute inset-0 z-0">
        <picture>
          <source media="(max-width: 768px)" srcSet="/hero-rider-mobile.webp" />
          <img
            src="/hero-rider.webp"
            alt=""
            width={1920}
            height={1080}
            className="w-full h-full object-cover"
            loading="eager"
            fetchPriority="high"
            decoding="sync"
          />
        </picture>
      </div>

      {/* ── Overlay stack for depth ── */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-black via-black/60 to-black/20" />
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/40 via-transparent to-transparent" />
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background: isRTL
            ? "linear-gradient(to left, rgba(0,0,0,0.3), transparent 50%)"
            : "linear-gradient(to right, rgba(0,0,0,0.3), transparent 50%)",
        }}
      />

      {/* ── Main Content ── */}
      <div
        className="relative z-10 flex-1 flex flex-col items-center justify-center
                      max-w-[900px] mx-auto w-full px-5 sm:px-8
                      pt-20 sm:pt-24 pb-8 sm:pb-12 text-center"
      >
        {/* Badge */}
        <div className="anim-fade-up mb-5 sm:mb-7">
          <span
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full
                           text-[10px] sm:text-xs font-bold uppercase tracking-[0.14em]
                           bg-white/[0.06] text-primary/90
                           border border-primary/20 backdrop-blur-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            {isRTL ? "أكاديمية بايكرز" : "BIKERZ Academy"}
          </span>
        </div>

        {/* Title */}
        <h1
          className="anim-fade-up anim-delay-1 text-[28px] sm:text-4xl md:text-5xl lg:text-[56px]
                     font-black leading-[1.1] tracking-tight
                     text-white mb-4 sm:mb-5 max-w-3xl"
        >
          {title}
        </h1>

        {/* Subtitle */}
        <p
          className="anim-fade-up anim-delay-2 text-[14px] sm:text-base md:text-lg
                     text-white/55 leading-[1.7] font-normal
                     mb-7 sm:mb-9 max-w-lg"
        >
          {subtitle}
        </p>

        {/* CTA Buttons */}
        <div
          className="anim-fade-up anim-delay-3 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center w-full sm:w-auto"
        >
          <Link to="/courses" className="sm:flex-none">
            <Button
              variant="hero"
              size="default"
              className="w-full group gap-2.5 px-6 sm:px-8 py-3.5 sm:py-4
                         text-xs sm:text-sm font-bold uppercase tracking-wide
                         shadow-[0_4px_24px_rgba(232,66,10,0.3)]
                         hover:shadow-[0_6px_32px_rgba(232,66,10,0.45)]
                         transition-shadow duration-300"
            >
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current transition-transform group-hover:scale-110" />
              {ctaText}
            </Button>
          </Link>
          <Link to="/join-community" className="sm:flex-none">
            <Button
              variant="heroOutline"
              size="default"
              className="w-full group gap-2.5 px-6 sm:px-8 py-3.5 sm:py-4
                         text-xs sm:text-sm font-bold uppercase tracking-wide
                         border-white/15 text-white/70
                         hover:bg-white/[0.06] hover:border-white/25 hover:text-white
                         transition-all duration-300"
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" />
              {isRTL ? "انضم لمجتمع بايكرز" : "Join Bikerz Community"}
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Stats Bar — anchored to bottom ── */}
      <div className="relative z-10 w-full anim-fade-up anim-delay-4">
        <div className="max-w-[780px] mx-auto px-4 sm:px-6 pb-8 sm:pb-12">
          <div
            className="grid grid-cols-4 gap-1 sm:gap-0
                          rounded-2xl sm:rounded-3xl overflow-hidden
                          bg-white/[0.04] border border-white/[0.07]
                          backdrop-blur-md
                          divide-x divide-white/[0.06]
                          py-4 sm:py-6"
            style={{ minHeight: '80px' }}
          >
            {showStats && displayStats.map((stat, i) => (
              <StatCard
                key={stat.key}
                value={stat.value}
                label={stat.label}
                icon={stat.icon}
                index={i}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Scroll hint ── */}
      <div
        className="anim-fade anim-delay-6 absolute bottom-3 left-1/2 -translate-x-1/2 z-10
                   flex flex-col items-center gap-1"
      >
        <div className="w-[18px] h-7 rounded-full border border-white/15 flex justify-center pt-[5px]">
          <span
            className="w-[2px] h-2 bg-primary rounded-full animate-scroll-dot"
          />
        </div>
        <span className="text-[7px] uppercase tracking-[0.2em] text-white/20 font-semibold">
          {isRTL ? "مرّر" : "scroll"}
        </span>
      </div>
    </section>
  );
};

export default HeroSection;
