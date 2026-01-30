import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Clock, CheckCircle, Play, TrendingUp } from 'lucide-react';
import { LearningStats } from '@/hooks/useUserProfile';

interface LearningProgressProps {
  stats: LearningStats;
}

export const LearningProgress: React.FC<LearningProgressProps> = ({ stats }) => {
  const { isRTL } = useLanguage();

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
          <span className="text-sm font-semibold text-primary">{stats.overallProgress}%</span>
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
  );
};
