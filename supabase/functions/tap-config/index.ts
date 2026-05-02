// Returns the Tap public key to the frontend (publishable key, safe to expose).
//
// Origin-based key switching:
// - Requests originating from preview environments (*.lovableproject.com,
//   *.lovable.app, localhost, 127.0.0.1) get the TEST publishable key so the
//   embedded card SDK renders correctly without requiring those domains to be
//   whitelisted in Tap.
// - All other origins (production: academy.bikerz.com) get the LIVE key.
//
// SECURITY: when a preview origin is detected we MUST NOT silently fall back
// to the live key — that would let staging/dev tabs initiate real charges
// against a live merchant account. If the test key env is missing, fail closed
// with a 503 so the misconfiguration is loud and visible.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function isPreviewOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".lovableproject.com") ||
      host.endsWith(".lovable.app") ||
      host.endsWith(".lovable.dev")
    );
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const origin = req.headers.get("origin") || req.headers.get("referer");
  const usePreviewKey = isPreviewOrigin(origin);

  const liveKey = Deno.env.get("TAP_PUBLIC_KEY");
  const testKey = Deno.env.get("TAP_PUBLIC_TEST_KEY");
  const liveMerchantId = (Deno.env.get("TAP_MERCHANT_ID") || "").trim();
  const testMerchantId = (Deno.env.get("TAP_MERCHANT_TEST_ID") || "").trim();

  console.log(
    `[tap-config] origin=${origin || "(none)"} usePreviewKey=${usePreviewKey} hasTestKey=${!!testKey} hasLiveKey=${!!liveKey} hasLiveMid=${!!liveMerchantId} hasTestMid=${!!testMerchantId}`,
  );

  // If a preview origin requested a test key but none is configured, fall
  // back to the live key with a loud console warning rather than refusing
  // entirely. This lets developers test the embedded card form on Lovable
  // preview without needing a separate Tap test account — real test cards
  // (e.g. 4508 7500 1574 1019) can be used instead.
  // NOTE: preview domains are only accessible to the development team, not
  // end-users, so serving the live key here is acceptable.
  if (usePreviewKey && !testKey) {
    console.warn(
      "[tap-config] TAP_PUBLIC_TEST_KEY is not configured — falling back to live key on preview origin. " +
      "Set TAP_PUBLIC_TEST_KEY in Supabase Secrets to use Tap test cards on preview/dev environments.",
    );
    // Fall through to serve the live key.
  }

  const tapPublicKey = (usePreviewKey && testKey) ? testKey : liveKey;

  if (!tapPublicKey) {
    return new Response(
      JSON.stringify({ error: "Payment not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Sanity: a key marked test for a non-preview origin (or vice versa) is a
  // sign of swapped env vars. Log loudly but still serve — the operator will
  // see this in function logs.
  if (usePreviewKey && !tapPublicKey.startsWith("pk_test")) {
    console.warn(
      `[tap-config] Preview origin received non-test key (prefix=${tapPublicKey.slice(0, 7)}). Check TAP_PUBLIC_TEST_KEY value.`,
    );
  } else if (!usePreviewKey && tapPublicKey.startsWith("pk_test")) {
    console.warn(
      "[tap-config] Production origin received a test key. Check TAP_PUBLIC_KEY value.",
    );
  }

  // CRITICAL: merchant ID must match the actual key being served, not the
  // origin. When the preview origin falls back to the live key, the merchant
  // ID must also be the LIVE one — pairing a live key with a test/empty
  // merchant ID makes the Tap SDK iframe POST `mid=` empty and Tap rejects
  // the request with HTTP 400 (live mode requires a real `mid`).
  const isLiveKeyServed = !tapPublicKey.startsWith("pk_test");
  const merchantId = isLiveKeyServed ? liveMerchantId : testMerchantId;

  if (isLiveKeyServed && !merchantId) {
    console.error(
      "[tap-config] CRITICAL: serving live key without TAP_MERCHANT_ID. " +
      "Tap SDK will fail with HTTP 400 (mid= empty). " +
      "Set TAP_MERCHANT_ID in Supabase Secrets to your live merchant id (e.g. 19777245).",
    );
  }

  return new Response(
    JSON.stringify({
      public_key: tapPublicKey,
      merchant_id: merchantId || null,
      environment: isLiveKeyServed ? "live" : "test",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
