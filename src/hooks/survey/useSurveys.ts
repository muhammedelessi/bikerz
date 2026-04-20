import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Survey } from "@/types/survey";

export function useSurveys() {
  return useQuery({
    queryKey: ["surveys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("surveys")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as Survey[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminAllSurveys() {
  return useQuery({
    queryKey: ["admin-surveys-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("surveys").select("*").order("sort_order");
      if (error) throw error;
      return (data || []) as Survey[];
    },
  });
}
