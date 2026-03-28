import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface BunnyVideoEmbedProps {
  videoUrl: string;
  title?: string;
  onEnded?: () => void;
  onProgress?: (progress: number) => void;
  onTimeUpdate?: (timeSeconds: number) => void;
  initialTime?: number;
  isPreview?: boolean;
  autoPlay?: boolean;
  lessonId?: string;
  courseId?: string;
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

let cachedLibraryId: string | null = null;

const fetchLibraryId = async (videoId: string): Promise<string | null> => {
  if (cachedLibraryId) return cachedLibraryId;

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

// ── Watch Behavior Tracker ──

interface SkippedSegment { from: number; to: number }
interface RewatchedSegment { from: number; to: number; count: number }

interface WatchBehaviorState {
  watchedIntervals: [number, number][]; // merged intervals of actually watched seconds
  skippedSegments: SkippedSegment[];
  rewatchedSegments: RewatchedSegment[];
  lastPosition: number;
  videoDuration: number;
}

const mergeInterval = (intervals: [number, number][], start: number, end: number): [number, number][] => {
  if (start >= end) return intervals;
  const newIntervals = [...intervals, [start, end] as [number, number]];
  newIntervals.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [newIntervals[0]];
  for (let i = 1; i < newIntervals.length; i++) {
    const last = merged[merged.length - 1];
    if (newIntervals[i][0] <= last[1] + 1) {
      last[1] = Math.max(last[1], newIntervals[i][1]);
    } else {
      merged.push(newIntervals[i]);
    }
  }
  return merged;
};

const computeTotalWatched = (intervals: [number, number][]): number => {
  return intervals.reduce((sum, [a, b]) => sum + (b - a), 0);
};

const computeCompletion = (intervals: [number, number][], duration: number): number => {
  if (duration <= 0) return 0;
  const watched = computeTotalWatched(intervals);
  return Math.min(100, Math.round((watched / duration) * 100));
};

const SAVE_INTERVAL_MS = 5000;

const BunnyVideoEmbed: React.FC<BunnyVideoEmbedProps> = ({
  videoUrl,
  title,
  onEnded,
  onProgress,
  onTimeUpdate,
  initialTime = 0,
  isPreview = false,
  autoPlay = false,
  lessonId,
  courseId,
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
  const iframeLoadFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerReadyRef = useRef(false);

  // ── Watch behavior tracking refs ──
  const behaviorRef = useRef<WatchBehaviorState>({
    watchedIntervals: [],
    skippedSegments: [],
    rewatchedSegments: [],
    lastPosition: 0,
    videoDuration: 0,
  });
  const prevTimeRef = useRef<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const behaviorDirtyRef = useRef(false);
  const trackingEnabledRef = useRef(!!lessonId && !!courseId);
  const watchSessionIdRef = useRef<string>(crypto.randomUUID());
  const startedAtRef = useRef<string>(new Date().toISOString());

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  // ── Behavior: detect skip/rewatch on each time update ──
  const trackTimeChange = useCallback((currentTime: number, duration: number) => {
    if (!trackingEnabledRef.current) return;
    const b = behaviorRef.current;
    b.videoDuration = duration;
    const prev = prevTimeRef.current;
    const ct = Math.floor(currentTime);

    if (prev !== null) {
      const delta = ct - prev;

      if (delta > 0 && delta <= 3) {
        // Normal playback – record watched interval
        b.watchedIntervals = mergeInterval(b.watchedIntervals, prev, ct);
      } else if (delta > 3) {
        // Forward skip
        b.skippedSegments.push({ from: prev, to: ct });
      } else if (delta < -1) {
        // Rewind – check if segment already tracked
        const existing = b.rewatchedSegments.find(
          (s) => Math.abs(s.from - ct) < 3 && Math.abs(s.to - prev) < 3
        );
        if (existing) {
          existing.count += 1;
        } else {
          b.rewatchedSegments.push({ from: ct, to: prev, count: 1 });
        }
      }
    }

    b.lastPosition = ct;
    prevTimeRef.current = ct;
    behaviorDirtyRef.current = true;
  }, []);

  // ── Save behavior to DB ──
  const saveBehavior = useCallback(async () => {
    if (!trackingEnabledRef.current || !behaviorDirtyRef.current) return;
    if (!lessonId || !courseId) return;
    behaviorDirtyRef.current = false;

    const b = behaviorRef.current;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Save aggregated behavior (per user+lesson, merged across all sessions)
      await supabase.from("video_watch_behavior" as any).upsert({
        user_id: user.id,
        lesson_id: lessonId,
        course_id: courseId,
        total_watched_seconds: computeTotalWatched(b.watchedIntervals),
        skipped_segments: b.skippedSegments,
        rewatched_segments: b.rewatchedSegments,
        last_position_seconds: b.lastPosition,
        video_duration_seconds: Math.floor(b.videoDuration),
        completion_percentage: computeCompletion(b.watchedIntervals, b.videoDuration),
        updated_at: new Date().toISOString(),
      } as any, { onConflict: "user_id,lesson_id" } as any);

      // Session-based tracking with IP capture via Edge Function
      await supabase.functions.invoke("video-tracking", {
        body: {
          lessonId,
          courseId,
          sessionId: watchSessionIdRef.current,
          startedAt: startedAtRef.current,
          skippedSegments: b.skippedSegments,
          rewatchedSegments: b.rewatchedSegments,
          watchData: {
            totalWatchedSeconds: computeTotalWatched(b.watchedIntervals),
            videoDuration: Math.floor(b.videoDuration),
            lastPosition: b.lastPosition,
            completionPercentage: computeCompletion(b.watchedIntervals, b.videoDuration),
          },
        },
      });
    } catch (err) {
      console.warn("[BunnyVideoEmbed] Failed to save watch behavior:", err);
    }
  }, [lessonId, courseId]);

  // ── Periodic save timer ──
  useEffect(() => {
    if (!trackingEnabledRef.current) return;
    saveTimerRef.current = setInterval(saveBehavior, SAVE_INTERVAL_MS);
    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
      // Save on unmount
      saveBehavior();
    };
  }, [saveBehavior]);

  // ── Load existing behavior on mount ──
  useEffect(() => {
    if (!lessonId || !courseId) return;
    trackingEnabledRef.current = true;

    const loadExisting = async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from("video_watch_behavior" as any)
          .select("*")
          .eq("user_id", user.id)
          .eq("lesson_id", lessonId)
          .maybeSingle();

        if (data) {
          const d = data as any;
          behaviorRef.current = {
            watchedIntervals: [], // Start fresh intervals for this session, total will merge
            skippedSegments: Array.isArray(d.skipped_segments) ? d.skipped_segments : [],
            rewatchedSegments: Array.isArray(d.rewatched_segments) ? d.rewatched_segments : [],
            lastPosition: d.last_position_seconds || 0,
            videoDuration: d.video_duration_seconds || 0,
          };
        }
      } catch {
        // ignore
      }
    };
    loadExisting();
  }, [lessonId, courseId]);

  const clearTimers = useCallback(() => {
    if (endedTimeoutRef.current) {
      clearTimeout(endedTimeoutRef.current);
      endedTimeoutRef.current = null;
    }

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (iframeLoadFallbackRef.current) {
      clearTimeout(iframeLoadFallbackRef.current);
      iframeLoadFallbackRef.current = null;
    }
  }, []);

  const fireOnEnded = useCallback(() => {
    if (endedCalledRef.current) return;
    endedCalledRef.current = true;
    clearTimers();
    // Final save on ended
    saveBehavior();
    onEndedRef.current?.();
  }, [clearTimers, saveBehavior]);

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

      // Track watch behavior
      if (typeof currentTime === "number" && Number.isFinite(currentTime)) {
        const dur = durationRef.current || 0;
        if (dur > 0) {
          trackTimeChange(currentTime, dur);
        }
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
    [fireOnEnded, trackTimeChange]
  );

  const videoId = useMemo(() => extractBunnyVideoId(videoUrl), [videoUrl]);

  // Reset internal tracking when lesson/video changes
  useEffect(() => {
    endedCalledRef.current = false;
    playerReadyRef.current = false;
    durationRef.current = null;
    progressRef.current = 0;
    prevTimeRef.current = null;
    watchSessionIdRef.current = crypto.randomUUID();
    startedAtRef.current = new Date().toISOString();
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

    if (isPreview) {
      iframeLoadFallbackRef.current = setTimeout(() => {
        if (!playerReadyRef.current) {
          setIsLoading(false);
        }
      }, 4000);

      return () => {
        clearTimers();
      };
    }

    let cancelled = false;
    let player: PlayerJsInstance | null = null;

    iframeLoadFallbackRef.current = setTimeout(() => {
      if (!cancelled && !playerReadyRef.current) {
        console.warn("[BunnyVideoEmbed] Player.js ready timeout – removing loading overlay (iOS fallback)");
        setIsLoading(false);
      }
    }, 8000);

    const setupPlayer = async () => {
      try {
        await loadPlayerJs();
        if (cancelled || !iframeRef.current || !window.playerjs?.Player) return;

        player = new window.playerjs.Player(iframeRef.current);

        const handleReady = () => {
          if (cancelled || !player) return;

          playerReadyRef.current = true;
          setError(null);
          setIsLoading(false);

          if (iframeLoadFallbackRef.current) {
            clearTimeout(iframeLoadFallbackRef.current);
            iframeLoadFallbackRef.current = null;
          }

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
  }, [embedUrl, initialTime, updatePlaybackState, fireOnEnded, clearTimers, isPreview]);

  const handleIframeLoad = useCallback(() => {
    if (isPreview) {
      playerReadyRef.current = true;
      setIsLoading(false);
      return;
    }

    setTimeout(() => {
      if (!playerReadyRef.current) {
        console.warn("[BunnyVideoEmbed] iframe loaded but Player.js not ready – clearing spinner");
        setIsLoading(false);
      }
    }, 3000);
  }, [isPreview]);

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
          onLoad={handleIframeLoad}
        />
      )}

      <div
        className="absolute inset-0 z-10 pointer-events-none"
        onContextMenu={handleContextMenu}
      />

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
