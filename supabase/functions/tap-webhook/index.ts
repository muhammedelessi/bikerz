import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const tapSecretKey = Deno.env.get("TAP_SECRET_KEY")!;

    const body = await req.json();

    console.log("Webhook received:", body.id, "status:", body.status);

    // ── Validate webhook: verify the charge with Tap API ──
    const chargeId = body.id;
    if (!chargeId || typeof chargeId !== "string" || !chargeId.startsWith("chg_")) {
      console.error("Invalid webhook payload: missing or invalid charge ID");
      return new Response(
        JSON.stringify({ error: "Invalid payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify charge by retrieving it from Tap API (source of truth)
    const verifyResponse = await fetch(`https://api.tap.company/v2/charges/${chargeId}`, {
      headers: {
        Authorization: `Bearer ${tapSecretKey}`,
      },
    });

    if (!verifyResponse.ok) {
      console.error("Failed to verify charge with Tap API:", verifyResponse.status);
      return new Response(
        JSON.stringify({ error: "Charge verification failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const verifiedCharge = await verifyResponse.json();
    const verifiedStatus = mapTapStatus(verifiedCharge.status);

    console.log("Verified charge:", chargeId, "status:", verifiedStatus);

    // ── Update charge record in database ──
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: existingCharge, error: fetchError } = await adminClient
      .from("tap_charges")
      .select("id, user_id, course_id, status, amount, metadata")
      .eq("charge_id", chargeId)
      .maybeSingle();

    if (fetchError || !existingCharge) {
      console.error("Charge not found in DB:", chargeId);
      // Still return 200 to prevent Tap from retrying for unknown charges
      return new Response(
        JSON.stringify({ received: true, warning: "charge_not_found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent replay: don't downgrade a succeeded charge
    if (existingCharge.status === "succeeded" && verifiedStatus !== "succeeded") {
      console.log("Ignoring status downgrade for succeeded charge:", chargeId);
      return new Response(
        JSON.stringify({ received: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the charge
    await adminClient
      .from("tap_charges")
      .update({
        status: verifiedStatus,
        webhook_verified: true,
        payment_method: verifiedCharge.source?.payment_method || null,
        card_brand: verifiedCharge.source?.payment_type || null,
        card_last_four: verifiedCharge.source?.payment?.last_four || null,
        tap_response: sanitizeTapResponse(verifiedCharge),
        error_message: verifiedStatus === "failed"
          ? verifiedCharge.response?.message || "Payment failed"
          : null,
      })
      .eq("id", existingCharge.id);

    // ── Handle successful payment: enroll user & increment coupon usage ──
    if (verifiedStatus === "succeeded" && existingCharge.course_id) {
      const { error: enrollError } = await adminClient
        .from("course_enrollments")
        .insert({
          user_id: existingCharge.user_id,
          course_id: existingCharge.course_id,
        });

      if (enrollError && !enrollError.message.includes("duplicate")) {
        console.error("Enrollment error:", enrollError.message);
      } else {
        console.log("User enrolled:", existingCharge.user_id, "in course:", existingCharge.course_id);
      }

      // Increment coupon usage if a coupon was applied
      const meta = existingCharge.metadata as Record<string, unknown> | null;
      const couponId = meta?.coupon_id as string | null;
      if (couponId) {
        const originalAmount = (meta?.original_amount as number) || verifiedCharge.amount || 0;
        const finalAmount = verifiedCharge.amount || 0;
        const discountAmount = originalAmount - finalAmount;
        
        const { data: couponResult } = await adminClient.rpc("increment_coupon_usage", {
          p_coupon_id: couponId,
          p_user_id: existingCharge.user_id,
          p_course_id: existingCharge.course_id,
          p_order_id: existingCharge.id,
          p_charge_id: chargeId,
          p_discount_amount: discountAmount,
          p_original_amount: originalAmount,
          p_final_amount: finalAmount,
        });
        console.log("Coupon usage incremented:", couponId, "result:", couponResult);
      }

      // Record revenue analytics
      await adminClient.from("revenue_analytics").insert({
        user_id: existingCharge.user_id,
        course_id: existingCharge.course_id,
        event_type: "payment",
        amount: verifiedCharge.amount || 0,
        currency: verifiedCharge.currency || "SAR",
        payment_id: existingCharge.id,
      });
    }

    return new Response(
      JSON.stringify({ received: true, status: verifiedStatus }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook processing error:", error.message);
    // Return 200 to prevent retries for processing errors
    return new Response(
      JSON.stringify({ received: true, error: "processing_error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function mapTapStatus(tapStatus: string): string {
  switch (tapStatus?.toUpperCase()) {
    case "CAPTURED":
      return "succeeded";
    case "AUTHORIZED":
      return "processing";
    case "INITIATED":
      return "processing";
    case "FAILED":
      return "failed";
    case "CANCELLED":
    case "ABANDONED":
      return "cancelled";
    case "DECLINED":
      return "failed";
    default:
      return "pending";
  }
}

function sanitizeTapResponse(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...data };
  if (sanitized.source && typeof sanitized.source === "object") {
    const source = { ...(sanitized.source as Record<string, unknown>) };
    delete source.token;
    sanitized.source = source;
  }
  delete sanitized.card;
  return sanitized;
}
