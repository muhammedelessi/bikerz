import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, subHours, format, startOfDay, startOfWeek, startOfMonth, differenceInDays } from 'date-fns';

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

// Global System Overview
export function useSystemOverview() {
  return useQuery({
    queryKey: ['analytics-system-overview'],
    queryFn: async () => {
      const now = new Date();
      const last24h = subHours(now, 24);
      const last7d = subDays(now, 7);
      const last30d = subDays(now, 30);

      const [
        totalUsersRes,
        users24hRes,
        users7dRes,
        users30dRes,
        enrollmentsRes,
        lessonsRes,
        lessonProgressRes,
        paymentsRes,
        recentPaymentsRes,
        concurrentRes,
        watchingNowRes,
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact' }),
        supabase.from('profiles').select('id', { count: 'exact' }).gte('created_at', last24h.toISOString()),
        supabase.from('profiles').select('id', { count: 'exact' }).gte('created_at', last7d.toISOString()),
        supabase.from('profiles').select('id', { count: 'exact' }).gte('created_at', last30d.toISOString()),
        supabase.from('course_enrollments').select('id', { count: 'exact' }),
        supabase.from('lessons').select('id', { count: 'exact' }),
        supabase.from('lesson_progress').select('id, watch_time_seconds', { count: 'exact' }).eq('is_completed', true),
        supabase.from('manual_payments').select('amount').eq('status', 'approved'),
        supabase.from('manual_payments').select('amount, created_at').eq('status', 'approved').gte('created_at', last30d.toISOString()),
        supabase.from('realtime_presence').select('id', { count: 'exact' }).gte('last_heartbeat_at', subDays(now, 0.01).toISOString()),
        supabase.from('realtime_presence').select('id', { count: 'exact' }).eq('is_watching_video', true),
      ]);

      const totalWatchTimeSeconds = lessonProgressRes.data?.reduce((sum, p) => sum + (p.watch_time_seconds || 0), 0) || 0;
      const totalRevenue = paymentsRes.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const recentRevenue = recentPaymentsRes.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Calculate today/week/month revenue
      const todayStart = startOfDay(now);
      const weekStart = startOfWeek(now);
      const monthStart = startOfMonth(now);

      const revenueToday = recentPaymentsRes.data?.filter(p => new Date(p.created_at) >= todayStart).reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const revenueWeek = recentPaymentsRes.data?.filter(p => new Date(p.created_at) >= weekStart).reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const revenueMonth = recentPaymentsRes.data?.filter(p => new Date(p.created_at) >= monthStart).reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Calculate RPAU (Revenue Per Active User)
      const activeUsers = users30dRes.count || 1;
      const rpau = recentRevenue / activeUsers;

      return {
        totalUsers: totalUsersRes.count || 0,
        users24h: users24hRes.count || 0,
        users7d: users7dRes.count || 0,
        users30d: users30dRes.count || 0,
        concurrentUsers: concurrentRes.count || 0,
        videosWatchingNow: watchingNowRes.count || 0,
        totalWatchTimeMinutes: Math.round(totalWatchTimeSeconds / 60),
        totalWatchTimeHours: Math.round(totalWatchTimeSeconds / 3600),
        totalLessonsCompleted: lessonProgressRes.count || 0,
        revenueToday,
        revenueWeek,
        revenueMonth,
        revenueLifetime: totalRevenue,
        rpau: Math.round(rpau * 100) / 100,
        totalEnrollments: enrollmentsRes.count || 0,
        totalLessons: lessonsRes.count || 0,
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
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
        profilesRes,
        gamificationRes,
        xpRes,
        sessionsRes,
        engagementRes,
      ] = await Promise.all([
        supabase.from('profiles').select('id, user_id, created_at, experience_level').gte('created_at', since.toISOString()),
        supabase.from('user_gamification').select('user_id, total_xp, level, current_streak, longest_streak, last_activity_date'),
        supabase.from('xp_transactions').select('user_id, amount, source_type, created_at').gte('created_at', since.toISOString()),
        supabase.from('user_sessions').select('*').gte('started_at', since.toISOString()),
        supabase.from('user_engagement_scores').select('*').gte('score_date', format(since, 'yyyy-MM-dd')),
      ]);

      // Group sessions by device
      const sessionsByDevice = (sessionsRes.data || []).reduce((acc: Record<string, number[]>, s) => {
        const device = s.device_type || 'unknown';
        if (!acc[device]) acc[device] = [];
        if (s.duration_seconds) acc[device].push(s.duration_seconds);
        return acc;
      }, {});

      // Calculate average session duration by device
      const avgSessionByDevice = Object.entries(sessionsByDevice).map(([device, durations]) => ({
        device,
        avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60), // in minutes
        count: durations.length,
      }));

      // Experience level distribution
      const expLevelDist = (profilesRes.data || []).reduce((acc: Record<string, number>, p) => {
        const level = p.experience_level || 'FUTURE RIDER';
        acc[level] = (acc[level] || 0) + 1;
        return acc;
      }, {});

      // Engagement score distribution (percentiles)
      const scores = (engagementRes.data || []).map(e => e.engagement_score).sort((a, b) => a - b);
      const getPercentile = (arr: number[], p: number) => {
        if (arr.length === 0) return 0;
        const idx = Math.ceil(arr.length * p / 100) - 1;
        return arr[Math.max(0, idx)];
      };

      return {
        newUsers: profilesRes.data?.length || 0,
        experienceLevelDistribution: expLevelDist,
        avgSessionByDevice,
        totalSessions: sessionsRes.data?.length || 0,
        engagementScores: {
          p25: getPercentile(scores, 25),
          p50: getPercentile(scores, 50),
          p75: getPercentile(scores, 75),
          p90: getPercentile(scores, 90),
          avg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
        },
        churnRiskUsers: (engagementRes.data || []).filter(e => e.churn_risk_score > 70).length,
        activeStreaks: (gamificationRes.data || []).filter(g => g.current_streak > 0).length,
      };
    },
  });
}

