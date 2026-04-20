import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SurveyQuestion, SurveyQuestionOption } from "@/types/survey";

function normalizeQuestion(row: Record<string, unknown>): SurveyQuestion {
  const rawOpts = (row.survey_question_options as SurveyQuestionOption[] | undefined) || [];
  const options = [...rawOpts].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const { survey_question_options: _omit, ...rest } = row;
  return {
    ...(rest as Omit<SurveyQuestion, "options">),
    options,
  };
}

export function useSurveyQuestions(surveyId: string | undefined, includeInactive = false) {
  return useQuery({
    queryKey: ["survey-questions", surveyId, includeInactive],
    queryFn: async () => {
      let q = supabase
        .from("survey_questions")
        .select("*, survey_question_options(*)")
        .eq("survey_id", surveyId!);

      if (!includeInactive) {
        q = q.eq("is_active", true);
      }

      const { data, error } = await q.order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []).map((row) => normalizeQuestion(row as Record<string, unknown>));
    },
    enabled: !!surveyId,
  });
}

export function useAdminSurveyQuestions(surveyId: string | undefined) {
  return useSurveyQuestions(surveyId, true);
}
