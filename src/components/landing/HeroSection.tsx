import React, { useMemo } from "react";
import AnimatedCounter from "@/components/common/AnimatedCounter";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Play, Users, GraduationCap, PlayCircle, BookOpen } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLandingContent, HeroContent } from "@/hooks/useLandingContent";
import heroRiderBg from "@/assets/hero-rider.webp";

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

/* ─── Star icon ─────────────────────────────────────────────────── */
const StarIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="#F59F00" stroke="none">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

/* ─── Stat Cell ─────────────────────────────────────────────────── */
const StatCell: React.FC<{
  label: string;
  value: string;
  desc: string;
  index: number;
  reduced: boolean | null;
}> = ({ label, value, desc, index, reduced }) => (
  <m.div
    initial={reduced ? {} : { opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, delay: 0.7 + index * 0.1, ease: "easeOut" }}
    className="group relative px-6 py-5 border-r border-white/[0.07] last:border-r-0
               hover:bg-white/[0.025] transition-colors duration-200 overflow-hidden"
  >
    {/* Top accent line */}
    <span
      className="absolute top-0 inset-x-0 h-[2px] bg-primary
                 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"
    />
    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 mb-1.5">{label}</p>
    <AnimatedCounter value={value} className="text-3xl font-black text-primary leading-none tracking-tight mb-1" />
    <p className="text-xs text-white/35 font-medium">{desc}</p>
  </m.div>
);

