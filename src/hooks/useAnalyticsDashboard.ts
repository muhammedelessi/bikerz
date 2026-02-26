import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, subHours, format, startOfDay, startOfWeek, startOfMonth, differenceInDays } from 'date-fns';

// Helper to fetch ALL rows from a table, bypassing the 1000-row default limit
async function fetchAllRows(
  tableName: string,
  selectColumns: string,
  filters?: (query: any) => any
): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = supabase.from(tableName as any).select(selectColumns).range(from, to);
    if (filters) query = filters(query);
    const { data, error } = await query;
    if (error) {
      console.error('Pagination fetch error:', error.message);
      break;
    }
    allData = allData.concat(data || []);
    hasMore = (data?.length || 0) === PAGE_SIZE;
    page++;
  }

  return allData;
}

// Helper for count-only queries (no row limit issue)
async function fetchCount(
  tableName: string,
  filters?: (query: any) => any
): Promise<number> {
  let query = supabase.from(tableName as any).select('id', { count: 'exact', head: true });
  if (filters) query = filters(query);
  const { count, error } = await query;
  if (error) {
    console.error('Count fetch error:', error.message);
    return 0;
  }
  return count || 0;
}

export interface DateRange {
  label: string;
  days: number;
}

export const DATE_RANGES: Record<string, DateRange> = {
  '24h': { label: 'Last 24 hours', days: 1 },
  '7d': { label: 'Last 7 days', days: 7 },
  '30d': { label: 'Last 30 days', days: 30 },
  '90d': { label: 'Last 90 days', days: 90 },
  '1y': { label: 'Last year', days: 365 },
  'all': { label: 'All time', days: 9999 },
};

const SUCCESS_TAP_STATUS = new Set(['captured', 'approved', 'processing']);

const getSinceDate = (dateRange: string) => {
  const days = DATE_RANGES[dateRange]?.days ?? 30;
  return subDays(new Date(), days);
};

const isSuccessfulTapStatus = (status?: string | null) =>
  SUCCESS_TAP_STATUS.has((status || '').toLowerCase());

// Global System Overview
export function useSystemOverview(dateRange: string = '30d') {
  return useQuery({
    queryKey: ['analytics-system-overview', dateRange],
    queryFn: async () => {
      const now = new Date();
      const last24h = subHours(now, 24);
      const last7d = subDays(now, 7);
      const last30d = subDays(now, 30);
      const since = getSinceDate(dateRange);

      const [
        totalUsers,
        users24h,
        users7d,
        users30d,
        totalEnrollments,
        totalLessons,
        lessonProgress,
        manualPayments,
        tapPayments,
        concurrentUsers,
        watchingNow,
      ] = await Promise.all([
        fetchCount('profiles'),
        fetchCount('profiles', (q: any) => q.gte('created_at', last24h.toISOString())),
        fetchCount('profiles', (q: any) => q.gte('created_at', last7d.toISOString())),
        fetchCount('profiles', (q: any) => q.gte('created_at', last30d.toISOString())),
        fetchCount('course_enrollments'),
        fetchCount('lessons'),
        fetchAllRows('lesson_progress', 'id, watch_time_seconds', (q: any) =>
          q.eq('is_completed', true).gte('last_watched_at', since.toISOString())
        ),
        fetchAllRows('manual_payments', 'amount, created_at, status'),
        fetchAllRows('tap_charges', 'amount, created_at, status'),
        fetchCount('realtime_presence', (q: any) => q.gte('last_heartbeat_at', subDays(now, 0.01).toISOString())),
        fetchCount('realtime_presence', (q: any) => q.eq('is_watching_video', true)),
      ]);

      const successfulManual = manualPayments.filter((p) => (p.status || '').toLowerCase() === 'approved');
      const successfulTap = tapPayments.filter((p) => isSuccessfulTapStatus(p.status));
      const allSuccessfulPayments = [...successfulManual, ...successfulTap];

      const totalWatchTimeSeconds = lessonProgress.reduce((sum: number, p: any) => sum + (p.watch_time_seconds || 0), 0);
      const totalRevenue = allSuccessfulPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

      const todayStart = startOfDay(now);
      const weekStart = startOfWeek(now);
      const monthStart = startOfMonth(now);

      const revenueToday = allSuccessfulPayments
        .filter((p) => p.created_at && new Date(p.created_at) >= todayStart)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const revenueWeek = allSuccessfulPayments
        .filter((p) => p.created_at && new Date(p.created_at) >= weekStart)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const revenueMonth = allSuccessfulPayments
        .filter((p) => p.created_at && new Date(p.created_at) >= monthStart)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      const activeUsers = users30d || 1;
      const rpau = revenueMonth / activeUsers;

      return {
        totalUsers,
        users24h,
        users7d,
        users30d,
        concurrentUsers,
        videosWatchingNow: watchingNow,
        totalWatchTimeMinutes: Math.round(totalWatchTimeSeconds / 60),
        totalWatchTimeHours: Math.round(totalWatchTimeSeconds / 3600),
        totalLessonsCompleted: lessonProgress.length,
        revenueToday,
        revenueWeek,
        revenueMonth,
        revenueLifetime: totalRevenue,
        rpau: Math.round(rpau * 100) / 100,
        totalEnrollments,
        totalLessons,
      };
    },
    refetchInterval: 10000,
  });
}

