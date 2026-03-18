import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { useLandingContent, CTAContent } from '@/hooks/useLandingContent';
import { Skeleton } from '@/components/ui/skeleton';

const CTASection: React.FC = () => {
  const { isRTL } = useLanguage();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const { data: content, isLoading } = useLandingContent<CTAContent>('cta');

  const title = isRTL ? (content?.title_ar || 'مستعد للانطلاق؟') : (content?.title_en || 'Ready to Ride?');
  const subtitle = isRTL ? (content?.subtitle_ar || '') : (content?.subtitle_en || '');
  const buttonText = isRTL ? (content?.button_ar || 'ابدأ التعلم اليوم') : (content?.button_en || 'Start Learning Today');
  const trustBadges = content?.trust_badges || [];

  return (
    <section ref={ref} className="relative py-10 sm:py-14 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-secondary/20 to-primary/10" />
      
      {/* Animated Glow */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[400px] lg:w-[600px] h-[300px] sm:h-[400px] lg:h-[600px] rounded-full bg-primary/20 blur-3xl"
        />
      </div>

      <div className="section-container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center px-4"
        >
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={inView ? { scale: 1 } : {}}
            transition={{ duration: 0.5, type: 'spring' }}
            className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-xl sm:rounded-2xl bg-primary/20 border border-primary/30 mb-6 sm:mb-8"
          >
            <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-primary" />
          </motion.div>

          {/* Title */}
          {isLoading ? (
            <Skeleton className="h-12 w-64 mx-auto mb-6" />
          ) : (
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 sm:mb-6">
              {title}
            </h2>
          )}

          {/* Subtitle */}
          {isLoading ? (
            <Skeleton className="h-6 w-96 mx-auto mb-10" />
          ) : (
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-8 sm:mb-10 max-w-xl mx-auto">
              {subtitle}
            </p>
          )}

          {/* CTA Button */}
          <Link to="/signup" className="inline-block w-full sm:w-auto">
            <Button variant="hero" size="xl" className="group w-full sm:w-auto min-h-[52px]">
              {buttonText}
              <Arrow className="w-5 h-5 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
            </Button>
          </Link>

          {/* Trust Badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 sm:mt-10 lg:mt-12 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 sm:gap-6 text-sm text-muted-foreground"
          >
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-24" />
              ))
            ) : trustBadges.length > 0 ? (
              trustBadges.map((badge, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  {isRTL ? badge.text_ar : badge.text_en}
                </div>
              ))
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  {isRTL ? 'ابدأ مجاناً' : 'Start Free'}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  {isRTL ? 'بدون بطاقة ائتمان' : 'No Credit Card'}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  {isRTL ? 'إلغاء في أي وقت' : 'Cancel Anytime'}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
