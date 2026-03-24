import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList,
  Cell,
} from '@/lib/recharts-compat';
import {
  BookOpen,
  AlertTriangle,
  Clock,
  Users,
  TrendingDown,
  GraduationCap,
  Layers,
} from 'lucide-react';
import { useCourseAnalytics } from '@/hooks/useAnalyticsDashboard';

const FUNNEL_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'];

interface CoursePsychologyProps {
  dateRange: string;
}

const CoursePsychology: React.FC<CoursePsychologyProps> = ({ dateRange }) => {
  const { isRTL } = useLanguage();
  const { data, isLoading } = useCourseAnalytics(dateRange);

  const getHealthColor = (rate: number) => {
    if (rate >= 70) return 'bg-green-500';
    if (rate >= 50) return 'bg-yellow-500';
    if (rate >= 30) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getLeakageColor = (rate: number) => {
    if (rate <= 10) return 'text-green-500';
    if (rate <= 20) return 'text-yellow-500';
    if (rate <= 35) return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="w-6 h-6 text-primary" />
        <h2 className="text-xl font-bold">
          {isRTL ? 'سيكولوجية الدورات' : 'Course-Level Psychology'}
        </h2>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">
                {isRTL ? 'إجمالي الدورات' : 'Total Courses'}
              </span>
            </div>
            <p className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-12" /> : data?.totalCourses || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground">
                {isRTL ? 'الدورات المنشورة' : 'Published'}
              </span>
            </div>
            <p className="text-2xl font-bold text-green-500">
              {isLoading ? <Skeleton className="h-8 w-12" /> : data?.publishedCourses || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">
                {isRTL ? 'متوسط الإكمال' : 'Avg Completion'}
              </span>
            </div>
            <p className="text-2xl font-bold text-blue-500">
              {isLoading ? <Skeleton className="h-8 w-16" /> : `${data?.avgCompletionRate || 0}%`}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-transparent border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-xs text-muted-foreground">
                {isRTL ? 'مؤشر الاحتكاك' : 'Friction Index'}
              </span>
            </div>
            <p className="text-2xl font-bold text-red-500">
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                `${100 - (data?.avgCompletionRate || 0)}%`
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Course Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading ? (
          [1, 2].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
          ))
        ) : (
          (data?.courses || []).filter(c => c.isPublished).map(course => (
            <Card key={course.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {isRTL ? course.title_ar || course.title : course.title}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Users className="w-3 h-3" />
                      {course.totalEnrollments} {isRTL ? 'مسجل' : 'enrolled'}
                      <span>•</span>
                      <Layers className="w-3 h-3" />
                      {course.totalChapters} {isRTL ? 'فصول' : 'chapters'}
                      <span>•</span>
                      {course.totalLessons} {isRTL ? 'دروس' : 'lessons'}
                    </CardDescription>
                  </div>
                  <Badge className={getHealthColor(course.completionRate)}>
                    {course.completionRate}% {isRTL ? 'إكمال' : 'completion'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Completion Funnel */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-muted/30 rounded-lg">
                    <p className="text-lg font-bold">{course.totalEnrollments}</p>
                    <p className="text-xs text-muted-foreground">
                      {isRTL ? 'مسجلون' : 'Enrolled'}
                    </p>
                  </div>
                  <div className="p-2 bg-muted/30 rounded-lg">
                    <p className="text-lg font-bold text-yellow-500">
                      {course.totalEnrollments - course.completedEnrollments}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isRTL ? 'قيد التقدم' : 'In Progress'}
                    </p>
                  </div>
                  <div className="p-2 bg-muted/30 rounded-lg">
                    <p className="text-lg font-bold text-green-500">{course.completedEnrollments}</p>
                    <p className="text-xs text-muted-foreground">
                      {isRTL ? 'أكملوا' : 'Completed'}
                    </p>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-red-500" />
                      <span className="text-sm">
                        {isRTL ? 'لم يبدأوا الدرس الثاني' : 'Never start lesson 2'}
                      </span>
                    </div>
                    <span className={`font-bold ${getLeakageColor(course.neverStartLesson2Pct)}`}>
                      {course.neverStartLesson2Pct}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      <span className="text-sm">
                        {isRTL ? 'متوسط التسرب بين الدروس' : 'Avg lesson leakage'}
                      </span>
                    </div>
                    <span className={`font-bold ${getLeakageColor(course.avgLeakageRate)}`}>
                      {course.avgLeakageRate}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span className="text-sm">
                        {isRTL ? 'متوسط أيام حتى التوقف' : 'Avg days to drop-off'}
                      </span>
                    </div>
                    <span className="font-bold">{course.avgTimeToDropoffDays} {isRTL ? 'يوم' : 'days'}</span>
                  </div>
                </div>

                {/* Completion Progress */}
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">
                      {isRTL ? 'تقدم الإكمال' : 'Completion Progress'}
                    </span>
                    <span className="font-medium">{course.completionRate}%</span>
                  </div>
                  <Progress value={course.completionRate} className="h-2" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
        {!isLoading && (!data?.courses || data.courses.filter(c => c.isPublished).length === 0) && (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center text-muted-foreground">
              {isRTL ? 'لا توجد دورات منشورة بعد' : 'No published courses yet'}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CoursePsychology;
