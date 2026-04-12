/**
 * Parse Tap charge metadata for practical training bookings to show trainer vs Bikerz split.
 * Prefers explicit keys written by tap-create-charge; falls back for older rows.
 */
export type TrainingBookingPaymentBreakdown = {
  trainerSar: number;
  /** Platform commission only (excludes VAT). */
  platformMarkupSar: number | null;
  /** VAT on marked-up subtotal. */
  vatSar: number | null;
  /** Commission + VAT (Bikerz revenue). */
  bikerzSar: number;
  totalSar: number;
  markedUpSubtotalSar: number | null;
};

export function parseTrainingBookingPaymentBreakdown(
  metadata: Record<string, unknown> | null | undefined,
  chargedAmount: number,
): TrainingBookingPaymentBreakdown | null {
  if (!metadata) return null;
  const kind = String(metadata.payment_kind ?? "").toLowerCase();
  if (kind !== "training_booking" && metadata.trainer_course_id == null) return null;

  const trainer = Number(metadata.trainer_payout_base_sar);
  if (!Number.isFinite(trainer) || trainer < 0) return null;

  const totalRaw = Number.isFinite(chargedAmount) && chargedAmount > 0 ? chargedAmount : Number(metadata.final_amount);
  if (!Number.isFinite(totalRaw) || totalRaw <= 0) return null;
  const totalSar = Math.round(totalRaw * 100) / 100;

  let bikerzSar = Number(metadata.training_bikerz_revenue_sar);
  if (!Number.isFinite(bikerzSar)) {
    bikerzSar = Math.round((totalSar - trainer) * 100) / 100;
  }

  const markedUp = Number(metadata.training_marked_up_subtotal_sar);
  const markedUpSubtotalSar = Number.isFinite(markedUp) && markedUp > 0 ? Math.round(markedUp * 100) / 100 : null;

  let platformMarkupSar = Number(metadata.training_platform_markup_sar);
  if (!Number.isFinite(platformMarkupSar) && markedUpSubtotalSar != null) {
    platformMarkupSar = Math.round((markedUpSubtotalSar - trainer) * 100) / 100;
  } else if (!Number.isFinite(platformMarkupSar)) {
    platformMarkupSar = null;
  } else {
    platformMarkupSar = Math.round(platformMarkupSar * 100) / 100;
  }

  let vatSar = Number(metadata.training_vat_amount_sar);
  if (!Number.isFinite(vatSar) && markedUpSubtotalSar != null) {
    vatSar = Math.round((totalSar - markedUpSubtotalSar) * 100) / 100;
  } else if (!Number.isFinite(vatSar)) {
    const pbt = Number(metadata.price_before_tax);
    vatSar = Number.isFinite(pbt) ? Math.round((totalSar - pbt) * 100) / 100 : null;
  }
  if (vatSar != null && Number.isFinite(vatSar)) {
    vatSar = Math.round(vatSar * 100) / 100;
  } else {
    vatSar = null;
  }

  if (platformMarkupSar == null && vatSar != null && Number.isFinite(bikerzSar)) {
    platformMarkupSar = Math.round((bikerzSar - vatSar) * 100) / 100;
    if (platformMarkupSar < 0) platformMarkupSar = null;
  }

  return {
    trainerSar: Math.round(trainer * 100) / 100,
    platformMarkupSar,
    bikerzSar: Math.round(bikerzSar * 100) / 100,
    totalSar,
    markedUpSubtotalSar,
    vatSar,
  };
}
