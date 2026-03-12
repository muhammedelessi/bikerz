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
  autoPlay?: boolean;
}

type PlayerJsPayload = Record<string, unknown> | string | number | null | undefined;

interface PlayerJsInstance {
  on: (eventName: string, callback: (payload?: PlayerJsPayload) => void) => void;
  off: (eventName: string, callback?: (payload?: PlayerJsPayload) => void) => void;
  getCurrentTime: (callback: (value: number) => void) => void;
  getDuration: (callback: (value: number) => void) => void;
  setCurrentTime: (seconds: number) => void;
}

declare global {
  interface Window {
    playerjs?: {
      Player: new (target: HTMLIFrameElement | string) => PlayerJsInstance;
    };
  }
}

const PLAYER_JS_SRC = "https://assets.mediadelivery.net/playerjs/playerjs-latest.min.js";

let playerJsLoaderPromise: Promise<void> | null = null;

const loadPlayerJs = async (): Promise<void> => {
  if (typeof window === "undefined") return;
  if (window.playerjs?.Player) return;
  if (playerJsLoaderPromise) return playerJsLoaderPromise;

  playerJsLoaderPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${PLAYER_JS_SRC}"]`
    );

    if (existingScript) {
      if (window.playerjs?.Player) {
        resolve();
        return;
      }

      const onLoad = () => resolve();
      const onError = () => reject(new Error("Failed to load Bunny Player.js"));

      existingScript.addEventListener("load", onLoad, { once: true });
      existingScript.addEventListener("error", onError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = PLAYER_JS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Bunny Player.js"));
    document.head.appendChild(script);
  })
    .then(() => {
      if (!window.playerjs?.Player) {
        throw new Error("Bunny Player.js did not initialize");
      }
    })
    .catch((error) => {
      playerJsLoaderPromise = null;
      throw error;
    });

  return playerJsLoaderPromise;
};

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

const parseTimeUpdatePayload = (
  payload: PlayerJsPayload
): { currentTime?: number; duration?: number; progress?: number } => {
  let parsed = payload;

  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return {};
    }
  }

  if (typeof parsed === "number") {
    return { currentTime: parsed };
  }

  if (!parsed || typeof parsed !== "object") {
    return {};
  }

  const source = parsed as Record<string, unknown>;
  const data =
    source.data && typeof source.data === "object"
      ? (source.data as Record<string, unknown>)
      : source;

  const currentTime =
    typeof data.seconds === "number"
      ? data.seconds
      : typeof data.currentTime === "number"
        ? data.currentTime
        : typeof data.time === "number"
          ? data.time
          : undefined;

  const duration =
    typeof data.duration === "number" ? data.duration : undefined;

  const progress =
    typeof data.percent === "number"
      ? data.percent
      : typeof data.progress === "number"
        ? data.progress
        : undefined;

  return { currentTime, duration, progress };
};

