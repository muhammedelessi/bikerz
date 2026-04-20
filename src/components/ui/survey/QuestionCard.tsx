import React from "react";
import type { SurveyQuestion } from "@/types/survey";
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
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  onYesNo,
  onMultipleChoice,
  selectedOptionId,
  correctOptionId,
  disabled,
  isRTL,
}) => (
  <div className="flex flex-col min-h-0 flex-1 w-full max-w-2xl mx-auto px-3 sm:px-4 pb-6 sm:pb-10">
    <article
      className={cn(
        "flex flex-col min-h-0 rounded-2xl sm:rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden",
        "ring-1 ring-black/[0.03] dark:ring-white/[0.06]",
      )}
    >
      {question.image_url ? (
        <div className="relative w-full overflow-hidden bg-muted aspect-[16/10] sm:aspect-[2/1] max-h-[min(42vh,320px)] sm:max-h-[280px]">
          <img src={question.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        </div>
      ) : null}
      <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4 border-b border-border/50 bg-muted/20">
        <p
          className="text-xl sm:text-2xl md:text-[1.65rem] font-bold text-foreground leading-snug text-pretty"
          dir={isRTL ? "rtl" : "ltr"}
        >
          {isRTL ? question.title_ar : question.title_en}
        </p>
      </div>
      <div className="flex-1 min-h-0 bg-card">
        {question.question_type === "yes_no" ? (
          <YesNoButtons onAnswer={onYesNo} disabled={disabled} />
        ) : (
          <MultipleChoiceOptions
            options={question.options || []}
            selectedId={selectedOptionId}
            correctId={correctOptionId}
            onSelect={onMultipleChoice}
            disabled={disabled}
            isRTL={isRTL}
          />
        )}
      </div>
    </article>
  </div>
);

export default QuestionCard;
