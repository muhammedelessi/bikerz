import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface ResultBarProps {
  label: string;
  imageUrl?: string | null;
  value: number;
  max: number;
  color?: string;
  userMark?: boolean;
  rightLabel?: string;
}

const ResultBar: React.FC<ResultBarProps> = ({ label, imageUrl, value, max, color = "bg-primary/60", userMark, rightLabel }) => {
  const { t } = useTranslation();
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-2">
      {imageUrl ? <img src={imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" /> : null}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{label}</span>
          <span className="text-xs text-muted-foreground shrink-0 ms-2 tabular-nums">{rightLabel ?? `${pct}%`}</span>
        </div>
        <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${pct}%` }} />
        </div>
      </div>
      {userMark ? <span className="text-[10px] font-bold text-primary shrink-0 uppercase">{t("survey.you_mark")}</span> : null}
    </div>
  );
};

export default ResultBar;
