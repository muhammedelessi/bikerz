import React from "react";
import AnimatedCounter from "@/components/common/AnimatedCounter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Play, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import defaultHeroImage from "@/assets/hero-rider.webp";
import { useLandingContent, HeroContent } from "@/hooks/useLandingContent";
import { Skeleton } from "@/components/ui/skeleton";

const HeroSection: React.FC = () => {
  const { isRTL } = useLanguage();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const { data: content, isLoading: contentLoading } = useLandingContent<HeroContent>("hero");

  const { data: stats } = useQuery({
    queryKey: ["hero-stats"],
    queryFn: async () => {
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
    },
    staleTime: 5 * 60 * 1000,
  });

  const formatCount = (count: number) => {
    if (count >= 1000) return `${Math.floor(count / 1000)}K+`;
    return count > 0 ? `${count}+` : "0";
  };

  const heroContent = content as any;

  const membersValue = heroContent?.stats_members_value
    ? String(heroContent.stats_members_value)
    : formatCount(stats?.members || 0);
  const lessonsValue = heroContent?.stats_lessons_value
    ? String(heroContent.stats_lessons_value)
    : formatCount(stats?.lessons || 0);
  const successValue = heroContent?.stats_success_value
    ? `${heroContent.stats_success_value}%`
    : stats?.successRate
      ? `${stats.successRate}%`
      : "0%";

  const showStats = heroContent?.show_stats !== false && heroContent?.show_stats !== "false";
  const showBadge = heroContent?.show_badge !== false && heroContent?.show_badge !== "false";

  const displayStats = [
    {
      value: membersValue,
      label: isRTL ? heroContent?.stats_members_ar || "عضو" : heroContent?.stats_members_en || "Members",
    },
    {
      value: lessonsValue,
      label: isRTL ? heroContent?.stats_lessons_ar || "درس" : heroContent?.stats_lessons_en || "Lessons",
    },
    {
      value: successValue,
      label: isRTL ? heroContent?.stats_success_ar || "نجاح" : heroContent?.stats_success_en || "Success",
    },
  ];

  const getText = (enKey: keyof HeroContent, arKey: keyof HeroContent, fallbackEn: string, fallbackAr: string) => {
    if (!content) return isRTL ? fallbackAr : fallbackEn;
    return isRTL ? content[arKey] || fallbackAr : content[enKey] || fallbackEn;
  };

  const title = getText("title_en", "title_ar", "Master the Art of Riding", "أتقن فن القيادة");
  const subtitle = getText(
    "subtitle_en",
    "subtitle_ar",
    "Join 15,000+ GCC riders on their journey from beginner to confident road master.",
    "انضم إلى أكثر من 15,000 راكب في الخليج في رحلتهم من المبتدئين إلى أساتذة الطريق.",
  );
  const ctaText = getText("cta_en", "cta_ar", "Start Your Journey", "ابدأ رحلتك");
  const secondaryCta = getText("secondary_cta_en", "secondary_cta_ar", "Explore Courses", "استكشف الدورات");
  const badgeText = getText("badge_text_en", "badge_text_ar", "GCC Riders", "راكب في الخليج");

  const heroImage = (content as any)?.defaultHeroImage || defaultHeroImage;

  return (
    <section className="relative min-h-[80svh] flex items-center justify-center overflow-hidden pt-6 sm:pt-8 lg:pt-10 will-change-auto">
      {/* Background Image with cinematic overlay */}
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
        {/* Multi-layer cinematic gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-background/80" />
        {/* Primary color vignette for brand warmth */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,hsl(var(--background))_100%)]" />
      </div>

      {/* Animated grain texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Glowing accent orb */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.15 }}
        transition={{ duration: 2, delay: 0.5 }}
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-[120px] pointer-events-none"
        style={{ background: "hsl(var(--primary) / 0.4)" }}
      />

      {/* Content */}
      <div className="relative z-10 section-container text-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-4 sm:space-y-6"
        >
          {/* Badge */}
          {showBadge && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-xl shadow-[0_0_30px_hsl(var(--primary)/0.15)]"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs sm:text-sm text-primary font-bold tracking-wider uppercase">
                {membersValue} {badgeText}
              </span>
            </motion.div>
          )}

          {/* Title with gradient text accent */}
          {contentLoading ? (
            <Skeleton className="h-16 w-3/4 mx-auto" />
          ) : (
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="hero-text max-w-5xl mx-auto"
            >
              {title}
            </motion.h1>
          )}

          {/* Subtitle */}
          {contentLoading ? (
            <Skeleton className="h-8 w-2/3 mx-auto" />
          ) : (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="hero-subtitle mx-auto max-w-xl text-foreground/70"
            >
              {subtitle}
            </motion.p>
          )}

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-3 px-4 sm:px-0"
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
          </motion.div>

          {/* Stats Row with glass cards */}
          {showStats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1 }}
              className="flex items-center justify-center gap-4 sm:gap-8 pt-5 sm:pt-8"
            >
              {displayStats.map((stat, index) => (
                <React.Fragment key={index}>
                  {index > 0 && (
                    <div className="w-px h-10 bg-gradient-to-b from-transparent via-border to-transparent" />
                  )}
                  <div className="text-center px-3 sm:px-5">
                    <AnimatedCounter
                      value={stat.value}
                      className="text-2xl sm:text-3xl md:text-4xl font-black text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
                    />
                    <div className="text-[10px] sm:text-xs text-foreground/50 mt-1.5 uppercase tracking-[0.15em] font-semibold">
                      {stat.label}
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Bottom fade for seamless transition */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none" />

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8 }}
        className="absolute bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 hidden sm:block"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-5 h-9 rounded-full border border-muted-foreground/20 flex items-start justify-center p-1.5"
        >
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-1 h-2.5 rounded-full bg-primary/60"
          />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
