import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  Users,
  Smartphone,
  Monitor,
  Tablet,
  AlertTriangle,
  Flame,
  Info,
  Brain,
} from 'lucide-react';
import { useUserIntelligence } from '@/hooks/useAnalyticsDashboard';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

interface UserIntelligenceProps {
  dateRange: string;
}

const UserIntelligence: React.FC<UserIntelligenceProps> = ({ dateRange }) => {
  const { isRTL } = useLanguage();
  const { data, isLoading } = useUserIntelligence(dateRange);

  const deviceIcon = (device: string) => {
    switch (device.toLowerCase()) {
      case 'mobile': return <Smartphone className="w-4 h-4" />;
      case 'tablet': return <Tablet className="w-4 h-4" />;
      default: return <Monitor className="w-4 h-4" />;
    }
  };

  const expLevelData = data?.experienceLevelDistribution
    ? Object.entries(data.experienceLevelDistribution).map(([name, value], idx) => ({
        name,
        value,
        color: COLORS[idx % COLORS.length],
      }))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-6 h-6 text-primary" />
        <h2 className="text-xl font-bold">
          {isRTL ? 'ذكاء المستخدم' : 'User Intelligence'}
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Engagement Score Distribution */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">
                {isRTL ? 'توزيع نقاط التفاعل' : 'Engagement Score Distribution'}
              </CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">
                      {isRTL
                        ? 'النتيجة المحسوبة من: اتساق المشاهدة، معدل إكمال الدروس، تكرار العودة، استرداد التوقف، استقرار السرعة'
                        : 'Score calculated from: watch consistency, lesson completion rate, return frequency, drop-off recovery, speed stability'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <CardDescription>
              {isRTL ? 'النسب المئوية للتفاعل' : 'Engagement percentiles'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-5 gap-2 text-center">
                  {['P25', 'P50', 'P75', 'P90', 'AVG'].map((label, idx) => {
                    const values = [
                      data?.engagementScores.p25,
                      data?.engagementScores.p50,
                      data?.engagementScores.p75,
                      data?.engagementScores.p90,
                      data?.engagementScores.avg,
                    ];
                    const colors = [
                      'text-red-500',
                      'text-orange-500',
                      'text-yellow-500',
                      'text-green-500',
                      'text-blue-500',
                    ];
                    return (
                      <div key={label} className="p-3 bg-muted/30 rounded-lg">
                        <p className={`text-2xl font-bold ${colors[idx]}`}>{values[idx]}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{isRTL ? 'منخفض' : 'Low'}</span>
                    <span>{isRTL ? 'مرتفع' : 'High'}</span>
                  </div>
                  <div className="h-4 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full relative">
                    <div
                      className="absolute top-0 w-1 h-full bg-white rounded-full shadow-lg"
                      style={{ left: `${data?.engagementScores.avg || 0}%` }}
                    />
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    {isRTL ? 'متوسط النقاط' : 'Average Score'}: {data?.engagementScores.avg}%
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Risk Indicators */}
        <Card className="bg-gradient-to-br from-red-500/10 to-transparent border-red-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              {isRTL ? 'مؤشرات المخاطر' : 'Risk Indicators'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg">
              <div>
                <p className="font-medium">{isRTL ? 'معرضون للمغادرة' : 'Churn Risk'}</p>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? 'مخاطر عالية للمغادرة' : 'High churn risk users'}
                </p>
              </div>
              <p className="text-3xl font-bold text-red-500">{data?.churnRiskUsers || 0}</p>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="font-medium">{isRTL ? 'سلاسل نشطة' : 'Active Streaks'}</p>
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? 'مستخدمون بسلاسل نشطة' : 'Users with active streaks'}
                  </p>
                </div>
              </div>
              <p className="text-3xl font-bold text-green-500">{data?.activeStreaks || 0}</p>
            </div>
            <div className="text-center pt-2 border-t border-border/50">
              <p className="text-sm text-muted-foreground">
                {isRTL ? 'إجمالي الجلسات' : 'Total Sessions'}
              </p>
              <p className="text-2xl font-bold">{data?.totalSessions?.toLocaleString() || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Session Duration by Device */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              {isRTL ? 'مدة الجلسة حسب الجهاز' : 'Session Duration by Device'}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'متوسط مدة الجلسة بالدقائق' : 'Average session duration in minutes'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : data?.avgSessionByDevice && data.avgSessionByDevice.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.avgSessionByDevice}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="device" className="text-xs" />
                  <YAxis className="text-xs" />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar
                    dataKey="avgDuration"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    name={isRTL ? 'الدقائق' : 'Minutes'}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                {isRTL ? 'لا توجد بيانات جلسات بعد' : 'No session data yet'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Experience Level Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              {isRTL ? 'توزيع مستوى الخبرة' : 'Experience Level Distribution'}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'تصنيف المستخدمين حسب الخبرة' : 'Users by experience level'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : expLevelData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie
                      data={expLevelData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {expLevelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
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
                  {expLevelData.map((item, idx) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm flex-1 truncate">{item.name}</span>
                      <span className="text-sm font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                {isRTL ? 'لا توجد بيانات' : 'No data available'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserIntelligence;
