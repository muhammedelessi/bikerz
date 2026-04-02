import React, { useMemo } from "react";
import AnimatedCounter from "@/components/common/AnimatedCounter";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Play, Users, GraduationCap, PlayCircle, BookOpen,
  Shield, Bike, Route, Gauge, Trophy, Compass, Wrench,
} from "lucide-react";
// Users icon is used for both stats and CTA
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

const StatCard: React.FC<{
  value: string;
  label: string;
  icon: React.ElementType;
  index: number;
  reducedMotion: boolean | null;
}> = ({ value, label, icon: Icon, index, reducedMotion }) => (
  <m.div
    initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 1 + index * 0.1, type: "spring", stiffness: 180 }}
    className="relative group"
  >
    {/* Glow behind card on hover */}
    <div className="absolute -inset-1 rounded-2xl bg-primary/10 opacity-0 group-hover:opacity-100 blur-lg transition-opacity duration-500" />

    <div className="relative flex flex-col items-center gap-1.5 sm:gap-2.5 px-2 sm:px-5 py-3 sm:py-5 rounded-xl sm:rounded-2xl bg-white/[0.06] border border-white/[0.08] backdrop-blur-md group-hover:bg-white/[0.1] group-hover:border-primary/30 transition-all duration-400">
      {/* Icon with pulse ring */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-0 group-hover:opacity-40" style={{ animationDuration: '2s' }} />
        <div className="relative w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-primary/25 to-primary/10 border border-primary/25 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
          <Icon className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-primary" />
        </div>
      </div>

      {/* Value */}
      <AnimatedCounter
        value={value}
        className="text-lg sm:text-2xl md:text-3xl font-black text-white leading-none tracking-tight"
      />

      {/* Label */}
      <span className="text-[8px] sm:text-[10px] text-white/50 uppercase tracking-[0.15em] font-medium whitespace-nowrap">
        {label}
      </span>
    </div>
  </m.div>
);

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

  return (
    <LazyMotion features={domAnimation} strict>
      <section className="relative flex flex-col overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroRiderBg}
            alt=""
            width={1920}
            height={1080}
            className="w-full h-full object-cover"
            fetchPriority="high"
            decoding="async"
          />
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/80" />
        </div>

        {/* Floating Identity Icons */}
        <div className="absolute inset-0 z-[5] pointer-events-none overflow-hidden">
          {[
            { Icon: Shield, x: "5%", y: "18%", size: 28, mSize: 18, delay: 0, dur: 6 },
            { Icon: Bike, x: "88%", y: "22%", size: 32, mSize: 20, delay: 0.5, dur: 7 },
            { Icon: Route, x: "8%", y: "72%", size: 24, mSize: 16, delay: 1, dur: 8 },
            { Icon: Gauge, x: "85%", y: "68%", size: 26, mSize: 18, delay: 1.5, dur: 6.5 },
            { Icon: Trophy, x: "3%", y: "45%", size: 22, mSize: 16, delay: 0.8, dur: 7.5 },
            { Icon: Compass, x: "92%", y: "45%", size: 24, mSize: 16, delay: 1.2, dur: 6.8 },
            { Icon: Wrench, x: "15%", y: "88%", size: 20, mSize: 14, delay: 2, dur: 7.2 },
            { Icon: GraduationCap, x: "80%", y: "85%", size: 22, mSize: 16, delay: 0.3, dur: 8.2 },
          ].map(({ Icon, x, y, size, mSize, delay, dur }, i) => (
            <m.div
              key={i}
              className="absolute"
              style={{ left: x, top: y }}
              initial={prefersReducedMotion ? { opacity: 0.6 } : { opacity: 0, scale: 0.5 }}
              animate={
                prefersReducedMotion
                  ? { opacity: 0.6 }
                  : {
                      opacity: [0, 0.7, 0.5, 0.7],
                      scale: [0.8, 1, 0.9, 1],
                      y: [0, -12, 0, 12, 0],
                    }
              }
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : {
                      duration: dur,
                      repeat: Infinity,
                      repeatType: "mirror" as const,
                      delay,
                      ease: "easeInOut",
                    }
              }
            >
              <div className="p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl bg-primary/15 border border-primary/30 backdrop-blur-sm">
                <Icon className="text-primary block sm:hidden" size={mSize} strokeWidth={1.8} />
                <Icon className="text-primary hidden sm:block" size={size} strokeWidth={1.8} />
              </div>
            </m.div>
          ))}
        </div>

        <div className="relative z-10 max-w-[1200px] mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 md:py-16 flex flex-col items-center text-center">
          {/* Badge */}

          {/* Title */}
          <m.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={anim(0.7, 0.4)}
            className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black leading-[1.08] mb-3 text-white max-w-3xl tracking-tight drop-shadow-lg"
          >
            {title}
          </m.h1>

          {/* Subtitle */}
          <m.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={anim(0.6, 0.6)}
            className="text-sm sm:text-base lg:text-lg text-white/85 leading-relaxed mb-5 max-w-xl font-medium drop-shadow-md"
          >
            {subtitle}
          </m.p>

          {/* CTA */}
          <m.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={anim(0.5, 0.75)}
            className="flex flex-col sm:flex-row gap-2.5 sm:gap-4 justify-center w-full sm:w-auto"
          >
            <Link to="/courses" className="sm:flex-none">
              <Button
                variant="hero"
                size="default"
                className="w-full group gap-2 px-5 sm:px-7 py-3 sm:py-4 text-xs sm:text-sm"
              >
                <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" />
                {ctaText}
              </Button>
            </Link>
            <Link to="/join-community" className="sm:flex-none">
              <Button
                variant="heroOutline"
                size="default"
                className="w-full group gap-2 px-5 sm:px-7 py-3 sm:py-4 text-xs sm:text-sm border-primary/50 text-primary hover:bg-primary/10 hover:border-primary"
              >
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" />
                {isRTL ? "انضم لمجتمع بايكرز" : "Join Bikerz Community"}
              </Button>
            </Link>
          </m.div>

          {/* Stats Strip */}
          {showStats && (
            <m.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={anim(0.5, 0.9)}
              className="mt-8 sm:mt-10"
            >
              <div className="grid grid-cols-4 gap-2 sm:gap-4 md:gap-6 px-2 sm:px-6 py-3 sm:py-5 rounded-2xl bg-black/20 backdrop-blur-sm border border-white/[0.06]">
                {displayStats.map((stat, i) => (
                  <StatCard
                    key={stat.key}
                    value={stat.value}
                    label={stat.label}
                    icon={stat.icon}
                    index={i}
                    reducedMotion={prefersReducedMotion}
                  />
                ))}
              </div>
            </m.div>
          )}
        </div>
      </section>
    </LazyMotion>
  );
};

export default HeroSection;
