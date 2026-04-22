import type { LucideIcon } from "lucide-react";
import { Bike, PenLine, Tag } from "lucide-react";
import type { SurveyType } from "@/types/survey";

export type SurveyTypeOption = {
  value: SurveyType;
  label_ar: string;
  label_en: string;
  description_ar: string;
  description_en: string;
  icon: LucideIcon;
};

/** Admin survey creation / display — order: custom first (default), then seeded catalog types */
export const SURVEY_TYPE_OPTIONS: SurveyTypeOption[] = [
  {
    value: "custom",
    label_ar: "استطلاع مخصص",
    label_en: "Custom Survey",
    description_ar: "أسئلة يدوية بموضوع حر",
    description_en: "Manual questions on any topic",
    icon: PenLine,
  },
  {
    value: "brands",
    label_ar: "الماركات",
    label_en: "Brands",
    description_ar: "هل تعرف هذه الماركة؟",
    description_en: "Brand recognition questions",
    icon: Tag,
  },
  {
    value: "bike_types",
    label_ar: "أنواع الدراجات",
    label_en: "Bike Types",
    description_ar: "مرتبط بكتالوج الأنواع",
    description_en: "Linked to bike types catalog",
    icon: Bike,
  },
  {
    value: "bike_subtypes",
    label_ar: "الفئات الفرعية",
    label_en: "Bike Subtypes",
    description_ar: "مرتبط بكتالوج الفئات",
    description_en: "Linked to bike subtypes catalog",
    icon: Bike,
  },
  {
    value: "bike_models",
    label_ar: "الموديلات",
    label_en: "Bike Models",
    description_ar: "مرتبط بكتالوج الموديلات",
    description_en: "Linked to bike models catalog",
    icon: Bike,
  },
];

export function getSurveyTypeLabels(type: SurveyType, isRTL: boolean): { label: string } {
  const opt = SURVEY_TYPE_OPTIONS.find((o) => o.value === type);
  if (!opt) return { label: type };
  return { label: isRTL ? opt.label_ar : opt.label_en };
}

export const SURVEY_TYPES_WITH_CATALOG_IMPORT: SurveyType[] = ["bike_types", "bike_subtypes", "bike_models"];
