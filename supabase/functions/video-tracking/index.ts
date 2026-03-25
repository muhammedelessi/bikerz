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
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const body = await req.json();
    const {
      lessonId,
      courseId,
      watchData,
      watchSessionId, // String ID for the session
    } = body;

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    // Capture requester IP
    // Supabase Edge Functions provide the client IP in these headers when running on Supabase
    const ipAddress = req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip") || "0.0.0.0";

    // Update in video_watch_sessions
    const { error: upsertError } = await supabaseClient
      .from("video_watch_sessions")
      .upsert({
        user_id: user.id,
        lesson_id: lessonId,
        watch_session_id: watchSessionId, // identifies the specific watch session
        ip_address: ipAddress,
        total_watch_time_seconds: Math.floor(watchData.totalWatchedSeconds || 0),
        video_duration_seconds: Math.floor(watchData.videoDuration || 0),
        max_position_reached_seconds: Math.floor(watchData.lastPosition || 0),
        completion_percentage: watchData.totalWatchedSeconds && watchData.videoDuration
          ? Math.min(100, Math.round((watchData.totalWatchedSeconds / watchData.videoDuration) * 100))
          : 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,lesson_id,watch_session_id" });

    if (upsertError) throw upsertError;

    return new Response(JSON.stringify({ success: true, ip: ipAddress }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[video-tracking] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
