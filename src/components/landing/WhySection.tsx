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
    <section ref={ref} className="relative py-24 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
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
          className="text-center mb-16"
        >
          <h2 className="section-title text-foreground mb-4">
            {t('why.title')}
          </h2>
          <p className="section-subtitle">
            {t('why.subtitle')}
          </p>
        </motion.div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
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
                  />
                </div>
              )}
              
              <div className="relative z-10 flex items-start gap-5">
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-glow">
                    <card.icon className="w-7 h-7 text-primary-foreground" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                    {t(card.titleKey)}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
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
