import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

// Level thresholds (XP required for each level)
const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 850, 1300, 1900, 2600, 3500, 4600, 
  6000, 7700, 9700, 12000, 15000, 18500, 22500, 27000, 32000, 38000
];

export interface UserGamification {
  id: string;
  user_id: string;
  total_xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  streak_freeze_count: number;
  coins: number;
  combo_multiplier: number;
}

export interface Badge {
  id: string;
  code: string;
  name: string;
  name_ar: string | null;
  description: string;
  description_ar: string | null;
  icon_name: string;
  category: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  xp_reward: number;
  coin_reward: number;
  requirement_type: string;
  requirement_value: number;
  is_hidden: boolean;
}

export interface UserBadge {
  id: string;
  badge_id: string;
  earned_at: string;
  badge?: Badge;
}

export interface DailyChallenge {
  id: string;
  challenge_date: string;
  challenge_type: string;
  target_value: number;
  xp_reward: number;
  coin_reward: number;
  title: string;
  title_ar: string | null;
  description: string | null;
  description_ar: string | null;
}

export interface UserDailyProgress {
  id: string;
  challenge_id: string;
  current_value: number;
  completed: boolean;
  claimed_reward: boolean;
}

export function calculateLevel(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      return i + 1;
    }
  }
  return 1;
}

export function getXPForNextLevel(currentLevel: number): number {
  if (currentLevel >= LEVEL_THRESHOLDS.length) {
    return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + (currentLevel - LEVEL_THRESHOLDS.length + 1) * 5000;
  }
  return LEVEL_THRESHOLDS[currentLevel] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
}

export function getXPProgress(totalXP: number, level: number): { current: number; required: number; percentage: number } {
  const currentLevelXP = LEVEL_THRESHOLDS[level - 1] || 0;
  const nextLevelXP = getXPForNextLevel(level);
  const current = totalXP - currentLevelXP;
  const required = nextLevelXP - currentLevelXP;
  const percentage = Math.min(100, Math.round((current / required) * 100));
  return { current, required, percentage };
}

export function getRarityColor(rarity: string): string {
  switch (rarity) {
    case 'common': return 'text-muted-foreground';
    case 'rare': return 'text-blue-400';
    case 'epic': return 'text-purple-400';
    case 'legendary': return 'text-yellow-400';
    default: return 'text-muted-foreground';
  }
}

export function getRarityGlow(rarity: string): string {
  switch (rarity) {
    case 'common': return '';
    case 'rare': return 'shadow-[0_0_15px_rgba(59,130,246,0.4)]';
    case 'epic': return 'shadow-[0_0_20px_rgba(168,85,247,0.5)]';
    case 'legendary': return 'shadow-[0_0_25px_rgba(234,179,8,0.6)] animate-pulse';
    default: return '';
  }
}

