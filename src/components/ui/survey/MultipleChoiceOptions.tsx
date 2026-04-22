import React from "react";
import { useTranslation } from "react-i18next";
import { Check, CheckCircle2, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SurveyMode, SurveyQuestionOption } from "@/types/survey";

interface MultipleChoiceOptionsProps {
  options: SurveyQuestionOption[];
  selectedId: string | null;
  correctId: string | null;
  onSelect: (optionId: string) => void;
  disabled: boolean;
  isRTL: boolean;
  surveyMode: SurveyMode;
}

const MultipleChoiceOptions: React.FC<MultipleChoiceOptionsProps> = ({
  options,
  selectedId,
  correctId,
  onSelect,
  disabled,
  isRTL,
  surveyMode,
}) => {
  const { t } = useTranslation();

  const getStyle = (opt: SurveyQuestionOption) => {
    if (!selectedId) {
      return cn(
        "border-border/55 bg-card/80 text-foreground shadow-sm shadow-black/[0.02]",
        "hover:border-primary/45 hover:bg-primary/[0.06] hover:shadow-md hover:ring-1 hover:ring-primary/15",
        "dark:bg-card/50 dark:hover:bg-primary/10",
      );
    }
    if (surveyMode === "preference") {
      if (opt.id === selectedId) {
        return cn(
          "border-primary bg-primary/10 text-primary shadow-md shadow-primary/10 ring-1 ring-primary/20",
        );
      }
      return cn("border-border/20 bg-muted/30 text-muted-foreground opacity-50");
    }
    if (opt.id === correctId) {
      return cn(
        "border-emerald-500 bg-emerald-500/12 text-emerald-900 shadow-md shadow-emerald-900/10 ring-1 ring-emerald-500/25",
        "dark:bg-emerald-950/50 dark:text-emerald-50 dark:border-emerald-400/70",
      );
    }
    if (opt.id === selectedId) {
      return cn(
        "border-rose-400 bg-rose-500/10 text-rose-900 shadow-md shadow-rose-900/8 ring-1 ring-rose-400/20",
        "dark:bg-rose-950/40 dark:text-rose-50 dark:border-rose-400/65",
      );
    }
    return cn(
      "border-border/25 bg-muted/30 text-muted-foreground opacity-[0.72]",
      "dark:bg-muted/15 dark:opacity-80",
    );
  };

  return (
    <div
      className="p-3 sm:p-6 space-y-2 sm:space-y-2.5 safe-area-bottom"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="flex flex-col gap-2 sm:gap-2.5">
        {options.map((opt, i) => {
          const isSelected = opt.id === selectedId;
          const isCorrect = surveyMode === "scored" && opt.id === correctId && !!selectedId;
          const isWrong = surveyMode === "scored" && isSelected && opt.id !== correctId;

          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled || !!selectedId}
              onClick={() => onSelect(opt.id)}
              className={cn(
                "w-full flex items-center gap-2.5 sm:gap-3.5 min-h-[3.125rem] sm:min-h-[3.375rem] px-3 sm:px-4 py-2.5 sm:py-3",
                "rounded-xl sm:rounded-2xl border-2 text-start touch-manipulation select-none",
                "transition-all duration-200 motion-safe:active:scale-[0.995] disabled:cursor-not-allowed disabled:motion-safe:active:scale-100",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                getStyle(opt),
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border-2 text-[9px] sm:text-[10px] md:text-xs font-black transition-all",
                  !selectedId && "border-border/60 bg-background/90 text-muted-foreground shadow-inner",
                  surveyMode === "scored" && isCorrect && "border-emerald-600 bg-emerald-600 text-white shadow-sm dark:border-emerald-400 dark:bg-emerald-500",
                  surveyMode === "scored" && isWrong && "border-rose-500 bg-rose-500 text-white",
                  selectedId && !isSelected && surveyMode === "scored" && !isCorrect && "border-border/30 bg-muted/40 text-muted-foreground/50",
                  surveyMode === "preference" && isSelected && "border-primary bg-primary/15 text-primary",
                  surveyMode === "preference" && selectedId && !isSelected && "border-border/30 bg-muted/40 text-muted-foreground/50",
                )}
              >
                {surveyMode === "scored" ? (
                  isCorrect ? (
                    <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={3} aria-hidden />
                  ) : isWrong ? (
                    <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={3} aria-hidden />
                  ) : (
                    <span className="tabular-nums">{String.fromCharCode(65 + i)}</span>
                  )
                ) : isSelected ? (
                  <Check className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" strokeWidth={3} aria-hidden />
                ) : (
                  <span className="tabular-nums">{String.fromCharCode(65 + i)}</span>
                )}
              </div>

              <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
                {opt.image_url ? (
                  <img
                    src={opt.image_url}
                    alt=""
                    className="h-10 w-10 sm:h-11 sm:w-11 shrink-0 rounded-lg object-cover ring-1 ring-border/50 shadow-sm"
                  />
                ) : null}
                <span className="text-xs sm:text-sm md:text-[0.9375rem] font-semibold leading-snug">
                  {isRTL ? opt.label_ar : opt.label_en}
                </span>
              </div>

              {surveyMode === "scored" && isSelected ? (
                <div className="shrink-0">
                  {isCorrect ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  ) : (
                    <XCircle className="h-5 w-5 text-rose-500 dark:text-rose-400" aria-hidden />
                  )}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {surveyMode === "scored" && selectedId && selectedId !== correctId ? (
        <div
          className="mt-1 flex items-start gap-2.5 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.09] px-3.5 py-3 sm:px-4 sm:py-3.5 dark:bg-emerald-950/35 dark:border-emerald-500/30"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <p className="text-xs sm:text-sm font-medium leading-relaxed text-emerald-950 dark:text-emerald-100">
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">{t("survey.correct_answer")}: </span>
            {isRTL ? options.find((o) => o.id === correctId)?.label_ar : options.find((o) => o.id === correctId)?.label_en}
          </p>
        </div>
      ) : null}
    </div>
  );
};

export default MultipleChoiceOptions;
