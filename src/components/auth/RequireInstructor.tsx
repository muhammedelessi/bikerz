import React from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCurrentTrainer } from "@/hooks/useCurrentTrainer";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  children: React.ReactNode;
};

/**
 * Requires authenticated user with instructor role and a linked `trainers` row.
 * Mirrors the pattern of AdminRoute (loading gate + redirects).
 */
const RequireInstructor: React.FC<Props> = ({ children }) => {
  const { t } = useTranslation();
  const { trainer, isInstructor, isLoading } = useCurrentTrainer();

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background p-6 space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64 max-w-full" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <p className="text-xs text-muted-foreground sr-only">{t("trainerDashboard.guard.loading")}</p>
      </div>
    );
  }

  if (!isInstructor) {
    return <Navigate to="/profile" replace state={{ message: t("trainerDashboard.guard.notInstructor") }} />;
  }

  if (!trainer) {
    return <Navigate to="/dashboard/apply-trainer" replace state={{ message: t("trainerDashboard.guard.noTrainerRecord") }} />;
  }

  return <>{children}</>;
};

export default RequireInstructor;
