import React from 'react';
import { useTranslation } from 'react-i18next';
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
} from 'lucide-react';

const LearnSection: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  const skills = [
    { icon: CheckCircle2, key: 'skill1' },
    { icon: Gauge, key: 'skill2' },
    { icon: CornerDownRight, key: 'skill3' },
    { icon: Navigation, key: 'skill4' },
    { icon: AlertTriangle, key: 'skill5' },
    { icon: CloudRain, key: 'skill6' },
    { icon: Map, key: 'skill7' },
    { icon: Users2, key: 'skill8' },
  ];

  return (
    <section ref={ref} className="relative py-24 overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 via-background to-primary/5" />

      <div className="section-container relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="section-title text-foreground mb-4">
            {t('learn.title')}
          </h2>
          <p className="section-subtitle">
            {t('learn.subtitle')}
          </p>
        </motion.div>

        {/* Skills Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {skills.map((skill, index) => (
            <motion.div
              key={skill.key}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.4, delay: 0.1 * index }}
              whileHover={{ y: -8, scale: 1.02 }}
              className="group p-6 rounded-2xl bg-card/60 border border-border/30 backdrop-blur-sm hover:border-primary/40 hover:bg-card/80 transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary to-secondary/60 flex items-center justify-center group-hover:from-primary group-hover:to-primary/60 transition-all duration-300">
                  <skill.icon className="w-6 h-6 text-secondary-foreground group-hover:text-primary-foreground transition-colors" />
                </div>
                <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                  {t(`learn.${skill.key}`)}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LearnSection;
