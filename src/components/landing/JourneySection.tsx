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

const stepAccents = [
  'from-primary/80 to-primary/40',
  'from-accent-orange/80 to-accent-orange/40',
  'from-deep-green/80 to-deep-green/40',
  'from-primary/80 to-accent-orange/40',
  'from-accent-orange/80 to-deep-green/40',
  'from-deep-green/80 to-primary/40',
];

const JourneySection: React.FC = () => {
  const { isRTL } = useLanguage();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1, fallbackInView: true });

  const { data: content, isLoading } = useLandingContent<JourneyContent>('journey');

  const title = isRTL ? (content?.title_ar || 'طريقك نحو الإتقان') : (content?.title_en || 'Your Path to Mastery');
  const subtitle = isRTL ? (content?.subtitle_ar || '') : (content?.subtitle_en || '');
  const steps = content?.steps || [];

  return (
    <section ref={ref} className="relative py-6 sm:py-10 overflow-hidden">
      {/* Subtle background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/5 to-background" />

      <div className="section-container relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-8 sm:mb-12"
        >
          {isLoading ? (
            <>
              <Skeleton className="h-10 w-64 mx-auto mb-4" />
              <Skeleton className="h-6 w-96 mx-auto" />
            </>
          ) : (
            <>
              <div className="section-header-accent" />
              <h2 className="section-title text-foreground mb-2 sm:mb-3">{title}</h2>
              <p className="section-subtitle">{subtitle}</p>
            </>
          )}
        </motion.div>

        {/* Steps */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            {/* Mobile: Vertical timeline */}
            <div className="lg:hidden relative max-w-md mx-auto">
              {/* Timeline line */}
              <div className={`absolute top-0 bottom-0 w-0.5 ${isRTL ? 'right-[19px]' : 'left-[19px]'}`}>
                <motion.div
                  initial={{ height: 0 }}
                  animate={inView ? { height: '100%' } : {}}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  className="w-full bg-gradient-to-b from-primary via-accent-orange/60 to-primary/20 rounded-full"
                />
              </div>

              <div className="space-y-5">
                {steps.map((step, index) => {
                  const IconComponent = iconMap[step.icon] || Shield;
                  const stepTitle = isRTL ? step.title_ar : step.title_en;
                  const stepDesc = isRTL ? step.description_ar : step.description_en;
                  const accent = stepAccents[index % stepAccents.length];

                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: isRTL ? 16 : -16 }}
                      animate={inView ? { opacity: 1, x: 0 } : {}}
                      transition={{ duration: 0.5, delay: 0.15 + index * 0.12 }}
                      className="relative flex items-start gap-4"
                    >
                      {/* Step number circle */}
                      <div className="relative z-10 flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-md">
                          <IconComponent className="w-5 h-5 text-primary-foreground" />
                        </div>
                      </div>

                      {/* Content card */}
                      <div className="flex-1 pb-1">
                        <div className="p-3.5 rounded-xl bg-card/80 border border-border/50 backdrop-blur-sm">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[11px] font-bold text-primary/70 tracking-wider uppercase">
                              {isRTL ? `الخطوة ${index + 1}` : `Step ${index + 1}`}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-foreground mb-1">{stepTitle}</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">{stepDesc}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Desktop: Alternating zigzag cards */}
            <div className="hidden lg:block relative max-w-5xl mx-auto">
              {/* Center timeline */}
              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5">
                <motion.div
                  initial={{ height: 0 }}
                  animate={inView ? { height: '100%' } : {}}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                  className="w-full bg-gradient-to-b from-primary via-accent-orange/50 to-primary/20 rounded-full"
                />
              </div>

              <div className="space-y-6">
                {steps.map((step, index) => {
                  const IconComponent = iconMap[step.icon] || Shield;
                  const stepTitle = isRTL ? step.title_ar : step.title_en;
                  const stepDesc = isRTL ? step.description_ar : step.description_en;
                  const isLeft = isRTL ? index % 2 !== 0 : index % 2 === 0;
                  const accent = stepAccents[index % stepAccents.length];

                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={inView ? { opacity: 1, y: 0 } : {}}
                      transition={{ duration: 0.5, delay: 0.2 + index * 0.12 }}
                      className="relative flex items-center"
                    >
                      {/* Left side */}
                      <div className={`flex-1 ${isLeft ? 'pe-10' : ''}`}>
                        {isLeft && (
                          <motion.div
                            whileHover={{ y: -4 }}
                            transition={{ type: 'spring', stiffness: 300 }}
                            className={`ms-auto max-w-sm p-5 rounded-2xl bg-card/60 border border-border/40 backdrop-blur-sm hover:border-primary/30 hover:bg-card/80 transition-all duration-300 group ${isRTL ? 'text-start' : 'text-end'}`}
                          >
                            <span className="text-[11px] font-bold text-primary/60 tracking-widest uppercase">
                              {isRTL ? `الخطوة ${index + 1}` : `Step ${index + 1}`}
                            </span>
                            <h3 className="text-lg font-bold text-foreground mt-1 mb-2 group-hover:text-primary transition-colors">{stepTitle}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">{stepDesc}</p>
                          </motion.div>
                        )}
                      </div>

                      {/* Center icon node */}
                      <div className="relative z-10 flex-shrink-0">
                        <motion.div
                          whileHover={{ scale: 1.15 }}
                          transition={{ type: 'spring', stiffness: 400 }}
                          className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg ring-4 ring-background"
                        >
                          <IconComponent className="w-7 h-7 text-primary-foreground" />
                        </motion.div>
                      </div>

                      {/* Right side */}
                      <div className={`flex-1 ${!isLeft ? 'ps-10' : ''}`}>
                        {!isLeft && (
                          <motion.div
                            whileHover={{ y: -4 }}
                            transition={{ type: 'spring', stiffness: 300 }}
                            className="max-w-sm p-5 rounded-2xl bg-card/60 border border-border/40 backdrop-blur-sm hover:border-primary/30 hover:bg-card/80 transition-all duration-300 group text-start"
                          >
                            <span className="text-[11px] font-bold text-primary/60 tracking-widest uppercase">
                              {isRTL ? `الخطوة ${index + 1}` : `Step ${index + 1}`}
                            </span>
                            <h3 className="text-lg font-bold text-foreground mt-1 mb-2 group-hover:text-primary transition-colors">{stepTitle}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">{stepDesc}</p>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default JourneySection;
