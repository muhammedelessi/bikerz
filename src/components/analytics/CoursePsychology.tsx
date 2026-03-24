import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  ChevronRight,
  ChevronLeft,
  BarChart3,
  Activity,
  Target,
  ArrowLeft,
  ArrowRight,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Star,
  X,
} from 'lucide-react';
import { useCourseAnalytics } from '@/hooks/useAnalyticsDashboard';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

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

/* ─── Status Badge ─── */
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

/* ─── Health indicator dot ─── */
const HealthDot: React.FC<{ rate: number }> = ({ rate }) => {
  const color =
    rate >= 70 ? 'bg-green-500' :
    rate >= 50 ? 'bg-yellow-500' :
    rate >= 30 ? 'bg-orange-500' : 'bg-red-500';
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />;
};

/* ─── Helper functions ─── */
const formatDateHelper = (date: string, isRTL: boolean) => {
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

/* ─── Inline Student Detail Panel ─── */
const StudentDetailPanel: React.FC<{
  userId: string;
  courseId: string;
  isRTL: boolean;
  onBack: () => void;
}> = ({ userId, courseId, isRTL, onBack }) => {
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const { data: student, isLoading: studentLoading } = useQuery({
    queryKey: ['analytics-student-profile', userId],
    queryFn: async () => {
      const [profileRes, emailRes] = await Promise.all([
        supabase.from('profiles').select('full_name, phone, city, country, avatar_url').eq('user_id', userId).single(),
        supabase.from('tap_charges').select('customer_email').eq('user_id', userId).not('customer_email', 'is', null).limit(1),
      ]);
      return {
        profile: profileRes.data,
        email: emailRes.data?.[0]?.customer_email || null,
      };
    },
  });

  const { data: enrollments = [], isLoading: enrollmentsLoading } = useQuery({
    queryKey: ['analytics-student-enrollments', userId],
    queryFn: async () => {
      const { data: enrs } = await supabase
        .from('course_enrollments')
        .select('course_id, enrolled_at, progress_percentage, completed_at')
        .eq('user_id', userId);
      if (!enrs?.length) return [];

      const courseIds = enrs.map(e => e.course_id);
      const [coursesRes, reviewsRes, tapRes, manualRes, progressRes] = await Promise.all([
        supabase.from('courses').select('id, title, title_ar').in('id', courseIds),
        supabase.from('course_reviews').select('course_id, rating, comment').eq('user_id', userId).in('course_id', courseIds),
        supabase.from('tap_charges').select('course_id, amount, currency, created_at, payment_method, status').eq('user_id', userId).eq('status', 'CAPTURED').in('course_id', courseIds),
        supabase.from('manual_payments').select('course_id, amount, currency, created_at, payment_method, status').eq('user_id', userId).eq('status', 'approved').in('course_id', courseIds),
        supabase.from('lesson_progress').select('lesson_id, is_completed').eq('user_id', userId).eq('is_completed', true),
      ]);

      const courseMap = new Map((coursesRes.data || []).map(c => [c.id, c]));
      const reviewMap = new Map((reviewsRes.data || []).map(r => [r.course_id, r]));
      const paymentMap = new Map<string, { amount: number; currency: string; date: string; method: string }>();
      [...(tapRes.data || []), ...(manualRes.data || [])].forEach(p => {
        if (p.course_id && !paymentMap.has(p.course_id)) {
          paymentMap.set(p.course_id, { amount: Number(p.amount), currency: p.currency || 'SAR', date: p.created_at, method: p.payment_method || '-' });
        }
      });

      const { data: chapters } = await supabase.from('chapters').select('id, course_id').in('course_id', courseIds);
      const chapterIds = (chapters || []).map(ch => ch.id);
      const { data: lessons } = chapterIds.length
        ? await supabase.from('lessons').select('id, chapter_id').in('chapter_id', chapterIds)
        : { data: [] };

      const chapterCourseMap = new Map((chapters || []).map(ch => [ch.id, ch.course_id]));
      const lessonCourseMap = new Map<string, string>();
      (lessons || []).forEach(l => {
        const cId = chapterCourseMap.get(l.chapter_id);
        if (cId) lessonCourseMap.set(l.id, cId);
      });
      const totalLessonsPerCourse = new Map<string, number>();
      (lessons || []).forEach(l => {
        const cId = chapterCourseMap.get(l.chapter_id);
        if (cId) totalLessonsPerCourse.set(cId, (totalLessonsPerCourse.get(cId) || 0) + 1);
      });
      const completedPerCourse = new Map<string, number>();
      (progressRes.data || []).forEach(p => {
        const cId = lessonCourseMap.get(p.lesson_id);
        if (cId) completedPerCourse.set(cId, (completedPerCourse.get(cId) || 0) + 1);
      });

      return enrs.map(e => {
        const c = courseMap.get(e.course_id);
        const review = reviewMap.get(e.course_id);
        const payment = paymentMap.get(e.course_id);
        const lessonsCompleted = completedPerCourse.get(e.course_id) || 0;
        const totalLessonCount = totalLessonsPerCourse.get(e.course_id) || 0;
        const realProgress = totalLessonCount > 0 ? Math.round((lessonsCompleted / totalLessonCount) * 100) : 0;
        return {
          course_id: e.course_id,
          course_title: isRTL && (c as any)?.title_ar ? (c as any).title_ar : c?.title || '-',
          enrolled_at: e.enrolled_at,
          progress_percentage: realProgress,
          completed_at: e.completed_at,
          lessons_completed: lessonsCompleted,
          total_lessons: totalLessonCount,
          review_rating: review?.rating || null,
          review_comment: review?.comment || null,
          purchase_amount: payment?.amount || null,
          purchase_currency: payment?.currency || null,
          purchase_date: payment?.date || null,
          payment_method: payment?.method || null,
        };
      });
    },
  });

  const isLoading = studentLoading || enrollmentsLoading;
  const completedCourses = enrollments.filter(e => e.completed_at || e.progress_percentage >= 100).length;
  const totalSpent = enrollments.reduce((sum, e) => sum + (e.purchase_amount || 0), 0);

  return (
    <div className="space-y-5">
      {/* Back button & header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="shrink-0 h-9 w-9"
        >
          <BackIcon className="w-4 h-4" />
        </Button>
        {isLoading ? (
          <Skeleton className="h-10 w-48" />
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="w-10 h-10 shrink-0 ring-2 ring-background shadow-sm">
              <AvatarImage src={student?.profile?.avatar_url || undefined} />
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                {getInitials(student?.profile?.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-foreground truncate">
                {student?.profile?.full_name || (isRTL ? 'تفاصيل الطالب' : 'Student Details')}
              </h3>
              <p className="text-xs text-muted-foreground truncate" dir="ltr" style={{ unicodeBidi: 'plaintext' as any }}>
                {student?.email || ''}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Student Info Cards */}
      {!isLoading && student && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-xl border border-border/50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">{isRTL ? 'البريد' : 'Email'}</span>
            </div>
            <p className="text-xs font-medium text-foreground truncate" dir="ltr" style={{ unicodeBidi: 'plaintext' as any }}>
              {student.email || '-'}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">{isRTL ? 'الهاتف' : 'Phone'}</span>
            </div>
            <p className="text-xs font-medium text-foreground truncate" dir="ltr" style={{ unicodeBidi: 'plaintext' as any }}>
              {student.profile?.phone || '-'}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">{isRTL ? 'الموقع' : 'Location'}</span>
            </div>
            <p className="text-xs font-medium text-foreground truncate">
              {[student.profile?.city, student.profile?.country].filter(Boolean).join(', ') || '-'}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <GraduationCap className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground">{isRTL ? 'الدورات' : 'Courses'}</span>
            </div>
            <p className="text-xs font-bold text-primary">{enrollments.length}</p>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {!isLoading && enrollments.length > 0 && (
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground px-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {completedCourses} {isRTL ? 'مكتمل' : 'completed'}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            {enrollments.length - completedCourses} {isRTL ? 'قيد التعلم' : 'in progress'}
          </span>
          {totalSpent > 0 && (
            <span className="flex items-center gap-1.5">
              <DollarSign className="w-3 h-3" />
              {isRTL ? 'إجمالي:' : 'Total:'} {totalSpent} SAR
            </span>
          )}
        </div>
      )}

      {/* Enrolled Courses */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : enrollments.length === 0 ? (
        <div className="py-10 text-center">
          <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{isRTL ? 'لا توجد بيانات' : 'No data available'}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 px-1">
            <GraduationCap className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">{isRTL ? 'الدورات المسجلة' : 'Enrolled Courses'}</h4>
          </div>
          {enrollments.map(enrollment => (
            <div key={enrollment.course_id} className="rounded-xl border border-border/50 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <BookOpen className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="font-semibold text-foreground text-sm truncate">{enrollment.course_title}</span>
                </div>
                {(enrollment.completed_at || enrollment.progress_percentage >= 100) ? (
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/10 shrink-0 text-[10px]">
                    {isRTL ? 'مكتمل' : 'Completed'}
                  </Badge>
                ) : (
                  <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/10 shrink-0 text-[10px]">
                    {Math.round(enrollment.progress_percentage)}%
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (enrollment.completed_at || enrollment.progress_percentage >= 100) ? 'bg-green-500' : 'bg-primary'
                    }`}
                    style={{ width: `${Math.min(enrollment.progress_percentage, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap tabular-nums">
                  {enrollment.lessons_completed}/{enrollment.total_lessons} {isRTL ? 'درس' : 'lessons'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span>{isRTL ? 'التسجيل:' : 'Enrolled:'}</span>
                  <span className="text-foreground">{formatDateHelper(enrollment.enrolled_at, isRTL)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <DollarSign className="w-3 h-3 shrink-0" />
                  <span>{isRTL ? 'السعر:' : 'Price:'}</span>
                  <span className="text-foreground" dir="ltr">
                    {enrollment.purchase_amount != null ? `${enrollment.purchase_amount} ${enrollment.purchase_currency}` : '-'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>{isRTL ? 'الشراء:' : 'Purchased:'}</span>
                  <span className="text-foreground">{enrollment.purchase_date ? formatDateHelper(enrollment.purchase_date, isRTL) : '-'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Star className="w-3 h-3 shrink-0" />
                  <span>{isRTL ? 'التقييم:' : 'Rating:'}</span>
                  <span className={enrollment.review_rating != null ? 'text-amber-500 font-medium' : 'text-foreground'}>
                    {enrollment.review_rating != null ? `${enrollment.review_rating}/5 ★` : '-'}
                  </span>
                </div>
              </div>

              {enrollment.review_comment && (
                <div className="bg-muted/30 rounded-lg p-2.5 text-[11px] text-muted-foreground italic leading-relaxed">
                  "{enrollment.review_comment}"
                </div>
              )}
              {enrollment.payment_method && enrollment.payment_method !== '-' && (
                <p className="text-[11px] text-muted-foreground">
                  {isRTL ? 'طريقة الدفع:' : 'Payment:'} <span className="text-foreground font-medium">{enrollment.payment_method}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Course Analytics Detail Panel ─── */
const CourseAnalyticsPanel: React.FC<{
  course: any;
  isRTL: boolean;
}> = ({ course, isRTL }) => {
  const getLeakageColor = (rate: number) => {
    if (rate <= 10) return 'text-green-500';
    if (rate <= 20) return 'text-yellow-500';
    if (rate <= 35) return 'text-orange-500';
    return 'text-red-500';
  };

  const metrics = [
    {
      icon: TrendingDown,
      iconColor: 'text-red-500',
      label: isRTL ? 'لم يبدأوا الدرس الثاني' : 'Never started lesson 2',
      value: `${course.neverStartLesson2Pct}%`,
      valueColor: getLeakageColor(course.neverStartLesson2Pct),
    },
    {
      icon: AlertTriangle,
      iconColor: 'text-orange-500',
      label: isRTL ? 'متوسط التسرب بين الدروس' : 'Avg lesson leakage',
      value: `${course.avgLeakageRate}%`,
      valueColor: getLeakageColor(course.avgLeakageRate),
    },
    {
      icon: Clock,
      iconColor: 'text-blue-500',
      label: isRTL ? 'أيام حتى التوقف' : 'Days to drop-off',
      value: `${course.avgTimeToDropoffDays}`,
      valueColor: 'text-foreground',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Funnel visualization */}
      <div className="grid grid-cols-3 gap-3">
        <div className="relative p-4 rounded-xl bg-primary/5 border border-primary/10 text-center">
          <p className="text-2xl font-bold text-primary">{course.totalEnrollments}</p>
          <p className="text-xs text-muted-foreground mt-1">{isRTL ? 'مسجلون' : 'Enrolled'}</p>
        </div>
        <div className="relative p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/10 text-center">
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {course.totalEnrollments - course.completedEnrollments}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{isRTL ? 'قيد التقدم' : 'In Progress'}</p>
        </div>
        <div className="relative p-4 rounded-xl bg-green-500/5 border border-green-500/10 text-center">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{course.completedEnrollments}</p>
          <p className="text-xs text-muted-foreground mt-1">{isRTL ? 'أكملوا' : 'Completed'}</p>
        </div>
      </div>

      {/* Completion bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground font-medium flex items-center gap-2">
            <Target className="w-4 h-4" />
            {isRTL ? 'معدل الإكمال' : 'Completion Rate'}
          </span>
          <span className="font-bold text-lg">{course.completionRate}%</span>
        </div>
        <div className="relative h-3 rounded-full bg-muted overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${course.completionRate}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="absolute inset-y-0 start-0 rounded-full bg-gradient-to-r from-primary to-primary/70"
          />
        </div>
      </div>

      {/* Leakage metrics */}
      <div className="space-y-1">
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <div key={i} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                  <Icon className={`w-4 h-4 ${m.iconColor}`} />
                </div>
                <span className="text-sm text-foreground">{m.label}</span>
              </div>
              <span className={`font-bold text-sm tabular-nums ${m.valueColor}`}>{m.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ─── Course Students Panel ─── */
const CourseStudentsPanel: React.FC<{
  courseId: string;
  isRTL: boolean;
  onSelectStudent: (userId: string) => void;
}> = ({ courseId, isRTL, onSelectStudent }) => {
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

  const completedCount = students.filter((s) => s.completed_at || s.progress_percentage >= 100).length;
  const inProgressCount = students.filter((s) => !s.completed_at && s.progress_percentage > 0 && s.progress_percentage < 100).length;
  const avgProgress = students.length
    ? Math.round(students.reduce((sum, s) => sum + s.progress_percentage, 0) / students.length)
    : 0;

  return (
    <div className="space-y-4">
      {/* Quick stats strip */}
      <div className="flex items-center gap-4 px-1 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-bold">{students.length}</span>
          <span className="text-xs text-muted-foreground">{isRTL ? 'طالب' : 'total'}</span>
        </div>
        <span className="text-border">·</span>
        <div className="flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
          <span className="text-sm font-bold text-green-600">{completedCount}</span>
          <span className="text-xs text-muted-foreground">{isRTL ? 'أكملوا' : 'done'}</span>
        </div>
        <span className="text-border">·</span>
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-sm font-bold text-blue-600">{inProgressCount}</span>
          <span className="text-xs text-muted-foreground">{isRTL ? 'نشط' : 'active'}</span>
        </div>
        <span className="text-border">·</span>
        <div className="flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-sm font-bold text-amber-600">{avgProgress}%</span>
          <span className="text-xs text-muted-foreground">{isRTL ? 'متوسط' : 'avg'}</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={isRTL ? 'بحث بالاسم أو البريد...' : 'Search by name or email...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="ps-10 h-10 text-sm bg-muted/30 border-border/50 focus:bg-background"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="py-12 text-center">
          <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
            <Users className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">
            {searchQuery ? (isRTL ? 'لا توجد نتائج' : 'No results found') : (isRTL ? 'لا يوجد طلاب بعد' : 'No students yet')}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden sm:block rounded-xl border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold">{isRTL ? 'الطالب' : 'Student'}</TableHead>
                  <TableHead className="font-semibold">{isRTL ? 'التقدم' : 'Progress'}</TableHead>
                  <TableHead className="font-semibold">{isRTL ? 'التسجيل' : 'Enrolled'}</TableHead>
                  <TableHead className="font-semibold">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow
                    key={student.user_id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors group"
                    onClick={() => onSelectStudent(student.user_id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-9 h-9 shrink-0 ring-2 ring-background shadow-sm">
                          <AvatarImage src={student.profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                            {getInitials(student.profile?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground text-sm truncate group-hover:text-primary transition-colors">
                            {student.profile?.full_name || (isRTL ? 'بدون اسم' : 'No name')}
                          </p>
                          <p className="text-xs text-muted-foreground truncate" dir="ltr" style={{ unicodeBidi: 'plaintext' as any }}>
                            {student.email || student.profile?.phone || '-'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[110px]">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              (student.completed_at || student.progress_percentage >= 100) ? 'bg-green-500' :
                              student.progress_percentage > 50 ? 'bg-primary' : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(student.progress_percentage, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground tabular-nums w-9 text-end">
                          {Math.round(student.progress_percentage)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateHelper(student.enrolled_at, isRTL)}
                    </TableCell>
                    <TableCell>
                      <StudentStatusBadge completedAt={student.completed_at} progress={student.progress_percentage} isRTL={isRTL} />
                    </TableCell>
                    <TableCell>
                      <ChevronIcon className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile */}
          <div className="sm:hidden divide-y divide-border/50 rounded-xl border border-border/60 overflow-hidden">
            {filteredStudents.map((student) => (
              <button
                key={student.user_id}
                onClick={() => onSelectStudent(student.user_id)}
                className="w-full text-start p-3.5 hover:bg-muted/30 transition-colors active:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10 shrink-0 ring-2 ring-background shadow-sm">
                    <AvatarImage src={student.profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
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
                    <div className="flex items-center gap-2 mt-2">
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

/* ─── Main Component ─── */
const CoursePsychology: React.FC<CoursePsychologyProps> = ({ dateRange }) => {
  const { isRTL } = useLanguage();
  const { data, isLoading } = useCourseAnalytics(dateRange);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const publishedCourses = (data?.courses || []).filter(c => c.isPublished);
  const selectedCourse = publishedCourses.find(c => c.id === selectedCourseId) || publishedCourses[0] || null;

  // Auto-select first course
  React.useEffect(() => {
    if (!selectedCourseId && publishedCourses.length > 0) {
      setSelectedCourseId(publishedCourses[0].id);
    }
  }, [publishedCourses.length, selectedCourseId]);

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {isRTL ? 'تحليلات الدورات' : 'Course Analytics'}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isRTL ? 'أداء الدورات وتتبع الطلاب' : 'Course performance & student tracking'}
          </p>
        </div>
      </div>

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            icon: Layers, iconBg: 'bg-primary/10', iconColor: 'text-primary',
            label: isRTL ? 'إجمالي الدورات' : 'Total Courses',
            value: data?.totalCourses || 0, valueColor: 'text-foreground',
          },
          {
            icon: BookOpen, iconBg: 'bg-green-500/10', iconColor: 'text-green-500',
            label: isRTL ? 'منشورة' : 'Published',
            value: data?.publishedCourses || 0, valueColor: 'text-green-600 dark:text-green-400',
          },
          {
            icon: GraduationCap, iconBg: 'bg-blue-500/10', iconColor: 'text-blue-500',
            label: isRTL ? 'متوسط الإكمال' : 'Avg Completion',
            value: `${data?.avgCompletionRate || 0}%`, valueColor: 'text-blue-600 dark:text-blue-400',
          },
          {
            icon: AlertTriangle, iconBg: 'bg-red-500/10', iconColor: 'text-red-500',
            label: isRTL ? 'مؤشر الاحتكاك' : 'Friction Index',
            value: `${100 - (data?.avgCompletionRate || 0)}%`, valueColor: 'text-red-600 dark:text-red-400',
          },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg ${stat.iconBg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${stat.iconColor}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                    <p className={`text-xl font-bold ${stat.valueColor}`}>
                      {isLoading ? <Skeleton className="h-7 w-10" /> : stat.value}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Master-Detail Layout ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
          <div className="lg:col-span-8">
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        </div>
      ) : publishedCourses.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">
              {isRTL ? 'لا توجد دورات منشورة بعد' : 'No published courses yet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Course Selector Sidebar */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3">
              {isRTL ? 'الدورات' : 'Courses'} ({publishedCourses.length})
            </p>
            {publishedCourses.map((course) => {
              const isSelected = selectedCourse?.id === course.id;
              return (
                <button
                  key={course.id}
                  onClick={() => {
                    setSelectedCourseId(course.id);
                    setSelectedStudentId(null);
                  }}
                  className={`w-full text-start p-3.5 rounded-xl border transition-all duration-200 ${
                    isSelected
                      ? 'bg-primary/5 border-primary/30 shadow-sm ring-1 ring-primary/20'
                      : 'bg-card border-border/50 hover:border-border hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <HealthDot rate={course.completionRate} />
                    <div className="flex-1 min-w-0 -mt-0.5">
                      <p className={`text-sm font-semibold truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                        {isRTL ? course.title_ar || course.title : course.title}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {course.totalEnrollments}
                        </span>
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          {course.totalLessons}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {course.completionRate}%
                        </span>
                      </div>
                      {/* Mini progress bar */}
                      <div className="h-1 rounded-full bg-muted mt-2 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/60 transition-all duration-500"
                          style={{ width: `${course.completionRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail Panel */}
          <div className="lg:col-span-8 xl:col-span-9">
            <AnimatePresence mode="wait">
              {selectedCourse && (
                <motion.div
                  key={selectedStudentId ? `student-${selectedStudentId}` : `course-${selectedCourse.id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {selectedStudentId ? (
                    /* ── Student Detail View ── */
                    <Card className="border-border/50 overflow-hidden">
                      <div className="p-6">
                        <StudentDetailPanel
                          userId={selectedStudentId}
                          courseId={selectedCourse.id}
                          isRTL={isRTL}
                          onBack={() => setSelectedStudentId(null)}
                        />
                      </div>
                    </Card>
                  ) : (
                    /* ── Course Analytics + Students View ── */
                    <Card className="border-border/50 overflow-hidden">
                      {/* Course header */}
                      <div className="px-6 pt-6 pb-4 border-b border-border/50">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <h3 className="text-lg font-bold text-foreground truncate">
                              {isRTL ? selectedCourse.title_ar || selectedCourse.title : selectedCourse.title}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" />
                                {selectedCourse.totalEnrollments} {isRTL ? 'مسجل' : 'enrolled'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Layers className="w-3.5 h-3.5" />
                                {selectedCourse.totalChapters} {isRTL ? 'فصول' : 'chapters'}
                              </span>
                              <span className="flex items-center gap-1">
                                <BookOpen className="w-3.5 h-3.5" />
                                {selectedCourse.totalLessons} {isRTL ? 'دروس' : 'lessons'}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <HealthDot rate={selectedCourse.completionRate} />
                            <span className="text-sm font-bold tabular-nums">
                              {selectedCourse.completionRate}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Tabs: Analytics | Students */}
                      <Tabs defaultValue="analytics" className="w-full">
                        <div className="px-6 border-b border-border/50">
                          <TabsList className="bg-transparent h-auto p-0 gap-6">
                            <TabsTrigger
                              value="analytics"
                              className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-0 pb-3 pt-3 text-sm font-medium"
                            >
                              <BarChart3 className="w-4 h-4 me-2" />
                              {isRTL ? 'التحليلات' : 'Analytics'}
                            </TabsTrigger>
                            <TabsTrigger
                              value="students"
                              className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-0 pb-3 pt-3 text-sm font-medium"
                            >
                              <Users className="w-4 h-4 me-2" />
                              {isRTL ? 'الطلاب' : 'Students'}
                              <Badge variant="secondary" className="ms-2 text-[10px] px-1.5 py-0">
                                {selectedCourse.totalEnrollments}
                              </Badge>
                            </TabsTrigger>
                          </TabsList>
                        </div>

                        <div className="p-6">
                          <TabsContent value="analytics" className="m-0">
                            <CourseAnalyticsPanel course={selectedCourse} isRTL={isRTL} />
                          </TabsContent>
                          <TabsContent value="students" className="m-0">
                            <CourseStudentsPanel
                              courseId={selectedCourse.id}
                              isRTL={isRTL}
                              onSelectStudent={(uid) => setSelectedStudentId(uid)}
                            />
                          </TabsContent>
                        </div>
                      </Tabs>
                    </Card>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoursePsychology;
