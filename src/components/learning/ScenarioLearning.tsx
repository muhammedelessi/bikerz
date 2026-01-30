import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Bike
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuizMistakeTracking } from '@/hooks/useQuizMistakeTracking';
import type { ConceptArea, SituationType } from '@/hooks/useMistakePatternDetection';

interface ScenarioChoice {
  id: string;
  text: string;
  text_ar?: string;
  isSafe: boolean;
  explanation?: string;
  explanation_ar?: string;
}

interface RidingScenario {
  id: string;
  title: string;
  title_ar?: string;
  description: string;
  description_ar?: string;
  conceptArea: ConceptArea;
  situationType: SituationType;
  choices: ScenarioChoice[];
  imageUrl?: string;
}

interface ScenarioLearningProps {
  scenarios: RidingScenario[];
  lessonId?: string;
  chapterId?: string;
  courseId?: string;
  onComplete: (results: { 
    totalScenarios: number; 
    safeChoices: number;
    unsafeChoices: number;
  }) => void;
  onClose?: () => void;
}

/**
 * Scenario-based learning component for judgment training
 * Tracks unsafe choices silently for pattern detection
 * Never shames - only guides towards safer decisions
 */
export const ScenarioLearning: React.FC<ScenarioLearningProps> = ({
  scenarios,
  lessonId,
  chapterId,
  courseId,
  onComplete,
  onClose
}) => {
  const { isRTL } = useLanguage();
  const { trackScenarioMistake } = useQuizMistakeTracking();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<ScenarioChoice | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [results, setResults] = useState({ safeChoices: 0, unsafeChoices: 0 });
  const [isComplete, setIsComplete] = useState(false);

  const currentScenario = scenarios[currentIndex];
  const progress = ((currentIndex + 1) / scenarios.length) * 100;
  const NextIcon = isRTL ? ArrowLeft : ArrowRight;

  const handleChoiceSelect = useCallback(async (choice: ScenarioChoice) => {
    if (showFeedback) return;

    setSelectedChoice(choice);
    setShowFeedback(true);

    // Track mistake if unsafe choice (silently)
    if (!choice.isSafe) {
      const safeChoice = currentScenario.choices.find(c => c.isSafe);
      
      await trackScenarioMistake({
        scenarioId: currentScenario.id,
        conceptArea: currentScenario.conceptArea,
        situationType: currentScenario.situationType,
        lessonId,
        chapterId,
        courseId,
        chosenAction: choice.text,
        safeAction: safeChoice?.text || '',
        isSafeChoice: false
      });

      setResults(prev => ({ ...prev, unsafeChoices: prev.unsafeChoices + 1 }));
    } else {
      setResults(prev => ({ ...prev, safeChoices: prev.safeChoices + 1 }));
    }
  }, [showFeedback, currentScenario, trackScenarioMistake, lessonId, chapterId, courseId]);

  const handleNext = useCallback(() => {
    if (currentIndex < scenarios.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedChoice(null);
      setShowFeedback(false);
    } else {
      setIsComplete(true);
      onComplete({
        totalScenarios: scenarios.length,
        ...results
      });
    }
  }, [currentIndex, scenarios.length, onComplete, results]);

  const getChoiceStyles = (choice: ScenarioChoice) => {
    if (!showFeedback) {
      return 'border-border hover:border-primary/50 cursor-pointer';
    }

    if (choice.isSafe) {
      return 'border-green-500 bg-green-500/10';
    }

    if (choice.id === selectedChoice?.id && !choice.isSafe) {
      return 'border-amber-500 bg-amber-500/10';
    }

    return 'border-border opacity-50';
  };

  // Completion screen
  if (isComplete) {
    const safePercentage = Math.round((results.safeChoices / scenarios.length) * 100);
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card-premium p-6 text-center"
      >
        <div className="w-20 h-20 rounded-full bg-primary/20 mx-auto mb-4 flex items-center justify-center">
          <Bike className="w-10 h-10 text-primary" />
        </div>

        <h3 className="text-2xl font-bold text-foreground mb-2">
          {isRTL ? 'أحسنت!' : 'Well Done!'}
        </h3>

        <p className="text-muted-foreground mb-4">
          {isRTL 
            ? `اخترت القرارات الآمنة في ${results.safeChoices} من ${scenarios.length} مواقف`
            : `You made safe decisions in ${results.safeChoices} out of ${scenarios.length} scenarios`}
        </p>

        {results.unsafeChoices > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4 text-start">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {isRTL 
                ? 'لا بأس! التعلم من السيناريوهات يساعدك على اتخاذ قرارات أفضل على الطريق.'
                : "That's okay! Learning from scenarios helps you make better decisions on the road."}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          {onClose && (
            <Button variant="outline" onClick={onClose} className="flex-1">
              {isRTL ? 'إغلاق' : 'Close'}
            </Button>
          )}
          <Button onClick={() => {
            setCurrentIndex(0);
            setSelectedChoice(null);
            setShowFeedback(false);
            setResults({ safeChoices: 0, unsafeChoices: 0 });
            setIsComplete(false);
          }} className="flex-1">
            {isRTL ? 'تدرب مرة أخرى' : 'Practice Again'}
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-premium p-4 sm:p-6"
    >
      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">
          {isRTL 
            ? `السيناريو ${currentIndex + 1} من ${scenarios.length}` 
            : `Scenario ${currentIndex + 1} of ${scenarios.length}`}
        </span>
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">
            {isRTL ? 'تدريب السلامة' : 'Safety Training'}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted rounded-full mb-6 overflow-hidden">
        <motion.div 
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Scenario */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentScenario.id}
          initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
        >
          {/* Scenario description */}
          <div className="bg-muted/50 rounded-xl p-4 mb-6">
            <h4 className="font-semibold text-foreground mb-2">
              {isRTL && currentScenario.title_ar 
                ? currentScenario.title_ar 
                : currentScenario.title}
            </h4>
            <p className="text-sm text-muted-foreground">
              {isRTL && currentScenario.description_ar 
                ? currentScenario.description_ar 
                : currentScenario.description}
            </p>
          </div>

          {/* Choices */}
          <div className="space-y-3 mb-6">
            <p className="text-sm font-medium text-foreground mb-2">
              {isRTL ? 'ماذا ستفعل؟' : 'What would you do?'}
            </p>
            
            {currentScenario.choices.map((choice, index) => (
              <motion.button
                key={choice.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleChoiceSelect(choice)}
                disabled={showFeedback}
                className={cn(
                  "w-full p-4 rounded-xl border-2 text-start transition-all",
                  getChoiceStyles(choice),
                  !showFeedback && "hover:shadow-md"
                )}
              >
                <div className={cn(
                  "flex items-start gap-3",
                  isRTL && "flex-row-reverse text-right"
                )}>
                  <div className={cn(
                    "w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                    showFeedback && choice.isSafe && "border-green-500 bg-green-500 text-white",
                    showFeedback && !choice.isSafe && choice.id === selectedChoice?.id && "border-amber-500 bg-amber-500 text-white"
                  )}>
                    {showFeedback && choice.isSafe ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : showFeedback && !choice.isSafe && choice.id === selectedChoice?.id ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : (
                      <span className="text-sm font-bold">
                        {String.fromCharCode(65 + index)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <span className="text-foreground">
                      {isRTL && choice.text_ar ? choice.text_ar : choice.text}
                    </span>
                    
                    {/* Feedback explanation - shown after selection */}
                    {showFeedback && (choice.isSafe || choice.id === selectedChoice?.id) && choice.explanation && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className={cn(
                          "text-sm mt-2",
                          choice.isSafe ? "text-green-700 dark:text-green-300" : "text-amber-700 dark:text-amber-300"
                        )}
                      >
                        {isRTL && choice.explanation_ar 
                          ? choice.explanation_ar 
                          : choice.explanation}
                      </motion.p>
                    )}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Continue button - shown after feedback */}
          {showFeedback && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Button onClick={handleNext} className="w-full">
                {currentIndex < scenarios.length - 1 
                  ? (isRTL ? 'السيناريو التالي' : 'Next Scenario')
                  : (isRTL ? 'إنهاء' : 'Finish')}
                <NextIcon className="w-4 h-4 ms-2" />
              </Button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};

export default ScenarioLearning;
