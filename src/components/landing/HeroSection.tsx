import React, { useMemo } from "react";
import AnimatedCounter from "@/components/common/AnimatedCounter";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Play,
  Users,
  GraduationCap,
  PlayCircle,
  BookOpen,
  Shield,
  Bike,
  Route,
  Gauge,
  Trophy,
  Compass,
  Wrench,
} from "lucide-react";
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

/* ─── Floating Icon ─────────────────────────────────────────────── */
const FloatIcon: React.FC<{
  icon: React.ElementType;
  style: React.CSSProperties;
  delay?: number;
  duration?: number;
  reduced: boolean | null;
}> = ({ icon: Icon, style, delay = 0, duration = 6, reduced }) => (
  <m.div
    className="absolute flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11
               rounded-xl backdrop-blur-sm pointer-events-none
               bg-white/[0.06] border border-white/[0.12]"
    style={style}
    initial={reduced ? { opacity: 0.5 } : { opacity: 0, scale: 0.6 }}
    animate={
      reduced ? { opacity: 0.5 } : { opacity: [0, 0.75, 0.55, 0.75], scale: [0.85, 1, 0.92, 1], y: [0, -12, 0, 12, 0] }
    }
    transition={
      reduced ? { duration: 0 } : { duration, delay, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }
    }
  >
    <Icon className="text-white/60 w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.6} />
  </m.div>
);

