import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2, Play } from "lucide-react";

export interface VideoQuality {
  label: string;
  value: string;
  src?: string;
}

export interface ChapterMarker {
  id: string;
  title: string;
  titleAr?: string;
  startTime: number;
  endTime?: number;
  thumbnail?: string;
}

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  onEnded?: () => void;
  onProgress?: (progress: number) => void;
  onTimeUpdate?: (timeSeconds: number) => void;

  /** Kept for compatibility with existing callers; this player never autoplays with sound. */
  autoPlay?: boolean;

  /** Kept for compatibility with existing callers; unused by this native player. */
  qualities?: VideoQuality[];
  chapters?: ChapterMarker[];

  /** Seconds to restore after metadata loads (e.g. resume). */
  initialTime?: number;
}

const VOLUME_KEY = "video_player:volume";
const MUTED_KEY = "video_player:muted";

const isHlsUrl = (url: string) => /\.m3u8($|\?)/i.test(url);

const getFriendlyMediaError = (err: MediaError | null) => {
  if (!err) return "Failed to load video.";
  switch (err.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return "Video loading was aborted.";
    case MediaError.MEDIA_ERR_NETWORK:
      return "Network error while loading the video.";
    case MediaError.MEDIA_ERR_DECODE:
      return "Video could not be decoded (corrupt or unsupported).";
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return "Video format is not supported in this browser.";
    default:
      return "Failed to load video.";
  }
};

