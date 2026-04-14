import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminStudentDetail } from '@/hooks/admin/useAdminStudentDetail';
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
  CheckCircle2,
  Globe,
  AlertTriangle,
  Shield,
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
  ip_address: string | null;
  skipped_segments: SkippedSegment[] | null;
  rewatched_segments: RewatchedSegment[] | null;
}

// ── Helpers ──

const fmtTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const fmtDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const AdminStudentDetail: React.FC = () => {
  const { useRQ, useRM, queryClient, dbFrom } = useAdminStudentDetail();
  const { id: courseId, userId } = useParams<{ id: string; userId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
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
  const { data: student, isLoading: studentLoading } = useRQ({
    queryKey: ['student-profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const [profileRes, emailRes] = await Promise.all([
        dbFrom('profiles').select('full_name, phone, city, country, avatar_url').eq('user_id', userId).single(),
        dbFrom('tap_charges').select('customer_email').eq('user_id', userId).not('customer_email', 'is', null).limit(1),
      ]);
      return {
        profile: profileRes.data,
        email: emailRes.data?.[0]?.customer_email || null,
      };
    },
    enabled: !!userId,
  });

  // Fetch all enrollments for this student
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useRQ({
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
        dbFrom('courses').select('id, title, title_ar').in('id', courseIds),
        dbFrom('course_reviews').select('course_id, rating, comment').eq('user_id', userId).in('course_id', courseIds),
        dbFrom('tap_charges').select('course_id, amount, currency, created_at, payment_method, status').eq('user_id', userId).eq('status', 'CAPTURED').in('course_id', courseIds),
        dbFrom('manual_payments').select('course_id, amount, currency, created_at, payment_method, status').eq('user_id', userId).eq('status', 'approved').in('course_id', courseIds),
        dbFrom('lesson_progress').select('lesson_id, is_completed').eq('user_id', userId).eq('is_completed', true),
      ]);

      const courseMap = new Map((coursesRes.data || []).map(c => [c.id, c]));
      const reviewMap = new Map((reviewsRes.data || []).map(r => [r.course_id, r]));
      const paymentMap = new Map<string, { amount: number; currency: string; date: string; method: string }>();
      [...(tapRes.data || []), ...(manualRes.data || [])].forEach(p => {
        if (p.course_id && !paymentMap.has(p.course_id)) {
          paymentMap.set(p.course_id, { amount: Number(p.amount), currency: p.currency || 'SAR', date: p.created_at, method: p.payment_method || '-' });
        }
      });

      const { data: chapters } = await dbFrom('chapters').select('id, course_id').in('course_id', courseIds);
      const chapterIds = (chapters || []).map(ch => ch.id);
      const { data: lessons } = chapterIds.length
        ? await dbFrom('lessons').select('id, chapter_id').in('chapter_id', chapterIds)
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
  const { data: watchSessions = [] } = useRQ({
    queryKey: ['student-watch-sessions', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from('video_watch_sessions')
        .select('lesson_id, total_watch_time_seconds, max_position_reached_seconds, video_duration_seconds, completion_percentage, session_id, started_at, ip_address, skipped_segments, rewatched_segments')
        .eq('user_id', userId)
        .order('started_at', { ascending: true });
      return (data || []).map(d => ({
        ...d,
        skipped_segments: Array.isArray(d.skipped_segments) ? d.skipped_segments : [],
        rewatched_segments: Array.isArray(d.rewatched_segments) ? d.rewatched_segments : [],
      })) as unknown as WatchSession[];
    },
    enabled: !!userId,
  });

  const firstIP: string | null = watchSessions.length > 0 ? (watchSessions.find(s => s.ip_address && s.ip_address !== 'unknown')?.ip_address || null) : null;

  const { data: lessonTitles = [] } = useRQ({
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
  const { data: lessonCourseMapping = new Map() } = useRQ({
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
                  {student?.profile?.full_name || t('admin.studentDetail.title')}
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
                  <p className="text-xs text-muted-foreground">{t('admin.studentDetail.email')}</p>
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
                  <p className="text-xs text-muted-foreground">{t('admin.studentDetail.phone')}</p>
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
                  <p className="text-xs text-muted-foreground">{t('admin.studentDetail.location')}</p>
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
                  <p className="text-xs text-muted-foreground">{t('admin.studentDetail.courses')}</p>
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
              {completedCourses} {t('admin.studentDetail.completed')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              {enrollments.length - completedCourses} {t('admin.studentDetail.inProgress')}
            </span>
            {totalSpent > 0 && (
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                {t('admin.studentDetail.totalSpent')} {totalSpent} SAR
              </span>
            )}
          </div>
        )}

        {/* Enrolled Courses Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{t('admin.studentDetail.enrolledCourses')}</h2>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
            </div>
          ) : enrollments.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <p className="text-muted-foreground">{t('admin.studentDetail.na')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {enrollments.map(enrollment => {
                const courseSessions = getSessionsForCourse(enrollment.course_id);
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
                            {t('admin.studentDetail.completed')}
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
                           {t('admin.studentDetail.lessonsCount', { completed: enrollment.lessons_completed, total: enrollment.total_lessons })}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        <MetaRow icon={Calendar} label={t('admin.studentDetail.enrolled')} value={formatDate(enrollment.enrolled_at)} />
                        <MetaRow icon={DollarSign} label={t('admin.studentDetail.price')} value={enrollment.purchase_amount != null ? `${enrollment.purchase_amount} ${enrollment.purchase_currency}` : t('admin.studentDetail.na')} dir="ltr" />
                        <MetaRow icon={Clock} label={t('admin.studentDetail.purchased')} value={enrollment.purchase_date ? formatDate(enrollment.purchase_date) : '-'} />
                        <MetaRow icon={Star} label={t('admin.studentDetail.rating')} value={enrollment.review_rating != null ? `${enrollment.review_rating}/5 ★` : t('admin.studentDetail.none')} highlight={enrollment.review_rating != null} />
                      </div>

                      {enrollment.review_comment && (
                        <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground italic leading-relaxed">"{enrollment.review_comment}"</div>
                      )}
                      {enrollment.payment_method && enrollment.payment_method !== '-' && (
                        <p className="text-xs text-muted-foreground">
                          {t('admin.studentDetail.payment')} <span className="text-foreground font-medium">{enrollment.payment_method}</span>
                        </p>
                      )}

                      {/* Watch Sessions Section */}
                      {courseSessions.length > 0 && (
                        <WatchSessionsPanel
                          sessions={courseSessions}
                          isRTL={isRTL}
                          firstIP={firstIP}
                          t={t}
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
  t: any;
}> = ({ sessions, isRTL, firstIP, t }) => {
  const [open, setOpen] = useState(false);

  const allIPs = [...new Set(sessions.map(s => s.ip_address).filter(Boolean))] as string[];
  const hasMultipleIPs = allIPs.filter(ip => ip !== 'unknown').length > 1;

  // Aggregate stats
  const totalWatched = sessions.reduce((s, ses) => s + (ses.total_watch_time_seconds || 0), 0);
  const totalDuration = sessions.reduce((s, ses) => s + (ses.video_duration_seconds || 0), 0);
  const avgCompletion = sessions.length > 0
    ? Math.round(sessions.reduce((s, ses) => s + (Number(ses.completion_percentage) || 0), 0) / sessions.length)
    : 0;

  // Group sessions by lesson
  const sessionsByLesson = sessions.reduce((acc, s) => {
    if (!acc[s.lesson_id]) acc[s.lesson_id] = { title: s.lessonTitle, items: [] };
    acc[s.lesson_id].items.push(s);
    return acc;
  }, {} as Record<string, { title: string; items: (WatchSession & { lessonTitle: string })[] }>);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`w-full justify-between text-xs h-9 px-3 rounded-lg transition-colors ${
            open
              ? 'bg-primary/10 text-primary hover:bg-primary/15'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <span className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5" />
            {t('admin.studentDetail.watchSessions')}
            <Badge variant="secondary" className="text-[10px] px-1.5 h-4 font-normal">
              {sessions.length}
            </Badge>
            {hasMultipleIPs && (
              <Badge className="text-[10px] px-1.5 h-4 bg-orange-500/15 text-orange-500 border-orange-500/20 hover:bg-orange-500/15">
                <AlertTriangle className="w-3 h-3 me-0.5" />
                {t('admin.studentDetail.multiIP')}
              </Badge>
            )}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 space-y-4">
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-muted/40 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-foreground tabular-nums" dir="ltr">{fmtDuration(totalWatched)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{t('admin.studentDetail.totalWatched')}</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-foreground tabular-nums" dir="ltr">{fmtDuration(totalDuration)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{t('admin.studentDetail.videoDuration')}</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-3 text-center">
              <p className={`text-lg font-bold tabular-nums ${avgCompletion >= 80 ? 'text-green-500' : avgCompletion >= 50 ? 'text-primary' : 'text-orange-500'}`} dir="ltr">
                {avgCompletion}%
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{t('admin.studentDetail.avgCompletion')}</p>
            </div>
          </div>

          {/* IP summary */}
          {allIPs.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 bg-muted/20 rounded-lg px-3 py-2">
              <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">{t('admin.studentDetail.ipAddresses')}</span>
              {allIPs.map((ip, i) => {
                const isPrimary = ip === firstIP;
                const isSuspicious = !isPrimary && hasMultipleIPs && ip !== 'unknown';
                return (
                  <Badge
                    key={i}
                    variant="outline"
                    className={`text-[10px] px-2 h-5 font-mono gap-1 ${
                      isPrimary
                        ? 'border-green-500/30 text-green-600 bg-green-500/5'
                        : isSuspicious
                        ? 'border-orange-500/30 text-orange-500 bg-orange-500/5'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {isPrimary && <Shield className="w-3 h-3" />}
                    {isSuspicious && <AlertTriangle className="w-3 h-3" />}
                    {ip}
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Lessons with sessions */}
          {Object.entries(sessionsByLesson).map(([lessonId, group]) => (
            <div key={lessonId} className="space-y-2">
              {/* Lesson title */}
              <div className="flex items-center gap-2">
                <Play className="w-3.5 h-3.5 text-primary shrink-0" />
                <p className="text-sm font-semibold text-foreground">{group.title}</p>
                <Badge variant="secondary" className="text-[10px] px-1.5 h-4">
                  {group.items.length} {t('admin.studentDetail.session', { count: group.items.length })}
                </Badge>
              </div>

              {/* Session cards */}
              <div className="space-y-2 ms-2">
                {group.items
                  .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
                  .map((s, idx) => (
                    <SessionCard
                      key={s.session_id || idx}
                      session={s}
                      index={idx}
                      isRTL={isRTL}
                      firstIP={firstIP}
                      hasMultipleIPs={hasMultipleIPs}
                      t={t}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

// ── Session Card ──

const SessionCard: React.FC<{
  session: WatchSession & { lessonTitle: string };
  index: number;
  isRTL: boolean;
  firstIP: string | null;
  hasMultipleIPs: boolean;
  t: any;
}> = ({ session: s, index, isRTL, firstIP, hasMultipleIPs, t }) => {
  const pct = Math.round(Number(s.completion_percentage) || 0);
  const watched = s.total_watch_time_seconds || 0;
  const duration = s.video_duration_seconds || 1;
  const skipped = (s.skipped_segments || []) as SkippedSegment[];
  const rewatched = (s.rewatched_segments || []) as RewatchedSegment[];
  const skippedTime = skipped.reduce((sum, seg) => sum + Math.max(0, seg.to - seg.from), 0);
  const rewatchedTime = rewatched.reduce((sum, seg) => sum + Math.max(0, seg.to - seg.from) * (seg.count || 1), 0);
  const isDiffIP = s.ip_address && firstIP && s.ip_address !== firstIP && s.ip_address !== 'unknown';
  const isCleanWatch = skipped.length === 0 && rewatched.length === 0;

  const progressColor = pct >= 90 ? 'bg-green-500' : pct >= 50 ? 'bg-primary' : 'bg-orange-400';

  return (
    <Card className={`overflow-hidden ${isDiffIP ? 'border-orange-500/40' : ''}`}>
      <CardContent className="p-0">
        {/* Header row: session label + date + completion */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30">
          <span className="text-xs font-semibold text-foreground tabular-nums">
            {t('admin.studentDetail.sessionLabel', { index: index + 1 })}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground tabular-nums" dir="ltr">
              {format(new Date(s.started_at), 'dd MMM yyyy · HH:mm')}
            </span>
            <span className={`text-xs font-bold tabular-nums ${
              pct >= 90 ? 'text-green-500' : pct >= 50 ? 'text-primary' : 'text-orange-500'
            }`} dir="ltr">
              {pct}%
            </span>
          </div>
        </div>

        {/* Thin progress bar — always fills left-to-right */}
        <div className="h-1 bg-muted/50" dir="ltr">
          <div className={`h-full transition-all ${progressColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>

        {/* Stats grid */}
        <div className="px-4 py-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[11px] text-muted-foreground mb-0.5">{t('admin.studentDetail.watched')}</p>
              <p className="text-sm font-bold text-foreground tabular-nums" dir="ltr">{fmtDuration(watched)}</p>
              <p className="text-[10px] text-muted-foreground tabular-nums" dir="ltr">/ {fmtDuration(duration)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-0.5">{t('admin.studentDetail.skipped')}</p>
              <p className={`text-sm font-bold tabular-nums ${skipped.length > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} dir="ltr">
                {skipped.length > 0 ? fmtDuration(skippedTime) : '—'}
              </p>
              {skipped.length > 0 && (
                <p className="text-[10px] text-orange-500/70 tabular-nums" dir="ltr">
                   {skipped.length} {t('admin.studentDetail.clip', { count: skipped.length })}
                </p>
              )}
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-0.5">{t('admin.studentDetail.replayed')}</p>
              <p className={`text-sm font-bold tabular-nums ${rewatched.length > 0 ? 'text-blue-500' : 'text-muted-foreground'}`} dir="ltr">
                {rewatched.length > 0 ? fmtDuration(rewatchedTime) : '—'}
              </p>
              {rewatched.length > 0 && (
                <p className="text-[10px] text-blue-500/70 tabular-nums" dir="ltr">
                   {rewatched.length} {t('admin.studentDetail.clip', { count: rewatched.length })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Skipped segments detail */}
        {skipped.length > 0 && (
          <div className="px-4 pb-3">
            <div className="rounded-lg bg-orange-500/5 border border-orange-500/10 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <SkipForward className={`w-3.5 h-3.5 text-orange-500 ${isRTL ? 'scale-x-[-1]' : ''}`} />
                <span className="text-xs font-semibold text-orange-500">
                   {t('admin.studentDetail.skippedSegments')}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {skipped.map((seg, i) => (
                  <div key={i} className="bg-orange-500/5 rounded px-2.5 py-1.5 text-center" dir="ltr">
                    <span className="text-xs font-mono text-orange-400 tabular-nums">
                      {fmtTime(Math.round(seg.from))} → {fmtTime(Math.round(seg.to))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Rewatched segments detail */}
        {rewatched.length > 0 && (
          <div className="px-4 pb-3">
            <div className="rounded-lg bg-blue-500/5 border border-blue-500/10 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Repeat className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs font-semibold text-blue-500">
                   {t('admin.studentDetail.replayedSegments')}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {rewatched.map((r, i) => (
                  <div key={i} className="bg-blue-500/5 rounded px-2.5 py-1.5 text-center" dir="ltr">
                    <span className="text-xs font-mono text-blue-400 tabular-nums">
                      {fmtTime(Math.round(r.from))} → {fmtTime(Math.round(r.to))}
                    </span>
                    <span className="text-[10px] text-blue-500/60 ms-1">×{r.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Clean watch indicator */}
        {isCleanWatch && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 bg-green-500/5 border border-green-500/10 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              <span className="text-xs text-green-500">
                 {t('admin.studentDetail.cleanWatch')}
              </span>
            </div>
          </div>
        )}

        {/* IP footer */}
        {s.ip_address && s.ip_address !== 'unknown' && (
          <div className={`flex items-center gap-2 px-4 py-2 border-t border-border/30 ${
            isDiffIP ? 'bg-orange-500/5' : 'bg-muted/20'
          }`}>
            <Globe className="w-3 h-3 shrink-0 text-muted-foreground" />
            <span className="text-[11px] font-mono text-muted-foreground" dir="ltr">{s.ip_address}</span>
            {isDiffIP && (
              <Badge className="text-[10px] px-1.5 h-4 bg-orange-500/15 text-orange-500 border-orange-500/20 hover:bg-orange-500/15 gap-0.5">
                 <AlertTriangle className="w-3 h-3" />
                {t('admin.studentDetail.differentIP')}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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
