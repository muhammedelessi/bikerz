import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface LessonRecapInsertProps {
  conceptArea: string;
  recapContent?: string;
  recapContentAr?: string;
  className?: string;
}

// Default recap content for common concept areas
const DEFAULT_RECAPS = {
  en: {
    braking: "Remember: Progressive braking means applying pressure gradually. Start light, then increase pressure smoothly. This prevents wheel lock-up and maintains control.",
    cornering: "Key principle: Look where you want to go, not at obstacles. Your bike follows your eyes. Enter corners wide, apex at the middle, exit wide.",
    awareness: "Stay alert: Constantly scan your surroundings. Check mirrors every 5-8 seconds. Be aware of blind spots and anticipate other drivers' actions.",
    traffic_rules: "Safety first: Traffic rules exist to protect everyone. Following them isn't just legal—it's smart riding.",
    emergency_response: "In emergencies: Stay calm, brake progressively, look for escape routes. Your training kicks in when you need it most.",
    visibility: "Be seen: Use your lights, wear bright gear, and position yourself where other drivers can see you.",
    speed_control: "Speed wisdom: Ride at a pace that gives you time to react. The right speed depends on conditions, not just limits.",
    lane_positioning: "Own your lane: Position yourself for visibility and escape routes. The center of the lane isn't always the safest spot.",
    hazard_detection: "Scan ahead: Look 12-15 seconds ahead. Identify potential hazards early so you have time to react.",
    weather_conditions: "Adapt to conditions: Rain, wind, and temperature all affect your ride. Adjust your speed and following distance accordingly."
  },
  ar: {
    braking: "تذكر: الفرملة التدريجية تعني تطبيق الضغط تدريجياً. ابدأ بخفة، ثم زد الضغط بسلاسة. هذا يمنع قفل العجلات ويحافظ على السيطرة.",
    cornering: "المبدأ الأساسي: انظر إلى حيث تريد الذهاب، وليس إلى العوائق. دراجتك تتبع عينيك. ادخل المنعطفات من الخارج، القمة في المنتصف، اخرج من الخارج.",
    awareness: "ابق متيقظاً: امسح محيطك باستمرار. تحقق من المرايا كل 5-8 ثواني. كن على دراية بالنقاط العمياء وتوقع تصرفات السائقين الآخرين.",
    traffic_rules: "السلامة أولاً: قواعد المرور موجودة لحماية الجميع. اتباعها ليس فقط قانونياً—إنه قيادة ذكية.",
    emergency_response: "في حالات الطوارئ: ابق هادئاً، اضغط على الفرامل تدريجياً، ابحث عن طرق الهروب. تدريبك يفيدك عندما تحتاجه أكثر.",
    visibility: "كن مرئياً: استخدم أضواءك، ارتدِ ملابس ساطعة، وضع نفسك حيث يمكن للسائقين الآخرين رؤيتك.",
    speed_control: "حكمة السرعة: اركب بسرعة تمنحك وقتاً للتفاعل. السرعة المناسبة تعتمد على الظروف، وليس فقط الحدود.",
    lane_positioning: "امتلك مسارك: ضع نفسك للرؤية وطرق الهروب. مركز المسار ليس دائماً الأكثر أماناً.",
    hazard_detection: "امسح للأمام: انظر 12-15 ثانية للأمام. حدد المخاطر المحتملة مبكراً حتى يكون لديك وقت للتفاعل.",
    weather_conditions: "تكيف مع الظروف: المطر والرياح ودرجة الحرارة كلها تؤثر على رحلتك. عدل سرعتك ومسافة التتبع وفقاً لذلك."
  }
};

/**
 * Subtle recap insert component
 * Provides a brief knowledge refresher without being intrusive
 * Feels natural and embedded in the learning flow
 */
export const LessonRecapInsert = ({
  conceptArea,
  recapContent,
  recapContentAr,
  className
}: LessonRecapInsertProps) => {
  const { language } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const isRTL = language === 'ar';

  // Get content based on language
  const content = language === 'ar' 
    ? (recapContentAr || DEFAULT_RECAPS.ar[conceptArea as keyof typeof DEFAULT_RECAPS['ar']] || DEFAULT_RECAPS.ar.awareness)
    : (recapContent || DEFAULT_RECAPS.en[conceptArea as keyof typeof DEFAULT_RECAPS['en']] || DEFAULT_RECAPS.en.awareness);

  const title = language === 'ar' ? 'تذكير سريع' : 'Quick Reminder';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className={cn(
        "border-s-4 border-amber-400 bg-amber-50/50 dark:bg-amber-950/20 rounded-e-lg overflow-hidden",
        className
      )}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full p-3 flex items-center gap-3 text-start hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors",
        )}
      >
        <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="flex-1 font-medium text-amber-900 dark:text-amber-200 text-sm">
          {title}
        </span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className={cn(
              "px-3 pb-3 text-sm text-amber-800 dark:text-amber-300 leading-relaxed",
              isRTL && "text-right"
            )}>
              {content}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default LessonRecapInsert;
