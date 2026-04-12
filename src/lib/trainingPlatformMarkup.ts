/** Max platform markup allowed in admin UI (percent points). */
export const TRAINING_PLATFORM_MARKUP_MAX = 500;

/** Max VAT % configurable for Saudi training charges (percent points). */
export const TRAINING_PLATFORM_VAT_MAX = 30;

/**
 * Bikerz commission: markup on the trainer's listed SAR base (stored in `trainer_courses.price`).
 * Example: base 100 SAR, markup 34% → customer pre-VAT subtotal 134 SAR (then VAT applies in checkout).
 */
export function clampTrainingPlatformMarkupPercent(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(TRAINING_PLATFORM_MARKUP_MAX, n);
}

export function parseMarkupPercentFromAdminValue(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return clampTrainingPlatformMarkupPercent(value);
  if (typeof value === 'object' && value !== null && 'percent' in value) {
    return clampTrainingPlatformMarkupPercent((value as { percent: unknown }).percent);
  }
  return 0;
}

export function applyTrainingPlatformMarkupSar(trainerBaseSar: number, markupPercent: number): number {
  const base = Number(trainerBaseSar);
  if (!Number.isFinite(base) || base <= 0) return 0;
  const pct = clampTrainingPlatformMarkupPercent(markupPercent);
  const mult = 1 + pct / 100;
  return Math.round(base * mult * 100) / 100;
}

export function clampTrainingVatPercent(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(TRAINING_PLATFORM_VAT_MAX, n);
}

export function parseVatPercentFromAdminValue(value: unknown): number {
  if (value == null) return 15;
  if (typeof value === "number") return clampTrainingVatPercent(value);
  if (typeof value === "object" && value !== null && "percent" in value) {
    return clampTrainingVatPercent((value as { percent: unknown }).percent);
  }
  return 15;
}

/**
 * Subtotal after platform markup, before VAT (matches Tap server `markedUpSar`).
 */
export function trainingSubtotalAfterMarkupSar(trainerBaseSar: number, markupPercent: number): number {
  return applyTrainingPlatformMarkupSar(trainerBaseSar, markupPercent);
}

/**
 * Total SAR charged (including VAT), aligned with Edge: `Math.ceil(subtotal * (1 + vat/100))`.
 */
export function trainingCustomerChargeTotalSar(
  trainerBaseSar: number,
  markupPercent: number,
  vatPercent: number,
): number {
  const sub = trainingSubtotalAfterMarkupSar(trainerBaseSar, markupPercent);
  if (!Number.isFinite(sub) || sub <= 0) return 0;
  const v = clampTrainingVatPercent(vatPercent);
  const mult = 1 + v / 100;
  return Math.ceil(sub * mult);
}
