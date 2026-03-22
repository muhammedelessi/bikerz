import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Play, Clock, BookOpen, ChevronRight, ChevronLeft, Loader2, CheckCircle2, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import heroImage from '@/assets/hero-rider.webp';
import SEOHead from '@/components/common/SEOHead';

interface Course {
  id: string;
  title: string;
  title_ar: string | null;
  description: string | null;
  description_ar: string | null;
  thumbnail_url: string | null;
  difficulty_level: string;
  price: number;
  is_published: boolean;
}

interface CourseWithStats extends Course {
  lessonCount: number;
  totalDurationMinutes: number;
}

interface Enrollment {
  course_id: string;
  progress_percentage: number;
}

const Courses: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses-with-stats'],
    queryFn: async () => {
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select(`
          id, title, title_ar, description, description_ar,
          thumbnail_url, difficulty_level, price, is_published,
          chapters (
            id, is_published,
            lessons ( id, duration_minutes, is_published )
          )
        `)
        .eq('is_published', true)
        .order('created_at', { ascending: true });

      if (coursesError) throw coursesError;

      const coursesWithStats: CourseWithStats[] = (coursesData || []).map((course: any) => {
        let lessonCount = 0;
        let totalDurationMinutes = 0;
        (course.chapters || []).forEach((chapter: any) => {
          if (chapter.is_published) {
            (chapter.lessons || []).forEach((lesson: any) => {
              if (lesson.is_published) {
                lessonCount++;
                totalDurationMinutes += lesson.duration_minutes || 0;
              }
            });
          }
        });
        return {
          id: course.id,
          title: course.title,
          title_ar: course.title_ar,
          description: course.description,
          description_ar: course.description_ar,
          thumbnail_url: course.thumbnail_url,
          difficulty_level: course.difficulty_level,
          price: course.price,
          is_published: course.is_published,
          lessonCount,
          totalDurationMinutes,
        };
      });
      return coursesWithStats;
    },
  });

  // Fetch enrollments for logged-in user
  const { data: enrollments = [] } = useQuery({
    queryKey: ['user-enrollments', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('course_enrollments')
        .select('course_id, progress_percentage')
        .eq('user_id', user.id);
      if (error) throw error;
      return (data || []) as Enrollment[];
    },
    enabled: !!user,
  });

  const getEnrollment = (courseId: string) =>
    enrollments.find(e => e.course_id === courseId);

  const getDifficultyLabel = (level: string) => t(`courses.difficulty.${level}` as const);

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'intermediate': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'advanced': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-primary/20 text-primary border-primary/30';
    }
  };

  const formatDuration = (minutes: number) => {
    if (!minutes || minutes === 0) return `0${t('courses.hour')}`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}${t('courses.minutes')}`;
    return mins > 0 ? `${hours}${t('courses.hour')} ${mins}${t('courses.minutes')}` : `${hours}${t('courses.hour')}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Motorcycle Riding Courses"
        description="Browse our expert-led motorcycle riding courses. From beginner basics to advanced techniques, find the perfect course to boost your riding skills."
        canonical="/courses"
        breadcrumbs={[{ name: 'Home', url: '/' }, { name: 'Courses', url: '/courses' }]}
      />
      <Navbar />

      <main className="pt-[var(--navbar-h)]">
        <section className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h1 className="section-title text-foreground mb-3 sm:mb-4">
              {t('courses.title')}
            </h1>
            <p className="section-subtitle">
              {t('courses.subtitle')}
            </p>
          </motion.div>

          {isLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {!isLoading && courses.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
                <BookOpen className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                {t('courses.noCourses')}
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {t('courses.noCoursesDescription')}
              </p>
            </div>
          )}

          {!isLoading && courses.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {courses.map((course, index) => {
                const title = isRTL && course.title_ar ? course.title_ar : course.title;
                const description = isRTL && course.description_ar ? course.description_ar : course.description;
                const enrollment = getEnrollment(course.id);
                const isEnrolled = !!enrollment;

                return (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <Link to={`/courses/${course.id}`}>
                      <div className="group card-premium overflow-hidden transition-all duration-500 hover:border-primary/40 relative">
                        {/* Enrolled indicator */}
                        {isEnrolled && (
                          <div className="absolute top-3 start-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/90 backdrop-blur-sm text-primary-foreground text-xs font-semibold">
                            <Zap className="w-3 h-3" />
                            {isRTL ? 'مسجّل' : 'Enrolled'}
                          </div>
                        )}

                        {/* Image */}
                        <div className="relative aspect-[16/10] sm:aspect-[16/9] overflow-hidden">
                          <img
                            src={course.thumbnail_url || heroImage}
                            alt={title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                          <div className="absolute bottom-3 start-3">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform shadow-glow">
                              <Play className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground ms-0.5" />
                            </div>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 sm:p-6">
                          <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-1">
                            {title}
                          </h3>
                          <p className="text-muted-foreground text-sm mb-3 sm:mb-4 line-clamp-2">
                            {description}
                          </p>

                          {/* Enrollment progress */}
                          {isEnrolled && (
                            <div className="mb-3">
                              <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="text-muted-foreground">
                                  {isRTL ? 'التقدم' : 'Progress'}
                                </span>
                                <span className="font-semibold text-primary">
                                  {enrollment.progress_percentage}%
                                </span>
                              </div>
                              <Progress value={enrollment.progress_percentage} className="h-1.5" />
                            </div>
                          )}

                          {/* Meta */}
                          <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground mb-3">
                            <div className="flex items-center gap-1.5">
                              <BookOpen className="w-4 h-4" />
                              <span>{course.lessonCount} {t('courses.lesson')}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-4 h-4" />
                              <span>{formatDuration(course.totalDurationMinutes)}</span>
                            </div>
                          </div>

                          {/* Enroll Now / Continue Button */}
                          <Button variant="default" size="sm" className="w-full">
                            {isEnrolled
                              ? (isRTL ? 'أكمل التعلم' : 'Continue Learning')
                              : (isRTL ? 'سجّل الآن' : 'Enroll Now')
                            }
                          </Button>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Courses;
