import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Users,
  BookOpen,
  DollarSign,
  GraduationCap,
  Download,
  Calendar,
  Target,
  Award,
} from 'lucide-react';

const AdminAnalytics = () => {
  const { isRTL } = useLanguage();
  const [dateRange, setDateRange] = useState('30d');

  // Fetch analytics data
  const { data: analyticsData } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: async () => {
      const [usersRes, coursesRes, enrollmentsRes, paymentsRes] = await Promise.all([
        supabase.from('profiles').select('created_at', { count: 'exact' }),
        supabase.from('courses').select('id, title, is_published'),
        supabase.from('course_enrollments').select('*'),
        supabase.from('manual_payments').select('*').eq('status', 'approved'),
      ]);

      return {
        totalUsers: usersRes.count || 0,
        totalCourses: coursesRes.data?.length || 0,
        publishedCourses: coursesRes.data?.filter(c => c.is_published).length || 0,
        totalEnrollments: enrollmentsRes.data?.length || 0,
        totalRevenue: paymentsRes.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
        completedEnrollments: enrollmentsRes.data?.filter(e => e.completed_at).length || 0,
      };
    },
  });

  // Sample chart data (in production, this would come from the API)
  const revenueData = [
    { month: 'Jan', revenue: 4000, enrollments: 24 },
    { month: 'Feb', revenue: 3000, enrollments: 18 },
    { month: 'Mar', revenue: 5000, enrollments: 32 },
    { month: 'Apr', revenue: 4500, enrollments: 28 },
    { month: 'May', revenue: 6000, enrollments: 40 },
    { month: 'Jun', revenue: 5500, enrollments: 35 },
  ];

  const coursePerformance = [
    { name: 'Beginner Basics', completion: 85, students: 150 },
    { name: 'Safety Training', completion: 72, students: 120 },
    { name: 'Advanced Riding', completion: 65, students: 80 },
    { name: 'Road Rules', completion: 90, students: 200 },
  ];

  const userGrowth = [
    { week: 'Week 1', users: 120 },
    { week: 'Week 2', users: 150 },
    { week: 'Week 3', users: 180 },
    { week: 'Week 4', users: 220 },
  ];

  const pieData = [
    { name: 'Completed', value: analyticsData?.completedEnrollments || 0, color: '#22c55e' },
    { name: 'In Progress', value: (analyticsData?.totalEnrollments || 0) - (analyticsData?.completedEnrollments || 0), color: '#3b82f6' },
  ];

  const kpiCards = [
    {
      titleEn: 'Total Revenue',
      titleAr: 'إجمالي الإيرادات',
      value: `${analyticsData?.totalRevenue?.toLocaleString() || 0} SAR`,
      change: '+12.5%',
      trend: 'up',
      icon: DollarSign,
    },
    {
      titleEn: 'Total Users',
      titleAr: 'إجمالي المستخدمين',
      value: analyticsData?.totalUsers?.toLocaleString() || 0,
      change: '+8.2%',
      trend: 'up',
      icon: Users,
    },
    {
      titleEn: 'Course Enrollments',
      titleAr: 'تسجيلات الدورات',
      value: analyticsData?.totalEnrollments?.toLocaleString() || 0,
      change: '+15.3%',
      trend: 'up',
      icon: BookOpen,
    },
    {
      titleEn: 'Completion Rate',
      titleAr: 'معدل الإكمال',
      value: analyticsData?.totalEnrollments 
        ? `${((analyticsData.completedEnrollments / analyticsData.totalEnrollments) * 100).toFixed(1)}%`
        : '0%',
      change: '+5.1%',
      trend: 'up',
      icon: GraduationCap,
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isRTL ? 'التحليلات والتقارير' : 'Analytics & Reports'}
            </h1>
            <p className="text-muted-foreground">
              {isRTL ? 'تتبع أداء الأكاديمية والمقاييس' : 'Track academy performance and metrics'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[150px]">
                <Calendar className="w-4 h-4 me-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">{isRTL ? 'آخر 7 أيام' : 'Last 7 days'}</SelectItem>
                <SelectItem value="30d">{isRTL ? 'آخر 30 يوم' : 'Last 30 days'}</SelectItem>
                <SelectItem value="90d">{isRTL ? 'آخر 90 يوم' : 'Last 90 days'}</SelectItem>
                <SelectItem value="1y">{isRTL ? 'السنة الماضية' : 'Last year'}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="w-4 h-4 me-2" />
              {isRTL ? 'تصدير' : 'Export'}
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((kpi, index) => {
            const Icon = kpi.icon;
            const TrendIcon = kpi.trend === 'up' ? TrendingUp : TrendingDown;
            return (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                    <div className={`flex items-center text-sm ${kpi.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                      <TrendIcon className="w-4 h-4 me-1" />
                      {kpi.change}
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? kpi.titleAr : kpi.titleEn}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle>{isRTL ? 'الإيرادات والتسجيلات' : 'Revenue & Enrollments'}</CardTitle>
              <CardDescription>
                {isRTL ? 'تتبع الإيرادات الشهرية والتسجيلات' : 'Monthly revenue and enrollment tracking'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    fill="url(#colorRevenue)"
                    name={isRTL ? 'الإيرادات' : 'Revenue'}
                  />
                  <Line
                    type="monotone"
                    dataKey="enrollments"
                    stroke="hsl(var(--chart-2))"
                    name={isRTL ? 'التسجيلات' : 'Enrollments'}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* User Growth Chart */}
          <Card>
            <CardHeader>
              <CardTitle>{isRTL ? 'نمو المستخدمين' : 'User Growth'}</CardTitle>
              <CardDescription>
                {isRTL ? 'تسجيلات المستخدمين الجدد أسبوعياً' : 'Weekly new user registrations'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={userGrowth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar
                    dataKey="users"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    name={isRTL ? 'المستخدمين' : 'Users'}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Course Performance */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{isRTL ? 'أداء الدورات' : 'Course Performance'}</CardTitle>
              <CardDescription>
                {isRTL ? 'معدلات إكمال الدورات وعدد الطلاب' : 'Course completion rates and student count'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={coursePerformance} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" domain={[0, 100]} className="text-xs" />
                  <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar
                    dataKey="completion"
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                    name={isRTL ? 'نسبة الإكمال' : 'Completion %'}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Enrollment Status Pie */}
          <Card>
            <CardHeader>
              <CardTitle>{isRTL ? 'حالة التسجيلات' : 'Enrollment Status'}</CardTitle>
              <CardDescription>
                {isRTL ? 'توزيع حالات التسجيل' : 'Distribution of enrollment status'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-full">
                <Target className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'الدورات النشطة' : 'Active Courses'}
                </p>
                <p className="text-xl font-bold">{analyticsData?.publishedCourses || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-full">
                <Award className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'الشهادات الصادرة' : 'Certificates Issued'}
                </p>
                <p className="text-xl font-bold">{analyticsData?.completedEnrollments || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-full">
                <Users className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'المستخدمين النشطين' : 'Active Users'}
                </p>
                <p className="text-xl font-bold">{Math.round((analyticsData?.totalUsers || 0) * 0.65)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-orange-500/10 rounded-full">
                <TrendingUp className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'متوسط الإيراد/المستخدم' : 'Avg Revenue/User'}
                </p>
                <p className="text-xl font-bold">
                  {analyticsData?.totalUsers 
                    ? `${Math.round((analyticsData.totalRevenue || 0) / analyticsData.totalUsers)} SAR`
                    : '0 SAR'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAnalytics;
