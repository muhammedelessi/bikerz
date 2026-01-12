import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Shield, Award, Navigation, Users } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import safetyImage from '@/assets/safety-hands.jpg';
import instructorImage from '@/assets/instructor.jpg';

const WhySection: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  const cards = [
    {
      icon: Shield,
      titleKey: 'why.card1.title',
      descKey: 'why.card1.description',
      image: safetyImage,
    },
    {
      icon: Award,
      titleKey: 'why.card2.title',
      descKey: 'why.card2.description',
      image: instructorImage,
    },
    {
      icon: Navigation,
      titleKey: 'why.card3.title',
      descKey: 'why.card3.description',
    },
    {
      icon: Users,
      titleKey: 'why.card4.title',
      descKey: 'why.card4.description',
    },
  ];

  return (
    <section ref={ref} className="relative py-12 sm:py-16 md:py-20 lg:py-24 overflow-hidden">
      {/* Background Pattern - Lighter on mobile */}
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
          className="text-center mb-10 sm:mb-12 lg:mb-16"
        >
          <h2 className="section-title text-foreground mb-3 sm:mb-4">
            {t('why.title')}
          </h2>
          <p className="section-subtitle">
            {t('why.subtitle')}
          </p>
        </motion.div>

        {/* Cards Grid - Single column on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
          {cards.map((card, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group interactive-card"
            >
              {card.image && (
                <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
                  <img
                    src={card.image}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              
              <div className="relative z-10 flex items-start gap-4 sm:gap-5">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-glow">
                    <card.icon className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg sm:text-xl font-bold text-foreground mb-1.5 sm:mb-2 group-hover:text-primary transition-colors">
                    {t(card.titleKey)}
                  </h3>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    {t(card.descKey)}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhySection;