/* ─── Stat Card ─────────────────────────────────────────────────── */
const StatCard: React.FC<{
  value: string;
  label: string;
  icon: React.ElementType;
  index: number;
  reduced: boolean | null;
}> = ({ value, label, icon: Icon, index, reduced }) => (
  <m.div
    initial={reduced ? {} : { opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.9 + index * 0.1, type: "spring", stiffness: 160 }}
    className="group relative flex flex-col items-center gap-1.5 py-4 sm:py-5 px-2
               overflow-hidden transition-all duration-300
               border-r border-white/[0.08] last:border-r-0
               hover:bg-white/[0.04]"
  >
    {/* bottom accent line on hover */}
    <span
      className="absolute bottom-0 inset-x-0 h-[2px] bg-primary
                 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"
    />

    <div
      className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full
                  bg-primary/10 border border-primary/20 flex items-center justify-center
                  group-hover:scale-110 transition-transform duration-300"
    >
      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
    </div>

    <AnimatedCounter
      value={value}
      className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-none tracking-tight"
    />

    <span
      className="text-[9px] sm:text-[10px] uppercase tracking-[0.15em]
                  font-semibold text-white/40 whitespace-nowrap"
    >
      {label}
    </span>
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

  const displayStats = useMemo(
    () => [
      { key: "members", value: membersValue, label: isRTL ? "عضو" : "Members", icon: Users },
      { key: "success", value: successValue, label: isRTL ? "نسبة النجاح" : "Success", icon: GraduationCap },
      { key: "lessons", value: lessonsValue, label: isRTL ? "درس" : "Lessons", icon: PlayCircle },
      { key: "courses", value: coursesValue, label: isRTL ? "دورة" : "Courses", icon: BookOpen },
    ],
    [membersValue, lessonsValue, successValue, coursesValue, isRTL],
  );

  const anim = (dur: number, delay = 0) => (prefersReducedMotion ? { duration: 0 } : { duration: dur, delay });

  const title = isRTL ? content?.title_ar || "لنقد بثقة" : content?.title_en || "Ride with Confidence";
  const subtitle = isRTL
    ? content?.subtitle_ar || "انطلق في رحلتك مع أفضل مدربي الدراجات النارية"
    : content?.subtitle_en || "Start your journey with expert motorcycle instructors";
  const ctaText = isRTL
    ? content?.secondary_cta_ar || "استكشف الدورات"
    : content?.secondary_cta_en || "Explore Courses";

  const floatIcons = [
    { Icon: Shield, style: { left: "4%", top: "18%" }, delay: 0, duration: 5.5 },
    { Icon: Bike, style: { right: "5%", top: "22%" }, delay: 0.5, duration: 6.5 },
    { Icon: Route, style: { left: "3%", top: "58%" }, delay: 1.0, duration: 7.0 },
    { Icon: Gauge, style: { right: "4%", top: "56%" }, delay: 1.5, duration: 6.2 },
    { Icon: Trophy, style: { left: "6%", top: "38%" }, delay: 0.8, duration: 7.5 },
    { Icon: Compass, style: { right: "6%", top: "40%" }, delay: 1.2, duration: 6.8 },
    { Icon: Wrench, style: { left: "8%", top: "80%" }, delay: 2.0, duration: 7.2 },
    { Icon: GraduationCap, style: { right: "7%", top: "78%" }, delay: 0.3, duration: 8.0 },
  ];

  return (
    <LazyMotion features={domAnimation} strict>
      <section className="relative flex flex-col items-center justify-end min-h-screen overflow-hidden pb-10 sm:pb-14">
        {/* ── Photo background with subtle scale-in ── */}
        <m.div
          className="absolute inset-0"
          initial={{ scale: 1.06 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.6, ease: "easeOut" }}
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

        {/* ── Cinematic overlay stack ── */}
        {/* top letterbox fade */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent z-[1]" />
        {/* bottom heavy fade — content sits here */}
        <div
          className="absolute inset-x-0 bottom-0 h-[72%] z-[1]"
          style={{
            background: "linear-gradient(to top, #000 0%, rgba(0,0,0,0.82) 40%, rgba(0,0,0,0.4) 75%, transparent 100%)",
          }}
        />
        {/* radial side vignette */}
        <div
          className="absolute inset-0 z-[1]"
          style={{
            background: "radial-gradient(ellipse 115% 100% at 50% 50%, transparent 48%, rgba(0,0,0,0.55) 100%)",
          }}
        />
        {/* warm primary tint at base */}
        <div
          className="absolute inset-x-0 bottom-0 h-1/2 z-[1]"
          style={{
            background:
              "radial-gradient(ellipse 65% 45% at 50% 100%, rgba(var(--primary-rgb, 255 90 31) / 0.13) 0%, transparent 70%)",
          }}
        />

        {/* ── Floating identity icons ── */}
        <div className="absolute inset-0 z-[5] overflow-hidden">
          {floatIcons.map(({ Icon, style, delay, duration }, i) => (
            <FloatIcon
              key={i}
              icon={Icon}
              style={style}
              delay={delay}
              duration={duration}
              reduced={prefersReducedMotion}
            />
          ))}
        </div>

        {/* ── Main content ── */}
        <div className="relative z-10 w-full max-w-[640px] mx-auto px-5 sm:px-8 flex flex-col items-center text-center">
          {/* Badge */}
          <m.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={anim(0.6, 0.2)}
            className="mb-5"
          >
            <span
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
                          text-[10px] font-bold uppercase tracking-widest
                          bg-primary/10 text-primary border border-primary/25 backdrop-blur-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {isRTL ? "أكاديمية بايكرز" : "BIKERZ Academy"}
            </span>
          </m.div>

          {/* Separator label */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={anim(0.5, 0.32)}
            className="flex items-center gap-3 mb-4"
          >
            <span className="h-px w-8 bg-white/20" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-white/30">
              {isRTL ? "تعلّم القيادة الاحترافية" : "Professional Riding Academy"}
            </span>
            <span className="h-px w-8 bg-white/20" />
          </m.div>

          {/* Title */}
          <m.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={anim(0.7, 0.42)}
            className="text-[clamp(2.6rem,10vw,5rem)] font-black leading-[0.93]
                       text-white tracking-tight drop-shadow-2xl mb-4"
          >
            {title}
          </m.h1>

          {/* Subtitle */}
          <m.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={anim(0.6, 0.58)}
            className="text-sm sm:text-[15px] text-white/55 leading-relaxed max-w-sm mb-7 font-medium"
          >
            {subtitle}
          </m.p>

          {/* CTA Buttons */}
          <m.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={anim(0.5, 0.72)}
            className="flex flex-col sm:flex-row gap-3 justify-center w-full sm:w-auto mb-9"
          >
            <Link to="/courses" className="sm:flex-none">
              <Button
                variant="hero"
                size="default"
                className="w-full group gap-2 px-6 sm:px-8 py-3 sm:py-4 text-sm font-bold
                           shadow-[0_0_28px_rgba(255,90,31,0.35)]
                           hover:shadow-[0_0_44px_rgba(255,90,31,0.55)]
                           transition-shadow duration-300"
              >
                <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" />
                {ctaText}
              </Button>
            </Link>
            <Link to="/join-community" className="sm:flex-none">
              <Button
                variant="heroOutline"
                size="default"
                className="w-full group gap-2 px-5 sm:px-7 py-3 sm:py-4 text-sm
                           bg-white/[0.06] border-white/20 text-white/80
                           hover:bg-white/[0.12] hover:border-white/40 hover:text-white
                           backdrop-blur-sm transition-all duration-200"
              >
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" />
                {isRTL ? "انضم لمجتمع بايكرز" : "Join Bikerz Community"}
              </Button>
            </Link>
          </m.div>

          {/* Stats Strip */}
          {showStats && (
            <m.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={anim(0.55, 0.88)}
              className="w-full"
            >
              <div
                className="grid grid-cols-4 sm:grid-cols-4 grid-cols-2 rounded-2xl overflow-hidden
                            bg-black/45 border border-white/[0.09] backdrop-blur-xl"
              >
                {displayStats.map((stat, i) => (
                  <StatCard
                    key={stat.key}
                    value={stat.value}
                    label={stat.label}
                    icon={stat.icon}
                    index={i}
                    reduced={prefersReducedMotion}
                  />
                ))}
              </div>
            </m.div>
          )}
        </div>

        {/* ── Scroll indicator (bottom-right) ── */}
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={anim(0.5, 1.4)}
          className="absolute bottom-5 right-5 sm:bottom-7 sm:right-7 z-10
                     flex flex-col items-center gap-1.5"
        >
          <div className="relative w-px h-12 bg-white/10 overflow-hidden rounded-full">
            <m.span
              className="absolute top-0 left-0 w-full bg-primary rounded-full"
              animate={{ top: ["0%", "100%"], opacity: [1, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeIn" }}
              style={{ height: "35%" }}
            />
          </div>
          <span className="text-[8px] uppercase tracking-[0.22em] text-white/20 font-semibold">scroll</span>
        </m.div>
      </section>
    </LazyMotion>
  );
};

export default HeroSection;
