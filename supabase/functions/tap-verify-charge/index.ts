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
    const tapSecretKey = Deno.env.get("TAP_SECRET_KEY")!;

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

    const { charge_id } = await req.json();
    if (!charge_id) {
      return new Response(
        JSON.stringify({ error: "charge_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Retrieve charge from Tap API (source of truth)
    const tapResponse = await fetch(`https://api.tap.company/v2/charges/${charge_id}`, {
      headers: { Authorization: `Bearer ${tapSecretKey}` },
    });

    if (!tapResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to verify charge" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tapCharge = await tapResponse.json();
    const status = mapTapStatus(tapCharge.status);

    // Update DB record
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: dbCharge } = await adminClient
      .from("tap_charges")
      .select("id, user_id, course_id, metadata")
      .eq("charge_id", charge_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (dbCharge) {
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
    }

    return new Response(
      JSON.stringify({ status, charge_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
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
