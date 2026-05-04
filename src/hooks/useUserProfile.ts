import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { sendGHLProfileData } from "@/services/ghl.service";
import { fetchEnrollmentsWithLiveProgress } from "@/lib/enrollmentProgress";
export interface ExtendedProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  postal_code: string | null;
  rider_nickname: string | null;
  bike_brand: string | null;
  bike_model: string | null;
  engine_size_cc: number | null;
  riding_experience_years: number | null;
  experience_level: string;
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  km_logged: number;
  motorcycle_vin: string;
  has_license: boolean;
  license_verified: boolean;
  vin_verified: boolean;
  courses_sold_count: number;
  rank_override: boolean;
  created_at: string;
  updated_at: string;
  bike_entries: BikeEntry[] | null;
}

export interface BikeEntry {
  id: string;
  type_id: string | null;
  type_name: string;
  subtype_id: string | null;
  subtype_name: string;
  brand: string;
  model: string;
  is_custom_type: boolean;
  is_custom_brand: boolean;
  photos: string[];
}

export interface EnrolledCourseItem {
  course_id: string;
  title: string;
  title_ar: string | null;
  thumbnail_url: string | null;
  progress_percentage: number;
  completed_at: string | null;
}

export interface AvailableCourseItem {
  id: string;
  title: string;
  title_ar: string | null;
  thumbnail_url: string | null;
  price: number;
  currency: string | null;
  difficulty_level: string;
  discount_percentage: number | null;
}

