export const AMBASSADOR_CLIP_CATEGORIES = [
  "think_what_if_tips",
  "bikerz_behavior_group_ride",
  "bikerz_behavior_maintenance",
  "bikerz_behavior_lifestyle",
  "master_your_bike_recommendations",
  "master_your_bike_specifications",
] as const;

export type AmbassadorClipCategory = (typeof AMBASSADOR_CLIP_CATEGORIES)[number];

/** The three top-level types under Ambassador (only 2 and 3 have sub-branches in the product). */
export const AMBASSADOR_CLIP_PARENTS = [
  "think_what_if",
  "bikerz_behavior",
  "master_your_bike",
] as const;

export type AmbassadorClipParent = (typeof AMBASSADOR_CLIP_PARENTS)[number];

export function isAmbassadorClipCategory(v: string | null | undefined): v is AmbassadorClipCategory {
  return !!v && (AMBASSADOR_CLIP_CATEGORIES as readonly string[]).includes(v);
}

export function isAmbassadorClipParent(v: string | null | undefined): v is AmbassadorClipParent {
  return !!v && (AMBASSADOR_CLIP_PARENTS as readonly string[]).includes(v);
}

/** Which main type each stored leaf belongs to. */
export const AMBASSADOR_CATEGORY_PARENT: Record<AmbassadorClipCategory, AmbassadorClipParent> = {
  think_what_if_tips: "think_what_if",
  bikerz_behavior_group_ride: "bikerz_behavior",
  bikerz_behavior_maintenance: "bikerz_behavior",
  bikerz_behavior_lifestyle: "bikerz_behavior",
  master_your_bike_recommendations: "master_your_bike",
  master_your_bike_specifications: "master_your_bike",
};

export function ambassadorClipParentOf(
  category: AmbassadorClipCategory | null | undefined,
): AmbassadorClipParent | null {
  if (!category || !isAmbassadorClipCategory(category)) return null;
  return AMBASSADOR_CATEGORY_PARENT[category];
}

/** Leaf categories under each main type (for filters). */
export const AMBASSADOR_LEAVES_BY_PARENT: Record<AmbassadorClipParent, readonly AmbassadorClipCategory[]> = {
  think_what_if: ["think_what_if_tips"],
  bikerz_behavior: [
    "bikerz_behavior_group_ride",
    "bikerz_behavior_maintenance",
    "bikerz_behavior_lifestyle",
  ],
  master_your_bike: ["master_your_bike_recommendations", "master_your_bike_specifications"],
};

const CLIP_FILTER_PARENT_PREFIX = "parent:";

/** Select value when filtering by an entire main branch (all its leaves). */
export function clipFilterValueForParent(parent: AmbassadorClipParent): string {
  return `${CLIP_FILTER_PARENT_PREFIX}${parent}`;
}

export function clipFilterParentFromSelectValue(v: string): AmbassadorClipParent | null {
  if (!v.startsWith(CLIP_FILTER_PARENT_PREFIX)) return null;
  const rest = v.slice(CLIP_FILTER_PARENT_PREFIX.length);
  return isAmbassadorClipParent(rest) ? rest : null;
}

/** Map filter dropdown value → allowed leaf categories; `null` = no filter (all clips). */
export function allowedCategoriesForClipFilterSelectValue(
  filterValue: string | null | undefined,
): Set<AmbassadorClipCategory> | null {
  if (filterValue == null || filterValue === "" || filterValue === "all") return null;
  const parent = clipFilterParentFromSelectValue(filterValue);
  if (parent) return new Set(AMBASSADOR_LEAVES_BY_PARENT[parent]);
  if (isAmbassadorClipCategory(filterValue)) return new Set([filterValue]);
  return null;
}

export function ambassadorClipParentLabel(parent: AmbassadorClipParent, isRTL: boolean): string {
  const t = AMBASSADOR_MAIN_TYPE_LABELS[parent];
  return isRTL ? t.ar : t.en;
}

