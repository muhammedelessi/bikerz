import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type CurrentTrainerRow = {
  id: string;
  user_id: string | null;
  name_ar: string;
  name_en: string;
  photo_url: string | null;
  bio_ar: string;
  bio_en: string;
  country: string;
  city: string;
  bike_type: string;
  years_of_experience: number;
  services: string[] | null;
  status: string;
  created_at: string;
  profit_ratio: number;
};

export function useCurrentTrainer() {
  const { user, isInstructor, isLoading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ["current-trainer", user?.id] as const,
    enabled: !!user?.id && isInstructor,
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.from("trainers").select("*").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      return (data as unknown) as CurrentTrainerRow | null;
    },
  });

  return {
    trainer: query.data ?? null,
    isInstructor,
    isLoading: authLoading || (!!user && isInstructor && query.isLoading),
    error: query.error,
    refetch: query.refetch,
  };
}
