import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft, Play } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import heroImage from '@/assets/hero-rider.jpg';

const HeroSection: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  // Fetch real stats from database
  const { data: stats } = useQuery({
    queryKey: ['hero-stats'],
    queryFn: async () => {
      const [
        { count: usersCount },
        { count: lessonsCount },
        { data: enrollmentStats },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('lessons').select('*', { count: 'exact', head: true }).eq('is_published', true),
        supabase.from('course_enrollments').select('progress_percentage'),
      ]);

      // Calculate success rate (enrollments with >70% progress)
      const successfulEnrollments = (enrollmentStats || []).filter(e => e.progress_percentage >= 70).length;
      const totalEnrollments = (enrollmentStats || []).length;
      const successRate = totalEnrollments > 0 
        ? Math.round((successfulEnrollments / totalEnrollments) * 100) 
        : 0;

      return {
        members: usersCount || 0,
        lessons: lessonsCount || 0,
        successRate,
      };
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Format numbers for display
  const formatCount = (count: number) => {
    if (count >= 1000) {
      return `${Math.floor(count / 1000)}K+`;
    }
    return count > 0 ? `${count}+` : '0';
  };

  const displayStats = [
    { 
      value: formatCount(stats?.members || 0), 
      label: isRTL ? 'عضو' : 'Members' 
    },
    { 
      value: formatCount(stats?.lessons || 0), 
      label: isRTL ? 'درس' : 'Lessons' 
    },
    { 
      value: stats?.successRate ? `${stats.successRate}%` : '0%', 
      label: isRTL ? 'نجاح' : 'Success' 
    },
  ];

  return (
    <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden pt-16 sm:pt-20 lg:pt-24">
      {/* Background Image - Optimized for mobile */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Motorcycle rider on desert highway"
          className="w-full h-full object-cover object-center"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-background/60 hidden sm:block" />
      </div>

      {/* Animated Lines - Lighter on mobile */}
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
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs sm:text-sm text-primary font-medium">
              {formatCount(stats?.members || 0)} {isRTL ? 'راكب في الخليج' : 'GCC Riders'}
            </span>
          </motion.div>

          {/* Title */}
          <h1 className="hero-text max-w-5xl mx-auto leading-[1.15]">
            {t('hero.title')}
          </h1>

          {/* Subtitle */}
          <p className="hero-subtitle mx-auto">
            {t('hero.subtitle')}
          </p>

          {/* CTAs - Stack on mobile */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4 px-4 sm:px-0"
          >
            <Link to="/signup" className="w-full sm:w-auto">
              <Button variant="hero" size="xl" className="group w-full sm:w-auto min-h-[52px]">
                {t('hero.cta')}
                <Arrow className="w-5 h-5 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
              </Button>
            </Link>
            <Link to="/courses" className="w-full sm:w-auto">
              <Button variant="heroOutline" size="xl" className="group w-full sm:w-auto min-h-[52px]">
                <Play className="w-5 h-5" />
                {t('hero.secondaryCta')}
              </Button>
            </Link>
          </motion.div>

          {/* Stats Row - Responsive grid */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="grid grid-cols-3 gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-8 pt-8 sm:pt-12"
          >
            {displayStats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-xl sm:text-2xl md:text-3xl font-black text-primary">{stat.value}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll Indicator - Hidden on small mobile */}
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