const inferMimeType = (url: string): string | undefined => {
  try {
    const pathname = new URL(url, window.location.href).pathname.toLowerCase();
    if (pathname.endsWith(".mp4")) return "video/mp4";
    if (pathname.endsWith(".webm")) return "video/webm";
    if (pathname.endsWith(".ogg") || pathname.endsWith(".ogv")) return "video/ogg";
    if (pathname.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
    return undefined;
  } catch {
    const lower = url.toLowerCase();
    if (lower.includes(".mp4")) return "video/mp4";
    if (lower.includes(".webm")) return "video/webm";
    if (lower.includes(".m3u8")) return "application/vnd.apple.mpegurl";
    return undefined;
  }
};

const detectAudioBestEffort = (video: HTMLVideoElement): boolean | null => {
  const anyVideo = video as any;

  const audioTracksLen = typeof anyVideo.audioTracks?.length === "number" ? (anyVideo.audioTracks.length as number) : null;
  if (audioTracksLen !== null) return audioTracksLen > 0;

  const mozHasAudio = typeof anyVideo.mozHasAudio === "boolean" ? (anyVideo.mozHasAudio as boolean) : null;
  if (mozHasAudio !== null) return mozHasAudio;

  const webkitDecodedBytes =
    typeof anyVideo.webkitAudioDecodedByteCount === "number" ? (anyVideo.webkitAudioDecodedByteCount as number) : null;
  if (webkitDecodedBytes !== null) return webkitDecodedBytes > 0;

  return null;
};

/**
 * Bulletproof native HTML5 player:
 * - ONLY uses <video> + native controls (no custom playback pipeline)
 * - Requires explicit user gesture to start playback (no autoplay-with-sound)
 * - Persists volume/mute across sessions
 * - Shows buffering + clear, non-silent errors
 */
const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  poster,
  title,
  onEnded,
  onProgress,
  onTimeUpdate,
  initialTime = 0,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const restoredRef = useRef(false);
  const lastReportedTimeRef = useRef(0);

  const [showStartOverlay, setShowStartOverlay] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioDetected, setAudioDetected] = useState<boolean | null>(null);

  const mimeType = useMemo(() => inferMimeType(src), [src]);
  const isHls = useMemo(() => isHlsUrl(src), [src]);

  const applyPersistedAudioSettings = useCallback((video: HTMLVideoElement) => {
    // Default: audible.
    const rawVol = localStorage.getItem(VOLUME_KEY);
    const vol = rawVol ? Number(rawVol) : NaN;
    video.volume = Number.isFinite(vol) && vol >= 0 && vol <= 1 ? vol : 0.8;

    const rawMuted = localStorage.getItem(MUTED_KEY);
    // Only honor persisted muted if explicitly set before.
    if (rawMuted === "true" || rawMuted === "false") {
      video.muted = rawMuted === "true";
    } else {
      video.muted = false;
    }

    // Guard: never start silent unless user explicitly muted.
    if (!video.muted && video.volume === 0) video.volume = 0.8;
  }, []);

  const requestPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    setError(null);
    setIsBuffering(false);

    // Ensure our defaults/persistence are applied before first play.
    applyPersistedAudioSettings(video);

    try {
      await video.play();
      setShowStartOverlay(false);
      const detectedNow = detectAudioBestEffort(video);
      setAudioDetected(detectedNow);
      window.setTimeout(() => {
        const detectedLater = detectAudioBestEffort(video);
        if (detectedLater !== null) setAudioDetected(detectedLater);
      }, 900);
    } catch (e: any) {
      // Most common: autoplay policy / gesture requirements.
      if (e?.name === "NotAllowedError") {
        setError("Click Play to start video with sound.");
        setShowStartOverlay(true);
        return;
      }
      console.error("Video play() failed", { src, error: e });
      setError("Playback failed. Please try again.");
      setShowStartOverlay(true);
    }
  }, [applyPersistedAudioSettings, src]);

  // Hard reset UI state on source changes.
  useEffect(() => {
    restoredRef.current = false;
    lastReportedTimeRef.current = 0;
    setShowStartOverlay(true);
    setIsBuffering(false);
    setError(null);
    setAudioDetected(null);
  }, [src]);

  // Wire native events (single source of truth).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // If this is HLS and the browser doesn't support native HLS, fail loudly.
    if (isHls) {
      const canNativeHls = video.canPlayType("application/vnd.apple.mpegurl") !== "";
      if (!canNativeHls) {
        setError("This HLS stream is not supported in this browser. Please use an MP4/WebM upload or open in Safari.");
      }
    }

    applyPersistedAudioSettings(video);

    const onLoadStart = () => setIsBuffering(true);
    const onCanPlay = () => setIsBuffering(false);
    const onPlaying = () => setIsBuffering(false);
    const onWaiting = () => setIsBuffering(true);
    const onStalled = () => setIsBuffering(true);

    const onLoadedMetadata = () => {
      // Restore watch position once.
      if (restoredRef.current) return;
      restoredRef.current = true;

      const dur = video.duration;
      if (Number.isFinite(dur) && dur > 0 && Number.isFinite(initialTime) && initialTime > 0) {
        // Avoid restoring right at the end.
        const safeTime = Math.min(Math.max(0, initialTime), Math.max(0, dur - 1));
        if (safeTime < dur - 2) {
          try {
            video.currentTime = safeTime;
          } catch {
            // ignore seek errors
          }
        }
      }

      const detected = detectAudioBestEffort(video);
      setAudioDetected(detected);
    };

    const onTimeUpdateInternal = () => {
      const t = video.currentTime;
      const d = video.duration;
      if (!Number.isFinite(t) || !Number.isFinite(d) || d <= 0) return;

      onProgress?.((t / d) * 100);

      if (onTimeUpdate && Math.abs(t - lastReportedTimeRef.current) >= 5) {
        lastReportedTimeRef.current = t;
        onTimeUpdate(Math.floor(t));
      }
    };

    const onVolumeChange = () => {
      // Persist only what the user actually chose.
      try {
        localStorage.setItem(VOLUME_KEY, String(video.volume));
        localStorage.setItem(MUTED_KEY, String(video.muted));
      } catch {
        // ignore storage errors
      }
    };

    const onErrorInternal = () => {
      const msg = getFriendlyMediaError(video.error);
      console.error("Video element error", {
        src,
        code: video.error?.code,
        message: msg,
      });
      setError(msg);
      setIsBuffering(false);
      setShowStartOverlay(true);
    };

    const onEndedInternal = () => onEnded?.();

    // If the user starts playback via native controls (keyboard/tap on controls), hide overlay.
    const onPlayInternal = () => setShowStartOverlay(false);
    const onPauseInternal = () => {
      // Don’t re-cover the native controls after the user has interacted.
      // (Native controls already include a play button.)
    };

    video.addEventListener("loadstart", onLoadStart);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("stalled", onStalled);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("timeupdate", onTimeUpdateInternal);
    video.addEventListener("volumechange", onVolumeChange);
    video.addEventListener("error", onErrorInternal);
    video.addEventListener("ended", onEndedInternal);
    video.addEventListener("play", onPlayInternal);
    video.addEventListener("pause", onPauseInternal);

    return () => {
      video.removeEventListener("loadstart", onLoadStart);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("stalled", onStalled);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("timeupdate", onTimeUpdateInternal);
      video.removeEventListener("volumechange", onVolumeChange);
      video.removeEventListener("error", onErrorInternal);
      video.removeEventListener("ended", onEndedInternal);
      video.removeEventListener("play", onPlayInternal);
      video.removeEventListener("pause", onPauseInternal);
    };
  }, [applyPersistedAudioSettings, initialTime, isHls, onEnded, onProgress, onTimeUpdate, src]);

  return (
    <div className="relative w-full aspect-video overflow-hidden rounded-lg border border-border bg-muted">
      <video
        // Key forces a real element reset between sources (prevents stale state).
        key={src}
        ref={videoRef}
        className="h-full w-full"
        poster={poster}
        controls
        playsInline
        preload="metadata"
        aria-label={title || "Video player"}
      >
        {/* Setting a <source type> helps browsers choose the correct decoder pipeline. */}
        <source src={src} type={mimeType} />
      </video>

      {/* Buffering indicator (never blocks controls) */}
      {isBuffering && !error && (
        <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-2 rounded-md bg-background/70 px-3 py-2 text-sm text-foreground backdrop-blur-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading…</span>
        </div>
      )}

      {/* Explicit user-gesture play (no autoplay-with-sound). */}
      {showStartOverlay && !error && (
        <div className="absolute inset-0 grid place-items-center bg-background/35 backdrop-blur-[2px]">
          <button
            type="button"
            onClick={requestPlay}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-primary-foreground shadow-sm transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Play video"
          >
            <Play className="h-5 w-5" />
            <span className="font-medium">Play</span>
          </button>
        </div>
      )}

      {/* Error UI (never silent) */}
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-background/80 backdrop-blur-sm">
          <div className="max-w-md rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Video error</p>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const v = videoRef.current;
                      if (!v) return;
                      setError(null);
                      setIsBuffering(true);
                      v.load();
                    }}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transparent, explicit “no audio” warning (best-effort detection) */}
      {audioDetected === false && !error && (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3">
          <div className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm text-foreground backdrop-blur-sm">
            This video appears to have no audio track.
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
