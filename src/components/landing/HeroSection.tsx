import React, { useMemo } from "react";
import AnimatedCounter from "@/components/common/AnimatedCounter";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ArrowLeft,
  Play,
  ShieldCheck,
  CreditCard,
  Award,
  Gauge,
  Settings,
  Zap,
  Compass,
} from "lucide-react"; // أضفت أيقونات الزينة هنا
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import defaultHeroImage from "@/assets/hero-rider.webp";
import { useLandingContent, HeroContent } from "@/hooks/useLandingContent";
import { Skeleton } from "@/components/ui/skeleton";
import DiscountUrgencyBanner from "@/components/landing/DiscountUrgencyBanner";
import { Users, GraduationCap, PlayCircle, BookOpen } from "lucide-react";

// --- مكون الأيقونات الطافية للزينة (لسد الفراغ الجانبي) ---
const FloatingDecorIcons = () => {
  const decorIcons = [
    { Icon: Gauge, size: 45, x: "10%", y: "20%", duration: 6 },
    { Icon: Settings, size: 35, x: "5%", y: "45%", duration: 8 },
    { Icon: Zap, size: 30, x: "15%", y: "70%", duration: 5 },
    { Icon: Compass, size: 40, x: "8%", y: "85%", duration: 7 },
  ];

  return (
    <div className="absolute left-0 top-0 w-full lg:w-1/2 h-full pointer-events-none hidden lg:block z-0">
      {decorIcons.map(({ Icon, size, x, y, duration }, i) => (
        <m.div
          key={i}
          className="absolute"
          style={{ left: x, top: y, color: "hsl(18 78% 45% / 0.12)" }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.05, 0.15, 0.05],
            rotate: [0, 10, 0],
          }}
          transition={{
            duration: duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.5,
          }}
        >
          <Icon size={size} strokeWidth={1} />
        </m.div>
      ))}
    </div>
  );
};

// ... (تكملة الدوال المساعدة formatCount و fetchHeroStats كما هي في كودك) ...
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
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const { data: content, isLoading: contentLoading } = useLandingContent<HeroLandingContent>("hero");

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

  // ... (تكملة حساب القيم DisplayStats كما هي في كودك) ...
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

  const fade = (dur: number, delay = 0) => (prefersReducedMotion ? { duration: 0 } : { duration: dur, delay });
  const heroImage = content?.defaultHeroImage ?? defaultHeroImage;
  const title = isRTL ? content?.title_ar || "لنقد بثقة" : content?.title_en || "Ride with Confidence";
  const subtitle = isRTL ? content?.subtitle_ar : content?.subtitle_en;
  const secondaryCta = isRTL
    ? content?.secondary_cta_ar || "استكشف الدورات"
    : content?.secondary_cta_en || "Explore Courses";

  return (
    <LazyMotion features={domAnimation} strict>
      <section className="relative min-h-[90svh] lg:min-h-[85svh] flex flex-col overflow-hidden">
        {/* ═══ Background & Overlays ═══ */}
        <div className="absolute inset-0">
          <img src={heroImage} alt="Hero" className="w-full h-full object-cover object-center" fetchPriority="high" />
          <div className="absolute inset-0 bg-near-black/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-near-black via-near-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-near-black/90 via-near-black/20 to-transparent" />
        </div>

        {/* ═══ الزينة التقنية (سد الفراغ الأحمر) ═══ */}
        <FloatingDecorIcons />

        {/* Grain effect */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
          style={{ backgroundImage: `url("data:image/svg+xml,...")` }}
        />

        {/* ═══ Banner ═══ */}
        <m.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="relative z-20 pt-4 px-4">
          <DiscountUrgencyBanner floating />
        </m.div>

        {/* ═══ Main Content ═══ */}
        <div className="relative z-10 flex-1 flex items-center">
          <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6">
            <div
              className={`flex flex-col ${isRTL ? "lg:items-start lg:text-right" : "lg:items-end lg:text-left"} text-center`}
            >
              {/* Title */}
              <m.h1
                initial={{ opacity: 0, x: isRTL ? 30 : -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={fade(0.8, 0.3)}
                className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black leading-tight mb-6 max-w-2xl text-white"
              >
                {title}
              </m.h1>

              {/* Subtitle */}
              <m.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={fade(0.7, 0.5)}
                className="text-base lg:text-xl text-sand/80 max-w-lg mb-8"
              >
                {subtitle}
              </m.p>

              {/* Button */}
              <m.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={fade(0.5, 0.7)}
              >
                <Link to="/courses">
                  <Button
                    variant="hero"
                    size="lg"
                    className="group px-8 py-7 text-lg shadow-[0_10px_40px_hsl(var(--primary)/0.3)]"
                  >
                    <Play className="ml-2 w-5 h-5" />
                    {secondaryCta}
                  </Button>
                </Link>
              </m.div>
            </div>
          </div>
        </div>

        {/* ═══ Stats Bar ═══ */}
        {showStats && (
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fade(0.7, 0.9)}
            className="relative z-10 w-full"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <div className="max-w-[1200px] mx-auto px-4 py-8 md:py-10">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                  {displayStats.map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.key} className="flex items-center justify-center md:justify-start gap-4">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center border border-primary/20 bg-primary/5">
                          {Icon && <Icon size={28} className="text-primary" />}
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-2xl md:text-3xl font-black text-primary leading-none">
                            {stat.value}
                          </span>
                          <span className="text-xs font-medium text-muted-foreground mt-1">{stat.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </m.div>
        )}
      </section>
    </LazyMotion>
  );
};

export default HeroSection;
