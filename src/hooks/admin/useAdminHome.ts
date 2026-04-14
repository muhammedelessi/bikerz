import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useAdminHome = ({ isRTL, t }: { isRTL: boolean; t: any }) => {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [
        { count: totalUsers },
        { count: totalCourses },
        { count: totalEnrollments },
        { count: totalMentors },
        { data: enrollmentsData },
        { data: progressData },
        { data: manualPaymentsData },
        { data: tapPaymentsData },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('courses').select('*', { count: 'exact', head: true }),
        supabase.from('course_enrollments').select('*', { count: 'exact', head: true }),
        supabase.from('mentors').select('*', { count: 'exact', head: true }),
        supabase.from('course_enrollments').select('progress_percentage, completed_at, enrolled_at'),
        supabase.from('lesson_progress').select('watch_time_seconds, is_completed'),
        supabase.from('manual_payments').select('amount, status').eq('status', 'approved'),
        supabase.from('tap_charges').select('amount, status').in('status', ['CAPTURED', 'captured', 'APPROVED', 'approved', 'processing']),
      ]);

      const [{ count: totalTrainers }, { count: totalTrainings }, { count: totalTrainingStudents }, { data: trainerReviewsData }] =
        await Promise.all([
          supabase.from('trainers').select('*', { count: 'exact', head: true }),
          supabase.from('trainings').select('*', { count: 'exact', head: true }),
          supabase.from('training_students').select('*', { count: 'exact', head: true }),
          supabase.from('trainer_reviews').select('rating'),
        ]);

      const avgTrainerRating =
        trainerReviewsData && trainerReviewsData.length > 0
          ? (trainerReviewsData.reduce((a, r) => a + r.rating, 0) / trainerReviewsData.length).toFixed(1)
          : '0';
      const completedEnrollments = (enrollmentsData || []).filter((e) => e.completed_at !== null).length;
      const completionRate =
        enrollmentsData && enrollmentsData.length > 0 ? Math.round((completedEnrollments / enrollmentsData.length) * 100) : 0;
      const passedEnrollments = (enrollmentsData || []).filter((e) => e.progress_percentage >= 70).length;
      const passRate =
        enrollmentsData && enrollmentsData.length > 0 ? Math.round((passedEnrollments / enrollmentsData.length) * 100) : 0;
      const totalWatchTime = (progressData || []).reduce((acc, p) => acc + (p.watch_time_seconds || 0), 0);
      const completedLessons = (progressData || []).filter((p) => p.is_completed).length;
      const avgWatchTimeMinutes = completedLessons > 0 ? Math.round(totalWatchTime / completedLessons / 60) : 0;
      const manualRevenue = (manualPaymentsData || []).reduce((acc, p) => acc + Number(p.amount), 0);
      const tapRevenue = (tapPaymentsData || []).reduce((acc, p) => acc + Number(p.amount), 0);
      const totalRevenue = manualRevenue + tapRevenue;

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: activeUsers } = await supabase
        .from('lesson_progress')
        .select('user_id', { count: 'exact', head: true })
        .gte('last_watched_at', sevenDaysAgo);

      const activeEnrollments = (enrollmentsData || []).filter((e) => !e.completed_at && e.progress_percentage > 0 && e.progress_percentage < 100).length;
      const newEnrollments = (enrollmentsData || []).filter((e) => e.progress_percentage === 0).length;
      const pausedEnrollments = (enrollmentsData || []).length - completedEnrollments - activeEnrollments - newEnrollments;

      return {
        totalUsers: totalUsers || 0,
        totalCourses: totalCourses || 0,
        totalEnrollments: totalEnrollments || 0,
        totalMentors: totalMentors || 0,
        completionRate,
        passRate,
        avgWatchTimeMinutes,
        totalRevenue,
        activeUsers: activeUsers || 0,
        enrollmentDistribution: {
          completed: completedEnrollments,
          active: activeEnrollments > 0 ? activeEnrollments : 0,
          paused: pausedEnrollments > 0 ? pausedEnrollments : 0,
          new: newEnrollments > 0 ? newEnrollments : 0,
        },
        totalTrainers: totalTrainers || 0,
        totalTrainings: totalTrainings || 0,
        totalTrainingStudents: totalTrainingStudents || 0,
        avgTrainerRating,
      };
    },
  });

  const { data: coursePerformance = [] } = useQuery({
    queryKey: ['admin-course-performance', isRTL],
    queryFn: async () => {
      const { data: courses } = await supabase.from('courses').select('id, title, title_ar').eq('is_published', true).limit(5);
      if (!courses) return [];
      return Promise.all(
        courses.map(async (course) => {
          const { count: students } = await supabase.from('course_enrollments').select('*', { count: 'exact', head: true }).eq('course_id', course.id);
          const { data: enrollments } = await supabase.from('course_enrollments').select('progress_percentage').eq('course_id', course.id);
          const avgCompletion =
            enrollments && enrollments.length > 0 ? Math.round(enrollments.reduce((acc, e) => acc + e.progress_percentage, 0) / enrollments.length) : 0;
          return {
            name: isRTL && course.title_ar ? course.title_ar : course.title,
            students: students || 0,
            completion: avgCompletion,
          };
        }),
      );
    },
  });

  const { data: monthlyData = [] } = useQuery({
    queryKey: ['admin-monthly-enrollments'],
    queryFn: async () => {
      const months = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const startOfMonth = date.toISOString();
        const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString();
        const { count } = await supabase
          .from('course_enrollments')
          .select('*', { count: 'exact', head: true })
          .gte('enrolled_at', startOfMonth)
          .lte('enrolled_at', endOfMonth);
        const monthNames = [
          t('admin.dashboard.months.jan'),
          t('admin.dashboard.months.feb'),
          t('admin.dashboard.months.mar'),
          t('admin.dashboard.months.apr'),
          t('admin.dashboard.months.may'),
          t('admin.dashboard.months.jun'),
          t('admin.dashboard.months.jul'),
          t('admin.dashboard.months.aug'),
          t('admin.dashboard.months.sep'),
          t('admin.dashboard.months.oct'),
          t('admin.dashboard.months.nov'),
          t('admin.dashboard.months.dec'),
        ];
        months.push({ name: monthNames[date.getMonth()], enrollments: count || 0 });
      }
      return months;
    },
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['admin-alerts'],
    queryFn: async () => {
      const alertsList: Array<{ type: string; message: string }> = [];
      const { count: pendingPayments } = await supabase.from('manual_payments').select('*', { count: 'exact', head: true }).eq('status', 'pending');
      if (pendingPayments && pendingPayments > 0) {
        alertsList.push({ type: 'warning', message: t('admin.dashboard.pendingPaymentsAlert', { count: pendingPayments }) });
      }
      const { count: openTickets } = await supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .in('status', ['open', 'in_progress']);
      if (openTickets && openTickets > 0) {
        alertsList.push({ type: 'info', message: t('admin.dashboard.openTicketsAlert', { count: openTickets }) });
      }
      const { count: pendingDiscussions } = await supabase
        .from('lesson_discussions')
        .select('*', { count: 'exact', head: true })
        .eq('is_approved', false);
      if (pendingDiscussions && pendingDiscussions > 0) {
        alertsList.push({ type: 'info', message: t('admin.dashboard.pendingDiscussionsAlert', { count: pendingDiscussions }) });
      }
      return alertsList;
    },
  });

  const enrollmentsByStatus = stats
    ? [
        { name: t('admin.dashboard.completed'), value: stats.enrollmentDistribution.completed },
        { name: t('admin.dashboard.active'), value: stats.enrollmentDistribution.active },
        { name: t('admin.dashboard.paused'), value: stats.enrollmentDistribution.paused },
        { name: t('admin.dashboard.new'), value: stats.enrollmentDistribution.new },
      ]
    : [];

  return {
    stats,
    statsLoading,
    coursePerformance,
    monthlyData,
    alerts,
    enrollmentsByStatus,
  };
};
