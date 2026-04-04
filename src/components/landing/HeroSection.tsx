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
  Shield,
  Bike,
  Route,
  Gauge,
  Trophy,
  Compass,
  Wrench,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLandingContent, HeroContent } from "@/hooks/useLandingContent";
import heroRiderBg from "@/assets/hero-rider.webp";

// ... (fetchHeroStats و formatCount تبقى كما هي)

const StatCard: React.FC<{
  value: string;
  label: string;
  icon: React.ElementType;
  index: number;
  reducedMotion: boolean | null;
  isRTL: boolean;
}> = ({ value, label, icon: Icon, index, reducedMotion, isRTL }) => (
  <m.div
    initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.8 + index * 0.1 }}
    className="relative flex flex-col items-center justify-center p-2 sm:p-4 group"
  >
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="hidden sm:flex w-10 h-10 rounded-full bg-primary/10 items-center justify-center border border-primary/20 group-hover:scale-110 transition-transform">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="flex flex-col items-center sm:items-start">
        <AnimatedCounter value={value} className="text-lg sm:text-2xl font-black text-white tracking-tighter" />
        <span className="text-[9px] sm:text-[10px] text-white/40 uppercase tracking-widest font-bold">{label}</span>
      </div>
    </div>
  </m.div>
);

const HeroSection: React.FC = () => {
  const { isRTL } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const { data: content } = useLandingContent<HeroLandingContent>("hero");

  // ... (نفس منطق استدعاء البيانات والـ Stats)

  return (
    <LazyMotion features={domAnimation} strict>
      <section
        className="relative flex flex-col justify-center overflow-hidden bg-[#050505]"
        style={{ minHeight: "100svh" }}
        dir={isRTL ? "rtl" : "ltr"}
      >
        {/* 1. Background Layer - Enhanced Gradients */}
        <div className="absolute inset-0 z-0">
          <m.div
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.5 }}
            className="h-full w-full"
          >
            <img src={heroRiderBg} className="w-full h-full object-cover object-center opacity-60" alt="Biker Hero" />
          </m.div>
          {/* Gradients for depth */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/20 to-transparent" />
        </div>

        {/* 2. Content Layer */}
        <div className="relative z-10 container mx-auto px-6 grid lg:grid-cols-12 gap-12 items-center pt-20">
          <div className="lg:col-span-8 flex flex-col items-start text-start max-w-4xl">
            {/* Live Badge */}
            <m.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl mb-6"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">
                {isRTL ? "أكاديمية بايكرز المعتمدة" : "Certified Bikerz Academy"}
              </span>
            </m.div>

            {/* Headline - Typography Focus */}
            <m.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-4xl sm:text-6xl md:text-7xl lg:text-[84px] font-black leading-[0.95] tracking-tight text-white mb-6"
            >
              {isRTL ? "قد دراجتك" : "RIDE WITH"}{" "}
              <span className="text-primary italic inline-block transform -skew-x-6">
                {isRTL ? "بأقصى احترافية" : "PRECISION"}
              </span>
            </m.h1>

            {/* Subtitle */}
            <m.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-lg md:text-xl text-white/50 max-w-xl leading-relaxed mb-10 font-light"
            >
              {subtitle}
            </m.p>

            {/* Action Buttons */}
            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="flex flex-wrap gap-4 w-full sm:w-auto"
            >
              <Link to="/courses" className="flex-1 sm:flex-none">
                <Button className="w-full sm:w-auto h-14 px-10 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-tighter text-lg rounded-none shadow-[10px_10px_0px_0px_rgba(232,66,10,0.2)] hover:shadow-none transition-all">
                  {ctaText}
                  {isRTL ? <ArrowLeft className="mr-2 w-5 h-5" /> : <ArrowRight className="ml-2 w-5 h-5" />}
                </Button>
              </Link>

              <Link to="/join-community" className="flex-1 sm:flex-none">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto h-14 px-8 border-white/20 hover:bg-white/5 text-white font-bold uppercase tracking-tight text-sm rounded-none backdrop-blur-md"
                >
                  <Users className="w-4 h-4 mx-2" />
                  {isRTL ? "انضم للمجتمع" : "Join Community"}
                </Button>
              </Link>
            </m.div>
          </div>
        </div>

        {/* 3. Stats Bar - Modern Glassmorphism Overlay */}
        {showStats && (
          <div className="absolute bottom-0 left-0 w-full z-20">
            <div className="container mx-auto px-6 pb-10">
              <m.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.7 }}
                className="bg-white/[0.03] border-t border-x border-white/10 backdrop-blur-2xl p-6 md:p-10 rounded-t-[40px] grid grid-cols-2 md:grid-cols-4 gap-6 divide-x divide-white/5"
              >
                {displayStats.map((stat, i) => (
                  <StatCard key={stat.key} {...stat} index={i} reducedMotion={prefersReducedMotion} isRTL={isRTL} />
                ))}
              </m.div>
            </div>
          </div>
        )}
      </section>
    </LazyMotion>
  );
};

export default HeroSection;
