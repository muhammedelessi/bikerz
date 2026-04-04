import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Shield, Award, Navigation, Users, Bike, Route, Trophy,
  CheckCircle2, Gauge, CornerDownRight, AlertTriangle, CloudRain, Map, Users2,
  Home, Target, BookOpen, Megaphone, Heart, Star, Zap, Crown,
  Flame, Rocket, Globe, Lock, Eye, Clock, Calendar, Bell,
  Gift, Medal, Flag, Compass, Mountain, Sun, Moon, Wind,
  LucideIcon,
} from 'lucide-react';
import { LearnContent } from '@/hooks/useLandingContent';
import { Skeleton } from '@/components/ui/skeleton';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const iconMap: Record<string, LucideIcon> = {
  Shield, Award, Navigation, Users, Bike, Route, Trophy,
  CheckCircle2, Gauge, CornerDownRight, AlertTriangle, CloudRain, Map, Users2,
  Home, Target, BookOpen, Megaphone, Heart, Star, Zap, Crown,
  Flame, Rocket, Globe, Lock, Eye, Clock, Calendar, Bell,
  Gift, Medal, Flag, Compass, Mountain, Sun, Moon, Wind,
};

const delayClass = (i: number) => `anim-delay-${Math.min(i + 1, 8)}`;

interface LearnSectionProps {
  content?: LearnContent;
  isLoading?: boolean;
}
const LearnSection: React.FC<LearnSectionProps> = ({ content, isLoading = false }) => {
  const { isRTL } = useLanguage();
  const ref = useScrollReveal() as React.RefObject<HTMLElement>;

  const title = isRTL ? (content?.title_ar || 'ما ستتقنه') : (content?.title_en || 'What You\'ll Master');
  const subtitle = isRTL ? (content?.subtitle_ar || '') : (content?.subtitle_en || '');
  const skills = content?.skills || [];

  return (
    <section ref={ref} className="relative py-16 sm:py-20 overflow-hidden" style={{ minHeight: '400px' }}>
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 via-background to-primary/5" />

      <div className="section-container relative z-10">
        {/* Header */}
        <div className="text-center mb-12 anim-fade-up">
          {isLoading ? (
            <>
              <Skeleton className="h-10 w-64 mx-auto mb-4" />
              <Skeleton className="h-6 w-96 mx-auto" />
            </>
          ) : (
            <>
              <div className="section-header-accent" />
              <h2 className="section-title text-foreground mb-2 sm:mb-3">{title}</h2>
              <p className="section-subtitle">{subtitle}</p>
            </>
          )}
        </div>

        {/* Skills Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-xl" />
            ))
          ) : (
            skills.map((skill, index) => {
              const IconComponent = iconMap[skill.icon] || CheckCircle2;
              const skillText = isRTL ? skill.text_ar : skill.text_en;

              return (
                <div
                  key={skill.key}
                  className={`anim-scale ${delayClass(index)} group p-4 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl bg-card/60 border border-border/30 backdrop-blur-sm hover:border-primary/40 hover:bg-card/80 transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:scale-[1.02]`}
                >
                  <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-primary flex items-center justify-center flex-shrink-0 transition-all duration-300">
                      <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground transition-colors" />
                    </div>
                    <span className="text-sm sm:text-base font-medium text-foreground text-center sm:text-start group-hover:text-primary transition-colors">
                      {skillText}
                    </span>
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

export default LearnSection;
