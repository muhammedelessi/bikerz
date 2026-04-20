import React from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Lock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Survey, SurveyCompletion } from "@/types/survey";

export type SurveyCardStatus = "locked" | "available" | "completed";

interface SurveyCardProps {
  survey: Survey;
  status: SurveyCardStatus;
  completion?: SurveyCompletion;
  onStart: () => void;
  isRTL: boolean;
}

const SurveyCard: React.FC<SurveyCardProps> = ({ survey, status, completion, onStart, isRTL }) => {
  const { t } = useTranslation();
  const title = isRTL ? survey.title_ar : survey.title_en;

  return (
    <div
      className={cn(
        "relative rounded-2xl border-2 p-4 transition-all",
        status === "completed" && "border-emerald-500/30 bg-emerald-500/5",
        status === "available" && "border-primary/40 bg-primary/5 cursor-pointer hover:border-primary/60",
        status === "locked" && "border-border/20 bg-muted/10 opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
            status === "completed" && "bg-emerald-500/10",
            status === "available" && "bg-primary/10",
            status === "locked" && "bg-muted/30",
          )}
        >
          {status === "completed" ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : null}
          {status === "available" ? <Play className="w-5 h-5 text-primary" /> : null}
          {status === "locked" ? <Lock className="w-5 h-5 text-muted-foreground" /> : null}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-snug">{title}</p>
          {status === "completed" && completion && completion.max_score > 0 ? (
            <p className="text-xs text-emerald-600 mt-0.5 tabular-nums">
              {completion.score} / {completion.max_score}
            </p>
          ) : null}
          {status === "completed" && completion && completion.max_score === 0 ? (
            <p className="text-xs text-muted-foreground mt-0.5">{t("survey.completed")}</p>
          ) : null}
          {status === "locked" ? (
            <p className="text-xs text-muted-foreground mt-0.5">{t("survey.unlock_hint")}</p>
          ) : null}
        </div>
      </div>

      {(status === "available" || status === "completed") && (
        <Button type="button" size="sm" className="w-full mt-3 gap-2" onClick={onStart}>
          <Play className="w-3.5 h-3.5" />
          {completion ? t("survey.replay") : t("survey.start")}
        </Button>
      )}
    </div>
  );
};

export default SurveyCard;
