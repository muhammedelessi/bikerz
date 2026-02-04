import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  CheckCircle2,
  Gauge,
  CornerDownRight,
  Navigation,
  AlertTriangle,
  CloudRain,
  Map,
  Users2,
  LucideIcon,
} from 'lucide-react';
import { useLandingContent, LearnContent } from '@/hooks/useLandingContent';
import { Skeleton } from '@/components/ui/skeleton';

const iconMap: Record<string, LucideIcon> = {
  CheckCircle2,
  Gauge,
  CornerDownRight,
  Navigation,
  AlertTriangle,
  CloudRain,
  Map,
  Users2,
};

const LearnSection: React.FC = () => {
  const { isRTL } = useLanguage();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  const { data: content, isLoading } = useLandingContent<LearnContent>('learn');

  const title = isRTL ? (content?.title_ar || 'ما ستتقنه') : (content?.title_en || 'What You\'ll Master');
  const subtitle = isRTL ? (content?.subtitle_ar || '') : (content?.subtitle_en || '');
  const skills = content?.skills || [];

  return (
    <section ref={ref} className="relative py-12 sm:py-16 md:py-20 lg:py-24 overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 via-background to-primary/5" />

      <div className="section-container relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 sm:mb-12 lg:mb-16"
        >
          {isLoading ? (
            <>
              <Skeleton className="h-10 w-64 mx-auto mb-4" />
              <Skeleton className="h-6 w-96 mx-auto" />
            </>
          ) : (
            <>
              <h2 className="section-title text-foreground mb-3 sm:mb-4">{title}</h2>
              <p className="section-subtitle">{subtitle}</p>
            </>
          )}
        </motion.div>

        {/* Skills Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-xl" />
            ))
          ) : (
            skills.map((skill, index) => {
              const IconComponent = iconMap[skill.icon] || CheckCircle2;
              const skillText = isRTL ? skill.text_ar : skill.text_en;

              return (
                <motion.div
                  key={skill.key}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={inView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ duration: 0.4, delay: 0.1 * index }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="group p-4 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl bg-card/60 border border-border/30 backdrop-blur-sm hover:border-primary/40 hover:bg-card/80 transition-all duration-300 cursor-pointer"
                >
                  <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-secondary to-secondary/60 flex items-center justify-center flex-shrink-0 group-hover:from-primary group-hover:to-primary/60 transition-all duration-300">
                      <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 text-secondary-foreground group-hover:text-primary-foreground transition-colors" />
                    </div>
                    <span className="text-sm sm:text-base font-medium text-foreground text-center sm:text-start group-hover:text-primary transition-colors">
                      {skillText}
                    </span>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};

export default LearnSection;
