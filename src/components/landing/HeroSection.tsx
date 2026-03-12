import React from "react";
import AnimatedCounter from "@/components/common/AnimatedCounter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Play } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import defaultHeroImage from "@/assets/hero-rider.jpg";
import { useLandingContent, HeroContent } from "@/hooks/useLandingContent";
import { Skeleton } from "@/components/ui/skeleton";

const HeroSection: React.FC = () => {
  const { isRTL } = useLanguage();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  // Fetch dynamic content from database
  const { data: content, isLoading: contentLoading } = useLandingContent<HeroContent>("hero");

  // Fetch real stats from database
  const { data: stats } = useQuery({
    queryKey: ["hero-stats"],
    queryFn: async () => {
      const [profilesRes, lessonsRes, enrollmentsRes] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("lessons").select("*", { count: "exact", head: true }).eq("is_published", true),
        supabase.from("course_enrollments").select("progress_percentage"),
      ]);

      if (profilesRes.error) console.error("[hero-stats] profiles error:", profilesRes.error.message);
      if (lessonsRes.error) console.error("[hero-stats] lessons error:", lessonsRes.error.message);
      if (enrollmentsRes.error) console.error("[hero-stats] enrollments error:", enrollmentsRes.error.message);

      const usersCount = profilesRes.count ?? 0;
      const lessonsCount = lessonsRes.count ?? 0;
      const enrollmentStats = enrollmentsRes.data ?? [];

      console.log("[hero-stats]", { usersCount, lessonsCount, enrollments: enrollmentStats.length });

      const successfulEnrollments = enrollmentStats.filter((e) => (e.progress_percentage ?? 0) >= 70).length;
      const successRate =
        enrollmentStats.length > 0 ? Math.round((successfulEnrollments / enrollmentStats.length) * 100) : 0;

      return { members: usersCount, lessons: lessonsCount, successRate };
    },
    staleTime: 5 * 60 * 1000,
  });

  const formatCount = (count: number) => {
    if (count >= 1000) {
      return `${Math.floor(count / 1000)}K+`;
    }
    return count > 0 ? `${count}+` : "0";
  };

  const heroContent = content as any;

  // CMS override values always take priority over DB-computed stats
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

  // Get text based on language
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

  const heroImage = (content as any)?.background_image || defaultHeroImage;

  return (
    <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden pt-16 sm:pt-20 lg:pt-24">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Motorcycle rider on desert highway"
          className="w-full h-full object-cover object-center"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-black/60 hidden sm:block" />{" "}
      </div>

      {/* Animated Lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none hidden sm:block">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.1 }}
          transition={{ duration: 2 }}
          className="absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(
              90deg,
              transparent,
              transparent 100px,
              hsl(var(--primary) / 0.1) 100px,
              hsl(var(--primary) / 0.1) 101px
            )`,
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 section-container text-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="space-y-6 sm:space-y-8"
        >
          {/* Badge */}
          {showBadge && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm"
            >
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs sm:text-sm text-primary font-medium">
                {membersValue} {badgeText}
              </span>
            </motion.div>
          )}

          {/* Title */}
          {contentLoading ? (
            <Skeleton className="h-16 w-3/4 mx-auto" />
          ) : (
            <h1 className="hero-text max-w-5xl mx-auto leading-[1.15]">{title}</h1>
          )}

          {/* Subtitle */}
          {contentLoading ? (
            <Skeleton className="h-8 w-2/3 mx-auto" />
          ) : (
            <p className="hero-subtitle mx-auto">{subtitle}</p>
          )}

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4 px-4 sm:px-0"
          >
            <Link to="/signup" className="w-full sm:w-auto">
              <Button variant="hero" size="xl" className="group w-full sm:w-auto min-h-[52px]">
                {ctaText}
                <Arrow className="w-5 h-5 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
              </Button>
            </Link>
            <Link to="/courses" className="w-full sm:w-auto">
              <Button variant="heroOutline" size="xl" className="group w-full sm:w-auto min-h-[52px]">
                <Play className="w-5 h-5" />
                {secondaryCta}
              </Button>
            </Link>
          </motion.div>

          {/* Stats Row */}
          {showStats && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="grid grid-cols-3 gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-8 pt-8 sm:pt-12"
            >
              {displayStats.map((stat, index) => (
                <div key={index} className="text-center">
                  <AnimatedCounter
                    value={stat.value}
                    className="text-xl sm:text-2xl md:text-3xl font-black text-primary"
                  />
                  <div className="text-xs sm:text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 hidden sm:block"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2"
        >
          <div className="w-1.5 h-3 rounded-full bg-primary" />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