// User Intelligence
export function useUserIntelligence(dateRange: string) {
  return useQuery({
    queryKey: ['analytics-user-intelligence', dateRange],
    queryFn: async () => {
      const days = DATE_RANGES[dateRange]?.days || 30;
      const since = subDays(new Date(), days);

      const [
        profiles,
        gamification,
        xp,
        sessions,
        engagement,
      ] = await Promise.all([
        fetchAllRows('profiles', 'id, user_id, created_at, experience_level', (q: any) => q.gte('created_at', since.toISOString())),
        fetchAllRows('user_gamification', 'user_id, total_xp, level, current_streak, longest_streak, last_activity_date'),
        fetchAllRows('xp_transactions', 'user_id, amount, source_type, created_at', (q: any) => q.gte('created_at', since.toISOString())),
        fetchAllRows('user_sessions', 'user_id, device_type, duration_seconds, started_at', (q: any) => q.gte('started_at', since.toISOString())),
        fetchAllRows('user_engagement_scores', 'user_id, engagement_score, churn_risk_score, score_date', (q: any) => q.gte('score_date', format(since, 'yyyy-MM-dd'))),
      ]);

      // Group sessions by device
      const sessionsByDevice = sessions.reduce((acc: Record<string, number[]>, s: any) => {
        const device = s.device_type || 'unknown';
        if (!acc[device]) acc[device] = [];
        if (s.duration_seconds) acc[device].push(s.duration_seconds);
        return acc;
      }, {});

      const avgSessionByDevice = Object.entries(sessionsByDevice).map(([device, durations]) => ({
        device,
        avgDuration: Math.round((durations as number[]).reduce((a, b) => a + b, 0) / (durations as number[]).length / 60),
        count: (durations as number[]).length,
      }));

      // Experience level distribution
      const expLevelDist = profiles.reduce((acc: Record<string, number>, p: any) => {
        const level = p.experience_level || 'FUTURE RIDER';
        acc[level] = (acc[level] || 0) + 1;
        return acc;
      }, {});

      // Engagement score distribution
      const scores = engagement.map((e: any) => e.engagement_score).filter((s: any) => s != null).sort((a: number, b: number) => a - b);
      const getPercentile = (arr: number[], p: number) => {
        if (arr.length === 0) return 0;
        const idx = Math.ceil(arr.length * p / 100) - 1;
        return arr[Math.max(0, idx)];
      };

      return {
        newUsers: profiles.length,
        experienceLevelDistribution: expLevelDist,
        avgSessionByDevice,
        totalSessions: sessions.length,
        engagementScores: {
          p25: getPercentile(scores, 25),
          p50: getPercentile(scores, 50),
          p75: getPercentile(scores, 75),
          p90: getPercentile(scores, 90),
          avg: scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0,
        },
        churnRiskUsers: engagement.filter((e: any) => e.churn_risk_score > 70).length,
        activeStreaks: gamification.filter((g: any) => g.current_streak > 0).length,
      };
    },
    refetchInterval: 15000,
  });
}

