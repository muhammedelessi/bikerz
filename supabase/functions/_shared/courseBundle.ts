import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Idempotent: creates `course_bundles`, enrollments, and `course_bundle_enrollments` after Tap success. */
export async function completeCourseBundleAfterPayment(
  adminClient: SupabaseClient,
  userId: string,
  tapChargeId: string,
  metadata: Record<string, unknown> | null,
  amount: number,
  currency: string,
): Promise<void> {
  const meta = metadata || {};
  if (String(meta.payment_kind || "").toLowerCase() !== "course_bundle") return;

  const bundleCourseIds = meta.bundle_course_ids as string[] | undefined;
  if (!bundleCourseIds?.length || bundleCourseIds.length < 2) return;

  const { data: existing } = await adminClient
    .from("course_bundles")
    .select("id")
    .eq("payment_id", tapChargeId)
    .maybeSingle();
  if (existing) return;

  const { data: bundleRow, error: insertErr } = await adminClient
    .from("course_bundles")
    .insert({
      user_id: userId,
      course_ids: bundleCourseIds,
      courses_count: bundleCourseIds.length,
      original_price_sar: Number(meta.bundle_original_price_sar ?? 0),
      discount_percentage: Number(meta.bundle_discount_pct ?? 0),
      final_price_sar: Number(meta.bundle_final_price_sar ?? 0),
      currency: currency || "SAR",
      payment_id: tapChargeId,
      status: "completed",
    })
    .select("id")
    .single();

  if (insertErr || !bundleRow) {
    console.error("[courseBundle] insert course_bundles", insertErr);
    return;
  }

  for (const cid of bundleCourseIds) {
    const { error: enrErr } = await adminClient.from("course_enrollments").insert({
      user_id: userId,
      course_id: cid,
    });
    if (enrErr && !enrErr.message.includes("duplicate")) {
      console.error("[courseBundle] enrollment", enrErr.message);
    }
    const { error: beErr } = await adminClient.from("course_bundle_enrollments").insert({
      bundle_id: bundleRow.id,
      course_id: cid,
      user_id: userId,
    });
    if (beErr && !beErr.message.includes("duplicate")) {
      console.error("[courseBundle] bundle_enrollment", beErr.message);
    }
  }

  void amount;
}
