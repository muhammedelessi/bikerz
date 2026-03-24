import { supabase } from "@/integrations/supabase/client";

export interface EnrollmentWithProgress {
  course_id: string;
  progress_percentage: number;
  completed_at: string | null;
  has_reviewed: boolean;
}

export const fetchEnrollmentsWithLiveProgress = async (
  userId: string,
): Promise<EnrollmentWithProgress[]> => {
  const { data: enrollmentRows, error: enrollmentError } = await supabase
    .from("course_enrollments")
    .select("course_id, progress_percentage, completed_at")
    .eq("user_id", userId);

  if (enrollmentError) throw enrollmentError;
  if (!enrollmentRows?.length) return [];

  const courseIds = enrollmentRows.map((row) => row.course_id);

  const { data: lessonRows, error: lessonError } = await supabase
    .from("lessons")
    .select("id, chapters!inner(course_id)")
    .eq("is_published", true)
    .eq("chapters.is_published", true)
    .in("chapters.course_id", courseIds);

  if (lessonError) throw lessonError;
  if (!lessonRows?.length) {
    return enrollmentRows as EnrollmentWithProgress[];
  }

  const lessonCourseMap = new Map<string, string>();
  const totalPerCourse = new Map<string, number>();

  for (const lesson of lessonRows as any[]) {
    const chapterRel = Array.isArray(lesson.chapters)
      ? lesson.chapters[0]
      : lesson.chapters;
    const courseId = chapterRel?.course_id as string | undefined;

    if (!courseId) continue;

    lessonCourseMap.set(lesson.id, courseId);
    totalPerCourse.set(courseId, (totalPerCourse.get(courseId) || 0) + 1);
  }

  const lessonIds = Array.from(lessonCourseMap.keys());
  if (!lessonIds.length) {
    return enrollmentRows as EnrollmentWithProgress[];
  }

  const { data: completedRows, error: completedError } = await supabase
    .from("lesson_progress")
    .select("lesson_id")
    .eq("user_id", userId)
    .eq("is_completed", true)
    .in("lesson_id", lessonIds);

  if (completedError) throw completedError;

  const completedPerCourse = new Map<string, number>();

  for (const row of completedRows || []) {
    const courseId = lessonCourseMap.get(row.lesson_id);
    if (!courseId) continue;
    completedPerCourse.set(courseId, (completedPerCourse.get(courseId) || 0) + 1);
  }

  // Fetch user reviews to know which courses have been rated
  const { data: reviewRows } = await supabase
    .from("course_reviews")
    .select("course_id")
    .eq("user_id", userId)
    .in("course_id", courseIds);

  const reviewedCourses = new Set((reviewRows || []).map((r) => r.course_id));

  return enrollmentRows.map((row) => {
    const totalLessons = totalPerCourse.get(row.course_id) || 0;
    const completedLessons = completedPerCourse.get(row.course_id) || 0;

    const liveProgress =
      totalLessons > 0
        ? Math.round((completedLessons / totalLessons) * 100)
        : row.progress_percentage || 0;

    return {
      ...row,
      progress_percentage: liveProgress,
      has_reviewed: reviewedCourses.has(row.course_id),
    };
  }) as EnrollmentWithProgress[];
};