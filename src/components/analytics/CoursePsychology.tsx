import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BookOpen,
  AlertTriangle,
  Clock,
  Users,
  TrendingDown,
  GraduationCap,
  Layers,
  Search,
  CheckCircle,
  TrendingUp,
  Award,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { useCourseAnalytics } from '@/hooks/useAnalyticsDashboard';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface CoursePsychologyProps {
  dateRange: string;
}

interface EnrolledStudent {
  user_id: string;
  enrolled_at: string;
  progress_percentage: number;
  completed_at: string | null;
  profile: {
    full_name: string | null;
    phone: string | null;
    city: string | null;
    country: string | null;
    avatar_url: string | null;
  } | null;
  email: string | null;
}

const StudentStatusBadge: React.FC<{
  completedAt: string | null;
  progress: number;
  isRTL: boolean;
  compact?: boolean;
}> = ({ completedAt, progress, isRTL, compact }) => {
  if (completedAt || progress >= 100) {
    return (
      <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/10 text-[10px] sm:text-xs">
        {compact ? '✓' : (isRTL ? 'مكتمل' : 'Completed')}
      </Badge>
    );
  }
  if (progress > 0) {
    return (
      <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/10 text-[10px] sm:text-xs">
        {compact ? `${Math.round(progress)}%` : (isRTL ? 'قيد التعلم' : 'In Progress')}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px] sm:text-xs">
      {compact ? (isRTL ? 'جديد' : 'New') : (isRTL ? 'لم يبدأ' : 'Not Started')}
    </Badge>
  );
};

