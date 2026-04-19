import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { BundleTierRow } from "@/types/bundle";

type Props = {
  tiers: BundleTierRow[];
  selectedCount: number;
  /** sidebar = sticky desktop panel; compact = denser mobile card */
  variant?: "default" | "sidebar" | "compact";
};

export const BundleTierLadder: React.FC<Props> = ({ tiers, selectedCount, variant = "default" }) => {
  const { isRTL } = useLanguage();
  const active = tiers.filter((t) => t.is_active !== false);
  const isCompact = variant === "compact";
  const isSidebar = variant === "sidebar";

  if (active.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card",
        isCompact && "p-3.5",
        isSidebar && "p-4 shadow-sm",
        !isCompact && !isSidebar && "p-4",
      )}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className={cn("space-y-1", isCompact && "mb-3")}>
        <h3
          className={cn(
            "font-semibold text-foreground",
            isCompact ? "text-sm" : "text-sm",
          )}
        >
          {isRTL ? "جدول الخصم" : "Bundle discount table"}
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {isRTL
            ? "يُحتسب أعلى خصم ينطبق على عدد الكورسات المختارة."
            : "The best discount that matches your course count is applied."}
        </p>
      </div>

      <ul className={cn("space-y-2", isCompact && "space-y-1.5", isSidebar && "mt-4 space-y-2.5")}>
        {active.map((t) => {
          const reached = selectedCount >= t.min_courses;
          const name = isRTL ? t.label_ar || t.label_en : t.label_en || t.label_ar;
          const pctToward = Math.min(100, (selectedCount / t.min_courses) * 100);

          return (
            <li
              key={t.id}
              className={cn(
                "rounded-lg border px-3 py-2.5 transition-colors",
                reached ? "border-primary/40 bg-primary/[0.07]" : "border-border/60 bg-muted/25",
                isCompact && "py-2",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span
                      className={cn(
                        "tabular-nums text-xl font-bold tracking-tight",
                        reached ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {Number(t.discount_percentage)}%
                    </span>
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {isRTL ? "خصم" : "off"}
                    </span>
                  </div>
                  {name ? (
                    <p className="mt-0.5 truncate text-xs font-medium text-foreground">{name}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {isRTL
                      ? `من ${t.min_courses} كورسات فأكثر`
                      : `${t.min_courses}+ courses`}
                  </p>
                </div>
                {reached && (
                  <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                    <Check className="h-3 w-3" aria-hidden />
                    {isRTL ? "ينطبق" : "Applies"}
                  </span>
                )}
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    reached ? "bg-primary" : "bg-primary/35",
                  )}
                  style={{ width: `${Math.min(100, pctToward)}%` }}
                />
              </div>
              <p className="mt-1 text-end text-[10px] tabular-nums text-muted-foreground">
                {Math.min(selectedCount, t.min_courses)} / {t.min_courses}{" "}
                {isRTL ? "كورسات" : "courses"}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
