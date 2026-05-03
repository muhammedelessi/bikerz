// Honda Owners — AI verification of the uploaded motorcycle registration
// document.
//
// Flow:
//   1. Authenticated user POSTs { application_id }.
//   2. We load the application + the uploaded file (via signed URL on the
//      private bucket) and the form fields.
//   3. If ai_attempts >= 3, we DON'T call OpenAI — we flip the status to
//      `needs_manual_review` and return; the 4th attempt is reserved for
//      the admin (per the product spec the user gave).
//   4. Otherwise we call gpt-4o-mini Vision with the document image plus
//      the form fields, and ask for a structured JSON decision.
//   5. Auto-approve only when ALL of these are true:
//        - is_motorcycle_registration_doc
//        - is_honda
//        - name_matches
//        - model_matches
//        - year_matches
//        - confidence >= 0.85
//      Otherwise → `needs_manual_review`.
//   6. The DB trigger `honda_on_approval` enforces the 500-cap and does
//      auto-enrollment + bell notification — we don't duplicate that
//      logic here.
//
// Why a single SECURITY DEFINER edge function instead of an RPC:
//   - We need to hit OpenAI from the server side (the API key must not
//     leave the server).
//   - Signed URLs require the service role to mint, since we deliberately
//     gate the bucket so the user can't read their own document from the
//     browser without an explicit signing step.
//
// Configured secrets:
//   OPENAI_API_KEY    — used to call gpt-4o-mini.
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY — standard.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_AI_ATTEMPTS = 3;
const APPROVAL_CONFIDENCE_THRESHOLD = 0.85;