const AMBASSADOR_MAIN_TYPE_LABELS: Record<AmbassadorClipParent, { en: string; ar: string }> = {
  think_what_if: {
    en: "1. Think what if tips",
    ar: "١. نصائح «ماذا لو»",
  },
  bikerz_behavior: {
    en: "2. Bikerz Behavior tips",
    ar: "٢. نصائح سلوك بايكرز",
  },
  master_your_bike: {
    en: "3. Master your bike tips",
    ar: "٣. نصائح أتقن دراجتك",
  },
};

const LABELS: Record<
  AmbassadorClipCategory,
  { en: string; ar: string }
> = {
  think_what_if_tips: {
    en: "Think what if tips",
    ar: "نصائح «ماذا لو»",
  },
  bikerz_behavior_group_ride: {
    en: "Bikerz Behavior — A. Group ride tips",
    ar: "سلوك بايكرز — أ. نصائح الرحلة الجماعية",
  },
  bikerz_behavior_maintenance: {
    en: "Bikerz Behavior — B. Maintenance tips",
    ar: "سلوك بايكرز — ب. نصائح الصيانة",
  },
  bikerz_behavior_lifestyle: {
    en: "Bikerz Behavior — C. Lifestyle tips",
    ar: "سلوك بايكرز — ج. نصائح أسلوب الحياة",
  },
  master_your_bike_recommendations: {
    en: "Master your bike — A. Bikes recommendations tips",
    ar: "أتقن دراجتك — أ. نصائح توصيات الدراجات",
  },
  master_your_bike_specifications: {
    en: "Master your bike — B. Bikes specifications tips",
    ar: "أتقن دراجتك — ب. نصائح مواصفات الدراجات",
  },
};

export function ambassadorClipCategoryLabel(
  category: AmbassadorClipCategory | null | undefined,
  isRTL: boolean,
): string {
  if (!category || !isAmbassadorClipCategory(category)) {
    return isRTL ? "بدون تصنيف" : "Uncategorized";
  }
  return isRTL ? LABELS[category].ar : LABELS[category].en;
}

/** Short card copy: sub-topic only (no main bucket, no A/B/C numbering). */
const CARD_SUB_DISPLAY: Record<AmbassadorClipCategory, { en: string; ar: string }> = {
  think_what_if_tips: {
    en: "Think what if tips",
    ar: "نصائح ماذا لو",
  },
  bikerz_behavior_group_ride: {
    en: "Group ride tips",
    ar: "نصائح الرحلة الجماعية",
  },
  bikerz_behavior_maintenance: {
    en: "Maintenance tips",
    ar: "نصائح الصيانة",
  },
  bikerz_behavior_lifestyle: {
    en: "Lifestyle tips",
    ar: "نصائح أسلوب الحياة",
  },
  master_your_bike_recommendations: {
    en: "Bikes recommendations tips",
    ar: "نصائح توصيات الدراجات",
  },
  master_your_bike_specifications: {
    en: "Bikes specifications tips",
    ar: "نصائح مواصفات الدراجات",
  },
};

export function ambassadorClipCardSubLabel(
  category: AmbassadorClipCategory | null | undefined,
  isRTL: boolean,
): string | null {
  if (!category || !isAmbassadorClipCategory(category)) return null;
  return isRTL ? CARD_SUB_DISPLAY[category].ar : CARD_SUB_DISPLAY[category].en;
}

