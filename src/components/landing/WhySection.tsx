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

const WhySection: React.FC = () => {
  const { isRTL } = useLanguage();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const { data: content, isLoading } = useLandingContent<WhyContent>('why');

  const title = isRTL ? (content?.title_ar || 'لماذا تتعلم معنا؟') : (content?.title_en || 'Why Learn With Us?');
  const subtitle = isRTL ? (content?.subtitle_ar || '') : (content?.subtitle_en || '');
  const cards = content?.cards || [];

  const next = useCallback(() => {
    if (cards.length === 0) return;
    setActiveIndex((prev) => (prev + 1) % cards.length);
  }, [cards.length]);

  // Auto-play on mobile
  useEffect(() => {
    if (isPaused || cards.length <= 1) return;
    const interval = setInterval(next, 3500);
    return () => clearInterval(interval);
  }, [isPaused, next, cards.length]);

  // Swipe handling
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

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? (isRTL ? -80 : 80) : (isRTL ? 80 : -80),
      opacity: 0,
      scale: 0.95,
    }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (direction: number) => ({
      x: direction > 0 ? (isRTL ? 80 : -80) : (isRTL ? -80 : 80),
      opacity: 0,
      scale: 0.95,
    }),
  };

  const [direction, setDirection] = useState(1);

  const goToSlide = (index: number) => {
    setDirection(index > activeIndex ? 1 : -1);
    setActiveIndex(index);
    setIsPaused(true);
    setTimeout(() => setIsPaused(false), 3000);
  };

  // Update direction on auto-advance
  useEffect(() => {
    setDirection(1);
  }, [activeIndex]);

  const renderCard = (card: typeof cards[0], index: number) => {
    const IconComponent = iconMap[card.icon] || Shield;
    const cardTitle = isRTL ? card.title_ar : card.title_en;
    const cardDesc = isRTL ? card.description_ar : card.description_en;

    return (
      <div className="relative z-10 flex flex-col items-center text-center gap-4 px-2">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
          <IconComponent className="w-8 h-8 text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground mb-2">{cardTitle}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{cardDesc}</p>
        </div>
      </div>
    );
  };

  const renderDesktopCard = (card: typeof cards[0], index: number) => {
    const IconComponent = iconMap[card.icon] || Shield;
    const cardTitle = isRTL ? card.title_ar : card.title_en;
    const cardDesc = isRTL ? card.description_ar : card.description_en;

    return (
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 40 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: index * 0.1 }}
        className="group interactive-card"
      >
        <div className="relative z-10 flex items-start gap-4 sm:gap-5">
          <div className="flex-shrink-0">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-glow">
              <IconComponent className="w-7 h-7 text-primary-foreground" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
              {cardTitle}
            </h3>
            <p className="text-base text-muted-foreground leading-relaxed">
              {cardDesc}
            </p>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <section ref={ref} className="relative py-6 sm:py-10 overflow-hidden">
      {/* Background Pattern */}
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
          className="text-center mb-6 sm:mb-10"
        >
          {isLoading ? (
            <>
              <Skeleton className="h-10 w-64 mx-auto mb-4" />
              <Skeleton className="h-6 w-96 mx-auto" />
            </>
          ) : (
            <>
              <h2 className="section-title text-foreground mb-3 sm:mb-4">{title}</h2>
              <p className="section-subtitle">{subtitle}</p>
            </>
          )}
        </motion.div>

        {/* Mobile: Auto-sliding carousel */}
        <div className="sm:hidden">
          {isLoading ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : cards.length > 0 ? (
            <div>
              <div
                className="relative overflow-hidden rounded-2xl bg-card/50 border border-border/30 backdrop-blur-sm p-6 min-h-[180px] flex items-center justify-center"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={activeIndex}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                    className="w-full"
                  >
                    {renderCard(cards[activeIndex], activeIndex)}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Dots indicator */}
              <div className="flex justify-center gap-2 mt-4">
                {cards.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goToSlide(i)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      i === activeIndex
                        ? 'w-6 bg-primary'
                        : 'w-2 bg-muted-foreground/30'
                    }`}
                    aria-label={`Go to slide ${i + 1}`}
                  />
                ))}
              </div>

              {/* Counter */}
              <p className="text-center text-xs text-muted-foreground mt-2">
                {activeIndex + 1} / {cards.length}
              </p>
            </div>
          ) : null}
        </div>

        {/* Desktop: Grid */}
        <div className="hidden sm:grid sm:grid-cols-2 gap-6">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-xl" />
            ))
          ) : (
            cards.map((card, index) => renderDesktopCard(card, index))
          )}
        </div>
      </div>
    </section>
  );
};

export default WhySection;
