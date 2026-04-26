import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { TrainerApplication } from "@/types/trainerApplication";
import { trainerApplicationQueryKey } from "@/types/trainerApplication";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** True when a rejected application still blocks re-apply (matches RLS: null reviewed_at counts as blocking). */
function isRejectedBlockingReapply(app: TrainerApplication | null | undefined): boolean {
  if (!app || app.status !== "rejected") return false;
  if (!app.reviewed_at) return true;
  const reviewed = new Date(app.reviewed_at).getTime();
  return Date.now() - reviewed < 30 * MS_PER_DAY;
}

export function useTrainerApplication() {
  const { user } = useAuth();
  const userId = user?.id;

  const query = useQuery({
    queryKey: userId ? trainerApplicationQueryKey(userId) : ["trainer-application", "anon"],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return { latest: null as TrainerApplication | null, isInstructor: false };

      const [{ data: appRow, error: appError }, { data: instructorRow, error: roleError }] = await Promise.all([
        supabase
          .from("trainer_applications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "instructor").maybeSingle(),
      ]);

      if (appError) throw appError;
      if (roleError) throw roleError;

      return {
        latest: appRow as TrainerApplication | null,
        isInstructor: !!instructorRow,
      };
    },
  });

  const latestApplication = query.data?.latest ?? null;
  const isInstructor = query.data?.isInstructor ?? false;

  const { canApply, retryAvailableAt } = useMemo(() => {
    if (isInstructor) {
      return { canApply: false, retryAvailableAt: null as Date | null };
    }
    if (latestApplication?.status === "pending" || latestApplication?.status === "approved") {
      return { canApply: false, retryAvailableAt: null };
    }
    if (isRejectedBlockingReapply(latestApplication)) {
      const baseTime = latestApplication!.reviewed_at ?? latestApplication!.created_at;
      const base = new Date(baseTime).getTime();
      return {
        canApply: false,
        retryAvailableAt: new Date(base + 30 * MS_PER_DAY),
      };
    }
    return { canApply: true, retryAvailableAt: null };
  }, [isInstructor, latestApplication]);

  return {
    latestApplication,
    isInstructor,
    canApply,
    retryAvailableAt,
    isLoading: query.isLoading,
  };
}
