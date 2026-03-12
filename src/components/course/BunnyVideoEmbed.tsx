import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

interface BunnyVideoEmbedProps {
  videoUrl: string;
  title?: string;
  onEnded?: () => void;
  onProgress?: (progress: number) => void;
  onTimeUpdate?: (timeSeconds: number) => void;
  initialTime?: number;
  isPreview?: boolean;
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

  // Try bunny-embed first (public, no auth required — avoids 401 on expired sessions)
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
  } catch (err) {
    console.warn("[BunnyVideoEmbed] bunny-embed failed:", err);
  }

  // Fallback: try bunny-stream function (authenticated)
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

  return null;
};

const BunnyVideoEmbed: React.FC<BunnyVideoEmbedProps> = ({
  videoUrl,
  title,
  onEnded,
  onProgress,
  onTimeUpdate,
  initialTime = 0,
  isPreview = false,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  // Fallback refs for reliable end detection
  const progressRef = useRef<number>(0);
  const durationRef = useRef<number | null>(null);
  const endedCalledRef = useRef(false);
  const endedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onEndedRef = useRef(onEnded);
  const onProgressRef = useRef(onProgress);
  const onTimeUpdateRef = useRef(onTimeUpdate);

  // Keep callback refs fresh
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);
  useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; }, [onTimeUpdate]);

  // Reset refs when video changes
  useEffect(() => {
    progressRef.current = 0;
    durationRef.current = null;
    endedCalledRef.current = false;

    if (endedTimeoutRef.current) {
      clearTimeout(endedTimeoutRef.current);
      endedTimeoutRef.current = null;
    }

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, [videoUrl]);

  const fireOnEnded = useCallback(() => {
    if (endedCalledRef.current) return;
    endedCalledRef.current = true;

    if (endedTimeoutRef.current) {
      clearTimeout(endedTimeoutRef.current);
      endedTimeoutRef.current = null;
    }

    onEndedRef.current?.();
  }, []);

  const updatePlaybackState = useCallback((params: {
    currentTime?: number;
    duration?: number;
    progress?: number;
  }) => {
    const { currentTime, duration, progress } = params;

    if (typeof currentTime === "number" && Number.isFinite(currentTime)) {
      onTimeUpdateRef.current?.(Math.floor(Math.max(0, currentTime)));
    }

    if (typeof duration === "number" && Number.isFinite(duration) && duration > 0) {
      durationRef.current = duration;
    }

    let computedProgress: number | null = null;

    if (typeof progress === "number" && Number.isFinite(progress)) {
      computedProgress = progress <= 1 ? progress * 100 : progress;
    } else if (
      typeof currentTime === "number" &&
      Number.isFinite(currentTime) &&
      typeof durationRef.current === "number" &&
      durationRef.current > 0
    ) {
      computedProgress = (currentTime / durationRef.current) * 100;
    }

    if (computedProgress === null) return;

    const clampedProgress = Math.max(0, Math.min(100, computedProgress));
    progressRef.current = clampedProgress;
    onProgressRef.current?.(clampedProgress);

    if (clampedProgress >= 95 && !endedCalledRef.current && !endedTimeoutRef.current) {
      endedTimeoutRef.current = setTimeout(() => {
        fireOnEnded();
      }, 3000);
    } else if (clampedProgress < 95 && endedTimeoutRef.current) {
      clearTimeout(endedTimeoutRef.current);
      endedTimeoutRef.current = null;
    }

    if (
      typeof currentTime === "number" &&
      typeof durationRef.current === "number" &&
      durationRef.current - currentTime <= 1
    ) {
      fireOnEnded();
    }
  }, [fireOnEnded]);

  const requestPlaybackSnapshot = useCallback(() => {
    const targetWindow = iframeRef.current?.contentWindow;
    if (!targetWindow) return;

    const requests: Array<Record<string, string> | string> = [
      { method: "getCurrentTime" },
      { method: "getDuration" },
      { event: "getCurrentTime" },
      { event: "getDuration" },
      { type: "getCurrentTime" },
      { type: "getDuration" },
      "getCurrentTime",
      "getDuration",
    ];

    requests.forEach((request) => {
      targetWindow.postMessage(request, "*");
    });
  }, []);

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
      try {
        const raw = event.data;
        const data =
          typeof raw === "string" ? JSON.parse(raw) : raw;

        if (!data || typeof data !== "object") return;

        // Debug: log ALL parsed messages from iframe
        console.log("[BunnyEmbed] postMessage received:", JSON.stringify(data).slice(0, 300), "origin:", event.origin);

        const record = data as Record<string, unknown>;
        const payload =
          record.data && typeof record.data === "object"
            ? (record.data as Record<string, unknown>)
            : {};

        const eventName =
          typeof record.event === "string" ? record.event.toLowerCase() : "";
        const methodName =
          typeof record.method === "string" ? record.method : "";

        let currentTime =
          typeof payload.currentTime === "number"
            ? payload.currentTime
            : typeof payload.seconds === "number"
              ? payload.seconds
              : typeof payload.time === "number"
                ? payload.time
                : typeof record.currentTime === "number"
                  ? record.currentTime
                  : typeof record.seconds === "number"
                    ? record.seconds
                    : typeof record.time === "number"
                      ? record.time
                      : undefined;

        let duration =
          typeof payload.duration === "number"
            ? payload.duration
            : typeof record.duration === "number"
              ? record.duration
              : undefined;

        let progress =
          typeof payload.progress === "number"
            ? payload.progress
            : typeof payload.percent === "number"
              ? payload.percent
              : typeof record.progress === "number"
                ? record.progress
                : typeof record.percent === "number"
                  ? record.percent
                  : undefined;

        if (methodName === "getCurrentTime" && typeof record.value === "number") {
          currentTime = record.value;
        }

        if (methodName === "getDuration" && typeof record.value === "number") {
          duration = record.value;
        }

        if (eventName === "videoend" || eventName === "ended") {
          fireOnEnded();
          return;
        }

        if (eventName === "ready" || eventName === "videoready") {
          setIsLoading(false);
          setError(null);
          requestPlaybackSnapshot();
        }

        const hasTimingData =
          typeof currentTime === "number" ||
          typeof duration === "number" ||
          typeof progress === "number";

        const isProgressEvent = ["videoprogress", "timeupdate", "progress"].includes(eventName);
        const isMethodResponse = methodName === "getCurrentTime" || methodName === "getDuration";

        if (hasTimingData && (isProgressEvent || isMethodResponse || !eventName)) {
          updatePlaybackState({ currentTime, duration, progress });
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [fireOnEnded, requestPlaybackSnapshot, updatePlaybackState]);

  const handleIframeLoad = useCallback(() => {
    // Give Bunny player a moment to initialize
    setTimeout(() => setIsLoading(false), 1500);

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    requestPlaybackSnapshot();
    pollIntervalRef.current = setInterval(() => {
      requestPlaybackSnapshot();
    }, 2000);
  }, [requestPlaybackSnapshot]);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
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

  // Prevent right-click and content stealing
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  }, []);

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
      className="relative w-full overflow-hidden select-none"
      style={{ aspectRatio: "16 / 9" }}
      onContextMenu={handleContextMenu}
      onDragStart={(e) => e.preventDefault()}
    >
      {embedUrl && (
        <iframe
          ref={iframeRef}
          src={embedUrl}
          className="absolute inset-0 h-full w-full pointer-events-auto"
          frameBorder="0"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          title={title || "Video player"}
          loading="lazy"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      )}

      {/* Transparent overlay to block right-click on iframe */}
      <div 
        className="absolute inset-0 z-10 pointer-events-none"
        onContextMenu={handleContextMenu}
      />

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 grid place-items-center bg-background/80 backdrop-blur-sm z-20">
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
