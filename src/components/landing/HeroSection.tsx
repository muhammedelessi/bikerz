import React, { useMemo } from "react";
import AnimatedCounter from "@/components/common/AnimatedCounter";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Play } from "lucide-react";
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
  stats_members_en?: string;
  stats_members_ar?: string;
  stats_lessons_en?: string;
  stats_lessons_ar?: string;
  stats_success_en?: string;
  stats_success_ar?: string;
  show_stats?: boolean | string;
  show_badge?: string | boolean;
  defaultHeroImage?: string;
};

function formatCount(count: number) {
  if (count >= 1000) return `${Math.floor(count / 1000)}K+`;
  return count > 0 ? `${count}+` : "0";
}

async function fetchHeroStats() {
  const [profilesRes, lessonsRes, enrollmentsRes] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("lessons").select("*", { count: "exact", head: true }).eq("is_published", true),
    supabase.from("course_enrollments").select("progress_percentage"),
  ]);
  const usersCount = profilesRes.count ?? 0;
  const lessonsCount = lessonsRes.count ?? 0;
  const enrollmentStats = enrollmentsRes.data ?? [];
  const successfulEnrollments = enrollmentStats.filter((e) => (e.progress_percentage ?? 0) >= 70).length;
  const successRate =
    enrollmentStats.length > 0 ? Math.round((successfulEnrollments / enrollmentStats.length) * 100) : 0;
  return { members: usersCount, lessons: lessonsCount, successRate };
}

/* ── Stat card sub-component ── */
const StatCard: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <div className="text-center px-3 sm:px-5">
    <AnimatedCounter
      value={value}
      className="text-2xl sm:text-3xl md:text-4xl font-black text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
    />
    <div className="text-[10px] sm:text-xs text-foreground/50 mt-1 uppercase tracking-[0.15em] font-semibold">
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

  const displayStats = useMemo(
    () => [
      {
        key: "members",
        value: membersValue,
        label: isRTL ? content?.stats_members_ar || "عضو" : content?.stats_members_en || "Members",
      },
      {
        key: "lessons",
        value: lessonsValue,
        label: isRTL ? content?.stats_lessons_ar || "درس" : content?.stats_lessons_en || "Lessons",
      },
      {
        key: "success",
        value: successValue,
        label: isRTL ? content?.stats_success_ar || "نجاح" : content?.stats_success_en || "Success",
      },
    ],
    [membersValue, lessonsValue, successValue, isRTL, content],
  );

  const getText = (enKey: keyof HeroContent, arKey: keyof HeroContent, fallbackEn: string, fallbackAr: string) => {
    if (!content) return isRTL ? fallbackAr : fallbackEn;
    return isRTL ? content[arKey] || fallbackAr : content[enKey] || fallbackEn;
  };

  const title = getText("title_en", "title_ar", t("hero.title", { lng: "en" }), t("hero.title", { lng: "ar" }));
  const subtitle = getText("subtitle_en", "subtitle_ar", t("hero.subtitle", { lng: "en" }), t("hero.subtitle", { lng: "ar" }));
  const ctaText = getText("cta_en", "cta_ar", t("hero.cta", { lng: "en" }), t("hero.cta", { lng: "ar" }));
  const secondaryCta = getText("secondary_cta_en", "secondary_cta_ar", t("hero.secondaryCta", { lng: "en" }), t("hero.secondaryCta", { lng: "ar" }));

  const heroImage = content?.defaultHeroImage ?? defaultHeroImage;

  const fade = (duration: number, delay = 0) =>
    prefersReducedMotion ? { duration: 0 } : { duration, delay };

  return (
    <LazyMotion features={domAnimation} strict>
      <section className="relative min-h-[85svh] flex flex-col items-center justify-center overflow-hidden">
        {/* ── Background layers ── */}
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Motorcycle rider on desert highway"
            width={1920}
            height={1080}
            fetchPriority="high"
            decoding="async"
            className="w-full h-full object-cover object-center scale-105"
            loading="eager"
          />
          {/* Dark cinematic overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-background/80" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,hsl(var(--background))_100%)]" />
        </div>

        {/* Grain texture */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Glow orb */}
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.12 }}
          transition={fade(2, 0.5)}
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] rounded-full blur-[100px] pointer-events-none"
          style={{ background: "hsl(var(--primary) / 0.5)" }}
        />

        {/* ── Main content ── */}
        <div className="relative z-10 section-container text-center px-4 flex flex-col items-center gap-5 sm:gap-6 pt-8 sm:pt-10">
          {/* Floating discount badge */}
          <m.div
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fade(0.6, 0.2)}
            className="w-full"
          >
            <DiscountUrgencyBanner floating />
          </m.div>

          {/* Title with gradient */}
          {contentLoading ? (
            <Skeleton className="h-16 w-3/4 mx-auto" />
          ) : (
            <m.h1
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={fade(0.8, 0.35)}
              className="max-w-5xl mx-auto text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-tight tracking-tight bg-gradient-to-r from-primary via-sand to-primary bg-clip-text text-transparent drop-shadow-lg"
            >
              {title}
            </m.h1>
          )}

          {/* Subtitle */}
          {contentLoading ? (
            <Skeleton className="h-8 w-2/3 mx-auto" />
          ) : (
            <m.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={fade(0.7, 0.55)}
              className="mx-auto max-w-xl text-sm sm:text-base md:text-lg text-foreground/70 leading-relaxed"
            >
              {subtitle}
            </m.p>
          )}

          {/* CTAs */}
          <m.div
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fade(0.6, 0.65)}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-1 px-4 sm:px-0"
          >
            <Link to="/courses" className="w-full sm:w-auto">
              <Button
                variant="hero"
                size="lg"
                className="group w-full sm:w-auto min-h-[44px] sm:min-h-[52px] text-sm sm:text-base shadow-[0_4px_24px_hsl(var(--primary)/0.4)]"
              >
                <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                {secondaryCta}
              </Button>
            </Link>
            <Link to="/signup" className="w-full sm:w-auto">
              <Button
                variant="heroOutline"
                size="lg"
                className="group w-full sm:w-auto min-h-[44px] sm:min-h-[52px] text-sm sm:text-base backdrop-blur-sm"
              >
                {ctaText}
                <Arrow className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
              </Button>
            </Link>
          </m.div>

          {/* Stats row */}
          {showStats && (
            <m.div
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={fade(0.7, 0.85)}
              className="flex items-center justify-center gap-4 sm:gap-8 pt-4 sm:pt-6"
            >
              {displayStats.map((stat, index) => (
                <React.Fragment key={stat.key}>
                  {index > 0 && (
                    <div className="w-px h-10 bg-gradient-to-b from-transparent via-border to-transparent" />
                  )}
                  <StatCard value={stat.value} label={stat.label} />
                </React.Fragment>
              ))}
            </m.div>
          )}
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none" />

        {/* Scroll indicator */}
        {!prefersReducedMotion && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6 }}
            className="absolute bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 hidden sm:block"
          >
            <m.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-5 h-9 rounded-full border border-muted-foreground/20 flex items-start justify-center p-1.5"
            >
              <m.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-1 h-2.5 rounded-full bg-primary/60"
              />
            </m.div>
          </m.div>
        )}
      </section>
    </LazyMotion>
  );
};

export default HeroSection;
