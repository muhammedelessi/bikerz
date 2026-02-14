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
    // ── Auth: verify JWT ──
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
      console.error("Auth error:", userError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = userData.user.id;
    const userEmail = userData.user.email || "";

    // ── Parse & validate request body ──
    const body = await req.json();
    const {
      course_id,
      amount,
      currency = "SAR",
      customer_name,
      customer_email,
      customer_phone,
      idempotency_key,
      coupon_id,
    } = body;

    if (!course_id || !amount || !idempotency_key) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: course_id, amount, idempotency_key" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0 || numericAmount > 100000) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allowedCurrencies = ["SAR", "KWD", "USD", "AED", "BHD", "QAR", "OMR", "EGP"];
    if (!allowedCurrencies.includes(currency)) {
      return new Response(
        JSON.stringify({ error: "Unsupported currency" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // ── Idempotency check ──
    const { data: existingCharge } = await adminClient
      .from("tap_charges")
      .select("id, charge_id, status")
      .eq("idempotency_key", idempotency_key)
      .maybeSingle();

    if (existingCharge) {
      return new Response(
        JSON.stringify({
          charge_id: existingCharge.charge_id,
          status: existingCharge.status,
          duplicate: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Verify course exists ──
    const { data: course, error: courseError } = await adminClient
      .from("courses")
      .select("id, price, currency, title")
      .eq("id", course_id)
      .single();

    if (courseError || !course) {
      return new Response(
        JSON.stringify({ error: "Course not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (numericAmount > Number(course.price)) {
      return new Response(
        JSON.stringify({ error: "Amount exceeds course price" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Insert pending charge record ──
    const { data: chargeRecord, error: insertError } = await adminClient
      .from("tap_charges")
      .insert({
        user_id: userId,
        course_id,
        amount: numericAmount,
        currency,
        status: "pending",
        customer_name: customer_name || "",
        customer_email: customer_email || userEmail,
        customer_phone: customer_phone || "",
        idempotency_key,
        metadata: {
          internal_order_id: idempotency_key,
          user_id: userId,
          coupon_id: coupon_id || null,
          original_amount: Number(course.price),
          environment: tapSecretKey.startsWith("sk_test") ? "test" : "live",
        },
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("DB insert error:", insertError.message);
      return new Response(
        JSON.stringify({ error: "Failed to create payment record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine redirect URL back to the app
    const origin = req.headers.get("origin") || "https://bikerz.lovable.app";
    const redirectBackUrl = `${origin}/courses/${course_id}?payment=callback&charge_id=${chargeRecord.id}`;

    // ── Create Tap charge via API using src_all (redirect-based) ──
    const chargePayload: Record<string, unknown> = {
      amount: numericAmount,
      currency,
      threeDSecure: true,
      save_card: false,
      description: `Course: ${course.title}`,
      statement_descriptor: "BIKERZ",
      reference: {
        transaction: idempotency_key,
        order: chargeRecord.id,
      },
      receipt: {
        email: true,
        sms: !!customer_phone,
      },
      customer: {
        first_name: customer_name?.split(" ")[0] || "Customer",
        last_name: customer_name?.split(" ").slice(1).join(" ") || "",
        email: customer_email || userEmail,
        phone: customer_phone
          ? { country_code: "966", number: customer_phone.replace(/^(\+?966|0)/, "") }
          : undefined,
      },
      metadata: {
        user_id: userId,
        course_id,
        internal_id: chargeRecord.id,
      },
      source: {
        id: "src_all",
      },
      redirect: {
        url: redirectBackUrl,
      },
    };

    console.log("Creating Tap charge for user:", userId, "amount:", numericAmount, currency);

    const tapResponse = await fetch("https://api.tap.company/v2/charges", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tapSecretKey}`,
        "Content-Type": "application/json",
        "x-idempotency-key": idempotency_key,
      },
      body: JSON.stringify(chargePayload),
    });

    const tapData = await tapResponse.json();

    if (!tapResponse.ok) {
      console.error("Tap API error:", JSON.stringify(tapData));

      await adminClient
        .from("tap_charges")
        .update({
          status: "failed",
          error_message: tapData?.errors?.[0]?.description || "Payment gateway error",
          tap_response: sanitizeTapResponse(tapData),
        })
        .eq("id", chargeRecord.id);

      return new Response(
        JSON.stringify({
          error: tapData?.errors?.[0]?.description || "Payment failed",
          code: tapData?.errors?.[0]?.code,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Update charge record ──
    const chargeStatus = mapTapStatus(tapData.status);
    await adminClient
      .from("tap_charges")
      .update({
        charge_id: tapData.id,
        status: chargeStatus,
        payment_method: tapData.source?.payment_method || "card",
        card_brand: tapData.source?.payment_type || null,
        card_last_four: tapData.source?.payment?.last_four || null,
        tap_response: sanitizeTapResponse(tapData),
      })
      .eq("id", chargeRecord.id);

    // If captured immediately (rare with src_all), enroll user
    if (chargeStatus === "succeeded") {
      await enrollUser(adminClient, userId, course_id);
    }

    // The redirect URL from Tap's response (hosted payment page)
    const tapRedirectUrl = tapData.transaction?.url || null;

    return new Response(
      JSON.stringify({
        charge_id: tapData.id,
        status: chargeStatus,
        redirect_url: tapRedirectUrl,
        amount: numericAmount,
        currency,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error.message);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
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

async function enrollUser(
  client: ReturnType<typeof createClient>,
  userId: string,
  courseId: string
) {
  const { error } = await client.from("course_enrollments").insert({
    user_id: userId,
    course_id: courseId,
  });

  if (error && !error.message.includes("duplicate")) {
    console.error("Enrollment error:", error.message);
  }
}
