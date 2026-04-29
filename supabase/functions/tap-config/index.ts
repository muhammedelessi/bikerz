// Returns the Tap public key to the frontend (publishable key, safe to expose).
//
// Origin-based key switching:
// - Requests originating from preview environments (*.lovableproject.com,
//   *.lovable.app, localhost, 127.0.0.1) get the TEST publishable key so the
//   embedded card SDK renders correctly without requiring those domains to be
//   whitelisted in Tap.
// - All other origins (production: academy.bikerz.com) get the LIVE key.
//
// The matching switch happens in tap-create-charge so a tok_test_… token is
// always paired with the test secret key, and tok_… (live) with the live key.
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

  console.log(`[tap-config] origin=${origin || "(none)"} usePreviewKey=${usePreviewKey} hasTestKey=${!!testKey} hasLiveKey=${!!liveKey}`);

  const tapPublicKey = usePreviewKey ? (testKey || liveKey) : liveKey;

  if (!tapPublicKey) {
    return new Response(
      JSON.stringify({ error: "Payment not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      public_key: tapPublicKey,
      environment: tapPublicKey.startsWith("pk_test") ? "test" : "live",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
