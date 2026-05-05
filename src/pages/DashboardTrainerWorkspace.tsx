import React from "react";
import { useTranslation } from "react-i18next";
import { useLocalizedNavigate } from "@/hooks/useLocalizedNavigate";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrentTrainer } from "@/hooks/useCurrentTrainer";
import { TrainerProfileView } from "@/components/admin/TrainerProfileView";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import SEOHead from "@/components/common/SEOHead";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Instructor workspace inside the learner dashboard shell — same `TrainerProfileView`
 * as admin trainer detail (profile, trainings, schedule, bookings, payments).
 */
const DashboardTrainerWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const navigate = useLocalizedNavigate();
  const { trainer, isLoading } = useCurrentTrainer();

  if (isLoading || !trainer) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-4" dir={isRTL ? "rtl" : "ltr"} aria-busy="true">
        <Skeleton className="h-10 w-48 max-w-full rounded-md" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <>
      <SEOHead title={t("dashboard.trainerWorkspaceSeoTitle")} description={t("dashboard.trainerWorkspaceSubtitle")} noindex />
      <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6 pb-16 safe-area-bottom min-w-0" dir={isRTL ? "rtl" : "ltr"}>
        <Button type="button" variant="ghost" size="sm" className="gap-2 shrink-0" onClick={() => navigate("/dashboard")}>
          {isRTL ? <ArrowRight className="h-4 w-4" aria-hidden /> : <ArrowLeft className="h-4 w-4" aria-hidden />}
          {t("dashboard.trainerWorkspaceBack")}
        </Button>
        <TrainerProfileView trainerId={trainer.id} managerMode="self" />
      </div>
    </>
  );
};

export default DashboardTrainerWorkspace;
