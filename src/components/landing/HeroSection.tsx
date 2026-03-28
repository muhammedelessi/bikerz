import React, { useMemo } from "react";
import AnimatedCounter from "@/components/common/AnimatedCounter";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Play, ShieldCheck, CreditCard, Award } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import defaultHeroImage from "@/assets/hero-rider.webp";
import { useLandingContent, HeroContent } from "@/hooks/useLandingContent";
import { Skeleton } from "@/components/ui/skeleton";
import DiscountUrgencyBanner from "@/components/landing/DiscountUrgencyBanner";

type HeroLandingContent = HeroContent & {
  stats_members_value?: string | number;
  stats_lessons_value?: string | number;
  stats_success_value?: string | number;
  stats_courses_value?: string | number;
  stats_members_en?: string;
  stats_members_ar?: string;
  stats_lessons_en?: string;
  stats_lessons_ar?: string;
  stats_success_en?: string;
  stats_success_ar?: string;
  stats_courses_en?: string;
  stats_courses_ar?: string;
  show_stats?: boolean | string;
  show_badge?: string | boolean;
  defaultHeroImage?: string;
};

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

/* ── Trust badge ── */
const TrustBadge: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-foreground/50 font-medium uppercase tracking-wider">
    {icon}
    <span>{label}</span>
  </div>
);

/* ── Stat item ── */
const StatItem: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <div className="text-center">
    <AnimatedCounter value={value} className="text-xl sm:text-2xl lg:text-3xl font-black text-primary-foreground" />
    <div className="text-[9px] sm:text-[10px] text-primary-foreground/60 mt-0.5 uppercase tracking-[0.15em] font-semibold">
      {label}
    </div>
  </div>
);

