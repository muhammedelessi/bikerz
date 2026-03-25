import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  BookOpen,
  Calendar,
  DollarSign,
  Star,
  Clock,
  GraduationCap,
  ArrowLeft,
  ArrowRight,
  Mail,
  Phone,
  MapPin,
  ChevronDown,
  Eye,
  SkipForward,
  Repeat,
  Play,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

// ── Types ──

interface SkippedSegment { from: number; to: number }
interface RewatchedSegment { from: number; to: number; count: number }

interface WatchSession {
  lesson_id: string;
  total_watch_time_seconds: number | null;
  max_position_reached_seconds: number | null;
  video_duration_seconds: number | null;
  completion_percentage: number | null;
  session_id: string | null;
  started_at: string;
}

interface WatchBehavior {
  lesson_id: string;
  course_id: string | null;
  total_watched_seconds: number | null;
  skipped_segments: SkippedSegment[] | null;
  rewatched_segments: RewatchedSegment[] | null;
  last_position_seconds: number | null;
  video_duration_seconds: number | null;
  completion_percentage: number | null;
  updated_at: string;
}

// ── Helpers ──

const fmtTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const fmtDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
};

const AdminStudentDetail: React.FC = () => {
  const { id: courseId, userId } = useParams<{ id: string; userId: string }>();
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

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

  // Fetch student profile + email
  const { data: student, isLoading: studentLoading } = useQuery({
    queryKey: ['student-profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const [profileRes, emailRes] = await Promise.all([
        supabase.from('profiles').select('full_name, phone, city, country, avatar_url').eq('user_id', userId).single(),
        supabase.from('tap_charges').select('customer_email').eq('user_id', userId).not('customer_email', 'is', null).limit(1),
      ]);
      return {
        profile: profileRes.data,
        email: emailRes.data?.[0]?.customer_email || null,
      };
    },
    enabled: !!userId,
  });

  // Fetch all enrollments for this student
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useQuery({
    queryKey: ['student-enrollments', userId],
    queryFn: async () => {
      if (!userId) return [];
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
    enabled: !!userId,
  });

  // Fetch watch session data for this student across all courses
  const { data: watchSessions = [] } = useQuery({
    queryKey: ['student-watch-sessions', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from('video_watch_sessions')
        .select('lesson_id, total_watch_time_seconds, max_position_reached_seconds, video_duration_seconds, completion_percentage, session_id, started_at')
        .eq('user_id', userId)
        .order('started_at', { ascending: true });
      return (data || []) as WatchSession[];
    },
    enabled: !!userId,
  });

  // Fetch video_watch_behavior for detailed skipped/rewatched data
  const { data: watchBehaviors = [] } = useQuery({
    queryKey: ['student-watch-behavior', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from('video_watch_behavior')
        .select('lesson_id, course_id, total_watched_seconds, skipped_segments, rewatched_segments, last_position_seconds, video_duration_seconds, completion_percentage, updated_at')
        .eq('user_id', userId);
      return (data || []) as WatchBehavior[];
    },
    enabled: !!userId,
  });

  const firstIP: string | null = null;

  const { data: lessonTitles = [] } = useQuery({
    queryKey: ['lesson-titles-for-behavior', watchSessions.map(b => b.lesson_id).join(',')],
    queryFn: async () => {
      const ids = [...new Set(watchSessions.map(b => b.lesson_id))];
      if (!ids.length) return [];
      const { data } = await supabase
        .from('lessons')
        .select('id, title, title_ar, chapter_id, duration_minutes')
        .in('id', ids);
      return data || [];
    },
    enabled: watchSessions.length > 0,
  });

  const lessonTitleMap = new Map(lessonTitles.map(l => [l.id, l]));

  // Group behaviors by course
  const { data: lessonCourseMapping = new Map() } = useQuery({
    queryKey: ['lesson-course-mapping', watchSessions.map(b => b.lesson_id).join(',')],
    queryFn: async () => {
      const ids = [...new Set(watchSessions.map(b => b.lesson_id))];
      if (!ids.length) return new Map<string, string>();
      const { data: lessons } = await supabase
        .from('lessons')
        .select('id, chapter_id')
        .in('id', ids);
      if (!lessons?.length) return new Map<string, string>();
      const chapterIds = [...new Set(lessons.map(l => l.chapter_id))];
      const { data: chapters } = await supabase
        .from('chapters')
        .select('id, course_id')
        .in('id', chapterIds);
      const chMap = new Map((chapters || []).map(c => [c.id, c.course_id]));
      const result = new Map<string, string>();
      lessons.forEach(l => {
        const cId = chMap.get(l.chapter_id);
        if (cId) result.set(l.id, cId);
      });
      return result;
    },
    enabled: watchSessions.length > 0,
  });

  const isLoading = studentLoading || enrollmentsLoading;
  const completedCourses = enrollments.filter(e => e.completed_at || e.progress_percentage >= 100).length;
  const totalSpent = enrollments.reduce((sum, e) => sum + (e.purchase_amount || 0), 0);

  // Get sessions for a specific course
  const getSessionsForCourse = (cId: string): (WatchSession & { lessonTitle: string })[] => {
    return watchSessions
      .filter(s => lessonCourseMapping.get(s.lesson_id) === cId)
      .map(s => ({
        ...s,
        lessonTitle: (() => {
          const l = lessonTitleMap.get(s.lesson_id);
          if (!l) return s.lesson_id.slice(0, 8);
          return isRTL && l.title_ar ? l.title_ar : l.title;
        })(),
      }));
  };

  return (
    <AdminLayout>
      <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(courseId ? `/admin/courses/${courseId}/students` : '/admin/courses')}
            className="shrink-0"
          >
            <BackIcon className="w-5 h-5" />
          </Button>
          {isLoading ? (
            <Skeleton className="h-12 w-64" />
          ) : (
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="w-11 h-11 shrink-0">
                <AvatarImage src={student?.profile?.avatar_url || undefined} />
                <AvatarFallback className="text-sm bg-primary/10 text-primary font-semibold">
                  {getInitials(student?.profile?.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
                  {student?.profile?.full_name || (isRTL ? 'تفاصيل الطالب' : 'Student Details')}
                </h1>
                <p className="text-sm text-muted-foreground truncate" dir="ltr" style={{ unicodeBidi: 'plaintext' as any }}>
                  {student?.email || ''}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Student Info Cards */}
        {!isLoading && student && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{isRTL ? 'البريد الإلكتروني' : 'Email'}</p>
                </div>
                <p className="text-sm font-medium text-foreground truncate" dir="ltr" style={isRTL ? { unicodeBidi: 'plaintext' as any } : undefined}>
                  {student.email || '-'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{isRTL ? 'رقم الهاتف' : 'Phone'}</p>
                </div>
                <p className="text-sm font-medium text-foreground truncate" dir="ltr" style={isRTL ? { unicodeBidi: 'plaintext' as any } : undefined}>
                  {student.profile?.phone || '-'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{isRTL ? 'الموقع' : 'Location'}</p>
                </div>
                <p className="text-sm font-medium text-foreground truncate">
                  {[student.profile?.city, student.profile?.country].filter(Boolean).join(', ') || '-'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  <p className="text-xs text-muted-foreground">{isRTL ? 'الدورات' : 'Courses'}</p>
                </div>
                <p className="text-sm font-bold text-primary">{enrollments.length}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Summary Stats */}
        {!isLoading && enrollments.length > 0 && (
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
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
                <DollarSign className="w-3.5 h-3.5" />
                {isRTL ? 'إجمالي المدفوعات:' : 'Total spent:'} {totalSpent} SAR
              </span>
            )}
          </div>
        )}

        {/* Enrolled Courses Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{isRTL ? 'الدورات المسجلة' : 'Enrolled Courses'}</h2>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
            </div>
          ) : enrollments.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">{isRTL ? 'لا توجد بيانات' : 'No data available'}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {enrollments.map(enrollment => {
                const courseBehaviors = getSessionsForCourse(enrollment.course_id);
                return (
                  <Card key={enrollment.course_id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <BookOpen className="w-4 h-4 text-primary" />
                          </div>
                          <span className="font-semibold text-foreground text-sm truncate">{enrollment.course_title}</span>
                        </div>
                        {(enrollment.completed_at || enrollment.progress_percentage >= 100) ? (
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/10 shrink-0 text-xs">
                            {isRTL ? 'مكتمل' : 'Completed'}
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/10 shrink-0 text-xs">
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
                        <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                          {enrollment.lessons_completed}/{enrollment.total_lessons} {isRTL ? 'درس' : 'lessons'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        <MetaRow icon={Calendar} label={isRTL ? 'التسجيل' : 'Enrolled'} value={formatDate(enrollment.enrolled_at)} />
                        <MetaRow icon={DollarSign} label={isRTL ? 'السعر' : 'Price'} value={enrollment.purchase_amount != null ? `${enrollment.purchase_amount} ${enrollment.purchase_currency}` : (isRTL ? 'غير متاح' : 'N/A')} dir="ltr" />
                        <MetaRow icon={Clock} label={isRTL ? 'الشراء' : 'Purchased'} value={enrollment.purchase_date ? formatDate(enrollment.purchase_date) : '-'} />
                        <MetaRow icon={Star} label={isRTL ? 'التقييم' : 'Rating'} value={enrollment.review_rating != null ? `${enrollment.review_rating}/5 ★` : (isRTL ? 'لا يوجد' : 'None')} highlight={enrollment.review_rating != null} />
                      </div>

                      {enrollment.review_comment && (
                        <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground italic leading-relaxed">"{enrollment.review_comment}"</div>
                      )}
                      {enrollment.payment_method && enrollment.payment_method !== '-' && (
                        <p className="text-xs text-muted-foreground">
                          {isRTL ? 'طريقة الدفع:' : 'Payment:'} <span className="text-foreground font-medium">{enrollment.payment_method}</span>
                        </p>
                      )}

                      {/* Watch Sessions Section */}
                      {courseBehaviors.length > 0 && (
                        <WatchSessionsPanel 
                          sessions={courseBehaviors} 
                          isRTL={isRTL} 
                          firstIP={firstIP}
                        />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

// ── Watch Sessions Panel ──

const WatchSessionsPanel: React.FC<{
  sessions: (WatchSession & { lessonTitle: string })[];
  isRTL: boolean;
  firstIP: string | null;
}> = ({ sessions, isRTL, firstIP }) => {
  const [open, setOpen] = useState(false);

  // Group sessions by lesson
  const sessionsByLesson = sessions.reduce((acc, s) => {
    if (!acc[s.lesson_id]) acc[s.lesson_id] = { title: s.lessonTitle, items: [] };
    acc[s.lesson_id].items.push(s);
    return acc;
  }, {} as Record<string, { title: string; items: WatchSession[] }>);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8 px-2 text-muted-foreground hover:text-foreground">
          <span className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            {isRTL ? `جلسات المشاهدة (${sessions.length})` : `Watch Sessions (${sessions.length})`}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-4">
          {Object.entries(sessionsByLesson).map(([lessonId, group]) => (
            <div key={lessonId} className="space-y-2">
              <p className="text-xs font-bold text-foreground px-1">{group.title}</p>
              <div className="space-y-1.5 ms-2">
                {group.items.sort((a,b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()).map((s, idx) => {
                  return (
                    <div key={idx} className="bg-muted/30 rounded-lg p-2.5 space-y-1 border border-border/50">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-semibold text-primary">
                          {isRTL ? `جلسة ${idx + 1}` : `Session ${idx + 1}`} — {format(new Date(s.started_at), 'dd MMM')}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {fmtDuration(s.total_watch_time_seconds || 0)}/{fmtDuration(s.video_duration_seconds || 0)}
                          </span>
                          <Badge variant="secondary" className="text-[9px] px-1 h-3.5">
                            {s.completion_percentage || 0}%
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

// ── Sub-components ──

const MetaRow: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  dir?: string;
  highlight?: boolean;
}> = ({ icon: Icon, label, value, dir, highlight }) => (
  <div className="flex items-center gap-1.5 text-muted-foreground">
    <Icon className="w-3 h-3 shrink-0" />
    <span>{label}:</span>
    <span className={`truncate ${highlight ? 'text-amber-500 font-medium' : 'text-foreground'}`} dir={dir}>{value}</span>
  </div>
);

export default AdminStudentDetail;
