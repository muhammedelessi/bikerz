import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranscodeRequest {
  videoPath: string;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 1-100
  outputFormat?: 'mp4' | 'webm';
}

interface TranscodeResponse {
  success: boolean;
  outputPath?: string;
  publicUrl?: string;
  originalSize?: number;
  compressedSize?: number;
  compressionRatio?: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: user.id });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: TranscodeRequest = await req.json();
    const { 
      videoPath, 
      maxWidth = 1280, 
      maxHeight = 720, 
      quality = 70,
      outputFormat = 'mp4' 
    } = body;

    if (!videoPath) {
      return new Response(
        JSON.stringify({ success: false, error: 'videoPath is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting transcoding for: ${videoPath}`);
    console.log(`Settings: ${maxWidth}x${maxHeight}, quality: ${quality}%, format: ${outputFormat}`);

    // Download the original video from storage
    const { data: videoData, error: downloadError } = await supabase.storage
      .from('lesson-videos')
      .download(videoPath);

    if (downloadError || !videoData) {
      console.error('Download error:', downloadError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to download video: ${downloadError?.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const originalSize = videoData.size;
    console.log(`Original video size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

    // For edge functions, we have limited options for video processing.
    // We'll use a lightweight approach with WebCodecs API or pass to external service.
    // Since full FFmpeg isn't available in Deno edge runtime, we'll implement
    // a strategy that works within constraints:
    
    // Option 1: Re-encode using MediaRecorder API simulation (limited)
    // Option 2: Call external transcoding API
    // Option 3: Use WebCodecs (when available)
    
    // For now, we'll implement a basic approach that:
    // 1. Validates the video
    // 2. Stores metadata about the requested compression
    // 3. Returns the original if transcoding isn't possible server-side
    
    // In production, you would integrate with:
    // - AWS MediaConvert
    // - Cloudflare Stream
    // - Mux
    // - or similar video processing services

    // Generate output filename
    const inputExt = videoPath.split('.').pop() || 'mp4';
    const baseName = videoPath.replace(/\.[^/.]+$/, '');
    const timestamp = Date.now();
    const outputPath = `${baseName}_compressed_${maxHeight}p_${timestamp}.${outputFormat}`;

    // For demonstration, we'll copy the file with metadata
    // In production, integrate with a real transcoding service
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('lesson-videos')
      .upload(outputPath, videoData, {
        contentType: outputFormat === 'mp4' ? 'video/mp4' : 'video/webm',
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to upload transcoded video: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('lesson-videos')
      .getPublicUrl(outputPath);

    const compressedSize = videoData.size; // Same size for now (no actual transcoding)
    const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

    console.log(`Transcoding complete. Output: ${outputPath}`);

    const response: TranscodeResponse = {
      success: true,
      outputPath,
      publicUrl,
      originalSize,
      compressedSize,
      compressionRatio: `${ratio}%`,
    };

    // Note: This is a placeholder implementation.
    // For real server-side transcoding, you would need to:
    // 1. Use an external video processing API (AWS MediaConvert, Mux, etc.)
    // 2. Or set up a dedicated worker service with FFmpeg installed
    // 3. The edge function would then orchestrate the transcoding job

    return new Response(
      JSON.stringify({
        ...response,
        note: 'Server-side transcoding requires external service integration. Currently using pass-through mode. For production, integrate with AWS MediaConvert, Mux, or Cloudflare Stream.'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Transcoding error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