const BunnyVideoEmbed: React.FC<BunnyVideoEmbedProps> = ({
  videoUrl,
  title,
  onEnded,
  onProgress,
  onTimeUpdate,
  initialTime = 0,
  isPreview = false,
  autoPlay = false,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  const onEndedRef = useRef(onEnded);
  const onProgressRef = useRef(onProgress);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const durationRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const endedCalledRef = useRef(false);
  const endedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  const clearTimers = useCallback(() => {
    if (endedTimeoutRef.current) {
      clearTimeout(endedTimeoutRef.current);
      endedTimeoutRef.current = null;
    }

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const fireOnEnded = useCallback(() => {
    if (endedCalledRef.current) return;
    endedCalledRef.current = true;
    clearTimers();
    onEndedRef.current?.();
  }, [clearTimers]);

  const updatePlaybackState = useCallback(
    ({
      currentTime,
      duration,
      progress,
    }: {
      currentTime?: number;
      duration?: number;
      progress?: number;
    }) => {
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

      if (computedProgress !== null) {
        const clamped = Math.max(0, Math.min(100, computedProgress));
        progressRef.current = clamped;
        onProgressRef.current?.(clamped);

        if (clamped >= 95 && !endedCalledRef.current && !endedTimeoutRef.current) {
          endedTimeoutRef.current = setTimeout(() => {
            fireOnEnded();
          }, 2500);
        } else if (clamped < 95 && endedTimeoutRef.current) {
          clearTimeout(endedTimeoutRef.current);
          endedTimeoutRef.current = null;
        }
      }

      if (
        typeof currentTime === "number" &&
        typeof durationRef.current === "number" &&
        durationRef.current > 0 &&
        durationRef.current - currentTime <= 1
      ) {
        fireOnEnded();
      }
    },
    [fireOnEnded]
  );

  const videoId = useMemo(() => extractBunnyVideoId(videoUrl), [videoUrl]);

  // Reset internal tracking when lesson/video changes
  useEffect(() => {
    endedCalledRef.current = false;
    durationRef.current = null;
    progressRef.current = 0;
    clearTimers();
  }, [videoUrl, clearTimers]);

  // Fetch library ID and build embed URL
  useEffect(() => {
    if (!videoId) {
      setError("Invalid video URL");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const init = async () => {
      setIsLoading(true);
      setError(null);

      const libraryId = await fetchLibraryId(videoId);
      if (cancelled) return;

      if (!libraryId) {
        setError("Could not load video configuration. Please try again.");
        setIsLoading(false);
        return;
      }

      const params = new URLSearchParams({
        autoplay: autoPlay ? "true" : "false",
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
  }, [videoId, initialTime, autoPlay]);

  // Hook Bunny Player.js events once iframe source is ready
  useEffect(() => {
    if (!embedUrl || !iframeRef.current) return;

    let cancelled = false;
    let player: PlayerJsInstance | null = null;

    const setupPlayer = async () => {
      try {
        await loadPlayerJs();
        if (cancelled || !iframeRef.current || !window.playerjs?.Player) return;

        player = new window.playerjs.Player(iframeRef.current);

        const handleReady = () => {
          if (cancelled || !player) return;

          setError(null);
          setIsLoading(false);

          if (initialTime > 0) {
            try {
              player.setCurrentTime(Math.floor(initialTime));
            } catch {
              // ignore seek failures
            }
          }

          player.getDuration((value) => {
            if (cancelled || typeof value !== "number") return;
            updatePlaybackState({ duration: value });
          });

          player.getCurrentTime((value) => {
            if (cancelled || typeof value !== "number") return;
            updatePlaybackState({ currentTime: value });
          });
        };

        const handleTimeUpdate = (payload?: PlayerJsPayload) => {
          if (cancelled) return;
          updatePlaybackState(parseTimeUpdatePayload(payload));
        };

        const handleEnded = () => {
          if (!cancelled) {
            fireOnEnded();
          }
        };

        const handleError = () => {
          if (!cancelled) {
            setError("Failed to load video player.");
            setIsLoading(false);
          }
        };

        player.on("ready", handleReady);
        player.on("timeupdate", handleTimeUpdate);
        player.on("ended", handleEnded);
        player.on("error", handleError);

        pollIntervalRef.current = setInterval(() => {
          if (!player || cancelled || endedCalledRef.current) return;

          player.getCurrentTime((value) => {
            if (cancelled || typeof value !== "number") return;
            updatePlaybackState({ currentTime: value });
          });

          player.getDuration((value) => {
            if (cancelled || typeof value !== "number") return;
            updatePlaybackState({ duration: value });
          });
        }, 2000);

        const cleanup = () => {
          if (!player) return;
          try {
            player.off("ready", handleReady);
            player.off("timeupdate", handleTimeUpdate);
            player.off("ended", handleEnded);
            player.off("error", handleError);
          } catch {
            // Ignore cleanup failures
          }
        };

        if (cancelled) {
          cleanup();
        }

        return cleanup;
      } catch (setupError) {
        console.error("[BunnyVideoEmbed] Failed to initialize Player.js:", setupError);
        if (!cancelled) {
          setError("Failed to initialize video player.");
          setIsLoading(false);
        }
      }
    };

    let teardown: (() => void) | undefined;

    setupPlayer().then((cleanup) => {
      teardown = cleanup;
    });

    return () => {
      cancelled = true;
      clearTimers();
      teardown?.();
    };
  }, [embedUrl, initialTime, updatePlaybackState, fireOnEnded, clearTimers]);

  const handleRetry = useCallback(() => {
    endedCalledRef.current = false;
    setError(null);
    setIsLoading(true);

    if (iframeRef.current && embedUrl) {
      iframeRef.current.src = embedUrl;
    }
  }, [embedUrl]);

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
            <span className="text-sm text-muted-foreground">Loading video...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BunnyVideoEmbed;

