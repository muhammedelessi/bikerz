/** Stored in `trainers.language_levels` as JSON array `{ language, level }`. */
export type TrainerLanguageEntry = {
  language: string;
  level: string;
};

export const TRAINER_LANGUAGE_OPTIONS = [
  { code: 'ar', label_en: 'Arabic', label_ar: 'العربية' },
  { code: 'en', label_en: 'English', label_ar: 'الإنجليزية' },
  { code: 'fr', label_en: 'French', label_ar: 'الفرنسية' },
  { code: 'es', label_en: 'Spanish', label_ar: 'الإسبانية' },
  { code: 'de', label_en: 'German', label_ar: 'الألمانية' },
  { code: 'it', label_en: 'Italian', label_ar: 'الإيطالية' },
  { code: 'tr', label_en: 'Turkish', label_ar: 'التركية' },
  { code: 'ur', label_en: 'Urdu', label_ar: 'الأردية' },
  { code: 'hi', label_en: 'Hindi', label_ar: 'الهندية' },
  { code: 'pt', label_en: 'Portuguese', label_ar: 'البرتغالية' },
] as const;

export const LANGUAGE_LEVEL_OPTIONS = [
  { value: 'native', label_en: 'Native', label_ar: 'لغة أم' },
  { value: 'fluent', label_en: 'Fluent', label_ar: 'طلاقة' },
  { value: 'professional', label_en: 'Professional working', label_ar: 'مهنية' },
  { value: 'conversational', label_en: 'Conversational', label_ar: 'محادثة' },
  { value: 'basic', label_en: 'Basic', label_ar: 'مبتدئ' },
] as const;

export function parseLanguageLevels(raw: unknown): TrainerLanguageEntry[] {
  if (!raw || !Array.isArray(raw)) return [];
  const out: TrainerLanguageEntry[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const language = String(o.language ?? o.code ?? '').trim().toLowerCase();
    const level = String(o.level ?? '').trim().toLowerCase();
    if (!language || !level) continue;
    out.push({ language, level });
  }
  return out;
}

export function languageOptionLabel(code: string, isRTL: boolean): string {
  const o = TRAINER_LANGUAGE_OPTIONS.find((x) => x.code === code);
  if (!o) return code.toUpperCase();
  return isRTL ? o.label_ar : o.label_en;
}

/** Map DB / internal `{ language, level }` to form `{ code, level }`. */
export function languageEntriesToForm(
  rows: TrainerLanguageEntry[],
): { code: string; level: string }[] {
  return rows.map((r) => ({ code: r.language, level: r.level }));
}

/** Map form `{ code, level }` to DB `language_levels` rows. */
export function formLanguagesToDb(rows: { code: string; level: string }[]): TrainerLanguageEntry[] {
  return rows.map((r) => ({ language: r.code.trim().toLowerCase(), level: r.level.trim().toLowerCase() }));
}

/** Preset service ids use `applyTrainer.services.*`; free-text lines stay as-is. */
export function trainerServiceLineDisplayLabel(serviceIdOrLine: string, t: (key: string) => string): string {
  const raw = serviceIdOrLine.trim();
  if (!raw) return "";
  const key = `applyTrainer.services.${raw}`;
  const out = t(key);
  return out === key ? raw : out;
}
