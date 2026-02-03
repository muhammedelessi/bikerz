import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { AlertCircle, Play } from "lucide-react";

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

  /** If true, we DO NOT autoplay with sound (browser policy). We show an explicit Play overlay instead. */
  autoPlay?: boolean;

  /** Kept for compatibility with existing callers; unused by the native-controls player. */
  qualities?: VideoQuality[];
  chapters?: ChapterMarker[];

  /** Seconds to restore after metadata loads (e.g. resume). */
  initialTime?: number;
}

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
      return "Video format or stream type is not supported in this browser.";
    default:
      return "Failed to load video.";
  }
};

/**
 * Production-grade, native-controls HTML5 video player.
 * - Never forces muted playback.
 * - Handles autoplay policy by requiring a user click if autoPlay is requested.
 * - Supports adaptive HLS (.m3u8) via hls.js on browsers without native HLS.
 */
const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  poster,
  title,
  onEnded,
  onProgress,
  onTimeUpdate,
  autoPlay = false,
  initialTime = 0,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastSavedTimeRef = useRef<number>(0);
  const restoredRef = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [needsUserGesture, setNeedsUserGesture] = useState<boolean>(autoPlay);
  const [audioDetected, setAudioDetected] = useState<boolean | null>(null);

  const shouldUseHls = useMemo(() => isHlsUrl(src), [src]);

  const cleanupHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  const detectAudioBestEffort = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // Best-effort heuristics (not standardized across browsers)
    const anyVideo = video as any;
    const audioTracksLen = typeof anyVideo.audioTracks?.length === "number" ? (anyVideo.audioTracks.length as number) : null;
    const mozHasAudio = typeof anyVideo.mozHasAudio === "boolean" ? (anyVideo.mozHasAudio as boolean) : null;
    const webkitDecodedBytes =
      typeof anyVideo.webkitAudioDecodedByteCount === "number" ? (anyVideo.webkitAudioDecodedByteCount as number) : null;

    if (audioTracksLen !== null) {
      setAudioDetected(audioTracksLen > 0);
      return;
    }

    if (mozHasAudio !== null) {
      setAudioDetected(mozHasAudio);
      return;
    }

    if (webkitDecodedBytes !== null) {
      setAudioDetected(webkitDecodedBytes > 0);
      return;
    }
  }, []);

  const requestPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    setError(null);

    // Enforce: never autoplay muted / never force mute.
    video.muted = false;
    // Keep existing volume if user changed it; otherwise ensure it's audible.
    if (!Number.isFinite(video.volume) || video.volume === 0) video.volume = 1;

    try {
      await video.play();
      setNeedsUserGesture(false);
      detectAudioBestEffort();
      // Some browsers update audio stats after a brief playback.
      window.setTimeout(detectAudioBestEffort, 800);
    } catch (e: any) {
      // Browser policy: play() must be initiated by user gesture.
      if (e?.name === "NotAllowedError") {
        setNeedsUserGesture(true);
        return;
      }
      setError("Playback failed. Please try again.");
    }
  }, [detectAudioBestEffort]);

  // Setup source (HLS or direct)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setError(null);
    setAudioDetected(null);
    restoredRef.current = false;
    lastSavedTimeRef.current = 0;

    cleanupHls();

    // Ensure we don't start muted.
    video.muted = false;
    if (!Number.isFinite(video.volume) || video.volume === 0) video.volume = 1;

    const canNativeHls = video.canPlayType("application/vnd.apple.mpegurl") !== "";

    // Always hard-reset the element when source changes (avoids stale buffering / muted state).
    video.pause();
    video.removeAttribute("src");
    video.load();

    if (shouldUseHls && !canNativeHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        backBufferLength: 90,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (!data.fatal) return;
        // Surface a clear error instead of silently failing.
        setError("Adaptive stream failed to load. Please retry or use a different browser.");
      });
    } else {
      // Direct MP4/WebM or native-HLS Safari
      video.src = src;
      video.load();
    }

    // If autoPlay is requested, we still require an explicit gesture for sound playback.
    setNeedsUserGesture(autoPlay);

    return () => {
      cleanupHls();
    };
  }, [src, autoPlay, shouldUseHls, cleanupHls]);

  // Wire native events for progress + errors + restore time
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoadedMetadataInternal = () => {
      // Restore watch position once
      if (restoredRef.current) return;
      restoredRef.current = true;

      const dur = video.duration;
      if (!Number.isFinite(dur) || dur <= 0) return;

      if (initialTime > 0 && Number.isFinite(initialTime)) {
        const isNearEnd = initialTime >= dur - 10;
        if (!isNearEnd) {
          video.currentTime = Math.min(initialTime, dur);
        }
      }

      detectAudioBestEffort();
    };

    const onTimeUpdateInternal = () => {
      const t = video.currentTime;
      const d = video.duration;
      if (!Number.isFinite(t) || !Number.isFinite(d) || d <= 0) return;

      if (onProgress) onProgress((t / d) * 100);

      if (onTimeUpdate && Math.abs(t - lastSavedTimeRef.current) >= 5) {
        lastSavedTimeRef.current = t;
        onTimeUpdate(Math.floor(t));
      }
    };

    const onEndedInternal = () => onEnded?.();

    const onPlayInternal = () => {
      // If user uses native controls to start playback, hide the gesture overlay.
      setNeedsUserGesture(false);
      detectAudioBestEffort();
      window.setTimeout(detectAudioBestEffort, 800);
    };

    const onErrorInternal = () => {
      setError(getFriendlyMediaError(video.error));
    };

    video.addEventListener("loadedmetadata", onLoadedMetadataInternal);
    video.addEventListener("timeupdate", onTimeUpdateInternal);
    video.addEventListener("ended", onEndedInternal);
    video.addEventListener("play", onPlayInternal);
    video.addEventListener("error", onErrorInternal);

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadataInternal);
      video.removeEventListener("timeupdate", onTimeUpdateInternal);
      video.removeEventListener("ended", onEndedInternal);
      video.removeEventListener("play", onPlayInternal);
      video.removeEventListener("error", onErrorInternal);
    };
  }, [initialTime, onEnded, onProgress, onTimeUpdate, detectAudioBestEffort]);

  return (
    <div className="relative w-full aspect-video overflow-hidden rounded-lg border border-border bg-muted">
      {/* CRITICAL: volume={1} + muted={false} ensures audio plays */}
      <video
        ref={videoRef}
        className="h-full w-full"
        poster={poster}
        controls
        playsInline
        preload="metadata"
        aria-label={title || "Video player"}
        // Explicit defaults to GUARANTEE audio is not suppressed
        // @ts-ignore - volume and muted are valid attributes
        volume={1}
        muted={false}
      />

      {/* Explicit user gesture (required for sound in many browsers if autoplay is requested) */}
      {needsUserGesture && !error && (
        <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-sm">
          <button
            type="button"
            onClick={requestPlay}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-primary-foreground shadow-sm transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Play"
          >
            <Play className="h-5 w-5" />
            <span className="font-medium">Play</span>
          </button>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 grid place-items-center bg-background/80 backdrop-blur-sm">
          <div className="max-w-md rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
              <div>
                <p className="text-sm font-medium">Video error</p>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const v = videoRef.current;
                      if (!v) return;
                      setError(null);
                      v.load();
                    }}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
                  >
                    Retry
                  </button>
                  {shouldUseHls && (
                    <button
                      type="button"
                      onClick={() => {
                        // A hard reset helps recover some streaming failures.
                        cleanupHls();
                        const v = videoRef.current;
                        if (!v) return;
                        setError(null);
                        v.src = src;
                        v.load();
                      }}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
                    >
                      Reload stream
                    </button>
                  )}
                </div>

                {audioDetected === false && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    This video appears to have no audio track.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
