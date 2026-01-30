import { useCallback } from 'react';
import { useMistakePatternDetection, type MistakeType, type ConceptArea, type SituationType } from './useMistakePatternDetection';

interface QuizMistakeParams {
  questionId: string;
  conceptArea: ConceptArea;
  situationType?: SituationType;
  lessonId?: string;
  chapterId?: string;
  courseId?: string;
  userAnswer: string;
  correctAnswer: string;
  userConfidence?: 'low' | 'medium' | 'high';
}

interface ScenarioMistakeParams {
  scenarioId: string;
  conceptArea: ConceptArea;
  situationType: SituationType;
  lessonId?: string;
  chapterId?: string;
  courseId?: string;
  chosenAction: string;
  safeAction: string;
  isSafeChoice: boolean;
}

/**
 * Hook that integrates mistake tracking into quiz and scenario components
 * Silently records learning mistakes for pattern detection
 */
export const useQuizMistakeTracking = () => {
  const { recordMistake } = useMistakePatternDetection();

  /**
   * Track a wrong quiz answer
   * Determines mistake type based on context
   */
  const trackQuizMistake = useCallback(async (params: QuizMistakeParams) => {
    const {
      questionId,
      conceptArea,
      situationType,
      lessonId,
      chapterId,
      courseId,
      userAnswer,
      correctAnswer,
      userConfidence
    } = params;

    // Determine mistake type
    let mistakeType: MistakeType = 'knowledge';
    
    // If user had high confidence but got it wrong = overconfidence
    if (userConfidence === 'high') {
      mistakeType = 'overconfidence';
    }

    await recordMistake({
      mistakeType,
      conceptArea,
      situationType,
      sourceType: 'quiz_question',
      sourceId: questionId,
      lessonId,
      chapterId,
      courseId,
      contextData: {
        user_answer: userAnswer,
        expected_answer: correctAnswer,
        confidence_level: userConfidence || 'unknown'
      }
    });
  }, [recordMistake]);

  /**
   * Track an unsafe scenario choice
   */
  const trackScenarioMistake = useCallback(async (params: ScenarioMistakeParams) => {
    const {
      scenarioId,
      conceptArea,
      situationType,
      lessonId,
      chapterId,
      courseId,
      chosenAction,
      safeAction,
      isSafeChoice
    } = params;

    // Only record if unsafe choice was made
    if (isSafeChoice) return;

    await recordMistake({
      mistakeType: 'scenario_judgment',
      conceptArea,
      situationType,
      sourceType: 'scenario_choice',
      sourceId: scenarioId,
      lessonId,
      chapterId,
      courseId,
      contextData: {
        chosen_action: chosenAction,
        safe_action: safeAction
      }
    });
  }, [recordMistake]);

  /**
   * Batch process quiz results and track mistakes
   * Useful for chapter tests where multiple questions are answered
   */
  const processQuizResults = useCallback(async (
    questions: Array<{
      id: string;
      conceptArea: ConceptArea;
      situationType?: SituationType;
      correctAnswer: string;
    }>,
    userAnswers: Record<string, string>,
    context: {
      lessonId?: string;
      chapterId?: string;
      courseId?: string;
    }
  ) => {
    const mistakes: string[] = [];

    for (const question of questions) {
      const userAnswer = userAnswers[question.id];
      if (userAnswer && userAnswer !== question.correctAnswer) {
        mistakes.push(question.id);
        
        // Track each mistake (but don't await to avoid blocking)
        trackQuizMistake({
          questionId: question.id,
          conceptArea: question.conceptArea,
          situationType: question.situationType,
          lessonId: context.lessonId,
          chapterId: context.chapterId,
          courseId: context.courseId,
          userAnswer,
          correctAnswer: question.correctAnswer
        });
      }
    }

    return {
      totalMistakes: mistakes.length,
      mistakeQuestionIds: mistakes
    };
  }, [trackQuizMistake]);

  return {
    trackQuizMistake,
    trackScenarioMistake,
    processQuizResults
  };
};

export default useQuizMistakeTracking;
