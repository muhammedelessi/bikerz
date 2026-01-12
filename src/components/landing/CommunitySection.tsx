import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useLanguage } from '@/contexts/LanguageContext';
import communityImage from '@/assets/community-ride.jpg';

const CommunitySection: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  const stats = [
    { valueKey: 'stat1.value', labelKey: 'stat1.label' },
    { valueKey: 'stat2.value', labelKey: 'stat2.label' },
    { valueKey: 'stat3.value', labelKey: 'stat3.label' },
    { valueKey: 'stat4.value', labelKey: 'stat4.label' },
  ];

  return (
    <section ref={ref} className="relative py-24 overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={communityImage}
          alt="Community of riders"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-background/90" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-background" />
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
            {t('community.title')}
          </h2>
          <p className="section-subtitle">
            {t('community.subtitle')}
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="text-center p-8 rounded-2xl bg-card/60 border border-border/30 backdrop-blur-sm hover:border-primary/30 transition-all duration-300"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={inView ? { scale: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.1, type: 'spring' }}
                className="text-4xl lg:text-5xl font-black text-primary mb-2"
              >
                {t(`community.${stat.valueKey}`)}
              </motion.div>
              <div className="text-muted-foreground font-medium">
                {t(`community.${stat.labelKey}`)}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Testimonial Placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-4 px-8 py-4 rounded-full bg-secondary/20 border border-secondary/30">
            <div className="flex -space-x-3 rtl:space-x-reverse">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary border-2 border-background flex items-center justify-center text-xs font-bold text-primary-foreground"
                >
                  {['A', 'M', 'K', 'S'][i]}
                </div>
              ))}
            </div>
            <span className="text-foreground font-medium">
              {isRTL ? '+1,000 راكب انضموا هذا الشهر' : '+1,000 riders joined this month'}
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CommunitySection;