// Video & Lesson Micro-Analytics
export function useVideoAnalytics(dateRange: string, lessonId?: string) {
  return useQuery({
    queryKey: ['analytics-video', dateRange, lessonId],
    queryFn: async () => {
      const days = DATE_RANGES[dateRange]?.days || 30;
      const since = subDays(new Date(), days);

      const [watchSessions, events, lessons] = await Promise.all([
        fetchAllRows('video_watch_sessions',
          'lesson_id, total_watch_time_seconds, completion_percentage, completed, pause_count, rewind_count, seek_count, total_buffering_time_ms, buffering_events',
          (q: any) => {
            q = q.gte('started_at', since.toISOString());
            if (lessonId) q = q.eq('lesson_id', lessonId);
            return q;
          }
        ),
        fetchAllRows('video_playback_events',
          'lesson_id, event_type, video_position_seconds, buffering_duration_ms',
          (q: any) => {
            q = q.gte('created_at', since.toISOString());
            if (lessonId) q = q.eq('lesson_id', lessonId);
            return q;
          }
        ),
        fetchAllRows('lessons', 'id, title, title_ar, duration_minutes, chapter_id'),
      ]);

      // Calculate per-lesson metrics
      const lessonMetrics = lessons.map((lesson: any) => {
        const lessonSessions = watchSessions.filter((w: any) => w.lesson_id === lesson.id);
        const lessonEvents = events.filter((e: any) => e.lesson_id === lesson.id);

        const completions = lessonSessions.filter((s: any) => s.completed).length;
        const totalViews = lessonSessions.length;
        const avgCompletion = lessonSessions.length
          ? lessonSessions.reduce((sum: number, s: any) => sum + (s.completion_percentage || 0), 0) / lessonSessions.length
          : 0;

        const dropOffEvents = lessonEvents.filter((e: any) => e.event_type === 'ended' || e.event_type === 'pause');
        const dropOffPositions = dropOffEvents.map((e: any) => e.video_position_seconds || 0);
        const medianDropOff = dropOffPositions.length
          ? dropOffPositions.sort((a: number, b: number) => a - b)[Math.floor(dropOffPositions.length / 2)]
          : 0;

        const bufferingEvents = lessonEvents.filter((e: any) => e.event_type === 'buffering');
        const avgBufferingPerViewer = totalViews > 0 ? bufferingEvents.length / totalViews : 0;

        const pauseCount = lessonSessions.reduce((sum: number, s: any) => sum + (s.pause_count || 0), 0);
        const rewindCount = lessonSessions.reduce((sum: number, s: any) => sum + (s.rewind_count || 0), 0);

        return {
          id: lesson.id,
          title: lesson.title,
          title_ar: lesson.title_ar,
          duration: lesson.duration_minutes,
          totalViews,
          completions,
          completionRate: totalViews > 0 ? Math.round((completions / totalViews) * 100) : 0,
          avgWatchPercentage: Math.round(avgCompletion),
          medianDropOffSecond: Math.round(medianDropOff),
          bufferingEventsPerViewer: Math.round(avgBufferingPerViewer * 100) / 100,
          pauseCount,
          rewindCount,
        };
      });

      const bestPerforming = [...lessonMetrics].sort((a, b) => b.completionRate - a.completionRate).slice(0, 5);
      const worstPerforming = [...lessonMetrics].sort((a, b) => a.completionRate - b.completionRate).slice(0, 5);
      const mostRewatched = [...lessonMetrics].sort((a, b) => b.rewindCount - a.rewindCount).slice(0, 5);

      const totalWatchTime = watchSessions.reduce((sum: number, s: any) => sum + (s.total_watch_time_seconds || 0), 0);
      const totalBufferingTime = watchSessions.reduce((sum: number, s: any) => sum + (s.total_buffering_time_ms || 0), 0);

      return {
        lessonMetrics,
        bestPerforming,
        worstPerforming,
        mostRewatched,
        totalWatchTimeMins: Math.round(totalWatchTime / 60),
        totalBufferingTimeSecs: Math.round(totalBufferingTime / 1000),
        avgCompletionRate: lessonMetrics.length
          ? Math.round(lessonMetrics.reduce((sum: number, l: any) => sum + l.completionRate, 0) / lessonMetrics.length)
          : 0,
      };
    },
    refetchInterval: 15000,
  });
}

