import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VERIFY_TIMEOUT = 15000; // 15s timeout

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const tapSecretKey = Deno.env.get("TAP_SECRET_KEY");

    if (!tapSecretKey) {
      return new Response(
        JSON.stringify({ error: "Payment service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user with getUser
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = userData.user.id;

    let body: Record<string, any>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { charge_id } = body;
    if (!charge_id || typeof charge_id !== "string") {
      return new Response(
        JSON.stringify({ error: "charge_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate charge_id format (Tap charge IDs start with chg_)
    if (!charge_id.startsWith("chg_")) {
      return new Response(
        JSON.stringify({ error: "Invalid charge ID format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Retrieve charge from Tap API (source of truth)
    let tapResponse: Response;
    try {
      tapResponse = await fetch(`https://api.tap.company/v2/charges/${charge_id}`, {
        headers: {
          Authorization: `Bearer ${tapSecretKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(VERIFY_TIMEOUT),
      });
    } catch (fetchErr: any) {
      console.error("Tap API timeout/network error during verify:", fetchErr.message);
      return new Response(
        JSON.stringify({ error: "Payment verification timed out. Please refresh to check status." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tapResponse.ok) {
      const errText = await tapResponse.text().catch(() => "");
      console.error("Tap verify API error:", tapResponse.status, errText.substring(0, 200));
      return new Response(
        JSON.stringify({ error: "Failed to verify charge" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let tapCharge: Record<string, any>;
    try {
      tapCharge = await tapResponse.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid response from payment gateway" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const status = mapTapStatus(tapCharge.status);

    // Update DB record
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: dbCharge } = await adminClient
      .from("tap_charges")
      .select("id, user_id, course_id, status, metadata")
      .eq("charge_id", charge_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!dbCharge) {
      console.warn("Charge not found in DB for user:", userId, "charge:", charge_id);
      return new Response(
        JSON.stringify({ status, charge_id, warning: "charge_not_found_for_user" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Don't downgrade succeeded status
    if (dbCharge.status === "succeeded") {
      return new Response(
        JSON.stringify({ status: "succeeded", charge_id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await adminClient
      .from("tap_charges")
      .update({
        status,
        tap_response: sanitizeTapResponse(tapCharge),
        payment_method: tapCharge.source?.payment_method || null,
        card_brand: tapCharge.source?.payment_type || null,
        card_last_four: tapCharge.source?.payment?.last_four || null,
      })
      .eq("id", dbCharge.id);

    // Enroll on success
    if (status === "succeeded" && dbCharge.course_id) {
      const { error: enrollError } = await adminClient
        .from("course_enrollments")
        .insert({ user_id: userId, course_id: dbCharge.course_id });
      if (enrollError && !enrollError.message.includes("duplicate")) {
        console.error("Enrollment error:", enrollError.message);
      }

      // Record revenue analytics (idempotent - unique index prevents duplicates)
      const { error: revenueError } = await adminClient.from("revenue_analytics").insert({
        user_id: userId,
        course_id: dbCharge.course_id,
        event_type: "payment",
        amount: tapCharge.amount || 0,
        currency: tapCharge.currency || "SAR",
        payment_id: dbCharge.id,
      });
      if (revenueError && !revenueError.message.includes("duplicate")) {
        console.error("Revenue analytics insert error:", revenueError.message);
      }

      // Increment coupon usage if a coupon was applied
      const meta = dbCharge.metadata as Record<string, unknown> | null;
      const couponId = meta?.coupon_id as string | null;
      if (couponId) {
        const originalAmount = (meta?.original_amount as number) || tapCharge.amount || 0;
        const finalAmount = tapCharge.amount || 0;
        const discountAmount = originalAmount - finalAmount;

        await adminClient.rpc("increment_coupon_usage", {
          p_coupon_id: couponId,
          p_user_id: userId,
          p_course_id: dbCharge.course_id,
          p_order_id: dbCharge.id,
          p_charge_id: charge_id,
          p_discount_amount: discountAmount,
          p_original_amount: originalAmount,
          p_final_amount: finalAmount,
        });
      }
    }

    return new Response(
      JSON.stringify({ status, charge_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Verify error:", error.message);
    return new Response(
      JSON.stringify({ error: "Verification failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function mapTapStatus(tapStatus: string): string {
  switch (tapStatus?.toUpperCase()) {
    case "CAPTURED": return "succeeded";
    case "AUTHORIZED": return "processing";
    case "INITIATED": return "processing";
    case "FAILED": return "failed";
    case "CANCELLED": case "ABANDONED": return "cancelled";
    case "DECLINED": return "failed";
    default: return "pending";
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