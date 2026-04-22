import React from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Lock, Play, RotateCcw } from "lucide-react";
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
  /** Zero-based index in the ordered survey list (shown as step number when available). */
  stepIndex: number;
}

const SurveyCard: React.FC<SurveyCardProps> = ({ survey, status, completion, onStart, isRTL, stepIndex }) => {
  const { t } = useTranslation();
  const title = isRTL ? survey.title_ar : survey.title_en;
  const step = stepIndex + 1;

  return (
    <div
      role={status === "available" ? "button" : undefined}
      tabIndex={status === "available" ? 0 : undefined}
      className={cn(
        "flex items-center gap-4 p-4 sm:p-5 transition-colors",
        status === "available" && "hover:bg-primary/5 cursor-pointer",
        status === "completed" && "bg-emerald-500/5",
        status === "locked" && "opacity-50",
      )}
      onClick={status === "available" ? onStart : undefined}
      onKeyDown={
        status === "available"
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onStart();
              }
            }
          : undefined
      }
    >
      <div
        className={cn(
          "w-11 h-11 rounded-full flex items-center justify-center shrink-0",
          "border-2 font-black text-sm transition-all",
          status === "completed" && "border-emerald-500 bg-emerald-500/10 text-emerald-500",
          status === "available" && "border-primary bg-primary/10 text-primary",
          status === "locked" && "border-border/40 bg-muted/20 text-muted-foreground",
        )}
      >
        {status === "completed" ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : status === "locked" ? (
          <Lock className="w-4 h-4" />
        ) : (
          <span>{step}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn("font-bold text-sm sm:text-base leading-snug truncate", status === "locked" && "text-muted-foreground")}>{title}</p>

        {status === "completed" && completion && (
          <div className="flex items-center gap-2 mt-0.5">
            {completion.max_score > 0 ? (
              <>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                  {completion.score}/{completion.max_score}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums",
                    Math.round((completion.score / completion.max_score) * 100) >= 80
                      ? "bg-emerald-500/10 text-emerald-600"
                      : Math.round((completion.score / completion.max_score) * 100) >= 50
                        ? "bg-amber-500/10 text-amber-600"
                        : "bg-red-400/10 text-red-500",
                  )}
                >
                  {Math.round((completion.score / completion.max_score) * 100)}%
                </span>
              </>
            ) : (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                {t("survey.completed")} ✓
              </span>
            )}
          </div>
        )}
        {status === "locked" && (
          <p className="text-xs text-muted-foreground mt-0.5">{t("survey.unlock_hint")}</p>
        )}
      </div>

      {status === "available" && (
        <Button
          type="button"
          size="sm"
          className="shrink-0 gap-1.5 h-9"
          onClick={(e) => {
            e.stopPropagation();
            onStart();
          }}
        >
          <Play className="w-3.5 h-3.5" />
          {completion ? t("survey.replay") : t("survey.start")}
        </Button>
      )}
      {status === "completed" && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5 h-9 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
          onClick={(e) => {
            e.stopPropagation();
            onStart();
          }}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {t("survey.replay")}
        </Button>
      )}
      {status === "locked" && <Lock className="w-4 h-4 text-muted-foreground/50 shrink-0" />}
    </div>
  );
};

export default SurveyCard;
