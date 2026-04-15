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

    const normalizedCode = code.trim().toUpperCase();
    const { data: existingCoupon } = await adminClient
      .from("coupons")
      .select("id")
      .eq("is_deleted", false)
      .ilike("code", normalizedCode)
      .limit(1)
      .maybeSingle();

    if (existingCoupon?.id) {
      // Existing fixed coupon flow (unchanged behavior)
      const { data: result, error: fnError } = await adminClient.rpc(
        "validate_and_apply_coupon",
        {
          p_code: normalizedCode,
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

      return res(200, {
        valid: true,
        coupon_id: validation.coupon_id,
        discount_type: validation.discount_type,
        discount_value: validation.discount_value,
        discount_amount: validation.discount_amount,
        final_amount: validation.final_amount,
      });
    }

    // Dynamic coupon series fallback
    const parsed = parseSeriesCode(normalizedCode);
    if (!parsed) {
      return res(400, { valid: false, error: "Invalid coupon code" });
    }

    const { data: rawSeries, error: seriesErr } = await adminClient
      .from("coupon_series")
      .select("*")
      .ilike("prefix", parsed.prefix)
      .lte("range_from", parsed.number)
      .gte("range_to", parsed.number)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (seriesErr) {
      console.error("Series lookup error:", seriesErr.message);
      return res(500, { error: "Validation failed" });
    }

    const nowIso = new Date().toISOString();
    const series = (rawSeries || []).find((s: any) => {
      const notExpired = !s.expiry_date || String(s.expiry_date) > nowIso;
      const scopeValid = Boolean(s.is_global) || !s.course_id || s.course_id === (course_id || null);
      return notExpired && scopeValid;
    });

    if (!series) {
      return res(400, { valid: false, error: "Coupon not found" });
    }

    const { count: usageCount, error: usageCountErr } = await adminClient
      .from("coupon_series_usage")
      .select("id", { count: "exact", head: true })
      .eq("series_id", series.id)
      .eq("code_number", parsed.number);
    if (usageCountErr) {
      console.error("Series usage count error:", usageCountErr.message);
      return res(500, { error: "Validation failed" });
    }
    if ((usageCount || 0) >= Number(series.max_uses_per_code || 1)) {
      return res(400, { valid: false, error: "Code already used" });
    }

    const { data: alreadyUsedByUser, error: usedByUserErr } = await adminClient
      .from("coupon_series_usage")
      .select("id")
      .eq("series_id", series.id)
      .eq("code_number", parsed.number)
      .eq("user_id", userId)
      .maybeSingle();
    if (usedByUserErr && usedByUserErr.code !== "PGRST116") {
      console.error("Series user usage check error:", usedByUserErr.message);
      return res(500, { error: "Validation failed" });
    }
    if (alreadyUsedByUser?.id) {
      return res(400, { valid: false, error: "Already used by you" });
    }

    const originalAmount = Number(amount);
    const discount = computeSeriesDiscount(
      Number(series.discount_value || 0),
      String(series.discount_type || "percentage"),
      originalAmount,
    );
    const finalAmount = Math.max(originalAmount - discount, 0);

    return res(200, {
      valid: true,
      coupon_id: null,
      discount_type: series.discount_type === "fixed" ? "fixed_amount_discount" : "percentage_discount",
      discount_value: Number(series.discount_value || 0),
      discount_amount: discount,
      final_amount: finalAmount,
      coupon_series_id: series.id,
      coupon_number: parsed.number,
      coupon_code: normalizedCode,
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

function parseSeriesCode(code: string): { prefix: string; number: number } | null {
  const match = code.match(/^([^\d]+)(\d+)$/);
  if (!match) return null;
  const number = Number.parseInt(match[2], 10);
  if (!Number.isFinite(number)) return null;
  return {
    prefix: match[1].toUpperCase(),
    number,
  };
}

function computeSeriesDiscount(
  value: number,
  type: string,
  originalAmount: number,
): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (type === "fixed") {
    return Math.min(value, originalAmount);
  }
  // Default to percentage
  const pct = Math.min(Math.max(value, 0), 100);
  return Math.round(originalAmount * (pct / 100) * 100) / 100;
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
