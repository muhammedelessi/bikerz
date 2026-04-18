import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import { Badge, getRarityColor, getRarityGlow } from '@/hooks/useGamification';
import {
  Trophy,
  Star,
  Flame,
  Zap,
  BookOpen,
  GraduationCap,
  Award,
  Timer,
  Moon,
  Sun,
  RotateCcw,
  TrendingUp,
  Crown,
  Sparkles,
  ClipboardCheck,
  PlayCircle,
  Footprints,
  Lock,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BadgeDisplayProps {
  badge: Badge;
  earned?: boolean;
  earnedAt?: string;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  onClick?: () => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  trophy: Trophy,
  star: Star,
  flame: Flame,
  zap: Zap,
  'book-open': BookOpen,
  'graduation-cap': GraduationCap,
  award: Award,
  timer: Timer,
  moon: Moon,
  sun: Sun,
  'rotate-ccw': RotateCcw,
  'trending-up': TrendingUp,
  crown: Crown,
  sparkles: Sparkles,
  'clipboard-check': ClipboardCheck,
  'play-circle': PlayCircle,
  footprints: Footprints,
};

const sizeClasses = {
  sm: 'w-10 h-10',
  md: 'w-14 h-14',
  lg: 'w-20 h-20',
};

const iconSizeClasses = {
  sm: 'w-5 h-5',
  md: 'w-7 h-7',
  lg: 'w-10 h-10',
};

const BadgeDisplay: React.FC<BadgeDisplayProps> = ({
  badge,
  earned = false,
  earnedAt,
  size = 'md',
  showTooltip = true,
  onClick,
}) => {
  const { isRTL } = useLanguage();
  const { t } = useTranslation();

  if (!badge) return null;

  const Icon = iconMap[badge.icon_name] || Trophy;

  const badgeContent = (
    <motion.div
      whileHover={earned ? { scale: 1.1 } : undefined}
      whileTap={earned ? { scale: 0.95 } : undefined}
      className={`
        relative ${sizeClasses[size]} rounded-xl flex items-center justify-center cursor-pointer
        ${earned 
          ? `bg-gradient-to-br from-card to-muted ${getRarityGlow(badge.rarity)}` 
          : 'bg-muted/30'
        }
        transition-all duration-300 border border-border/50
        ${earned ? 'hover:border-primary/50' : ''}
      `}
      onClick={onClick}
    >
      {earned ? (
        <Icon className={`${iconSizeClasses[size]} ${getRarityColor(badge.rarity)}`} />
      ) : (
        <Lock className={`${iconSizeClasses[size]} text-muted-foreground/30`} />
      )}
      
      {/* Rarity indicator */}
      {earned && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`
            absolute -bottom-1 -end-1 w-4 h-4 rounded-full border-2 border-background
            ${badge.rarity === 'legendary' ? 'bg-yellow-400' : ''}
            ${badge.rarity === 'epic' ? 'bg-purple-400' : ''}
            ${badge.rarity === 'rare' ? 'bg-blue-400' : ''}
            ${badge.rarity === 'common' ? 'bg-muted-foreground' : ''}
          `}
        />
      )}
    </motion.div>
  );

  if (!showTooltip) return badgeContent;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeContent}
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-[200px] bg-card border-border p-3"
        >
          <div className="space-y-1">
            <p className={`font-bold ${getRarityColor(badge.rarity)}`}>
              {isRTL && badge.name_ar ? badge.name_ar : badge.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {isRTL && badge.description_ar ? badge.description_ar : badge.description}
            </p>
            {earned && earnedAt && (
              <p className="text-xs text-primary mt-2">
                {t('gamification.badgeDisplay.earned')}: {new Date(earnedAt).toLocaleDateString()}
              </p>
            )}
            {!earned && (
              <p className="text-xs text-muted-foreground/50 mt-2">
                {t('gamification.badgeDisplay.lockedNotYet')}
              </p>
            )}
            {badge.xp_reward > 0 && (
              <p className="text-xs text-primary">
                +{badge.xp_reward} XP
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default BadgeDisplay;
