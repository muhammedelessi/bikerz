import React from "react";
import type { SurveyMode, SurveyQuestion } from "@/types/survey";
import YesNoButtons from "./YesNoButtons";
import MultipleChoiceOptions from "./MultipleChoiceOptions";
import { cn } from "@/lib/utils";

interface QuestionCardProps {
  question: SurveyQuestion;
  onYesNo: (answer: "yes" | "no") => void;
  onMultipleChoice: (optionId: string) => void;
  selectedOptionId: string | null;
  correctOptionId: string | null;
  disabled: boolean;
  isRTL: boolean;
  surveyMode: SurveyMode;
  preferenceFeedback?: { percent: number; label: string } | null;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  onYesNo,
  onMultipleChoice,
  selectedOptionId,
  correctOptionId,
  disabled,
  isRTL,
  surveyMode,
  preferenceFeedback,
}) => {
  const isYesNo = question.question_type === "yes_no";

  return (
    <div className="relative w-full max-w-lg sm:max-w-xl mx-auto px-3 sm:px-6 pb-6 sm:pb-10">
      <article
        className={cn(
          "rounded-[1.25rem] sm:rounded-3xl border border-border/60 bg-card overflow-hidden",
          "shadow-lg shadow-black/[0.04] dark:shadow-black/25",
          "ring-1 ring-black/[0.03] dark:ring-white/[0.06]",
        )}
      >
        {question.image_url ? (
          <div className="relative bg-gradient-to-b from-muted/50 via-muted/30 to-muted/20 border-b border-border/40 flex items-center justify-center py-2.5 px-3 sm:py-3 sm:px-5 max-h-[118px] sm:max-h-[145px]">
            <img
              src={question.image_url}
              alt=""
              className="max-h-[92px] sm:max-h-[118px] w-auto max-w-full object-contain drop-shadow-md"
            />
          </div>
        ) : null}

        <div className="px-4 sm:px-6 pt-4 pb-3.5 sm:pt-5 sm:pb-4 border-b border-border/25 bg-gradient-to-b from-muted/[0.35] to-transparent">
          <p
            className="text-sm sm:text-base md:text-[1.0625rem] font-bold text-foreground leading-snug text-pretty tracking-tight"
            dir={isRTL ? "rtl" : "ltr"}
          >
            {isRTL ? question.title_ar : question.title_en}
          </p>
        </div>

        <div
          className={cn(
            "border-t border-border/20",
            isYesNo
              ? "bg-gradient-to-b from-emerald-500/[0.04] via-background to-background dark:from-emerald-950/20"
              : "bg-gradient-to-b from-primary/[0.05] via-muted/15 to-muted/5 dark:from-primary/10",
          )}
        >
          {isYesNo ? (
            <YesNoButtons onAnswer={onYesNo} disabled={disabled} isRTL={isRTL} />
          ) : (
            <MultipleChoiceOptions
              options={question.options || []}
              selectedId={selectedOptionId}
              correctId={correctOptionId}
              onSelect={onMultipleChoice}
              disabled={disabled}
              isRTL={isRTL}
              surveyMode={surveyMode}
            />
          )}
        </div>
      </article>

      {preferenceFeedback ? (
        <div
          className="animate-in fade-in duration-200 absolute inset-0 z-10 flex items-center justify-center rounded-[1.25rem] bg-background/80 backdrop-blur-sm sm:rounded-3xl"
          dir={isRTL ? "rtl" : "ltr"}
        >
          <div className="space-y-3 p-6 text-center">
            <div className="font-black tabular-nums text-6xl text-primary">{preferenceFeedback.percent}%</div>
            <p className="text-sm font-semibold text-muted-foreground">{preferenceFeedback.label}</p>
            <div className="mx-auto h-2 w-48 overflow-hidden rounded-full bg-muted/30">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${preferenceFeedback.percent}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default QuestionCard;