export function useGamification() {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();

  // Fetch user gamification data
  const { data: gamificationData, isLoading: gamificationLoading } = useQuery({
    queryKey: ['user-gamification', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('user_gamification')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      // If no data exists, create initial record
      if (!data) {
        const { data: newData, error: insertError } = await supabase
          .from('user_gamification')
          .insert({ user_id: user.id })
          .select()
          .single();
        
        if (insertError) throw insertError;
        return newData as UserGamification;
      }
      
      return data as UserGamification;
    },
    enabled: !!user,
  });

  // Fetch all badges
  const { data: allBadges = [] } = useQuery({
    queryKey: ['achievement-badges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('achievement_badges')
        .select('*')
        .order('category', { ascending: true });

      if (error) throw error;
      return data as Badge[];
    },
  });

  // Fetch user earned badges
  const { data: userBadges = [] } = useQuery({
    queryKey: ['user-badges', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('user_badges')
        .select('*, badge:achievement_badges(*)')
        .eq('user_id', user.id);

      if (error) throw error;
      return data as (UserBadge & { badge: Badge })[];
    },
    enabled: !!user,
  });

  // Fetch daily challenges
  const { data: dailyChallenges = [] } = useQuery({
    queryKey: ['daily-challenges'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_challenges')
        .select('*')
        .eq('challenge_date', today);

      if (error) throw error;
      return data as DailyChallenge[];
    },
  });

  // Fetch user daily progress
  const { data: dailyProgress = [] } = useQuery({
    queryKey: ['user-daily-progress', user?.id],
    queryFn: async () => {
      if (!user || dailyChallenges.length === 0) return [];
      
      const challengeIds = dailyChallenges.map(c => c.id);
      const { data, error } = await supabase
        .from('user_daily_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('challenge_id', challengeIds);

      if (error) throw error;
      return data as UserDailyProgress[];
    },
    enabled: !!user && dailyChallenges.length > 0,
  });

  // Add XP mutation - uses SECURITY DEFINER RPC
  const addXPMutation = useMutation({
    mutationFn: async ({ 
      amount, 
      sourceType, 
      sourceId, 
      description, 
      descriptionAr 
    }: { 
      amount: number; 
      sourceType: string; 
      sourceId?: string;
      description?: string;
      descriptionAr?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('add_xp_secure', {
        p_amount: amount,
        p_source_type: sourceType,
        p_source_id: sourceId || null,
        p_description: description || null,
        p_description_ar: descriptionAr || null,
      });

      if (error) throw error;

      const result = data as {
        xpGained: number;
        newTotalXP: number;
        newLevel: number;
        leveledUp: boolean;
        newStreak: number;
      };

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['user-gamification'] });
      
      if (result.leveledUp) {
        toast.success(
          isRTL 
            ? `🎉 مبروك! وصلت للمستوى ${result.newLevel}!` 
            : `🎉 Level Up! You reached level ${result.newLevel}!`
        );
      }
    },
  });

  // Award badge mutation
  const awardBadgeMutation = useMutation({
    mutationFn: async (badgeId: string) => {
      if (!user) throw new Error('Not authenticated');

      // Check if already earned (client-side cache check)
      const existing = userBadges.find(ub => ub.badge_id === badgeId);
      if (existing) return null;

      const { data, error } = await supabase.rpc('award_badge_secure', {
        p_badge_id: badgeId,
      });

      if (error) throw error;
      
      const result = data as { awarded?: boolean; already_earned?: boolean; badge_name?: string; badge_name_ar?: string; xp_reward?: number; coin_reward?: number };
      if (result.already_earned) return null;

      return {
        badge_name: result.badge_name || '',
        badge_name_ar: result.badge_name_ar || '',
        xp_reward: result.xp_reward || 0,
      };
    },
    onSuccess: (result) => {
      if (result) {
        queryClient.invalidateQueries({ queryKey: ['user-badges'] });
        toast.success(
          isRTL 
            ? `🏆 فتحت شارة: ${result.badge_name_ar || result.badge_name}!` 
            : `🏆 Badge Unlocked: ${result.badge_name}!`
        );
        
        // Award badge XP via secure RPC
        if (result.xp_reward > 0) {
          addXPMutation.mutate({
            amount: result.xp_reward,
            sourceType: 'badge_reward',
            description: `Badge: ${result.badge_name}`,
            descriptionAr: `شارة: ${result.badge_name_ar || result.badge_name}`,
          });
        }
      }
    },
  });

  // Check and award badges based on current stats
  const checkBadges = async (stats: {
    lessonsCompleted?: number;
    quizzesPassed?: number;
    perfectScore?: boolean;
    streakDays?: number;
    totalXP?: number;
  }) => {
    if (!user || !allBadges.length) return;

    const earnedBadgeIds = new Set(userBadges.map(ub => ub.badge_id));

    for (const badge of allBadges) {
      if (earnedBadgeIds.has(badge.id)) continue;

      let shouldAward = false;

      switch (badge.requirement_type) {
        case 'lesson_count':
          if (stats.lessonsCompleted && stats.lessonsCompleted >= badge.requirement_value) {
            shouldAward = true;
          }
          break;
        case 'quiz_pass':
          if (stats.quizzesPassed && stats.quizzesPassed >= badge.requirement_value) {
            shouldAward = true;
          }
          break;
        case 'quiz_score':
          if (stats.perfectScore && badge.requirement_value === 100) {
            shouldAward = true;
          }
          break;
        case 'streak_days':
          if (stats.streakDays && stats.streakDays >= badge.requirement_value) {
            shouldAward = true;
          }
          break;
        case 'total_xp':
          if (stats.totalXP && stats.totalXP >= badge.requirement_value) {
            shouldAward = true;
          }
          break;
      }

      if (shouldAward) {
        await awardBadgeMutation.mutateAsync(badge.id);
      }
    }
  };

  return {
    gamificationData,
    gamificationLoading,
    allBadges,
    userBadges,
    dailyChallenges,
    dailyProgress,
    addXP: addXPMutation.mutate,
    addXPAsync: addXPMutation.mutateAsync,
    awardBadge: awardBadgeMutation.mutate,
    checkBadges,
    isAddingXP: addXPMutation.isPending,
  };
}
