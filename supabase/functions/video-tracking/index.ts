import { serve } from "std/http/server";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Create user-scoped client for auth
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const body = await req.json();
    const {
      lessonId,
      courseId,
      watchData,
      sessionId,
      startedAt,
      skippedSegments,
      rewatchedSegments,
    } = body;

    if (!lessonId || !sessionId) {
      return new Response(JSON.stringify({ error: "Missing lessonId or sessionId" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Capture client IP from edge runtime headers
    const ipAddress =
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    // Use service role to upsert (bypasses RLS for the server-side insert)
    const { error: upsertError } = await supabaseClient
      .from("video_watch_sessions")
      .upsert(
        {
          user_id: user.id,
          lesson_id: lessonId,
          session_id: sessionId,
          ip_address: ipAddress,
          started_at: startedAt || new Date().toISOString(),
          total_watch_time_seconds: Math.floor(watchData?.totalWatchedSeconds || 0),
          video_duration_seconds: Math.floor(watchData?.videoDuration || 0),
          max_position_reached_seconds: Math.floor(watchData?.lastPosition || 0),
          completion_percentage: watchData?.completionPercentage || 0,
          skipped_segments: skippedSegments || [],
          rewatched_segments: rewatchedSegments || [],
        },
        { onConflict: "user_id,lesson_id,session_id" }
      );

    if (upsertError) throw upsertError;

    return new Response(
      JSON.stringify({ success: true, ip: ipAddress }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[video-tracking] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
