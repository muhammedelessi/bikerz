import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import communityImage from '@/assets/community-ride.jpg';

const CommunitySection: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  // Fetch real community stats from database
  const { data: stats } = useQuery({
    queryKey: ['community-stats'],
    queryFn: async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [
        { count: totalUsers },
        { count: totalCourses },
        { count: totalEnrollments },
        { count: recentSignups },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('courses').select('*', { count: 'exact', head: true }).eq('is_published', true),
        supabase.from('course_enrollments').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
      ]);

      return {
        totalUsers: totalUsers || 0,
        totalCourses: totalCourses || 0,
        totalEnrollments: totalEnrollments || 0,
        recentSignups: recentSignups || 0,
      };
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Format numbers for display
  const formatCount = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K+`;
    }
    return count > 0 ? `${count}+` : '0';
  };

  const displayStats = [
    { 
      value: formatCount(stats?.totalUsers || 0), 
      label: isRTL ? 'راكب مسجل' : 'Registered Riders' 
    },
    { 
      value: formatCount(stats?.totalCourses || 0), 
      label: isRTL ? 'دورة متاحة' : 'Available Courses' 
    },
    { 
      value: formatCount(stats?.totalEnrollments || 0), 
      label: isRTL ? 'تسجيل في الدورات' : 'Course Enrollments' 
    },
    { 
      value: formatCount(stats?.recentSignups || 0), 
      label: isRTL ? 'راكب جديد هذا الشهر' : 'New This Month' 
    },
  ];

  return (
    <section ref={ref} className="relative py-12 sm:py-16 md:py-20 lg:py-24 overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={communityImage}
          alt="Community of riders"
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-background/90" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-background" />
      </div>

      <div className="section-container relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 sm:mb-12 lg:mb-16"
        >
          <h2 className="section-title text-foreground mb-3 sm:mb-4">
            {t('community.title')}
          </h2>
          <p className="section-subtitle">
            {t('community.subtitle')}
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {displayStats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="text-center p-4 sm:p-6 lg:p-8 rounded-xl sm:rounded-2xl bg-card/60 border border-border/30 backdrop-blur-sm hover:border-primary/30 transition-all duration-300"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={inView ? { scale: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.1, type: 'spring' }}
                className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-primary mb-1 sm:mb-2"
              >
                {stat.value}
              </motion.div>
              <div className="text-xs sm:text-sm lg:text-base text-muted-foreground font-medium">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Recent Signups Indicator */}
        {stats && stats.recentSignups > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-10 sm:mt-12 lg:mt-16 text-center"
          >
            <div className="inline-flex flex-col sm:flex-row items-center gap-3 sm:gap-4 px-4 sm:px-8 py-3 sm:py-4 rounded-2xl sm:rounded-full bg-secondary/20 border border-secondary/30">
              <div className="flex -space-x-2 sm:-space-x-3 rtl:space-x-reverse">
                {[...Array(Math.min(4, stats.recentSignups))].map((_, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-primary to-secondary border-2 border-background flex items-center justify-center text-xs font-bold text-primary-foreground"
                  >
                    {['A', 'M', 'K', 'S'][i]}
                  </div>
                ))}
              </div>
              <span className="text-sm sm:text-base text-foreground font-medium text-center">
                +{stats.recentSignups} {isRTL ? 'راكب انضموا هذا الشهر' : 'riders joined this month'}
              </span>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default CommunitySection;
