import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Trophy, Award, Target, Zap, BookOpen, Shield } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const ICON_MAP: Record<string, React.ElementType> = {
  trophy: Trophy,
  award: Award,
  target: Target,
  zap: Zap,
  book: BookOpen,
  shield: Shield,
};

const RARITY_COLORS: Record<string, string> = {
  common: 'border-muted-foreground/30 bg-muted/30',
  uncommon: 'border-green-500/30 bg-green-500/10',
  rare: 'border-blue-500/30 bg-blue-500/10',
  epic: 'border-purple-500/30 bg-purple-500/10',
  legendary: 'border-yellow-500/30 bg-yellow-500/10',
};

export const ProfileAchievements: React.FC = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();

  const { data: userBadges, isLoading } = useQuery({
    queryKey: ['user-badges', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_badges')
        .select(`
          id,
          earned_at,
          badge_id,
          achievement_badges (
            id,
            name,
            name_ar,
            description,
            description_ar,
            icon_name,
            rarity,
            category
          )
        `)
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Example achievements for display if no real badges earned yet
  const exampleAchievements = [
    {
      id: '1',
      name: 'First Lesson Completed',
      name_ar: 'أول درس مكتمل',
      description: 'Complete your first lesson',
      description_ar: 'أكمل درسك الأول',
      icon_name: 'book',
      rarity: 'common',
      earned: false,
    },
    {
      id: '2',
      name: 'Safety Focused',
      name_ar: 'مركز على السلامة',
      description: 'Complete all safety modules',
      description_ar: 'أكمل جميع وحدات السلامة',
      icon_name: 'shield',
      rarity: 'uncommon',
      earned: false,
    },
    {
      id: '3',
      name: 'Consistency Streak',
      name_ar: 'سلسلة الاستمرارية',
      description: 'Learn for 7 consecutive days',
      description_ar: 'تعلم لـ 7 أيام متتالية',
      icon_name: 'zap',
      rarity: 'rare',
      earned: false,
    },
    {
      id: '4',
      name: 'Advanced Course Starter',
      name_ar: 'بادئ الدورة المتقدمة',
      description: 'Start an advanced level course',
      description_ar: 'ابدأ دورة بمستوى متقدم',
      icon_name: 'target',
      rarity: 'epic',
      earned: false,
    },
  ];

  const displayBadges = userBadges && userBadges.length > 0
    ? userBadges.map(ub => ({
        id: ub.badge_id,
        name: ub.achievement_badges?.name || '',
        name_ar: ub.achievement_badges?.name_ar || '',
        description: ub.achievement_badges?.description || '',
        description_ar: ub.achievement_badges?.description_ar || '',
        icon_name: ub.achievement_badges?.icon_name || 'trophy',
        rarity: ub.achievement_badges?.rarity || 'common',
        earned: true,
        earned_at: ub.earned_at,
      }))
    : exampleAchievements;

  if (isLoading) {
    return (
      <div className="card-premium p-6">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card-premium p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-yellow-400" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          {isRTL ? 'الإنجازات' : 'Achievements'}
        </h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {displayBadges.map((badge) => {
          const IconComponent = ICON_MAP[badge.icon_name] || Trophy;
          const rarityColor = RARITY_COLORS[badge.rarity] || RARITY_COLORS.common;

          return (
            <div
              key={badge.id}
              className={`relative border rounded-lg p-4 text-center transition-all ${rarityColor} ${
                !badge.earned ? 'opacity-40 grayscale' : ''
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-background/50 flex items-center justify-center mx-auto mb-2">
                <IconComponent className="w-6 h-6 text-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground line-clamp-2">
                {isRTL ? badge.name_ar || badge.name : badge.name}
              </p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {isRTL ? badge.description_ar || badge.description : badge.description}
              </p>
              {!badge.earned && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg">
                  <span className="text-xs text-muted-foreground font-medium">
                    {isRTL ? 'مغلق' : 'Locked'}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center mt-4">
        {isRTL 
          ? 'الإنجازات للتحفيز داخل المنصة فقط'
          : 'Achievements are for in-platform motivation only'}
      </p>
    </div>
  );
};
