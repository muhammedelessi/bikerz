import React, { useEffect, useState } from "react";
import AnimatedCounter from "@/components/common/AnimatedCounter";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Play, Shield, Award, Users } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import defaultHeroImage from "@/assets/hero-rider.jpg";
import { useLandingContent, HeroContent } from "@/hooks/useLandingContent";
import { Skeleton } from "@/components/ui/skeleton";

// ── Floating Particle ──
const FloatingParticle: React.FC<{ delay: number; x: number; size: number }> = ({ delay, x, size }) => (
  <motion.div
    className="absolute rounded-full bg-primary/20"
    style={{ width: size, height: size, left: `${x}%` }}
    initial={{ y: "100vh", opacity: 0 }}
    animate={{ y: "-10vh", opacity: [0, 0.6, 0.6, 0] }}
    transition={{ duration: 8 + Math.random() * 4, delay, repeat: Infinity, ease: "linear" }}
  />
);

// ── Typed Text Effect ──
const TypedText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, 45);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <span className={className}>
      {displayed}
      {!done && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="inline-block w-[3px] h-[1em] bg-primary ml-0.5 align-middle"
        />
      )}
    </span>
  );
};

// ── Stat Card with hover ──
const StatCard: React.FC<{ value: string; label: string; icon: React.ElementType; delay: number }> = ({
  value,
  label,
  icon: Icon,
  delay,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 30, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.6, delay }}
    whileHover={{ y: -6, scale: 1.05 }}
    className="relative group cursor-default"
  >
    <div className="relative rounded-xl sm:rounded-2xl border border-border/30 bg-card/40 backdrop-blur-md p-4 sm:p-5 text-center overflow-hidden transition-colors duration-300 group-hover:border-primary/50">
      {/* Hover glow */}
      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors duration-300" />
      <div className="relative z-10">
        <Icon className="w-5 h-5 mx-auto mb-2 text-primary opacity-60 group-hover:opacity-100 transition-opacity" />
        <AnimatedCounter value={value} className="text-xl sm:text-2xl md:text-3xl font-black text-primary block" />
        <div className="text-xs sm:text-sm text-muted-foreground mt-0.5">{label}</div>
      </div>
    </div>
  </motion.div>
);