// Course-Level Psychology
export function useCourseAnalytics(dateRange: string) {
  return useQuery({
    queryKey: ['analytics-courses', dateRange],
    queryFn: async () => {
      const since = getSinceDate(dateRange);

      const [courses, chapters, lessons, enrollments, progress] = await Promise.all([
        fetchAllRows('courses', 'id, title, title_ar, is_published'),
        fetchAllRows('chapters', 'id, course_id, title, position'),
        fetchAllRows('lessons', 'id, chapter_id, title, position'),
        fetchAllRows('course_enrollments', 'id, user_id, course_id, enrolled_at, completed_at', (q: any) => q.gte('enrolled_at', since.toISOString())),
        fetchAllRows('lesson_progress', 'user_id, lesson_id, is_completed, last_watched_at', (q: any) => q.gte('last_watched_at', since.toISOString())),
      ]);

      const courseAnalytics = courses.map((course: any) => {
        const courseChapters = chapters.filter((ch: any) => ch.course_id === course.id);
        const courseChapterIds = courseChapters.map((ch: any) => ch.id);
        const courseLessons = lessons.filter((l: any) => courseChapterIds.includes(l.chapter_id));
        const courseLessonIds = courseLessons.map((l: any) => l.id);

        const courseEnrollments = enrollments.filter((e: any) => e.course_id === course.id);
        const completedEnrollments = courseEnrollments.filter((e: any) => e.completed_at);

        const lessonCompletionCounts = courseLessons.map((lesson: any) => {
          const completions = progress.filter((p: any) => p.lesson_id === lesson.id && p.is_completed).length;
          return { lessonId: lesson.id, position: lesson.position, completions };
        }).sort((a: any, b: any) => a.position - b.position);

        const leakageRates = lessonCompletionCounts.slice(1).map((current: any, idx: number) => {
          const prev = lessonCompletionCounts[idx];
          if (prev.completions === 0) return 0;
          return Math.round(((prev.completions - current.completions) / prev.completions) * 100);
        });

        const firstLessonCompletions = lessonCompletionCounts[0]?.completions || 0;
        const secondLessonCompletions = lessonCompletionCounts[1]?.completions || 0;
        const neverStartLesson2Pct = firstLessonCompletions > 0
          ? Math.round(((firstLessonCompletions - secondLessonCompletions) / firstLessonCompletions) * 100)
          : 0;

        const userFirstDropoffs = courseEnrollments.map((e: any) => {
          const userProgress = progress.filter((p: any) => p.user_id === e.user_id && courseLessonIds.includes(p.lesson_id));
          const completedLessons = userProgress.filter((p: any) => p.is_completed).length;
          if (completedLessons === courseLessons.length) return null;
          const enrollDate = new Date(e.enrolled_at);
          const lastProgress = userProgress.sort((a: any, b: any) =>
            new Date(b.last_watched_at || 0).getTime() - new Date(a.last_watched_at || 0).getTime()
          )[0];
          if (!lastProgress?.last_watched_at) return null;
          return differenceInDays(new Date(lastProgress.last_watched_at), enrollDate);
        }).filter((d: any) => d !== null) as number[];

        const avgTimeToDropoff = userFirstDropoffs.length
          ? Math.round(userFirstDropoffs.reduce((a, b) => a + b, 0) / userFirstDropoffs.length)
          : 0;

        return {
          id: course.id,
          title: course.title,
          title_ar: course.title_ar,
          isPublished: course.is_published,
          totalEnrollments: courseEnrollments.length,
          completedEnrollments: completedEnrollments.length,
          completionRate: courseEnrollments.length > 0
            ? Math.round((completedEnrollments.length / courseEnrollments.length) * 100)
            : 0,
          neverStartLesson2Pct,
          avgTimeToDropoffDays: avgTimeToDropoff,
          avgLeakageRate: leakageRates.length
            ? Math.round(leakageRates.reduce((a: number, b: number) => a + b, 0) / leakageRates.length)
            : 0,
          totalChapters: courseChapters.length,
          totalLessons: courseLessons.length,
        };
      });

      return {
        courses: courseAnalytics,
        totalCourses: courses.length,
        publishedCourses: courses.filter((c: any) => c.is_published).length,
        avgCompletionRate: courseAnalytics.length
          ? Math.round(courseAnalytics.reduce((sum: number, c: any) => sum + c.completionRate, 0) / courseAnalytics.length)
          : 0,
      };
    },
    refetchInterval: 15000,
  });
}

