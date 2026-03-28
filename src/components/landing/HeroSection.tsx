import React, { useMemo } from "react";
import AnimatedCounter from "@/components/common/AnimatedCounter";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Play, Users, GraduationCap, PlayCircle, BookOpen } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import defaultHeroImage from "@/assets/hero-rider.webp";
import { useLandingContent, HeroContent } from "@/hooks/useLandingContent";
import DiscountUrgencyBanner from "@/components/landing/DiscountUrgencyBanner";

// Extended hero content with CMS stats overrides
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

/* ── Stat Card ── */
const StatCard: React.FC<{
  value: string;
  label: string;
  icon: React.ElementType;
  index: number;
  reducedMotion: boolean | null;
}> = ({ value, label, icon: Icon, index, reducedMotion }) => (
  <m.div
    initial={reducedMotion ? {} : { opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: 1 + index * 0.1 }}
    className="flex items-center gap-3 group"
  >
    <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors duration-300">
      <Icon className="w-4 h-4 text-primary" />
    </div>
    <div className="flex flex-col">
      <AnimatedCounter value={value} className="text-lg sm:text-xl font-bold text-primary-foreground leading-none" />
      <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider font-medium mt-0.5">
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

  const heroImage = content?.defaultHeroImage ?? defaultHeroImage;
  const title = isRTL ? content?.title_ar || "لنقد بثقة" : content?.title_en || "Ride with Confidence";
  const subtitle = isRTL
    ? content?.subtitle_ar || "انطلق في رحلتك مع أفضل مدربي الدراجات النارية"
    : content?.subtitle_en || "Start your journey with expert motorcycle instructors";
  const ctaText = isRTL
    ? content?.secondary_cta_ar || "استكشف الدورات"
    : content?.secondary_cta_en || "Explore Courses";

  return (
    <LazyMotion features={domAnimation} strict>
      <section className="relative min-h-[92svh] flex flex-col overflow-hidden">
        {/* ── Background Layers ── */}

        {/* Grain texture */}
        <div
          className="absolute inset-0 opacity-[0.025] pointer-events-none mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='f'%3E%3CfeTurbulence baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)' opacity='0.5'/%3E%3C/svg%3E")`,
          }}
        />

        {/* ── 
        <m.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-20 pt-3 px-4"
        >
          <DiscountUrgencyBanner floating />
        </m.div> ── */}
        {/* ── Main Content ── */}
        <div className="relative z-10 flex-1 flex items-center">
          <div className="w-full max-w-[1200px] mx-auto px-6">
            <div className={`max-w-2xl ${isRTL ? "mr-0 ml-auto text-right" : "ml-0 mr-auto text-left"}`}>
              {/* Title */}
              <m.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={anim(0.7, 0.35)}
                className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black leading-[1.08] mb-5 text-primary-foreground"
              >
                {title}
              </m.h1>

              {/* Subtitle */}
              <m.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={anim(0.6, 0.55)}
                className="text-base sm:text-lg lg:text-xl text-foreground/70 leading-relaxed mb-8 max-w-lg"
              >
                {subtitle}
              </m.p>

              {/* CTA */}
              <m.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={anim(0.5, 0.7)}
                className="flex flex-wrap gap-4"
              >
                <Link to="/courses">
                  <Button
                    variant="hero"
                    size="lg"
                    className="group gap-3 px-8 py-6 text-base sm:text-lg shadow-[0_8px_32px_hsl(var(--primary)/0.35)]"
                  >
                    <Play className="w-5 h-5 transition-transform group-hover:scale-110" />
                    {ctaText}
                  </Button>
                </Link>
              </m.div>
            </div>
          </div>
        </div>

        {/* ── Compact Stats Strip ── */}
        {showStats && (
          <div className="relative z-10 w-full pb-5 sm:pb-6">
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
              <div className="inline-flex flex-wrap gap-6 sm:gap-8 md:gap-10 px-5 py-3 rounded-xl bg-card/30 backdrop-blur-sm border border-border/20">
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
            </div>
          </div>
        )}
      </section>
    </LazyMotion>
  );
};

export default HeroSection;
