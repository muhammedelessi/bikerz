import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Flame, Snowflake, AlertTriangle } from 'lucide-react';

interface StreakCounterProps {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  freezeCount?: number;
}

const StreakCounter: React.FC<StreakCounterProps> = ({
  currentStreak,
  longestStreak,
  lastActivityDate,
  freezeCount = 0,
}) => {
  const { isRTL } = useLanguage();

  // Check if streak is at risk
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let isAtRisk = false;
  if (lastActivityDate) {
    const lastDate = new Date(lastActivityDate);
    lastDate.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    isAtRisk = diffDays >= 1 && currentStreak > 0;
  }

  // Generate last 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (6 - i));
    return {
      date,
      isActive: lastActivityDate 
        ? date <= new Date(lastActivityDate) && date >= new Date(new Date(lastActivityDate).getTime() - (currentStreak - 1) * 24 * 60 * 60 * 1000)
        : false,
      isToday: date.toDateString() === today.toDateString(),
    };
  });

  const getMultiplierBonus = () => {
    if (currentStreak >= 30) return '2.0x';
    if (currentStreak >= 14) return '1.7x';
    if (currentStreak >= 7) return '1.35x';
    if (currentStreak >= 3) return '1.15x';
    return '1.0x';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-premium p-4 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.div
            animate={currentStreak > 0 ? { 
              scale: [1, 1.2, 1],
              rotate: [0, 5, -5, 0],
            } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
            className={`
              w-12 h-12 rounded-full flex items-center justify-center
              ${currentStreak > 0 
                ? 'bg-gradient-to-br from-orange-500 to-red-500' 
                : 'bg-muted'
              }
            `}
          >
            <Flame className={`w-6 h-6 ${currentStreak > 0 ? 'text-white' : 'text-muted-foreground'}`} />
          </motion.div>
          <div>
            <p className="text-sm text-muted-foreground">
              {isRTL ? 'سلسلة الأيام' : 'Day Streak'}
            </p>
            <p className="text-2xl font-black text-foreground">
              {currentStreak}
            </p>
          </div>
        </div>

        {/* Multiplier Badge */}
        <div className="text-end">
          <p className="text-xs text-muted-foreground">
            {isRTL ? 'مضاعف XP' : 'XP Multiplier'}
          </p>
          <motion.p 
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-lg font-bold text-primary"
          >
            {getMultiplierBonus()}
          </motion.p>
        </div>
      </div>

      {/* At Risk Warning */}
      {isAtRisk && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center gap-2"
        >
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
          <p className="text-sm text-yellow-500">
            {isRTL 
              ? 'سلسلتك في خطر! أكمل درساً اليوم للحفاظ عليها' 
              : 'Your streak is at risk! Complete a lesson today to maintain it'}
          </p>
        </motion.div>
      )}

      {/* Week Visualization */}
      <div className="flex justify-between gap-1">
        {days.map((day, index) => (
          <motion.div
            key={index}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className="flex flex-col items-center gap-1"
          >
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center transition-all
              ${day.isActive 
                ? 'bg-gradient-to-br from-orange-500 to-red-500' 
                : day.isToday
                  ? 'bg-muted border-2 border-dashed border-primary'
                  : 'bg-muted/50'
              }
            `}>
              {day.isActive ? (
                <Flame className="w-4 h-4 text-white" />
              ) : (
                <span className="text-xs text-muted-foreground">
                  {day.date.getDate()}
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {day.date.toLocaleDateString(isRTL ? 'ar' : 'en', { weekday: 'narrow' })}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Stats */}
      <div className="flex justify-between pt-2 border-t border-border/50">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            {isRTL ? 'الأطول' : 'Longest'}
          </p>
          <p className="font-bold text-foreground">
            {longestStreak} {isRTL ? 'يوم' : 'days'}
          </p>
        </div>
        {freezeCount > 0 && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
              <Snowflake className="w-3 h-3" />
              {isRTL ? 'تجميد' : 'Freezes'}
            </p>
            <p className="font-bold text-blue-400">{freezeCount}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default StreakCounter;
