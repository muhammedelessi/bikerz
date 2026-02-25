import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  Eye,
  PlayCircle,
  Clock,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Zap,
  Activity,
} from 'lucide-react';
import { useSystemOverview } from '@/hooks/useAnalyticsDashboard';

const MetricCard = ({
  icon: Icon,
  label,
  labelAr,
  value,
  subValue,
  subLabel,
  subLabelAr,
  color,
  isLoading,
}: {
  icon: React.ElementType;
  label: string;
  labelAr: string;
  value: string | number;
  subValue?: string | number;
  subLabel?: string;
  subLabelAr?: string;
  color: string;
  isLoading?: boolean;
}) => {
  const { isRTL } = useLanguage();

  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="p-4">
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50 hover:border-primary/30 transition-all">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          {subValue !== undefined && (
            <div className="text-end">
              <span className="text-xs text-muted-foreground">
                {isRTL ? subLabelAr : subLabel}
              </span>
              <p className="text-sm font-medium">{subValue}</p>
            </div>
          )}
        </div>
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {isRTL ? labelAr : label}
        </p>
      </CardContent>
    </Card>
  );
};

interface SystemOverviewProps {
  dateRange: string;
}

const SystemOverview: React.FC<SystemOverviewProps> = ({ dateRange }) => {
  const { isRTL } = useLanguage();
  const { data, isLoading } = useSystemOverview(dateRange);

  const formatWatchTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    if (minutes < 43200) return `${Math.round(minutes / 1440)}d`;
    return `${(minutes / 525600).toFixed(1)}y`;
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M SAR`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K SAR`;
    return `${amount.toLocaleString()} SAR`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="w-6 h-6 text-primary" />
        <h2 className="text-xl font-bold">
          {isRTL ? 'نظرة عامة على النظام - الوقت الفعلي' : 'System Overview - Real-Time'}
        </h2>
        <div className="flex items-center gap-1 ms-auto">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-xs text-muted-foreground">
            {isRTL ? 'مباشر' : 'Live'}
          </span>
        </div>
      </div>

      {/* Primary Metrics - Large Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="col-span-2 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-primary/20 rounded-xl">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-4xl font-bold">
                  {isLoading ? <Skeleton className="h-10 w-24" /> : data?.totalUsers.toLocaleString()}
                </p>
                <p className="text-muted-foreground">
                  {isRTL ? 'إجمالي المستخدمين' : 'Total Users'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/50">
              <div className="text-center">
                <p className="text-lg font-semibold text-green-500">+{data?.users24h || 0}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? '24 ساعة' : '24h'}</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-blue-500">+{data?.users7d || 0}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? '7 أيام' : '7d'}</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-purple-500">+{data?.users30d || 0}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? '30 يوم' : '30d'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="p-6 h-full flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-green-500" />
              <span className="text-sm text-muted-foreground">
                {isRTL ? 'متصلون الآن' : 'Online Now'}
              </span>
            </div>
            <p className="text-4xl font-bold text-green-500 mt-2">
              {isLoading ? <Skeleton className="h-10 w-16" /> : data?.concurrentUsers}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
          <CardContent className="p-6 h-full flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-orange-500" />
              <span className="text-sm text-muted-foreground">
                {isRTL ? 'يشاهدون فيديو' : 'Watching Video'}
              </span>
            </div>
            <p className="text-4xl font-bold text-orange-500 mt-2">
              {isLoading ? <Skeleton className="h-10 w-16" /> : data?.videosWatchingNow}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          icon={Clock}
          label="Total Watch Time"
          labelAr="إجمالي وقت المشاهدة"
          value={formatWatchTime(data?.totalWatchTimeMinutes || 0)}
          color="bg-blue-500/20 text-blue-500"
          isLoading={isLoading}
        />
        <MetricCard
          icon={CheckCircle2}
          label="Lessons Completed"
          labelAr="الدروس المكتملة"
          value={data?.totalLessonsCompleted.toLocaleString() || 0}
          color="bg-green-500/20 text-green-500"
          isLoading={isLoading}
        />
        <MetricCard
          icon={DollarSign}
          label="Today's Revenue"
          labelAr="إيرادات اليوم"
          value={formatCurrency(data?.revenueToday || 0)}
          color="bg-emerald-500/20 text-emerald-500"
          isLoading={isLoading}
        />
        <MetricCard
          icon={DollarSign}
          label="Week's Revenue"
          labelAr="إيرادات الأسبوع"
          value={formatCurrency(data?.revenueWeek || 0)}
          color="bg-teal-500/20 text-teal-500"
          isLoading={isLoading}
        />
        <MetricCard
          icon={DollarSign}
          label="Lifetime Revenue"
          labelAr="الإيرادات الكلية"
          value={formatCurrency(data?.revenueLifetime || 0)}
          color="bg-yellow-500/20 text-yellow-500"
          isLoading={isLoading}
        />
        <MetricCard
          icon={TrendingUp}
          label="RPAU"
          labelAr="الإيراد لكل مستخدم"
          value={`${data?.rpau || 0} SAR`}
          subLabel="Revenue Per Active User"
          subLabelAr="الإيراد لكل مستخدم نشط"
          color="bg-purple-500/20 text-purple-500"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};

export default SystemOverview;