/** Group headings + options for admin selects (ordered). */
export const AMBASSADOR_CLIP_SELECT_GROUPS: {
  parent: AmbassadorClipParent;
  heading: { en: string; ar: string };
  options: { value: AmbassadorClipCategory; line: { en: string; ar: string } }[];
}[] = [
  {
    parent: "think_what_if",
    heading: {
      en: "1. Think what if tips",
      ar: "١. نصائح «ماذا لو»",
    },
    options: [
      {
        value: "think_what_if_tips",
        line: { en: "Think what if tips", ar: "نصائح ماذا لو" },
      },
    ],
  },
  {
    parent: "bikerz_behavior",
    heading: {
      en: "2. Bikerz Behavior tips",
      ar: "٢. نصائح سلوك بايكرز",
    },
    options: [
      {
        value: "bikerz_behavior_group_ride",
        line: { en: "A. Group ride tips", ar: "أ. نصائح الرحلة الجماعية" },
      },
      {
        value: "bikerz_behavior_maintenance",
        line: { en: "B. Maintenance tips", ar: "ب. نصائح الصيانة" },
      },
      {
        value: "bikerz_behavior_lifestyle",
        line: { en: "C. Lifestyle tips", ar: "ج. نصائح أسلوب الحياة" },
      },
    ],
  },
  {
    parent: "master_your_bike",
    heading: {
      en: "3. Master your bike tips",
      ar: "٣. نصائح أتقن دراجتك",
    },
    options: [
      {
        value: "master_your_bike_recommendations",
        line: {
          en: "A. Bikes recommendations tips",
          ar: "أ. نصائح توصيات الدراجات",
        },
      },
      {
        value: "master_your_bike_specifications",
        line: {
          en: "B. Bikes specifications tips",
          ar: "ب. نصائح مواصفات الدراجات",
        },
      },
    ],
  },
];

const LEAVES_OMITTED_FROM_PUBLIC_CLIP_FILTER: ReadonlySet<AmbassadorClipCategory> = new Set([
  "think_what_if_tips",
]);

/** Leaf rows shown under each group in public clip filters (admin uses full `options`). */
export function ambassadorClipPublicFilterLeafOptions(
  group: (typeof AMBASSADOR_CLIP_SELECT_GROUPS)[number],
): { value: AmbassadorClipCategory; line: { en: string; ar: string } }[] {
  return group.options.filter((o) => !LEAVES_OMITTED_FROM_PUBLIC_CLIP_FILTER.has(o.value));
}

/** Branch line only (A/B/C…), for secondary filter UI. */
export function ambassadorClipBranchLabel(
  category: AmbassadorClipCategory,
  isRTL: boolean,
): string {
  for (const g of AMBASSADOR_CLIP_SELECT_GROUPS) {
    const hit = g.options.find((o) => o.value === category);
    if (hit) return isRTL ? hit.line.ar : hit.line.en;
  }
  return ambassadorClipCategoryLabel(category, isRTL);
}

/** Filter videos by allowed leaf categories; `allowed` null = no category filter. */
export function filterVideosByAllowedCategories<
  T extends { ambassador_clip_category?: AmbassadorClipCategory | null },
>(videos: T[], allowed: Set<AmbassadorClipCategory> | null): T[] {
  if (!allowed) return [...videos];
  return videos.filter(
    (v) =>
      v.ambassador_clip_category != null &&
      allowed.has(v.ambassador_clip_category as AmbassadorClipCategory),
  );
}

/** Lowercase blob of EN+AR labels for search (ambassador name is handled separately). */
export function ambassadorClipCategorySearchBlob(
  category: AmbassadorClipCategory | null | undefined,
): string {
  if (!category || !isAmbassadorClipCategory(category)) return "";
  const leaf = LABELS[category];
  const parent = AMBASSADOR_CATEGORY_PARENT[category];
  const main = AMBASSADOR_MAIN_TYPE_LABELS[parent];
  const parts = [main.en, main.ar, leaf.en, leaf.ar];
  for (const g of AMBASSADOR_CLIP_SELECT_GROUPS) {
    for (const o of g.options) {
      if (o.value === category) {
        parts.push(g.heading.en, g.heading.ar, o.line.en, o.line.ar);
      }
    }
  }
  const short = CARD_SUB_DISPLAY[category];
  parts.push(short.en, short.ar);
  return parts.join(" ").toLowerCase();
}
