/** Max platform markup allowed in admin UI (percent points). */
export const TRAINING_PLATFORM_MARKUP_MAX = 500;

/** Max VAT % configurable for Saudi training charges (percent points). */
export const TRAINING_PLATFORM_VAT_MAX = 30;

/**
 * Bikerz commission: markup on the trainer's listed SAR base (stored in `trainer_courses.price`).
 * Example: base 100 SAR, commission 15% → pre-VAT subtotal 115 SAR; then VAT (e.g. 15%) on that subtotal → charged total ceil(115×1.15)=133 SAR.
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

/** Missing admin row = 0% (no VAT until configured). */
export function parseVatPercentFromAdminValue(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return clampTrainingVatPercent(value);
  if (typeof value === "object" && value !== null && "percent" in value) {
    return clampTrainingVatPercent((value as { percent: unknown }).percent);
  }
  return 0;
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
  const b = computeTrainingPricingBreakdownSar(trainerBaseSar, markupPercent, vatPercent);
  return b.totalChargedSar;
}

/** Full SAR breakdown for UI and reconciliation (trainer share vs Bikerz commission vs VAT). */
export type TrainingPricingBreakdownSar = {
  trainerBaseSar: number;
  /** Platform commission only (ex VAT). */
  platformCommissionSar: number;
  /** After commission, before VAT (same as Tap `training_marked_up_subtotal_sar`). */
  subtotalBeforeVatSar: number;
  /** VAT at `vatPercent` on `subtotalBeforeVatSar` (two decimal places). */
  vatAmountSar: number;
  /** Amount sent to Tap (SAR); may be slightly above subtotal+vatAmount due to per-halala rounding. */
  totalChargedSar: number;
  markupPercent: number;
  vatPercent: number;
};

export function computeTrainingPricingBreakdownSar(
  trainerBaseSar: number,
  markupPercent: number,
  vatPercent: number,
): TrainingPricingBreakdownSar {
  const raw = Number(trainerBaseSar);
  const trainerBase = !Number.isFinite(raw) || raw <= 0 ? 0 : Math.round(raw * 100) / 100;
  const m = clampTrainingPlatformMarkupPercent(markupPercent);
  const v = clampTrainingVatPercent(vatPercent);
  const subtotalBeforeVatSar = applyTrainingPlatformMarkupSar(trainerBase, m);
  const platformCommissionSar = Math.round((subtotalBeforeVatSar - trainerBase) * 100) / 100;
  const vatAmountSar = Math.round(subtotalBeforeVatSar * (v / 100) * 100) / 100;
  const totalChargedSar =
    subtotalBeforeVatSar <= 0 ? 0 : Math.ceil(subtotalBeforeVatSar * (1 + v / 100));
  return {
    trainerBaseSar: trainerBase,
    platformCommissionSar,
    subtotalBeforeVatSar,
    vatAmountSar,
    totalChargedSar,
    markupPercent: m,
    vatPercent: v,
  };
}
