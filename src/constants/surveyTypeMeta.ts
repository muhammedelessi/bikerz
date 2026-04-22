import type { LucideIcon } from "lucide-react";
import { Bike, PenLine, Tag } from "lucide-react";

export type SurveyTypeMeta = {
  label_ar: string;
  label_en: string;
  icon: LucideIcon;
  color: string;
  bg: string;
};

export const SURVEY_TYPE_META: Record<string, SurveyTypeMeta> = {
  brands: {
    label_ar: "الماركات",
    label_en: "Brands",
    icon: Tag,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
  },
  bike_types: {
    label_ar: "أنواع الدراجات",
    label_en: "Bike Types",
    icon: Bike,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500/10",
  },
  bike_subtypes: {
    label_ar: "الفئات الفرعية",
    label_en: "Bike Subtypes",
    icon: Bike,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
  },
  bike_models: {
    label_ar: "الموديلات",
    label_en: "Bike Models",
    icon: Bike,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  custom: {
    label_ar: "مخصص",
    label_en: "Custom",
    icon: PenLine,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10",
  },
};
