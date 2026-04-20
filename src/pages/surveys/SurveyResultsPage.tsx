import React, { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, User } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSurveys } from "@/hooks/survey/useSurveys";
import { useSurveyCompletion } from "@/hooks/survey/useSurveyCompletion";
import SurveyResultsSection from "@/components/ui/survey/SurveyResultsSection";
import { Button } from "@/components/ui/button";

const SurveyResultsPage: React.FC = () => {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const { t } = useTranslation();
  const { data: surveys } = useSurveys();
  const { completions } = useSurveyCompletion(user?.id);

  const survey = useMemo(() => surveys?.find((s) => s.id === surveyId), [surveys, surveyId]);
  const myCompletion = useMemo(() => completions?.find((c) => c.survey_id === surveyId), [completions, surveyId]);

  if (!user || !surveyId) return null;

  if (!survey) {
    return (
      <div className="flex flex-1 min-h-[40vh] items-center justify-center" dir={isRTL ? "rtl" : "ltr"}>
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0" dir={isRTL ? "rtl" : "ltr"}>
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Button type="button" variant="ghost" size="icon" onClick={() => navigate("/profile/surveys")} aria-label={t("common.back")}>
              {isRTL ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black truncate">{isRTL ? survey.title_ar : survey.title_en}</h1>
              <p className="text-sm text-muted-foreground">{t("survey.results_title")}</p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-2 shrink-0 self-start sm:self-center" onClick={() => navigate("/profile")}>
            <User className="w-4 h-4" />
            {t("survey.return_to_profile")}
          </Button>
        </div>

        {!myCompletion ? (
          <div className="rounded-2xl border border-dashed border-border p-6 sm:p-8 text-center space-y-3 max-w-lg mx-auto">
            <p className="font-medium">{t("survey.no_results_yet")}</p>
            <p className="text-sm text-muted-foreground">{t("survey.play_to_see")}</p>
            <Button type="button" onClick={() => navigate(`/profile/surveys/${surveyId}/play`)}>
              {t("survey.start")}
            </Button>
          </div>
        ) : (
          <SurveyResultsSection survey={survey} userId={user.id} isRTL={isRTL} />
        )}
      </div>
    </div>
  );
};

export default SurveyResultsPage;