export interface LearningStats {
  totalCourses: number;
  coursesInProgress: number;
  completedLessons: number;
  totalLearningTimeHours: number;
  overallProgress: number;
  lastLessonTitle: string | null;
  lastLessonTitleAr: string | null;
  completedCourses: EnrolledCourseItem[];
  remainingCourses: EnrolledCourseItem[];
  availableCourses: AvailableCourseItem[];
  enrollments: EnrolledCourseItem[];
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

export type RankName =
  | 'FUTURE RIDER'
  | 'TRAINEE'
  | '1500KM BUILDER'
  | 'SAFE RIDER'
  | 'CHAMPION'
  | 'TRAINER'
  | 'MASTER'
  | 'LEGEND';

/** Per-requirement custom label overrides set by admin. */
export interface ReqLabels {
  first_course_en?: string;   first_course_ar?: string;
  has_license_en?: string;    has_license_ar?: string;
  motorcycle_vin_en?: string; motorcycle_vin_ar?: string;
  km_logged_en?: string;      km_logged_ar?: string;
  core_training_en?: string;  core_training_ar?: string;
  courses_sold_en?: string;   courses_sold_ar?: string;
  programs_sold_en?: string;  programs_sold_ar?: string;
  admin_only_en?: string;     admin_only_ar?: string;
}

/** Freeform requirement added by admin (display-only, not auto-checked). */
export interface CustomRequirement {
  label_en: string;
  label_ar: string;
}

export interface RankRequirement {
  name: RankName;
  name_ar: string;
  description_en: string;
  description_ar: string;
  requirements: {
    hasPurchasedFirstCourse?: boolean;
    hasLicense?: boolean;
    hasMotorcycleVIN?: boolean;
    kmLogged?: number;
    hasCompletedCoreTraining?: boolean;
    coursesSoldCount?: number;
    trainingProgramsSoldCount?: number;
  };
  promotionTrigger_en: string;
  promotionTrigger_ar: string;
  /** Populated when sourced from the DB — rank requires explicit admin action */
  isAdminOnly?: boolean;
  /** Icon name string (e.g. "Trophy") when sourced from DB */
  icon?: string;
  /** Admin-customised labels for each requirement slot. */
  req_labels?: ReqLabels;
  /** Freeform extra requirements added by admin. */
  custom_requirements?: CustomRequirement[];
  /** DB-sourced Tailwind color classes for theming the rank card */
  color?: string;
  bg_color?: string;
  border_color?: string;
}

export const RANK_DEFINITIONS: RankRequirement[] = [
  {
    name: 'FUTURE RIDER',
    name_ar: 'الراكب القادم',
    description_en: 'Interested in riding; no courses started.',
    description_ar: 'مهتم بالركوب، لم يبدأ أي كورس بعد.',
    requirements: {},
    promotionTrigger_en: 'Purchase your first course.',
    promotionTrigger_ar: 'اشترِ أول كورس لك.',
  },
  {
    name: 'TRAINEE',
    name_ar: 'متدرب',
    description_en: 'Completing core courses, Basic Training, and Mentorship.',
    description_ar: 'يكمل الكورسات الأساسية والتدريب.',
    requirements: { hasPurchasedFirstCourse: true },
    promotionTrigger_en: 'Obtain a motorcycle license and provide a motorcycle VIN.',
    promotionTrigger_ar: 'احصل على رخصة دراجة وقدم رقم الهيكل.',
  },
  {
    name: '1500KM BUILDER',
    name_ar: 'بطل 1500 كم',
    description_en: 'Actively logging road hours and riding time.',
    description_ar: 'يسجل ساعات الطريق ووقت الركوب.',
    requirements: {
      hasPurchasedFirstCourse: true,
      hasLicense: true,
      hasMotorcycleVIN: true,
    },
    promotionTrigger_en: 'Reach a total of 1,500 km logged.',
    promotionTrigger_ar: 'سجّل 1500 كم إجمالي.',
  },
  {
    name: 'SAFE RIDER',
    name_ar: 'راكب آمن',
    description_en: 'Fully qualified rider.',
    description_ar: 'راكب مؤهل بالكامل.',
    requirements: {
      hasLicense: true,
      hasMotorcycleVIN: true,
      kmLogged: 1500,
      hasCompletedCoreTraining: true,
    },
    promotionTrigger_en: 'Complete all requirements: license, motorcycle, 1500km, core training.',
    promotionTrigger_ar: 'أكمل كل المتطلبات: رخصة، دراجة، 1500كم، التدريب الأساسي.',
  },
  {
    name: 'CHAMPION',
    name_ar: 'بطل',
    description_en: 'Community leader.',
    description_ar: 'قائد مجتمع.',
    requirements: {
      hasLicense: true,
      hasMotorcycleVIN: true,
      kmLogged: 1500,
      hasCompletedCoreTraining: true,
    },
    promotionTrigger_en: 'Contribute through mentorship, events, or content creation.',
    promotionTrigger_ar: 'أسهم بالإرشاد أو الفعاليات أو إنشاء المحتوى.',
    isAdminOnly: true,
  },
  {
    name: 'TRAINER',
    name_ar: 'مدرب',
    description_en: 'Professional instructor.',
    description_ar: 'مدرب محترف.',
    requirements: {
      hasLicense: true,
      hasMotorcycleVIN: true,
      kmLogged: 1500,
      hasCompletedCoreTraining: true,
    },
    promotionTrigger_en: 'Mastered all previous ranks and demonstrated instructional skill.',
    promotionTrigger_ar: 'أتقن جميع الرتب السابقة وأثبت مهارته التدريبية.',
    isAdminOnly: true,
  },
  {
    name: 'MASTER',
    name_ar: 'محترف',
    description_en: 'Content Creator.',
    description_ar: 'منشئ محتوى.',
    requirements: { coursesSoldCount: 1 },
    promotionTrigger_en: 'Developed and sold 1–3 original courses on the platform.',
    promotionTrigger_ar: 'طوّر وباع 1-3 كورسات أصلية على المنصة.',
  },
  {
    name: 'LEGEND',
    name_ar: 'أسطورة',
    description_en: 'Industry Authority.',
    description_ar: 'مرجع في المجال.',
    requirements: { trainingProgramsSoldCount: 4 },
    promotionTrigger_en: 'Developed and sold 4 or more original training programs.',
    promotionTrigger_ar: 'طوّر وباع 4 برامج تدريبية أصلية أو أكثر.',
  },
];

// ============================================================
// DB-driven rank definitions (rank_definitions table)
// ============================================================

export interface DBRankDefinition {
  id: string;
  name: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  promotion_trigger_en: string;
  promotion_trigger_ar: string;
  icon: string;
  color: string;
  bg_color: string;
  border_color: string;
  sort_order: number;
  is_admin_only: boolean;
  req_first_course: boolean;
  req_has_license: boolean;
  req_motorcycle_vin: boolean;
  req_km_logged: number | null;
  req_core_training: boolean;
  req_courses_sold_min: number | null;
  req_courses_sold_max: number | null;
  req_programs_sold_min: number | null;
  req_labels: ReqLabels;
  custom_requirements: CustomRequirement[];
}

/** Map a DB rank row to the RankRequirement shape used by RankSection. */
export function dbRankToRequirement(r: DBRankDefinition): RankRequirement {
  return {
    name: r.name as RankName,
    name_ar: r.name_ar,
    description_en: r.description_en,
    description_ar: r.description_ar,
    promotionTrigger_en: r.promotion_trigger_en,
    promotionTrigger_ar: r.promotion_trigger_ar,
    isAdminOnly: r.is_admin_only,
    icon: r.icon,
    req_labels: r.req_labels ?? {},
    custom_requirements: r.custom_requirements ?? [],
    color: r.color,
    bg_color: r.bg_color,
    border_color: r.border_color,
    requirements: {
      ...(r.req_first_course    ? { hasPurchasedFirstCourse: true }                        : {}),
      ...(r.req_has_license     ? { hasLicense: true }                                     : {}),
      ...(r.req_motorcycle_vin  ? { hasMotorcycleVIN: true }                               : {}),
      ...(r.req_km_logged       ? { kmLogged: r.req_km_logged }                            : {}),
      ...(r.req_core_training   ? { hasCompletedCoreTraining: true }                       : {}),
      ...(r.req_courses_sold_min ? { coursesSoldCount: r.req_courses_sold_min }            : {}),
      ...(r.req_programs_sold_min ? { trainingProgramsSoldCount: r.req_programs_sold_min } : {}),
    },
  };
}

/**
 * Dynamic rank calculator that reads requirements from DB rank definitions.
 * Iterates ranks from highest to lowest sort_order; returns the first rank
 * whose requirements are all met. Admin-only ranks are skipped (they require
 * explicit admin assignment, never auto-calculated).
 *
 * Falls back to 'FUTURE RIDER' (or lowest non-admin rank) if none match.
 */
export function calculateRankDynamic(
  profile: ExtendedProfile,
  enrollments: any[],
  dbRanks: DBRankDefinition[],
): RankName {
  if (dbRanks.length === 0) return calculateRank(profile, enrollments);

  const hasPurchasedFirstCourse = enrollments.length > 0;
  const hasLicense = !!profile.has_license && !!profile.license_verified;
  const hasMotorcycleVIN = !!profile.motorcycle_vin && !!profile.vin_verified;
  const kmLogged = profile.km_logged || 0;
  const coursesSold = profile.courses_sold_count || 0;

  const sorted = [...dbRanks].sort((a, b) => b.sort_order - a.sort_order);

  for (const rank of sorted) {
    if (rank.is_admin_only) continue;
    if (rank.req_programs_sold_min && coursesSold < rank.req_programs_sold_min) continue;
    if (rank.req_courses_sold_min  && coursesSold < rank.req_courses_sold_min)  continue;
    if (rank.req_first_course      && !hasPurchasedFirstCourse)                  continue;
    if (rank.req_has_license       && !hasLicense)                               continue;
    if (rank.req_motorcycle_vin    && !hasMotorcycleVIN)                         continue;
    if (rank.req_km_logged         && kmLogged < rank.req_km_logged)             continue;
    return rank.name as RankName;
  }

  const lowest = [...dbRanks]
    .filter((r) => !r.is_admin_only)
    .sort((a, b) => a.sort_order - b.sort_order)[0];
  return (lowest?.name as RankName) ?? 'FUTURE RIDER';
}

/** React hook — fetches rank_definitions from DB, always fresh (staleTime: 0). */
export function useRankDefinitions() {
  return useQuery<DBRankDefinition[]>({
    queryKey: ['rank-definitions'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('rank_definitions')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data as DBRankDefinition[]) ?? [];
    },
    staleTime: 0,
  });
}

