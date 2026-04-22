import React from "react";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface YesNoButtonsProps {
  onAnswer: (answer: "yes" | "no") => void;
  disabled?: boolean;
  isRTL?: boolean;
}

const YesNoButtons: React.FC<YesNoButtonsProps> = ({ onAnswer, disabled, isRTL }) => {
  const { t } = useTranslation();

  const baseBtn =
    "group relative flex flex-1 flex-col items-center justify-center gap-1.5 sm:gap-2 min-h-[5.5rem] sm:min-h-[6.75rem] rounded-2xl sm:rounded-[1.35rem] border-2 font-bold text-xs sm:text-sm md:text-[0.9375rem] tracking-tight touch-manipulation select-none transition-all duration-200 motion-safe:active:scale-[0.98] disabled:motion-safe:active:scale-100 disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  return (
    <div
      className="grid grid-cols-2 gap-2.5 sm:gap-4 p-3.5 sm:p-6 safe-area-bottom"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAnswer("yes")}
        className={cn(
          baseBtn,
          "border-emerald-500/45 bg-gradient-to-b from-emerald-500/12 to-emerald-500/5 text-emerald-700 shadow-sm shadow-emerald-900/5",
          "dark:from-emerald-500/15 dark:to-emerald-950/30 dark:text-emerald-300 dark:border-emerald-500/35",
          "hover:border-emerald-500/70 hover:from-emerald-500/18 hover:to-emerald-500/10 hover:shadow-md dark:hover:shadow-emerald-950/40",
          "focus-visible:ring-emerald-500/50",
        )}
      >
        <span className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/25 transition-transform group-hover:scale-105 group-hover:bg-emerald-500/20">
          <Check className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.75} aria-hidden />
        </span>
        <span>{t("survey.yes")}</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onAnswer("no")}
        className={cn(
          baseBtn,
          "border-rose-400/45 bg-gradient-to-b from-rose-500/10 to-rose-500/[0.03] text-rose-600 shadow-sm shadow-rose-900/5",
          "dark:from-rose-950/40 dark:to-rose-950/15 dark:text-rose-300 dark:border-rose-400/35",
          "hover:border-rose-400/75 hover:from-rose-500/15 hover:to-rose-500/8 hover:shadow-md dark:hover:shadow-rose-950/30",
          "focus-visible:ring-rose-400/45",
        )}
      >
        <span className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-rose-500/12 ring-1 ring-rose-400/25 transition-transform group-hover:scale-105 group-hover:bg-rose-500/18">
          <X className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.75} aria-hidden />
        </span>
        <span>{t("survey.no")}</span>
      </button>
    </div>
  );
};

export default YesNoButtons;
