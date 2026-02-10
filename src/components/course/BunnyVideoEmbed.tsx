import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

interface BunnyVideoEmbedProps {
  videoUrl: string;
  title?: string;
  onEnded?: () => void;
  onProgress?: (progress: number) => void;
  onTimeUpdate?: (timeSeconds: number) => void;
  initialTime?: number;
}

// Extract Bunny video ID from CDN URL
// Pattern: https://vz-XXXX.b-cdn.net/{videoId}/playlist.m3u8
const extractBunnyVideoId = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    if (pathParts.length >= 1) {
      const candidate = pathParts[0];
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidPattern.test(candidate)) {
        return candidate;
      }
    }
  } catch {
    // try regex fallback
  }

  const match = url.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  return match ? match[1] : null;
};

// Cache for library ID
let cachedLibraryId: string | null = null;

const fetchLibraryId = async (videoId: string): Promise<string | null> => {
  if (cachedLibraryId) return cachedLibraryId;

  // Try bunny-stream function (authenticated, reliable)
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.functions.invoke("bunny-stream", {
      body: { action: "get-playback-url", videoId },
    });
    if (data?.libraryId) {
      cachedLibraryId = data.libraryId;
      return data.libraryId;
    }
  } catch (err) {
    console.warn("[BunnyVideoEmbed] bunny-stream failed:", err);
  }

  // Fallback: try bunny-embed edge function (public, no auth)
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const response = await fetch(
      `${supabaseUrl}/functions/v1/bunny-embed?videoId=${videoId}`,
      { headers: { apikey: anonKey } }
    );

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.libraryId) {
        cachedLibraryId = result.libraryId;
        return result.libraryId;
      }
    }
  } catch {
    // ignore
  }

  return null;
};

const BunnyVideoEmbed: React.FC<BunnyVideoEmbedProps> = ({
  videoUrl,
  title,
  onEnded,
  onProgress,
  onTimeUpdate,
  initialTime = 0,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  const videoId = useMemo(() => extractBunnyVideoId(videoUrl), [videoUrl]);

  // Fetch library ID and build embed URL
  useEffect(() => {
    if (!videoId) {
      setError("Invalid video URL");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const init = async () => {
      const libraryId = await fetchLibraryId(videoId);

      if (cancelled) return;

      if (!libraryId) {
        setError("Could not load video configuration. Please try again.");
        setIsLoading(false);
        return;
      }

      const params = new URLSearchParams({
        autoplay: "false",
        preload: "true",
        responsive: "true",
      });

      if (initialTime > 0) {
        params.set("t", Math.floor(initialTime).toString());
      }

      setEmbedUrl(
        `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?${params.toString()}`
      );
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [videoId, initialTime]);

  // Listen for postMessage events from Bunny player
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from Bunny's iframe
      if (
        !event.origin.includes("mediadelivery.net") &&
        !event.origin.includes("bunnycdn")
      ) {
        return;
      }

      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;

        // Bunny player events
        if (data.event === "videoProgress" || data.event === "timeupdate") {
          const currentTime = data.data?.currentTime ?? data.data?.seconds;
          const duration = data.data?.duration;
          const progress = data.data?.progress ?? data.data?.percent;

          if (onTimeUpdate && typeof currentTime === "number") {
            onTimeUpdate(Math.floor(currentTime));
          }

          if (onProgress && typeof progress === "number") {
            onProgress(progress * 100);
          } else if (
            onProgress &&
            typeof currentTime === "number" &&
            typeof duration === "number" &&
            duration > 0
          ) {
            onProgress((currentTime / duration) * 100);
          }
        }

        if (data.event === "videoEnd" || data.event === "ended") {
          onEnded?.();
        }

        if (data.event === "ready" || data.event === "videoReady") {
          setIsLoading(false);
          setError(null);
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onEnded, onProgress, onTimeUpdate]);

  const handleIframeLoad = useCallback(() => {
    // Give Bunny player a moment to initialize
    setTimeout(() => setIsLoading(false), 1500);
  }, []);

  const handleIframeError = useCallback(() => {
    setError("Failed to load video player.");
    setIsLoading(false);
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    if (iframeRef.current && embedUrl) {
      iframeRef.current.src = embedUrl;
    }
  }, [embedUrl]);

  if (error) {
    return (
      <div
        className="relative w-full overflow-hidden rounded-lg border border-border bg-muted"
        style={{ aspectRatio: "16 / 9" }}
      >
        <div className="absolute inset-0 grid place-items-center bg-background/80 backdrop-blur-sm">
          <div className="max-w-md rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Video error</p>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full overflow-hidden bg-black"
      style={{ aspectRatio: "16 / 9" }}
    >
      {embedUrl && (
        <iframe
          ref={iframeRef}
          src={embedUrl}
          className="absolute inset-0 h-full w-full"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          title={title || "Video player"}
          loading="lazy"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 grid place-items-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              Loading video...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BunnyVideoEmbed;
