import React from 'react';
import LocalizedLink from '@/components/common/LocalizedLink';
import { useLanguage } from '@/contexts/LanguageContext';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Clock, CheckCircle, Play, TrendingUp, Trophy, ChevronRight, ChevronLeft, ShoppingCart, GraduationCap } from 'lucide-react';
import { LearningStats, EnrolledCourseItem, AvailableCourseItem } from '@/hooks/useUserProfile';
import { Button } from '@/components/ui/button';
import { useCurrency } from '@/contexts/CurrencyContext';

interface LearningProgressProps {
  stats: LearningStats;
}

const CourseRow: React.FC<{ course: EnrolledCourseItem; isRTL: boolean }> = ({ course, isRTL }) => {
  const title = isRTL && course.title_ar ? course.title_ar : course.title;
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  return (
    <LocalizedLink
      to={`/courses/${course.course_id}/learn`}
      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
    >
      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={title}
            width={96}
            height={96}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
          {title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <Progress value={course.progress_percentage} className="h-1.5 flex-1" />
          <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0" dir="ltr">
            {course.progress_percentage}%
          </span>
        </div>
      </div>
      <Chevron className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
    </LocalizedLink>
  );
};

const AvailableCourseRow: React.FC<{ course: AvailableCourseItem; isRTL: boolean }> = ({ course, isRTL }) => {
  const title = isRTL && course.title_ar ? course.title_ar : course.title;
  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  const { getCoursePriceInfo, symbol, symbolAr } = useCurrency();
  
  const priceInfo = getCoursePriceInfo(course.id, course.price, course.discount_percentage ?? undefined);
  const currSymbol = isRTL ? symbolAr : symbol;
  const hasDiscount = priceInfo.discountPct > 0;

  return (
    <LocalizedLink
      to={`/courses/${course.id}`}
      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
    >
      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={title}
            width={96}
            height={96}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
          {title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {hasDiscount ? (
            <>
              <span className="text-xs text-muted-foreground line-through" dir="ltr">
                {priceInfo.originalPrice} {currSymbol}
              </span>
              <span className="text-xs font-semibold text-primary" dir="ltr">
                {priceInfo.finalPrice} {currSymbol}
              </span>
            </>
          ) : (
            <span className="text-xs font-semibold text-primary" dir="ltr">
              {priceInfo.finalPrice > 0 ? `${priceInfo.finalPrice} ${currSymbol}` : (isRTL ? 'مجاني' : 'Free')}
            </span>
          )}
        </div>
      </div>
      <Chevron className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
    </LocalizedLink>
  );
};

const DIFFICULTY_LABELS: Record<string, { en: string; ar: string; icon: string }> = {
  beginner: { en: 'Beginner', ar: 'مبتدئ', icon: '🟢' },
  intermediate: { en: 'Intermediate', ar: 'متوسط', icon: '🟡' },
  advanced: { en: 'Advanced', ar: 'متقدم', icon: '🔴' },
  theoretical: { en: 'Theoretical Training', ar: 'تدريب نظري', icon: '📚' },
  practical: { en: 'Practical Training', ar: 'تدريب عملي', icon: '🏍️' },
};

export const LearningProgress: React.FC<LearningProgressProps> = ({ stats }) => {
  const { isRTL } = useLanguage();
  const completedCourses = stats.completedCourses || [];
  const remainingCourses = stats.remainingCourses || [];
  const availableCourses = stats.availableCourses || [];

  // Group available courses by difficulty_level
  const groupedAvailable = availableCourses.reduce<Record<string, AvailableCourseItem[]>>((acc, course) => {
    const key = course.difficulty_level || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(course);
    return acc;
  }, {});

  const statCards = [
    {
      icon: TrendingUp,
      value: `${stats.overallProgress}%`,
      label: isRTL ? 'التقدم الكلي' : 'Overall Progress',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      icon: BookOpen,
      value: stats.coursesInProgress.toString(),
      label: isRTL ? 'دورات قيد التقدم' : 'Courses In Progress',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      icon: CheckCircle,
      value: stats.completedLessons.toString(),
      label: isRTL ? 'دروس مكتملة' : 'Lessons Completed',
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      icon: Clock,
      value: `${stats.totalLearningTimeHours}h`,
      label: isRTL ? 'وقت التعلم' : 'Learning Time',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Card */}
      <div className="card-premium p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            {isRTL ? 'تقدم التعلم' : 'Learning Progress'}
          </h3>
        </div>

        {/* Overall Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {isRTL ? 'الإكمال الكلي' : 'Overall Completion'}
            </span>
            <span className="text-sm font-semibold text-primary" dir="ltr">{stats.overallProgress}%</span>
          </div>
          <Progress value={stats.overallProgress} className="h-3" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statCards.map((stat, index) => (
            <div key={index} className="bg-muted/30 rounded-lg p-4 text-center">
              <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center mx-auto mb-2`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Last Lesson */}
        {stats.lastLessonTitle && (
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center">
                <Play className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  {isRTL ? 'آخر درس شوهد' : 'Last Lesson Watched'}
                </p>
                <p className="font-medium text-foreground">
                  {isRTL ? stats.lastLessonTitleAr || stats.lastLessonTitle : stats.lastLessonTitle}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Completed Courses */}
      <div className="card-premium p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {isRTL ? 'الدورات المكتملة' : 'Completed Courses'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {completedCourses.length} {isRTL ? 'دورة' : completedCourses.length === 1 ? 'course' : 'courses'}
            </p>
          </div>
        </div>

        {completedCourses.length === 0 ? (
          <div className="text-center py-6 bg-muted/20 rounded-lg">
            <Trophy className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {isRTL ? 'لم تكمل أي دورة بعد' : 'No completed courses yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {completedCourses.map((course) => (
              <CourseRow key={course.course_id} course={course} isRTL={isRTL} />
            ))}
          </div>
        )}
      </div>

      {/* In-Progress Courses */}
      {remainingCourses.length > 0 && (
        <div className="card-premium p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {isRTL ? 'الدورات قيد التقدم' : 'In-Progress Courses'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {remainingCourses.length} {isRTL ? 'دورة' : remainingCourses.length === 1 ? 'course' : 'courses'}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {remainingCourses.map((course) => (
              <CourseRow key={course.course_id} course={course} isRTL={isRTL} />
            ))}
          </div>
        </div>
      )}

      {/* Available Courses (Not Enrolled) — grouped by difficulty */}
      {availableCourses.length > 0 && (
        <div className="card-premium p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {isRTL ? 'الدورات المتبقية' : 'Remaining Courses'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {availableCourses.length} {isRTL ? 'دورة متاحة للتسجيل' : availableCourses.length === 1 ? 'course available' : 'courses available'}
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {Object.entries(groupedAvailable).map(([level, courses]) => {
              const labelInfo = DIFFICULTY_LABELS[level] || { en: level, ar: level, icon: '📖' };
              return (
                <div key={level}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">{labelInfo.icon}</span>
                    <h4 className="text-sm font-semibold text-foreground">
                      {isRTL ? labelInfo.ar : labelInfo.en}
                    </h4>
                    <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                      {courses.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {courses.map((course) => (
                      <AvailableCourseRow key={course.id} course={course} isRTL={isRTL} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 text-center">
            <LocalizedLink to="/courses">
              <Button variant="outline" size="sm" className="gap-2">
                <ShoppingCart className="w-4 h-4" />
                {isRTL ? 'تصفح جميع الدورات' : 'Browse All Courses'}
              </Button>
            </LocalizedLink>
          </div>
        </div>
      )}
    </div>
  );
};
