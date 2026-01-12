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
    <section ref={ref} className="relative py-24 bg-gradient-to-b from-background via-secondary/10 to-background overflow-hidden">
      {/* Road Pattern Background */}
      <div className="absolute inset-0 opacity-5">
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
          className="text-center mb-20"
        >
          <h2 className="section-title text-foreground mb-4">
            {t('journey.title')}
          </h2>
          <p className="section-subtitle">
            {t('journey.subtitle')}
          </p>
        </motion.div>

        {/* Journey Steps */}
        <div className="relative max-w-4xl mx-auto">
          {/* Vertical Line */}
          <div className="absolute left-8 lg:left-1/2 lg:-translate-x-1/2 top-0 bottom-0 w-px">
            <motion.div
              initial={{ height: 0 }}
              animate={inView ? { height: '100%' } : {}}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              className="w-full bg-gradient-to-b from-primary via-secondary to-primary/30"
            />
          </div>

          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: isRTL ? (index % 2 === 0 ? 50 : -50) : (index % 2 === 0 ? -50 : 50) }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.3 + index * 0.2 }}
              className={`relative flex items-center gap-8 mb-12 last:mb-0 ${
                index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'
              }`}
            >
              {/* Mobile: Always left-aligned */}
              <div className="flex lg:hidden items-center gap-6 w-full">
                {/* Dot */}
                <div className="relative z-10 flex-shrink-0">
                  <div className="w-16 h-16 rounded-2xl bg-card border-2 border-primary/50 flex items-center justify-center shadow-glow">
                    <step.icon className="w-8 h-8 text-primary" />
                  </div>
                </div>
                
                {/* Content */}
                <div className="flex-1">
                  <div className="text-sm font-bold text-primary mb-1">{step.number}</div>
                  <h3 className="text-xl font-bold text-foreground mb-2">
                    {t(step.titleKey)}
                  </h3>
                  <p className="text-muted-foreground">
                    {t(step.descKey)}
                  </p>
                </div>
              </div>

              {/* Desktop: Alternating layout */}
              <div className="hidden lg:flex items-center gap-8 w-full">
                {/* Left Content */}
                <div className={`flex-1 ${index % 2 === 0 ? 'text-end' : 'text-start order-3'}`}>
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
                <div className="relative z-10 flex-shrink-0 order-2">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 10 }}
                    className="w-16 h-16 rounded-2xl bg-card border-2 border-primary/50 flex items-center justify-center shadow-glow transition-all duration-300"
                  >
                    <step.icon className="w-8 h-8 text-primary" />
                  </motion.div>
                </div>

                {/* Right Spacer */}
                <div className={`flex-1 ${index % 2 === 0 ? 'order-3' : ''}`} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default JourneySection;
