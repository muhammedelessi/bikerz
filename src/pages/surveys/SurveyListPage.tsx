import React, { useMemo } from "react";
import { useLocalizedNavigate } from "@/hooks/useLocalizedNavigate";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, CheckCircle2, Gamepad2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSurveys } from "@/hooks/survey/useSurveys";
import { useSurveyCompletion } from "@/hooks/survey/useSurveyCompletion";
import SurveyCard, { type SurveyCardStatus } from "@/components/ui/survey/SurveyCard";
import type { Survey } from "@/types/survey";
import { Button } from "@/components/ui/button";

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
  const navigate = useLocalizedNavigate();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const { t } = useTranslation();
  const { data: surveys, isLoading } = useSurveys();
  const { completions } = useSurveyCompletion(user?.id);

  const ordered = useMemo(() => [...(surveys || [])].sort((a, b) => a.sort_order - b.sort_order), [surveys]);
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  if (!user) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0" dir={isRTL ? "rtl" : "ltr"}>
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 -ms-1 text-muted-foreground" onClick={() => navigate("/profile")}>
          <BackIcon className="w-4 h-4" />
          {t("survey.return_to_profile")}
        </Button>

        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-background border border-primary/20 p-6 sm:p-8 text-center space-y-3">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
            <Gamepad2 className="w-64 h-64 text-primary" />
          </div>

          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
              <Gamepad2 className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{t("survey.title")}</h1>
            <p className="text-muted-foreground text-sm sm:text-base mt-2 max-w-sm mx-auto">{t("survey.subtitle")}</p>

            {completions && completions.length > 0 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {t("survey.completed_count", {
                      count: completions.length,
                      total: ordered.length,
                    })}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {isLoading ? (
          <PageLoader />
        ) : (
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
            {ordered.map((survey, index) => (
              <SurveyCard
                key={survey.id}
                survey={survey}
                status={getStatus(survey, surveys, completions)}
                completion={completions?.find((c) => c.survey_id === survey.id)}
                onStart={() => navigate(`/profile/surveys/${survey.id}/play`)}
                isRTL={isRTL}
                stepIndex={index}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SurveyListPage;
