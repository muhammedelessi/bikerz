import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { 
  Shield, Award, Navigation, Users, Bike, Route, Trophy,
  CheckCircle2, Gauge, CornerDownRight, AlertTriangle, CloudRain, Map, Users2,
  Home, Target, BookOpen, Megaphone, Heart, Star, Zap, Crown,
  Flame, Rocket, Globe, Lock, Eye, Clock, Calendar, Bell,
  Gift, Medal, Flag, Compass, Mountain, Sun, Moon, Wind,
  LucideIcon
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import safetyImage from '@/assets/safety-hands.webp';
import instructorImage from '@/assets/instructor.webp';
import { useLandingContent, WhyContent } from '@/hooks/useLandingContent';
import { Skeleton } from '@/components/ui/skeleton';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const iconMap: Record<string, LucideIcon> = {
  Shield, Award, Navigation, Users, Bike, Route, Trophy,
  CheckCircle2, Gauge, CornerDownRight, AlertTriangle, CloudRain, Map, Users2,
  Home, Target, BookOpen, Megaphone, Heart, Star, Zap, Crown,
  Flame, Rocket, Globe, Lock, Eye, Clock, Calendar, Bell,
  Gift, Medal, Flag, Compass, Mountain, Sun, Moon, Wind,
};

const imageMap: Record<number, string | undefined> = {
  0: safetyImage,
  1: instructorImage,
};

const delayClass = (i: number) => `anim-delay-${Math.min(i + 1, 8)}`;

const WhySection: React.FC<{ content?: WhyContent; isLoading?: boolean }> = ({ content: propContent, isLoading: propLoading }) => {
  const { isRTL } = useLanguage();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1, fallbackInView: true });
  const scrollRef = useScrollReveal() as React.RefObject<HTMLElement>;
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const { data: fetchedContent, isLoading: fetchedLoading } = useLandingContent<WhyContent>('why');
  const content = propContent || fetchedContent;
  const isLoading = propLoading ?? fetchedLoading;

  const title = isRTL ? (content?.title_ar || 'لماذا تتعلم معنا؟') : (content?.title_en || 'Why Learn With Us?');
  const subtitle = isRTL ? (content?.subtitle_ar || '') : (content?.subtitle_en || '');
  const cards = content?.cards || [];

  const next = useCallback(() => {
    if (cards.length === 0) return;
    setActiveIndex((prev) => (prev + 1) % cards.length);
  }, [cards.length]);

  useEffect(() => {
    if (isPaused || cards.length <= 1) return;
    const interval = setInterval(next, 3500);
    return () => clearInterval(interval);
  }, [isPaused, next, cards.length]);

  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
    setIsPaused(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    const threshold = 50;
    if (Math.abs(diff) > threshold) {
      const direction = isRTL ? -1 : 1;
      if (diff * direction > 0) {
        setActiveIndex((prev) => (prev + 1) % cards.length);
      } else {
        setActiveIndex((prev) => (prev - 1 + cards.length) % cards.length);
      }
    }
    setTouchStart(null);
    setTimeout(() => setIsPaused(false), 2000);
  };

  const [direction, setDirection] = useState(1);

  const goToSlide = (index: number) => {
    setDirection(index > activeIndex ? 1 : -1);
    setActiveIndex(index);
    setIsPaused(true);
    setTimeout(() => setIsPaused(false), 3000);
  };

  useEffect(() => {
    setDirection(1);
  }, [activeIndex]);

  return (
    <section ref={(el) => { (ref as any)(el); (scrollRef as any).current = el; }} className="relative py-4 sm:py-10 overflow-hidden" style={{ minHeight: '500px' }}>
      {/* Subtle background accent */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(ellipse at 30% 50%, hsl(var(--primary)) 0%, transparent 60%),
                             radial-gradient(ellipse at 70% 50%, hsl(var(--secondary)) 0%, transparent 60%)`,
          }}
        />
      </div>

      <div className="section-container relative z-10">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12 anim-fade-up">
          {isLoading ? (
            <>
              <Skeleton className="h-10 w-64 mx-auto mb-4" />
              <Skeleton className="h-6 w-96 mx-auto" />
            </>
          ) : (
            <>
              <div className="section-header-accent" />
              <h2 className="section-title text-foreground mb-2 sm:mb-3">{title}</h2>
              {subtitle && (
                <p className="section-subtitle">{subtitle}</p>
              )}
            </>
          )}
        </div>

        {/* ─── Mobile: Stacked carousel card ─── */}
        <div className="sm:hidden">
          {isLoading ? (
            <Skeleton className="h-44 rounded-2xl" />
          ) : cards.length > 0 ? (
            <div className="space-y-5">
              <div
                className="relative overflow-hidden rounded-2xl border border-border/20 bg-card/60 backdrop-blur-md min-h-[200px] flex items-center justify-center"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                {/* Progress bar at top */}
                <div className="absolute top-0 inset-x-0 h-0.5 bg-border/10">
                  <motion.div
                    key={activeIndex}
                    className="h-full bg-primary rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 3.5, ease: 'linear' }}
                  />
                </div>

                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={activeIndex}
                    initial={{ opacity: 0, x: direction > 0 ? (isRTL ? -60 : 60) : (isRTL ? 60 : -60) }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction > 0 ? (isRTL ? 60 : -60) : (isRTL ? -60 : 60) }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="w-full px-5 py-8"
                  >
                    {(() => {
                      const card = cards[activeIndex];
                      const IconComponent = iconMap[card.icon] || Shield;
                      const cardTitle = isRTL ? card.title_ar : card.title_en;
                      const cardDesc = isRTL ? card.description_ar : card.description_en;
                      return (
                        <div className="flex flex-col items-center text-center gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
                            <IconComponent className="w-7 h-7 text-primary-foreground" />
                          </div>
                          <h3 className="text-base font-bold text-foreground leading-snug">{cardTitle}</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px]">{cardDesc}</p>
                        </div>
                      );
                    })()}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Dot indicators */}
              <div className="flex justify-center items-center gap-1.5">
                {cards.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goToSlide(i)}
                    className={`rounded-full transition-all duration-300 ${
                      i === activeIndex
                        ? 'w-5 h-1.5 bg-primary'
                        : 'w-1.5 h-1.5 bg-muted-foreground/25 hover:bg-muted-foreground/40'
                    }`}
                    aria-label={`Go to slide ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* ─── Desktop: Bento-style grid ─── */}
        <div className="hidden sm:grid sm:grid-cols-2 gap-4 lg:gap-5">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-40 rounded-2xl" />
            ))
          ) : (
            cards.map((card, index) => {
              const IconComponent = iconMap[card.icon] || Shield;
              const cardTitle = isRTL ? card.title_ar : card.title_en;
              const cardDesc = isRTL ? card.description_ar : card.description_en;

              return (
                <div
                  key={index}
                  className={`anim-fade-up ${delayClass(index)} group relative rounded-2xl border border-border/20 bg-card/40 backdrop-blur-sm p-5 lg:p-6 hover:border-primary/30 hover:bg-card/70 transition-all duration-300`}
                >
                  {/* Hover glow */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{ background: 'radial-gradient(circle at 50% 0%, hsl(var(--primary) / 0.06) 0%, transparent 70%)' }}
                  />
                  
                  <div className="relative z-10 flex items-start gap-4">
                    <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-primary flex items-center justify-center group-hover:shadow-[0_0_20px_hsl(var(--primary)/0.3)] transition-shadow duration-300">
                      <IconComponent className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-foreground mb-1.5 group-hover:text-primary transition-colors duration-300">
                        {cardTitle}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {cardDesc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};

export default WhySection;
