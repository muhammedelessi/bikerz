import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SurveyAnswer } from "@/types/survey";

export function useSurveyAnswers(userId: string | undefined, surveyId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["survey-answers", userId, surveyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_answers")
        .select("*")
        .eq("user_id", userId!)
        .eq("survey_id", surveyId!);
      if (error) throw error;
      return (data || []) as SurveyAnswer[];
    },
    enabled: !!userId && !!surveyId,
  });

  const saveAnswer = useMutation({
    mutationFn: async (payload: { question_id: string; answer: string; is_correct: boolean | null }) => {
      const { error } = await supabase.from("survey_answers").upsert(
        {
          user_id: userId!,
          survey_id: surveyId!,
          question_id: payload.question_id,
          answer: payload.answer,
          is_correct: payload.is_correct,
        },
        { onConflict: "user_id,question_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["survey-answers", userId, surveyId] });
    },
  });

  return { ...query, answers: query.data, saveAnswer };
}