export function calculateRank(
  profile: ExtendedProfile,
  enrollments: any[],
): RankName {
  const hasPurchasedFirstCourse = enrollments.length > 0;
  const hasLicense = !!profile.has_license && !!profile.license_verified;
  const hasMotorcycleVIN = !!profile.motorcycle_vin && !!profile.vin_verified;
  const kmLogged = profile.km_logged || 0;
  const coursesSold = profile.courses_sold_count || 0;

  if (coursesSold >= 4) return 'LEGEND';
  if (coursesSold >= 1) return 'MASTER';

  if (['TRAINER', 'CHAMPION'].includes(profile.experience_level)) {
    return profile.experience_level as RankName;
  }

  if (hasLicense && hasMotorcycleVIN && kmLogged >= 1500) {
    return 'SAFE RIDER';
  }

  if (hasLicense && hasMotorcycleVIN) {
    return '1500KM BUILDER';
  }

  if (hasPurchasedFirstCourse) return 'TRAINEE';

  return 'FUTURE RIDER';
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
  const lastUpdateSignatureRef = useRef<string | null>(null);

  const updateProfile = async (updates: Partial<ExtendedProfile>) => {
    if (!user) return;

    const currentProfile = profile;
    const changedEntries = Object.entries(updates).filter(([key, value]) => {
      if (!currentProfile) return true;
      return currentProfile[key as keyof ExtendedProfile] !== value;
    });

    if (changedEntries.length === 0) {
      return;
    }

    const changedUpdates = Object.fromEntries(changedEntries) as Partial<ExtendedProfile>;
    const updateSignature = JSON.stringify(changedUpdates);

    if (isUpdating && lastUpdateSignatureRef.current === updateSignature) {
      return;
    }

    setIsUpdating(true);
    lastUpdateSignatureRef.current = updateSignature;
    try {
      const { error } = await (supabase as any).from("profiles").update(changedUpdates).eq("user_id", user.id);

      if (error) throw error;

      setProfile((prev) => (prev ? { ...prev, ...changedUpdates } : null));

      const mergedProfile = { ...profile, ...changedUpdates };

      // Dedicated profile webhook — only the user's personal profile fields.
      // event_type="profile_update" tells the GHL workflow's router to take
      // the full-update path (vs. signup / course_page / guest_signup).
      sendGHLProfileData({
        event_type: "profile_update",
        user_id: user.id,
        email: user.email ?? null,
        full_name: mergedProfile?.full_name ?? null,
        date_of_birth: mergedProfile?.date_of_birth ?? null,
        gender: mergedProfile?.gender ?? null,
        nationality: mergedProfile?.nationality ?? null,
        rider_nickname: mergedProfile?.rider_nickname ?? null,
        phone: mergedProfile?.phone ?? null,
        country: mergedProfile?.country ?? null,
        city: mergedProfile?.city ?? null,
        postal_code: mergedProfile?.postal_code ?? null,
        avatar_url: mergedProfile?.avatar_url ?? null,
      }).catch((err) => {
        console.error("[GHL] Profile-only webhook error:", err);
      });

      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      lastUpdateSignatureRef.current = null;
      setIsUpdating(false);
    }
  };

  const uploadAvatar = async (file: File): Promise<string | null> => {
    if (!user) return null;

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar_${Date.now()}.${fileExt}`;

      // Delete old avatar file from storage
      if (profile?.avatar_url) {
        const oldPath = profile.avatar_url.split("/avatars/")[1]?.split("?")[0];
        if (oldPath) {
          await supabase.storage.from("avatars").remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);

      const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;
      await updateProfile({ avatar_url: cacheBustedUrl });

      return cacheBustedUrl;
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Failed to upload avatar");
      return null;
    }
  };

  const loadAllData = async (userId: string) => {
    try {
      // Fetch profile, enrollments, lesson progress, gamification, and activities in parallel
      const [profileRes, enrollmentsRes, liveProgress, progressRes, gamificationRes, activitiesRes] = await Promise.all(
        [
          supabase.from("profiles").select("*").eq("user_id", userId).single(),
          supabase
            .from("course_enrollments")
            .select(
              "id, progress_percentage, completed_at, course_id, course:courses!course_enrollments_course_id_fkey(title, title_ar, thumbnail_url)",
            )
            .eq("user_id", userId),
          fetchEnrollmentsWithLiveProgress(userId),
          supabase
            .from("lesson_progress")
            .select("id, is_completed, watch_time_seconds, lesson_id, completed_at, last_watched_at")
            .eq("user_id", userId)
            .order("last_watched_at", { ascending: false, nullsFirst: false }),
          supabase.from("user_gamification").select("total_xp").eq("user_id", userId).maybeSingle(),
          supabase
            .from("user_activity_timeline")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(50),
        ],
      );

      // Process profile
      const profileData = profileRes.data as unknown as ExtendedProfile | null;

      // Process learning stats
      const enrollments = enrollmentsRes.data || [];
      const progress = progressRes.data || [];
      const gamification = gamificationRes.data;

      // Build a map of live progress percentages
      const liveProgressMap = new Map(liveProgress.map((lp) => [lp.course_id, lp.progress_percentage]));

      const totalCourses = enrollments.length;
      const coursesInProgress = enrollments.filter((e) => !e.completed_at).length;
      const completedLessons = progress.filter((p) => p.is_completed).length;
      const totalWatchTimeSeconds = progress.reduce((acc, p) => acc + (p.watch_time_seconds || 0), 0);
      const totalLearningTimeHours = Math.round((totalWatchTimeSeconds / 3600) * 10) / 10;

      // Calculate overall progress
      const overallProgress =
        totalCourses > 0
          ? Math.round(enrollments.reduce((acc, e) => acc + e.progress_percentage, 0) / totalCourses)
          : 0;

      // Build course items from enrollments with joined course data
      const courseItems: EnrolledCourseItem[] = enrollments.map((e: any) => {
        const course = Array.isArray(e.course) ? e.course[0] : e.course;
        const realProgress = liveProgressMap.get(e.course_id) ?? e.progress_percentage;
        return {
          course_id: e.course_id,
          title: course?.title || "",
          title_ar: course?.title_ar || null,
          thumbnail_url: course?.thumbnail_url || null,
          progress_percentage: realProgress,
          completed_at: e.completed_at,
        };
      });

      const completedCourses = courseItems.filter((c) => c.completed_at || c.progress_percentage >= 100);
      const remainingCourses = courseItems.filter((c) => !c.completed_at && c.progress_percentage < 100);

      // Fetch all published courses the user hasn't enrolled in
      const enrolledCourseIds = enrollments.map((e: any) => e.course_id);
      let availableCourses: AvailableCourseItem[] = [];

      const availableQuery = supabase
        .from("courses")
        .select("id, title, title_ar, thumbnail_url, price, currency, difficulty_level, discount_percentage")
        .eq("is_published", true);

      if (enrolledCourseIds.length > 0) {
        // Filter out enrolled courses - need to use not.in
        const { data: allCourses } = await availableQuery;
        availableCourses = (allCourses || []).filter((c) => !enrolledCourseIds.includes(c.id)) as AvailableCourseItem[];
      } else {
        const { data: allCourses } = await availableQuery;
        availableCourses = (allCourses || []) as AvailableCourseItem[];
      }

      // Get last lesson details (most recently watched, already sorted by last_watched_at desc)
      let lastLessonTitle = null;
      let lastLessonTitleAr = null;

      const lastProgress = progress[0];
      if (lastProgress) {
        const { data: lessonData } = await supabase
          .from("lessons")
          .select("title, title_ar")
          .eq("id", lastProgress.lesson_id)
          .single();

        if (lessonData) {
          lastLessonTitle = lessonData.title;
          lastLessonTitleAr = lessonData.title_ar;
        }
      }

      // Rank recalculation — only when no manual admin override is set.
      // If rank_override = true the admin-assigned rank is used as-is;
      // no calculateRank call, no DB write, no activity entry.
      let finalProfile = profileData;

      if (profileData && !profileData.rank_override) {
        // Fetch DB rank definitions so admin-edited requirements are respected.
        const { data: dbRankData } = await (supabase as any)
          .from('rank_definitions')
          .select('*')
          .order('sort_order', { ascending: true });
        const dbRanks = (dbRankData as DBRankDefinition[] | null) ?? [];

        const newLevel = dbRanks.length > 0
          ? calculateRankDynamic(profileData, enrollments, dbRanks)
          : calculateRank(profileData, enrollments);

        if (profileData.experience_level !== newLevel) {
          await supabase.from("profiles").update({ experience_level: newLevel }).eq("user_id", userId);

          finalProfile = { ...profileData, experience_level: newLevel };

          await supabase.from("user_activity_timeline").insert({
            user_id: userId,
            activity_type: "level_change",
            title: `Reached ${newLevel} level`,
            title_ar: `وصل إلى مستوى ${newLevel}`,
          });
        }
      }

      setProfile(finalProfile ?? profileData);
      setLearningStats({
        totalCourses,
        coursesInProgress,
        completedLessons,
        totalLearningTimeHours,
        overallProgress,
        lastLessonTitle,
        lastLessonTitleAr,
        completedCourses,
        remainingCourses,
        availableCourses,
        enrollments: courseItems,
      });
      setActivities(activitiesRes.data || []);
    } catch (error) {
      console.error("Error loading profile data:", error);
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

  // Realtime: pick up external profile changes (e.g. admin updates rank).
  useEffect(() => {
    if (!user) return;

    const userId = user.id;
    const channel = supabase
      .channel(`profile-rank-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const oldRow = (payload.old ?? {}) as Partial<ExtendedProfile>;
          const newRow = (payload.new ?? {}) as Partial<ExtendedProfile>;
          if (
            oldRow.experience_level !== newRow.experience_level ||
            oldRow.rank_override !== newRow.rank_override
          ) {
            hasLoadedRef.current = false;
            loadAllData(userId).then(() => {
              hasLoadedRef.current = true;
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Always refetch when the tab regains focus so the user sees the latest rank.
  useEffect(() => {
    if (!user) return;

    const userId = user.id;
    const refetchIfVisible = () => {
      if (document.visibilityState === "visible") {
        loadAllData(userId);
      }
    };

    window.addEventListener("focus", refetchIfVisible);
    document.addEventListener("visibilitychange", refetchIfVisible);

    return () => {
      window.removeEventListener("focus", refetchIfVisible);
      document.removeEventListener("visibilitychange", refetchIfVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
