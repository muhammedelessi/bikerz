import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSurveys } from "@/hooks/survey/useSurveys";
import { useSurveyCompletion } from "@/hooks/survey/useSurveyCompletion";
import SurveyCard, { type SurveyCardStatus } from "./SurveyCard";
import type { Survey } from "@/types/survey";

interface SurveySectionProps {
  userId: string;
}

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

const SurveySection: React.FC<SurveySectionProps> = ({ userId }) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const { data: surveys } = useSurveys();
  const { completions } = useSurveyCompletion(userId);

  const preview = useMemo(() => (surveys || []).slice(0, 3), [surveys]);

  if (!preview.length) return null;

  return (
    <div className="grid gap-3">
      {preview.map((survey, index) => (
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
      <button
        type="button"
        className="text-sm font-medium text-primary hover:underline text-start"
        onClick={() => navigate("/profile/surveys")}
      >
        {t("survey.see_all_surveys")}
      </button>
    </div>
  );
};

export default SurveySection;