/* ─── Inline students panel for a single course ─── */
const CourseStudentsPanel: React.FC<{ courseId: string; isRTL: boolean }> = ({ courseId, isRTL }) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['course-students-inline', courseId],
    queryFn: async () => {
      const { data: enrollments, error } = await supabase
        .from('course_enrollments')
        .select('user_id, enrolled_at, progress_percentage, completed_at')
        .eq('course_id', courseId)
        .order('enrolled_at', { ascending: false });
      if (error) throw error;
      if (!enrollments?.length) return [];

      const userIds = enrollments.map((e) => e.user_id);

      const { data: chapters } = await supabase.from('chapters').select('id').eq('course_id', courseId);
      const chapterIds = (chapters || []).map((ch) => ch.id);
      const { data: courseLessons } = chapterIds.length
        ? await supabase.from('lessons').select('id').in('chapter_id', chapterIds).eq('is_published', true)
        : { data: [] };
      const totalLessons = (courseLessons || []).length;
      const lessonIds = (courseLessons || []).map((l) => l.id);

      const [profilesRes, emailsRes, progressRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, phone, city, country, avatar_url').in('user_id', userIds),
        supabase.from('tap_charges').select('user_id, customer_email').in('user_id', userIds).not('customer_email', 'is', null),
        lessonIds.length
          ? supabase.from('lesson_progress').select('user_id, lesson_id').in('user_id', userIds).in('lesson_id', lessonIds).eq('is_completed', true)
          : Promise.resolve({ data: [] }),
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p]));
      const emailMap = new Map<string, string>();
      (emailsRes.data || []).forEach((e) => {
        if (e.customer_email && !emailMap.has(e.user_id)) emailMap.set(e.user_id, e.customer_email);
      });
      const completedPerUser = new Map<string, number>();
      (progressRes.data || []).forEach((p) => {
        completedPerUser.set(p.user_id, (completedPerUser.get(p.user_id) || 0) + 1);
      });

      return enrollments.map((e) => {
        const completed = completedPerUser.get(e.user_id) || 0;
        const realProgress = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;
        return {
          user_id: e.user_id,
          enrolled_at: e.enrolled_at,
          progress_percentage: realProgress,
          completed_at: e.completed_at,
          profile: profileMap.get(e.user_id) || null,
          email: emailMap.get(e.user_id) || null,
        };
      }) as EnrolledStudent[];
    },
  });

  const filteredStudents = students.filter((s) => {
    const name = s.profile?.full_name?.toLowerCase() || '';
    const email = s.email?.toLowerCase() || '';
    const phone = s.profile?.phone || '';
    const q = searchQuery.toLowerCase();
    return name.includes(q) || email.includes(q) || phone.includes(q);
  });

  const formatDate = (date: string) => {
    try {
      return format(new Date(date), 'dd MMM yyyy', { locale: isRTL ? ar : undefined });
    } catch {
      return '-';
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const completedCount = students.filter((s) => s.completed_at || s.progress_percentage >= 100).length;
  const inProgressCount = students.filter((s) => !s.completed_at && s.progress_percentage > 0 && s.progress_percentage < 100).length;
  const avgProgress = students.length
    ? Math.round(students.reduce((sum, s) => sum + s.progress_percentage, 0) / students.length)
    : 0;

  return (
    <div className="space-y-4 pt-4 border-t border-border">
      {/* Mini stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
          <Users className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-lg font-bold">{students.length}</p>
            <p className="text-[10px] text-muted-foreground">{isRTL ? 'إجمالي' : 'Total'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <div>
            <p className="text-lg font-bold text-green-600">{completedCount}</p>
            <p className="text-[10px] text-muted-foreground">{isRTL ? 'أكملوا' : 'Done'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
          <TrendingUp className="w-4 h-4 text-blue-500" />
          <div>
            <p className="text-lg font-bold text-blue-600">{inProgressCount}</p>
            <p className="text-[10px] text-muted-foreground">{isRTL ? 'قيد التعلم' : 'Active'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
          <Award className="w-4 h-4 text-amber-500" />
          <div>
            <p className="text-lg font-bold text-amber-600">{avgProgress}%</p>
            <p className="text-[10px] text-muted-foreground">{isRTL ? 'متوسط' : 'Avg'}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={isRTL ? 'بحث بالاسم أو البريد...' : 'Search name or email...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="ps-10 h-9 text-sm"
        />
      </div>

      {/* Students table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="py-8 text-center">
          <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {searchQuery
              ? (isRTL ? 'لا توجد نتائج' : 'No results')
              : (isRTL ? 'لا يوجد طلاب' : 'No students yet')}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden sm:block rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                  <TableHead>{isRTL ? 'التقدم' : 'Progress'}</TableHead>
                  <TableHead>{isRTL ? 'التسجيل' : 'Enrolled'}</TableHead>
                  <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow
                    key={student.user_id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/admin/courses/${courseId}/students/${student.user_id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarImage src={student.profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                            {getInitials(student.profile?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground text-sm truncate">
                            {student.profile?.full_name || (isRTL ? 'بدون اسم' : 'No name')}
                          </p>
                          <p className="text-xs text-muted-foreground truncate" dir="ltr" style={{ unicodeBidi: 'plaintext' as any }}>
                            {student.email || student.profile?.phone || '-'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              (student.completed_at || student.progress_percentage >= 100) ? 'bg-green-500' :
                              student.progress_percentage > 50 ? 'bg-primary' : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(student.progress_percentage, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground tabular-nums w-8 text-end">
                          {Math.round(student.progress_percentage)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(student.enrolled_at)}
                    </TableCell>
                    <TableCell>
                      <StudentStatusBadge completedAt={student.completed_at} progress={student.progress_percentage} isRTL={isRTL} />
                    </TableCell>
                    <TableCell>
                      <ChevronIcon className="w-4 h-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile */}
          <div className="sm:hidden divide-y divide-border rounded-lg border border-border overflow-hidden">
            {filteredStudents.map((student) => (
              <button
                key={student.user_id}
                onClick={() => navigate(`/admin/courses/${courseId}/students/${student.user_id}`)}
                className="w-full text-start p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-9 h-9 shrink-0">
                    <AvatarImage src={student.profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                      {getInitials(student.profile?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-foreground text-sm truncate">
                        {student.profile?.full_name || (isRTL ? 'بدون اسم' : 'No name')}
                      </p>
                      <StudentStatusBadge completedAt={student.completed_at} progress={student.progress_percentage} isRTL={isRTL} compact />
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            (student.completed_at || student.progress_percentage >= 100) ? 'bg-green-500' :
                            student.progress_percentage > 50 ? 'bg-primary' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(student.progress_percentage, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {Math.round(student.progress_percentage)}%
                      </span>
                    </div>
                  </div>
                  <ChevronIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* ─── Main component ─── */
const CoursePsychology: React.FC<CoursePsychologyProps> = ({ dateRange }) => {
  const { isRTL } = useLanguage();
  const { data, isLoading } = useCourseAnalytics(dateRange);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

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

  const toggleCourse = (courseId: string) => {
    setExpandedCourse(prev => prev === courseId ? null : courseId);
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
      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          [1, 2].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
          ))
        ) : (
          (data?.courses || []).filter(c => c.isPublished).map(course => {
            const isExpanded = expandedCourse === course.id;
            return (
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

                  {/* Toggle Students */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => toggleCourse(course.id)}
                  >
                    <Users className="w-4 h-4 me-2" />
                    {isRTL ? 'الطلاب' : 'Students'}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 ms-auto" />
                    ) : (
                      <ChevronDown className="w-4 h-4 ms-auto" />
                    )}
                  </Button>

                  {/* Inline Students Panel */}
                  {isExpanded && (
                    <CourseStudentsPanel courseId={course.id} isRTL={isRTL} />
                  )}
                </CardContent>
              </Card>
            );
          })
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
