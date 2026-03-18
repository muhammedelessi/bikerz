import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  BookOpen,
  GraduationCap,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Clock,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from '@/lib/recharts-compat';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

const AdminHome: React.FC = () => {
  const { isRTL } = useLanguage();

  // Fetch real stats from database
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

      // Calculate completion rate
      const completedEnrollments = (enrollmentsData || []).filter(e => e.completed_at !== null).length;
      const completionRate = enrollmentsData && enrollmentsData.length > 0
        ? Math.round((completedEnrollments / enrollmentsData.length) * 100)
        : 0;

      // Calculate pass rate (enrollments with >= 70% progress)
      const passedEnrollments = (enrollmentsData || []).filter(e => e.progress_percentage >= 70).length;
      const passRate = enrollmentsData && enrollmentsData.length > 0
        ? Math.round((passedEnrollments / enrollmentsData.length) * 100)
        : 0;

      // Calculate average watch time
      const totalWatchTime = (progressData || []).reduce((acc, p) => acc + (p.watch_time_seconds || 0), 0);
      const completedLessons = (progressData || []).filter(p => p.is_completed).length;
      const avgWatchTimeMinutes = completedLessons > 0
        ? Math.round((totalWatchTime / completedLessons) / 60)
        : 0;

      // Calculate total revenue from both manual and tap payments
      const manualRevenue = (manualPaymentsData || []).reduce((acc, p) => acc + Number(p.amount), 0);
      const tapRevenue = (tapPaymentsData || []).reduce((acc, p) => acc + Number(p.amount), 0);
      const totalRevenue = manualRevenue + tapRevenue;

      // Calculate active users (users with activity in last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: activeUsers } = await supabase
        .from('lesson_progress')
        .select('user_id', { count: 'exact', head: true })
        .gte('last_watched_at', sevenDaysAgo);

      // Enrollment distribution
      const activeEnrollments = (enrollmentsData || []).filter(
        e => !e.completed_at && e.progress_percentage > 0 && e.progress_percentage < 100
      ).length;
      const newEnrollments = (enrollmentsData || []).filter(e => e.progress_percentage === 0).length;
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
      };
    },
  });

  // Fetch course performance data
  const { data: coursePerformance = [] } = useQuery({
    queryKey: ['admin-course-performance'],
    queryFn: async () => {
      const { data: courses } = await supabase
        .from('courses')
        .select('id, title, title_ar')
        .eq('is_published', true)
        .limit(5);

      if (!courses) return [];

      const performance = await Promise.all(
        courses.map(async (course) => {
          const { count: students } = await supabase
            .from('course_enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', course.id);

          const { data: enrollments } = await supabase
            .from('course_enrollments')
            .select('progress_percentage')
            .eq('course_id', course.id);

          const avgCompletion = enrollments && enrollments.length > 0
            ? Math.round(enrollments.reduce((acc, e) => acc + e.progress_percentage, 0) / enrollments.length)
            : 0;

          return {
            name: isRTL && course.title_ar ? course.title_ar : course.title,
            students: students || 0,
            completion: avgCompletion,
          };
        })
      );

      return performance;
    },
  });

  // Fetch monthly enrollment data for chart
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

        const monthNames = isRTL
          ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
          : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        months.push({
          name: monthNames[date.getMonth()],
          enrollments: count || 0,
        });
      }

      return months;
    },
  });

  // Fetch pending alerts
  const { data: alerts = [] } = useQuery({
    queryKey: ['admin-alerts'],
    queryFn: async () => {
      const alertsList = [];

      // Check for pending payments
      const { count: pendingPayments } = await supabase
        .from('manual_payments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (pendingPayments && pendingPayments > 0) {
        alertsList.push({
          type: 'warning',
          message: isRTL 
            ? `${pendingPayments} دفعة معلقة تحتاج مراجعة`
            : `${pendingPayments} pending payment(s) need review`,
        });
      }

      // Check for open support tickets
      const { count: openTickets } = await supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .in('status', ['open', 'in_progress']);

      if (openTickets && openTickets > 0) {
        alertsList.push({
          type: 'info',
          message: isRTL 
            ? `${openTickets} تذكرة دعم مفتوحة`
            : `${openTickets} open support ticket(s)`,
        });
      }

      // Check for unapproved discussions
      const { count: pendingDiscussions } = await supabase
        .from('lesson_discussions')
        .select('*', { count: 'exact', head: true })
        .eq('is_approved', false);

      if (pendingDiscussions && pendingDiscussions > 0) {
        alertsList.push({
          type: 'info',
          message: isRTL 
            ? `${pendingDiscussions} سؤال ينتظر الموافقة`
            : `${pendingDiscussions} discussion(s) pending approval`,
        });
      }

      return alertsList;
    },
  });

  const enrollmentsByStatus = stats ? [
    { name: isRTL ? 'مكتمل' : 'Completed', value: stats.enrollmentDistribution.completed },
    { name: isRTL ? 'نشط' : 'Active', value: stats.enrollmentDistribution.active },
    { name: isRTL ? 'متوقف' : 'Paused', value: stats.enrollmentDistribution.paused },
    { name: isRTL ? 'جديد' : 'New', value: stats.enrollmentDistribution.new },
  ] : [];

  const statCards = [
    {
      title: isRTL ? 'إجمالي المستخدمين' : 'Total Users',
      value: stats?.totalUsers || 0,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: isRTL ? 'الدورات النشطة' : 'Active Courses',
      value: stats?.totalCourses || 0,
      icon: BookOpen,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: isRTL ? 'التسجيلات' : 'Enrollments',
      value: stats?.totalEnrollments || 0,
      icon: GraduationCap,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: isRTL ? 'إجمالي الإيرادات' : 'Total Revenue',
      value: `${isRTL ? 'ر.س' : 'SAR'} ${stats?.totalRevenue?.toLocaleString() || 0}`,
      icon: DollarSign,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isRTL ? 'لوحة التحكم' : 'Dashboard'}
          </h1>
          <p className="text-muted-foreground">
            {isRTL ? 'نظرة عامة على أداء الأكاديمية' : 'Academy performance overview'}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsLoading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={index} className="relative overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{stat.title}</p>
                        <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                      </div>
                      <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                        <Icon className={`w-6 h-6 ${stat.color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Enrollments Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {isRTL ? 'التسجيلات الشهرية' : 'Monthly Enrollments'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {monthlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" reversed={isRTL} />
                      <YAxis className="text-xs" orientation={isRTL ? 'right' : 'left'} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="enrollments" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    {isRTL ? 'لا توجد بيانات' : 'No data available'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Course Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {isRTL ? 'أداء الدورات' : 'Course Performance'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {coursePerformance.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={coursePerformance} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" reversed={isRTL} />
                      <YAxis dataKey="name" type="category" className="text-xs" width={isRTL ? 150 : 120} orientation={isRTL ? 'right' : 'left'} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Bar dataKey="students" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    {isRTL ? 'لا توجد دورات' : 'No courses available'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Second Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Enrollment Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {isRTL ? 'توزيع التسجيلات' : 'Enrollment Distribution'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                {enrollmentsByStatus.some(e => e.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={enrollmentsByStatus}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {enrollmentsByStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    {isRTL ? 'لا توجد تسجيلات' : 'No enrollments'}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {enrollmentsByStatus.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm text-muted-foreground">{item.name} ({item.value})</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Alerts & Notifications */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5" />
                {isRTL ? 'التنبيهات والإشعارات' : 'Alerts & Notifications'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alerts.length > 0 ? (
                  alerts.map((alert, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-3 p-3 rounded-lg ${
                        alert.type === 'warning' ? 'bg-amber-500/10' :
                        alert.type === 'error' ? 'bg-red-500/10' : 'bg-blue-500/10'
                      }`}
                    >
                      {alert.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />}
                      {alert.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
                      {alert.type === 'info' && <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />}
                      <p className="text-sm text-foreground">{alert.message}</p>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10">
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <p className="text-sm text-foreground">
                      {isRTL ? 'لا توجد تنبيهات حالياً' : 'No alerts at this time'}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? 'معدل الإكمال' : 'Completion Rate'}
                  </p>
                  <p className="text-xl font-bold text-foreground">{stats?.completionRate || 0}%</p>
                </div>
              </div>
              <Progress value={stats?.completionRate || 0} className="mt-3 h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <GraduationCap className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? 'معدل النجاح' : 'Pass Rate'}
                  </p>
                  <p className="text-xl font-bold text-foreground">{stats?.passRate || 0}%</p>
                </div>
              </div>
              <Progress value={stats?.passRate || 0} className="mt-3 h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Clock className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? 'متوسط وقت المشاهدة' : 'Avg. Watch Time'}
                  </p>
                  <p className="text-xl font-bold text-foreground">
                    {stats?.avgWatchTimeMinutes || 0} {isRTL ? 'د' : 'min'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Users className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? 'المستخدمون النشطون' : 'Active Users'}
                  </p>
                  <p className="text-xl font-bold text-foreground">{stats?.activeUsers || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminHome;
