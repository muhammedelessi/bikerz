import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrentTrainer } from "@/hooks/useCurrentTrainer";
import TrainerDashboardLayout, { type TrainerDashboardTab } from "@/components/trainer/TrainerDashboardLayout";
import TrainerProfileDialog, {
  AddTrainingForTrainerDialog,
  TrainingSection,
  UnlinkedReviews,
} from "@/components/admin/TrainerProfileDialog";
import { TrainerScheduleManager } from "@/components/admin/trainer/TrainerScheduleManager";
import { TrainerBookingsManager } from "@/components/admin/trainer/TrainerBookingsManager";
import { TrainerAdminPaymentsSection } from "@/components/admin/trainer/TrainerAdminPaymentsSection";
import { Button } from "@/components/ui/button";
import { BookOpen, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const TrainerDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { trainer, refetch } = useCurrentTrainer();
  const [addTrainingOpen, setAddTrainingOpen] = React.useState(false);

  const trainerId = trainer?.id ?? "";

  const { data: students, isLoading: loadingStudents } = useQuery({
    queryKey: ["trainer-profile-students", trainerId],
    queryFn: async () => {
      const { data } = await supabase.from("training_students").select("*").eq("trainer_id", trainerId).order("enrolled_at", { ascending: false });
      return data || [];
    },
    enabled: !!trainerId,
  });

  const { data: reviews, isLoading: loadingReviews } = useQuery({
    queryKey: ["trainer-profile-reviews", trainerId],
    queryFn: async () => {
      const { data } = await supabase.from("trainer_reviews").select("*").eq("trainer_id", trainerId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!trainerId,
  });

  const { data: trainerCourses, isLoading: loadingCourses } = useQuery({
    queryKey: ["trainer-profile-courses", trainerId],
    queryFn: async () => {
      const { data } = await supabase.from("trainer_courses").select("*, trainings(name_ar, name_en)").eq("trainer_id", trainerId);
      return data || [];
    },
    enabled: !!trainerId,
  });

  if (!trainer) return null;

  const renderTab = (tab: TrainerDashboardTab) => {
    switch (tab) {
      case "profile":
        return (
          <TrainerProfileDialog
            trainer={trainer}
            mode="self"
            variant="inline"
            onTrainerUpdated={() => {
              void refetch();
            }}
          />
        );
      case "trainings":
        return (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold">{t("trainerDashboard.trainings.title")}</h2>
                <p className="text-xs text-muted-foreground">{t("trainerDashboard.trainings.hint")}</p>
              </div>
              <Button type="button" size="sm" className="gap-1.5 shrink-0" onClick={() => setAddTrainingOpen(true)}>
                <Plus className="h-4 w-4" />
                {t("trainerDashboard.trainings.addButton")}
              </Button>
            </div>
            {loadingStudents || loadingReviews || loadingCourses ? (
              <div className="space-y-2">
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
              </div>
            ) : !trainerCourses?.length ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                <BookOpen className="h-8 w-8 opacity-40" aria-hidden />
                <p className="text-sm">{t("trainerDashboard.trainings.empty")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {trainerCourses.map((tc: Record<string, unknown>) => (
                  <TrainingSection
                    key={String(tc.id ?? tc.training_id)}
                    tc={tc}
                    trainerId={trainer.id}
                    students={students || []}
                    reviews={reviews || []}
                    isRTL={isRTL}
                  />
                ))}
                {reviews && <UnlinkedReviews reviews={reviews} isRTL={isRTL} />}
              </div>
            )}
            <AddTrainingForTrainerDialog
              open={addTrainingOpen}
              onOpenChange={setAddTrainingOpen}
              trainerId={trainer.id}
              existingTrainingIds={trainerCourses?.map((tc: { training_id: string }) => tc.training_id) || []}
              isRTL={isRTL}
              mode="self"
            />
          </div>
        );
      case "schedule":
        return (
          <div className="space-y-2">
            <h2 className="text-lg font-bold">{t("trainerDashboard.schedule.title")}</h2>
            <p className="text-xs text-muted-foreground pb-2">{t("trainerDashboard.schedule.subtitle")}</p>
            <TrainerScheduleManager trainerId={trainer.id} isRTL={isRTL} mode="self" />
          </div>
        );
      case "bookings":
        return (
          <div className="space-y-2">
            <h2 className="text-lg font-bold">{t("trainerDashboard.bookings.title")}</h2>
            <p className="text-xs text-muted-foreground pb-2">{t("trainerDashboard.bookings.subtitle")}</p>
            <TrainerBookingsManager trainerId={trainer.id} isRTL={isRTL} mode="self" />
          </div>
        );
      case "payments":
        return (
          <div className="space-y-2">
            <h2 className="text-lg font-bold">{t("trainerDashboard.payments.title")}</h2>
            <p className="text-xs text-muted-foreground pb-2">{t("trainerDashboard.payments.subtitle")}</p>
            <TrainerAdminPaymentsSection trainerId={trainer.id} embed mode="self" />
          </div>
        );
      default:
        return null;
    }
  };

  return <TrainerDashboardLayout>{(tab) => renderTab(tab)}</TrainerDashboardLayout>;
};

export default TrainerDashboard;
