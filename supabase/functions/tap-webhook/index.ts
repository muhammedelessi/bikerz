import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { completeCourseBundleAfterPayment } from "../_shared/courseBundle.ts";

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

    // ── Upsert course status and send GHL webhook on every status change ──
    await upsertAndSendGHLWebhook(adminClient, existingCharge, verifiedCharge, verifiedStatus);

    const metaWh = existingCharge.metadata as Record<string, unknown> | null;
    const isBundle = String(metaWh?.payment_kind || "").toLowerCase() === "course_bundle";

    // ── Handle successful payment: enroll user & increment coupon usage ──
    if (verifiedStatus === "succeeded" && isBundle) {
      await completeCourseBundleAfterPayment(
        adminClient,
        existingCharge.user_id,
        chargeId,
        metaWh,
        verifiedCharge.amount || 0,
        verifiedCharge.currency || "SAR",
      );
    } else if (verifiedStatus === "succeeded" && existingCharge.course_id) {
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

      // Record revenue analytics (idempotent - unique index prevents duplicates)
      const { error: revenueError } = await adminClient.from("revenue_analytics").insert({
        user_id: existingCharge.user_id,
        course_id: existingCharge.course_id,
        event_type: "payment",
        amount: verifiedCharge.amount || 0,
        currency: verifiedCharge.currency || "SAR",
        payment_id: existingCharge.id,
      });
      if (revenueError && !revenueError.message.includes("duplicate")) {
        console.error("Revenue analytics insert error:", revenueError.message);
      }
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

const GHL_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/ddAvdgekc94cWL9NBHK1/webhook-trigger/9a3cf7c3-0405-4667-ad02-e9c89073feb4';

function mapToGHLOrderStatus(status: string): string {
  switch (status) {
    case "succeeded":
      return "purchased";
    case "processing":
      return "pending";
    case "failed":
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}

async function upsertAndSendGHLWebhook(
  // deno-lint-ignore no-explicit-any
  adminClient: any,
  charge: { user_id: string; course_id: string | null; amount: number; metadata: unknown },
  verifiedCharge: Record<string, unknown>,
  status: string
) {
  try {
    // Fetch user profile for contact details
    const { data: profile } = await adminClient
      .from("profiles")
      .select("full_name, phone, city, country, postal_code")
      .eq("user_id", charge.user_id)
      .maybeSingle();

    // Fetch user email from auth
    const { data: authUser } = await adminClient.auth.admin.getUserById(charge.user_id);

    // Fetch course name
    let courseName = "";
    if (charge.course_id) {
      const { data: course } = await adminClient
        .from("courses")
        .select("title")
        .eq("id", charge.course_id)
        .maybeSingle();
      courseName = course?.title ?? "";
    }

    const ghlOrderStatus = mapToGHLOrderStatus(status);

    // Upsert course status and get full courses array
    let coursesJson = "[]";
    let totalPurchased = 0;
    if (charge.course_id) {
      const { data: upsertResult } = await adminClient.rpc("upsert_course_status", {
        p_user_id: charge.user_id,
        p_course_id: charge.course_id,
        p_course_name: courseName,
        p_order_status: ghlOrderStatus,
      } as any);
      const row = Array.isArray(upsertResult) ? upsertResult[0] : upsertResult;
      coursesJson = (row as any)?.courses_json || "[]";
      totalPurchased = (row as any)?.total_purchased ?? 0;
    }

    const address = [profile?.city, profile?.country, profile?.postal_code].filter(Boolean).join(", ");

    const payload = {
      email: authUser?.user?.email || (verifiedCharge?.receipt as Record<string, unknown>)?.email || "",
      phone: profile?.phone || "",
      full_name: profile?.full_name || "",
      city: profile?.city || "",
      country: profile?.country || "",
      address,
      courseName,
      amount: String(verifiedCharge?.amount || charge.amount || ""),
      source: "direct",
      orderStatus: ghlOrderStatus,
      courses: coursesJson,
      totalPurchased,
    };

    console.log("Sending GHL webhook for status:", status, "payload:", JSON.stringify(payload));

    const res = await fetch(GHL_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.log("GHL webhook response:", res.status);
  } catch (err) {
    // Non-blocking: don't fail the webhook processing if GHL fails
    console.error("GHL webhook send failed:", err);
  }
}
