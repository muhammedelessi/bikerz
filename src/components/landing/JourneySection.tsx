import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Shield, Award, Navigation, Users, Bike, Route, Trophy,
  CheckCircle2, Gauge, CornerDownRight, AlertTriangle, CloudRain, Map, Users2,
  Home, Target, BookOpen, Megaphone, Heart, Star, Zap, Crown,
  Flame, Rocket, Globe, Lock, Eye, Clock, Calendar, Bell,
  Gift, Medal, Flag, Compass, Mountain, Sun, Moon, Wind,
  LucideIcon
} from 'lucide-react';
import { useLandingContent, JourneyContent } from '@/hooks/useLandingContent';
import { Skeleton } from '@/components/ui/skeleton';

const iconMap: Record<string, LucideIcon> = {
  Shield, Award, Navigation, Users, Bike, Route, Trophy,
  CheckCircle2, Gauge, CornerDownRight, AlertTriangle, CloudRain, Map, Users2,
  Home, Target, BookOpen, Megaphone, Heart, Star, Zap, Crown,
  Flame, Rocket, Globe, Lock, Eye, Clock, Calendar, Bell,
  Gift, Medal, Flag, Compass, Mountain, Sun, Moon, Wind,
};

const JourneySection: React.FC = () => {
  const { isRTL } = useLanguage();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1, fallbackInView: true });

  const { data: content, isLoading } = useLandingContent<JourneyContent>('journey');

  const title = isRTL ? (content?.title_ar || 'طريقك نحو الإتقان') : (content?.title_en || 'Your Path to Mastery');
  const subtitle = isRTL ? (content?.subtitle_ar || '') : (content?.subtitle_en || '');
  const steps = content?.steps || [];

  return (
    <section ref={ref} className="relative py-10 sm:py-14 bg-gradient-to-b from-background via-secondary/10 to-background overflow-hidden">
      {/* Road Pattern Background */}
      <div className="absolute inset-0 opacity-5 hidden md:block">
        <div className="absolute w-4 h-full bg-gradient-to-b from-transparent via-muted-foreground to-transparent" style={{ insetInlineStart: '50%', transform: isRTL ? 'translateX(50%)' : 'translateX(-50%)' }} />
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-8 bg-muted-foreground"
            style={{ top: `${i * 5 + 5}%`, insetInlineStart: '50%', transform: isRTL ? 'translateX(50%)' : 'translateX(-50%)' }}
          />
        ))}
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

        {/* Journey Steps */}
        <div className="relative max-w-4xl mx-auto">
          {/* Vertical Line */}
          <div className={`absolute top-0 bottom-0 w-0.5 sm:w-px ${isRTL ? 'right-6 sm:right-8 lg:right-1/2 lg:translate-x-1/2' : 'left-6 sm:left-8 lg:left-1/2 lg:-translate-x-1/2'}`}>
            <motion.div
              initial={{ height: 0 }}
              animate={inView ? { height: '100%' } : {}}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              className="w-full bg-gradient-to-b from-primary via-secondary to-primary/30"
            />
          </div>

          <div className="space-y-8">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-start gap-4 sm:gap-6">
                  <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              ))
            ) : (
              steps.map((step, index) => {
                const IconComponent = iconMap[step.icon] || Shield;
                const stepTitle = isRTL ? step.title_ar : step.title_en;
                const stepDesc = isRTL ? step.description_ar : step.description_en;

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.6, delay: 0.3 + index * 0.15 }}
                    className="relative"
                  >
                    {/* Mobile & Tablet Layout */}
                    <div className="flex lg:hidden items-start gap-4 sm:gap-6">
                      <div className="relative z-10 flex-shrink-0">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-card border-2 border-primary/50 flex items-center justify-center shadow-glow">
                          <IconComponent className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
                        </div>
                      </div>
                      <div className="flex-1 pt-1">
                        <h3 className="text-lg sm:text-xl font-bold text-foreground mb-1.5 sm:mb-2">{stepTitle}</h3>
                        <p className="text-sm sm:text-base text-muted-foreground">{stepDesc}</p>
                      </div>
                    </div>

                    {/* Desktop: Alternating layout */}
                    <div className={`hidden lg:flex items-center gap-8 ${index % 2 === 0 ? '' : 'flex-row-reverse'}`}>
                      <div className={`flex-1 ${index % 2 === 0 ? 'text-end' : 'text-start'}`}>
                        <motion.div
                          whileHover={{ scale: 1.02 }}
                          className="inline-block p-6 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300"
                        >
                          <h3 className="text-xl font-bold text-foreground mb-2">{stepTitle}</h3>
                          <p className="text-muted-foreground max-w-xs">{stepDesc}</p>
                        </motion.div>
                      </div>

                      <div className="relative z-10 flex-shrink-0">
                        <motion.div
                          whileHover={{ scale: 1.1, rotate: 10 }}
                          className="w-16 h-16 rounded-2xl bg-card border-2 border-primary/50 flex items-center justify-center shadow-glow transition-all duration-300"
                        >
                          <IconComponent className="w-8 h-8 text-primary" />
                        </motion.div>
                      </div>

                      <div className="flex-1" />
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default JourneySection;
