import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const ARAB_COUNTRY_HINTS: Record<string, string> = {
  egypt: "EG",
  "united arab emirates": "AE",
  saudi: "SA",
  jordan: "JO",
  kuwait: "KW",
  qatar: "QA",
  bahrain: "BH",
  oman: "OM",
  iraq: "IQ",
  lebanon: "LB",
  syria: "SY",
  libya: "LY",
  tunisia: "TN",
  algeria: "DZ",
  morocco: "MA",
  sudan: "SD",
  palestine: "PS",
  yemen: "YE",
};

function normalizeCountryCode(raw: string | null | undefined): string | null {
  const c = (raw ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

function getHeaderCountry(req: Request): string | null {
  const direct = [
    req.headers.get("cf-ipcountry"),
    req.headers.get("x-vercel-ip-country"),
    req.headers.get("x-country-code"),
    req.headers.get("cloudfront-viewer-country"),
  ];

  for (const value of direct) {
    const normalized = normalizeCountryCode(value);
    if (normalized) return normalized;
  }

  const inferred = [
    req.headers.get("x-vercel-ip-country-region"),
    req.headers.get("x-vercel-ip-country-name"),
    req.headers.get("x-country-name"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (inferred) {
    for (const [hint, code] of Object.entries(ARAB_COUNTRY_HINTS)) {
      if (inferred.includes(hint)) return code;
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const countryCode = getHeaderCountry(req);

  return new Response(JSON.stringify({ countryCode }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});