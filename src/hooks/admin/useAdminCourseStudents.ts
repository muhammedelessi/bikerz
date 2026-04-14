import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EnrolledStudent {
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

export const useAdminCourseStudents = ({ courseId, searchQuery }: { courseId?: string; searchQuery: string }) => {
  const { data: course } = useQuery({
    queryKey: ['course-title', courseId],
    queryFn: async () => {
      if (!courseId) return null;
      const { data } = await supabase.from('courses').select('title, title_ar').eq('id', courseId).single();
      return data;
    },
    enabled: !!courseId,
  });

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
          : Promise.resolve({ data: [] as any[] }),
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

  const filteredStudents = students.filter((s) => {
    const name = s.profile?.full_name?.toLowerCase() || '';
    const email = s.email?.toLowerCase() || '';
    const phone = s.profile?.phone || '';
    const q = searchQuery.toLowerCase();
    return name.includes(q) || email.includes(q) || phone.includes(q);
  });

  const completedCount = students.filter((s) => s.completed_at || s.progress_percentage >= 100).length;
  const inProgressCount = students.filter((s) => !s.completed_at && s.progress_percentage > 0 && s.progress_percentage < 100).length;
  const avgProgress = students.length ? Math.round(students.reduce((sum, s) => sum + s.progress_percentage, 0) / students.length) : 0;

  return {
    course,
    students,
    isLoading,
    filteredStudents,
    completedCount,
    inProgressCount,
    avgProgress,
  };
};
