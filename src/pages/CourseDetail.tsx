import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Play,
  Clock,
  BookOpen,
  CheckCircle2,
  Lock,
  User,
  Star,
  ChevronLeft,
  ChevronRight,
  FileText,
  Video,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import heroImage from '@/assets/hero-rider.jpg';

interface Lesson {
  id: string;
  title: string;
  title_ar: string | null;
  description: string | null;
  description_ar: string | null;
  video_url: string | null;
  duration_minutes: number | null;
  position: number;
  is_published: boolean;
  is_free: boolean;
}

interface Chapter {
  id: string;
  title: string;
  title_ar: string | null;
  description: string | null;
  description_ar: string | null;
  position: number;
  is_published: boolean;
  is_free: boolean;
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  title_ar: string | null;
  description: string | null;
  description_ar: string | null;
  thumbnail_url: string | null;
  price: number;
  difficulty_level: string;
  duration_hours: number | null;
  total_lessons: number | null;
  instructor_id: string | null;
}

interface LessonProgress {
  lesson_id: string;
  is_completed: boolean;
}

const CourseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  // Fetch course details
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as Course | null;
    },
    enabled: !!id,
  });

  // Fetch chapters with lessons
  const { data: chapters = [], isLoading: chaptersLoading } = useQuery({
    queryKey: ['chapters', id],
    queryFn: async () => {
      const { data: chaptersData, error: chaptersError } = await supabase
        .from('chapters')
        .select('*')
        .eq('course_id', id)
        .order('position', { ascending: true });

      if (chaptersError) throw chaptersError;

      // Fetch lessons for each chapter
      const chaptersWithLessons = await Promise.all(
        (chaptersData || []).map(async (chapter) => {
          const { data: lessons, error: lessonsError } = await supabase
            .from('lessons')
            .select('*')
            .eq('chapter_id', chapter.id)
            .order('position', { ascending: true });

          if (lessonsError) throw lessonsError;

          return {
            ...chapter,
            lessons: lessons || [],
          } as Chapter;
        })
      );

      return chaptersWithLessons;
    },
    enabled: !!id,
  });

  // Fetch enrollment status
  const { data: enrollment } = useQuery({
    queryKey: ['enrollment', id, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('course_enrollments')
        .select('*')
        .eq('course_id', id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  // Fetch lesson progress
  const { data: lessonProgress = [] } = useQuery({
    queryKey: ['lesson-progress', id, user?.id],
    queryFn: async () => {
      if (!user || !chapters.length) return [];
      
      const lessonIds = chapters.flatMap(ch => ch.lessons.map(l => l.id));
      if (!lessonIds.length) return [];

      const { data, error } = await supabase
        .from('lesson_progress')
        .select('lesson_id, is_completed')
        .eq('user_id', user.id)
        .in('lesson_id', lessonIds);

      if (error) throw error;
      return (data || []) as LessonProgress[];
    },
    enabled: !!id && !!user && chapters.length > 0,
  });

  // Enroll mutation
  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!user || !id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('course_enrollments')
        .insert({
          user_id: user.id,
          course_id: id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment', id] });
      toast.success(isRTL ? 'تم التسجيل بنجاح!' : 'Successfully enrolled!');
    },
    onError: (error: any) => {
      toast.error(error.message || (isRTL ? 'فشل التسجيل' : 'Failed to enroll'));
    },
  });

  // Calculate progress
  const totalLessons = chapters.reduce((acc, ch) => acc + ch.lessons.length, 0);
  const completedLessons = lessonProgress.filter(lp => lp.is_completed).length;
  const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const isEnrolled = !!enrollment;
  const isLoading = courseLoading || chaptersLoading;

  const isLessonCompleted = (lessonId: string) => {
    return lessonProgress.some(lp => lp.lesson_id === lessonId && lp.is_completed);
  };

  const isLessonLocked = (lesson: Lesson, chapter: Chapter) => {
    if (!isEnrolled && !lesson.is_free && !chapter.is_free) return true;
    return false;
  };

  const getDifficultyLabel = (level: string) => {
    const labels: Record<string, { en: string; ar: string }> = {
      beginner: { en: 'Beginner', ar: 'مبتدئ' },
      intermediate: { en: 'Intermediate', ar: 'متوسط' },
      advanced: { en: 'Advanced', ar: 'متقدم' },
    };
    return isRTL ? labels[level]?.ar || level : labels[level]?.en || level;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="section-container min-h-[60vh] flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {isRTL ? 'الدورة غير موجودة' : 'Course Not Found'}
          </h2>
          <p className="text-muted-foreground mb-6">
            {isRTL ? 'لم نتمكن من العثور على هذه الدورة' : "We couldn't find this course"}
          </p>
          <Link to="/courses">
            <Button variant="outline">
              <BackIcon className="w-4 h-4 me-2" />
              {isRTL ? 'العودة للدورات' : 'Back to Courses'}
            </Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24">
        {/* Hero Section */}
        <section className="relative">
          <div className="absolute inset-0 h-80 overflow-hidden">
            <img
              src={course.thumbnail_url || heroImage}
              alt={isRTL && course.title_ar ? course.title_ar : course.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
          </div>

          <div className="section-container relative z-10">
            {/* Back Link */}
            <Link to="/courses" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-6">
              <BackIcon className="w-5 h-5 me-1" />
              {isRTL ? 'العودة للدورات' : 'Back to Courses'}
            </Link>

            <div className="grid lg:grid-cols-3 gap-8">
              {/* Course Info */}
              <div className="lg:col-span-2">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="flex flex-wrap gap-3 mb-4">
                    <span className="px-3 py-1 rounded-full bg-secondary/80 text-secondary-foreground text-sm">
                      {getDifficultyLabel(course.difficulty_level)}
                    </span>
                    {course.price === 0 && (
                      <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium">
                        {isRTL ? 'مجاني' : 'Free'}
                      </span>
                    )}
                  </div>

                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
                    {isRTL && course.title_ar ? course.title_ar : course.title}
                  </h1>

                  <p className="text-lg text-muted-foreground mb-6">
                    {isRTL && course.description_ar ? course.description_ar : course.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-6 text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5" />
                      <span>{totalLessons} {isRTL ? 'درس' : 'lessons'}</span>
                    </div>
                    {course.duration_hours && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        <span>{course.duration_hours} {isRTL ? 'ساعات' : 'hours'}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* Enrollment Card */}
              <div className="lg:col-span-1">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="card-premium p-6 sticky top-28"
                >
                  {isEnrolled ? (
                    <>
                      <div className="flex items-center gap-2 text-primary mb-4">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-medium">{isRTL ? 'مسجل' : 'Enrolled'}</span>
                      </div>
                      
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-muted-foreground">{isRTL ? 'التقدم' : 'Progress'}</span>
                          <span className="text-foreground font-medium">{progressPercentage}%</span>
                        </div>
                        <Progress value={progressPercentage} className="h-2" />
                      </div>

                      <p className="text-sm text-muted-foreground mb-4">
                        {completedLessons} / {totalLessons} {isRTL ? 'دروس مكتملة' : 'lessons completed'}
                      </p>

                      <Button className="w-full btn-cta" asChild>
                        <Link to={chapters[0]?.lessons[0] ? `/courses/${id}/lessons/${chapters[0].lessons[0].id}` : '#'}>
                          <Play className="w-4 h-4 me-2" />
                          {isRTL ? 'متابعة التعلم' : 'Continue Learning'}
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="text-center mb-6">
                        <span className="text-4xl font-bold text-foreground">
                          {course.price === 0 
                            ? (isRTL ? 'مجاني' : 'Free') 
                            : `${course.price} ${isRTL ? 'ر.س' : 'SAR'}`}
                        </span>
                      </div>

                      {user ? (
                        <Button 
                          className="w-full btn-cta" 
                          onClick={() => enrollMutation.mutate()}
                          disabled={enrollMutation.isPending}
                        >
                          {enrollMutation.isPending 
                            ? (isRTL ? 'جاري التسجيل...' : 'Enrolling...') 
                            : (isRTL ? 'سجل الآن' : 'Enroll Now')}
                        </Button>
                      ) : (
                        <Button className="w-full btn-cta" asChild>
                          <Link to="/login">
                            {isRTL ? 'سجل دخول للتسجيل' : 'Login to Enroll'}
                          </Link>
                        </Button>
                      )}

                      <p className="text-xs text-muted-foreground text-center mt-4">
                        {isRTL 
                          ? 'الوصول الكامل لجميع محتويات الدورة'
                          : 'Full access to all course content'}
                      </p>
                    </>
                  )}
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* Course Content */}
        <section className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h2 className="text-2xl font-bold text-foreground mb-6">
              {isRTL ? 'محتوى الدورة' : 'Course Content'}
            </h2>

            <div className="text-sm text-muted-foreground mb-4">
              {chapters.length} {isRTL ? 'فصول' : 'chapters'} • {totalLessons} {isRTL ? 'دروس' : 'lessons'}
            </div>

            {chapters.length > 0 ? (
              <Accordion type="multiple" className="space-y-3">
                {chapters.map((chapter, chapterIndex) => (
                  <AccordionItem
                    key={chapter.id}
                    value={chapter.id}
                    className="card-premium border-border/50 overflow-hidden"
                  >
                    <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-4 text-start">
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold">
                          {chapterIndex + 1}
                        </span>
                        <div>
                          <h3 className="font-semibold text-foreground">
                            {isRTL && chapter.title_ar ? chapter.title_ar : chapter.title}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {chapter.lessons.length} {isRTL ? 'دروس' : 'lessons'}
                            {chapter.is_free && (
                              <span className="ms-2 text-primary">
                                ({isRTL ? 'مجاني' : 'Free'})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-0 pb-0">
                      <div className="border-t border-border/50">
                        {chapter.lessons.map((lesson, lessonIndex) => {
                          const locked = isLessonLocked(lesson, chapter);
                          const completed = isLessonCompleted(lesson.id);

                          return (
                            <div
                              key={lesson.id}
                              className={`flex items-center gap-4 px-6 py-4 border-b border-border/30 last:border-b-0 transition-colors ${
                                locked 
                                  ? 'opacity-60' 
                                  : 'hover:bg-muted/20 cursor-pointer'
                              }`}
                            >
                              <div className="flex-shrink-0">
                                {locked ? (
                                  <Lock className="w-5 h-5 text-muted-foreground" />
                                ) : completed ? (
                                  <CheckCircle2 className="w-5 h-5 text-primary" />
                                ) : (
                                  <Play className="w-5 h-5 text-muted-foreground" />
                                )}
                              </div>

                              <div className="flex-grow min-w-0">
                                <Link
                                  to={locked ? '#' : `/courses/${id}/lessons/${lesson.id}`}
                                  className={locked ? 'pointer-events-none' : ''}
                                >
                                  <h4 className="font-medium text-foreground truncate">
                                    {lessonIndex + 1}. {isRTL && lesson.title_ar ? lesson.title_ar : lesson.title}
                                  </h4>
                                </Link>
                                {lesson.is_free && !isEnrolled && (
                                  <span className="text-xs text-primary">
                                    {isRTL ? 'معاينة مجانية' : 'Free Preview'}
                                  </span>
                                )}
                              </div>

                              <div className="flex-shrink-0 flex items-center gap-3 text-sm text-muted-foreground">
                                {lesson.video_url && <Video className="w-4 h-4" />}
                                {lesson.duration_minutes && (
                                  <span>{lesson.duration_minutes} {isRTL ? 'د' : 'min'}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="card-premium p-12 text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {isRTL ? 'لا توجد فصول متاحة حتى الآن' : 'No chapters available yet'}
                </p>
              </div>
            )}
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default CourseDetail;