/* ─── Hero Section ──────────────────────────────────────────────── */
const HeroSection: React.FC = () => {
  const { isRTL } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const { data: content } = useLandingContent<HeroLandingContent>("hero");

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

  const statCells = useMemo(
    () => [
      {
        key: "members",
        label: isRTL ? "الأعضاء" : "Members",
        value: membersValue,
        desc: isRTL ? "عضو نشط في المجتمع" : "Active community members",
      },
      {
        key: "success",
        label: isRTL ? "نسبة النجاح" : "Success Rate",
        value: successValue,
        desc: isRTL ? "من الطلاب ينهون الدورة" : "Students complete the course",
      },
      {
        key: "lessons",
        label: isRTL ? "الدروس" : "Lessons",
        value: lessonsValue,
        desc: isRTL ? "درس مسجل ومباشر" : "Recorded & live lessons",
      },
      {
        key: "courses",
        label: isRTL ? "الدورات" : "Courses",
        value: coursesValue,
        desc: isRTL ? "دورة من المبتدئ للمحترف" : "From beginner to expert",
      },
    ],
    [membersValue, lessonsValue, successValue, coursesValue, isRTL],
  );

  const anim = (dur: number, delay = 0) => (prefersReducedMotion ? { duration: 0 } : { duration: dur, delay });

  const title = isRTL
    ? content?.title_ar || "تعلّم القيادة بثقة واحترافية"
    : content?.title_en || "Ride with Confidence & Skill";
  const subtitle = isRTL
    ? content?.subtitle_ar || "من المبتدئ حتى المحترف — دورات دراجات نارية مع مدربين معتمدين وخبرة حقيقية على الطريق"
    : content?.subtitle_en ||
      "From beginner to pro — motorcycle courses with certified instructors and real road experience";
  const ctaText = isRTL
    ? content?.secondary_cta_ar || "استكشف الدورات"
    : content?.secondary_cta_en || "Explore Courses";

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="flex flex-col bg-[#0C0D0F]">
        {/* ══ HERO SPLIT LAYOUT ══════════════════════════════════════ */}
        <section className="grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100vh-64px)]">
          {/* ── Left: Content ── */}
          <div
            className={`flex flex-col justify-center px-6 sm:px-10 lg:px-14 py-16 lg:py-20
                        ${isRTL ? "lg:order-2" : "lg:order-1"}`}
          >
            {/* Eyebrow badge */}
            <m.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={anim(0.5, 0.1)}
              className="mb-7"
            >
              <span
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
                            text-[11px] font-bold uppercase tracking-[0.16em]
                            bg-primary/10 text-primary border border-primary/25"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {isRTL ? "أكاديمية بايكرز" : "BIKERZ Academy"}
              </span>
            </m.div>

            {/* Heading */}
            <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={anim(0.65, 0.22)}>
              <h1
                className="text-[clamp(2.2rem,4.5vw,3.5rem)] font-black leading-[1.07]
                           tracking-tight text-white mb-3"
              >
                {title}
              </h1>
              {/* Accent underline */}
              <div className="flex items-center gap-3 mb-6">
                <span className="text-[clamp(1.1rem,2vw,1.5rem)] font-bold text-primary">
                  {isRTL ? "على الطريق" : "On the Road"}
                </span>
                <span className="h-[3px] w-10 rounded-full bg-primary opacity-50" />
              </div>
            </m.div>

            {/* Subtitle */}
            <m.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={anim(0.55, 0.38)}
              className="text-[15px] leading-[1.75] text-white/55 max-w-[480px] mb-9 font-medium"
            >
              {subtitle}
            </m.p>

            {/* CTA Buttons */}
            <m.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={anim(0.5, 0.5)}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-10"
            >
              <Link to="/courses">
                <Button
                  variant="hero"
                  size="default"
                  className="group gap-2 px-7 py-4 text-sm font-bold w-full sm:w-auto
                             shadow-[0_8px_32px_rgba(255,90,31,0.30)]
                             hover:shadow-[0_12px_44px_rgba(255,90,31,0.48)]
                             transition-shadow duration-300"
                >
                  <Play className="w-4 h-4 transition-transform group-hover:scale-110" />
                  {ctaText}
                </Button>
              </Link>
              <Link to="/join-community">
                <Button
                  variant="heroOutline"
                  size="default"
                  className="group gap-2 px-6 py-4 text-sm font-semibold w-full sm:w-auto
                             bg-white/[0.04] border-white/[0.12] text-white/75
                             hover:bg-white/[0.09] hover:border-white/25 hover:text-white
                             transition-all duration-200"
                >
                  <Users className="w-4 h-4 transition-transform group-hover:scale-110" />
                  {isRTL ? "انضم للمجتمع" : "Join Community"}
                </Button>
              </Link>
            </m.div>

            {/* Social proof row */}
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={anim(0.5, 0.65)}
              className="flex items-center gap-4"
            >
              {/* Avatars stack */}
              <div className="flex">
                {[
                  { initials: "أح", bg: "#3B5BDB" },
                  { initials: "مع", bg: "#2F9E44" },
                  { initials: "فن", bg: "#E67700" },
                  { initials: "سر", bg: "#862E9C" },
                ].map((av, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-[#0C0D0F] -ml-2.5 first:ml-0
                               flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                    style={{ background: av.bg }}
                  >
                    {av.initials}
                  </div>
                ))}
                <div
                  className="w-8 h-8 rounded-full border-2 border-[#0C0D0F] -ml-2.5
                             flex items-center justify-center text-[9px] font-bold
                             text-white/50 bg-white/[0.07] flex-shrink-0"
                >
                  +1K
                </div>
              </div>
              {/* Stars + text */}
              <div>
                <div className="flex items-center gap-0.5 mb-0.5">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon key={i} />
                  ))}
                </div>
                <p className="text-xs text-white/40 font-medium">
                  <span className="text-white/75 font-bold">+1,200 عضو</span>{" "}
                  {isRTL ? "يثقون بأكاديميتنا" : "trust our academy"}
                </p>
              </div>
            </m.div>
          </div>

          {/* ── Right: Photo ── */}
          <div
            className={`relative overflow-hidden min-h-[300px] lg:min-h-0
                        ${isRTL ? "lg:order-1" : "lg:order-2"}`}
          >
            {/* Photo with scale-in entry */}
            <m.div
              className="absolute inset-0"
              initial={{ scale: 1.08 }}
              animate={{ scale: 1 }}
              transition={{ duration: 1.8, ease: "easeOut" }}
            >
              <img
                src={heroRiderBg}
                alt=""
                width={960}
                height={1080}
                className="w-full h-full object-cover object-center"
                fetchPriority="high"
                decoding="async"
              />
            </m.div>

            {/* Gradient: fades left to blend with content col */}
            <div
              className={`absolute inset-0 ${
                isRTL
                  ? "bg-gradient-to-l from-[#0C0D0F] via-[#0C0D0F]/30 to-transparent"
                  : "bg-gradient-to-r from-[#0C0D0F] via-[#0C0D0F]/30 to-transparent"
              }`}
            />
            {/* Top/bottom fades */}
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#0C0D0F] to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0C0D0F] to-transparent" />

            {/* ── Floating info card ── */}
            <m.div
              initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={anim(0.6, 0.9)}
              className={`absolute bottom-10 ${isRTL ? "right-6 lg:-right-6" : "left-6 lg:-left-6"}
                          bg-[#141518]/90 border border-white/[0.09] rounded-2xl
                          px-5 py-4 backdrop-blur-xl w-52 z-20 hidden sm:block`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 mb-2">
                {isRTL ? "نسبة النجاح الكلية" : "Overall Success Rate"}
              </p>
              <p className="text-[28px] font-black text-white leading-none mb-1">
                <span className="text-primary">{successValue.replace("%", "")}</span>
                <span className="text-white/25 text-lg">%</span>
              </p>
              <p className="text-xs text-white/35 mb-3">{isRTL ? "من إجمالي الطلاب" : "of total students"}</p>
              {/* Progress bar */}
              <div className="h-1 bg-white/[0.07] rounded-full overflow-hidden">
                <m.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: successValue }}
                  transition={{ duration: 1.4, delay: 1.2, ease: "easeOut" }}
                />
              </div>
            </m.div>

            {/* ── Floating badge top ── */}
            <m.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={anim(0.5, 0.8)}
              className={`absolute top-8 ${isRTL ? "left-6" : "right-6"}
                          bg-[#141518]/88 border border-white/[0.09] rounded-xl
                          px-4 py-3 backdrop-blur-xl z-20 hidden sm:block`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 border border-primary/20">
                  <GraduationCap className="w-4 h-4 text-primary" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-white leading-tight">
                    {isRTL ? "مدربون معتمدون" : "Certified Instructors"}
                  </p>
                  <p className="text-[11px] text-white/40">{isRTL ? "خبرة +10 سنوات" : "+10 years experience"}</p>
                </div>
              </div>
            </m.div>
          </div>
        </section>

        {/* ══ STATS BAR ══════════════════════════════════════════════ */}
        {showStats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-white/[0.07] bg-[#141518]">
            {statCells.map((cell, i) => (
              <StatCell
                key={cell.key}
                label={cell.label}
                value={cell.value}
                desc={cell.desc}
                index={i}
                reduced={prefersReducedMotion}
              />
            ))}
          </div>
        )}
      </div>
    </LazyMotion>
  );
};

export default HeroSection;
