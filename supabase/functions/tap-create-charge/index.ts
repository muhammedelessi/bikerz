import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parsePhoneNumberFromString } from "https://esm.sh/libphonenumber-js@1.11.17/min";

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

    const b = body as Record<string, unknown>;
    const course_id = (b.course_id ?? b.courseId) as string | undefined;
    const rawCurrency = (b.currency as string | undefined) ?? "SAR";
    const requestedAmount = b.amount as unknown;
    const customer_name = b.customer_name;
    const customer_email = b.customer_email;
    const customer_phone = b.customer_phone;
    const idempotency_key = (b.idempotency_key ?? b.idempotencyKey) as string | undefined;
    const coupon_id = b.coupon_id;
    const payment_method = (b.payment_method as string | undefined) ?? "card";
    const detected_country = b.detected_country;
    const device_info = b.device_info;
    const token_id = b.token_id;
    const payment_kind_raw =
      b.payment_kind ?? b.paymentKind ?? b.booking_type ?? b.bookingType;
    const payment_kind = String(payment_kind_raw ?? "").trim().toLowerCase();
    // Short alias `tc`: some gateways strip long snake_case keys from JSON bodies
    const trainerCourseIdBody = (b.trainer_course_id ?? b.trainerCourseId ?? b.tc) as string | undefined;
    const trainerCourseIdTrim = String(trainerCourseIdBody ?? "").trim();
    const courseIdTrim = course_id != null ? String(course_id).trim() : "";
    const training_id_body = (b.training_id ?? b.trainingId) as string | undefined;
    const trainingIdBodyTrim = String(training_id_body ?? "").trim();
    /** Client sends the same UUID as `course_id` and `training_id` for trainer bookings (program id). */
    const trainingProgramIdPair =
      trainingIdBodyTrim.length > 0 && courseIdTrim.length > 0 && courseIdTrim === trainingIdBodyTrim;

    if (!idempotency_key || !String(idempotency_key).trim()) {
      return new Response(
        JSON.stringify({ error: "Missing required field: idempotency_key" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hasCourse = courseIdTrim.length > 0;
    const hasTrainerCourse = trainerCourseIdTrim.length > 0;
    const paymentKindIsTraining = payment_kind === "training_booking";
    // Trainer session: trainer row id, explicit kind, or program id sent as both course_id + training_id.
    const isTrainingBooking =
      hasTrainerCourse || paymentKindIsTraining || trainingProgramIdPair;

    if (isTrainingBooking && !hasTrainerCourse) {
      return new Response(
        JSON.stringify({ error: "Missing trainer_course_id for training booking" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // When `trainer_course_id` (or `tc`) is present, always use the trainer/practical path — even if a
    // proxy or client default sent `payment_kind: "course"` (that mismatch used to block real bookings).

    if (!isTrainingBooking && !hasCourse) {
      return new Response(
        JSON.stringify({
          error:
            "Missing course_id for course payment. For training bookings, send payment_kind \"training_booking\" and trainer_course_id (omit course_id).",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Tap supports these currencies natively
    const TAP_SUPPORTED = ["SAR", "KWD", "AED", "USD", "BHD", "QAR", "OMR", "EGP", "GBP", "EUR"];
    const requestedCurrency = String(rawCurrency || "SAR").trim().toUpperCase();
    // If the client sends a Tap-supported currency, charge in that currency; otherwise fall back to SAR
    const chargeCurrency = TAP_SUPPORTED.includes(requestedCurrency) ? requestedCurrency : "SAR";

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // ── PROFILE COMPLETENESS CHECK ──
    const { data: profileData, error: profileError } = await adminClient
      .from("profiles")
      .select("full_name, phone, city, country, profile_complete, bike_brand, bike_model, engine_size_cc, riding_experience_years")
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

    // ── SERVER-AUTHORITATIVE PRICING (always in SAR) ──
    type CourseLike = {
      id: string;
      price: number;
      currency: string | null;
      title: string;
      discount_percentage: number | null;
    };

    let course: CourseLike;
    let basePriceSar: number;
    let localizedDisplayPrice: number | null = null;
    let localizedDisplayCurrency: string | null = null;
    /** null when charging for a training booking (not a video course from `courses`) */
    let dbCourseId: string | null = isTrainingBooking ? null : courseIdTrim;
    /** `trainings.id` for trainer bookings; persisted on tap_charges.training_id */
    let dbTrainingId: string | null = null;

    if (isTrainingBooking) {
      const { data: tc, error: tcErr } = await adminClient
        .from("trainer_courses")
        .select("id, price, duration_hours, training_id, trainer_id, trainings(name_en, name_ar)")
        .eq("id", trainerCourseIdTrim)
        .single();

      if (tcErr || !tc) {
        return new Response(
          JSON.stringify({ error: "Trainer course not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tr = tc as Record<string, unknown>;
      const resolvedTrainingId = String(tr.training_id ?? "").trim();
      if (!resolvedTrainingId) {
        return new Response(
          JSON.stringify({ error: "Trainer course is missing training program id" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      dbTrainingId = resolvedTrainingId;

      if (courseIdTrim && courseIdTrim !== resolvedTrainingId) {
        return new Response(
          JSON.stringify({
            error:
              "course_id must be the practical training id (trainings.id) for this booking, matching the selected trainer offer.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (trainingIdBodyTrim && trainingIdBodyTrim !== resolvedTrainingId) {
        return new Response(
          JSON.stringify({
            error: "training_id does not match the training program for this trainer offer.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const trainings = tr.trainings as { name_en?: string; name_ar?: string } | null;
      const title = trainings?.name_en || trainings?.name_ar || "Training session";

      course = {
        id: String(tr.id),
        price: Number(tr.price),
        currency: "SAR",
        title,
        discount_percentage: 0,
      };
      basePriceSar = Number(tr.price);
    } else {
      const { data: c, error: courseError } = await adminClient
        .from("courses")
        .select("id, price, currency, title, discount_percentage")
        .eq("id", courseIdTrim)
        .single();

      if (courseError || !c) {
        const { data: trainingProbe } = await adminClient
          .from("trainings")
          .select("id")
          .eq("id", courseIdTrim)
          .maybeSingle();
        if (trainingProbe) {
          return new Response(
            JSON.stringify({
              error:
                "This payment id is a practical training program, not a video course. Open the training booking page again, or include trainer_course_id (or tc) and payment_kind \"training_booking\" in the charge request.",
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: "Course not found" }),
          // 400 (not 404): avoids confusion with "Edge Function URL not found" in the browser Network tab.
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      course = c as CourseLike;
      basePriceSar = Number(course.price);

      if (detected_country) {
        const { data: countryPrice } = await adminClient
          .from("course_country_prices")
          .select("price, currency")
          .eq("course_id", courseIdTrim)
          .eq("country_code", detected_country)
          .maybeSingle();

        if (countryPrice) {
          localizedDisplayPrice = Number(countryPrice.price);
          localizedDisplayCurrency = countryPrice.currency || requestedCurrency;
          console.log(`Localized display pricing: ${detected_country} → ${localizedDisplayPrice} ${localizedDisplayCurrency} (charging in SAR)`);
        }
      }
    }

    const courseDiscountPct =
      !isTrainingBooking && course.discount_percentage && Number(course.discount_percentage) > 0
        ? Number(course.discount_percentage)
        : 0;
    let fallbackPriceBeforeTax = courseDiscountPct > 0
      ? Math.ceil(basePriceSar * (1 - courseDiscountPct / 100))
      : basePriceSar;
    const priceAfterCourseDiscount = fallbackPriceBeforeTax;

    // Apply coupon discount on the fallback server-side amount (for validation/minimum checks)
    let couponDiscount = 0;
    if (!isTrainingBooking && coupon_id) {
      const { data: coupon } = await adminClient
        .from("coupons")
        .select("id, type, value, status, is_deleted, start_date, expiry_date, used_count, max_usage, course_id, is_global, minimum_amount")
        .eq("id", coupon_id)
        .maybeSingle();

      if (coupon && coupon.status === "active" && !coupon.is_deleted
          && new Date() >= new Date(coupon.start_date)
          && new Date() <= new Date(coupon.expiry_date)
          && coupon.used_count < coupon.max_usage) {
        const scopeValid = coupon.is_global || !coupon.course_id || coupon.course_id === courseIdTrim;
        const minValid = !coupon.minimum_amount || fallbackPriceBeforeTax >= Number(coupon.minimum_amount);

        if (scopeValid && minValid) {
          if (coupon.type === "percentage_discount") {
            couponDiscount = Math.round(fallbackPriceBeforeTax * (Number(coupon.value) / 100) * 100) / 100;
          } else if (coupon.type === "fixed_amount_discount") {
            couponDiscount = Math.min(Number(coupon.value), fallbackPriceBeforeTax);
          } else if (coupon.type === "promotion") {
            couponDiscount = Number(coupon.value);
          }
          fallbackPriceBeforeTax = Math.max(fallbackPriceBeforeTax - couponDiscount, 0);
        }
      }
    }

    const clientRequestedAmount = Number(requestedAmount);
    const hasClientAmount = Number.isFinite(clientRequestedAmount) && clientRequestedAmount > 0;
    const finalAmount = hasClientAmount ? Math.ceil(clientRequestedAmount) : Math.ceil(fallbackPriceBeforeTax * 1.15);
    const priceBeforeTax = Math.max(0, Math.round((finalAmount / 1.15) * 100) / 100);

    if (finalAmount <= 0) {
      return new Response(
        JSON.stringify({ error: "Final amount is zero. Use free enrollment instead." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vatRate = 0.15;

    const phoneForTap = resolveTapPhone(customer_phone, profileData.phone, profileData.country);
    const storedPhoneForCheck = String(customer_phone || profileData.phone || "").trim();
    if (storedPhoneForCheck && !phoneForTap) {
      return new Response(
        JSON.stringify({
          error:
            "Invalid phone number. Please use a valid number with country code (for example +966501234567 or +970599123456).",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(
      "Server-authoritative SAR pricing:",
      `basePriceSar=${basePriceSar}`,
      `requestedCurrency=${requestedCurrency}`,
      `chargeCurrency=${chargeCurrency}`,
      `courseDiscount=${courseDiscountPct}%`,
      `afterCourseDiscount=${priceAfterCourseDiscount}`,
      `couponDiscount=${couponDiscount}`,
      `clientRequestedAmount=${hasClientAmount ? clientRequestedAmount : 'none'}`,
      `priceBeforeTax=${priceBeforeTax}`,
      `vatRate=${vatRate * 100}%`,
      `finalAmountSar=${finalAmount}`
    );

    // ── Check if already enrolled (video courses only) ──
    if (!isTrainingBooking) {
      const { data: existingEnrollment } = await adminClient
        .from("course_enrollments")
        .select("id")
        .eq("user_id", userId)
        .eq("course_id", courseIdTrim)
        .maybeSingle();

      if (existingEnrollment) {
        return new Response(
          JSON.stringify({ error: "You are already enrolled in this course" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Insert pending charge record ──
    // Sanitize device_info: plain string, max 200 chars
    const safeDeviceInfo = typeof device_info === "string" ? device_info.substring(0, 200) : null;

    const { data: chargeRecord, error: insertError } = await adminClient
      .from("tap_charges")
      .insert({
        user_id: userId,
        course_id: dbCourseId,
        training_id: dbTrainingId,
        amount: finalAmount,
        currency: chargeCurrency,
        status: "pending",
        customer_name: customer_name || profileData.full_name || "",
        customer_email: customer_email || userEmail,
        customer_phone: customer_phone || profileData.phone || "",
        idempotency_key,
        device_info: safeDeviceInfo,
        metadata: {
          internal_order_id: idempotency_key,
          user_id: userId,
          payment_kind: isTrainingBooking ? "training_booking" : "course",
          training_id: isTrainingBooking ? dbTrainingId : null,
          trainer_course_id: isTrainingBooking ? trainerCourseIdTrim : null,
          coupon_id: coupon_id || null,
          original_price: basePriceSar,
          course_discount_pct: courseDiscountPct,
          price_after_course_discount: priceAfterCourseDiscount,
          coupon_discount: couponDiscount,
          price_before_tax: priceBeforeTax,
          vat_rate: vatRate * 100,
          final_amount: finalAmount,
          requested_currency: requestedCurrency,
          charge_currency: chargeCurrency,
          localized_display_price: localizedDisplayPrice,
          localized_display_currency: localizedDisplayCurrency,
          detected_country: detected_country || null,
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

    // Determine redirect URL — use request origin if it's a known Lovable domain
    // (allows testing from preview), otherwise default to published domain
    const requestOrigin = req.headers.get("origin") || "";
    const isKnownOrigin =
      requestOrigin === "https://academy.bikerz.com" ||
      requestOrigin === "https://bikerz.lovable.app" ||
      requestOrigin.endsWith(".lovable.app") ||
      requestOrigin.endsWith(".lovableproject.com");
    const origin = isKnownOrigin ? requestOrigin : "https://academy.bikerz.com";
    // Always redirect to the static 3DS callback page — it sends postMessage
    // back to the parent/opener window for seamless popup flow.
    // Tap appends ?tap_id=chg_xxx automatically to the redirect URL.
    const redirectBackUrl = isTrainingBooking
      ? `${origin}/tap-3ds-callback.html?booking=1&tc=${encodeURIComponent(trainerCourseIdTrim)}`
      : `${origin}/tap-3ds-callback.html?course=${encodeURIComponent(courseIdTrim)}`;

    // ── Create Tap charge (always in SAR) ──
    const chargePayload: Record<string, unknown> = {
      amount: finalAmount,
      currency: chargeCurrency,
      threeDSecure: true,
      save_card: false,
      description: isTrainingBooking ? `Training: ${course.title}` : `Course: ${course.title}`,
      statement_descriptor: "BIKERZ",
      reference: {
        transaction: idempotency_key,
        order: chargeRecord.id,
      },
      receipt: {
        email: true,
        sms: !!phoneForTap,
      },
      customer: {
        first_name: (customer_name || profileData.full_name || "Customer").split(" ")[0],
        last_name: (customer_name || profileData.full_name || "").split(" ").slice(1).join(" ") || "",
        email: customer_email || userEmail,
        phone: phoneForTap,
      },
      metadata: {
        user_id: userId,
        course_id: dbCourseId,
        training_id: isTrainingBooking ? dbTrainingId : null,
        trainer_course_id: isTrainingBooking ? trainerCourseIdTrim : null,
        internal_id: chargeRecord.id,
        requested_currency: requestedCurrency,
      },
      source: {
        id: token_id || "src_all",
      },
      redirect: {
        url: redirectBackUrl,
      },
    };

    console.log("Creating Tap charge for user:", userId, "amount:", finalAmount, chargeCurrency, "(requested:", requestedCurrency + ")");

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

    if (chargeStatus === "succeeded" && !isTrainingBooking) {
      await enrollUser(adminClient, userId, courseIdTrim);
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
        currency: chargeCurrency,
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

/** Tap expects `country_code` + national `number` (no leading 0). Uses profile country as default region when ISO-2. */
function resolveTapPhone(
  customerPhone: unknown,
  profilePhone: unknown,
  profileCountry: unknown,
): { country_code: string; number: string } | undefined {
  const raw = String(customerPhone || profilePhone || "").trim();
  if (!raw) return undefined;

  const countryStr = String(profileCountry || "").trim();
  const defaultRegion = /^[A-Z]{2}$/i.test(countryStr) ? countryStr.toUpperCase() : "SA";

  const attempts: Array<{ input: string; region?: string }> = [
    { input: raw, region: defaultRegion },
    { input: raw, region: "SA" },
  ];

  const digits = raw.replace(/\D/g, "");
  if (!raw.trim().startsWith("+") && digits.length >= 10) {
    attempts.push({ input: `+${digits}` });
  }
  if (!raw.includes("+") && digits.length === 10 && digits.startsWith("05")) {
    attempts.push({ input: `+966${digits.slice(1)}` });
  }
  if (!raw.includes("+") && digits.length === 9 && digits.startsWith("5")) {
    attempts.push({ input: `+966${digits}` });
  }

  for (const { input, region } of attempts) {
    const p = region
      ? parsePhoneNumberFromString(input, region as never)
      : parsePhoneNumberFromString(input);
    if (p?.isValid()) {
      return { country_code: String(p.countryCallingCode), number: String(p.nationalNumber) };
    }
  }

  return undefined;
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
