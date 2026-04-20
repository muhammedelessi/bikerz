import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSurveys } from "@/hooks/survey/useSurveys";
import { useSurveyCompletion } from "@/hooks/survey/useSurveyCompletion";
import SurveyCard, { type SurveyCardStatus } from "@/components/ui/survey/SurveyCard";
import type { Survey } from "@/types/survey";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";

function getStatus(survey: Survey, surveys: Survey[] | undefined, completions: { survey_id: string }[] | undefined): SurveyCardStatus {
  const isCompleted = completions?.some((c) => c.survey_id === survey.id);
  if (isCompleted) return "completed";
  if (survey.sort_order === 1) return "available";
  const prevCompleted = completions?.some((c) => {
    const s = surveys?.find((x) => x.id === c.survey_id);
    return s?.sort_order === survey.sort_order - 1;
  });
  return prevCompleted ? "available" : "locked";
}

const PageLoader = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
);

const SurveyListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const { t } = useTranslation();
  const { data: surveys, isLoading } = useSurveys();
  const { completions } = useSurveyCompletion(user?.id);

  const ordered = useMemo(() => [...(surveys || [])].sort((a, b) => a.sort_order - b.sort_order), [surveys]);

  if (!user) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0" dir={isRTL ? "rtl" : "ltr"}>
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{t("survey.title")}</h1>
            <p className="text-muted-foreground text-sm sm:text-base max-w-prose">{t("survey.subtitle")}</p>
          </div>
          <Button type="button" variant="outline" className="shrink-0 gap-2 self-start" onClick={() => navigate("/profile")}>
            <User className="w-4 h-4" />
            {t("survey.return_to_profile")}
          </Button>
        </div>

        {isLoading ? (
          <PageLoader />
        ) : (
          <div className="grid gap-3 sm:gap-4">
            {ordered.map((survey) => (
              <SurveyCard
                key={survey.id}
                survey={survey}
                status={getStatus(survey, surveys, completions)}
                completion={completions?.find((c) => c.survey_id === survey.id)}
                onStart={() => navigate(`/profile/surveys/${survey.id}/play`)}
                isRTL={isRTL}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SurveyListPage;