// Funnel & Conversion Intelligence
export function useFunnelAnalytics(dateRange: string) {
  return useQuery({
    queryKey: ['analytics-funnel', dateRange],
    queryFn: async () => {
      const since = getSinceDate(dateRange);

      const [profiles, enrollments, manualPayments, tapPayments, progress] = await Promise.all([
        fetchAllRows('profiles', 'user_id, created_at', (q: any) => q.gte('created_at', since.toISOString())),
        fetchAllRows('course_enrollments', 'id, user_id, enrolled_at', (q: any) => q.gte('enrolled_at', since.toISOString())),
        fetchAllRows('manual_payments', 'user_id, amount, status, created_at', (q: any) => q.gte('created_at', since.toISOString())),
        fetchAllRows('tap_charges', 'user_id, amount, status, created_at', (q: any) => q.gte('created_at', since.toISOString())),
        fetchAllRows('lesson_progress', 'user_id, lesson_id, is_completed, last_watched_at', (q: any) => q.gte('last_watched_at', since.toISOString())),
      ]);

      const signupUserIds = new Set(profiles.map((p: any) => p.user_id));
      const cohortProgress = progress.filter((p: any) => signupUserIds.has(p.user_id) && p.is_completed);
      const firstLessonUsers = new Set(cohortProgress.map((p: any) => p.user_id)).size;

      const lessonCountByUser = cohortProgress.reduce((acc: Record<string, number>, p: any) => {
        acc[p.user_id] = (acc[p.user_id] || 0) + 1;
        return acc;
      }, {});
      const secondLessonUsers = Object.values(lessonCountByUser).filter((c) => (c as number) >= 2).length;

      const successfulManual = manualPayments.filter((p: any) => (p.status || '').toLowerCase() === 'approved');
      const successfulTap = tapPayments.filter((p: any) => isSuccessfulTapStatus(p.status));
      const paidUsers = new Set([...successfulManual, ...successfulTap]
        .filter((p) => signupUserIds.has(p.user_id))
        .map((p) => p.user_id)).size;

      const activeUsers = new Set(
        progress.filter((p: any) => {
          const lastWatched = p.last_watched_at ? new Date(p.last_watched_at) : null;
          return lastWatched && lastWatched >= subDays(new Date(), 7) && signupUserIds.has(p.user_id);
        }).map((p: any) => p.user_id)
      ).size;

      const signups = profiles.length;

      const funnelSteps = [
        { step: 'Signups', count: signups, rate: 100 },
        { step: 'First Lesson', count: firstLessonUsers, rate: signups > 0 ? Math.round((firstLessonUsers / signups) * 100) : 0 },
        { step: 'Second Lesson', count: secondLessonUsers, rate: signups > 0 ? Math.round((secondLessonUsers / signups) * 100) : 0 },
        { step: 'Paid', count: paidUsers, rate: signups > 0 ? Math.round((paidUsers / signups) * 100) : 0 },
        { step: 'Active (7d)', count: activeUsers, rate: signups > 0 ? Math.round((activeUsers / signups) * 100) : 0 },
      ];

      const dropRates = funnelSteps.slice(1).map((step, idx) => ({
        from: funnelSteps[idx].step,
        to: step.step,
        dropRate: funnelSteps[idx].count > 0
          ? Math.max(0, Math.round(((funnelSteps[idx].count - step.count) / funnelSteps[idx].count) * 100))
          : 0,
      }));

      return {
        funnelSteps,
        dropRates,
        conversionRate: signups > 0 ? Math.round((paidUsers / signups) * 100) : 0,
        activationRate: signups > 0 ? Math.round((firstLessonUsers / signups) * 100) : 0,
      };
    },
    refetchInterval: 15000,
  });
}

