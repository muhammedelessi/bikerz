import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  Users,
  BookOpen,
  CheckCircle,
  Star,
  Calendar,
  DollarSign,
  ChevronRight,
  ChevronLeft,
  GraduationCap,
  Clock,
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  Award,
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

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

interface StudentDetail {
  allEnrollments: {
    course_id: string;
    course_title: string;
    enrolled_at: string;
    progress_percentage: number;
    completed_at: string | null;
    lessons_completed: number;
    total_lessons: number;
    review_rating: number | null;
    review_comment: string | null;
    purchase_amount: number | null;
    purchase_currency: string | null;
    purchase_date: string | null;
    payment_method: string | null;
  }[];
  totalLessonsCompleted: number;
}

const AdminCourseStudents: React.FC = () => {
  const { id: courseId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  // Fetch course title
  const { data: course } = useQuery({
    queryKey: ['course-title', courseId],
    queryFn: async () => {
      if (!courseId) return null;
      const { data } = await supabase
        .from('courses')
        .select('title, title_ar')
        .eq('id', courseId)
        .single();
      return data;
    },
    enabled: !!courseId,
  });

  const courseTitle = isRTL && course?.title_ar ? course.title_ar : course?.title || '';

  // Fetch enrolled students
  const { data: students = [], isLoading } = useQuery({
    queryKey: ['course-students', courseId],
    queryFn: async () => {
      if (!courseId) return [];
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
    enabled: !!courseId,
  });

  // Fetch detail for selected student
  const { data: studentDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['student-detail', selectedStudent],
    queryFn: async (): Promise<StudentDetail> => {
      if (!selectedStudent) return { allEnrollments: [], totalLessonsCompleted: 0 };
      const { data: enrollments } = await supabase
        .from('course_enrollments')
        .select('course_id, enrolled_at, progress_percentage, completed_at')
        .eq('user_id', selectedStudent);
      if (!enrollments?.length) return { allEnrollments: [], totalLessonsCompleted: 0 };

      const courseIds = enrollments.map((e) => e.course_id);
      const [coursesRes, reviewsRes, tapRes, manualRes, progressRes] = await Promise.all([
        supabase.from('courses').select('id, title, title_ar').in('id', courseIds),
        supabase.from('course_reviews').select('course_id, rating, comment').eq('user_id', selectedStudent).in('course_id', courseIds),
        supabase.from('tap_charges').select('course_id, amount, currency, created_at, payment_method, status').eq('user_id', selectedStudent).eq('status', 'CAPTURED').in('course_id', courseIds),
        supabase.from('manual_payments').select('course_id, amount, currency, created_at, payment_method, status').eq('user_id', selectedStudent).eq('status', 'approved').in('course_id', courseIds),
        supabase.from('lesson_progress').select('lesson_id, is_completed').eq('user_id', selectedStudent).eq('is_completed', true),
      ]);

      const courseMap = new Map((coursesRes.data || []).map((c) => [c.id, c]));
      const reviewMap = new Map((reviewsRes.data || []).map((r) => [r.course_id, r]));
      const paymentMap = new Map<string, { amount: number; currency: string; date: string; method: string }>();
      [...(tapRes.data || []), ...(manualRes.data || [])].forEach((p) => {
        if (p.course_id && !paymentMap.has(p.course_id)) {
          paymentMap.set(p.course_id, { amount: Number(p.amount), currency: p.currency || 'SAR', date: p.created_at, method: p.payment_method || '-' });
        }
      });

      const { data: chapters } = await supabase.from('chapters').select('id, course_id').in('course_id', courseIds);
      const chapterIds = (chapters || []).map((ch) => ch.id);
      const { data: lessons } = chapterIds.length
        ? await supabase.from('lessons').select('id, chapter_id').in('chapter_id', chapterIds)
        : { data: [] };

      const chapterCourseMap = new Map((chapters || []).map((ch) => [ch.id, ch.course_id]));
      const lessonCourseMap = new Map<string, string>();
      (lessons || []).forEach((l) => {
        const cId = chapterCourseMap.get(l.chapter_id);
        if (cId) lessonCourseMap.set(l.id, cId);
      });
      const totalLessonsPerCourse = new Map<string, number>();
      (lessons || []).forEach((l) => {
        const cId = chapterCourseMap.get(l.chapter_id);
        if (cId) totalLessonsPerCourse.set(cId, (totalLessonsPerCourse.get(cId) || 0) + 1);
      });
      const completedPerCourse = new Map<string, number>();
      (progressRes.data || []).forEach((p) => {
        const cId = lessonCourseMap.get(p.lesson_id);
        if (cId) completedPerCourse.set(cId, (completedPerCourse.get(cId) || 0) + 1);
      });

      const allEnrollments = enrollments.map((e) => {
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

      return { allEnrollments, totalLessonsCompleted: (progressRes.data || []).length };
    },
    enabled: !!selectedStudent,
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

  const selectedStudentData = students.find((s) => s.user_id === selectedStudent);
  const completedCount = students.filter((s) => s.completed_at || s.progress_percentage >= 100).length;
  const inProgressCount = students.filter((s) => !s.completed_at && s.progress_percentage > 0 && s.progress_percentage < 100).length;
  const avgProgress = students.length
    ? Math.round(students.reduce((sum, s) => sum + s.progress_percentage, 0) / students.length)
    : 0;

  return (
    <AdminLayout>
      <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/courses')}
            className="shrink-0"
          >
            <BackIcon className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
              {isRTL ? 'طلاب الدورة' : 'Course Students'}
            </h1>
            <p className="text-sm text-muted-foreground truncate">{courseTitle}</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{students.length}</p>
              <p className="text-xs text-muted-foreground">{isRTL ? 'إجمالي الطلاب' : 'Total Students'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-green-600">{completedCount}</p>
              <p className="text-xs text-muted-foreground">{isRTL ? 'أكملوا الدورة' : 'Completed'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-5 h-5 text-blue-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-blue-600">{inProgressCount}</p>
              <p className="text-xs text-muted-foreground">{isRTL ? 'قيد التعلم' : 'In Progress'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Award className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-amber-600">{avgProgress}%</p>
              <p className="text-xs text-muted-foreground">{isRTL ? 'متوسط التقدم' : 'Avg Progress'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={isRTL ? 'البحث بالاسم أو البريد أو الهاتف...' : 'Search by name, email or phone...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ps-10 h-11"
          />
        </div>

        {/* Student List */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-6">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">
                  {searchQuery
                    ? (isRTL ? 'لا توجد نتائج للبحث' : 'No search results')
                    : (isRTL ? 'لا يوجد طلاب مسجلين' : 'No enrolled students')}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                        <TableHead>{isRTL ? 'التقدم' : 'Progress'}</TableHead>
                        <TableHead>{isRTL ? 'تاريخ التسجيل' : 'Enrolled'}</TableHead>
                        <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student) => (
                        <TableRow
                          key={student.user_id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setSelectedStudent(student.user_id)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="w-9 h-9 shrink-0">
                                <AvatarImage src={student.profile?.avatar_url || undefined} />
                                <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                                  {getInitials(student.profile?.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-medium text-foreground truncate">
                                  {student.profile?.full_name || (isRTL ? 'بدون اسم' : 'No name')}
                                </p>
                                <p className="text-xs text-muted-foreground truncate" dir="ltr" style={{ unicodeBidi: 'plaintext' as any }}>
                                  {student.email || student.profile?.phone || '-'}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 min-w-[120px]">
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    student.completed_at ? 'bg-green-500' :
                                    student.progress_percentage > 50 ? 'bg-primary' : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${Math.min(student.progress_percentage, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-muted-foreground tabular-nums w-10 text-end">
                                {Math.round(student.progress_percentage)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
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

                {/* Mobile Card List */}
                <div className="sm:hidden divide-y divide-border">
                  {filteredStudents.map((student) => (
                    <button
                      key={student.user_id}
                      onClick={() => setSelectedStudent(student.user_id)}
                      className="w-full text-start p-4 hover:bg-muted/30 transition-colors active:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 shrink-0">
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
                          <p className="text-xs text-muted-foreground truncate mt-0.5" dir="ltr" style={{ unicodeBidi: 'plaintext' as any }}>
                            {student.email || student.profile?.phone || '-'}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  student.completed_at ? 'bg-green-500' :
                                  student.progress_percentage > 50 ? 'bg-primary' : 'bg-amber-500'
                                }`}
                                style={{ width: `${Math.min(student.progress_percentage, 100)}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                              {Math.round(student.progress_percentage)}%
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              · {formatDate(student.enrolled_at)}
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
          </CardContent>
        </Card>

        {/* Student Detail Dialog */}
        <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
          <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] flex flex-col gap-4 p-4 sm:p-6 overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
            <DialogHeader className="space-y-1">
              <DialogTitle className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="w-8 h-8 shrink-0" onClick={() => setSelectedStudent(null)}>
                  <BackIcon className="w-4 h-4" />
                </Button>
                {selectedStudentData && (
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="w-9 h-9 shrink-0">
                      <AvatarImage src={selectedStudentData.profile?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                        {getInitials(selectedStudentData.profile?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-semibold truncate text-base">
                        {selectedStudentData.profile?.full_name || (isRTL ? 'تفاصيل الطالب' : 'Student Details')}
                      </p>
                      <p className="text-xs text-muted-foreground truncate" dir="ltr" style={{ unicodeBidi: 'plaintext' as any }}>
                        {selectedStudentData.email || ''}
                      </p>
                    </div>
                  </div>
                )}
              </DialogTitle>
            </DialogHeader>

            {/* Student Info Cards */}
            {selectedStudentData && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <InfoCard label={isRTL ? 'البريد الإلكتروني' : 'Email'} value={selectedStudentData.email || '-'} dir="ltr" isRTL={isRTL} />
                <InfoCard label={isRTL ? 'رقم الهاتف' : 'Phone'} value={selectedStudentData.profile?.phone || '-'} dir="ltr" isRTL={isRTL} />
                <InfoCard label={isRTL ? 'الموقع' : 'Location'} value={[selectedStudentData.profile?.city, selectedStudentData.profile?.country].filter(Boolean).join(', ') || '-'} />
                <InfoCard label={isRTL ? 'الدورات المشتراة' : 'Courses'} value={String(studentDetail?.allEnrollments.length || 0)} highlight />
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <GraduationCap className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{isRTL ? 'الدورات المسجلة' : 'Enrolled Courses'}</h3>
            </div>

            <ScrollArea className="flex-1 min-h-0" style={{ maxHeight: 'calc(90vh - 300px)' }}>
              {detailLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (<Skeleton key={i} className="h-32 w-full rounded-xl" />))}
                </div>
              ) : !studentDetail?.allEnrollments.length ? (
                <div className="py-12 text-center">
                  <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">{isRTL ? 'لا توجد بيانات' : 'No data available'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {studentDetail.allEnrollments.map((enrollment) => (
                    <EnrollmentCard key={enrollment.course_id} enrollment={enrollment} isRTL={isRTL} formatDate={formatDate} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

/* ─── Sub-components ─── */

const StudentStatusBadge: React.FC<{
  completedAt: string | null;
  progress: number;
  isRTL: boolean;
  compact?: boolean;
}> = ({ completedAt, progress, isRTL, compact }) => {
  if (completedAt) {
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

const InfoCard: React.FC<{
  label: string;
  value: string;
  dir?: string;
  isRTL?: boolean;
  highlight?: boolean;
}> = ({ label, value, dir, isRTL, highlight }) => (
  <div className={`rounded-xl p-3 ${highlight ? 'bg-primary/5 border border-primary/10' : 'bg-muted/50'}`}>
    <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">{label}</p>
    <p
      className={`text-sm font-medium truncate ${highlight ? 'text-primary' : 'text-foreground'}`}
      dir={dir}
      style={dir === 'ltr' && isRTL ? { unicodeBidi: 'plaintext' as any } : undefined}
    >
      {value}
    </p>
  </div>
);

const EnrollmentCard: React.FC<{
  enrollment: StudentDetail['allEnrollments'][number];
  isRTL: boolean;
  formatDate: (date: string) => string;
}> = ({ enrollment, isRTL, formatDate }) => (
  <div className="border border-border rounded-xl p-4 space-y-3 bg-card">
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <BookOpen className="w-4 h-4 text-primary" />
        </div>
        <span className="font-semibold text-foreground text-sm truncate">{enrollment.course_title}</span>
      </div>
      {enrollment.completed_at ? (
        <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/10 shrink-0 text-xs">{isRTL ? 'مكتمل' : 'Completed'}</Badge>
      ) : (
        <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/10 shrink-0 text-xs">{Math.round(enrollment.progress_percentage)}%</Badge>
      )}
    </div>
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${enrollment.completed_at ? 'bg-green-500' : 'bg-primary'}`}
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
  </div>
);

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

export default AdminCourseStudents;
