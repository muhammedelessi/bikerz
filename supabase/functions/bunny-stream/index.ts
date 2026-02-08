import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface CreateVideoRequest {
  title: string;
  collectionId?: string;
}

interface GetUploadUrlRequest {
  videoId: string;
}

interface GetPlaybackUrlRequest {
  videoId: string;
  expiresIn?: number; // seconds
}

interface VideoStatusRequest {
  videoId: string;
}

interface DeleteVideoRequest {
  videoId: string;
}

// Bunny Stream API configuration
const BUNNY_API_BASE = "https://video.bunnycdn.com";

// IMPORTANT: The CDN Pull Zone host is NOT reliably derivable from the library id.
// We try to resolve it via Bunny API, and fall back to the known base used by this project.
const BUNNY_CDN_BASE = "https://vz-4da6a56a-dc2.b-cdn.net";

const normalizeCdnBase = (value: string) => value.replace(/\/+$/, "");

const tryExtractCdnBase = (maybeUrl: unknown): string | null => {
  if (typeof maybeUrl !== "string") return null;
  const raw = maybeUrl.trim();
  if (!raw) return null;

  // Some APIs may return hostname-only, protocol-relative, or full URL.
  const withProto = raw.startsWith("http")
    ? raw
    : raw.startsWith("//")
      ? `https:${raw}`
      : `https://${raw}`;

  try {
    const u = new URL(withProto);
    if (!u.hostname.toLowerCase().includes("b-cdn.net")) return null;
    return normalizeCdnBase(`${u.protocol}//${u.host}`);
  } catch {
    return null;
  }
};

const pickCdnBaseFromLibrary = (library: any): string | null => {
  // Common-ish fields (case varies across docs/examples)
  const knownKeys = [
    "pullZoneUrl",
    "PullZoneUrl",
    "cdnUrl",
    "CdnUrl",
    "cdnBase",
    "CdnBase",
    "hostname",
    "Hostname",
  ];

  for (const key of knownKeys) {
    const base = tryExtractCdnBase(library?.[key]);
    if (base) return base;
  }

  // Fallback: scan all primitive string props for a b-cdn.net URL/hostname
  for (const v of Object.values(library ?? {})) {
    const base = tryExtractCdnBase(v);
    if (base) return base;
  }

  return null;
};

