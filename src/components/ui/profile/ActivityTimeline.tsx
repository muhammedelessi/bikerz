import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { format, formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { 
  Clock, 
  BookOpen, 
  Play, 
  Trophy, 
  TrendingUp,
  CheckCircle,
  Star
} from 'lucide-react';
import { ActivityItem } from '@/hooks/useUserProfile';

interface ActivityTimelineProps {
  activities: ActivityItem[];
}

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  lesson_complete: CheckCircle,
  course_start: BookOpen,
  achievement_unlock: Trophy,
  level_change: TrendingUp,
  quiz_pass: Star,
  video_watch: Play,
};

const ACTIVITY_COLORS: Record<string, string> = {
  lesson_complete: 'text-green-400 bg-green-500/10',
  course_start: 'text-blue-400 bg-blue-500/10',
  achievement_unlock: 'text-yellow-400 bg-yellow-500/10',
  level_change: 'text-purple-400 bg-purple-500/10',
  quiz_pass: 'text-primary bg-primary/10',
  video_watch: 'text-secondary bg-secondary/10',
};

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ activities }) => {
  const { isRTL } = useLanguage();

  // Generate sample activities if none exist
  const displayActivities = activities.length > 0 ? activities : [
    {
      id: '1',
      activity_type: 'course_start',
      title: 'Started Motorcycle Fundamentals course',
      title_ar: 'بدأ دورة أساسيات الدراجة النارية',
      description: null,
      description_ar: null,
      entity_id: null,
      entity_type: null,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: '2',
      activity_type: 'lesson_complete',
      title: 'Completed: Introduction to Safety',
      title_ar: 'أكمل: مقدمة في السلامة',
      description: null,
      description_ar: null,
      entity_id: null,
      entity_type: null,
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const locale = isRTL ? ar : enUS;
    return formatDistanceToNow(date, { addSuffix: true, locale });
  };

  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'PPp', { locale: isRTL ? ar : enUS });
  };

  return (
    <div className="card-premium p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
          <Clock className="w-5 h-5 text-secondary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          {isRTL ? 'سجل النشاط' : 'Activity Timeline'}
        </h3>
      </div>

      {displayActivities.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">
            {isRTL ? 'لا يوجد نشاط بعد' : 'No activity yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {displayActivities.map((activity, index) => {
            const IconComponent = ACTIVITY_ICONS[activity.activity_type] || Clock;
            const colorClasses = ACTIVITY_COLORS[activity.activity_type] || 'text-muted-foreground bg-muted/30';

            return (
              <div key={activity.id} className="relative flex gap-4">
                {/* Timeline connector */}
                {index < displayActivities.length - 1 && (
                  <div className="absolute start-5 top-12 bottom-0 w-px bg-border" />
                )}

                {/* Icon */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colorClasses}`}>
                  <IconComponent className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pb-4">
                  <p className="text-sm font-medium text-foreground">
                    {isRTL ? activity.title_ar || activity.title : activity.title}
                  </p>
                  {activity.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {isRTL ? activity.description_ar || activity.description : activity.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1" title={formatFullDate(activity.created_at)}>
                    {formatDate(activity.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
