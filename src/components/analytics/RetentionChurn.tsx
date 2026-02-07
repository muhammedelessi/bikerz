import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  AlertTriangle,
  UserMinus,
  Clock,
  Flame,
  Shield,
  Users,
  TrendingDown,
  CalendarX,
} from 'lucide-react';
import { useRetentionAnalytics } from '@/hooks/useAnalyticsDashboard';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

interface RetentionChurnProps {
  dateRange: string;
}

const RetentionChurn: React.FC<RetentionChurnProps> = ({ dateRange }) => {
  const { isRTL } = useLanguage();
  const { data, isLoading } = useRetentionAnalytics(dateRange);

  const getChurnRiskColor = (score: number) => {
    if (score >= 80) return 'text-red-500 bg-red-500/20';
    if (score >= 60) return 'text-orange-500 bg-orange-500/20';
    return 'text-yellow-500 bg-yellow-500/20';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-6 h-6 text-primary" />
        <h2 className="text-xl font-bold">
          {isRTL ? 'الاحتفاظ والتنبؤ بالمغادرة' : 'Retention, Churn & Prediction'}
        </h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">
                {isRTL ? 'المستخدمون المتتبعون' : 'Tracked Users'}
              </span>
            </div>
            <p className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-16" /> : data?.totalTrackedUsers || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground">
                {isRTL ? 'نشطون (7 أيام)' : 'Active (7d)'}
              </span>
            </div>
            <p className="text-2xl font-bold text-green-500">
              {isLoading ? <Skeleton className="h-8 w-16" /> : data?.activeUsersLast7Days || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-transparent border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <UserMinus className="w-4 h-4 text-red-500" />
              <span className="text-xs text-muted-foreground">
                {isRTL ? 'متوقع مغادرتهم' : 'Predicted Churn'}
              </span>
            </div>
            <p className="text-2xl font-bold text-red-500">
              {isLoading ? <Skeleton className="h-8 w-16" /> : data?.predictedChurnCount || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-transparent border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">
                {isRTL ? 'معرضون للخطر' : 'At Risk'}
              </span>
            </div>
            <p className="text-2xl font-bold text-orange-500">
              {isLoading ? <Skeleton className="h-8 w-16" /> : data?.atRiskUsers?.length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Inactivity Windows */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarX className="w-5 h-5 text-orange-500" />
              {isRTL ? 'نوافذ عدم النشاط' : 'Inactivity Windows'}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'توزيع المستخدمين حسب فترة عدم النشاط' : 'Users by inactivity period'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data?.inactiveWindows || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" className="text-xs" />
                  <YAxis className="text-xs" />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {(data?.inactiveWindows || []).map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          index === 0
                            ? '#22c55e'
                            : index === 1
                            ? '#f59e0b'
                            : index === 2
                            ? '#ef4444'
                            : '#7f1d1d'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Streak Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              {isRTL ? 'توزيع السلاسل' : 'Streak Distribution'}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'المستخدمون حسب طول السلسلة' : 'Users by streak length'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie
                      data={data?.streakDistribution || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="count"
                    >
                      {(data?.streakDistribution || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {(data?.streakDistribution || []).map((item, idx) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <span className="text-sm flex-1">{item.label}</span>
                      <span className="text-sm font-medium">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* At-Risk Users Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-500" />
            {isRTL ? 'المستخدمون المعرضون للخطر' : 'At-Risk Users'}
          </CardTitle>
          <CardDescription>
            {isRTL ? 'المستخدمون الذين من المحتمل أن يغادروا قريباً' : 'Users likely to churn soon'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {(data?.atRiskUsers || []).map((user, idx) => (
                  <div
                    key={user.userId}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium font-mono truncate">
                        {user.userId.slice(0, 8)}...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isRTL ? 'آخر نشاط:' : 'Last activity:'}{' '}
                        {user.lastActivity
                          ? formatDistanceToNow(user.lastActivity, {
                              addSuffix: true,
                              locale: isRTL ? ar : enUS,
                            })
                          : isRTL ? 'غير معروف' : 'Unknown'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">
                          {isRTL ? 'التفاعل' : 'Engagement'}
                        </p>
                        <p className="text-sm font-medium">{user.engagementScore}%</p>
                      </div>
                      <Badge className={getChurnRiskColor(user.churnRisk)}>
                        {Math.round(user.churnRisk)}% {isRTL ? 'خطر' : 'risk'}
                      </Badge>
                    </div>
                  </div>
                ))}
                {(!data?.atRiskUsers || data.atRiskUsers.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>{isRTL ? 'لا يوجد مستخدمون معرضون للخطر!' : 'No at-risk users!'}</p>
                    <p className="text-sm">
                      {isRTL ? 'جميع المستخدمين بحالة جيدة' : 'All users are healthy'}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RetentionChurn;
