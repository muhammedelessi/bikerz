import React from 'react';
import AnimatedCounter from '@/components/common/AnimatedCounter';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useLanguage } from '@/contexts/LanguageContext';
import defaultCommunityImage from '@/assets/community-ride.jpg';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLandingContent, CommunityContent } from '@/hooks/useLandingContent';
import { Skeleton } from '@/components/ui/skeleton';

const CommunitySection: React.FC = () => {
  const { isRTL } = useLanguage();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  const { data: content, isLoading: contentLoading } = useLandingContent<CommunityContent>('community');

  // Fetch real stats from database
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['community-stats'],
    queryFn: async () => {
      const [
        { count: totalMembers },
        { count: lessonsCount },
        activeLearnersResult,
        successRateResult,
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('lessons').select('*', { count: 'exact', head: true }).eq('is_published', true),
        supabase.from('course_enrollments').select('user_id', { count: 'exact', head: true }).gt('progress_percentage', 0),
        supabase.from('course_enrollments').select('progress_percentage'),
      ]);

      const enrollments = successRateResult.data || [];
      const completed = enrollments.filter(e => e.progress_percentage >= 70).length;
      const successRate = enrollments.length > 0 
        ? Math.round((completed / enrollments.length) * 100)
        : 0;

      return {
        members: totalMembers || 0,
        activeLearners: activeLearnersResult.count || 0,
        successRate,
        lessons: lessonsCount || 0,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const formatCount = (count: number, suffix = '+') => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K${suffix}`;
    }
    return `${count}${suffix}`;
  };

  const title = isRTL ? (content?.title_ar || 'انضم إلى الأخوية') : (content?.title_en || 'Join the Brotherhood');
  const subtitle = isRTL ? (content?.subtitle_ar || '') : (content?.subtitle_en || '');
  const communityImage = (content as any)?.background_image || defaultCommunityImage;

  const displayStats = [
    { 
      value: formatCount(stats?.members || 0), 
      label: isRTL ? 'عضو في المجتمع' : 'Community Members' 
    },
    { 
      value: formatCount(stats?.activeLearners || 0), 
      label: isRTL ? 'متعلم نشط' : 'Active Learners' 
    },
    { 
      value: stats?.successRate ? `${stats.successRate}%` : '0%', 
      label: isRTL ? 'معدل النجاح' : 'Success Rate' 
    },
    { 
      value: formatCount(stats?.lessons || 0), 
      label: isRTL ? 'درس فيديو' : 'Video Lessons' 
    },
  ];

  const isLoading = contentLoading || statsLoading;

  return (
    <section ref={ref} className="relative py-12 sm:py-16 md:py-20 lg:py-24 overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <img
          src={communityImage}
          alt="Group of motorcycle riders"
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/80" />
      </div>

      <div className="section-container relative z-10">
        <div className="max-w-3xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="mb-8 sm:mb-12"
          >
            {isLoading ? (
              <>
                <Skeleton className="h-10 w-64 mb-4" />
                <Skeleton className="h-6 w-96" />
              </>
            ) : (
              <>
                <h2 className="section-title text-foreground mb-3 sm:mb-4">{title}</h2>
                <p className="section-subtitle">{subtitle}</p>
              </>
            )}
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {displayStats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-card/60 border border-border/30 backdrop-blur-sm text-center"
              >
                {isLoading ? (
                  <>
                    <Skeleton className="h-8 w-16 mx-auto mb-2" />
                    <Skeleton className="h-4 w-20 mx-auto" />
                  </>
                ) : (
                  <>
                    <AnimatedCounter
                      value={stat.value}
                      className="text-2xl sm:text-3xl lg:text-4xl font-black text-primary mb-1 block"
                    />
                    <div className="text-xs sm:text-sm text-muted-foreground">
                      {stat.label}
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CommunitySection;
