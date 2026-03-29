import React, { useMemo } from 'react';
import AnimatedCounter from '@/components/common/AnimatedCounter';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useLanguage } from '@/contexts/LanguageContext';
import heroBackground from '@/assets/hero-rider.webp';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLandingContent, CommunityContent, HeroContent } from '@/hooks/useLandingContent';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import { Users, GraduationCap, PlayCircle, BookOpen } from 'lucide-react';

interface HeroLandingContent extends HeroContent {
  show_stats?: boolean | string;
  stats_members_value?: string | number;
  stats_lessons_value?: string | number;
  stats_success_value?: string | number;
  stats_courses_value?: string | number;
}

const CommunitySection: React.FC = () => {
  const { isRTL } = useLanguage();
  const { t } = useTranslation();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  const { data: content, isLoading: contentLoading } = useLandingContent<CommunityContent>('community');

  // Fetch real stats from database (same as hero)
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['community-stats'],
    queryFn: async () => {
      const [profilesRes, lessonsRes, enrollmentsRes, coursesRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('lessons').select('*', { count: 'exact', head: true }).eq('is_published', true),
        supabase.from('course_enrollments').select('progress_percentage'),
        supabase.from('courses').select('*', { count: 'exact', head: true }).eq('is_published', true),
      ]);

      const enrollmentStats = enrollmentsRes.data ?? [];
      const completed = enrollmentStats.filter(e => (e.progress_percentage ?? 0) >= 70).length;
      const successRate = enrollmentStats.length > 0 
        ? Math.round((completed / enrollmentStats.length) * 100)
        : 0;

      return {
        members: profilesRes.count ?? 0,
        lessons: lessonsRes.count ?? 0,
        successRate,
        courses: coursesRes.count ?? 0,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const formatCount = (count: number) => {
    if (count >= 1000) return `${Math.floor(count / 1000)}K+`;
    return count > 0 ? `${count}+` : '0';
  };

  const title = isRTL ? (content?.title_ar || t('community.title')) : (content?.title_en || t('community.title'));
  const subtitle = isRTL ? (content?.subtitle_ar || '') : (content?.subtitle_en || '');
  const communityImage = (content as any)?.background_image || heroBackground;

  const displayStats = [
    { value: formatCount(stats?.members ?? 0), label: isRTL ? 'عضو' : 'Members', icon: Users },
    { value: stats?.successRate ? `${stats.successRate}%` : '0%', label: isRTL ? 'نسبة النجاح' : 'Success', icon: GraduationCap },
    { value: formatCount(stats?.lessons ?? 0), label: isRTL ? 'درس' : 'Lessons', icon: PlayCircle },
    { value: formatCount(stats?.courses ?? 0), label: isRTL ? 'دورة' : 'Courses', icon: BookOpen },
  ];

  const isLoading = contentLoading || statsLoading;

  return (
    <section ref={ref} className="relative py-16 sm:py-20 overflow-hidden">
      {/* Background Image with Black Overlay */}
      <div className="absolute inset-0">
        <picture>
          <source srcSet={communityImage} type="image/webp" />
          <img
            src={communityImage}
            alt="Group of motorcycle riders"
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </picture>
        <div className="absolute inset-0 bg-black/70" />
      </div>

      <div className="section-container relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            {isLoading ? (
              <>
                <Skeleton className="h-10 w-64 mb-4" />
                <Skeleton className="h-6 w-96" />
              </>
            ) : (
              <>
                <div className="w-10 h-1 rounded-full bg-primary mx-auto mb-3 sm:mb-4" />
                <h2 className="section-title text-white mb-2 sm:mb-3">{title}</h2>
                <p className="text-sm sm:text-base md:text-lg text-white/70 max-w-xl mx-auto">{subtitle}</p>
              </>
            )}
          </motion.div>

          {/* Stats Grid — same layout & icons as hero */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {displayStats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                  className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white/10 border border-white/10 backdrop-blur-sm text-center"
                >
                  {isLoading ? (
                    <>
                      <Skeleton className="h-8 w-16 mx-auto mb-2" />
                      <Skeleton className="h-4 w-20 mx-auto" />
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <AnimatedCounter
                        value={stat.value}
                        className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-1 block"
                      />
                      <div className="text-xs sm:text-sm text-white/60 uppercase tracking-wider font-medium">
                        {stat.label}
                      </div>
                    </>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CommunitySection;
