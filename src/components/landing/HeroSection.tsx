import React, { useMemo } from "react";
import AnimatedCounter from "@/components/common/AnimatedCounter";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Play, Users, GraduationCap, PlayCircle, BookOpen, ArrowRight, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/hero-rider.webp";

import { useLandingContent, HeroContent } from "@/hooks/useLandingContent";
import HeroAdSlider from "@/components/landing/HeroAdSlider";

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
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

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
      <section className="relative overflow-hidden">
        {/* Background image with overlay */}
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt=""
            className="w-full h-full object-cover"
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0 bg-black/60" />
          {/* Bottom fade into background */}
          <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-background to-transparent" />
        </div>

        <div className="relative z-10">
          {/* Main hero content */}
          <div className="max-w-[1200px] mx-auto w-full px-4 sm:px-6 pt-10 sm:pt-14 md:pt-20 pb-6 sm:pb-8 md:pb-12">
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
              
              {/* Text content */}
              <div className="flex-1 text-center lg:text-start w-full">
                {/* Badge */}
                <m.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={anim(0.5, 0.2)}
                  className="mb-4 sm:mb-5"
                >
                  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary/20 text-primary border border-primary/30 backdrop-blur-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    {isRTL ? "أكاديمية بايكرز" : "BIKERZ Academy"}
                  </span>
                </m.div>

                {/* Title */}
                <m.h1
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={anim(0.6, 0.35)}
                  className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black leading-[1.05] tracking-tight mb-4 sm:mb-5 text-white"
                >
                  {title}
                </m.h1>

                {/* Subtitle */}
                <m.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={anim(0.5, 0.5)}
                  className={`text-base sm:text-lg lg:text-xl text-white/70 leading-relaxed mb-6 sm:mb-8 max-w-lg ${isRTL ? 'mx-auto lg:mr-0 lg:ml-auto' : 'mx-auto lg:ml-0'}`}
                >
                  {subtitle}
                </m.p>

                {/* CTA Buttons */}
                <m.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={anim(0.5, 0.65)}
                  className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start"
                >
                  <Link to="/courses">
                    <Button
                      variant="hero"
                      size="lg"
                      className="group gap-3 px-8 py-6 text-base sm:text-lg w-full sm:w-auto"
                    >
                      <Play className="w-5 h-5 transition-transform group-hover:scale-110" />
                      {ctaText}
                    </Button>
                  </Link>
                  <Link to="/signup">
                    <Button
                      variant="outline"
                      size="lg"
                      className="gap-2.5 px-8 py-6 text-base border-white/20 text-white bg-white/5 hover:bg-white/10 hover:border-white/30 rounded-xl w-full sm:w-auto"
                    >
                      {isRTL ? "سجّل الآن" : "Sign Up Free"}
                      <Arrow className="w-4 h-4" />
                    </Button>
                  </Link>
                </m.div>

                {/* Stats row */}
                {showStats && (
                  <m.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={anim(0.5, 0.85)}
                    className="mt-8 sm:mt-10"
                  >
                    <div className="grid grid-cols-4 gap-2 sm:gap-0 sm:inline-flex sm:divide-x sm:divide-white/10 sm:rtl:divide-x-reverse px-2 sm:px-0">
                      {displayStats.map((stat, i) => {
                        const Icon = stat.icon;
                        return (
                          <div key={stat.key} className="flex flex-col items-center sm:px-5 first:ps-0 last:pe-0">
                            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center mb-1.5">
                              <Icon className="w-4 h-4 text-primary" />
                            </div>
                            <AnimatedCounter
                              value={stat.value}
                              className="text-lg sm:text-xl font-black text-white leading-none"
                            />
                            <span className="text-[10px] sm:text-xs text-white/50 uppercase tracking-wider font-medium mt-1">
                              {stat.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </m.div>
                )}
              </div>

              {/* Ad Slider — right on desktop, below on mobile */}
              <m.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={anim(0.6, 0.4)}
                className="w-full sm:w-[340px] lg:w-[320px] xl:w-[360px] shrink-0"
              >
                <HeroAdSlider />
              </m.div>
            </div>
          </div>
        </div>
      </section>
    </LazyMotion>
  );
};

export default HeroSection;
