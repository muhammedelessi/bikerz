import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TrainerApplication } from "@/types/trainerApplication";

export type AdminTrainerApplicationFilter = "pending" | "approved" | "rejected" | "all";

export const ADMIN_TRAINER_APPLICATIONS_QUERY_PREFIX = ["admin-trainer-applications"] as const;

export const adminTrainerApplicationsQueryKey = (filter: AdminTrainerApplicationFilter) =>
  [...ADMIN_TRAINER_APPLICATIONS_QUERY_PREFIX, filter] as const;

export const ADMIN_TRAINER_APPLICATIONS_PENDING_COUNT_KEY = ["admin-trainer-applications-pending-count"] as const;

export type AdminTrainerApplicationProfile = {
  full_name: string | null;
  avatar_url: string | null;
};

export type AdminTrainerApplicationRow = TrainerApplication & {
  profile: AdminTrainerApplicationProfile | null;
  reviewer_profile: AdminTrainerApplicationProfile | null;
  email: string | null;
};

async function fetchTrainerApplicationsMerged(
  filter: AdminTrainerApplicationFilter,
): Promise<AdminTrainerApplicationRow[]> {
  let q = supabase.from("trainer_applications").select("*").order("created_at", { ascending: false });
  if (filter !== "all") {
    q = q.eq("status", filter);
  }
  const { data: apps, error } = await q;
  if (error) throw error;
  const rows = (apps || []) as TrainerApplication[];

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const reviewerIds = [
    ...new Set(rows.map((r) => r.reviewed_by).filter((id): id is string => Boolean(id))),
  ];
  const profileUserIds = [...new Set([...userIds, ...reviewerIds])];

  const profileMap = new Map<string, AdminTrainerApplicationProfile>();
  if (profileUserIds.length > 0) {
    const { data: profs, error: pErr } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .in("user_id", profileUserIds);
    if (pErr) throw pErr;
    (profs || []).forEach((p: { user_id: string; full_name: string | null; avatar_url: string | null }) => {
      profileMap.set(p.user_id, { full_name: p.full_name, avatar_url: p.avatar_url });
    });
  }

  const emailMap = new Map<string, string>();
  const { data: emailRows, error: eErr } = await supabase.rpc("get_all_user_emails");
  if (!eErr && emailRows) {
    (emailRows as { user_id: string; email: string | null }[]).forEach((r) => {
      if (r.email) emailMap.set(r.user_id, r.email);
    });
  }

  return rows.map((app) => ({
    ...app,
    profile: profileMap.get(app.user_id) ?? null,
    reviewer_profile: app.reviewed_by ? profileMap.get(app.reviewed_by) ?? null : null,
    email: emailMap.get(app.user_id) ?? null,
  }));
}

/** Pending count only — use on AdminTrainers tab badge without loading the full list. */
export function useAdminTrainerApplicationsPendingCount() {
  return useQuery({
    queryKey: ADMIN_TRAINER_APPLICATIONS_PENDING_COUNT_KEY,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("trainer_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useAdminTrainerApplications(filter: AdminTrainerApplicationFilter = "pending") {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: adminTrainerApplicationsQueryKey(filter),
    queryFn: () => fetchTrainerApplicationsMerged(filter),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: [...ADMIN_TRAINER_APPLICATIONS_QUERY_PREFIX] });
    queryClient.invalidateQueries({ queryKey: ADMIN_TRAINER_APPLICATIONS_PENDING_COUNT_KEY });
    queryClient.invalidateQueries({ queryKey: ["admin-trainers"] });
  };

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("trainer_applications")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: uid,
        })
        .eq("id", id)
        .eq("status", "pending");

      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("trainer_applications")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: uid,
        })
        .eq("id", id)
        .eq("status", "pending");

      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  return {
    applications: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
    error: listQuery.error,
    refetch: listQuery.refetch,
    approveApplication: approveMutation.mutateAsync,
    rejectApplication: rejectMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
}