const resolveCdnBase = async (
  libraryId: string,
  bunnyFetch: (endpoint: string, options?: RequestInit) => Promise<any>
): Promise<string> => {
  try {
    const library = await bunnyFetch(`/library/${libraryId}`);
    const fromApi = pickCdnBaseFromLibrary(library);
    if (fromApi) return fromApi;
  } catch (e) {
    console.warn("[bunny-stream] Failed to resolve CDN base via API, falling back", e);
  }

  return normalizeCdnBase(BUNNY_CDN_BASE);
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const bunnyLibraryId = Deno.env.get('BUNNY_LIBRARY_ID')!;
    const bunnyApiKey = Deno.env.get('BUNNY_STREAM_API_KEY')!;
    const bunnyAuthKey = Deno.env.get('BUNNY_AUTH_KEY')!;

    if (!bunnyLibraryId || !bunnyApiKey) {
      return new Response(
        JSON.stringify({ error: 'Bunny Stream credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.user.id;

    // Parse request
    const url = new URL(req.url);
    const body: any = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action = url.searchParams.get('action') ?? (typeof body?.action === 'string' ? body.action : null);

    // Helper function for Bunny API calls
    const bunnyFetch = async (endpoint: string, options: RequestInit = {}) => {
      const response = await fetch(`${BUNNY_API_BASE}${endpoint}`, {
        ...options,
        headers: {
          'AccessKey': bunnyApiKey,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Bunny API error: ${response.status} - ${errorText}`);
        throw new Error(`Bunny API error: ${response.status}`);
      }
      
      return response.json();
    };

    // Generate signed playback URL with token authentication
    const generateSignedUrl = (videoId: string, expiresIn: number = 3600): string => {
      const expires = Math.floor(Date.now() / 1000) + expiresIn;
      const pullZone = `vz-${bunnyLibraryId.slice(0, 8)}-dc2`;
      const baseUrl = `https://${pullZone}.b-cdn.net/${videoId}/playlist.m3u8`;
      
      // Generate token hash for signed URLs
      const crypto = globalThis.crypto;
      const encoder = new TextEncoder();
      
      // For Bunny Stream, we use the authentication key to generate a token
      // The token format is: base64(sha256(securityKey + path + expires))
      // For simplicity, we'll use unsigned URLs with expiring tokens if auth key is set
      
      if (bunnyAuthKey) {
        // Generate a simple expiring token
        const tokenData = `${bunnyAuthKey}${videoId}${expires}`;
        // Note: In production, use proper HMAC signing. For now, append expires as query param
        return `${baseUrl}?token_path=/${videoId}/&expires=${expires}`;
      }
      
      return baseUrl;
    };

    switch (action) {
      // Create a new video entry (returns video ID for upload)
      case 'create-video': {
        const { title, collectionId }: CreateVideoRequest = body;
        
        // Check if user is admin
        const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: userId });
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: 'Admin access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const createPayload: any = { title };
        if (collectionId) createPayload.collectionId = collectionId;

        const video = await bunnyFetch(`/library/${bunnyLibraryId}/videos`, {
          method: 'POST',
          body: JSON.stringify(createPayload),
        });

        console.log(`Created video: ${video.guid} - ${title}`);

        return new Response(
          JSON.stringify({
            success: true,
            videoId: video.guid,
            libraryId: bunnyLibraryId,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get TUS upload URL for resumable uploads
      case 'get-upload-url': {
        const { videoId }: GetUploadUrlRequest = body;
        
        const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: userId });
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: 'Admin access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!videoId) {
          return new Response(
            JSON.stringify({ error: 'videoId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Bunny Stream TUS endpoint
        const tusEndpoint = `https://video.bunnycdn.com/tusupload`;
        
        // Generate authorization signature for TUS
        // Bunny requires: SHA256(library_id + api_key + expiration_time + video_id)
        const expirationTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours
        
        // Create the signature hash
        const signatureString = `${bunnyLibraryId}${bunnyApiKey}${expirationTime}${videoId}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(signatureString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const authorizationSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return new Response(
          JSON.stringify({
            success: true,
            uploadUrl: tusEndpoint,
            videoId,
            libraryId: bunnyLibraryId,
            expirationTime,
            authorizationSignature,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get signed playback URL for HLS streaming
      case 'get-playback-url': {
        const { videoId, expiresIn = 3600 }: GetPlaybackUrlRequest = body;

        if (!videoId) {
          return new Response(
            JSON.stringify({ error: 'videoId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get video details to check if it's ready
        const video = await bunnyFetch(`/library/${bunnyLibraryId}/videos/${videoId}`);
        
        if (video.status !== 4) { // 4 = finished encoding
          return new Response(
            JSON.stringify({
              success: false,
              status: video.status,
              statusMessage: getVideoStatusMessage(video.status),
              encodeProgress: video.encodeProgress || 0,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate playback URLs (resolve the correct CDN Pull Zone base)
        const cdnBase = await resolveCdnBase(bunnyLibraryId, bunnyFetch);
        const base = normalizeCdnBase(cdnBase);

        // HLS playlist URL
        const hlsUrl = `${base}/${videoId}/playlist.m3u8`;

        // Thumbnail URL
        const thumbnailUrl = `${base}/${videoId}/thumbnail.jpg`;

        // Preview animation (if available)
        const previewUrl = `${base}/${videoId}/preview.webp`;

        return new Response(
          JSON.stringify({
            success: true,
            playbackUrl: hlsUrl,
            thumbnailUrl,
            previewUrl,
            duration: video.length,
            width: video.width,
            height: video.height,
            availableResolutions: video.availableResolutions?.split(',') || [],
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get video processing status
      case 'get-status': {
        const { videoId }: VideoStatusRequest = body;

        if (!videoId) {
          return new Response(
            JSON.stringify({ error: 'videoId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const video = await bunnyFetch(`/library/${bunnyLibraryId}/videos/${videoId}`);

        return new Response(
          JSON.stringify({
            success: true,
            videoId: video.guid,
            status: video.status,
            statusMessage: getVideoStatusMessage(video.status),
            encodeProgress: video.encodeProgress || 0,
            duration: video.length,
            width: video.width,
            height: video.height,
            size: video.storageSize,
            availableResolutions: video.availableResolutions?.split(',') || [],
            dateUploaded: video.dateUploaded,
            isReady: video.status === 4,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete a video
      case 'delete-video': {
        const { videoId }: DeleteVideoRequest = body;
        
        const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: userId });
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: 'Admin access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!videoId) {
          return new Response(
            JSON.stringify({ error: 'videoId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await bunnyFetch(`/library/${bunnyLibraryId}/videos/${videoId}`, {
          method: 'DELETE',
        });

        console.log(`Deleted video: ${videoId}`);

        return new Response(
          JSON.stringify({ success: true, videoId }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // List all videos in the library
      case 'list-videos': {
        const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: userId });
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: 'Admin access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const page = parseInt(url.searchParams.get('page') || '1');
        const perPage = parseInt(url.searchParams.get('perPage') || '25');

        const videos = await bunnyFetch(
          `/library/${bunnyLibraryId}/videos?page=${page}&itemsPerPage=${perPage}`
        );

        return new Response(
          JSON.stringify({
            success: true,
            videos: videos.items?.map((v: any) => ({
              videoId: v.guid,
              title: v.title,
              status: v.status,
              statusMessage: getVideoStatusMessage(v.status),
              duration: v.length,
              size: v.storageSize,
              dateUploaded: v.dateUploaded,
              isReady: v.status === 4,
            })) || [],
            totalItems: videos.totalItems,
            currentPage: videos.currentPage,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Bunny Stream function error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to get human-readable status
function getVideoStatusMessage(status: number): string {
  switch (status) {
    case 0: return 'Created';
    case 1: return 'Uploading';
    case 2: return 'Processing';
    case 3: return 'Encoding';
    case 4: return 'Ready';
    case 5: return 'Upload Failed';
    case 6: return 'Processing Failed';
    default: return 'Unknown';
  }
}
