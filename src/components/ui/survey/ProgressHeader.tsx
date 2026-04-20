import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProgressHeaderProps {
  current: number;
  total: number;
  title: string;
  isRTL: boolean;
  onBackToProfile: () => void;
  onOpenQuizList?: () => void;
}

const ProgressHeader: React.FC<ProgressHeaderProps> = ({
  current,
  total,
  title,
  isRTL,
  onBackToProfile,
  onOpenQuizList,
}) => {
  const { t } = useTranslation();
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  return (
    <div className="shrink-0 z-10 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="max-w-2xl mx-auto w-full px-3 sm:px-4 pt-3 pb-2 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0 h-9 font-semibold border-primary/30"
            onClick={onBackToProfile}
          >
            <BackIcon className="w-4 h-4" />
            <span className="max-w-[140px] sm:max-w-none truncate">{t("survey.return_to_profile")}</span>
          </Button>
          {onOpenQuizList ? (
            <Button type="button" variant="ghost" size="sm" className="gap-1 h-9 text-muted-foreground ms-auto" onClick={onOpenQuizList}>
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">{t("survey.quiz_list_short")}</span>
            </Button>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide tabular-nums shrink-0">
            {t("survey.question_counter", { current, total })}
          </p>
          <p className="text-sm sm:text-base font-bold text-foreground text-center truncate flex-1 min-w-0 px-2">{title}</p>
          <span className="text-xs font-semibold text-primary tabular-nums shrink-0 w-10 text-end">{pct}%</span>
        </div>

        <div
          className="h-2 sm:h-2.5 bg-muted/40 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className={cn("h-full bg-primary rounded-full transition-all duration-300 ease-out")} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
};

export default ProgressHeader;
