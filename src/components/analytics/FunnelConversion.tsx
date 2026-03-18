import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from '@/lib/recharts-compat';
import {
  GitBranch,
  TrendingDown,
  TrendingUp,
  ArrowDown,
  Users,
  CheckCircle,
  CreditCard,
  Play,
} from 'lucide-react';
import { useFunnelAnalytics } from '@/hooks/useAnalyticsDashboard';

interface FunnelConversionProps {
  dateRange: string;
}

const FUNNEL_COLORS = ['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4'];

const FunnelConversion: React.FC<FunnelConversionProps> = ({ dateRange }) => {
  const { isRTL } = useLanguage();
  const { data, isLoading } = useFunnelAnalytics(dateRange);

  const stepIcons: Record<string, React.ReactNode> = {
    'Signups': <Users className="w-5 h-5" />,
    'First Lesson': <Play className="w-5 h-5" />,
    'Second Lesson': <CheckCircle className="w-5 h-5" />,
    'Paid': <CreditCard className="w-5 h-5" />,
    'Active (7d)': <TrendingUp className="w-5 h-5" />,
  };

  const stepLabelsAr: Record<string, string> = {
    'Signups': 'التسجيلات',
    'First Lesson': 'الدرس الأول',
    'Second Lesson': 'الدرس الثاني',
    'Paid': 'مدفوع',
    'Active (7d)': 'نشط (7 أيام)',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <GitBranch className="w-6 h-6 text-primary" />
        <h2 className="text-xl font-bold">
          {isRTL ? 'ذكاء القمع والتحويل' : 'Funnel & Conversion Intelligence'}
        </h2>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <span className="text-sm text-muted-foreground">
                {isRTL ? 'معدل التنشيط' : 'Activation Rate'}
              </span>
            </div>
            <p className="text-3xl font-bold text-green-500">
              {isLoading ? <Skeleton className="h-9 w-20" /> : `${data?.activationRate || 0}%`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isRTL ? 'تسجيل → الدرس الأول' : 'Signup → First Lesson'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-muted-foreground">
                {isRTL ? 'معدل التحويل' : 'Conversion Rate'}
              </span>
            </div>
            <p className="text-3xl font-bold text-blue-500">
              {isLoading ? <Skeleton className="h-9 w-20" /> : `${data?.conversionRate || 0}%`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isRTL ? 'تسجيل → مدفوع' : 'Signup → Paid'}
            </p>
          </CardContent>
        </Card>

        <Card className="col-span-2 md:col-span-1 bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-purple-500" />
              <span className="text-sm text-muted-foreground">
                {isRTL ? 'المستخدمون المدفوعون' : 'Paying Users'}
              </span>
            </div>
            <p className="text-3xl font-bold text-purple-500">
              {isLoading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                data?.funnelSteps?.find(s => s.step === 'Paid')?.count || 0
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funnel Visualization */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              {isRTL ? 'قمع التحويل' : 'Conversion Funnel'}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'تتبع كل خطوة في رحلة المستخدم' : 'Track every step in the user journey'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : (
              <div className="space-y-3">
                {(data?.funnelSteps || []).map((step, idx) => {
                  const width = step.rate;
                  const color = FUNNEL_COLORS[idx % FUNNEL_COLORS.length];
                  return (
                    <div key={step.step} className="relative">
                      <div className="flex items-center gap-3">
                        <div
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: `${color}20` }}
                        >
                          <span style={{ color }}>{stepIcons[step.step]}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">
                              {isRTL ? stepLabelsAr[step.step] || step.step : step.step}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">{step.count.toLocaleString()}</span>
                              <Badge
                                variant="secondary"
                                className="text-xs"
                                style={{ backgroundColor: `${color}20`, color }}
                              >
                                {step.rate}%
                              </Badge>
                            </div>
                          </div>
                          <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${width}%`,
                                backgroundColor: color,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Drop-off Analysis */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-500" />
              {isRTL ? 'تحليل التسرب' : 'Drop-off Analysis'}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'أين يغادر المستخدمون؟' : 'Where are users leaving?'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : (
              <div className="space-y-4">
                {(data?.dropRates || []).map((drop, idx) => (
                  <div key={idx} className="p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {isRTL ? stepLabelsAr[drop.from] || drop.from : drop.from}
                        </span>
                        <ArrowDown className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">
                          {isRTL ? stepLabelsAr[drop.to] || drop.to : drop.to}
                        </span>
                      </div>
                      <span
                        className={`text-lg font-bold ${
                          drop.dropRate > 50
                            ? 'text-red-500'
                            : drop.dropRate > 25
                            ? 'text-orange-500'
                            : 'text-yellow-500'
                        }`}
                      >
                        -{drop.dropRate}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          drop.dropRate > 50
                            ? 'bg-red-500'
                            : drop.dropRate > 25
                            ? 'bg-orange-500'
                            : 'bg-yellow-500'
                        }`}
                        style={{ width: `${drop.dropRate}%` }}
                      />
                    </div>
                  </div>
                ))}
                {(!data?.dropRates || data.dropRates.length === 0) && (
                  <p className="text-center text-muted-foreground py-4">
                    {isRTL ? 'لا توجد بيانات كافية' : 'Not enough data'}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Funnel Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">
            {isRTL ? 'رسم بياني للقمع' : 'Funnel Chart'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={data?.funnelSteps || []}
                layout="horizontal"
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="step"
                  className="text-xs"
                  tickFormatter={(value) => (isRTL ? stepLabelsAr[value] || value : value)}
                  reversed={isRTL}
                />
                <YAxis className="text-xs" orientation={isRTL ? 'right' : 'left'} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {(data?.funnelSteps || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FunnelConversion;
