import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ExtendedProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  rider_nickname: string | null;
  bike_brand: string | null;
  bike_model: string | null;
  engine_size_cc: number | null;
  riding_experience_years: number | null;
  experience_level: string;
  created_at: string;
  updated_at: string;
}

export interface LearningStats {
  totalCourses: number;
  coursesInProgress: number;
  completedLessons: number;
  totalLearningTimeHours: number;
  overallProgress: number;
  lastLessonTitle: string | null;
  lastLessonTitleAr: string | null;
}

export interface ActivityItem {
  id: string;
  activity_type: string;
  title: string;
  title_ar: string | null;
  description: string | null;
  description_ar: string | null;
  entity_id: string | null;
  entity_type: string | null;
  created_at: string;
}

// Experience level thresholds based on XP and activity
const EXPERIENCE_LEVELS = [
  { level: 'FUTURE RIDER', minXp: 0, minLessons: 0 },
  { level: 'TRAINEE', minXp: 100, minLessons: 5 },
  { level: '1500KM Builder', minXp: 500, minLessons: 15 },
  { level: 'Safe Rider', minXp: 1500, minLessons: 30 },
  { level: 'Champion', minXp: 3000, minLessons: 50 },
  { level: 'Trainer', minXp: 6000, minLessons: 80 },
  { level: 'Master', minXp: 10000, minLessons: 120 },
  { level: 'Legend', minXp: 20000, minLessons: 200 },
];

export function calculateExperienceLevel(totalXp: number, completedLessons: number): string {
  let level = 'FUTURE RIDER';
  for (const threshold of EXPERIENCE_LEVELS) {
    if (totalXp >= threshold.minXp && completedLessons >= threshold.minLessons) {
      level = threshold.level;
    } else {
      break;
    }
  }
  return level;
}

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ExtendedProfile | null>(null);
  const [learningStats, setLearningStats] = useState<LearningStats | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const hasLoadedRef = useRef(false);
  const userIdRef = useRef<string | null>(null);

  const updateProfile = async (updates: Partial<ExtendedProfile>) => {
    if (!user) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, ...updates } : null);
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  const uploadAvatar = async (file: File): Promise<string | null> => {
    if (!user) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      await updateProfile({ avatar_url: publicUrl });

      return publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload avatar');
      return null;
    }
  };

  const loadAllData = async (userId: string) => {
    try {
      // Fetch profile, enrollments, lesson progress, gamification, and activities in parallel
      const [profileRes, enrollmentsRes, progressRes, gamificationRes, activitiesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single(),
        supabase
          .from('course_enrollments')
          .select('id, progress_percentage, completed_at, course_id')
          .eq('user_id', userId),
        supabase
          .from('lesson_progress')
          .select('id, is_completed, watch_time_seconds, lesson_id, completed_at')
          .eq('user_id', userId)
          .order('completed_at', { ascending: false }),
        supabase
          .from('user_gamification')
          .select('total_xp')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('user_activity_timeline')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      // Process profile
      const profileData = profileRes.data as ExtendedProfile | null;
      
      // Process learning stats
      const enrollments = enrollmentsRes.data || [];
      const progress = progressRes.data || [];
      const gamification = gamificationRes.data;

      const totalCourses = enrollments.length;
      const coursesInProgress = enrollments.filter(e => !e.completed_at).length;
      const completedLessons = progress.filter(p => p.is_completed).length;
      const totalWatchTimeSeconds = progress.reduce((acc, p) => acc + (p.watch_time_seconds || 0), 0);
      const totalLearningTimeHours = Math.round((totalWatchTimeSeconds / 3600) * 10) / 10;

      // Calculate overall progress
      const overallProgress = totalCourses > 0
        ? Math.round(enrollments.reduce((acc, e) => acc + e.progress_percentage, 0) / totalCourses)
        : 0;

      // Get last lesson details
      let lastLessonTitle = null;
      let lastLessonTitleAr = null;
      
      const lastProgress = progress.find(p => p.is_completed);
      if (lastProgress) {
        const { data: lessonData } = await supabase
          .from('lessons')
          .select('title, title_ar')
          .eq('id', lastProgress.lesson_id)
          .single();
        
        if (lessonData) {
          lastLessonTitle = lessonData.title;
          lastLessonTitleAr = lessonData.title_ar;
        }
      }

      // Calculate experience level based on XP and lessons
      const totalXp = gamification?.total_xp || 0;
      const newLevel = calculateExperienceLevel(totalXp, completedLessons);
      
      // Update experience level if changed (do this silently, no state flicker)
      let finalProfile = profileData;
      if (profileData && profileData.experience_level !== newLevel) {
        await supabase
          .from('profiles')
          .update({ experience_level: newLevel })
          .eq('user_id', userId);
        
        finalProfile = { ...profileData, experience_level: newLevel };
        
        // Log activity for level change
        await supabase.from('user_activity_timeline').insert({
          user_id: userId,
          activity_type: 'level_change',
          title: `Reached ${newLevel} level`,
          title_ar: `وصل إلى مستوى ${newLevel}`,
        });
      }

      // Set all state at once to prevent multiple re-renders
      setProfile(finalProfile);
      setLearningStats({
        totalCourses,
        coursesInProgress,
        completedLessons,
        totalLearningTimeHours,
        overallProgress,
        lastLessonTitle,
        lastLessonTitleAr,
      });
      setActivities(activitiesRes.data || []);
    } catch (error) {
      console.error('Error loading profile data:', error);
    }
  };

  useEffect(() => {
    // Reset loading state only if user changed
    if (user?.id !== userIdRef.current) {
      hasLoadedRef.current = false;
      userIdRef.current = user?.id || null;
    }

    if (!user) {
      setIsLoading(false);
      return;
    }

    if (hasLoadedRef.current) {
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      await loadAllData(user.id);
      hasLoadedRef.current = true;
      setIsLoading(false);
    };

    loadData();
  }, [user]);

  const refetch = async () => {
    if (!user) return;
    await loadAllData(user.id);
  };

  return {
    profile,
    learningStats,
    activities,
    isLoading,
    isUpdating,
    updateProfile,
    uploadAvatar,
    refetch,
  };
}
