import { serve } from "std/http/server";
import { encode as base64Encode } from "std/encoding/base64";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, range",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Expose-Headers": "content-length, content-range, accept-ranges",
};

// Bunny Stream URL patterns
const BUNNY_CDN_PATTERN = /^https:\/\/vz-[a-z0-9]+-[a-z0-9]+\.b-cdn\.net\//;

// Extract path from Bunny CDN URL (without query string)
const extractPath = (url: string): string => {
  const urlObj = new URL(url);
  return urlObj.pathname;
};

// Generate Bunny Stream signed token
// Format: base64(sha256(security_key + path + expiration_time))
const generateBunnyToken = async (
  securityKey: string,
  path: string,
  expirationTime: number
): Promise<string> => {
  // Bunny expects: SHA256(security_key + url_path + expiration_time) in hex
  const signatureString = securityKey + path + expirationTime.toString();
  const encoder = new TextEncoder();
  const data = encoder.encode(signatureString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // Convert bytes to base64 and make URL-safe
  const base64Token = base64Encode(hashBuffer);

  // URL-safe base64
  return base64Token.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const bunnyAuthKey = Deno.env.get("BUNNY_AUTH_KEY");

    const url = new URL(req.url);
    const targetUrl = url.searchParams.get("url");

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: "Missing url parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode the URL if it's encoded
    const decodedUrl = decodeURIComponent(targetUrl);

    // Validate that this is a Bunny CDN URL for security
    if (!BUNNY_CDN_PATTERN.test(decodedUrl)) {
      return new Response(JSON.stringify({ error: "Only Bunny CDN URLs are allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[video-proxy] Processing: ${decodedUrl}`);

    // Build the fetch URL with token authentication if available
    let fetchUrl = decodedUrl;

    if (bunnyAuthKey) {
      try {
        const path = extractPath(decodedUrl);
        const expirationTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour
        const token = await generateBunnyToken(bunnyAuthKey, path, expirationTime);

        // Add token to URL using Bunny's format
        const separator = decodedUrl.includes("?") ? "&" : "?";
        fetchUrl = `${decodedUrl}${separator}token=${token}&expires=${expirationTime}`;
        console.log(`[video-proxy] Added signed token, path: ${path}, expires: ${expirationTime}`);
      } catch (tokenError) {
        console.error("[video-proxy] Token generation failed:", tokenError);
      }
    } else {
      console.log("[video-proxy] No BUNNY_AUTH_KEY configured, trying without auth");
    }

    const rangeHeader = req.headers.get("range") ?? undefined;
    const refererHeader = req.headers.get("origin") ?? req.headers.get("referer") ?? "https://bikerz.lovable.app";

    // Fetch the content from Bunny CDN
    console.log(`[video-proxy] Fetching: ${fetchUrl.substring(0, 140)}...`);

    const response = await fetch(fetchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VideoProxy/1.0)",
        Accept: "*/*",
        ...(rangeHeader ? { Range: rangeHeader } : {}),
        Referer: refererHeader,
      },
    });

    if (!response.ok) {
      console.error(`[video-proxy] Upstream error: ${response.status} ${response.statusText}`);

      // If token auth failed, try without token (for public videos)
      if (response.status === 403 && fetchUrl !== decodedUrl) {
        console.log(`[video-proxy] Token auth failed, retrying without token...`);
        const retryResponse = await fetch(decodedUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; VideoProxy/1.0)",
            Accept: "*/*",
            ...(rangeHeader ? { Range: rangeHeader } : {}),
            Referer: refererHeader,
          },
        });

        if (retryResponse.ok) {
          console.log("[video-proxy] Retry without token succeeded");
          return handleSuccessResponse(retryResponse, decodedUrl, url);
        }
        console.error(`[video-proxy] Retry also failed: ${retryResponse.status}`);
      }

      return new Response(JSON.stringify({ error: `Upstream error: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[video-proxy] Success, content-type: ${response.headers.get("Content-Type")}`);
    return handleSuccessResponse(response, decodedUrl, url);
  } catch (error) {
    console.error("[video-proxy] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleSuccessResponse(
  response: Response,
  originalUrl: string,
  requestUrl: URL
): Promise<Response> {
  const contentType = response.headers.get("Content-Type") || "application/octet-stream";
  const isM3u8 = originalUrl.endsWith(".m3u8") || contentType.includes("mpegurl");
  const isTs = originalUrl.endsWith(".ts");

  // For .m3u8 playlists, we need to rewrite URLs to go through the proxy
  if (isM3u8) {
    const text = await response.text();

    // Get the base URL for relative paths
    const baseUrl = originalUrl.substring(0, originalUrl.lastIndexOf("/") + 1);

    // Get our proxy base URL
    const proxyBase = `${requestUrl.origin}${requestUrl.pathname}`;

    // Rewrite URLs in the playlist
    const rewrittenPlaylist = text
      .split("\n")
      .map((line) => {
        const trimmedLine = line.trim();

        // Skip empty lines and comments (except URI in comments)
        if (!trimmedLine || (trimmedLine.startsWith("#") && !trimmedLine.includes('URI="'))) {
          // Check for EXT-X-KEY or similar with URI
          if (trimmedLine.includes('URI="')) {
            return trimmedLine.replace(/URI="([^"]+)"/g, (_match, uri) => {
              const absoluteUri = uri.startsWith("http") ? uri : baseUrl + uri;
              return `URI="${proxyBase}?url=${encodeURIComponent(absoluteUri)}"`;
            });
          }
          return line;
        }

        // If line is a URL (relative or absolute)
        if (!trimmedLine.startsWith("#")) {
          const absoluteUrl = trimmedLine.startsWith("http") ? trimmedLine : baseUrl + trimmedLine;
          return `${proxyBase}?url=${encodeURIComponent(absoluteUrl)}`;
        }

        return line;
      })
      .join("\n");

    return new Response(rewrittenPlaylist, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-cache",
      },
    });
  }

  // For .ts segments and other binary content, stream directly (supports Range responses)
  const passThroughHeaders: Record<string, string> = {
    ...corsHeaders,
    "Content-Type": contentType,
    "Cache-Control": isTs ? "max-age=31536000" : "no-cache",
  };

  const contentRange = response.headers.get("Content-Range");
  if (contentRange) passThroughHeaders["Content-Range"] = contentRange;

  const acceptRanges = response.headers.get("Accept-Ranges");
  if (acceptRanges) passThroughHeaders["Accept-Ranges"] = acceptRanges;

  const contentLength = response.headers.get("Content-Length");
  if (contentLength) passThroughHeaders["Content-Length"] = contentLength;

  return new Response(response.body, {
    status: response.status,
    headers: passThroughHeaders,
  });
}

