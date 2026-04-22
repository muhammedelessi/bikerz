import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { QuestionType, SurveyMode, SurveyType } from "@/types/survey";

export async function uploadSurveyImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("IMAGE_TYPE");
  if (file.size > 5 * 1024 * 1024) throw new Error("IMAGE_SIZE");
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("AUTH_REQUIRED");
  const ext = (file.name.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "") || "jpg";
  // Path must be {userId}/... — avatars bucket RLS matches foldername(name)[1] to auth.uid()
  const path = `${user.id}/survey-assets/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
  });
  if (error) throw error;
  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);
  return publicUrl;
}

/** Import one yes/no question per catalog row for bike_types, bike_subtypes, or bike_models surveys. */
export function useImportCatalogQuestions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (surveyId: string) => {
      const { data: survey, error: sErr } = await supabase.from("surveys").select("type").eq("id", surveyId).single();
      if (sErr) throw sErr;

      if (survey?.type === "brands" || survey?.type === "custom") {
        throw new Error("IMPORT_NOT_SUPPORTED");
      }

      if (survey?.type === "bike_types") {
        const { data: types, error: tErr } = await supabase.from("bike_types").select("*").order("sort_order");
        if (tErr) throw tErr;
        for (const bt of types || []) {
          const { data: existing } = await supabase
            .from("survey_questions")
            .select("id")
            .eq("survey_id", surveyId)
            .eq("catalog_ref_id", bt.id)
            .eq("catalog_ref_type", "bike_type")
            .maybeSingle();
          if (existing) continue;
          const title_ar = `هل تفضل دراجات ${bt.name_ar}؟`;
          const title_en = `Do you prefer ${bt.name_en} motorcycles?`;
          const { error: insErr } = await supabase.from("survey_questions").insert({
            survey_id: surveyId,
            question_type: "yes_no",
            title_ar,
            title_en,
            catalog_ref_id: bt.id,
            catalog_ref_type: "bike_type",
            sort_order: bt.sort_order ?? 0,
            is_active: true,
          });
          if (insErr) throw insErr;
        }
        return;
      }

      if (survey?.type === "bike_subtypes") {
        const { data: rows, error: e } = await supabase.from("bike_subtypes").select("*").order("sort_order");
        if (e) throw e;
        for (const bs of rows || []) {
          const { data: existing } = await supabase
            .from("survey_questions")
            .select("id")
            .eq("survey_id", surveyId)
            .eq("catalog_ref_id", bs.id)
            .eq("catalog_ref_type", "bike_subtype")
            .maybeSingle();
          if (existing) continue;
          const title_ar = `هل تفضل ${bs.name_ar}؟`;
          const title_en = `Do you prefer ${bs.name_en}?`;
          const { error: insErr } = await supabase.from("survey_questions").insert({
            survey_id: surveyId,
            question_type: "yes_no",
            title_ar,
            title_en,
            catalog_ref_id: bs.id,
            catalog_ref_type: "bike_subtype",
            sort_order: bs.sort_order ?? 0,
            is_active: true,
          });
          if (insErr) throw insErr;
        }
        return;
      }

      if (survey?.type === "bike_models") {
        const { data: rows, error: e } = await supabase.from("bike_models").select("*").order("sort_order");
        if (e) throw e;
        for (const bm of rows || []) {
          const { data: existing } = await supabase
            .from("survey_questions")
            .select("id")
            .eq("survey_id", surveyId)
            .eq("catalog_ref_id", bm.id)
            .eq("catalog_ref_type", "bike_model")
            .maybeSingle();
          if (existing) continue;
          const title_ar = `هل تفضل ${bm.brand} ${bm.model_name}؟`;
          const title_en = `Do you prefer ${bm.brand} ${bm.model_name}?`;
          const { error: insErr } = await supabase.from("survey_questions").insert({
            survey_id: surveyId,
            question_type: "yes_no",
            title_ar,
            title_en,
            catalog_ref_id: bm.id,
            catalog_ref_type: "bike_model",
            sort_order: bm.sort_order ?? 0,
            is_active: true,
          });
          if (insErr) throw insErr;
        }
        return;
      }

      throw new Error("WRONG_SURVEY_TYPE");
    },
    onSuccess: (_, surveyId) => {
      queryClient.invalidateQueries({ queryKey: ["survey-questions", surveyId] });
      queryClient.invalidateQueries({ queryKey: ["survey-questions", surveyId, true] });
    },
  });
}


export function useDeleteSurveyQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ questionId, surveyId }: { questionId: string; surveyId: string }) => {
      const { error } = await supabase.from("survey_questions").delete().eq("id", questionId);
      if (error) throw error;
      return surveyId;
    },
    onSuccess: (surveyId) => {
      queryClient.invalidateQueries({ queryKey: ["survey-questions", surveyId] });
      queryClient.invalidateQueries({ queryKey: ["survey-questions", surveyId, true] });
    },
  });
}

export type SurveyQuestionUpsert = {
  id?: string;
  survey_id: string;
  question_type: QuestionType;
  title_ar: string;
  title_en: string;
  image_url: string | null;
  catalog_ref_id: string | null;
  catalog_ref_type: "bike_type" | "bike_subtype" | "bike_model" | "brand" | null;
  sort_order: number;
  is_active: boolean;
  options: {
    id?: string;
    label_ar: string;
    label_en: string;
    image_url: string | null;
    is_correct: boolean;
    sort_order: number;
  }[];
};

export function useUpsertSurveyQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SurveyQuestionUpsert) => {
      const { options, ...qrow } = payload;
      let questionId = qrow.id;

      if (questionId) {
        const { error } = await supabase
          .from("survey_questions")
          .update({
            question_type: qrow.question_type,
            title_ar: qrow.title_ar,
            title_en: qrow.title_en,
            image_url: qrow.image_url,
            catalog_ref_id: qrow.catalog_ref_id,
            catalog_ref_type: qrow.catalog_ref_type,
            sort_order: qrow.sort_order,
            is_active: qrow.is_active,
          })
          .eq("id", questionId);
        if (error) throw error;
        if (qrow.question_type === "yes_no") {
          const { error: delOptErr } = await supabase
            .from("survey_question_options")
            .delete()
            .eq("question_id", questionId);
          if (delOptErr) throw delOptErr;
        }
      } else {
        const { data: inserted, error } = await supabase
          .from("survey_questions")
          .insert({
            survey_id: qrow.survey_id,
            question_type: qrow.question_type,
            title_ar: qrow.title_ar,
            title_en: qrow.title_en,
            image_url: qrow.image_url,
            catalog_ref_id: qrow.catalog_ref_id,
            catalog_ref_type: qrow.catalog_ref_type,
            sort_order: qrow.sort_order,
            is_active: qrow.is_active,
          })
          .select("id")
          .single();
        if (error) throw error;
        questionId = inserted!.id;
      }

      if (qrow.question_type === "multiple_choice") {
        const { data: existingOpts } = await supabase
          .from("survey_question_options")
          .select("id")
          .eq("question_id", questionId!);
        const keepIds = new Set(options.filter((o) => o.id).map((o) => o.id!));
        for (const old of existingOpts || []) {
          if (!keepIds.has(old.id)) {
            const { error: delErr } = await supabase.from("survey_question_options").delete().eq("id", old.id);
            if (delErr) throw delErr;
          }
        }
        for (let i = 0; i < options.length; i++) {
          const o = options[i];
          if (o.id) {
            const { error } = await supabase
              .from("survey_question_options")
              .update({
                label_ar: o.label_ar,
                label_en: o.label_en,
                image_url: o.image_url,
                is_correct: o.is_correct,
                sort_order: o.sort_order ?? i,
              })
              .eq("id", o.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from("survey_question_options").insert({
              question_id: questionId!,
              label_ar: o.label_ar,
              label_en: o.label_en,
              image_url: o.image_url,
              is_correct: o.is_correct,
              sort_order: o.sort_order ?? i,
            });
            if (error) throw error;
          }
        }
      }

      return { surveyId: qrow.survey_id, questionId: questionId! };
    },
    onSuccess: ({ surveyId }) => {
      queryClient.invalidateQueries({ queryKey: ["survey-questions", surveyId] });
      queryClient.invalidateQueries({ queryKey: ["survey-questions", surveyId, true] });
    },
  });
}

export function useUpdateSurveyMeta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      title_ar: string;
      title_en: string;
      description_ar: string | null;
      description_en: string | null;
      is_active: boolean;
      sort_order?: number;
      survey_mode?: SurveyMode;
    }) => {
      const update: Record<string, unknown> = {
        title_ar: payload.title_ar,
        title_en: payload.title_en,
        description_ar: payload.description_ar,
        description_en: payload.description_en,
        is_active: payload.is_active,
      };
      if (payload.survey_mode !== undefined) {
        update.survey_mode = payload.survey_mode;
      }
      if (payload.sort_order !== undefined) {
        update.sort_order = payload.sort_order;
      }
      const { error } = await supabase.from("surveys").update(update).eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      queryClient.invalidateQueries({ queryKey: ["admin-surveys-all"] });
    },
  });
}

export function useDeleteSurvey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (surveyId: string) => {
      const { error } = await supabase.from("surveys").delete().eq("id", surveyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      queryClient.invalidateQueries({ queryKey: ["admin-surveys-all"] });
    },
  });
}

export function useCreateSurvey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      title_ar: string;
      title_en: string;
      description_ar: string | null;
      description_en: string | null;
      type: SurveyType;
      survey_mode: SurveyMode;
      sort_order: number;
      is_active?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("surveys")
        .insert({
          title_ar: payload.title_ar,
          title_en: payload.title_en,
          description_ar: payload.description_ar,
          description_en: payload.description_en,
          type: payload.type,
          survey_mode: payload.survey_mode,
          sort_order: payload.sort_order,
          is_active: payload.is_active ?? true,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      queryClient.invalidateQueries({ queryKey: ["admin-surveys-all"] });
    },
  });
}
