import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SurveyCompletion } from "@/types/survey";

export function useSurveyCompletion(userId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["survey-completions", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("survey_completions").select("*").eq("user_id", userId!);
      if (error) throw error;
      return (data || []) as SurveyCompletion[];
    },
    enabled: !!userId,
  });

  const saveCompletion = useMutation({
    mutationFn: async (payload: { survey_id: string; score: number; max_score: number }) => {
      const { error } = await supabase.from("survey_completions").upsert(
        {
          user_id: userId!,
          survey_id: payload.survey_id,
          score: payload.score,
          max_score: payload.max_score,
        },
        { onConflict: "user_id,survey_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["survey-completions", userId] });
    },
  });

  return { ...query, completions: query.data, saveCompletion };
}
