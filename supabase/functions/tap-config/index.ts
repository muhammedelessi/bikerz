// Returns the Tap public key + merchant id to the frontend, picking the
// correct key set for the calling origin.
//
// Tap registered THREE separate API key sets — one per parent domain — for
// our merchant 19777245:
//
//   bikerz.com           (covers academy.bikerz.com)
//   lovable.app          (covers bikerz.lovable.app + any other staging)
//   lovableproject.com   (covers per-session preview subdomains)
//
// Each set has live + test public/secret keys. We MUST serve the public key
// that matches the request's origin — pairing a key from one domain with a
// page on another domain fails the SDK iframe's postMessage origin check
// (the symptom users saw before this change: "Failed to execute postMessage…
// target origin does not match recipient window's origin").
//
// Backwards compatibility: if a per-domain env var is missing, fall back to
// the legacy single-set vars (TAP_PUBLIC_KEY, TAP_PUBLIC_TEST_KEY) so an
// incomplete migration doesn't take checkout offline.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type DomainTag = "bikerz" | "lovable_app" | "lovableproject" | "unknown";

interface KeySet {
  publicKeyLive: string | undefined;
  publicKeyTest: string | undefined;
  domain: DomainTag;
}

function getEnv(name: string): string | undefined {
  const v = Deno.env.get(name);
  return v && v.trim() ? v.trim() : undefined;
}

/**
 * Map the request's origin to the correct domain bucket and read the matching
 * env vars. Localhost / unknown hosts fall through to the bikerz test bucket
 * so devs can still use Tap test cards locally; live charges from unknown
 * origins are NOT served (returns undefined publicKeyLive).
 */
function selectKeySet(origin: string | null): KeySet {
  let host = "";
  try {
    host = new URL(origin || "").hostname.toLowerCase();
  } catch {
    host = "";
  }

  // ── bikerz.com (covers academy.bikerz.com, www.bikerz.com, …) ──
  if (host === "bikerz.com" || host.endsWith(".bikerz.com")) {
    return {
      publicKeyLive:
        getEnv("TAP_PK_LIVE_BIKERZ") ?? getEnv("TAP_PUBLIC_KEY"),
      publicKeyTest:
        getEnv("TAP_PK_TEST_BIKERZ") ?? getEnv("TAP_PUBLIC_TEST_KEY"),
      domain: "bikerz",
    };
  }

  // ── lovable.app (e.g. bikerz.lovable.app) ──
  if (host === "lovable.app" || host.endsWith(".lovable.app")) {
    return {
      publicKeyLive: getEnv("TAP_PK_LIVE_LOVABLE_APP"),
      publicKeyTest: getEnv("TAP_PK_TEST_LOVABLE_APP"),
      domain: "lovable_app",
    };
  }

  // ── lovableproject.com (preview sessions) ──
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) {
    return {
      publicKeyLive: getEnv("TAP_PK_LIVE_LOVABLEPROJECT"),
      publicKeyTest: getEnv("TAP_PK_TEST_LOVABLEPROJECT"),
      domain: "lovableproject",
    };
  }

  // ── localhost / 127.0.0.1 / unknown ──
  // Use bikerz test keys so local dev still works against Tap. Don't expose
  // any LIVE key here — unknown origins shouldn't be able to initiate real
  // charges.
  return {
    publicKeyLive: undefined,
    publicKeyTest:
      getEnv("TAP_PK_TEST_BIKERZ") ?? getEnv("TAP_PUBLIC_TEST_KEY"),
    domain: "unknown",
  };
}

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
  const keys = selectKeySet(origin);

  // Pick the right key for the requested mode (test vs live).
  // Preview/dev origins prefer the test key; production origins prefer live.
  // If the preferred one is missing, fall back to the other (with a warning)
  // so checkout doesn't go down because of a half-configured deployment.
  let tapPublicKey: string | undefined;
  if (usePreviewKey) {
    tapPublicKey = keys.publicKeyTest ?? keys.publicKeyLive;
    if (!keys.publicKeyTest && keys.publicKeyLive) {
      console.warn(
        `[tap-config] preview origin (${keys.domain}) has no test key — serving live key. ` +
        "Set the matching TAP_PK_TEST_* secret to fix.",
      );
    }
  } else {
    tapPublicKey = keys.publicKeyLive ?? keys.publicKeyTest;
    if (!keys.publicKeyLive && keys.publicKeyTest) {
      console.warn(
        `[tap-config] production origin (${keys.domain}) has no live key — falling back to test key. ` +
        "Charges will be sandboxed. Set the matching TAP_PK_LIVE_* secret to fix.",
      );
    }
  }

  if (!tapPublicKey) {
    console.error(
      `[tap-config] no key available for origin=${origin || "(none)"} domain=${keys.domain}. ` +
      "Add TAP_PK_LIVE_* / TAP_PK_TEST_* secrets for this domain in Supabase.",
    );
    return new Response(
      JSON.stringify({ error: "Payment not configured for this domain" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const isLiveKeyServed = !tapPublicKey.startsWith("pk_test");

  // Merchant ID is shared across all key sets (same Tap account, same
  // merchant). Test mode often uses a different mid, but Tap confirmed the
  // same value (19777245) works for both modes on this account.
  const liveMerchantId =
    getEnv("TAP_MERCHANT_ID") ?? "";
  const testMerchantId =
    getEnv("TAP_MERCHANT_TEST_ID") ?? liveMerchantId;
  const merchantId = isLiveKeyServed ? liveMerchantId : testMerchantId;

  console.log(
    `[tap-config] origin=${origin || "(none)"} domain=${keys.domain} ` +
    `mode=${isLiveKeyServed ? "live" : "test"} keyPrefix=${tapPublicKey.slice(0, 8)} ` +
    `mid=${merchantId || "(empty)"}`,
  );

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
      domain: keys.domain,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
