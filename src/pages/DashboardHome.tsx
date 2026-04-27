import React from 'react';
import SEOHead from '@/components/common/SEOHead';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { fetchEnrollmentsWithLiveProgress } from '@/lib/enrollmentProgress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import GamificationPanel from '@/components/gamification/GamificationPanel';
import { BookOpen, Play, Clock, Trophy, CheckCircle2 } from 'lucide-react';

interface EnrolledCourse {
  id: string;
  course_id: string;
  progress_percentage: number;
  totalLessons: number;
  completedLessons: number;
  course: {
    id: string;
    title: string;
    title_ar: string | null;
    thumbnail_url: string | null;
    total_lessons: number | null;
  };
  nextLesson?: {
    id: string;
    title: string;
    title_ar: string | null;
  } | null;
}

interface LearningStats {
  totalCourses: number;
  totalWatchTimeSeconds: number;
  overallProgress: number;
}

const DashboardHome: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();

  // Fetch enrolled courses with live progress
  const { data: enrolledCourses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ['enrolled-courses', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get live progress
      const liveProgress = await fetchEnrollmentsWithLiveProgress(user.id);
      const liveMap = new Map(liveProgress.map(lp => [lp.course_id, lp.progress_percentage]));

      const { data: enrollments, error } = await supabase
        .from('course_enrollments')
        .select(`
          id,
          course_id,
          progress_percentage,
          course:courses!course_enrollments_course_id_fkey(
            id,
            title,
            title_ar,
            thumbnail_url,
            total_lessons
          )
        `)
        .eq('user_id', user.id)
        .order('enrolled_at', { ascending: false });

      if (error) throw error;

      // Get all completed lesson ids for next lesson detection
      const { data: completedLessons } = await supabase
        .from('lesson_progress')
        .select('lesson_id')
        .eq('user_id', user.id)
        .eq('is_completed', true);

      const completedIds = new Set((completedLessons || []).map(l => l.lesson_id));

      // Fetch next lesson for each enrollment (respecting chapter order)
      const coursesWithNextLesson = await Promise.all(
        (enrollments || []).map(async (enrollment) => {
          const { data: chapters } = await supabase
            .from('chapters')
            .select('id, position')
            .eq('course_id', enrollment.course_id)
            .eq('is_published', true)
            .order('position', { ascending: true });

          let nextLesson = null;
          let totalLessons = 0;
          let completedCount = 0;

          if (chapters && chapters.length > 0) {
            // Fetch lessons per chapter in order to respect chapter→lesson ordering
            for (const chapter of chapters) {
              const { data: lessons } = await supabase
                .from('lessons')
                .select('id, title, title_ar')
                .eq('chapter_id', chapter.id)
                .eq('is_published', true)
                .order('position', { ascending: true });

              if (!lessons) continue;
              totalLessons += lessons.length;
              for (const lesson of lessons) {
                if (completedIds.has(lesson.id)) {
                  completedCount++;
                } else if (!nextLesson) {
                  nextLesson = lesson;
                }
              }
            }
          }

          const realProgress = liveMap.get(enrollment.course_id) ?? enrollment.progress_percentage;

          return {
            ...enrollment,
            progress_percentage: realProgress,
            nextLesson,
            totalLessons,
            completedLessons: completedCount,
          } as EnrolledCourse;
        })
      );

      return coursesWithNextLesson;
    },
    enabled: !!user?.id,
  });

  // Fetch learning stats from database
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['learning-stats', user?.id],
    queryFn: async (): Promise<LearningStats> => {
      if (!user?.id) return { totalCourses: 0, totalWatchTimeSeconds: 0, overallProgress: 0 };

      // Get total enrolled courses
      const { count: totalCourses } = await supabase
        .from('course_enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Get total watch time from lesson progress
      const { data: progress } = await supabase
        .from('lesson_progress')
        .select('watch_time_seconds')
        .eq('user_id', user.id);

      const totalWatchTimeSeconds = (progress || []).reduce(
        (acc, p) => acc + (p.watch_time_seconds || 0),
        0
      );

      // Get overall progress (average of all enrollments)
      const { data: enrollments } = await supabase
        .from('course_enrollments')
        .select('progress_percentage')
        .eq('user_id', user.id);

      const overallProgress = enrollments && enrollments.length > 0
        ? Math.round(enrollments.reduce((acc, e) => acc + e.progress_percentage, 0) / enrollments.length)
        : 0;

      return {
        totalCourses: totalCourses || 0,
        totalWatchTimeSeconds,
        overallProgress,
      };
    },
    enabled: !!user?.id,
  });

  // Format watch time
  const formatWatchTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const isLoading = coursesLoading || statsLoading;

  if (!user) {
    return null;
  }

  return (
    <>
      <SEOHead title="My Dashboard" description="Access your BIKERZ Academy dashboard. Track your course progress, manage enrollments, and continue learning." noindex />
      <div className="p-6 space-y-8 safe-area-bottom">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {isLoading ? (
              <>
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
              </>
            ) : (
              [
                { 
                  icon: BookOpen, 
                  value: stats?.totalCourses || 0, 
                  label: t('dashboard.enrolledCourses')
                },
                { 
                  icon: Clock, 
                  value: formatWatchTime(stats?.totalWatchTimeSeconds || 0), 
                  label: t('dashboard.learningTime')
                },
                { 
                  icon: Trophy, 
                  value: `${stats?.overallProgress || 0}%`, 
                  label: t('dashboard.overallProgress')
                },
              ].map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="card-premium p-4 sm:p-6"
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <stat.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xl sm:text-2xl font-bold text-foreground">{stat.value}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{stat.label}</p>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* Gamification Panel */}
          <GamificationPanel compact />

          {/* Continue Learning */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-foreground mb-3 sm:mb-4">
              {t('dashboard.continueLearning')}
            </h2>

            {isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-32 rounded-xl" />
              </div>
            ) : enrolledCourses.length === 0 ? (
              <div className="card-premium p-8 text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t('dashboard.noCoursesEnrolled')}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {t('dashboard.startLearningJourney')}
                </p>
                <Link to="/courses">
                  <Button variant="cta">
                    {t('dashboard.browseCourses')}
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {enrolledCourses.map((enrollment, index) => {
                  const course = enrollment.course as EnrolledCourse['course'];
                  const title = isRTL && course.title_ar ? course.title_ar : course.title;
                  const isCompleted = enrollment.progress_percentage >= 100;
                  const nextLessonTitle = enrollment.nextLesson
                    ? (isRTL && enrollment.nextLesson.title_ar 
                        ? enrollment.nextLesson.title_ar 
                        : enrollment.nextLesson.title)
                    : null;

                  return (
                    <motion.div
                      key={enrollment.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                    >
                      <Link to={enrollment.nextLesson ? `/courses/${course.id}/lessons/${enrollment.nextLesson.id}` : `/courses/${course.id}/learn`} className="block h-full">
                        <div className="group card-premium flex flex-col h-full transition-all duration-300 hover:border-primary/40 hover:shadow-lg active:scale-[0.99] overflow-hidden">
                          {/* Thumbnail with overlay */}
                          <div className="relative aspect-video w-full overflow-hidden bg-muted">
                            {course.thumbnail_url ? (
                              <picture>
                                <source srcSet={course.thumbnail_url} type="image/webp" />
                                <img
                                  src={course.thumbnail_url}
                                  alt={title}
                                  width={1280}
                                  height={720}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                  loading="lazy"
                                  decoding="async"
                                />
                              </picture>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-muted">
                                <BookOpen className="w-10 h-10 text-muted-foreground" />
                              </div>
                            )}
                            {/* Play overlay */}
                            <div className="absolute inset-0 bg-background/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
                                <Play className="w-5 h-5 text-primary-foreground ms-0.5" />
                              </div>
                            </div>
                            {/* Completion badge */}
                            {isCompleted && (
                              <div className="absolute top-2 end-2 bg-green-500/90 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {t('dashboard.completed')}
                              </div>
                            )}
                            {/* Progress percentage circle */}
                            {!isCompleted && (
                              <div className="absolute top-2 end-2 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow border border-border">
                                <span className="text-xs font-bold text-primary">{enrollment.progress_percentage}%</span>
                              </div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 flex flex-col p-4 gap-3">
                            <h3 className="font-bold text-sm sm:text-base text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                              {title}
                            </h3>

                            {/* Lesson count */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>
                                {enrollment.completedLessons}/{enrollment.totalLessons} {t('courses.lesson')}
                              </span>
                            </div>

                            {/* Next lesson hint */}
                            {nextLessonTitle && !isCompleted && (
                              <div className="flex items-start gap-2 bg-muted/50 rounded-lg p-2.5 mt-auto">
                                <Play className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">
                                    {t('dashboard.upNext')}
                                  </p>
                                  <p className="text-xs text-foreground font-medium line-clamp-1">{nextLessonTitle}</p>
                                </div>
                              </div>
                            )}

                            {isCompleted && (
                              <div className="flex items-center gap-2 bg-green-500/10 rounded-lg p-2.5 mt-auto">
                                <Trophy className="w-4 h-4 text-green-500" />
                                <span className="text-xs font-medium text-green-600 dark:text-green-400">
                                  {t('dashboard.courseCompletedWellDone')}
                                </span>
                              </div>
                            )}

                            {/* Progress bar */}
                            <div className="space-y-1.5">
                              <div className="progress-track h-2 rounded-full">
                                <div
                                  className={`h-full rounded-full transition-all duration-700 ${isCompleted ? 'bg-green-500' : 'progress-fill'}`}
                                  style={{ width: `${enrollment.progress_percentage}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-muted-foreground">{t('dashboard.progress')}</span>
                                <span className={`font-semibold ${isCompleted ? 'text-green-500' : 'text-primary'}`}>
                                  {enrollment.progress_percentage}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Quick Actions */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-foreground mb-3 sm:mb-4">
              {t('dashboard.quickActions')}
            </h2>
            <div className="flex flex-col sm:flex-row gap-4 w-full">
              <Link to="/courses" className="block flex-1">
                <div className="card-premium p-3 sm:p-4 flex items-center gap-3 sm:gap-4 hover:border-primary/40 active:scale-[0.99] transition-all touch-target w-full">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-medium text-sm sm:text-base text-foreground">
                    {t('dashboard.browseCourses')}
                  </span>
                </div>
              </Link>
            </div>
          </section>
      </div>
    </>
  );
};

export default DashboardHome;
