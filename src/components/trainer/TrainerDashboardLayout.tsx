import React, { useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

export type TrainerDashboardTab = "profile" | "trainings" | "schedule" | "bookings" | "payments";

const TAB_VALUES: TrainerDashboardTab[] = ["profile", "trainings", "schedule", "bookings", "payments"];

function parseTab(raw: string | null): TrainerDashboardTab {
  if (raw && TAB_VALUES.includes(raw as TrainerDashboardTab)) return raw as TrainerDashboardTab;
  return "profile";
}

type Props = {
  children: (tab: TrainerDashboardTab) => React.ReactNode;
};

const TrainerDashboardLayout: React.FC<Props> = ({ children }) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = useMemo(() => parseTab(searchParams.get("tab")), [searchParams]);

  const setTab = useCallback(
    (v: string) => {
      const next = v === "profile" ? "profile" : (v as TrainerDashboardTab);
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === "profile") p.delete("tab");
          else p.set("tab", next);
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return (
    <div className="min-h-[100dvh] bg-background" dir={isRTL ? "rtl" : "ltr"}>
      <div className="border-b border-border bg-card/40">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GraduationCap className="h-6 w-6" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">{t("trainerDashboard.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("trainerDashboard.subtitle")}</p>
            </div>
            <Link
              to="/profile"
              className={cn(
                "text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline",
              )}
            >
              {t("trainerDashboard.backToProfile")}
            </Link>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList
              className={cn(
                "flex h-auto w-full min-w-0 flex-wrap justify-start gap-1 bg-muted/40 p-1",
                isRTL && "flex-row-reverse",
              )}
            >
              <TabsTrigger value="profile" className="text-xs sm:text-sm">
                {t("trainerDashboard.tabs.profile")}
              </TabsTrigger>
              <TabsTrigger value="trainings" className="text-xs sm:text-sm">
                {t("trainerDashboard.tabs.trainings")}
              </TabsTrigger>
              <TabsTrigger value="schedule" className="text-xs sm:text-sm">
                {t("trainerDashboard.tabs.schedule")}
              </TabsTrigger>
              <TabsTrigger value="bookings" className="text-xs sm:text-sm">
                {t("trainerDashboard.tabs.bookings")}
              </TabsTrigger>
              <TabsTrigger value="payments" className="text-xs sm:text-sm">
                {t("trainerDashboard.tabs.payments")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={tab} className="mt-4 outline-none">
              <Card className="border-border/80 shadow-sm">
                <div className="p-4 sm:p-6">{children(tab)}</div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default TrainerDashboardLayout;
