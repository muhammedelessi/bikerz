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
    ? `${content.stats_success_value}`
    : stats?.successRate
      ? `${stats.successRate}`
      : "0";
  const coursesValue = content?.stats_courses_value
    ? String(content.stats_courses_value)
    : formatCount(stats?.courses ?? 0);

  const displayStats = useMemo(
    () => [
      { key: "members", value: membersValue, suffix: "", label: isRTL ? "عضو" : "Members" },
      { key: "success", value: successValue, suffix: "%", label: isRTL ? "نسبة النجاح" : "Success Rate" },
      { key: "lessons", value: lessonsValue, suffix: "", label: isRTL ? "درس" : "Lessons" },
    ],
    [membersValue, lessonsValue, successValue, isRTL],
  );

  const anim = (dur: number, delay = 0) => (prefersReducedMotion ? { duration: 0 } : { duration: dur, delay });

  const titleLine1 = isRTL ? content?.title_ar?.split(" ")[0] || "اركب" : "RIDE";
  const titleLine2 = isRTL ? content?.title_ar?.split(" ").slice(1).join(" ") || "بثقة" : "FREE";
  const subtitle = isRTL
    ? content?.subtitle_ar || "انطلق في رحلتك مع أفضل مدربي الدراجات النارية — من الأساسيات حتى الاحتراف"
    : content?.subtitle_en || "Start your journey with expert motorcycle instructors — from basics to mastery";
  const ctaText = isRTL
    ? content?.secondary_cta_ar || "استكشف الدورات"
    : content?.secondary_cta_en || "Explore Courses";

  return (
    <LazyMotion features={domAnimation} strict>
      <section className="relative flex flex-col overflow-hidden bg-black" style={{ minHeight: "100svh" }}>
        {/* ── Full-bleed photo ── */}
        <m.div
          className="absolute inset-0"
          initial={{ scale: 1.06 }}
          animate={{ scale: 1 }}
          transition={{ duration: 2, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <img
            src={heroRiderBg}
            alt=""
            width={1920}
            height={1080}
            className="w-full h-full object-cover object-center"
            fetchPriority="high"
            decoding="async"
          />
        </m.div>

        {/* ── Cinematic gradient overlays ── */}
        {/* bottom-heavy dark fade — content lives at the bottom */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.6) 28%, rgba(0,0,0,0.15) 55%, transparent 78%)",
          }}
        />
        {/* top fade for nav readability */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 22%)",
          }}
        />

        {/* ── Cinematic letterbox bars ── */}
        <div className="absolute inset-x-0 top-0 h-16 bg-black z-20" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-black z-20" />

        {/* ── Navbar (inside top bar) ── */}
        <m.nav
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={anim(0.6, 0.1)}
          className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 sm:px-10 h-16"
        >
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span
              className="font-black text-[18px] tracking-widest text-white uppercase"
              style={{ fontFamily: "'Barlow Condensed', 'Bebas Neue', sans-serif", letterSpacing: "0.18em" }}
            >
              BIKER<span className="text-primary">Z</span>
            </span>
          </div>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-1">
            {(isRTL ? ["الدورات", "المدربون", "المجتمع"] : ["Courses", "Instructors", "Community"]).map((item) => (
              <button
                key={item}
                className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]
                           text-white/45 hover:text-white rounded transition-colors duration-150
                           border-none bg-transparent cursor-pointer"
              >
                {item}
              </button>
            ))}
          </div>

          {/* CTA */}
          <Link to="/courses">
            <button
              className="text-[11px] font-bold uppercase tracking-[0.14em]
                         text-primary border border-primary/35 bg-primary/08
                         px-5 py-2 rounded cursor-pointer
                         hover:bg-primary/18 hover:border-primary/70
                         transition-all duration-150"
            >
              {isRTL ? "ابدأ الآن" : "Start Now"}
            </button>
          </Link>
        </m.nav>

        {/* ── Main content — pinned to bottom-left ── */}
        <div className="relative z-10 mt-auto px-6 sm:px-10 pb-24 sm:pb-28 max-w-3xl">
          {/* Eyebrow */}
          <m.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={anim(0.55, 0.3)}
            className="flex items-center gap-3 mb-5"
          >
            <span className="w-8 h-[2px] bg-primary rounded-full" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">
              {isRTL ? "أكاديمية بايكرز — تعلّم القيادة الاحترافية" : "BIKERZ Academy — Professional Riding"}
            </span>
          </m.div>

          {/* Giant heading */}
          <m.h1
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={anim(0.75, 0.4)}
            className="font-black uppercase leading-[0.9] tracking-[-2px] mb-6 text-white"
            style={{
              fontFamily: "'Barlow Condensed', 'Bebas Neue', Impact, sans-serif",
              fontSize: "clamp(68px, 13vw, 140px)",
            }}
          >
            {/* Ghost / outline first line */}
            <span
              className="block"
              style={{
                WebkitTextStroke: "1.5px rgba(255,255,255,0.22)",
                color: "transparent",
              }}
            >
              {titleLine1}
            </span>
            {/* Solid accent second line */}
            <span className="block text-primary">{titleLine2}</span>
          </m.h1>

          {/* Subtitle — left-border accent */}
          <m.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={anim(0.6, 0.58)}
            className="text-[14px] sm:text-[15px] font-normal text-white/50 leading-[1.75]
                       max-w-[420px] mb-9 pl-4 border-l-2 border-primary/40"
            style={{ borderLeftColor: "rgba(232,66,10,0.4)" }}
          >
            {subtitle}
          </m.p>

          {/* CTA buttons */}
          <m.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={anim(0.5, 0.7)}
            className="flex items-center gap-5 flex-wrap"
          >
            <Link to="/courses">
              <button
                className="inline-flex items-center gap-2.5 bg-primary text-white
                           font-bold uppercase tracking-[0.14em] text-[13px]
                           px-8 py-4 rounded border-none cursor-pointer
                           hover:opacity-88 hover:-translate-y-[2px]
                           active:scale-[.97] transition-all duration-150"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                <Play className="w-3.5 h-3.5 fill-white stroke-none" />
                {ctaText}
              </button>
            </Link>

            <Link to="/join-community">
              <button
                className="inline-flex items-center gap-2 text-white/55
                           font-bold uppercase tracking-[0.14em] text-[12px]
                           bg-transparent border-none border-b border-white/20 pb-px
                           cursor-pointer hover:text-white hover:border-white/50
                           transition-all duration-150"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                <Users className="w-3.5 h-3.5" />
                {isRTL ? "انضم للمجتمع" : "Join Community"}
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </Link>
          </m.div>
        </div>

        {/* ── Stats — bottom-right ── */}
        {showStats && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={anim(0.6, 0.85)}
            className="absolute bottom-20 right-6 sm:right-10 z-10
                       flex flex-col items-end gap-4"
          >
            {displayStats.map((stat, i) => (
              <React.Fragment key={stat.key}>
                {i > 0 && <span className="w-px h-6 bg-white/10 self-end" />}
                <m.div
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={anim(0.45, 0.9 + i * 0.12)}
                  className="text-right"
                >
                  <div
                    className="font-black text-white leading-none tracking-tight"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: "clamp(28px, 4vw, 40px)",
                    }}
                  >
                    <AnimatedCounter value={`${stat.value}${stat.suffix}`} className="text-primary" />
                  </div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/30 mt-0.5">
                    {stat.label}
                  </p>
                </m.div>
              </React.Fragment>
            ))}
          </m.div>
        )}

        {/* ── Scroll indicator — bottom-center ── */}
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={anim(0.5, 1.3)}
          className="absolute bottom-[72px] left-1/2 -translate-x-1/2 z-10
                     flex flex-col items-center gap-1.5"
        >
          <div className="relative w-[18px] h-7 border border-white/20 rounded-full flex justify-center pt-[5px]">
            <m.span
              className="w-[2px] h-2 bg-primary rounded-full"
              animate={{ y: [0, 8, 0], opacity: [1, 0, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeIn" }}
            />
          </div>
          <span className="text-[8px] uppercase tracking-[0.22em] text-white/20 font-semibold">scroll</span>
        </m.div>
      </section>
    </LazyMotion>
  );
};

export default HeroSection;
