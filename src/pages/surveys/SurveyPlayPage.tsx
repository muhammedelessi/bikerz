import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSurveys } from "@/hooks/survey/useSurveys";
import { useSurveyQuestions } from "@/hooks/survey/useSurveyQuestions";
import { useDynamicQuestions } from "@/hooks/survey/useDynamicQuestions";
import { useSurveyAnswers } from "@/hooks/survey/useSurveyAnswers";
import { useSurveyCompletion } from "@/hooks/survey/useSurveyCompletion";
import ProgressHeader from "@/components/ui/survey/ProgressHeader";
import QuestionCard from "@/components/ui/survey/QuestionCard";
import CompletionScreen from "@/components/ui/survey/CompletionScreen";
import { Button } from "@/components/ui/button";
import type { SurveyQuestion } from "@/types/survey";
import { User } from "lucide-react";

const PageLoader = () => (
  <div className="flex flex-1 min-h-[40vh] items-center justify-center bg-gradient-to-b from-muted/25 to-background">
    <div className="w-9 h-9 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
);

const SurveyPlayPage: React.FC = () => {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const { t } = useTranslation();
  const { data: surveys } = useSurveys();
  const survey = useMemo(() => surveys?.find((s) => s.id === surveyId), [surveys, surveyId]);
  const previousSurvey = useMemo(
    () => surveys?.find((s) => s.sort_order === (survey?.sort_order ?? 0) - 1),
    [surveys, survey],
  );

  const { data: allQuestions = [], isLoading: loadingQuestions } = useSurveyQuestions(surveyId);
  const { data: playableQuestions, isFetching: filtering } = useDynamicQuestions(survey, user?.id, previousSurvey, allQuestions);
  const questions: SurveyQuestion[] = playableQuestions ?? allQuestions;
  const questionsLenRef = useRef(0);
  questionsLenRef.current = questions.length;

  const { saveAnswer } = useSurveyAnswers(user?.id, surveyId);
  const { saveCompletion } = useSurveyCompletion(user?.id);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [yesCount, setYesCount] = useState(0);
  const [noCount, setNoCount] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const completedRef = useRef(false);

  const goProfile = useCallback(() => navigate("/profile"), [navigate]);
  const goQuizList = useCallback(() => navigate("/profile/surveys"), [navigate]);

  useEffect(() => {
    setCurrentIndex(0);
    setScore(0);
    setYesCount(0);
    setNoCount(0);
    setSelectedOptionId(null);
    setIsCompleted(false);
    completedRef.current = false;
  }, [surveyId]);

  useEffect(() => {
    setCurrentIndex((i) => (questions.length && i >= questions.length ? 0 : i));
  }, [questions.length]);

  const persistCompletion = useCallback(
    async (overrides?: { score?: number; yesCount?: number }) => {
      if (completedRef.current) return;
      completedRef.current = true;
      const mc = questions.filter((q) => q.question_type === "multiple_choice").length;
      const len = questions.length;
      const finalMax = mc > 0 ? mc : Math.max(len, 1);
      const finalScore = mc > 0 ? (overrides?.score ?? score) : (overrides?.yesCount ?? yesCount);
      await saveCompletion.mutateAsync({
        survey_id: surveyId!,
        score: finalScore,
        max_score: finalMax,
      });
      setIsCompleted(true);
    },
    [questions, saveCompletion, score, surveyId, yesCount],
  );

  const mcCount = useMemo(() => questions.filter((q) => q.question_type === "multiple_choice").length, [questions]);

  const currentQuestion = questions[currentIndex];

  const handleYesNo = async (answer: "yes" | "no") => {
    if (!currentQuestion || !user || !surveyId) return;
    const nextYes = answer === "yes" ? yesCount + 1 : yesCount;
    if (answer === "yes") setYesCount(nextYes);
    else setNoCount((n) => n + 1);
    await saveAnswer.mutateAsync({
      question_id: currentQuestion.id,
      answer,
      is_correct: null,
    });
    if (currentIndex + 1 >= questions.length) {
      await persistCompletion({ yesCount: nextYes });
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleMultipleChoice = async (optionId: string) => {
    if (!currentQuestion || !user || !surveyId) return;
    const correct = currentQuestion.options?.find((o) => o.is_correct);
    const isCorrect = optionId === correct?.id;
    const nextScore = isCorrect ? score + 1 : score;
    if (isCorrect) {
      setScore(nextScore);
      toast.success(t("survey.points_earned"));
    }
    setSelectedOptionId(optionId);
    await saveAnswer.mutateAsync({
      question_id: currentQuestion.id,
      answer: optionId,
      is_correct: isCorrect,
    });
    const idx = currentIndex;
    window.setTimeout(async () => {
      setSelectedOptionId(null);
      if (idx + 1 >= questionsLenRef.current) {
        await persistCompletion({ score: nextScore });
      } else {
        setCurrentIndex(idx + 1);
      }
    }, 1500);
  };

  const nextSurvey = useMemo(
    () => surveys?.find((s) => survey && s.sort_order === survey.sort_order + 1) || null,
    [surveys, survey],
  );

  if (!user) return null;

  if (!survey || loadingQuestions || filtering) {
    return <PageLoader />;
  }

  if (!questions.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center" dir={isRTL ? "rtl" : "ltr"}>
        <p className="text-muted-foreground max-w-md">{t("survey.no_questions")}</p>
        <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
          <Button type="button" variant="default" className="gap-2" onClick={goProfile}>
            <User className="w-4 h-4" />
            {t("survey.return_to_profile")}
          </Button>
          <Button type="button" variant="outline" onClick={goQuizList}>
            {t("survey.quiz_list_short")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col flex-1 min-h-0 bg-gradient-to-b from-muted/35 via-muted/15 to-background"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {!isCompleted ? (
        <>
          <ProgressHeader
            current={currentIndex + 1}
            total={questions.length}
            title={isRTL ? survey.title_ar : survey.title_en}
            isRTL={isRTL}
            onBackToProfile={goProfile}
            onOpenQuizList={goQuizList}
          />
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
            {currentQuestion ? (
              <QuestionCard
                question={currentQuestion}
                onYesNo={handleYesNo}
                onMultipleChoice={handleMultipleChoice}
                selectedOptionId={selectedOptionId}
                correctOptionId={currentQuestion.options?.find((o) => o.is_correct)?.id ?? null}
                disabled={saveAnswer.isPending}
                isRTL={isRTL}
              />
            ) : null}
          </div>
        </>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
          <CompletionScreen
            survey={survey}
            yesCount={yesCount}
            noCount={noCount}
            score={score}
            maxScore={mcCount > 0 ? mcCount : questions.length}
            hasMultipleChoice={mcCount > 0}
            nextSurvey={nextSurvey}
            onViewResults={() => navigate(`/profile/surveys/${surveyId}/results`)}
            onNextSurvey={() => nextSurvey && navigate(`/profile/surveys/${nextSurvey.id}/play`)}
            onBackToProfile={goProfile}
            isRTL={isRTL}
          />
        </div>
      )}
    </div>
  );
};

export default SurveyPlayPage;
