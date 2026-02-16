import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Shield, Award, Navigation, Users, LucideIcon } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import safetyImage from '@/assets/safety-hands.jpg';
import instructorImage from '@/assets/instructor.jpg';
import { useLandingContent, WhyContent } from '@/hooks/useLandingContent';
import { Skeleton } from '@/components/ui/skeleton';

const iconMap: Record<string, LucideIcon> = {
  Shield,
  Award,
  Navigation,
  Users,
};

const imageMap: Record<number, string | undefined> = {
  0: safetyImage,
  1: instructorImage,
};

const WhySection: React.FC = () => {
  const { isRTL } = useLanguage();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  const { data: content, isLoading } = useLandingContent<WhyContent>('why');

  const title = isRTL ? (content?.title_ar || 'لماذا تتعلم معنا؟') : (content?.title_en || 'Why Learn With Us?');
  const subtitle = isRTL ? (content?.subtitle_ar || '') : (content?.subtitle_en || '');
  const cards = content?.cards || [];

  return (
    <section ref={ref} className="relative py-16 sm:py-20 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5 hidden sm:block">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, hsl(var(--primary)) 0%, transparent 50%),
                             radial-gradient(circle at 80% 50%, hsl(var(--secondary)) 0%, transparent 50%)`,
          }}
        />
      </div>

      <div className="section-container relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
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

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-xl" />
            ))
          ) : (
            cards.map((card, index) => {
              const IconComponent = iconMap[card.icon] || Shield;
              const cardTitle = isRTL ? card.title_ar : card.title_en;
              const cardDesc = isRTL ? card.description_ar : card.description_en;
              const image = imageMap[index];

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 40 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="group interactive-card"
                >
                  
                  <div className="relative z-10 flex items-start gap-4 sm:gap-5">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-glow">
                        <IconComponent className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg sm:text-xl font-bold text-foreground mb-1.5 sm:mb-2 group-hover:text-primary transition-colors">
                        {cardTitle}
                      </h3>
                      <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                        {cardDesc}
                      </p>
                    </div>
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

export default WhySection;