// Revenue Analytics
export function useRevenueAnalytics(dateRange: string) {
  return useQuery({
    queryKey: ['analytics-revenue', dateRange],
    queryFn: async () => {
      const since = getSinceDate(dateRange);

      const [manualPaymentsRaw, tapPaymentsRaw, courses, profiles] = await Promise.all([
        fetchAllRows('manual_payments', 'id, user_id, course_id, amount, status, created_at'),
        fetchAllRows('tap_charges', 'id, user_id, course_id, amount, status, created_at'),
        fetchAllRows('courses', 'id, title, title_ar, price'),
        fetchAllRows('profiles', 'user_id, created_at'),
      ]);

      const windowUsers = profiles.filter((p: any) => new Date(p.created_at) >= since);

      const manualPayments = manualPaymentsRaw.map((p: any) => ({
        ...p,
        source: 'manual' as const,
        statusNormalized: (p.status || '').toLowerCase(),
      }));
      const tapPayments = tapPaymentsRaw.map((p: any) => ({
        ...p,
        source: 'tap' as const,
        statusNormalized: (p.status || '').toLowerCase(),
      }));

      const allPayments = [...manualPayments, ...tapPayments];
      const successfulPayments = allPayments.filter((p) => {
        if (p.source === 'manual') return p.statusNormalized === 'approved';
        return isSuccessfulTapStatus(p.status);
      });

      const windowSuccessfulPayments = successfulPayments.filter((p) =>
        p.created_at ? new Date(p.created_at) >= since : false
      );

      // Revenue by course (window)
      const revenueByCourse = courses.map((course: any) => {
        const coursePayments = windowSuccessfulPayments.filter((p) => p.course_id === course.id);
        const totalRevenue = coursePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        return {
          id: course.id,
          title: course.title,
          title_ar: course.title_ar,
          price: course.price,
          revenue: totalRevenue,
          transactions: coursePayments.length,
        };
      }).sort((a, b) => b.revenue - a.revenue);

      // Monthly revenue trend (lifetime)
      const monthlyRevenue: Record<string, number> = {};
      successfulPayments.forEach((p) => {
        if (!p.created_at) return;
        const month = format(new Date(p.created_at), 'yyyy-MM');
        monthlyRevenue[month] = (monthlyRevenue[month] || 0) + Number(p.amount || 0);
      });

      const monthlyTrend = Object.entries(monthlyRevenue)
        .map(([month, revenue]) => ({ month, revenue }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12);

      const recentMonths = monthlyTrend.slice(-3);
      const velocity = recentMonths.length >= 2
        ? (recentMonths[recentMonths.length - 1]?.revenue || 0) - (recentMonths[0]?.revenue || 0)
        : 0;

      // ARPU / ARPPU (window)
      const totalRevenue = windowSuccessfulPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const totalUsers = windowUsers.length;
      const payingUsers = new Set(windowSuccessfulPayments.map((p) => p.user_id)).size;

      const arpu = totalUsers > 0 ? totalRevenue / totalUsers : 0;
      const arppu = payingUsers > 0 ? totalRevenue / payingUsers : 0;

      // LTV by cohort
      const cohortRevenue: Record<string, { users: number; revenue: number }> = {};
      profiles.forEach((profile: any) => {
        const cohort = format(new Date(profile.created_at), 'yyyy-MM');
        if (!cohortRevenue[cohort]) cohortRevenue[cohort] = { users: 0, revenue: 0 };
        cohortRevenue[cohort].users++;

        const userPayments = successfulPayments.filter((p) => p.user_id === profile.user_id);
        const userRevenue = userPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        cohortRevenue[cohort].revenue += userRevenue;
      });

      const cohortLTV = Object.entries(cohortRevenue).map(([cohort, data]) => ({
        cohort,
        ltv: data.users > 0 ? Math.round(data.revenue / data.users) : 0,
        users: data.users,
      })).sort((a, b) => a.cohort.localeCompare(b.cohort));

      const refunds = allPayments.filter((p) => p.statusNormalized.includes('refund')).length;
      const disputes = allPayments.filter((p) =>
        p.statusNormalized.includes('dispute') || p.statusNormalized.includes('chargeback')
      ).length;

      return {
        totalRevenue,
        revenueByCourse,
        monthlyTrend,
        velocity,
        velocityDirection: velocity > 0 ? 'up' : velocity < 0 ? 'down' : 'flat',
        arpu: Math.round(arpu),
        arppu: Math.round(arppu),
        cohortLTV,
        refunds,
        disputes,
        payingUsers,
      };
    },
    refetchInterval: 15000,
  });
}

// Retention & Churn
export function useRetentionAnalytics(dateRange: string) {
  return useQuery({
    queryKey: ['analytics-retention', dateRange],
    queryFn: async () => {
      const since = getSinceDate(dateRange);

      const [engagement, gamification, progress, profiles] = await Promise.all([
        fetchAllRows('user_engagement_scores', 'user_id, engagement_score, churn_risk_score, score_date', (q: any) => q.gte('score_date', format(since, 'yyyy-MM-dd')).order('score_date', { ascending: false })),
        fetchAllRows('user_gamification', 'user_id, current_streak, longest_streak'),
        fetchAllRows('lesson_progress', 'user_id, lesson_id, is_completed, last_watched_at', (q: any) => q.gte('last_watched_at', since.toISOString())),
        fetchAllRows('profiles', 'user_id, created_at', (q: any) => q.gte('created_at', since.toISOString())),
      ]);

      // Latest engagement per user
      const latestEngagement = engagement.reduce((acc: Record<string, any>, e: any) => {
        if (!acc[e.user_id] || e.score_date > acc[e.user_id].score_date) {
          acc[e.user_id] = e;
        }
        return acc;
      }, {});

      const atRiskUsers = Object.values(latestEngagement)
        .filter((e: any) => e.churn_risk_score > 60)
        .sort((a: any, b: any) => b.churn_risk_score - a.churn_risk_score)
        .slice(0, 20);

      // Last activity by user
      const lastActivityByUser = progress.reduce((acc: Record<string, Date>, p: any) => {
        if (p.last_watched_at) {
          const lastWatched = new Date(p.last_watched_at);
          if (!acc[p.user_id] || lastWatched > acc[p.user_id]) {
            acc[p.user_id] = lastWatched;
          }
        }
        return acc;
      }, {});

      const now = new Date();
      const inactiveWindows = [
        { label: '1-7 days', min: 1, max: 7, count: 0 },
        { label: '8-14 days', min: 8, max: 14, count: 0 },
        { label: '15-30 days', min: 15, max: 30, count: 0 },
        { label: '30+ days', min: 30, max: 9999, count: 0 },
      ];

      (Object.values(lastActivityByUser) as Date[]).forEach((lastActivity) => {
        const daysInactive = differenceInDays(now, lastActivity);
        const window = inactiveWindows.find(w => daysInactive >= w.min && daysInactive <= w.max);
        if (window) window.count++;
      });

      const streakDistribution = [
        { label: '0 days', count: gamification.filter((g: any) => g.current_streak === 0).length },
        { label: '1-3 days', count: gamification.filter((g: any) => g.current_streak >= 1 && g.current_streak <= 3).length },
        { label: '4-7 days', count: gamification.filter((g: any) => g.current_streak >= 4 && g.current_streak <= 7).length },
        { label: '8-14 days', count: gamification.filter((g: any) => g.current_streak >= 8 && g.current_streak <= 14).length },
        { label: '15+ days', count: gamification.filter((g: any) => g.current_streak >= 15).length },
      ];

      const predictedChurn = Object.entries(lastActivityByUser)
        .filter(([userId, lastActivity]) => {
          const daysInactive = differenceInDays(now, lastActivity as Date);
          const userEngagement = latestEngagement[userId];
          return daysInactive > 14 && (!userEngagement || userEngagement.engagement_score < 30);
        }).length;

      return {
        atRiskUsers: atRiskUsers.map((u: any) => ({
          userId: u.user_id,
          churnRisk: u.churn_risk_score,
          engagementScore: u.engagement_score,
          lastActivity: lastActivityByUser[u.user_id],
        })),
        inactiveWindows,
        streakDistribution,
        predictedChurnCount: predictedChurn,
        totalTrackedUsers: profiles.length,
        activeUsersLast7Days: Object.entries(lastActivityByUser)
          .filter(([_, date]) => differenceInDays(now, date as Date) <= 7).length,
      };
    },
    refetchInterval: 15000,
  });
}

// Infrastructure Metrics
export function useInfrastructureMetrics(dateRange: string) {
  return useQuery({
    queryKey: ['analytics-infrastructure', dateRange],
    queryFn: async () => {
      const days = DATE_RANGES[dateRange]?.days || 30;
      const since = subDays(new Date(), days);

      const [metrics, watchSessions, errorEvents] = await Promise.all([
        fetchAllRows('infrastructure_metrics', 'metric_type, value, percentile, region, sample_count, recorded_at', (q: any) => q.gte('recorded_at', since.toISOString())),
        fetchAllRows('video_watch_sessions', 'total_buffering_time_ms, buffering_events, total_watch_time_seconds', (q: any) => q.gte('started_at', since.toISOString())),
        fetchAllRows('video_playback_events', 'event_type, buffering_duration_ms', (q: any) => q.eq('event_type', 'error').gte('created_at', since.toISOString())),
      ]);

      const totalWatchTime = watchSessions.reduce((sum: number, s: any) => sum + (s.total_watch_time_seconds || 0), 0);
      const totalBufferingTime = watchSessions.reduce((sum: number, s: any) => sum + ((s.total_buffering_time_ms || 0) / 1000), 0);
      const bufferingRatio = totalWatchTime > 0 ? (totalBufferingTime / totalWatchTime) * 100 : 0;

      const totalEvents = watchSessions.length;
      const errorRate = totalEvents > 0 ? (errorEvents.length / totalEvents) * 100 : 0;

      const metricsByType = metrics.reduce((acc: Record<string, any[]>, m: any) => {
        if (!acc[m.metric_type]) acc[m.metric_type] = [];
        acc[m.metric_type].push(m);
        return acc;
      }, {});

      return {
        bufferingRatio: Math.round(bufferingRatio * 100) / 100,
        errorRate: Math.round(errorRate * 100) / 100,
        totalErrors: errorEvents.length,
        metricsByType,
        videoStartTimeP95: metricsByType['video_start_time']?.find((m: any) => m.percentile === 'p95')?.value || 0,
        videoStartTimeP99: metricsByType['video_start_time']?.find((m: any) => m.percentile === 'p99')?.value || 0,
        avgBufferingPerSession: watchSessions.length > 0
          ? Math.round(watchSessions.reduce((sum: number, s: any) => sum + (s.buffering_events || 0), 0) / watchSessions.length * 100) / 100
          : 0,
      };
    },
    refetchInterval: 15000,
  });
}
