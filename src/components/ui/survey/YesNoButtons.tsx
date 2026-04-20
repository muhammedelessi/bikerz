import React from "react";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";

interface YesNoButtonsProps {
  onAnswer: (answer: "yes" | "no") => void;
  disabled?: boolean;
}

const YesNoButtons: React.FC<YesNoButtonsProps> = ({ onAnswer, disabled }) => {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-4 sm:p-6 safe-area-bottom">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAnswer("yes")}
        className="flex items-center justify-center gap-2 min-h-[3.25rem] sm:min-h-14 h-14 rounded-2xl border-2 border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-base sm:text-lg hover:bg-emerald-500/18 hover:border-emerald-500/55 active:scale-[0.98] transition-all disabled:opacity-50 touch-manipulation shadow-sm"
      >
        <Check className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
        {t("survey.yes")}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAnswer("no")}
        className="flex items-center justify-center gap-2 min-h-[3.25rem] sm:min-h-14 h-14 rounded-2xl border-2 border-red-500/35 bg-red-500/10 text-red-600 dark:text-red-400 font-bold text-base sm:text-lg hover:bg-red-500/18 hover:border-red-500/55 active:scale-[0.98] transition-all disabled:opacity-50 touch-manipulation shadow-sm"
      >
        <X className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
        {t("survey.no")}
      </button>
    </div>
  );
};

export default YesNoButtons;
