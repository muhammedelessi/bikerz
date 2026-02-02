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
  quality?: number;
  outputFormat?: 'mp4' | 'webm';
}

interface TranscodeResponse {
  success: boolean;
  message: string;
  videoPath: string;
  publicUrl?: string;
  recommendation: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    console.log(`Video optimization requested for: ${videoPath}`);
    console.log(`Requested settings: ${maxWidth}x${maxHeight}, quality: ${quality}%, format: ${outputFormat}`);

    // Get file metadata without downloading the entire file
    const { data: files, error: listError } = await supabase.storage
      .from('lesson-videos')
      .list(videoPath.split('/').slice(0, -1).join('/') || '', {
        search: videoPath.split('/').pop(),
      });

    if (listError) {
      console.error('List error:', listError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to find video: ${listError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fileName = videoPath.split('/').pop();
    const fileInfo = files?.find(f => f.name === fileName);
    
    // Get public URL for the original video
    const { data: { publicUrl } } = supabase.storage
      .from('lesson-videos')
      .getPublicUrl(videoPath);

    const response: TranscodeResponse = {
      success: true,
      message: 'Video validated successfully. Use client-side compression for best results.',
      videoPath,
      publicUrl,
      recommendation: 'Edge functions have memory limits that prevent server-side video processing. For reliable compression, use the "Client" optimization mode which compresses videos in the browser before upload.',
    };

    // Include file size if available
    if (fileInfo?.metadata?.size) {
      (response as any).fileSize = fileInfo.metadata.size;
      (response as any).fileSizeMB = (fileInfo.metadata.size / 1024 / 1024).toFixed(2) + ' MB';
    }

    console.log(`Video validation complete: ${videoPath}`);

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
