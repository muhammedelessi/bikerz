import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAYMENT_TIMEOUT = 30000; // 30s timeout for Tap API

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

    if (tapSecretKey.startsWith("pk_")) {
      console.error("TAP_SECRET_KEY contains a publishable key instead of secret key");
      return new Response(
        JSON.stringify({ error: "Payment service misconfigured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user
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

    // ── Parse request body ──
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      course_id,
      currency = "SAR",
      customer_name,
      customer_email,
      customer_phone,
      idempotency_key,
      coupon_id,
    } = body as Record<string, any>;

    if (!course_id || !idempotency_key) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: course_id, idempotency_key" }),
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

    // ── PROFILE COMPLETENESS CHECK ──
    const { data: profileData, error: profileError } = await adminClient
      .from("profiles")
      .select("full_name, phone, city, country, profile_complete")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError || !profileData) {
      console.error("Profile check error:", profileError?.message);
      return new Response(
        JSON.stringify({ error: "User profile not found. Please complete your profile before payment." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const missingFields: string[] = [];
    if (!profileData.full_name || profileData.full_name.trim().length < 3) missingFields.push("full_name");
    if (!profileData.phone || profileData.phone.trim().length < 7) missingFields.push("phone");
    if (!profileData.city || profileData.city.trim().length === 0) missingFields.push("city");
    if (!profileData.country || profileData.country.trim().length === 0) missingFields.push("country");

    if (missingFields.length > 0) {
      console.warn("Incomplete profile for user:", userId, "missing:", missingFields);
      return new Response(
        JSON.stringify({
          error: "Profile incomplete. Please fill all required fields before payment.",
          missing_fields: missingFields,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Idempotency check ──
    const { data: existingCharge } = await adminClient
      .from("tap_charges")
      .select("id, charge_id, status")
      .eq("idempotency_key", idempotency_key)
      .maybeSingle();

    if (existingCharge) {
      if (existingCharge.status === "succeeded" || existingCharge.status === "processing") {
        return new Response(
          JSON.stringify({
            charge_id: existingCharge.charge_id,
            status: existingCharge.status,
            duplicate: true,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (existingCharge.status === "failed" || existingCharge.status === "cancelled") {
        await adminClient.from("tap_charges").delete().eq("id", existingCharge.id);
      } else {
        return new Response(
          JSON.stringify({
            charge_id: existingCharge.charge_id,
            status: existingCharge.status,
            duplicate: true,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── SERVER-AUTHORITATIVE PRICING ──
    // Fetch course and compute price from DB — never trust client amount
    const { data: course, error: courseError } = await adminClient
      .from("courses")
      .select("id, price, currency, title, discount_percentage")
      .eq("id", course_id)
      .single();

    if (courseError || !course) {
      return new Response(
        JSON.stringify({ error: "Course not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const originalPrice = Number(course.price);
    const courseDiscountPct = course.discount_percentage && Number(course.discount_percentage) > 0 ? Number(course.discount_percentage) : 0;
    let finalAmount = courseDiscountPct > 0
      ? Math.round(originalPrice * (1 - courseDiscountPct / 100) * 100) / 100
      : originalPrice;
    const priceAfterCourseDiscount = finalAmount;

    // Apply coupon discount if provided (server-side validation)
    let couponDiscount = 0;
    if (coupon_id) {
      const { data: coupon } = await adminClient
        .from("coupons")
        .select("id, type, value, status, is_deleted, start_date, expiry_date, used_count, max_usage, course_id, is_global, minimum_amount")
        .eq("id", coupon_id)
        .maybeSingle();

      if (coupon && coupon.status === "active" && !coupon.is_deleted
          && new Date() >= new Date(coupon.start_date)
          && new Date() <= new Date(coupon.expiry_date)
          && coupon.used_count < coupon.max_usage) {
        // Check course scope
        const scopeValid = coupon.is_global || !coupon.course_id || coupon.course_id === course_id;
        const minValid = !coupon.minimum_amount || finalAmount >= Number(coupon.minimum_amount);

        if (scopeValid && minValid) {
          if (coupon.type === "percentage_discount") {
            couponDiscount = Math.round(finalAmount * (Number(coupon.value) / 100) * 100) / 100;
          } else if (coupon.type === "fixed_amount_discount") {
            couponDiscount = Math.min(Number(coupon.value), finalAmount);
          } else if (coupon.type === "promotion") {
            couponDiscount = Number(coupon.value);
          }
          finalAmount = Math.max(finalAmount - couponDiscount, 0);
        }
      }
    }

    if (finalAmount <= 0) {
      return new Response(
        JSON.stringify({ error: "Final amount is zero. Use free enrollment instead." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      "Server-authoritative pricing:",
      `original=${originalPrice}`,
      `courseDiscount=${courseDiscountPct}%`,
      `afterCourseDiscount=${priceAfterCourseDiscount}`,
      `couponDiscount=${couponDiscount}`,
      `finalAmount=${finalAmount}`
    );

    // ── Check if already enrolled ──
    const { data: existingEnrollment } = await adminClient
      .from("course_enrollments")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", course_id)
      .maybeSingle();

    if (existingEnrollment) {
      return new Response(
        JSON.stringify({ error: "You are already enrolled in this course" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Insert pending charge record ──
    const { data: chargeRecord, error: insertError } = await adminClient
      .from("tap_charges")
      .insert({
        user_id: userId,
        course_id,
        amount: finalAmount,
        currency,
        status: "pending",
        customer_name: customer_name || profileData.full_name || "",
        customer_email: customer_email || userEmail,
        customer_phone: customer_phone || profileData.phone || "",
        idempotency_key,
        metadata: {
          internal_order_id: idempotency_key,
          user_id: userId,
          coupon_id: coupon_id || null,
          original_price: originalPrice,
          course_discount_pct: courseDiscountPct,
          price_after_course_discount: priceAfterCourseDiscount,
          coupon_discount: couponDiscount,
          final_amount: finalAmount,
          environment: tapSecretKey.startsWith("sk_test") ? "test" : "live",
          billing_city: profileData.city,
          billing_country: profileData.country,
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

    // Determine redirect URL
    const origin = req.headers.get("origin") || "https://bikerz.lovable.app";
    const redirectBackUrl = `${origin}/courses/${course_id}?payment=callback&charge_id=${chargeRecord.id}`;

    // ── Create Tap charge ──
    const chargePayload: Record<string, unknown> = {
      amount: finalAmount,
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
        first_name: (customer_name || profileData.full_name || "Customer").split(" ")[0],
        last_name: (customer_name || profileData.full_name || "").split(" ").slice(1).join(" ") || "",
        email: customer_email || userEmail,
        phone: (customer_phone || profileData.phone)
          ? { country_code: "966", number: (customer_phone || profileData.phone || "").replace(/^(\+?966|0)/, "") }
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

    console.log("Creating Tap charge for user:", userId, "amount:", finalAmount, currency);

    let tapData: Record<string, any>;
    let tapResponse: Response;

    try {
      tapResponse = await fetch("https://api.tap.company/v2/charges", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tapSecretKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-idempotency-key": idempotency_key,
        },
        body: JSON.stringify(chargePayload),
        signal: AbortSignal.timeout(PAYMENT_TIMEOUT),
      });
    } catch (fetchErr: any) {
      console.error("Tap API network error:", fetchErr.message);
      await adminClient
        .from("tap_charges")
        .update({ status: "failed", error_message: "Payment gateway timeout or network error" })
        .eq("id", chargeRecord.id);
      return new Response(
        JSON.stringify({ error: "Payment gateway is temporarily unavailable. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentType = tapResponse.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      const textResponse = await tapResponse.text();
      console.error("Tap returned non-JSON:", textResponse.substring(0, 200));
      await adminClient
        .from("tap_charges")
        .update({ status: "failed", error_message: "Gateway returned invalid response" })
        .eq("id", chargeRecord.id);
      return new Response(
        JSON.stringify({ error: "Payment gateway returned an invalid response. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      tapData = await tapResponse.json();
    } catch {
      console.error("Failed to parse Tap response as JSON");
      await adminClient
        .from("tap_charges")
        .update({ status: "failed", error_message: "Malformed gateway response" })
        .eq("id", chargeRecord.id);
      return new Response(
        JSON.stringify({ error: "Payment gateway returned a malformed response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    if (chargeStatus === "succeeded") {
      await enrollUser(adminClient, userId, course_id);
    }

    const tapRedirectUrl = tapData.transaction?.url || null;

    if (!tapRedirectUrl && chargeStatus !== "succeeded") {
      console.error("No redirect URL from Tap:", JSON.stringify(tapData));
      await adminClient
        .from("tap_charges")
        .update({ status: "failed", error_message: "No payment page URL received" })
        .eq("id", chargeRecord.id);
      return new Response(
        JSON.stringify({ error: "Payment gateway did not provide a payment page. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        charge_id: tapData.id,
        status: chargeStatus,
        redirect_url: tapRedirectUrl,
        amount: finalAmount,
        currency,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
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
