import React from "react";
import { useTranslation } from "react-i18next";
import { BarChart2, ChevronRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Survey, SurveyMode } from "@/types/survey";
import { cn } from "@/lib/utils";

interface CompletionScreenProps {
  survey: Survey;
  yesCount: number;
  noCount: number;
  score: number;
  maxScore: number;
  hasMultipleChoice: boolean;
  nextSurvey: Survey | null;
  onViewResults: () => void;
  onNextSurvey: () => void;
  onBackToProfile: () => void;
  isRTL: boolean;
}

const CompletionScreen: React.FC<CompletionScreenProps> = ({
  survey: _survey,
  yesCount,
  noCount,
  score,
  maxScore,
  hasMultipleChoice,
  nextSurvey,
  onViewResults,
  onNextSurvey,
  onBackToProfile,
  isRTL,
}) => {
  const { t } = useTranslation();
  const surveyMode: SurveyMode = _survey.survey_mode ?? "scored";
  const scorePct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full max-w-2xl mx-auto px-3 sm:px-4 py-8 sm:py-12">
      <div className="flex flex-col items-center justify-center flex-1 min-h-[50vh] text-center space-y-6 sm:space-y-8 rounded-2xl sm:rounded-3xl border border-border/70 bg-card/80 p-6 sm:p-10 shadow-sm">
        <div className="text-5xl sm:text-6xl" aria-hidden>
          🎉
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-pretty px-2">{t("survey.completion_title")}</h2>

        {surveyMode === "preference" ? (
          <div className="w-full max-w-md space-y-2 text-center">
            <p className="text-lg font-bold">{t("survey.preference_completion_title")}</p>
            <p className="text-sm text-muted-foreground">{t("survey.preference_completion_hint")}</p>
          </div>
        ) : hasMultipleChoice ? (
          <div className="w-full max-w-sm space-y-3">
            <p className="text-lg sm:text-xl font-bold text-primary">{t("survey.completion_score", { score, max: maxScore })}</p>
            <div className="h-3 sm:h-3.5 bg-muted/40 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${scorePct}%` }} />
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">{scorePct}%</p>
          </div>
        ) : (
          <p className="text-muted-foreground text-base sm:text-lg max-w-md">{t("survey.completion_yesno", { yes: yesCount, no: noCount })}</p>
        )}

        <div className="flex flex-col gap-3 w-full max-w-sm pt-2">
          <Button type="button" variant="outline" className="gap-2 h-11 sm:h-12 font-semibold" onClick={onBackToProfile}>
            <User className="w-4 h-4" />
            {t("survey.return_to_profile")}
          </Button>
          <Button type="button" onClick={onViewResults} variant="outline" className="gap-2 h-11 sm:h-12">
            <BarChart2 className="w-4 h-4" />
            {t("survey.view_results")}
          </Button>
          {nextSurvey ? (
            <Button type="button" onClick={onNextSurvey} className="gap-2 h-11 sm:h-12">
              {t("survey.next_survey", { title: isRTL ? nextSurvey.title_ar : nextSurvey.title_en })}
              <ChevronRight className={cn("w-4 h-4", isRTL && "rotate-180")} />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default CompletionScreen;