type AIDecision = {
  is_motorcycle_registration_doc: boolean;
  is_honda: boolean;
  name_matches: boolean;
  model_matches: boolean;
  year_matches: boolean;
  confidence: number;
  reason_en: string;
  reason_ar: string;
  detected_brand?: string;
  detected_owner_name?: string;
  detected_model?: string;
  detected_year?: number;
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  if (!openaiKey) {
    console.error("[honda-verify] missing OPENAI_API_KEY");
    return jsonResponse(500, { error: "AI verification not configured" });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return jsonResponse(401, { error: "Unauthorized" });
  }
  const userId = userData.user.id;

  let body: { application_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }
  const applicationId = body.application_id;
  if (!applicationId || typeof applicationId !== "string") {
    return jsonResponse(400, { error: "application_id required" });
  }

  // Service role for both the cross-row reads (signed URL minting +
  // updating the application as the service) and to bypass RLS in the
  // narrow places where the user technically has access but we want a
  // single consistent view.
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  const { data: application, error: appError } = await adminClient
    .from("honda_applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();

  if (appError || !application) {
    return jsonResponse(404, { error: "Application not found" });
  }
  if (application.user_id !== userId) {
    // Prevent users from triggering AI on someone else's application.
    return jsonResponse(403, { error: "Not your application" });
  }
  if (application.status === "approved" || application.status === "rejected") {
    return jsonResponse(409, {
      error: "Application is already finalised",
      status: application.status,
    });
  }

  // 4th attempt → straight to manual review without burning AI tokens.
  // The condition is `>=` because ai_attempts is incremented AFTER each
  // AI call below, so on entry it reflects the count BEFORE this call.
  if ((application.ai_attempts ?? 0) >= MAX_AI_ATTEMPTS) {
    const { error: updErr } = await adminClient
      .from("honda_applications")
      .update({
        status: "needs_manual_review",
        ai_decision: "rejected",
        ai_decision_reason:
          "AI auto-verification exhausted (3 attempts) — admin review required.",
      })
      .eq("id", applicationId);
    if (updErr) console.error("[honda-verify] update failed:", updErr);
    return jsonResponse(200, {
      status: "needs_manual_review",
      reason:
        "Max AI attempts reached. Your application is queued for manual review by the Bikerz team.",
    });
  }

  // Mint a signed URL for the document so OpenAI can fetch it.
  // 60-second TTL is plenty: we hand the URL straight to OpenAI and
  // never persist it.
  const { data: signed, error: signErr } = await adminClient.storage
    .from("honda-registrations")
    .createSignedUrl(application.registration_document_path, 60);
  if (signErr || !signed?.signedUrl) {
    console.error("[honda-verify] sign failed:", signErr);
    return jsonResponse(500, { error: "Could not access document" });
  }

  // Build the prompt. We pass the form-claimed values so the model can
  // cross-check them against what's actually on the document.
  const systemPrompt =
    "You are an expert document verifier for a motorcycle academy. " +
    "You are shown a photograph or scan of an alleged Saudi/GCC motorcycle " +
    "registration document. The applicant has claimed certain values on a " +
    "form; your job is to read the document and tell us whether it (a) is " +
    "actually a motorcycle registration, (b) lists Honda as the brand " +
    "(Latin 'Honda' OR Arabic 'هوندا'), and (c) matches the applicant's " +
    "claimed name / model / year. " +
    "Be strict but reasonable: minor transliteration differences in Arabic↔Latin " +
    "names should still match if they refer to the same person. Wrong year by " +
    "1 should NOT match. Wrong model entirely should NOT match. " +
    "Reply ONLY with valid minified JSON matching the exact schema given.";

  const claimedFields = {
    full_name: application.full_name,
    motorcycle_model: application.motorcycle_model,
    motorcycle_year: application.motorcycle_year,
    country: application.country,
    city: application.city,
  };

  const userPrompt =
    `The applicant claims:\n${
      JSON.stringify(claimedFields, null, 2)
    }\n\n` +
    `Inspect the attached document image and respond with JSON of this exact shape:\n` +
    `{\n` +
    `  "is_motorcycle_registration_doc": boolean,\n` +
    `  "is_honda": boolean,\n` +
    `  "name_matches": boolean,\n` +
    `  "model_matches": boolean,\n` +
    `  "year_matches": boolean,\n` +
    `  "confidence": number (0..1),\n` +
    `  "reason_en": string (≤200 chars, why you decided),\n` +
    `  "reason_ar": string (≤200 chars, نفس السبب بالعربية),\n` +
    `  "detected_brand": string|null,\n` +
    `  "detected_owner_name": string|null,\n` +
    `  "detected_model": string|null,\n` +
    `  "detected_year": number|null\n` +
    `}\n\n` +
    `Critical: if the image is not a motorcycle registration (e.g. a random ` +
    `photo, an invoice, a different vehicle's papers), set ` +
    `is_motorcycle_registration_doc=false and EVERY other boolean=false.`;

  let aiDecision: AIDecision | null = null;
  let rawAiResponse: unknown = null;

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        // Force JSON-only output so we don't have to strip code fences.
        response_format: { type: "json_object" },
        temperature: 0, // deterministic — same doc → same decision
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              {
                type: "image_url",
                image_url: { url: signed.signedUrl, detail: "high" },
              },
            ],
          },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text().catch(() => "");
      console.error("[honda-verify] OpenAI error:", openaiRes.status, errText);
      return jsonResponse(502, {
        error: "AI service error. Please try again.",
      });
    }

    const openaiBody = await openaiRes.json();
    rawAiResponse = openaiBody;
    const content = openaiBody?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      console.error("[honda-verify] unexpected OpenAI shape", openaiBody);
      return jsonResponse(502, { error: "AI response malformed" });
    }
    try {
      aiDecision = JSON.parse(content) as AIDecision;
    } catch (e) {
      console.error("[honda-verify] JSON.parse failed:", e, content);
      return jsonResponse(502, { error: "AI response not valid JSON" });
    }
  } catch (e) {
    console.error("[honda-verify] fetch failed:", e);
    return jsonResponse(502, { error: "AI service unreachable" });
  }

  if (!aiDecision) {
    return jsonResponse(502, { error: "Empty AI decision" });
  }

  // Decide.
  const allChecksPassed =
    aiDecision.is_motorcycle_registration_doc === true &&
    aiDecision.is_honda === true &&
    aiDecision.name_matches === true &&
    aiDecision.model_matches === true &&
    aiDecision.year_matches === true &&
    typeof aiDecision.confidence === "number" &&
    aiDecision.confidence >= APPROVAL_CONFIDENCE_THRESHOLD;

  const newAttempts = (application.ai_attempts ?? 0) + 1;
  const reachedAttemptCap = newAttempts >= MAX_AI_ATTEMPTS;

  let nextStatus: string;
  let aiDecisionLabel: "approved" | "rejected";
  if (allChecksPassed) {
    nextStatus = "approved";
    aiDecisionLabel = "approved";
  } else if (reachedAttemptCap) {
    // 3rd attempt failed → escalate to manual review (next attempt would
    // skip the AI anyway — this just moves it into the admin queue now).
    nextStatus = "needs_manual_review";
    aiDecisionLabel = "rejected";
  } else {
    // Reject this attempt; user can re-upload (attempts remaining).
    nextStatus = "pending_ai";
    aiDecisionLabel = "rejected";
  }

  const { error: updErr } = await adminClient
    .from("honda_applications")
    .update({
      ai_attempts: newAttempts,
      ai_last_response: rawAiResponse as Record<string, unknown>,
      ai_decision: aiDecisionLabel,
      ai_decision_reason: aiDecision.reason_en?.slice(0, 500) ?? null,
      status: nextStatus,
    })
    .eq("id", applicationId);

  if (updErr) {
    console.error("[honda-verify] update failed:", updErr);
    return jsonResponse(500, { error: "Could not save verification result" });
  }

  return jsonResponse(200, {
    status: nextStatus,
    decision: aiDecisionLabel,
    attempts_used: newAttempts,
    attempts_remaining: Math.max(0, MAX_AI_ATTEMPTS - newAttempts),
    reason_en: aiDecision.reason_en,
    reason_ar: aiDecision.reason_ar,
    confidence: aiDecision.confidence,
    detected: {
      brand: aiDecision.detected_brand ?? null,
      owner_name: aiDecision.detected_owner_name ?? null,
      model: aiDecision.detected_model ?? null,
      year: aiDecision.detected_year ?? null,
    },
  });
});