const HeroSection: React.FC = () => {
  const { isRTL } = useLanguage();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  // Parallax mouse tracking
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const bgX = useTransform(mouseX, [0, 1], [-15, 15]);
  const bgY = useTransform(mouseY, [0, 1], [-10, 10]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  };

  // Fetch dynamic content
  const { data: content, isLoading: contentLoading } = useLandingContent<HeroContent>("hero");

  // Fetch stats
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
      const successRate = enrollmentStats.length > 0 ? Math.round((successfulEnrollments / enrollmentStats.length) * 100) : 0;
      return { members: usersCount, lessons: lessonsCount, successRate };
    },
    staleTime: 5 * 60 * 1000,
  });

  const formatCount = (count: number) => (count >= 1000 ? `${Math.floor(count / 1000)}K+` : count > 0 ? `${count}+` : "0");

  const heroContent = content as any;
  const membersValue = heroContent?.stats_members_value ? String(heroContent.stats_members_value) : formatCount(stats?.members || 0);
  const lessonsValue = heroContent?.stats_lessons_value ? String(heroContent.stats_lessons_value) : formatCount(stats?.lessons || 0);
  const successValue = heroContent?.stats_success_value ? `${heroContent.stats_success_value}%` : stats?.successRate ? `${stats.successRate}%` : "0%";
  const showStats = heroContent?.show_stats !== false && heroContent?.show_stats !== "false";
  const showBadge = heroContent?.show_badge !== false && heroContent?.show_badge !== "false";

  const statIcons = [Users, Shield, Award];
  const displayStats = [
    { value: membersValue, label: isRTL ? heroContent?.stats_members_ar || "عضو" : heroContent?.stats_members_en || "Members", icon: statIcons[0] },
    { value: lessonsValue, label: isRTL ? heroContent?.stats_lessons_ar || "درس" : heroContent?.stats_lessons_en || "Lessons", icon: statIcons[1] },
    { value: successValue, label: isRTL ? heroContent?.stats_success_ar || "نجاح" : heroContent?.stats_success_en || "Success", icon: statIcons[2] },
  ];

  const getText = (enKey: keyof HeroContent, arKey: keyof HeroContent, fallbackEn: string, fallbackAr: string) => {
    if (!content) return isRTL ? fallbackAr : fallbackEn;
    return isRTL ? content[arKey] || fallbackAr : content[enKey] || fallbackEn;
  };

  const title = getText("title_en", "title_ar", "Master the Art of Riding", "أتقن فن القيادة");
  const subtitle = getText("subtitle_en", "subtitle_ar", "Join 15,000+ GCC riders on their journey from beginner to confident road master.", "انضم إلى أكثر من 15,000 راكب في الخليج في رحلتهم من المبتدئين إلى أساتذة الطريق.");
  const ctaText = getText("cta_en", "cta_ar", "Start Your Journey", "ابدأ رحلتك");
  const secondaryCta = getText("secondary_cta_en", "secondary_cta_ar", "Explore Courses", "استكشف الدورات");
  const badgeText = getText("badge_text_en", "badge_text_ar", "GCC Riders", "راكب في الخليج");
  const heroImage = heroContent?.background_image || defaultHeroImage;

  // Particles data
  const particles = React.useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ id: i, delay: i * 0.7, x: Math.random() * 100, size: 3 + Math.random() * 5 })),
    []
  );

  return (
    <section
      className="relative min-h-[100svh] flex items-center justify-center overflow-hidden pt-16 sm:pt-20 lg:pt-24"
      onMouseMove={handleMouseMove}
    >
      {/* Parallax Background */}
      <motion.div className="absolute inset-[-30px]" style={{ x: bgX, y: bgY }}>
        <img
          src={heroImage}
          alt="Motorcycle rider on desert highway"
          className="w-full h-full object-cover object-center"
          loading="eager"
        />
      </motion.div>

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/50 to-background" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-background/60 hidden sm:block" />

      {/* Floating Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p) => (
          <FloatingParticle key={p.id} delay={p.delay} x={p.x} size={p.size} />
        ))}
      </div>

      {/* Animated grid lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none hidden sm:block">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.06 }}
          transition={{ duration: 2 }}
          className="absolute inset-0"
          style={{
            backgroundImage: `
              repeating-linear-gradient(90deg, transparent, transparent 120px, hsl(var(--primary) / 0.15) 120px, hsl(var(--primary) / 0.15) 121px),
              repeating-linear-gradient(0deg, transparent, transparent 120px, hsl(var(--primary) / 0.08) 120px, hsl(var(--primary) / 0.08) 121px)
            `,
          }}
        />
      </div>

      {/* Radial glow */}
      <motion.div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.12) 0%, transparent 70%)" }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Content */}
      <div className="relative z-10 section-container text-center px-4">
        <div className="space-y-6 sm:space-y-8">
          {/* Badge */}
          <AnimatePresence>
            {showBadge && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, type: "spring", stiffness: 200 }}
                className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm"
              >
                <motion.span
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="text-xs sm:text-sm text-primary font-medium">
                  {membersValue} {badgeText}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Title with typing effect */}
          {contentLoading ? (
            <Skeleton className="h-16 w-3/4 mx-auto" />
          ) : (
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="hero-text max-w-5xl mx-auto leading-[1.15]"
            >
              <TypedText text={title} />
            </motion.h1>
          )}

          {/* Subtitle */}
          {contentLoading ? (
            <Skeleton className="h-8 w-2/3 mx-auto" />
          ) : (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 1.2 }}
              className="hero-subtitle mx-auto"
            >
              {subtitle}
            </motion.p>
          )}

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4 px-4 sm:px-0"
          >
            <Link to="/signup" className="w-full sm:w-auto">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                <Button variant="hero" size="xl" className="group w-full sm:w-auto min-h-[52px] relative overflow-hidden">
                  {/* Shimmer effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-primary-foreground/10 to-transparent -skew-x-12"
                    animate={{ x: ["-200%", "200%"] }}
                    transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                  />
                  <span className="relative z-10 flex items-center gap-2">
                    {ctaText}
                    <Arrow className="w-5 h-5 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
                  </span>
                </Button>
              </motion.div>
            </Link>
            <Link to="/courses" className="w-full sm:w-auto">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                <Button variant="heroOutline" size="xl" className="group w-full sm:w-auto min-h-[52px]">
                  <Play className="w-5 h-5" />
                  {secondaryCta}
                </Button>
              </motion.div>
            </Link>
          </motion.div>

          {/* Stats Row */}
          {showStats && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 2 }}
              className="grid grid-cols-3 gap-3 sm:gap-6 max-w-lg sm:max-w-xl mx-auto pt-8 sm:pt-12"
            >
              {displayStats.map((stat, index) => (
                <StatCard key={index} value={stat.value} label={stat.label} icon={stat.icon} delay={2.1 + index * 0.15} />
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3 }}
        className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 hidden sm:block"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => window.scrollTo({ top: window.innerHeight, behavior: "smooth" })}
        >
          <motion.div
            className="w-1.5 h-3 rounded-full bg-primary"
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
