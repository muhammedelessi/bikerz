import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { DailyChallenge, UserDailyProgress } from '@/hooks/useGamification';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Target,
  BookOpen,
  Zap,
  Award,
  Flame,
  Gift,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface DailyChallengesProps {
  challenges: DailyChallenge[];
  progress: UserDailyProgress[];
  onClaimReward?: (challengeId: string) => void;
}

const challengeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  complete_lessons: BookOpen,
  pass_quiz: Award,
  earn_xp: Zap,
  maintain_streak: Flame,
  perfect_activity: Target,
};

const DailyChallenges: React.FC<DailyChallengesProps> = ({
  challenges,
  progress,
  onClaimReward,
}) => {
  const { isRTL } = useLanguage();

  if (challenges.length === 0) {
    return (
      <div className="card-premium p-4 text-center">
        <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          {isRTL ? 'التحديات اليومية قادمة قريباً!' : 'Daily challenges coming soon!'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-foreground">
          {isRTL ? 'التحديات اليومية' : 'Daily Challenges'}
        </h3>
      </div>

      {challenges.map((challenge, index) => {
        const userProgress = progress.find(p => p.challenge_id === challenge.id);
        const currentValue = userProgress?.current_value || 0;
        const isCompleted = userProgress?.completed || false;
        const hasClaimed = userProgress?.claimed_reward || false;
        const progressPercent = Math.min(100, (currentValue / challenge.target_value) * 100);
        const Icon = challengeIcons[challenge.challenge_type] || Target;

        return (
          <motion.div
            key={challenge.id}
            initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`
              card-premium p-4 border-2 transition-all
              ${isCompleted ? 'border-primary/50 bg-primary/5' : 'border-border/50'}
            `}
          >
            <div className="flex items-start gap-3">
              <div className={`
                w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                ${isCompleted ? 'bg-primary/20' : 'bg-muted'}
              `}>
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                ) : (
                  <Icon className="w-5 h-5 text-muted-foreground" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h4 className="font-semibold text-foreground text-sm">
                      {isRTL && challenge.title_ar ? challenge.title_ar : challenge.title}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {isRTL && challenge.description_ar 
                        ? challenge.description_ar 
                        : challenge.description}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Zap className="w-3 h-3 text-primary" />
                    <span className="text-xs font-bold text-primary">
                      +{challenge.xp_reward}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{currentValue}/{challenge.target_value}</span>
                    <span>{Math.round(progressPercent)}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                </div>

                {isCompleted && !hasClaimed && onClaimReward && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="mt-2"
                  >
                    <Button
                      size="sm"
                      onClick={() => onClaimReward(challenge.id)}
                      className="w-full h-8 text-xs gap-1"
                    >
                      <Gift className="w-3 h-3" />
                      {isRTL ? 'استلم المكافأة' : 'Claim Reward'}
                    </Button>
                  </motion.div>
                )}

                {hasClaimed && (
                  <p className="text-xs text-primary mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {isRTL ? 'تم استلام المكافأة' : 'Reward Claimed'}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default DailyChallenges;
