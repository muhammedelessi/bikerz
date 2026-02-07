import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Gauge,
  Zap,
  AlertTriangle,
  Clock,
  Wifi,
  Server,
  Activity,
  CheckCircle,
  XCircle,
  Info,
} from 'lucide-react';
import { useInfrastructureMetrics } from '@/hooks/useAnalyticsDashboard';

interface InfrastructureMetricsProps {
  dateRange: string;
}

const InfrastructureMetrics: React.FC<InfrastructureMetricsProps> = ({ dateRange }) => {
  const { isRTL } = useLanguage();
  const { data, isLoading } = useInfrastructureMetrics(dateRange);

  const getHealthStatus = () => {
    if (!data) return { status: 'unknown', color: 'text-muted-foreground', bg: 'bg-muted' };
    
    if (data.errorRate > 5 || data.bufferingRatio > 5) {
      return { status: isRTL ? 'حرج' : 'Critical', color: 'text-red-500', bg: 'bg-red-500' };
    }
    if (data.errorRate > 2 || data.bufferingRatio > 2) {
      return { status: isRTL ? 'تحذير' : 'Warning', color: 'text-yellow-500', bg: 'bg-yellow-500' };
    }
    return { status: isRTL ? 'صحي' : 'Healthy', color: 'text-green-500', bg: 'bg-green-500' };
  };

  const health = getHealthStatus();

  const getMetricStatus = (value: number, warningThreshold: number, criticalThreshold: number) => {
    if (value >= criticalThreshold) return { icon: XCircle, color: 'text-red-500' };
    if (value >= warningThreshold) return { icon: AlertTriangle, color: 'text-yellow-500' };
    return { icon: CheckCircle, color: 'text-green-500' };
  };

  const bufferingStatus = getMetricStatus(data?.bufferingRatio || 0, 2, 5);
  const errorStatus = getMetricStatus(data?.errorRate || 0, 2, 5);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Server className="w-6 h-6 text-primary" />
        <h2 className="text-xl font-bold">
          {isRTL ? 'مقاييس البنية التحتية' : 'Infrastructure & Performance Metrics'}
        </h2>
      </div>

      {/* Health Status */}
      <Card className={`bg-gradient-to-r ${
        health.color === 'text-green-500' ? 'from-green-500/10' :
        health.color === 'text-yellow-500' ? 'from-yellow-500/10' :
        health.color === 'text-red-500' ? 'from-red-500/10' :
        'from-muted/10'
      } to-transparent`}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-2xl ${health.bg}/20`}>
              <Activity className={`w-10 h-10 ${health.color}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold">
                  {isRTL ? 'حالة النظام' : 'System Health'}
                </h3>
                <Badge className={`${health.bg}/20 ${health.color}`}>
                  {health.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {isRTL
                  ? 'مراقبة مستمرة لأداء البنية التحتية'
                  : 'Continuous monitoring of infrastructure performance'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <span className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${health.bg} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${health.bg}`}></span>
              </span>
              <span className="text-xs text-muted-foreground ms-1">
                {isRTL ? 'مباشر' : 'Live'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <TooltipProvider>
          {/* Buffering Ratio */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">
                    {isRTL ? 'نسبة التخزين المؤقت' : 'Buffering Ratio'}
                  </span>
                </div>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm max-w-xs">
                      {isRTL
                        ? 'نسبة وقت التخزين المؤقت إلى إجمالي وقت المشاهدة. أقل = أفضل'
                        : 'Ratio of buffering time to total watch time. Lower is better.'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <p className={`text-2xl font-bold ${bufferingStatus.color}`}>
                  {isLoading ? <Skeleton className="h-8 w-16" /> : `${data?.bufferingRatio || 0}%`}
                </p>
                <bufferingStatus.icon className={`w-5 h-5 ${bufferingStatus.color}`} />
              </div>
            </CardContent>
          </Card>

          {/* Error Rate */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-muted-foreground">
                    {isRTL ? 'معدل الأخطاء' : 'Error Rate'}
                  </span>
                </div>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm max-w-xs">
                      {isRTL
                        ? 'نسبة الجلسات التي واجهت أخطاء'
                        : 'Percentage of sessions that encountered errors.'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <p className={`text-2xl font-bold ${errorStatus.color}`}>
                  {isLoading ? <Skeleton className="h-8 w-16" /> : `${data?.errorRate || 0}%`}
                </p>
                <errorStatus.icon className={`w-5 h-5 ${errorStatus.color}`} />
              </div>
            </CardContent>
          </Card>

          {/* Total Errors */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-xs text-muted-foreground">
                  {isRTL ? 'إجمالي الأخطاء' : 'Total Errors'}
                </span>
              </div>
              <p className="text-2xl font-bold">
                {isLoading ? <Skeleton className="h-8 w-12" /> : data?.totalErrors || 0}
              </p>
            </CardContent>
          </Card>

          {/* Avg Buffering Per Session */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">
                  {isRTL ? 'تخزين مؤقت/جلسة' : 'Buffering/Session'}
                </span>
              </div>
              <p className="text-2xl font-bold">
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  `${data?.avgBufferingPerSession || 0}`
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {isRTL ? 'أحداث' : 'events'}
              </p>
            </CardContent>
          </Card>
        </TooltipProvider>
      </div>

      {/* Video Start Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              {isRTL ? 'وقت بدء الفيديو' : 'Video Start Time'}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'الوقت لبدء التشغيل (النسب المئوية)' : 'Time to start playback (percentiles)'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div>
                <span className="text-sm font-medium">P95</span>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? '95% من المستخدمين' : '95% of users'}
                </p>
              </div>
              <p className="text-2xl font-bold">
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  `${data?.videoStartTimeP95 || 0}ms`
                )}
              </p>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div>
                <span className="text-sm font-medium">P99</span>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? '99% من المستخدمين' : '99% of users'}
                </p>
              </div>
              <p className="text-2xl font-bold">
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  `${data?.videoStartTimeP99 || 0}ms`
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Gauge className="w-5 h-5 text-blue-500" />
              {isRTL ? 'ملخص الأداء' : 'Performance Summary'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span>{isRTL ? 'صحة التخزين المؤقت' : 'Buffering Health'}</span>
                <span className={bufferingStatus.color}>
                  {Math.max(0, 100 - (data?.bufferingRatio || 0) * 10).toFixed(0)}%
                </span>
              </div>
              <Progress
                value={Math.max(0, 100 - (data?.bufferingRatio || 0) * 10)}
                className="h-2"
              />
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span>{isRTL ? 'معدل النجاح' : 'Success Rate'}</span>
                <span className={errorStatus.color}>
                  {(100 - (data?.errorRate || 0)).toFixed(1)}%
                </span>
              </div>
              <Progress
                value={100 - (data?.errorRate || 0)}
                className="h-2"
              />
            </div>
            <div className="pt-2 border-t border-border">
              <p className="text-sm text-muted-foreground">
                {isRTL
                  ? 'تتم مراقبة هذه المقاييس باستمرار. القيم المنخفضة = أداء أفضل.'
                  : 'These metrics are continuously monitored. Lower values = better performance.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InfrastructureMetrics;
