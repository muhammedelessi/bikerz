import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from '@/lib/recharts-compat';
import {
  Video,
  TrendingUp,
  TrendingDown,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Info,
  AlertCircle,
} from 'lucide-react';
import { useVideoAnalytics } from '@/hooks/useAnalyticsDashboard';

interface VideoMicroAnalyticsProps {
  dateRange: string;
}

const VideoMicroAnalytics: React.FC<VideoMicroAnalyticsProps> = ({ dateRange }) => {
  const { isRTL } = useLanguage();
  const { data, isLoading } = useVideoAnalytics(dateRange);

  const getCompletionColor = (rate: number) => {
    if (rate >= 80) return 'text-green-500';
    if (rate >= 60) return 'text-yellow-500';
    if (rate >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Video className="w-6 h-6 text-primary" />
        <h2 className="text-xl font-bold">
          {isRTL ? 'تحليلات الفيديو والدروس' : 'Video & Lesson Micro-Analytics'}
        </h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-blue-500/10 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">
                {isRTL ? 'إجمالي وقت المشاهدة' : 'Total Watch Time'}
              </span>
            </div>
            <p className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-20" /> : `${(data?.totalWatchTimeMins || 0).toLocaleString()}m`}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground">
                {isRTL ? 'متوسط الإكمال' : 'Avg Completion'}
              </span>
            </div>
            <p className="text-2xl font-bold text-green-500">
              {isLoading ? <Skeleton className="h-8 w-16" /> : `${data?.avgCompletionRate || 0}%`}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">
                {isRTL ? 'وقت التخزين المؤقت' : 'Buffering Time'}
              </span>
            </div>
            <p className="text-2xl font-bold text-orange-500">
              {isLoading ? <Skeleton className="h-8 w-16" /> : `${data?.totalBufferingTimeSecs || 0}s`}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Video className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">
                {isRTL ? 'الدروس المتتبعة' : 'Lessons Tracked'}
              </span>
            </div>
            <p className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-12" /> : data?.lessonMetrics?.length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Best Performing Lessons */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              {isRTL ? 'الأفضل أداءً' : 'Best Performing'}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'أعلى معدلات إكمال' : 'Highest completion rates'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <ScrollArea className="h-[280px]">
                <div className="space-y-2">
                  {(data?.bestPerforming || []).map((lesson, idx) => (
                    <div
                      key={lesson.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-lg font-bold text-green-500 w-6">#{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {isRTL ? lesson.title_ar || lesson.title : lesson.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{lesson.totalViews} {isRTL ? 'مشاهدة' : 'views'}</span>
                          <span>•</span>
                          <span>{lesson.duration || 0}m</span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-green-500/20 text-green-500">
                        {lesson.completionRate}%
                      </Badge>
                    </div>
                  ))}
                  {(!data?.bestPerforming || data.bestPerforming.length === 0) && (
                    <p className="text-center text-muted-foreground py-4">
                      {isRTL ? 'لا توجد بيانات' : 'No data available'}
                    </p>
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Worst Performing Lessons */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-500" />
              {isRTL ? 'الأضعف أداءً' : 'Needs Improvement'}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'أدنى معدلات إكمال' : 'Lowest completion rates'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <ScrollArea className="h-[280px]">
                <div className="space-y-2">
                  {(data?.worstPerforming || []).map((lesson, idx) => (
                    <div
                      key={lesson.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-lg font-bold text-red-500 w-6">#{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {isRTL ? lesson.title_ar || lesson.title : lesson.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{lesson.totalViews} {isRTL ? 'مشاهدة' : 'views'}</span>
                          <span>•</span>
                          <span className="text-red-400">
                            {isRTL ? 'توقف عند' : 'Drop at'} {lesson.medianDropOffSecond}s
                          </span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-red-500/20 text-red-500">
                        {lesson.completionRate}%
                      </Badge>
                    </div>
                  ))}
                  {(!data?.worstPerforming || data.worstPerforming.length === 0) && (
                    <p className="text-center text-muted-foreground py-4">
                      {isRTL ? 'لا توجد بيانات' : 'No data available'}
                    </p>
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Most Rewatched */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-purple-500" />
              {isRTL ? 'الأكثر إعادة مشاهدة' : 'Most Rewatched'}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'أعلى معدلات الترجيع' : 'Highest rewind counts'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <ScrollArea className="h-[280px]">
                <div className="space-y-2">
                  {(data?.mostRewatched || []).map((lesson, idx) => (
                    <div
                      key={lesson.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-lg font-bold text-purple-500 w-6">#{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {isRTL ? lesson.title_ar || lesson.title : lesson.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <RotateCcw className="w-3 h-3" />
                          <span>{lesson.rewindCount} {isRTL ? 'إعادة' : 'rewinds'}</span>
                          <span>•</span>
                          <Pause className="w-3 h-3" />
                          <span>{lesson.pauseCount} {isRTL ? 'إيقاف' : 'pauses'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!data?.mostRewatched || data.mostRewatched.length === 0) && (
                    <p className="text-center text-muted-foreground py-4">
                      {isRTL ? 'لا توجد بيانات' : 'No data available'}
                    </p>
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All Lessons Performance Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">
            {isRTL ? 'أداء جميع الدروس' : 'All Lessons Performance'}
          </CardTitle>
          <CardDescription>
            {isRTL ? 'تحليل مفصل لكل درس' : 'Detailed analysis per lesson'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="text-start p-2">{isRTL ? 'الدرس' : 'Lesson'}</th>
                      <th className="text-center p-2">{isRTL ? 'المشاهدات' : 'Views'}</th>
                      <th className="text-center p-2">{isRTL ? 'الإكمال' : 'Completion'}</th>
                      <th className="text-center p-2">{isRTL ? 'متوسط %' : 'Avg %'}</th>
                      <th className="text-center p-2">{isRTL ? 'التوقف' : 'Drop-off'}</th>
                      <th className="text-center p-2">{isRTL ? 'التخزين' : 'Buffering'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(data?.lessonMetrics || []).map(lesson => (
                      <tr key={lesson.id} className="hover:bg-muted/30">
                        <td className="p-2">
                          <p className="font-medium truncate max-w-[200px]">
                            {isRTL ? lesson.title_ar || lesson.title : lesson.title}
                          </p>
                        </td>
                        <td className="text-center p-2">{lesson.totalViews}</td>
                        <td className="text-center p-2">
                          <span className={getCompletionColor(lesson.completionRate)}>
                            {lesson.completionRate}%
                          </span>
                        </td>
                        <td className="text-center p-2">{lesson.avgWatchPercentage}%</td>
                        <td className="text-center p-2">{lesson.medianDropOffSecond}s</td>
                        <td className="text-center p-2">{lesson.bufferingEventsPerViewer}</td>
                      </tr>
                    ))}
                    {(!data?.lessonMetrics || data.lessonMetrics.length === 0) && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-muted-foreground">
                          {isRTL ? 'لا توجد بيانات مشاهدة بعد' : 'No viewing data yet'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VideoMicroAnalytics;
