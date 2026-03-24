import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog as SubDialog,
  DialogContent as SubDialogContent,
  DialogHeader as SubDialogHeader,
  DialogTitle as SubDialogTitle,
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
  GraduationCap,
  Clock,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface CourseStudentsDialogProps {
  courseId: string | null;
  courseTitle: string;
  onClose: () => void;
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

interface StudentDetail {
  // All courses this student purchased
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

const CourseStudentsDialog: React.FC<CourseStudentsDialogProps> = ({
  courseId,
  courseTitle,
  onClose,
}) => {
  const { isRTL } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  // Fetch enrolled students for this course
  const { data: students = [], isLoading } = useQuery({
    queryKey: ['course-students', courseId],
    queryFn: async () => {
      if (!courseId) return [];

      // Get enrollments
      const { data: enrollments, error } = await supabase
        .from('course_enrollments')
        .select('user_id, enrolled_at, progress_percentage, completed_at')
        .eq('course_id', courseId)
        .order('enrolled_at', { ascending: false });

      if (error) throw error;
      if (!enrollments?.length) return [];

      const userIds = enrollments.map((e) => e.user_id);

      // Fetch profiles and emails in parallel
      const [profilesRes, emailsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, full_name, phone, city, country, avatar_url')
          .in('user_id', userIds),
        supabase
          .from('tap_charges')
          .select('user_id, customer_email')
          .in('user_id', userIds)
          .not('customer_email', 'is', null),
      ]);

      const profileMap = new Map(
        (profilesRes.data || []).map((p) => [p.user_id, p])
      );
      const emailMap = new Map<string, string>();
      (emailsRes.data || []).forEach((e) => {
        if (e.customer_email && !emailMap.has(e.user_id)) {
          emailMap.set(e.user_id, e.customer_email);
        }
      });

      return enrollments.map((e) => ({
        user_id: e.user_id,
        enrolled_at: e.enrolled_at,
        progress_percentage: e.progress_percentage,
        completed_at: e.completed_at,
        profile: profileMap.get(e.user_id) || null,
        email: emailMap.get(e.user_id) || null,
      })) as EnrolledStudent[];
    },
    enabled: !!courseId,
  });

  // Fetch detail for selected student
  const { data: studentDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['student-detail', selectedStudent],
    queryFn: async (): Promise<StudentDetail> => {
      if (!selectedStudent) return { allEnrollments: [], totalLessonsCompleted: 0 };

      // Get all enrollments for this student
      const { data: enrollments } = await supabase
        .from('course_enrollments')
        .select('course_id, enrolled_at, progress_percentage, completed_at')
        .eq('user_id', selectedStudent);

      if (!enrollments?.length) return { allEnrollments: [], totalLessonsCompleted: 0 };

      const courseIds = enrollments.map((e) => e.course_id);

      // Fetch courses, reviews, payments, and lesson progress in parallel
      const [coursesRes, reviewsRes, tapRes, manualRes, progressRes] =
        await Promise.all([
          supabase
            .from('courses')
            .select('id, title, title_ar')
            .in('id', courseIds),
          supabase
            .from('course_reviews')
            .select('course_id, rating, comment')
            .eq('user_id', selectedStudent)
            .in('course_id', courseIds),
          supabase
            .from('tap_charges')
            .select('course_id, amount, currency, created_at, payment_method, status')
            .eq('user_id', selectedStudent)
            .eq('status', 'CAPTURED')
            .in('course_id', courseIds),
          supabase
            .from('manual_payments')
            .select('course_id, amount, currency, created_at, payment_method, status')
            .eq('user_id', selectedStudent)
            .eq('status', 'approved')
            .in('course_id', courseIds),
          supabase
            .from('lesson_progress')
            .select('lesson_id, is_completed')
            .eq('user_id', selectedStudent)
            .eq('is_completed', true),
        ]);

      const courseMap = new Map(
        (coursesRes.data || []).map((c) => [c.id, c])
      );
      const reviewMap = new Map(
        (reviewsRes.data || []).map((r) => [r.course_id, r])
      );

      // Merge tap + manual payments, pick first per course
      const paymentMap = new Map<
        string,
        { amount: number; currency: string; date: string; method: string }
      >();
      [...(tapRes.data || []), ...(manualRes.data || [])].forEach((p) => {
        if (p.course_id && !paymentMap.has(p.course_id)) {
          paymentMap.set(p.course_id, {
            amount: Number(p.amount),
            currency: p.currency || 'SAR',
            date: p.created_at,
            method: p.payment_method || '-',
          });
        }
      });

      // Count lessons per course (we need chapters → lessons mapping)
      const { data: chapters } = await supabase
        .from('chapters')
        .select('id, course_id')
        .in('course_id', courseIds);

      const chapterIds = (chapters || []).map((ch) => ch.id);
      const { data: lessons } = chapterIds.length
        ? await supabase
            .from('lessons')
            .select('id, chapter_id')
            .in('chapter_id', chapterIds)
        : { data: [] };

      // Map lesson → course
      const chapterCourseMap = new Map(
        (chapters || []).map((ch) => [ch.id, ch.course_id])
      );
      const lessonCourseMap = new Map<string, string>();
      (lessons || []).forEach((l) => {
        const cId = chapterCourseMap.get(l.chapter_id);
        if (cId) lessonCourseMap.set(l.id, cId);
      });

      // Total lessons per course
      const totalLessonsPerCourse = new Map<string, number>();
      (lessons || []).forEach((l) => {
        const cId = chapterCourseMap.get(l.chapter_id);
        if (cId) totalLessonsPerCourse.set(cId, (totalLessonsPerCourse.get(cId) || 0) + 1);
      });

      // Completed lessons per course
      const completedPerCourse = new Map<string, number>();
      (progressRes.data || []).forEach((p) => {
        const cId = lessonCourseMap.get(p.lesson_id);
        if (cId) completedPerCourse.set(cId, (completedPerCourse.get(cId) || 0) + 1);
      });

      const allEnrollments = enrollments.map((e) => {
        const course = courseMap.get(e.course_id);
        const review = reviewMap.get(e.course_id);
        const payment = paymentMap.get(e.course_id);
        return {
          course_id: e.course_id,
          course_title: isRTL && (course as any)?.title_ar
            ? (course as any).title_ar
            : course?.title || '-',
          enrolled_at: e.enrolled_at,
          progress_percentage: e.progress_percentage,
          completed_at: e.completed_at,
          lessons_completed: completedPerCourse.get(e.course_id) || 0,
          total_lessons: totalLessonsPerCourse.get(e.course_id) || 0,
          review_rating: review?.rating || null,
          review_comment: review?.comment || null,
          purchase_amount: payment?.amount || null,
          purchase_currency: payment?.currency || null,
          purchase_date: payment?.date || null,
          payment_method: payment?.method || null,
        };
      });

      return {
        allEnrollments,
        totalLessonsCompleted: (progressRes.data || []).length,
      };
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
      return format(new Date(date), 'dd MMM yyyy', {
        locale: isRTL ? ar : undefined,
      });
    } catch {
      return '-';
    }
  };

  const selectedStudentData = students.find(
    (s) => s.user_id === selectedStudent
  );

  return (
    <>
      <Dialog open={!!courseId} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {isRTL ? 'طلاب الدورة' : 'Course Students'}
              <span className="text-muted-foreground font-normal text-sm">
                — {courseTitle}
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* Search */}
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={
                isRTL
                  ? 'البحث بالاسم أو البريد أو الهاتف...'
                  : 'Search by name, email or phone...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-10"
            />
          </div>

          {/* Summary */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {students.length} {isRTL ? 'طالب' : 'students'}
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              {students.filter((s) => s.completed_at).length}{' '}
              {isRTL ? 'أكملوا' : 'completed'}
            </span>
          </div>

          {/* Table */}
          <ScrollArea className="flex-1 min-h-0">
            {isLoading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  {isRTL ? 'لا يوجد طلاب مسجلين' : 'No enrolled students'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                    <TableHead>{isRTL ? 'التقدم' : 'Progress'}</TableHead>
                    <TableHead>
                      {isRTL ? 'تاريخ التسجيل' : 'Enrolled'}
                    </TableHead>
                    <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead className="text-end">
                      {isRTL ? 'التفاصيل' : 'Details'}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.user_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">
                            {student.profile?.full_name || (isRTL ? 'بدون اسم' : 'No name')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {student.email || student.profile?.phone || '-'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{
                                width: `${Math.min(student.progress_percentage, 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {Math.round(student.progress_percentage)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(student.enrolled_at)}
                      </TableCell>
                      <TableCell>
                        {student.completed_at ? (
                          <Badge className="bg-green-500/10 text-green-500">
                            {isRTL ? 'مكتمل' : 'Completed'}
                          </Badge>
                        ) : student.progress_percentage > 0 ? (
                          <Badge className="bg-blue-500/10 text-blue-500">
                            {isRTL ? 'قيد التعلم' : 'In Progress'}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            {isRTL ? 'لم يبدأ' : 'Not Started'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedStudent(student.user_id)}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Student Detail Sub-Dialog */}
      <Dialog
        open={!!selectedStudent}
        onOpenChange={(open) => !open && setSelectedStudent(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              {selectedStudentData?.profile?.full_name || (isRTL ? 'تفاصيل الطالب' : 'Student Details')}
            </DialogTitle>
          </DialogHeader>

          {/* Student info summary */}
          {selectedStudentData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-muted-foreground text-xs mb-1">
                  {isRTL ? 'البريد' : 'Email'}
                </p>
                <p className="font-medium truncate">
                  {selectedStudentData.email || '-'}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-muted-foreground text-xs mb-1">
                  {isRTL ? 'الهاتف' : 'Phone'}
                </p>
                <p className="font-medium">
                  {selectedStudentData.profile?.phone || '-'}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-muted-foreground text-xs mb-1">
                  {isRTL ? 'الموقع' : 'Location'}
                </p>
                <p className="font-medium truncate">
                  {[
                    selectedStudentData.profile?.city,
                    selectedStudentData.profile?.country,
                  ]
                    .filter(Boolean)
                    .join(', ') || '-'}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-muted-foreground text-xs mb-1">
                  {isRTL ? 'الدورات المشتراة' : 'Courses'}
                </p>
                <p className="font-medium">
                  {studentDetail?.allEnrollments.length || 0}
                </p>
              </div>
            </div>
          )}

          {/* All courses detail table */}
          <ScrollArea className="flex-1 min-h-0">
            {detailLoading ? (
              <div className="space-y-3 p-4">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !studentDetail?.allEnrollments.length ? (
              <p className="text-center text-muted-foreground py-8">
                {isRTL ? 'لا توجد بيانات' : 'No data available'}
              </p>
            ) : (
              <div className="space-y-3">
                {studentDetail.allEnrollments.map((enrollment) => (
                  <div
                    key={enrollment.course_id}
                    className="border border-border rounded-lg p-4 space-y-3"
                  >
                    {/* Course title */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-foreground">
                          {enrollment.course_title}
                        </span>
                      </div>
                      {enrollment.completed_at ? (
                        <Badge className="bg-green-500/10 text-green-500">
                          {isRTL ? 'مكتمل' : 'Completed'}
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-500/10 text-blue-500">
                          {Math.round(enrollment.progress_percentage)}%
                        </Badge>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: `${Math.min(enrollment.progress_percentage, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {enrollment.lessons_completed}/{enrollment.total_lessons}{' '}
                        {isRTL ? 'درس' : 'lessons'}
                      </span>
                    </div>

                    {/* Info grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>{isRTL ? 'التسجيل:' : 'Enrolled:'}</span>
                        <span className="text-foreground">
                          {formatDate(enrollment.enrolled_at)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-muted-foreground">
                        <DollarSign className="w-3 h-3" />
                        <span>{isRTL ? 'السعر:' : 'Price:'}</span>
                        <span className="text-foreground">
                          {enrollment.purchase_amount != null
                            ? `${enrollment.purchase_amount} ${enrollment.purchase_currency}`
                            : isRTL ? 'غير متاح' : 'N/A'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{isRTL ? 'الشراء:' : 'Purchased:'}</span>
                        <span className="text-foreground">
                          {enrollment.purchase_date
                            ? formatDate(enrollment.purchase_date)
                            : '-'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Star className="w-3 h-3" />
                        <span>{isRTL ? 'التقييم:' : 'Rating:'}</span>
                        <span className="text-foreground">
                          {enrollment.review_rating != null
                            ? `${enrollment.review_rating}/5`
                            : isRTL ? 'لا يوجد' : 'None'}
                        </span>
                      </div>
                    </div>

                    {/* Review comment */}
                    {enrollment.review_comment && (
                      <div className="bg-muted/30 rounded p-2 text-xs text-muted-foreground italic">
                        "{enrollment.review_comment}"
                      </div>
                    )}

                    {/* Payment method */}
                    {enrollment.payment_method && (
                      <p className="text-xs text-muted-foreground">
                        {isRTL ? 'طريقة الدفع:' : 'Payment method:'}{' '}
                        <span className="text-foreground">{enrollment.payment_method}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CourseStudentsDialog;
