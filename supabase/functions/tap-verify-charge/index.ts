import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { completeCourseBundleAfterPayment } from "../_shared/courseBundle.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VERIFY_TIMEOUT = 15000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── Pick the right Tap secret key for the calling origin ──
    // See tap-create-charge for the full reasoning. Same logic, kept inline
    // so this function stays self-contained.
    const env = (name: string): string | undefined => {
      const v = Deno.env.get(name);
      return v && v.trim() ? v.trim() : undefined;
    };
    const requestOrigin = req.headers.get("origin") || req.headers.get("referer") || "";
    let originHost = "";
    try { originHost = new URL(requestOrigin).hostname.toLowerCase(); } catch { /* ignore */ }
    const isPreviewHost =
      originHost === "localhost" ||
      originHost === "127.0.0.1" ||
      originHost.endsWith(".lovableproject.com") ||
      originHost.endsWith(".lovable.app") ||
      originHost.endsWith(".lovable.dev");

    // Build an ordered, deduped list of candidate Tap secret keys to try.
    // Charges may have been created with a different domain's key than the verifier
    // sees in `origin` (esp. after 3DS redirect or cross-domain flows). We try the
    // most-likely key first based on origin, then fall back to all configured keys.
    const preferred: (string | undefined)[] = [];
    if (originHost === "bikerz.com" || originHost.endsWith(".bikerz.com")) {
      preferred.push(
        isPreviewHost ? env("TAP_SK_TEST_BIKERZ") : env("TAP_SK_LIVE_BIKERZ"),
        env("TAP_SK_LIVE_BIKERZ"),
        env("TAP_SK_TEST_BIKERZ"),
      );
    } else if (originHost === "lovable.app" || originHost.endsWith(".lovable.app")) {
      preferred.push(env("TAP_SK_LIVE_LOVABLE_APP"), env("TAP_SK_TEST_LOVABLE_APP"));
    } else if (originHost === "lovableproject.com" || originHost.endsWith(".lovableproject.com")) {
      preferred.push(env("TAP_SK_TEST_LOVABLEPROJECT"), env("TAP_SK_LIVE_LOVABLEPROJECT"));
    }
    const candidateKeys = Array.from(new Set([
      ...preferred,
      env("TAP_SK_LIVE_BIKERZ"),
      env("TAP_SK_LIVE_LOVABLE_APP"),
      env("TAP_SK_LIVE_LOVABLEPROJECT"),
      env("TAP_SK_TEST_BIKERZ"),
      env("TAP_SK_TEST_LOVABLE_APP"),
      env("TAP_SK_TEST_LOVABLEPROJECT"),
      env("TAP_SECRET_KEY"),
      env("TAP_SECRET_TEST_KEY"),
    ].filter((v): v is string => typeof v === "string" && v.length > 0)));

    if (candidateKeys.length === 0) {
      return new Response(
        JSON.stringify({ error: "Payment service not configured for this domain" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to authenticate user (optional — redirect flow may lose session)
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: userData } = await userClient.auth.getUser();
        if (userData?.user) {
          userId = userData.user.id;
        }
      } catch {
        // Auth failed — continue without user context
        console.warn("Auth verification failed, proceeding without user context");
      }
    }

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

    if (!charge_id.startsWith("chg_")) {
      return new Response(
        JSON.stringify({ error: "Invalid charge ID format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Retrieve charge from Tap API (source of truth). Try each candidate key until 200.
    let tapResponse: Response | null = null;
    let lastStatus = 0;
    let lastErrText = "";
    for (let i = 0; i < candidateKeys.length; i += 1) {
      const key = candidateKeys[i];
      try {
        const r = await fetch(`https://api.tap.company/v2/charges/${charge_id}`, {
          headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
          signal: AbortSignal.timeout(VERIFY_TIMEOUT),
        });
        if (r.ok) {
          tapResponse = r;
          break;
        }
        lastStatus = r.status;
        lastErrText = await r.text().catch(() => "");
        // 429 from Tap means we should stop hammering immediately
        if (r.status === 429) break;
        // Brief pause between keys to stay under Tap's rate limit
        if (i < candidateKeys.length - 1) await new Promise((res) => setTimeout(res, 250));
      } catch (fetchErr: any) {
        console.error("Tap API timeout/network error during verify:", fetchErr.message);
        return new Response(
          JSON.stringify({ error: "Payment verification timed out. Please refresh to check status." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!tapResponse) {
      console.error("Tap verify API error after all keys:", lastStatus, lastErrText.substring(0, 200));
      const isTransient = lastStatus === 429 || (lastStatus >= 500 && lastStatus < 600);
      if (isTransient) {
        // Return 200 with a retryable signal so the client keeps polling
        // instead of throwing and breaking the verify loop / blank-screening.
        return new Response(
          JSON.stringify({
            status: "processing",
            retryable: true,
            transient: true,
            message: "Payment gateway busy. Still verifying…",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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

    // Use service role client for DB operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Find charge in DB — if user is authenticated, filter by user_id for extra security
    // If not authenticated (session lost after redirect), look up by charge_id only
    let dbQuery = adminClient
      .from("tap_charges")
      .select("id, user_id, course_id, status, metadata")
      .eq("charge_id", charge_id);

    if (userId) {
      dbQuery = dbQuery.eq("user_id", userId);
    }

    const { data: dbCharge } = await dbQuery.maybeSingle();

    if (!dbCharge) {
      // GoSell LightBox flow: charge created client-side, no pre-existing DB record.
      // Create one from the Tap API response metadata.
      const meta = (tapCharge.metadata || {}) as Record<string, any>;
      const chargeUserId = meta.user_id || userId;
      const chargeCourseId = meta.course_id || null;

      if (!chargeUserId) {
        console.warn("Cannot create DB record: no user_id in charge metadata or auth");
        return new Response(
          JSON.stringify({ status, charge_id, warning: "no_user_context" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: insertErr } = await adminClient.from("tap_charges").insert({
        user_id: chargeUserId,
        course_id: chargeCourseId,
        charge_id: charge_id,
        amount: tapCharge.amount || 0,
        currency: tapCharge.currency || "SAR",
        status,
        customer_name: [tapCharge.customer?.first_name, tapCharge.customer?.last_name].filter(Boolean).join(" ") || null,
        customer_email: tapCharge.customer?.email || null,
        customer_phone: tapCharge.customer?.phone?.number ? `+${tapCharge.customer.phone.country_code || "966"}${tapCharge.customer.phone.number}` : null,
        idempotency_key: tapCharge.reference?.transaction || `gosell_${charge_id}`,
        tap_response: sanitizeTapResponse(tapCharge),
        payment_method: tapCharge.source?.payment_method || "card",
        card_brand: tapCharge.source?.payment_type || null,
        card_last_four: tapCharge.source?.payment?.last_four || null,
        metadata: {
          ...meta,
          gosell_flow: true,
        },
      });

      if (insertErr) {
        console.error("Failed to create DB record for GoSell charge:", insertErr.message);
      }

      // Enroll on success
      if (status === "succeeded" && chargeCourseId) {
        const { error: enrollError } = await adminClient
          .from("course_enrollments")
          .insert({ user_id: chargeUserId, course_id: chargeCourseId });
        if (enrollError && !enrollError.message.includes("duplicate")) {
          console.error("Enrollment error:", enrollError.message);
        }

        await adminClient.from("revenue_analytics").insert({
          user_id: chargeUserId,
          course_id: chargeCourseId,
          event_type: "payment",
          amount: tapCharge.amount || 0,
          currency: tapCharge.currency || "SAR",
        });

        // Increment coupon if applicable
        const couponId = meta.coupon_id as string | null;
        if (couponId) {
          await adminClient.rpc("increment_coupon_usage", {
            p_coupon_id: couponId,
            p_user_id: chargeUserId,
            p_course_id: chargeCourseId,
            p_order_id: charge_id,
            p_charge_id: charge_id,
            p_discount_amount: 0,
            p_original_amount: tapCharge.amount || 0,
            p_final_amount: tapCharge.amount || 0,
          });
        }

        await recordSeriesUsage(adminClient, {
          metadata: meta,
          userId: chargeUserId,
          courseId: chargeCourseId,
          chargeId: charge_id,
          tapAmount: tapCharge.amount || 0,
        });
      }

      return new Response(
        JSON.stringify({ status, charge_id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use the DB record's user_id for enrollment (trustworthy — set at charge creation)
    const chargeUserId = dbCharge.user_id;

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

    const metaBundle = dbCharge.metadata as Record<string, unknown> | null;
    const isBundle = String(metaBundle?.payment_kind || "").toLowerCase() === "course_bundle";

    // Enroll on success
    if (status === "succeeded" && isBundle) {
      await completeCourseBundleAfterPayment(
        adminClient,
        chargeUserId,
        charge_id,
        metaBundle,
        tapCharge.amount || 0,
        tapCharge.currency || "SAR",
      );
    } else if (status === "succeeded" && dbCharge.course_id) {
      const { error: enrollError } = await adminClient
        .from("course_enrollments")
        .insert({ user_id: chargeUserId, course_id: dbCharge.course_id });
      if (enrollError && !enrollError.message.includes("duplicate")) {
        console.error("Enrollment error:", enrollError.message);
      }

      // Record revenue analytics
      const { error: revenueError } = await adminClient.from("revenue_analytics").insert({
        user_id: chargeUserId,
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
      const couponId = metaBundle?.coupon_id as string | null;
      if (couponId) {
        const originalAmount = (metaBundle?.original_amount as number) || tapCharge.amount || 0;
        const finalAmount = tapCharge.amount || 0;
        const discountAmount = originalAmount - finalAmount;

        await adminClient.rpc("increment_coupon_usage", {
          p_coupon_id: couponId,
          p_user_id: chargeUserId,
          p_course_id: dbCharge.course_id,
          p_order_id: dbCharge.id,
          p_charge_id: charge_id,
          p_discount_amount: discountAmount,
          p_original_amount: originalAmount,
          p_final_amount: finalAmount,
        });
      }

      await recordSeriesUsage(adminClient, {
        metadata: metaBundle,
        userId: chargeUserId,
        courseId: dbCharge.course_id,
        chargeId: charge_id,
        tapAmount: tapCharge.amount || 0,
      });
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

async function recordSeriesUsage(
  // deno-lint-ignore no-explicit-any
  adminClient: any,
  params: {
    metadata: Record<string, unknown> | null;
    userId: string;
    courseId: string | null;
    chargeId: string;
    tapAmount: number;
  },
) {
  const meta = params.metadata || {};
  const seriesId = typeof meta.coupon_series_id === "string" ? meta.coupon_series_id : "";
  const codeUsed = typeof meta.coupon_code === "string" ? meta.coupon_code.toUpperCase() : "";
  const codeNumber = Number(meta.coupon_number);

  if (!seriesId || !codeUsed || !Number.isFinite(codeNumber)) return;

  const originalAmount = Number(meta.original_amount ?? meta.original_price ?? params.tapAmount) || params.tapAmount;
  const finalAmount = Number(params.tapAmount) || 0;
  const discountAmount = Number(meta.coupon_discount ?? (originalAmount - finalAmount)) || 0;

  const { error } = await adminClient
    .from("coupon_series_usage")
    .insert({
      series_id: seriesId,
      code_used: codeUsed,
      code_number: codeNumber,
      user_id: params.userId,
      course_id: params.courseId,
      discount_amount: Math.max(discountAmount, 0),
      original_amount: Math.max(originalAmount, 0),
      final_amount: Math.max(finalAmount, 0),
      charge_id: params.chargeId,
    });

  if (error && !String(error.message || "").toLowerCase().includes("duplicate")) {
    console.error("Series usage insert error:", error.message);
  }
}
