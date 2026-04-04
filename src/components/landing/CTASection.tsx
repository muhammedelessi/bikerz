import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft, Play, Shield, Clock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { CTAContent } from '@/hooks/useLandingContent';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const CTASection: React.FC<{ content?: CTAContent; isLoading?: boolean }> = ({ content: propContent, isLoading: propLoading }) => {
  const { isRTL } = useLanguage();
  const { t } = useTranslation();
  const ref = useScrollReveal() as React.RefObject<HTMLElement>;
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const { data: fetchedContent, isLoading: fetchedLoading } = useLandingContent<CTAContent>('cta');
  const content = propContent || fetchedContent;
  const isLoading = propLoading ?? fetchedLoading;

  const title = isRTL ? (content?.title_ar || t('cta.title')) : (content?.title_en || t('cta.title'));
  const subtitle = isRTL ? (content?.subtitle_ar || '') : (content?.subtitle_en || '');
  const buttonText = isRTL ? (content?.button_ar || t('cta.button')) : (content?.button_en || t('cta.button'));

  const features = [
    { icon: Shield, text: isRTL ? 'تعلم آمن ومضمون' : 'Safe & Certified' },
    { icon: Clock, text: isRTL ? 'تعلم بوقتك' : 'Learn at Your Pace' },
  ];

  return (
    <section ref={ref} className="relative py-16 sm:py-20 lg:py-24 overflow-hidden bg-background">
      <div className="section-container relative z-10">
        <div className="max-w-2xl mx-auto text-center">
          {/* Accent line */}
          <div className="h-1 rounded-full bg-primary mx-auto mb-6 anim-grow-width" />

          {/* Title */}
          {isLoading ? (
            <Skeleton className="h-12 w-72 mx-auto mb-4" />
          ) : (
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight leading-tight mb-4 anim-fade-up">
              {title}
            </h2>
          )}

          {/* Subtitle */}
          {isLoading ? (
            <Skeleton className="h-6 w-96 mx-auto mb-8" />
          ) : (
            <p className="text-base sm:text-lg text-muted-foreground mb-8 sm:mb-10 max-w-lg mx-auto leading-relaxed anim-fade-up anim-delay-1">
              {subtitle}
            </p>
          )}

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-10 sm:mb-12 anim-fade-up anim-delay-2">
            <Link to="/signup" className="w-full sm:w-auto">
              <Button variant="hero" size="lg" className="group w-full sm:w-auto gap-2.5 px-8 py-6 text-base">
                <Play className="w-5 h-5 transition-transform group-hover:scale-110" />
                {buttonText}
              </Button>
            </Link>
            <Link to="/courses" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto gap-2.5 px-8 py-6 text-base border-border text-foreground bg-card/50 hover:bg-card hover:border-primary/30"
              >
                {isRTL ? 'تصفح الدورات' : 'Browse Courses'}
                <Arrow className="w-4 h-4 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
              </Button>
            </Link>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 anim-fade anim-delay-3">
            {features.map((feature, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/60 border border-border/50 backdrop-blur-sm"
              >
                <feature.icon className="w-4 h-4 text-primary" />
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