const HeroSection: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

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
      {
        key: "members",
        value: membersValue,
        label: isRTL ? content?.stats_members_ar || "عضو" : content?.stats_members_en || "Members",
      },
      {
        key: "success",
        value: successValue,
        label: isRTL ? content?.stats_success_ar || "نسبة النجاح" : content?.stats_success_en || "Success",
      },
      {
        key: "lessons",
        value: lessonsValue,
        label: isRTL ? content?.stats_lessons_ar || "درس" : content?.stats_lessons_en || "Lessons",
      },
      {
        key: "courses",
        value: coursesValue,
        label: isRTL ? content?.stats_courses_ar || "دورة" : content?.stats_courses_en || "Courses",
      },
    ],
    [membersValue, lessonsValue, successValue, coursesValue, isRTL, content],
  );

  const getText = (enKey: keyof HeroContent, arKey: keyof HeroContent, fallbackEn: string, fallbackAr: string) => {
    if (!content) return isRTL ? fallbackAr : fallbackEn;
    return isRTL ? content[arKey] || fallbackAr : content[enKey] || fallbackEn;
  };

  const title = getText("title_en", "title_ar", t("hero.title", { lng: "en" }), t("hero.title", { lng: "ar" }));
  const subtitle = getText(
    "subtitle_en",
    "subtitle_ar",
    t("hero.subtitle", { lng: "en" }),
    t("hero.subtitle", { lng: "ar" }),
  );
  const ctaText = getText("cta_en", "cta_ar", t("hero.cta", { lng: "en" }), t("hero.cta", { lng: "ar" }));
  const secondaryCta = getText(
    "secondary_cta_en",
    "secondary_cta_ar",
    t("hero.secondaryCta", { lng: "en" }),
    t("hero.secondaryCta", { lng: "ar" }),
  );
  const heroImage = content?.defaultHeroImage ?? defaultHeroImage;

  const fade = (dur: number, delay = 0) => (prefersReducedMotion ? { duration: 0 } : { duration: dur, delay });

  const trustBadges = isRTL
    ? [
        { icon: <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />, label: "مدربون معتمدون" },
        { icon: <CreditCard className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />, label: "دفع آمن" },
        { icon: <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />, label: "شهادات معتمدة" },
      ]
    : [
        { icon: <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />, label: "Verified Instructors" },
        { icon: <CreditCard className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />, label: "Secure Payment" },
        { icon: <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />, label: "Certified Courses" },
      ];

  return (
    <LazyMotion features={domAnimation} strict>
      <section className="relative min-h-[90svh] lg:min-h-[85svh] flex flex-col">
        {/* ═══ Background ═══ */}
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Motorcycle rider on desert highway"
            width={1920}
            height={1080}
            fetchPriority="high"
            decoding="async"
            className="w-full h-full object-cover object-center"
            loading="eager"
          />
          {/* Cinematic overlays */}
          <div className="absolute inset-0 bg-near-black/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-near-black via-near-black/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-near-black/90 via-near-black/40 to-transparent lg:via-transparent lg:to-near-black/20" />
          {/* Orange accent glow — bottom left */}
          <div className="absolute bottom-0 left-0 w-[60%] h-[40%] bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--primary)/0.15),transparent_70%)] pointer-events-none" />
        </div>

        {/* Grain */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* ═══ Floating Discount Banner (top) ═══ */}
        <m.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={fade(0.5, 0.1)}
          className="relative z-20 pt-3 sm:pt-4 px-4"
        >
          <DiscountUrgencyBanner floating />
        </m.div>

        {/* ═══ Main Content ═══ */}
        <div className="relative z-10 flex-1 flex items-center">
          <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-8 lg:py-0">
            {/* Desktop: split layout (content left). Mobile: centered stack */}
            <div className="flex flex-col items-center text-center lg:items-start lg:text-start lg:max-w-[55%]">
              {/* Title */}
              {contentLoading ? (
                <Skeleton className="h-14 sm:h-20 w-[85%] mb-4" />
              ) : (
                <m.h1
                  animate={{ opacity: 1, y: 0 }}
                  transition={fade(0.8, 0.25)}
                  className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.5rem] xl:text-6xl font-black leading-[1.1] tracking-tight mb-4 sm:mb-5"
                >
                  {title}
                </m.h1>
              )}

              {/* Subtitle */}
              {contentLoading ? (
                <Skeleton className="h-6 w-[70%] mb-6" />
              ) : (
                <m.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={fade(0.7, 0.5)}
                  className="text-sm sm:text-base lg:text-lg text-sand/80 leading-relaxed max-w-lg mb-6 sm:mb-8"
                >
                  {subtitle}
                </m.p>
              )}

              {/* CTAs */}
              <m.div
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={fade(0.6, 0.65)}
                className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto mb-6 sm:mb-8"
              >
                <Link to="/courses" className="w-full sm:w-auto">
                  <Button
                    variant="hero"
                    size="lg"
                    className="group w-full sm:w-auto min-h-[48px] sm:min-h-[52px] text-sm sm:text-base shadow-[0_4px_32px_hsl(var(--primary)/0.5)] hover:shadow-[0_6px_40px_hsl(var(--primary)/0.6)] transition-shadow"
                  >
                    <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                    {secondaryCta}
                  </Button>
                </Link>
              </m.div>
            </div>
          </div>
        </div>

        {/* ═══ Stats Bar (bottom, full-width) ═══ */}
        {showStats && (
      import { motion as m } from "framer-motion";

// لنفترض أن displayStats تحتوي على icon لكل عنصر
const StatsSection = () => {
  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.2 }}
      className="relative z-10 w-full overflow-hidden"
    >
      {/* الخلفية المتصلة المتدرجة (بناءً على ألوان الصورة المرفقة) */}
      <div 
        className="w-full py-6 md:py-8"
        style={{ 
          background: "linear-gradient(90deg, #1db299 0%, #39cabb 50%, #57e099 100%)",
          boxShadow: "0 10px 30px -10px rgba(29, 178, 153, 0.3)"
        }}
      >
        <div className="max-w-[1200px] mx-auto px-4">
          {/* الجريد: 2 أعمدة في الجوال (grid-cols-2) و 4 في الشاشات الكبيرة (md:grid-cols-4) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-4">
            {displayStats.map((stat, i) => (
              <m.div
                key={stat.key}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="flex items-center justify-start md:justify-center gap-3 px-2"
              >
                {/* الدائرة التي تحتوي على الأيقونة */}
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                  {/* هنا تضع الأيقونة الخاصة بك */}
                  {stat.icon ? (
                    <stat.icon className="w-6 h-6 text-white" />
                  ) : (
                    <div className="w-6 h-6 bg-white/50 rounded-full" /> 
                  )}
                </div>

                {/* النصوص: القيمة والعنوان بجانب بعضهما عمودياً */}
                <div className="flex flex-col text-white">
                  <span className="text-lg md:text-xl font-bold leading-tight">
                    {stat.value}
                  </span>
                  <span className="text-[12px] md:text-[14px] font-medium opacity-90 leading-tight">
                    {stat.label}
                  </span>
                </div>
              </m.div>
            ))}
          </div>
        </div>
      </div>
    </m.div>
  );
};
        )}

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none z-[5]" />

        {/* Scroll indicator */}
      </section>
    </LazyMotion>
  );
};

export default HeroSection;
