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
  ChevronRight,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLandingContent, HeroContent } from "@/hooks/useLandingContent";
import heroRiderBg from "@/assets/hero-rider-new.webp";

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
      { key: "success", value: successValue, label: isRTL ? "نسبة النجاح" : "Success Rate", icon: GraduationCap },
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
      <section
        className="relative overflow-hidden bg-background"
        dir={isRTL ? "rtl" : "ltr"}
      >
        {/* ── Split Layout ── */}
        <div className="grid lg:grid-cols-2 min-h-[auto] lg:min-h-[92svh]">

          {/* ── Text Column ── */}
          <div className="relative z-10 flex flex-col justify-center px-6 sm:px-10 lg:px-16 xl:px-24 py-20 sm:py-24 lg:py-16 order-2 lg:order-1">
            
            {/* Accent bar */}
            <m.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={anim(0.5, 0.2)}
              className="w-12 h-1 bg-primary rounded-full mb-6 origin-left"
            />

            {/* Badge */}
            <m.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={anim(0.5, 0.3)}
              className="mb-4"
            >
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-primary">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-50" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                {isRTL ? "أكاديمية بايكرز" : "BIKERZ Academy"}
              </span>
            </m.div>

            {/* Title */}
            <m.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={anim(0.65, 0.4)}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-[52px] xl:text-6xl
                         font-black leading-[1.08] tracking-tight
                         text-foreground mb-5"
            >
              {title}
            </m.h1>

            {/* Subtitle */}
            <m.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={anim(0.55, 0.55)}
              className="text-sm sm:text-base lg:text-lg
                         text-muted-foreground leading-relaxed
                         mb-8 max-w-md"
            >
              {subtitle}
            </m.p>

            {/* CTA Buttons */}
            <m.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={anim(0.5, 0.65)}
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-12 lg:mb-16"
            >
              <Link to="/courses">
                <Button
                  className="w-full sm:w-auto group gap-2 px-7 py-3.5
                             text-sm font-bold uppercase tracking-wide
                             bg-primary text-primary-foreground
                             hover:bg-primary/90
                             shadow-[0_4px_20px_hsl(var(--primary)/0.3)]
                             hover:shadow-[0_6px_28px_hsl(var(--primary)/0.4)]
                             transition-all duration-300 rounded-xl"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {ctaText}
                </Button>
              </Link>
              <Link to="/join-community">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto group gap-2 px-7 py-3.5
                             text-sm font-bold uppercase tracking-wide
                             border-border text-foreground
                             hover:bg-accent/10 hover:border-primary/30
                             transition-all duration-300 rounded-xl"
                >
                  <Users className="w-4 h-4" />
                  {isRTL ? "انضم لمجتمع بايكرز" : "Join Community"}
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 ${isRTL ? 'rotate-180 group-hover:-translate-x-0.5' : ''}`} />
                </Button>
              </Link>
            </m.div>

            {/* Stats Row */}
            {showStats && (
              <m.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={anim(0.55, 0.8)}
                className="grid grid-cols-4 gap-4 sm:gap-6"
              >
                {displayStats.map((stat, i) => (
                  <m.div
                    key={stat.key}
                    initial={prefersReducedMotion ? {} : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.9 + i * 0.1 }}
                    className="text-center lg:text-start"
                  >
                    <AnimatedCounter
                      value={stat.value}
                      className="text-2xl sm:text-3xl lg:text-4xl font-black text-primary leading-none"
                    />
                    <span className="block mt-1 text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      {stat.label}
                    </span>
                  </m.div>
                ))}
              </m.div>
            )}
          </div>

          {/* ── Image Column ── */}
          <div className="relative order-1 lg:order-2 min-h-[45svh] lg:min-h-full">
            <m.div
              className="absolute inset-0"
              initial={{ scale: 1.06 }}
              animate={{ scale: 1 }}
              transition={{ duration: 2, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <img
                src={heroRiderBg}
                alt="Motorcycle rider"
                width={1920}
                height={1080}
                className="w-full h-full object-cover"
                fetchPriority="high"
                decoding="async"
              />
            </m.div>

            {/* Gradient overlays for seamless blend */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent lg:hidden" />
            <div
              className="absolute inset-0 hidden lg:block"
              style={{
                background: isRTL
                  ? "linear-gradient(to left, transparent 30%, hsl(var(--background)) 100%)"
                  : "linear-gradient(to right, transparent 30%, hsl(var(--background)) 100%)",
              }}
            />
            <div className="absolute inset-0 hidden lg:block bg-gradient-to-t from-background/40 via-transparent to-background/20" />

            {/* Corner accent */}
            <div className="absolute bottom-0 left-0 right-0 lg:hidden h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          </div>
        </div>
      </section>
    </LazyMotion>
  );
};

export default HeroSection;
