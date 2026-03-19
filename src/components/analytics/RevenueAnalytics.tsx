import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
} from '@/lib/recharts-compat';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  CreditCard,
  Minus,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { useRevenueAnalytics } from '@/hooks/useAnalyticsDashboard';

interface RevenueAnalyticsProps {
  dateRange: string;
}

const RevenueAnalytics: React.FC<RevenueAnalyticsProps> = ({ dateRange }) => {
  const { isRTL } = useLanguage();
  const { data, isLoading } = useRevenueAnalytics(dateRange);

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
    return amount.toLocaleString();
  };

  const VelocityIcon = data?.velocityDirection === 'up'
    ? TrendingUp
    : data?.velocityDirection === 'down'
    ? TrendingDown
    : Minus;

  const velocityColor = data?.velocityDirection === 'up'
    ? 'text-green-500'
    : data?.velocityDirection === 'down'
    ? 'text-red-500'
    : 'text-muted-foreground';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-6 h-6 text-primary" />
        <h2 className="text-xl font-bold">
          {isRTL ? 'تحليلات الإيرادات' : 'Revenue Analytics'}
        </h2>
      </div>

      {/* Key Revenue Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="col-span-2 md:col-span-1 bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-emerald-500" />
              <span className="text-xs text-muted-foreground">
                {isRTL ? 'إجمالي الإيرادات' : 'Total Revenue'}
              </span>
            </div>
            <p className="text-2xl font-bold text-emerald-500">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                `${formatCurrency(data?.totalRevenue || 0)} SAR`
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">ARPU</span>
            </div>
            <p className="text-xl font-bold">
              {isLoading ? <Skeleton className="h-7 w-16" /> : `${data?.arpu || 0}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {isRTL ? 'لكل مستخدم' : 'Per user'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">ARPPU</span>
            </div>
            <p className="text-xl font-bold">
              {isLoading ? <Skeleton className="h-7 w-16" /> : `${data?.arppu || 0}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {isRTL ? 'لكل مستخدم مدفوع' : 'Per paying user'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground">
                {isRTL ? 'المستخدمون المدفوعون' : 'Paying Users'}
              </span>
            </div>
            <p className="text-xl font-bold text-green-500">
              {isLoading ? <Skeleton className="h-7 w-12" /> : data?.payingUsers || 0}
            </p>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${
          data?.velocityDirection === 'up' ? 'from-green-500/10' :
          data?.velocityDirection === 'down' ? 'from-red-500/10' :
          'from-muted/30'
        } to-transparent`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <VelocityIcon className={`w-4 h-4 ${velocityColor}`} />
              <span className="text-xs text-muted-foreground">
                {isRTL ? 'سرعة الإيرادات' : 'Revenue Velocity'}
              </span>
            </div>
            <p className={`text-xl font-bold ${velocityColor}`}>
              {isLoading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <>
                  {data?.velocity && data.velocity > 0 ? '+' : ''}
                  {formatCurrency(data?.velocity || 0)}
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {isRTL ? 'تغير 3 أشهر' : '3-month change'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              {isRTL ? 'اتجاه الإيرادات الشهري' : 'Monthly Revenue Trend'}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'آخر 12 شهر' : 'Last 12 months'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={256}>
                <AreaChart data={data?.monthlyTrend || []}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" reversed={isRTL} />
                  <YAxis className="text-xs" tickFormatter={(v) => formatCurrency(v)} orientation={isRTL ? 'right' : 'left'} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value.toLocaleString()} SAR`, isRTL ? 'الإيرادات' : 'Revenue']}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    fill="url(#colorRevenue)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Course */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              {isRTL ? 'الإيرادات حسب الدورة' : 'Revenue by Course'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : (
              <ScrollArea className="h-[256px]">
                <div className="space-y-2">
                  {(data?.revenueByCourse || []).slice(0, 8).map((course, idx) => (
                    <div
                      key={course.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50"
                    >
                      <span className="text-lg font-bold text-muted-foreground w-6">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {isRTL ? course.title_ar || course.title : course.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {course.transactions} {isRTL ? 'معاملة' : 'transactions'}
                        </p>
                      </div>
                      <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-500">
                        {formatCurrency(course.revenue)} SAR
                      </Badge>
                    </div>
                  ))}
                  {(!data?.revenueByCourse || data.revenueByCourse.length === 0) && (
                    <p className="text-center text-muted-foreground py-4">
                      {isRTL ? 'لا توجد إيرادات بعد' : 'No revenue yet'}
                    </p>
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* LTV by Cohort */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">
            {isRTL ? 'القيمة الدائمة حسب الفوج' : 'LTV by Cohort'}
          </CardTitle>
          <CardDescription>
            {isRTL ? 'القيمة الدائمة للمستخدم حسب شهر التسجيل' : 'User lifetime value by signup month'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : data?.cohortLTV && data.cohortLTV.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.cohortLTV.slice(-12)}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="cohort" className="text-xs" reversed={isRTL} />
                <YAxis className="text-xs" orientation={isRTL ? 'right' : 'left'} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number, name: string) => [
                    `${value} SAR`,
                    name === 'ltv' ? (isRTL ? 'القيمة الدائمة' : 'LTV') : name
                  ]}
                />
                <Bar dataKey="ltv" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              {isRTL ? 'لا توجد بيانات فوج بعد' : 'No cohort data yet'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refunds & Disputes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-red-500/5 to-transparent border-red-500/10">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-red-500/10 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {isRTL ? 'المبالغ المستردة' : 'Refunds'}
              </p>
              <p className="text-2xl font-bold">{data?.refunds || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/5 to-transparent border-orange-500/10">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-orange-500/10 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {isRTL ? 'النزاعات' : 'Disputes'}
              </p>
              <p className="text-2xl font-bold">{data?.disputes || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RevenueAnalytics;
