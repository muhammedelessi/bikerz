import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGamification, Badge } from '@/hooks/useGamification';
import XPProgressBar from './XPProgressBar';
import StreakCounter from './StreakCounter';
import BadgeDisplay from './BadgeDisplay';
import DailyChallenges from './DailyChallenges';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Trophy,
  Target,
  Medal,
  TrendingUp,
} from 'lucide-react';

interface GamificationPanelProps {
  compact?: boolean;
}

const GamificationPanel: React.FC<GamificationPanelProps> = ({ compact = false }) => {
  const { isRTL } = useLanguage();
  const {
    gamificationData,
    gamificationLoading,
    allBadges,
    userBadges,
    dailyChallenges,
    dailyProgress,
  } = useGamification();

  if (gamificationLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!gamificationData) {
    return null;
  }

  const earnedBadgeIds = new Set(userBadges.map(ub => ub.badge_id));

  // Group badges by category
  const badgesByCategory = allBadges.reduce((acc, badge) => {
    if (!acc[badge.category]) {
      acc[badge.category] = [];
    }
    acc[badge.category].push(badge);
    return acc;
  }, {} as Record<string, Badge[]>);

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-4"
      >
        <XPProgressBar
          totalXP={gamificationData.total_xp}
          level={gamificationData.level}
          streak={gamificationData.current_streak}
          compact={false}
        />
        
        {/* Quick badge preview */}
        <div className="card-premium p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Trophy className="w-3 h-3" />
              {isRTL ? 'الشارات' : 'Badges'}
            </span>
            <span className="text-xs text-primary font-bold">
              {userBadges.length}/{allBadges.length}
            </span>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {userBadges.slice(0, 5).map((ub) => (
              <BadgeDisplay
                key={ub.id}
                badge={ub.badge!}
                earned={true}
                size="sm"
              />
            ))}
            {userBadges.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {isRTL ? 'لم تحصل على شارات بعد' : 'No badges earned yet'}
              </p>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* XP & Level */}
      <XPProgressBar
        totalXP={gamificationData.total_xp}
        level={gamificationData.level}
        streak={gamificationData.current_streak}
      />

      {/* Streak */}
      <StreakCounter
        currentStreak={gamificationData.current_streak}
        longestStreak={gamificationData.longest_streak}
        lastActivityDate={gamificationData.last_activity_date}
        freezeCount={gamificationData.streak_freeze_count}
      />

      {/* Tabs for Badges & Challenges */}
      <Tabs defaultValue="badges" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="badges" className="flex items-center gap-1">
            <Medal className="w-4 h-4" />
            {isRTL ? 'الشارات' : 'Badges'}
          </TabsTrigger>
          <TabsTrigger value="challenges" className="flex items-center gap-1">
            <Target className="w-4 h-4" />
            {isRTL ? 'التحديات' : 'Challenges'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="badges" className="mt-4">
          <div className="space-y-6">
            {Object.entries(badgesByCategory).map(([category, badges]) => (
              <div key={category}>
                <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  {isRTL
                    ? category === 'lessons' ? 'الدروس'
                      : category === 'quizzes' ? 'الاختبارات'
                        : category === 'streaks' ? 'السلاسل'
                          : category === 'speed' ? 'السرعة'
                            : category === 'special' ? 'خاصة'
                              : category === 'xp' ? 'الخبرة'
                                : category
                    : category.charAt(0).toUpperCase() + category.slice(1)
                  }
                </h4>
                <div className="flex flex-wrap gap-2">
                  {(badges as Badge[]).map((badge) => {
                    const userBadge = userBadges.find(ub => ub.badge_id === badge.id);
                    return (
                      <BadgeDisplay
                        key={badge.id}
                        badge={badge}
                        earned={earnedBadgeIds.has(badge.id)}
                        earnedAt={userBadge?.earned_at}
                        size="md"
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="challenges" className="mt-4">
          <DailyChallenges
            challenges={dailyChallenges}
            progress={dailyProgress}
          />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default GamificationPanel;
