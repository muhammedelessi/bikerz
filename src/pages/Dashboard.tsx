import React, { useState, useEffect } from 'react';
import SEOHead from '@/components/common/SEOHead';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { fetchEnrollmentsWithLiveProgress } from '@/lib/enrollmentProgress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import LanguageToggle from '@/components/common/LanguageToggle';
import ProfileCompletionReminder from '@/components/profile/ProfileCompletionReminder';
import {
  BookOpen,
  Play,
  Clock,
  Trophy,
  ChevronRight,
  ChevronLeft,
  Home,
  GraduationCap,
  Settings,
  LogOut,
  Menu,
  X,
  Users,
  User,
  Loader2,
} from 'lucide-react';
import bikerzLogo from '@/assets/bikerz-logo.webp';

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
    title: string;
    title_ar: string | null;
  } | null;
}

interface LearningStats {
  totalCourses: number;
  totalWatchTimeSeconds: number;
  overallProgress: number;
}

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, profile, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

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

      // Fetch next lesson for each enrollment
      const coursesWithNextLesson = await Promise.all(
        (enrollments || []).map(async (enrollment) => {
          const { data: chapters } = await supabase
            .from('chapters')
            .select('id')
            .eq('course_id', enrollment.course_id)
            .eq('is_published', true)
            .order('position', { ascending: true });

          let nextLesson = null;
          let totalLessons = 0;
          let completedCount = 0;
          if (chapters && chapters.length > 0) {
            const { data: lessons } = await supabase
              .from('lessons')
              .select('id, title, title_ar')
              .in('chapter_id', chapters.map(c => c.id))
              .eq('is_published', true)
              .order('position', { ascending: true });

            totalLessons = lessons?.length || 0;
            completedCount = lessons?.filter(l => completedIds.has(l.id)).length || 0;
            nextLesson = lessons?.find(l => !completedIds.has(l.id)) || null;
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

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const navItems = [
    { icon: Home, label: t('nav.home'), to: '/' },
    { icon: BookOpen, label: t('nav.courses'), to: '/courses' },
    { icon: GraduationCap, label: t('dashboard.myCourses'), to: '/dashboard', active: true },
    { icon: Users, label: t('nav.mentors'), to: '/mentors' },
    { icon: User, label: t('profile.title'), to: '/profile' },
    ...(isAdmin ? [{ icon: Settings, label: t('nav.adminPanel'), to: '/admin' }] : []),
  ];

  const isLoading = coursesLoading || statsLoading;

  return (
    <div className="min-h-screen bg-background flex">
      <SEOHead title="My Dashboard" description="Access your BIKERZ Academy dashboard. Track your course progress, manage enrollments, and continue learning." noindex />
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 z-50 w-[280px] max-w-[85vw] bg-card border-e border-border transform transition-transform duration-300 ease-out lg:translate-x-0 ${
          sidebarOpen 
            ? 'translate-x-0' 
            : isRTL 
              ? 'translate-x-full' 
              : '-translate-x-full'
        } ${isRTL ? 'right-0' : 'left-0'}`}
      >
        <div className="flex flex-col h-full safe-area-inset">
          {/* Logo */}
          <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between">
            <Link to="/" className="flex items-center">
              <img
                src={bikerzLogo}
                alt="BIKERZ"
                className="h-10 sm:h-12 w-auto object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
               loading="lazy" />
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors touch-target"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 p-3 sm:p-4 space-y-1 sm:space-y-2 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-3 rounded-lg transition-all duration-300 touch-target ${
                  item.active
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground active:bg-muted/70'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* User Section */}
          <div className="p-3 sm:p-4 border-t border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center flex-shrink-0">
                <span className="text-secondary-foreground font-bold">
                  {profile?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">
                  {profile?.full_name || t('common.user')}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-muted-foreground hover:text-destructive touch-target"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 me-2" />
              {t('common.logout')}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ms-[280px] min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border safe-area-top">
          <div className="flex items-center justify-between p-3 sm:p-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors touch-target flex-shrink-0"
              >
                <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">
                  {t('dashboard.welcome')}, {profile?.full_name?.split(' ')[0] || t('common.user')}!
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  {t('dashboard.keepUpGreatWork')}
                </p>
              </div>
            </div>
            <LanguageToggle />
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-6 space-y-8 safe-area-bottom">
          {/* Profile Completion Reminder */}
          <ProfileCompletionReminder variant="card" />

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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {enrolledCourses.map((enrollment, index) => {
                  const course = enrollment.course as EnrolledCourse['course'];
                  const title = isRTL && course.title_ar ? course.title_ar : course.title;
                  const nextLessonTitle = enrollment.nextLesson
                    ? (isRTL && enrollment.nextLesson.title_ar 
                        ? enrollment.nextLesson.title_ar 
                        : enrollment.nextLesson.title)
                    : t('dashboard.courseCompleted');

                  return (
                    <motion.div
                      key={enrollment.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                    >
                      <Link to={`/courses/${course.id}/learn`}>
                        <div className="group card-premium p-3 sm:p-4 flex gap-3 sm:gap-4 transition-all duration-300 hover:border-primary/40 active:scale-[0.99]">
                          {/* Thumbnail */}
                          <div className="relative w-24 h-20 sm:w-32 sm:h-24 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                            {course.thumbnail_url ? (
                              <img
                                src={course.thumbnail_url}
                                alt={title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <BookOpen className="w-8 h-8 text-muted-foreground" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-background/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play className="w-6 h-6 sm:w-8 sm:h-8 text-primary-foreground" />
                            </div>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                              <h3 className="font-bold text-sm sm:text-base text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                                {title}
                              </h3>
                              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                                {t('dashboard.nextLesson')}{nextLessonTitle}
                              </p>
                            </div>

                            {/* Progress */}
                            <div className="space-y-1 mt-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">{t('dashboard.progress')}</span>
                                <span className="text-primary font-medium">{enrollment.progress_percentage}%</span>
                              </div>
                              <div className="progress-track">
                                <div
                                  className="progress-fill"
                                  style={{ width: `${enrollment.progress_percentage}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          <Chevron className="w-5 h-5 text-muted-foreground self-center opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
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
              {isRTL ? 'إجراءات سريعة' : 'Quick Actions'}
            </h2>
            <div className="flex flex-col sm:flex-row gap-4 w-full">
              <Link to="/courses" className="block flex-1">
                <div className="card-premium p-3 sm:p-4 flex items-center gap-3 sm:gap-4 hover:border-primary/40 active:scale-[0.99] transition-all touch-target w-full">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-medium text-sm sm:text-base text-foreground">
                    {isRTL ? 'تصفح الدورات' : 'Browse Courses'}
                  </span>
                </div>
              </Link>
              <Link to="/mentors" className="block flex-1">
                <div className="card-premium p-3 sm:p-4 flex items-center gap-3 sm:gap-4 hover:border-primary/40 active:scale-[0.99] transition-all touch-target w-full">
                  <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-secondary" />
                  </div>
                  <span className="font-medium text-sm sm:text-base text-foreground">
                    {isRTL ? 'ابحث عن مدرب' : 'Find a Mentor'}
                  </span>
                </div>
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
