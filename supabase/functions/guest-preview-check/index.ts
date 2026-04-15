import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RequestBody = {
  action: "check" | "record";
  fingerprint: string;
  course_id: string;
  video_id?: string;
  user_agent?: string;
};

const getClientIp = (req: Request): string => {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const { action, fingerprint, course_id, video_id, user_agent } = body;

    if (!action || !fingerprint || !course_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const ipAddress = getClientIp(req);

    const { count: ipFingerprintCount, error: ipCheckError } = await supabase
      .from("guest_video_views")
      .select("fingerprint", { count: "exact", head: true })
      .eq("ip_address", ipAddress)
      .eq("course_id", course_id)
      .gt("started_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if (ipCheckError) throw ipCheckError;

    if ((ipFingerprintCount || 0) > 5) {
      return new Response(JSON.stringify({ allowed: false, reason: "ip_limit", recorded: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existing, error: existingError } = await supabase
      .from("guest_video_views")
      .select("video_id, started_at")
      .eq("fingerprint", fingerprint)
      .eq("course_id", course_id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (action === "check") {
      if (existing) {
        return new Response(
          JSON.stringify({
            allowed: false,
            reason: "already_used",
            video_id: existing.video_id,
            started_at: existing.started_at,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ allowed: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!video_id) {
      return new Response(JSON.stringify({ error: "Missing video_id for record action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existing) {
      return new Response(
        JSON.stringify({
          recorded: true,
          allowed: false,
          reason: "already_used",
          video_id: existing.video_id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: insertError } = await supabase.from("guest_video_views").insert({
      fingerprint,
      course_id,
      video_id,
      ip_address: ipAddress,
      user_agent: user_agent || "",
    });

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ recorded: true, allowed: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[guest-preview-check] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
