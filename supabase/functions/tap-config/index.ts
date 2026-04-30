// Returns the Tap public key to the frontend (publishable key, safe to expose)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const tapPublicKey = Deno.env.get("TAP_PUBLIC_KEY");

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
