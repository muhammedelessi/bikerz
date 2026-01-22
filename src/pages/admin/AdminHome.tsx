import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Users,
  BookOpen,
  GraduationCap,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
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
} from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

const AdminHome: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [
        { count: totalUsers },
        { count: totalCourses },
        { count: totalEnrollments },
        { count: totalMentors },
        { data: recentEnrollments },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('courses').select('*', { count: 'exact', head: true }),
        supabase.from('course_enrollments').select('*', { count: 'exact', head: true }),
        supabase.from('mentors').select('*', { count: 'exact', head: true }),
        supabase.from('course_enrollments').select('*').order('enrolled_at', { ascending: false }).limit(10),
      ]);

      return {
        totalUsers: totalUsers || 0,
        totalCourses: totalCourses || 0,
        totalEnrollments: totalEnrollments || 0,
        totalMentors: totalMentors || 0,
        recentEnrollments: recentEnrollments || [],
      };
    },
  });

  // Mock data for charts
  const revenueData = [
    { name: isRTL ? 'يناير' : 'Jan', revenue: 4000 },
    { name: isRTL ? 'فبراير' : 'Feb', revenue: 3000 },
    { name: isRTL ? 'مارس' : 'Mar', revenue: 5000 },
    { name: isRTL ? 'أبريل' : 'Apr', revenue: 4500 },
    { name: isRTL ? 'مايو' : 'May', revenue: 6000 },
    { name: isRTL ? 'يونيو' : 'Jun', revenue: 5500 },
  ];

  const coursePerformance = [
    { name: isRTL ? 'أساسيات' : 'Basics', students: 120, completion: 85 },
    { name: isRTL ? 'متقدم' : 'Advanced', students: 80, completion: 72 },
    { name: isRTL ? 'احترافي' : 'Pro', students: 45, completion: 65 },
  ];

  const enrollmentsByStatus = [
    { name: isRTL ? 'مكتمل' : 'Completed', value: 35 },
    { name: isRTL ? 'نشط' : 'Active', value: 45 },
    { name: isRTL ? 'متوقف' : 'Paused', value: 15 },
    { name: isRTL ? 'جديد' : 'New', value: 5 },
  ];

  const alerts = [
    { type: 'warning', message: isRTL ? '3 طلاب لم يكملوا الدورة منذ 30 يوم' : '3 students inactive for 30+ days' },
    { type: 'error', message: isRTL ? 'دفعة معلقة تحتاج مراجعة' : 'Pending payment needs review' },
    { type: 'success', message: isRTL ? 'تم إصدار 5 شهادات اليوم' : '5 certificates issued today' },
  ];

  const statCards = [
    {
      title: isRTL ? 'إجمالي المستخدمين' : 'Total Users',
      value: stats?.totalUsers || 0,
      icon: Users,
      trend: '+12%',
      trendUp: true,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: isRTL ? 'الدورات النشطة' : 'Active Courses',
      value: stats?.totalCourses || 0,
      icon: BookOpen,
      trend: '+3',
      trendUp: true,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: isRTL ? 'التسجيلات' : 'Enrollments',
      value: stats?.totalEnrollments || 0,
      icon: GraduationCap,
      trend: '+28%',
      trendUp: true,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: isRTL ? 'الإيرادات الشهرية' : 'Monthly Revenue',
      value: `${isRTL ? 'ر.س' : 'SAR'} 24,500`,
      icon: DollarSign,
      trend: '+18%',
      trendUp: true,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
  ];

  return (
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
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                    <div className={`flex items-center gap-1 mt-2 text-sm ${stat.trendUp ? 'text-green-500' : 'text-red-500'}`}>
                      {stat.trendUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span>{stat.trend}</span>
                    </div>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {isRTL ? 'الإيرادات الشهرية' : 'Monthly Revenue'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData}>
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
                    dataKey="revenue" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
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
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={coursePerformance} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="name" type="category" className="text-xs" width={80} />
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
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {enrollmentsByStatus.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm text-muted-foreground">{item.name}</span>
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
              {alerts.map((alert, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 p-3 rounded-lg ${
                    alert.type === 'warning' ? 'bg-amber-500/10' :
                    alert.type === 'error' ? 'bg-red-500/10' : 'bg-green-500/10'
                  }`}
                >
                  {alert.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />}
                  {alert.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
                  {alert.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />}
                  <p className="text-sm text-foreground">{alert.message}</p>
                </div>
              ))}
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
                <p className="text-xl font-bold text-foreground">78%</p>
              </div>
            </div>
            <Progress value={78} className="mt-3 h-2" />
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
                <p className="text-xl font-bold text-foreground">92%</p>
              </div>
            </div>
            <Progress value={92} className="mt-3 h-2" />
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
                <p className="text-xl font-bold text-foreground">45 {isRTL ? 'د' : 'min'}</p>
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
                <p className="text-xl font-bold text-foreground">156</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminHome;
