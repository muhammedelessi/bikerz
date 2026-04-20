import React from "react";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SurveyQuestionOption } from "@/types/survey";

interface MultipleChoiceOptionsProps {
  options: SurveyQuestionOption[];
  selectedId: string | null;
  correctId: string | null;
  onSelect: (optionId: string) => void;
  disabled: boolean;
  isRTL: boolean;
}

const MultipleChoiceOptions: React.FC<MultipleChoiceOptionsProps> = ({
  options,
  selectedId,
  correctId,
  onSelect,
  disabled,
  isRTL,
}) => {
  const { t } = useTranslation();

  const getOptionStyle = (opt: SurveyQuestionOption) => {
    if (!selectedId) {
      return "border-border/50 bg-background hover:border-primary/45 hover:bg-primary/[0.06] active:scale-[0.99]";
    }
    if (opt.id === correctId) {
      return "border-emerald-500 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
    }
    if (opt.id === selectedId && opt.id !== correctId) {
      return "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400";
    }
    return "border-border/25 bg-muted/20 opacity-55";
  };

  return (
    <div className="p-4 sm:p-6 space-y-2.5 sm:space-y-3 safe-area-bottom">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          disabled={disabled || !!selectedId}
          onClick={() => onSelect(opt.id)}
          className={cn(
            "w-full flex items-center gap-3 sm:gap-4 min-h-[3.25rem] px-3.5 sm:px-4 py-3 rounded-xl sm:rounded-2xl border-2 text-start transition-all duration-200 touch-manipulation",
            getOptionStyle(opt),
          )}
        >
          {opt.image_url ? (
            <img src={opt.image_url} alt="" className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover shrink-0" />
          ) : null}
          <span className="flex-1 font-semibold text-base sm:text-lg leading-snug">{isRTL ? opt.label_ar : opt.label_en}</span>
          {selectedId && opt.id === correctId ? <Check className="w-5 h-5 text-emerald-600 shrink-0" /> : null}
          {selectedId && opt.id === selectedId && opt.id !== correctId ? <X className="w-5 h-5 text-red-500 shrink-0" /> : null}
        </button>
      ))}
      {selectedId && selectedId !== correctId ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-3 font-medium leading-snug px-1">
          {t("survey.correct_answer")}:{" "}
          {isRTL ? options.find((o) => o.id === correctId)?.label_ar : options.find((o) => o.id === correctId)?.label_en}
        </p>
      ) : null}
    </div>
  );
};

export default MultipleChoiceOptions;
