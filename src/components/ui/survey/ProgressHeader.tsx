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
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border/60 shadow-sm">
      <div className="max-w-2xl mx-auto w-full px-4 py-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 -ms-1 h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={onBackToProfile}
          >
            <BackIcon className="w-3.5 h-3.5 shrink-0" />
            {t("survey.return_to_profile")}
          </Button>

          {onOpenQuizList ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 h-8 text-xs text-muted-foreground -me-1"
              onClick={onOpenQuizList}
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("survey.quiz_list_short")}</span>
            </Button>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-foreground truncate flex-1 min-w-0">{title}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-black text-primary tabular-nums">{current}</span>
            <span className="text-xs text-muted-foreground tabular-nums">/ {total}</span>
          </div>
        </div>

        <div className="space-y-1">
          <div
            className="h-2 bg-muted/40 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={cn("h-full bg-primary rounded-full transition-all duration-500 ease-out")}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className={cn("text-[10px] text-muted-foreground tabular-nums", isRTL ? "text-start" : "text-end")}>
            {pct}%
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProgressHeader;
