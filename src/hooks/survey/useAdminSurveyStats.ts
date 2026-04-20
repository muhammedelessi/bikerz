import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SurveyCompletion } from "@/types/survey";

export type SurveyCompletionWithProfile = SurveyCompletion & {
  profile: {
    user_id: string;
    full_name: string | null;
    avatar_url: string | null;
    phone: string | null;
  } | null;
};

export function useAdminSurveyStats(surveyId: string | undefined) {
  return useQuery({
    queryKey: ["admin-survey-stats", surveyId],
    queryFn: async () => {
      const { data: completions, error } = await supabase
        .from("survey_completions")
        .select("*")
        .eq("survey_id", surveyId!)
        .order("completed_at", { ascending: false });
      if (error) throw error;
      const rows = completions || [];
      const userIds = [...new Set(rows.map((r) => r.user_id))];
      let profileMap = new Map<string, SurveyCompletionWithProfile["profile"]>();
      if (userIds.length) {
        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url, phone")
          .in("user_id", userIds);
        if (pErr) throw pErr;
        profileMap = new Map((profs || []).map((p) => [p.user_id, p]));
      }
      return rows.map((c) => ({
        ...c,
        profile: profileMap.get(c.user_id) ?? null,
      })) as SurveyCompletionWithProfile[];
    },
    enabled: !!surveyId,
  });
}

export function useStudentSurveyAnswers(userId: string | undefined, surveyId: string | undefined) {
  return useQuery({
    queryKey: ["admin-student-answers", userId, surveyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_answers")
        .select(
          `
          *,
          survey_questions (
            title_ar, title_en, question_type, image_url,
            survey_question_options (*)
          )
        `,
        )
        .eq("user_id", userId!)
        .eq("survey_id", surveyId!)
        .order("answered_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && !!surveyId,
  });
}

export type StudentSurveyAnswerRow = {
  id: string;
  question_id: string;
  answer: string;
  is_correct: boolean | null;
  answered_at: string;
  survey_questions: {
    title_ar: string;
    title_en: string;
    question_type: string;
    image_url: string | null;
    survey_question_options: {
      id: string;
      label_ar: string;
      label_en: string;
      is_correct: boolean;
    }[];
  } | null;
};

export function useStudentAllSurveyCompletions(userId: string | undefined) {
  return useQuery({
    queryKey: ["admin-student-all-completions", userId],
    queryFn: async () => {
      const { data: completions, error } = await supabase
        .from("survey_completions")
        .select("*")
        .eq("user_id", userId!)
        .order("completed_at", { ascending: false });
      if (error) throw error;
      const rows = completions || [];
      const sids = [...new Set(rows.map((r) => r.survey_id))];
      let surveyMap = new Map<string, { title_ar: string; title_en: string; type: string }>();
      if (sids.length) {
        const { data: surv, error: sErr } = await supabase
          .from("surveys")
          .select("id, title_ar, title_en, type")
          .in("id", sids);
        if (sErr) throw sErr;
        surveyMap = new Map((surv || []).map((s) => [s.id, s]));
      }
      return rows.map((c) => ({
        ...c,
        survey: surveyMap.get(c.survey_id) ?? null,
      }));
    },
    enabled: !!userId,
  });
}

export function useStudentAllSurveyAnswerRows(userId: string | undefined) {
  return useQuery({
    queryKey: ["admin-student-all-answers", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_answers")
        .select(
          `
          *,
          survey_questions (
            title_ar, title_en, question_type,
            survey_question_options (*)
          )
        `,
        )
        .eq("user_id", userId!)
        .order("answered_at", { ascending: true });
      if (error) throw error;
      const rows = data || [];
      const sids = [...new Set(rows.map((r: { survey_id: string }) => r.survey_id))];
      let surveyMap = new Map<string, { title_ar: string; title_en: string }>();
      if (sids.length) {
        const { data: surv, error: sErr } = await supabase.from("surveys").select("id, title_ar, title_en").in("id", sids);
        if (sErr) throw sErr;
        surveyMap = new Map((surv || []).map((s) => [s.id, s]));
      }
      return rows.map((r: { survey_id: string; survey_questions: unknown }) => ({
        ...r,
        survey: surveyMap.get(r.survey_id) ?? null,
      }));
    },
    enabled: !!userId,
  });
}
