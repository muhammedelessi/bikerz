import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Survey, SurveyQuestion, SurveyType } from "@/types/survey";
import { useSurveyAnswers } from "./useSurveyAnswers";
import { useSurveyQuestions } from "./useSurveyQuestions";

/**
 * Filters pre-seeded catalog questions for surveys 3–4 using "yes" answers from the previous survey.
 * Pass `allQuestions` from `useSurveyQuestions(surveyId)` (single fetch in the play page).
 */
export function useDynamicQuestions(
  survey: Survey | undefined,
  userId: string | undefined,
  previousSurvey: Survey | undefined,
  allQuestions: SurveyQuestion[] | undefined,
) {
  const previousSurveyId = previousSurvey?.id;
  const needsPrev =
    !!userId &&
    !!previousSurveyId &&
    (survey?.type === "bike_subtypes" || survey?.type === "bike_models");

  const { answers: prevAnswers = [] } = useSurveyAnswers(
    needsPrev ? userId : undefined,
    needsPrev ? previousSurveyId : undefined,
  );
  const { data: prevQuestions = [] } = useSurveyQuestions(needsPrev ? previousSurveyId : undefined);

  const needsFilter = survey?.type === "bike_subtypes" || survey?.type === "bike_models";

  return useQuery({
    queryKey: [
      "dynamic-survey-questions",
      survey?.id,
      survey?.type,
      userId,
      previousSurveyId,
      prevAnswers.map((a) => `${a.question_id}:${a.answer}`).join("|"),
      allQuestions?.map((q) => q.id).join(",") ?? "",
    ],
    queryFn: async () => {
      const list = allQuestions || [];
      if (!survey || !list.length) return [] as SurveyQuestion[];

      if (!needsFilter) return list;

      if (!previousSurveyId || !userId) return list;

      const prevQById = new Map(prevQuestions.map((q) => [q.id, q]));

      if (survey.type === "bike_subtypes") {
        const yesTypeIds = new Set<string>();
        for (const a of prevAnswers) {
          if (a.answer !== "yes") continue;
          const pq = prevQById.get(a.question_id);
          if (pq?.catalog_ref_type === "bike_type" && pq.catalog_ref_id) {
            yesTypeIds.add(pq.catalog_ref_id);
          }
        }

        const subtypeIds = list
          .map((q) => (q.catalog_ref_type === "bike_subtype" ? q.catalog_ref_id : null))
          .filter(Boolean) as string[];

        if (!subtypeIds.length) return list;

        const { data: rows, error } = await supabase.from("bike_subtypes").select("id, type_id").in("id", subtypeIds);
        if (error) throw error;
        const typeBySubtype = new Map((rows || []).map((r) => [r.id, r.type_id as string]));

        if (!yesTypeIds.size) return list;

        return list.filter((q) => {
          if (q.catalog_ref_type !== "bike_subtype" || !q.catalog_ref_id) return true;
          const tid = typeBySubtype.get(q.catalog_ref_id);
          return tid ? yesTypeIds.has(tid) : false;
        });
      }

      if (survey.type === "bike_models") {
        const yesSubtypeIds = new Set<string>();
        for (const a of prevAnswers) {
          if (a.answer !== "yes") continue;
          const pq = prevQById.get(a.question_id);
          if (pq?.catalog_ref_type === "bike_subtype" && pq.catalog_ref_id) {
            yesSubtypeIds.add(pq.catalog_ref_id);
          }
        }

        const modelIds = list
          .map((q) => (q.catalog_ref_type === "bike_model" ? q.catalog_ref_id : null))
          .filter(Boolean) as string[];

        if (!modelIds.length) return list;

        const { data: models, error } = await supabase.from("bike_models").select("id, subtype_id").in("id", modelIds);
        if (error) throw error;
        const subtypeByModel = new Map((models || []).map((m) => [m.id, m.subtype_id as string]));

        if (!yesSubtypeIds.size) return list;

        return list.filter((q) => {
          if (q.catalog_ref_type !== "bike_model" || !q.catalog_ref_id) return true;
          const sid = subtypeByModel.get(q.catalog_ref_id);
          return sid ? yesSubtypeIds.has(sid) : false;
        });
      }

      return list;
    },
    enabled: !!survey && !!allQuestions?.length && (!needsFilter || (!!previousSurveyId && !!userId)),
    placeholderData: allQuestions,
    staleTime: 30_000,
  });
}

export type { SurveyType };
