import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_ATTEMPTS_PER_WINDOW = 10;
const WINDOW_SECONDS = 300; // 5 minutes

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return res(401, { error: "Unauthorized" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return res(401, { error: "Unauthorized" });
    }

    const userId = userData.user.id;
    const body = await req.json();
    const { code, course_id, amount } = body;

    if (!code || typeof code !== "string") {
      return res(400, { error: "Missing coupon code" });
    }

    if (!amount || Number(amount) <= 0) {
      return res(400, { error: "Invalid amount" });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limiting
    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_SECONDS * 1000);

    const { data: rateLimit } = await adminClient
      .from("coupon_rate_limits")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (rateLimit) {
      const lastWindow = new Date(rateLimit.window_start);
      if (lastWindow > windowStart) {
        // Within current window
        if (rateLimit.attempt_count >= MAX_ATTEMPTS_PER_WINDOW) {
          // Log failed attempt
          await logAttempt(adminClient, null, userId, course_id, "failed", "Rate limit exceeded");
          return res(429, { error: "Too many attempts. Please wait a few minutes." });
        }
        await adminClient
          .from("coupon_rate_limits")
          .update({
            attempt_count: rateLimit.attempt_count + 1,
            last_attempt_at: now.toISOString(),
          })
          .eq("user_id", userId);
      } else {
        // Reset window
        await adminClient
          .from("coupon_rate_limits")
          .update({
            attempt_count: 1,
            window_start: now.toISOString(),
            last_attempt_at: now.toISOString(),
          })
          .eq("user_id", userId);
      }
    } else {
      await adminClient.from("coupon_rate_limits").insert({
        user_id: userId,
        attempt_count: 1,
        window_start: now.toISOString(),
        last_attempt_at: now.toISOString(),
      });
    }

    // Validate coupon via DB function (atomic, handles locking)
    const { data: result, error: fnError } = await adminClient.rpc(
      "validate_and_apply_coupon",
      {
        p_code: code.trim(),
        p_user_id: userId,
        p_course_id: course_id || null,
        p_original_amount: Number(amount),
      }
    );

    if (fnError) {
      console.error("Validation function error:", fnError.message);
      return res(500, { error: "Validation failed" });
    }

    const validation = result?.[0];
    if (!validation) {
      return res(500, { error: "No validation result" });
    }

    if (!validation.valid) {
      // Log failed attempt
      await logAttempt(
        adminClient,
        validation.coupon_id,
        userId,
        course_id,
        "failed",
        validation.error_message
      );

      return res(400, {
        valid: false,
        error: validation.error_message,
      });
    }

    // Success - return discount info (do NOT increment usage yet)
    return res(200, {
      valid: true,
      coupon_id: validation.coupon_id,
      discount_type: validation.discount_type,
      discount_value: validation.discount_value,
      discount_amount: validation.discount_amount,
      final_amount: validation.final_amount,
    });
  } catch (error) {
    console.error("Unexpected error:", error.message);
    return res(500, { error: "An unexpected error occurred" });
  }
});

function res(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logAttempt(
  // deno-lint-ignore no-explicit-any
  client: any,
  couponId: string | null,
  userId: string,
  courseId: string | null,
  result: string,
  reason: string | null
) {
  try {
    if (couponId) {
      await client.from("coupon_usage_logs").insert({
        coupon_id: couponId,
        user_id: userId,
        course_id: courseId || null,
        result,
        failure_reason: reason,
        original_amount: 0,
        final_amount: 0,
        discount_amount: 0,
      });
    }
  } catch (e) {
    console.error("Failed to log attempt:", e);
  }
}
