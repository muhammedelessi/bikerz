export type QuestionType = "yes_no" | "multiple_choice";

export type SurveyType = "brands" | "bike_types" | "bike_subtypes" | "bike_models" | "custom";

export type SurveyMode = "scored" | "preference";

/** Default mode when picking a survey type in admin (bike catalog types → preference). */
export function defaultSurveyModeForType(type: SurveyType): SurveyMode {
  return ["bike_types", "bike_subtypes", "bike_models"].includes(type) ? "preference" : "scored";
}

export interface Survey {
  id: string;
  title_ar: string;
  title_en: string;
  description_ar: string | null;
  description_en: string | null;
  type: SurveyType;
  survey_mode: SurveyMode;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface SurveyQuestionOption {
  id: string;
  question_id: string;
  label_ar: string;
  label_en: string;
  image_url: string | null;
  is_correct: boolean;
  sort_order: number;
}

export interface SurveyQuestion {
  id: string;
  survey_id: string;
  question_type: QuestionType;
  title_ar: string;
  title_en: string;
  image_url: string | null;
  catalog_ref_id: string | null;
  catalog_ref_type: "bike_type" | "bike_subtype" | "bike_model" | "brand" | null;
  sort_order: number;
  is_active?: boolean;
  survey_question_options?: SurveyQuestionOption[];
  options?: SurveyQuestionOption[];
}

export interface SurveyAnswer {
  id: string;
  user_id: string;
  survey_id: string;
  question_id: string;
  answer: string;
  is_correct: boolean | null;
  answered_at: string;
}

export interface SurveyCompletion {
  id: string;
  user_id: string;
  survey_id: string;
  score: number;
  max_score: number;
  completed_at: string;
}

export interface QuestionStats {
  question_id: string;
  yes_count: number;
  no_count: number;
  total: number;
  yes_percent: number;
  correct_percent: number | null;
}

export interface SurveyStats {
  total_participants: number;
  avg_score: number | null;
  max_score: number;
  question_stats: QuestionStats[];
  score_distribution: { range: string; count: number; percent: number }[];
}
