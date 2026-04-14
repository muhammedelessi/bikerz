import React, { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminHome } from '@/hooks/admin/useAdminHome';
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
  Dumbbell,
  UserCheck,
  Star,
} from 'lucide-react';
const AdminHomeCharts = lazy(() => import('@/components/admin/AdminHomeCharts'));

const AdminHome: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { stats, statsLoading, coursePerformance, monthlyData, alerts, enrollmentsByStatus } = useAdminHome({ isRTL, t });

  const statCards = [
    {
      title: t('admin.dashboard.totalUsers'),
      value: stats?.totalUsers || 0,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: t('admin.dashboard.activeCourses'),
      value: stats?.totalCourses || 0,
      icon: BookOpen,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: t('admin.dashboard.enrollments'),
      value: stats?.totalEnrollments || 0,
      icon: GraduationCap,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: isRTL ? 'إجمالي الإيرادات' : t('admin.dashboard.totalRevenue'),
      value: `${t('common.currency_sar')} ${stats?.totalRevenue?.toLocaleString() || 0}`,
      icon: DollarSign,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: isRTL ? 'المدربون' : 'Trainers',
      value: stats?.totalTrainers || 0,
      icon: UserCheck,
      color: 'text-teal-500',
      bgColor: 'bg-teal-500/10',
    },
    {
      title: isRTL ? 'التدريبات' : 'Trainings',
      value: stats?.totalTrainings || 0,
      icon: Dumbbell,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
    },
    {
      title: isRTL ? 'طلاب التدريب' : 'Training Students',
      value: stats?.totalTrainingStudents || 0,
      icon: GraduationCap,
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/10',
    },
    {
      title: isRTL ? 'متوسط التقييم' : 'Avg Rating',
      value: stats?.avgTrainerRating || '0',
      icon: Star,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('admin.dashboard.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('admin.dashboard.subtitle')}
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

        <Suspense fallback={<div className="h-[400px] animate-pulse bg-muted rounded-md" />}>
          <AdminHomeCharts
            monthlyData={monthlyData}
            coursePerformance={coursePerformance}
            enrollmentsByStatus={enrollmentsByStatus}
            isRTL={isRTL}
            t={t}
          />
        </Suspense>

        {/* Alerts */}
        <div className="grid grid-cols-1 gap-6">

          {/* Alerts & Notifications */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                 <Activity className="w-5 h-5" />
                {t('admin.dashboard.alertsAndNotifications')}
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
                      {t('admin.dashboard.noAlerts')}
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
                    {t('admin.dashboard.completionRate')}
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
                    {t('admin.dashboard.passRate')}
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
                    {t('admin.dashboard.avgWatchTime')}
                  </p>
                   <p className="text-xl font-bold text-foreground">
                    {stats?.avgWatchTimeMinutes || 0} {t('admin.dashboard.minutes')}
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
                    {t('admin.dashboard.activeUsers')}
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