// Video & Lesson Micro-Analytics
export function useVideoAnalytics(dateRange: string, lessonId?: string) {
  return useQuery({
    queryKey: ['analytics-video', dateRange, lessonId],
    queryFn: async () => {
      const days = DATE_RANGES[dateRange]?.days || 30;
      const since = subDays(new Date(), days);

      let watchQuery = supabase.from('video_watch_sessions').select('*').gte('started_at', since.toISOString());
      let eventsQuery = supabase.from('video_playback_events').select('*').gte('created_at', since.toISOString());
      
      if (lessonId) {
        watchQuery = watchQuery.eq('lesson_id', lessonId);
        eventsQuery = eventsQuery.eq('lesson_id', lessonId);
      }

      const [watchRes, eventsRes, lessonsRes] = await Promise.all([
        watchQuery,
        eventsQuery.limit(10000),
        supabase.from('lessons').select('id, title, title_ar, duration_minutes, chapter_id'),
      ]);

      const watchSessions = watchRes.data || [];
      const events = eventsRes.data || [];
      const lessons = lessonsRes.data || [];

      // Calculate per-lesson metrics
      const lessonMetrics = lessons.map(lesson => {
        const lessonSessions = watchSessions.filter(w => w.lesson_id === lesson.id);
        const lessonEvents = events.filter(e => e.lesson_id === lesson.id);

        const completions = lessonSessions.filter(s => s.completed).length;
        const totalViews = lessonSessions.length;
        const avgCompletion = lessonSessions.length
          ? lessonSessions.reduce((sum, s) => sum + s.completion_percentage, 0) / lessonSessions.length
          : 0;

        // Calculate drop-off points
        const dropOffEvents = lessonEvents.filter(e => e.event_type === 'ended' || e.event_type === 'pause');
        const dropOffPositions = dropOffEvents.map(e => e.video_position_seconds || 0);
        const medianDropOff = dropOffPositions.length
          ? dropOffPositions.sort((a, b) => a - b)[Math.floor(dropOffPositions.length / 2)]
          : 0;

        // Buffering stats
        const bufferingEvents = lessonEvents.filter(e => e.event_type === 'buffering');
        const avgBufferingPerViewer = totalViews > 0 ? bufferingEvents.length / totalViews : 0;

        // Pause and rewind counts
        const pauseCount = lessonSessions.reduce((sum, s) => sum + (s.pause_count || 0), 0);
        const rewindCount = lessonSessions.reduce((sum, s) => sum + (s.rewind_count || 0), 0);

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

      // Sort for rankings
      const bestPerforming = [...lessonMetrics].sort((a, b) => b.completionRate - a.completionRate).slice(0, 5);
      const worstPerforming = [...lessonMetrics].sort((a, b) => a.completionRate - b.completionRate).slice(0, 5);
      const mostRewatched = [...lessonMetrics].sort((a, b) => b.rewindCount - a.rewindCount).slice(0, 5);

      // Overall stats
      const totalWatchTime = watchSessions.reduce((sum, s) => sum + (s.total_watch_time_seconds || 0), 0);
      const totalBufferingTime = watchSessions.reduce((sum, s) => sum + (s.total_buffering_time_ms || 0), 0);

      return {
        lessonMetrics,
        bestPerforming,
        worstPerforming,
        mostRewatched,
        totalWatchTimeMins: Math.round(totalWatchTime / 60),
        totalBufferingTimeSecs: Math.round(totalBufferingTime / 1000),
        avgCompletionRate: lessonMetrics.length
          ? Math.round(lessonMetrics.reduce((sum, l) => sum + l.completionRate, 0) / lessonMetrics.length)
          : 0,
      };
    },
  });
}

// Course-Level Psychology
export function useCourseAnalytics(dateRange: string) {
  return useQuery({
    queryKey: ['analytics-courses', dateRange],
    queryFn: async () => {
      const days = DATE_RANGES[dateRange]?.days || 30;
      const since = subDays(new Date(), days);

      const [coursesRes, chaptersRes, lessonsRes, enrollmentsRes, progressRes] = await Promise.all([
        supabase.from('courses').select('id, title, title_ar, is_published'),
        supabase.from('chapters').select('id, course_id, title, position'),
        supabase.from('lessons').select('id, chapter_id, title, position'),
        supabase.from('course_enrollments').select('*'),
        supabase.from('lesson_progress').select('*'),
      ]);

      const courses = coursesRes.data || [];
      const chapters = chaptersRes.data || [];
      const lessons = lessonsRes.data || [];
      const enrollments = enrollmentsRes.data || [];
      const progress = progressRes.data || [];

      // Build course analytics
      const courseAnalytics = courses.map(course => {
        const courseChapters = chapters.filter(ch => ch.course_id === course.id);
        const courseChapterIds = courseChapters.map(ch => ch.id);
        const courseLessons = lessons.filter(l => courseChapterIds.includes(l.chapter_id));
        const courseLessonIds = courseLessons.map(l => l.id);
        
        const courseEnrollments = enrollments.filter(e => e.course_id === course.id);
        const completedEnrollments = courseEnrollments.filter(e => e.completed_at);
        
        // Calculate lesson-to-lesson leakage
        const lessonCompletionCounts = courseLessons.map(lesson => {
          const completions = progress.filter(p => p.lesson_id === lesson.id && p.is_completed).length;
          return { lessonId: lesson.id, position: lesson.position, completions };
        }).sort((a, b) => a.position - b.position);

        // Calculate leakage between lessons
        const leakageRates = lessonCompletionCounts.slice(1).map((current, idx) => {
          const prev = lessonCompletionCounts[idx];
          if (prev.completions === 0) return 0;
          return Math.round(((prev.completions - current.completions) / prev.completions) * 100);
        });

        // First lesson to second lesson retention
        const firstLessonCompletions = lessonCompletionCounts[0]?.completions || 0;
        const secondLessonCompletions = lessonCompletionCounts[1]?.completions || 0;
        const neverStartLesson2Pct = firstLessonCompletions > 0
          ? Math.round(((firstLessonCompletions - secondLessonCompletions) / firstLessonCompletions) * 100)
          : 0;

        // Time to first drop-off (avg days until first incomplete lesson)
        const userFirstDropoffs = courseEnrollments.map(e => {
          const userProgress = progress.filter(p => p.user_id === e.user_id && courseLessonIds.includes(p.lesson_id));
          const completedLessons = userProgress.filter(p => p.is_completed).length;
          if (completedLessons === courseLessons.length) return null; // Completed all
          const enrollDate = new Date(e.enrolled_at);
          const lastProgress = userProgress.sort((a, b) => 
            new Date(b.last_watched_at || 0).getTime() - new Date(a.last_watched_at || 0).getTime()
          )[0];
          if (!lastProgress?.last_watched_at) return null;
          return differenceInDays(new Date(lastProgress.last_watched_at), enrollDate);
        }).filter(d => d !== null) as number[];

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
            ? Math.round(leakageRates.reduce((a, b) => a + b, 0) / leakageRates.length)
            : 0,
          totalChapters: courseChapters.length,
          totalLessons: courseLessons.length,
        };
      });

      return {
        courses: courseAnalytics,
        totalCourses: courses.length,
        publishedCourses: courses.filter(c => c.is_published).length,
        avgCompletionRate: courseAnalytics.length
          ? Math.round(courseAnalytics.reduce((sum, c) => sum + c.completionRate, 0) / courseAnalytics.length)
          : 0,
      };
    },
  });
}

// Funnel & Conversion Intelligence
export function useFunnelAnalytics(dateRange: string) {
  return useQuery({
    queryKey: ['analytics-funnel', dateRange],
    queryFn: async () => {
      const days = DATE_RANGES[dateRange]?.days || 30;
      const since = subDays(new Date(), days);

      const [funnelRes, profilesRes, enrollmentsRes, paymentsRes, progressRes] = await Promise.all([
        supabase.from('funnel_events').select('*').gte('created_at', since.toISOString()),
        supabase.from('profiles').select('id, user_id, created_at'),
        supabase.from('course_enrollments').select('*').gte('enrolled_at', since.toISOString()),
        supabase.from('manual_payments').select('*').eq('status', 'approved').gte('created_at', since.toISOString()),
        supabase.from('lesson_progress').select('*').gte('last_watched_at', since.toISOString()),
      ]);

      const profiles = profilesRes.data || [];
      const enrollments = enrollmentsRes.data || [];
      const payments = paymentsRes.data || [];
      const progress = progressRes.data || [];

      // Calculate funnel steps
      const signups = profiles.length;
      
      // Users who completed at least one lesson
      const usersWithProgress = new Set(progress.filter(p => p.is_completed).map(p => p.user_id));
      const firstLessonUsers = usersWithProgress.size;
      
      // Users who completed at least 2 lessons
      const lessonCountByUser = progress.filter(p => p.is_completed).reduce((acc: Record<string, number>, p) => {
        acc[p.user_id] = (acc[p.user_id] || 0) + 1;
        return acc;
      }, {});
      const secondLessonUsers = Object.values(lessonCountByUser).filter(c => c >= 2).length;

      // Paid users
      const paidUsers = new Set(payments.map(p => p.user_id)).size;

      // Active users (any activity in last 7 days)
      const activeUsers = new Set(
        progress.filter(p => {
          const lastWatched = p.last_watched_at ? new Date(p.last_watched_at) : null;
          return lastWatched && lastWatched >= subDays(new Date(), 7);
        }).map(p => p.user_id)
      ).size;

      const funnelSteps = [
        { step: 'Signups', count: signups, rate: 100 },
        { step: 'First Lesson', count: firstLessonUsers, rate: signups > 0 ? Math.round((firstLessonUsers / signups) * 100) : 0 },
        { step: 'Second Lesson', count: secondLessonUsers, rate: signups > 0 ? Math.round((secondLessonUsers / signups) * 100) : 0 },
        { step: 'Paid', count: paidUsers, rate: signups > 0 ? Math.round((paidUsers / signups) * 100) : 0 },
        { step: 'Active (7d)', count: activeUsers, rate: signups > 0 ? Math.round((activeUsers / signups) * 100) : 0 },
      ];

      // Calculate drop rates between steps
      const dropRates = funnelSteps.slice(1).map((step, idx) => ({
        from: funnelSteps[idx].step,
        to: step.step,
        dropRate: funnelSteps[idx].count > 0
          ? Math.round(((funnelSteps[idx].count - step.count) / funnelSteps[idx].count) * 100)
          : 0,
      }));

      return {
        funnelSteps,
        dropRates,
        conversionRate: signups > 0 ? Math.round((paidUsers / signups) * 100) : 0,
        activationRate: signups > 0 ? Math.round((firstLessonUsers / signups) * 100) : 0,
      };
    },
  });
}

// Revenue Analytics
export function useRevenueAnalytics(dateRange: string) {
  return useQuery({
    queryKey: ['analytics-revenue', dateRange],
    queryFn: async () => {
      const days = DATE_RANGES[dateRange]?.days || 30;
      const since = subDays(new Date(), days);

      const [paymentsRes, coursesRes, profilesRes] = await Promise.all([
        supabase.from('manual_payments').select('*').eq('status', 'approved'),
        supabase.from('courses').select('id, title, title_ar, price'),
        supabase.from('profiles').select('id, user_id, created_at'),
      ]);

      const payments = paymentsRes.data || [];
      const courses = coursesRes.data || [];
      const profiles = profilesRes.data || [];

      // Revenue by course
      const revenueByCourse = courses.map(course => {
        const coursePayments = payments.filter(p => p.course_id === course.id);
        const totalRevenue = coursePayments.reduce((sum, p) => sum + Number(p.amount), 0);
        return {
          id: course.id,
          title: course.title,
          title_ar: course.title_ar,
          price: course.price,
          revenue: totalRevenue,
          transactions: coursePayments.length,
        };
      }).sort((a, b) => b.revenue - a.revenue);

      // Monthly revenue trend
      const monthlyRevenue: Record<string, number> = {};
      payments.forEach(p => {
        const month = format(new Date(p.created_at), 'yyyy-MM');
        monthlyRevenue[month] = (monthlyRevenue[month] || 0) + Number(p.amount);
      });

      const monthlyTrend = Object.entries(monthlyRevenue)
        .map(([month, revenue]) => ({ month, revenue }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12);

      // Calculate velocity (trend slope)
      const recentMonths = monthlyTrend.slice(-3);
      const velocity = recentMonths.length >= 2
        ? (recentMonths[recentMonths.length - 1]?.revenue || 0) - (recentMonths[0]?.revenue || 0)
        : 0;

      // ARPU / ARPPU
      const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const totalUsers = profiles.length;
      const payingUsers = new Set(payments.map(p => p.user_id)).size;

      const arpu = totalUsers > 0 ? totalRevenue / totalUsers : 0;
      const arppu = payingUsers > 0 ? totalRevenue / payingUsers : 0;

      // LTV by cohort (simplified - by signup month)
      const cohortRevenue: Record<string, { users: number; revenue: number }> = {};
      profiles.forEach(profile => {
        const cohort = format(new Date(profile.created_at), 'yyyy-MM');
        if (!cohortRevenue[cohort]) cohortRevenue[cohort] = { users: 0, revenue: 0 };
        cohortRevenue[cohort].users++;
        
        const userPayments = payments.filter(p => p.user_id === profile.user_id);
        const userRevenue = userPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        cohortRevenue[cohort].revenue += userRevenue;
      });

      const cohortLTV = Object.entries(cohortRevenue).map(([cohort, data]) => ({
        cohort,
        ltv: data.users > 0 ? Math.round(data.revenue / data.users) : 0,
        users: data.users,
      })).sort((a, b) => a.cohort.localeCompare(b.cohort));

      // Refunds (simplified - no refund tracking in current schema, count as 0)
      const refunds = 0;
      const disputes = 0;

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
  });
}

// Retention & Churn
export function useRetentionAnalytics(dateRange: string) {
  return useQuery({
    queryKey: ['analytics-retention', dateRange],
    queryFn: async () => {
      const [engagementRes, gamificationRes, progressRes, profilesRes] = await Promise.all([
        supabase.from('user_engagement_scores').select('*').order('score_date', { ascending: false }),
        supabase.from('user_gamification').select('*'),
        supabase.from('lesson_progress').select('user_id, lesson_id, is_completed, last_watched_at'),
        supabase.from('profiles').select('user_id, created_at'),
      ]);

      const engagement = engagementRes.data || [];
      const gamification = gamificationRes.data || [];
      const progress = progressRes.data || [];
      const profiles = profilesRes.data || [];

      // Users at risk of churning (high churn score)
      const latestEngagement = engagement.reduce((acc: Record<string, typeof engagement[0]>, e) => {
        if (!acc[e.user_id] || e.score_date > acc[e.user_id].score_date) {
          acc[e.user_id] = e;
        }
        return acc;
      }, {});

      const atRiskUsers = Object.values(latestEngagement)
        .filter(e => e.churn_risk_score > 60)
        .sort((a, b) => b.churn_risk_score - a.churn_risk_score)
        .slice(0, 20);

      // Last activity by user
      const lastActivityByUser = progress.reduce((acc: Record<string, Date>, p) => {
        if (p.last_watched_at) {
          const lastWatched = new Date(p.last_watched_at);
          if (!acc[p.user_id] || lastWatched > acc[p.user_id]) {
            acc[p.user_id] = lastWatched;
          }
        }
        return acc;
      }, {});

      // Inactivity windows
      const now = new Date();
      const inactiveWindows = [
        { label: '1-7 days', min: 1, max: 7, count: 0 },
        { label: '8-14 days', min: 8, max: 14, count: 0 },
        { label: '15-30 days', min: 15, max: 30, count: 0 },
        { label: '30+ days', min: 30, max: 9999, count: 0 },
      ];

      Object.entries(lastActivityByUser).forEach(([userId, lastActivity]) => {
        const daysInactive = differenceInDays(now, lastActivity);
        const window = inactiveWindows.find(w => daysInactive >= w.min && daysInactive <= w.max);
        if (window) window.count++;
      });

      // Streak distribution
      const streakDistribution = [
        { label: '0 days', count: gamification.filter(g => g.current_streak === 0).length },
        { label: '1-3 days', count: gamification.filter(g => g.current_streak >= 1 && g.current_streak <= 3).length },
        { label: '4-7 days', count: gamification.filter(g => g.current_streak >= 4 && g.current_streak <= 7).length },
        { label: '8-14 days', count: gamification.filter(g => g.current_streak >= 8 && g.current_streak <= 14).length },
        { label: '15+ days', count: gamification.filter(g => g.current_streak >= 15).length },
      ];

      // Churn prediction (users inactive > 14 days with low engagement)
      const predictedChurn = Object.entries(lastActivityByUser)
        .filter(([userId, lastActivity]) => {
          const daysInactive = differenceInDays(now, lastActivity);
          const userEngagement = latestEngagement[userId];
          return daysInactive > 14 && (!userEngagement || userEngagement.engagement_score < 30);
        }).length;

      return {
        atRiskUsers: atRiskUsers.map(u => ({
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
          .filter(([_, date]) => differenceInDays(now, date) <= 7).length,
      };
    },
  });
}

// Infrastructure Metrics
export function useInfrastructureMetrics(dateRange: string) {
  return useQuery({
    queryKey: ['analytics-infrastructure', dateRange],
    queryFn: async () => {
      const days = DATE_RANGES[dateRange]?.days || 30;
      const since = subDays(new Date(), days);

      const [metricsRes, watchSessionsRes, eventsRes] = await Promise.all([
        supabase.from('infrastructure_metrics').select('*').gte('recorded_at', since.toISOString()),
        supabase.from('video_watch_sessions').select('total_buffering_time_ms, buffering_events, total_watch_time_seconds').gte('started_at', since.toISOString()),
        supabase.from('video_playback_events').select('event_type, buffering_duration_ms').eq('event_type', 'error').gte('created_at', since.toISOString()),
      ]);

      const metrics = metricsRes.data || [];
      const watchSessions = watchSessionsRes.data || [];
      const errorEvents = eventsRes.data || [];

      // Calculate buffering ratio
      const totalWatchTime = watchSessions.reduce((sum, s) => sum + (s.total_watch_time_seconds || 0), 0);
      const totalBufferingTime = watchSessions.reduce((sum, s) => sum + ((s.total_buffering_time_ms || 0) / 1000), 0);
      const bufferingRatio = totalWatchTime > 0 ? (totalBufferingTime / totalWatchTime) * 100 : 0;

      // Error rate
      const totalEvents = watchSessions.length;
      const errorRate = totalEvents > 0 ? (errorEvents.length / totalEvents) * 100 : 0;

      // Group metrics by type
      const metricsByType = metrics.reduce((acc: Record<string, typeof metrics>, m) => {
        if (!acc[m.metric_type]) acc[m.metric_type] = [];
        acc[m.metric_type].push(m);
        return acc;
      }, {});

      return {
        bufferingRatio: Math.round(bufferingRatio * 100) / 100,
        errorRate: Math.round(errorRate * 100) / 100,
        totalErrors: errorEvents.length,
        metricsByType,
        videoStartTimeP95: metricsByType['video_start_time']?.find(m => m.percentile === 'p95')?.value || 0,
        videoStartTimeP99: metricsByType['video_start_time']?.find(m => m.percentile === 'p99')?.value || 0,
        avgBufferingPerSession: watchSessions.length > 0
          ? Math.round(watchSessions.reduce((sum, s) => sum + (s.buffering_events || 0), 0) / watchSessions.length * 100) / 100
          : 0,
      };
    },
  });
}
