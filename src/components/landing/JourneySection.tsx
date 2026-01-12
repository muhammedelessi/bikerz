import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useLanguage } from '@/contexts/LanguageContext';
import { Bike, Shield, Route, Trophy } from 'lucide-react';

const JourneySection: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  const steps = [
    {
      icon: Shield,
      number: '01',
      titleKey: 'journey.step1.title',
      descKey: 'journey.step1.description',
    },
    {
      icon: Bike,
      number: '02',
      titleKey: 'journey.step2.title',
      descKey: 'journey.step2.description',
    },
    {
      icon: Route,
      number: '03',
      titleKey: 'journey.step3.title',
      descKey: 'journey.step3.description',
    },
    {
      icon: Trophy,
      number: '04',
      titleKey: 'journey.step4.title',
      descKey: 'journey.step4.description',
    },
  ];

  return (
    <section ref={ref} className="relative py-12 sm:py-16 md:py-20 lg:py-24 bg-gradient-to-b from-background via-secondary/10 to-background overflow-hidden">
      {/* Road Pattern Background - Hidden on mobile for performance */}
      <div className="absolute inset-0 opacity-5 hidden md:block">
        <div className="absolute left-1/2 -translate-x-1/2 w-4 h-full bg-gradient-to-b from-transparent via-muted-foreground to-transparent" />
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute left-1/2 -translate-x-1/2 w-1 h-8 bg-muted-foreground"
            style={{ top: `${i * 5 + 5}%` }}
          />
        ))}
      </div>

      <div className="section-container relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 sm:mb-16 lg:mb-20"
        >
          <h2 className="section-title text-foreground mb-3 sm:mb-4">
            {t('journey.title')}
          </h2>
          <p className="section-subtitle">
            {t('journey.subtitle')}
          </p>
        </motion.div>

        {/* Journey Steps - Mobile optimized */}
        <div className="relative max-w-4xl mx-auto">
          {/* Vertical Line - Positioned for mobile */}
          <div className="absolute left-6 sm:left-8 lg:left-1/2 lg:-translate-x-1/2 top-0 bottom-0 w-0.5 sm:w-px">
            <motion.div
              initial={{ height: 0 }}
              animate={inView ? { height: '100%' } : {}}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              className="w-full bg-gradient-to-b from-primary via-secondary to-primary/30"
            />
          </div>

          <div className="space-y-6 sm:space-y-8 lg:space-y-12">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.3 + index * 0.15 }}
                className="relative"
              >
                {/* Mobile & Tablet Layout */}
                <div className="flex lg:hidden items-start gap-4 sm:gap-6">
                  {/* Dot */}
                  <div className="relative z-10 flex-shrink-0">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-card border-2 border-primary/50 flex items-center justify-center shadow-glow">
                      <step.icon className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 pt-1">
                    <div className="text-xs sm:text-sm font-bold text-primary mb-1">{step.number}</div>
                    <h3 className="text-lg sm:text-xl font-bold text-foreground mb-1.5 sm:mb-2">
                      {t(step.titleKey)}
                    </h3>
                    <p className="text-sm sm:text-base text-muted-foreground">
                      {t(step.descKey)}
                    </p>
                  </div>
                </div>

                {/* Desktop: Alternating layout */}
                <div className={`hidden lg:flex items-center gap-8 ${
                  index % 2 === 0 ? '' : 'flex-row-reverse'
                }`}>
                  {/* Content */}
                  <div className={`flex-1 ${index % 2 === 0 ? 'text-end' : 'text-start'}`}>
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="inline-block p-6 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300"
                    >
                      <div className="text-sm font-bold text-primary mb-1">{step.number}</div>
                      <h3 className="text-xl font-bold text-foreground mb-2">
                        {t(step.titleKey)}
                      </h3>
                      <p className="text-muted-foreground max-w-xs">
                        {t(step.descKey)}
                      </p>
                    </motion.div>
                  </div>

                  {/* Center Dot */}
                  <div className="relative z-10 flex-shrink-0">
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 10 }}
                      className="w-16 h-16 rounded-2xl bg-card border-2 border-primary/50 flex items-center justify-center shadow-glow transition-all duration-300"
                    >
                      <step.icon className="w-8 h-8 text-primary" />
                    </motion.div>
                  </div>

                  {/* Spacer */}
                  <div className="flex-1" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default JourneySection;
