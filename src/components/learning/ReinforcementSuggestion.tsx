import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, RefreshCw, Route, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMistakePatternDetection, type ReinforcementType } from '@/hooks/useMistakePatternDetection';
import { cn } from '@/lib/utils';

interface ReinforcementData {
  id: string;
  reinforcement_type: ReinforcementType;
  target_lesson_id: string | null;
  content_data: {
    concept_area?: string;
    situation_type?: string;
    pattern_type?: string;
  };
  priority: number;
}

interface ReinforcementSuggestionProps {
  lessonId?: string;
  chapterId?: string;
  className?: string;
  variant?: 'inline' | 'card';
}

// Coach-like messages that never shame the user
const SUGGESTION_MESSAGES = {
  en: {
    lesson_suggestion: {
      title: "You may want to revisit this concept",
      description: "A quick review could help strengthen your understanding"
    },
    recap_insert: {
      title: "This situation often causes confusion",
      description: "Let's take a moment to clarify this together"
    },
    scenario_inject: {
      title: "Let's practice this scenario",
      description: "Additional practice will build your confidence"
    },
    pace_adjustment: {
      title: "Let's strengthen this area before moving forward",
      description: "Taking time now will help you master this skill"
    }
  },
  ar: {
    lesson_suggestion: {
      title: "قد ترغب في مراجعة هذا المفهوم",
      description: "مراجعة سريعة ستساعد في تعزيز فهمك"
    },
    recap_insert: {
      title: "هذا الموقف غالباً ما يسبب التباساً",
      description: "دعنا نأخذ لحظة لتوضيح هذا معاً"
    },
    scenario_inject: {
      title: "دعنا نتدرب على هذا السيناريو",
      description: "التدريب الإضافي سيبني ثقتك"
    },
    pace_adjustment: {
      title: "دعنا نعزز هذا المجال قبل المتابعة",
      description: "أخذ الوقت الآن سيساعدك على إتقان هذه المهارة"
    }
  }
};

const CONCEPT_LABELS = {
  en: {
    braking: 'Braking Techniques',
    cornering: 'Cornering Skills',
    awareness: 'Road Awareness',
    traffic_rules: 'Traffic Rules',
    emergency_response: 'Emergency Response',
    visibility: 'Visibility',
    speed_control: 'Speed Control',
    lane_positioning: 'Lane Positioning',
    hazard_detection: 'Hazard Detection',
    weather_conditions: 'Weather Riding'
  },
  ar: {
    braking: 'تقنيات الفرملة',
    cornering: 'مهارات الانعطاف',
    awareness: 'الوعي بالطريق',
    traffic_rules: 'قواعد المرور',
    emergency_response: 'الاستجابة للطوارئ',
    visibility: 'الرؤية',
    speed_control: 'التحكم بالسرعة',
    lane_positioning: 'وضعية المسار',
    hazard_detection: 'اكتشاف المخاطر',
    weather_conditions: 'القيادة في الطقس'
  }
};

const getIcon = (type: ReinforcementType) => {
  switch (type) {
    case 'lesson_suggestion':
      return BookOpen;
    case 'recap_insert':
      return RefreshCw;
    case 'scenario_inject':
      return Route;
    case 'pace_adjustment':
      return Gauge;
    default:
      return BookOpen;
  }
};

/**
 * Non-disruptive reinforcement suggestion component
 * Displays coach-like guidance without popups or blocking messages
 */
export const ReinforcementSuggestion = ({
  lessonId,
  chapterId,
  className,
  variant = 'card'
}: ReinforcementSuggestionProps) => {
  const { language } = useLanguage();
  const { getPendingReinforcements, markReinforcementDelivered, dismissReinforcement } = useMistakePatternDetection();
  const [reinforcements, setReinforcements] = useState<ReinforcementData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isRTL = language === 'ar';

  useEffect(() => {
    const fetchReinforcements = async () => {
      setIsLoading(true);
      const data = await getPendingReinforcements(lessonId, chapterId);
      setReinforcements(data as ReinforcementData[]);
      setIsLoading(false);
    };

    fetchReinforcements();
  }, [lessonId, chapterId, getPendingReinforcements]);

  const handleAccept = async (reinforcement: ReinforcementData) => {
    await markReinforcementDelivered(reinforcement.id);
    setReinforcements(prev => prev.filter(r => r.id !== reinforcement.id));
    // TODO: Navigate to suggested content or trigger recap
  };

  const handleDismiss = async (reinforcement: ReinforcementData) => {
    await dismissReinforcement(reinforcement.id);
    setReinforcements(prev => prev.filter(r => r.id !== reinforcement.id));
  };

  if (isLoading || reinforcements.length === 0) {
    return null;
  }

  // Only show the highest priority suggestion
  const suggestion = reinforcements[0];
  const messages = SUGGESTION_MESSAGES[language][suggestion.reinforcement_type];
  const Icon = getIcon(suggestion.reinforcement_type);
  const conceptLabel = suggestion.content_data?.concept_area 
    ? CONCEPT_LABELS[language][suggestion.content_data.concept_area as keyof typeof CONCEPT_LABELS['en']] || suggestion.content_data.concept_area
    : null;

  if (variant === 'inline') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10",
            className
          )}
        >
          <Icon className="h-5 w-5 text-primary shrink-0" />
          <span className="text-sm text-muted-foreground flex-1">
            {messages.title}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleAccept(suggestion)}
            className="text-primary hover:text-primary/80"
          >
            {language === 'ar' ? 'مراجعة' : 'Review'}
          </Button>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className={cn(
          "p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20",
          className
        )}
      >
        <div className={cn(
          "flex items-start gap-4",
        )}>
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          
          <div className="flex-1 space-y-2">
            <h4 className="font-medium text-foreground">
              {messages.title}
            </h4>
            <p className="text-sm text-muted-foreground">
              {messages.description}
            </p>
            
            {conceptLabel && (
              <span className="inline-block px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
                {conceptLabel}
              </span>
            )}
          </div>
        </div>

        <div className={cn(
          "flex gap-2 mt-4",
        )}>
          <Button
            variant="default"
            size="sm"
            onClick={() => handleAccept(suggestion)}
            className="flex-1"
          >
            {language === 'ar' ? 'نعم، دعني أراجع' : 'Yes, let me review'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDismiss(suggestion)}
            className="text-muted-foreground hover:text-foreground"
          >
            {language === 'ar' ? 'لاحقاً' : 'Later'}
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ReinforcementSuggestion;
