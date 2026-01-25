import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { getXPProgress } from '@/hooks/useGamification';
import { Zap, Star, Crown, Flame } from 'lucide-react';

interface XPProgressBarProps {
  totalXP: number;
  level: number;
  streak: number;
  compact?: boolean;
}

const XPProgressBar: React.FC<XPProgressBarProps> = ({ 
  totalXP, 
  level, 
  streak, 
  compact = false 
}) => {
  const { isRTL } = useLanguage();
  const { current, required, percentage } = getXPProgress(totalXP, level);

  const getLevelIcon = () => {
    if (level >= 15) return <Crown className="w-5 h-5 text-yellow-400" />;
    if (level >= 10) return <Star className="w-5 h-5 text-purple-400" />;
    if (level >= 5) return <Zap className="w-5 h-5 text-blue-400" />;
    return <Zap className="w-5 h-5 text-primary" />;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-full">
          {getLevelIcon()}
          <span className="text-sm font-bold text-foreground">{level}</span>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 bg-orange-500/20 px-2 py-1 rounded-full">
            <Flame className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-bold text-orange-400">{streak}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-premium p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center">
              {getLevelIcon()}
            </div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -end-1 bg-primary text-primary-foreground text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
            >
              {level}
            </motion.div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {isRTL ? 'المستوى' : 'Level'}
            </p>
            <p className="text-lg font-bold text-foreground">
              {isRTL ? `المستوى ${level}` : `Level ${level}`}
            </p>
          </div>
        </div>
        
        {streak > 0 && (
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-2 bg-gradient-to-r from-orange-500/20 to-red-500/20 px-3 py-2 rounded-lg"
          >
            <Flame className="w-5 h-5 text-orange-400 animate-pulse" />
            <div className="text-end">
              <p className="text-xs text-muted-foreground">
                {isRTL ? 'سلسلة' : 'Streak'}
              </p>
              <p className="font-bold text-orange-400">
                {streak} {isRTL ? 'يوم' : 'days'}
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* XP Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{current.toLocaleString()} XP</span>
          <span>{required.toLocaleString()} XP</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full relative"
          >
            <motion.div
              animate={{ x: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="absolute inset-0 bg-white/20 rounded-full"
            />
          </motion.div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {isRTL 
            ? `${required - current} XP للمستوى التالي` 
            : `${required - current} XP to next level`}
        </p>
      </div>
    </motion.div>
  );
};

export default XPProgressBar;
