import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ChevronDown, Loader2, Play, Settings } from "lucide-react";
import Hls from "hls.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

// Video proxy URL for bypassing CORS on Bunny Stream
const VIDEO_PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-proxy`;

const isHlsUrl = (url: string) => /\.m3u8($|\?)/i.test(url);

// Bunny Stream URL detection - matches their CDN pattern
const isBunnyStreamUrl = (url: string): boolean => {
  return /vz-[a-z0-9]+-[a-z0-9]+\.b-cdn\.net/i.test(url) ||
         /iframe\.mediadelivery\.net/i.test(url);
};

// Convert Bunny Stream URL to proxied URL to bypass CORS
const getProxiedUrl = (url: string): string => {
  if (isBunnyStreamUrl(url)) {
    return `${VIDEO_PROXY_URL}?url=${encodeURIComponent(url)}`;
  }
  return url;
};

// Native HLS is reliable on iOS + Safari. Some browsers may claim they can play HLS,
// but still fail to decode playlists; prefer hls.js everywhere else.
const isSafariOrIOS = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;

  const isIOS = /iPad|iPhone|iPod/i.test(ua);
  if (isIOS) return true;

  const isAppleWebKit = /AppleWebKit/i.test(ua);
  const isChromeLike = /Chrome|CriOS|Edg|OPR|SamsungBrowser/i.test(ua);
  const isFirefoxLike = /Firefox|FxiOS/i.test(ua);
  const isSafari = isAppleWebKit && !isChromeLike && !isFirefoxLike && /Safari/i.test(ua);

  return isSafari;
};

// Vimeo URL detection and ID extraction
const getVimeoVideoId = (url: string): string | null => {
  if (!url) return null;
  
  const patterns = [
    /vimeo\.com\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/,
    /vimeo\.com\/channels\/[\w-]+\/(\d+)/,
    /vimeo\.com\/groups\/[\w-]+\/videos\/(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
};

const isVimeoUrl = (url: string): boolean => {
  return getVimeoVideoId(url) !== null;
};

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
 * Vimeo Player Component
 * Uses Vimeo's iframe embed for playback
 */
const VimeoPlayer: React.FC<{
  videoId: string;
  title?: string;
  autoPlay?: boolean;
  initialTime?: number;
  onEnded?: () => void;
  onProgress?: (progress: number) => void;
  onTimeUpdate?: (timeSeconds: number) => void;
}> = ({ videoId, title, autoPlay, initialTime = 0, onEnded, onProgress, onTimeUpdate }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Build Vimeo embed URL with parameters
  const embedUrl = useMemo(() => {
    const params = new URLSearchParams({
      autopause: '0',
      quality: 'auto',
      responsive: '1',
      dnt: '1', // Do not track
      pip: '1', // Picture-in-picture
      title: '1',
      byline: '0',
      portrait: '0',
    });

    if (autoPlay) {
      params.set('autoplay', '1');
    }

    if (initialTime > 0) {
      // Vimeo uses #t=XXs format for start time
      return `https://player.vimeo.com/video/${videoId}?${params.toString()}#t=${Math.floor(initialTime)}s`;
    }

    return `https://player.vimeo.com/video/${videoId}?${params.toString()}`;
  }, [videoId, autoPlay, initialTime]);

  // Listen for Vimeo postMessage events
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify message is from Vimeo
      if (!event.origin.includes('vimeo.com')) return;

      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        
        if (data.event === 'ready') {
          setIsLoading(false);
          setError(null);
        }

        if (data.event === 'error') {
          setError('Failed to load Vimeo video. Please check the video URL.');
          setIsLoading(false);
        }

        if (data.event === 'ended' && onEnded) {
          onEnded();
        }

        if (data.event === 'timeupdate' && data.data) {
          const { seconds, duration, percent } = data.data;
          
          if (onProgress && typeof percent === 'number') {
            onProgress(percent * 100);
          }
          
          if (onTimeUpdate && typeof seconds === 'number') {
            onTimeUpdate(Math.floor(seconds));
          }
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onEnded, onProgress, onTimeUpdate]);

  // Handle iframe load
  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setError('Failed to load Vimeo video. Please check your connection.');
    setIsLoading(false);
  };

  return (
    <div 
      className="relative w-full max-w-full overflow-hidden rounded-lg border border-border bg-muted" 
      style={{ aspectRatio: '16 / 9' }}
    >
      <iframe
        ref={iframeRef}
        src={embedUrl}
        className="absolute inset-0 h-full w-full"
        frameBorder="0"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        title={title || 'Vimeo video player'}
        onLoad={handleIframeLoad}
        onError={handleIframeError}
      />

      {/* Loading indicator */}
      {isLoading && !error && (
        <div className="absolute inset-0 grid place-items-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading video...</span>
          </div>
        </div>
      )}

      {/* Error UI */}
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
                      setError(null);
                      setIsLoading(true);
                      // Force reload by updating the iframe src
                      if (iframeRef.current) {
                        iframeRef.current.src = embedUrl;
                      }
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
    </div>
  );
};

/**
 * Premium HLS/Native video player with adaptive streaming:
 * - Uses hls.js for adaptive bitrate streaming on non-Safari browsers
 * - Native HLS playback on Safari/iOS
 * - Automatic quality selection based on network conditions
 * - Persistent volume/mute settings
 * - User gesture required for first playback
 */
const NativeVideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  poster,
  title,
  onEnded,
  onProgress,
  onTimeUpdate,
  initialTime = 0,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onEndedRef = useRef(onEnded);
  const onProgressRef = useRef(onProgress);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);
  useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; }, [onTimeUpdate]);
  const hlsRef = useRef<Hls | null>(null);
  const hlsInitializingRef = useRef(false); // Track HLS setup to suppress native errors
  const restoredRef = useRef(false);
  const lastReportedTimeRef = useRef(0);
  const endedFiredRef = useRef(false);

  const [showStartOverlay, setShowStartOverlay] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioDetected, setAudioDetected] = useState<boolean | null>(null);
  const [currentQuality, setCurrentQuality] = useState<string>("auto");
  const [forceHlsJs, setForceHlsJs] = useState(false);
  const [availableLevels, setAvailableLevels] = useState<{ height: number; index: number }[]>([]);
  const [isAutoQuality, setIsAutoQuality] = useState(true);

  const mimeType = useMemo(() => inferMimeType(src), [src]);
  const isHls = useMemo(() => isHlsUrl(src), [src]);
  const isBunny = useMemo(() => isBunnyStreamUrl(src), [src]);

  const applyPersistedAudioSettings = useCallback((video: HTMLVideoElement) => {
    const rawVol = localStorage.getItem(VOLUME_KEY);
    const vol = rawVol ? Number(rawVol) : NaN;
    video.volume = Number.isFinite(vol) && vol >= 0 && vol <= 1 ? vol : 0.8;

    const rawMuted = localStorage.getItem(MUTED_KEY);
    if (rawMuted === "true" || rawMuted === "false") {
      video.muted = rawMuted === "true";
    } else {
      video.muted = false;
    }

    if (!video.muted && video.volume === 0) video.volume = 0.8;
  }, []);

  const requestPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    setError(null);
    setIsBuffering(false);
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

  // Hard reset UI state on source changes
  useEffect(() => {
    restoredRef.current = false;
    lastReportedTimeRef.current = 0;
    endedFiredRef.current = false;
    setShowStartOverlay(true);
    setIsBuffering(false);
    setError(null);
    setAudioDetected(null);
    setCurrentQuality("auto");
    setForceHlsJs(false);
    setAvailableLevels([]);
    setIsAutoQuality(true);
  }, [src]);

  // Handle quality level change
  const handleQualityChange = useCallback((levelIndex: number) => {
    const hls = hlsRef.current;
    if (!hls) return;

    if (levelIndex === -1) {
      // Auto quality
      hls.currentLevel = -1;
      setIsAutoQuality(true);
      setCurrentQuality("auto");
    } else {
      hls.currentLevel = levelIndex;
      setIsAutoQuality(false);
      const level = hls.levels[levelIndex];
      if (level) {
        setCurrentQuality(`${level.height}p`);
      }
    }
  }, []);

  // HLS.js setup for adaptive streaming
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    hlsInitializingRef.current = false;

    // Get the effective source URL (proxied for Bunny Stream)
    const effectiveSrc = isBunny ? getProxiedUrl(src) : src;

    if (isHls || isBunny) {
      const shouldUseNativeHls = !forceHlsJs && isSafariOrIOS() && video.canPlayType("application/vnd.apple.mpegurl") !== "";

      if (shouldUseNativeHls) {
        // Use native HLS (Safari/iOS) - also use proxy for Bunny
        video.src = effectiveSrc;
        console.log("[VideoPlayer] Using native HLS playback");
      } else if (Hls.isSupported()) {
        // Mark that we're initializing HLS - suppress native errors during this time
        hlsInitializingRef.current = true;

        // Ensure the video element isn't trying to load the m3u8 by itself
        try {
          video.removeAttribute("src");
          video.load();
        } catch {
          // ignore
        }

        // Use hls.js for other browsers
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 600,
          startLevel: -1, // Auto quality selection
          capLevelToPlayerSize: true,
          testBandwidth: true,
        });

        // Load from proxied URL for Bunny Stream
        hls.loadSource(effectiveSrc);
        hls.attachMedia(video);
        console.log("[VideoPlayer] Using hls.js for adaptive streaming via proxy");

        hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
          console.log("[VideoPlayer] HLS manifest loaded, levels:", data.levels.length);
          // HLS is now active, clear initializing flag
          hlsInitializingRef.current = false;

          // Store available quality levels for the selector
          const levels = data.levels.map((level, index) => ({
            height: level.height,
            index,
          }));
          // Sort by height descending and remove duplicates
          const uniqueLevels = levels
            .filter((v, i, a) => a.findIndex(t => t.height === v.height) === i)
            .sort((a, b) => b.height - a.height);
          setAvailableLevels(uniqueLevels);

          // Restore position after manifest loads
          if (!restoredRef.current && initialTime > 0) {
            restoredRef.current = true;
            const dur = video.duration || Infinity;
            const safeTime = Math.min(Math.max(0, initialTime), dur - 1);
            if (safeTime > 0 && safeTime < dur - 2) {
              video.currentTime = safeTime;
            }
          }
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
          const level = hls.levels[data.level];
          if (level) {
            setCurrentQuality(`${level.height}p`);
          }
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error("[VideoPlayer] Network error, attempting recovery...");
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error("[VideoPlayer] Media error, attempting recovery...");
                hls.recoverMediaError();
                break;
              default:
                console.error("[VideoPlayer] Fatal HLS error:", data);
                setError("Failed to load video stream.");
                hls.destroy();
                break;
            }
          }
        });

        hlsRef.current = hls;
      } else {
        // No HLS support at all
        setError("HLS streaming is not supported in this browser.");
      }
    } else {
      // Regular video file
      video.src = src;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, isHls, isBunny, initialTime, forceHlsJs]);

  // Wire native video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    applyPersistedAudioSettings(video);

    const onLoadStart = () => setIsBuffering(true);
    const onCanPlay = () => setIsBuffering(false);
    const onPlaying = () => setIsBuffering(false);
    const onWaiting = () => setIsBuffering(true);
    const onStalled = () => setIsBuffering(true);

    const onLoadedMetadata = () => {
      // Restore watch position once (for non-HLS or native HLS)
      if (restoredRef.current) return;
      restoredRef.current = true;

      const dur = video.duration;
      if (Number.isFinite(dur) && dur > 0 && Number.isFinite(initialTime) && initialTime > 0) {
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

      onProgressRef.current?.((t / d) * 100);

      // Fallback: fire onEnded when video is within 1s of finishing
      if (d - t <= 1 && !endedFiredRef.current) {
        endedFiredRef.current = true;
        onEndedRef.current?.();
      }

      if (Math.abs(t - lastReportedTimeRef.current) >= 5) {
        lastReportedTimeRef.current = t;
        onTimeUpdateRef.current?.(Math.floor(t));
      }
    };

    const onVolumeChange = () => {
      try {
        localStorage.setItem(VOLUME_KEY, String(video.volume));
        localStorage.setItem(MUTED_KEY, String(video.muted));
      } catch {
        // ignore storage errors
      }
    };

    const onErrorInternal = () => {
      // Suppress errors while HLS.js is initializing (it handles the m3u8 directly)
      if (hlsRef.current || hlsInitializingRef.current) return;

      // Native HLS sometimes fails even when the browser claims it can play it.
      // If this is an HLS source and hls.js is supported, retry via hls.js.
      if (!forceHlsJs && (isHls || isBunny) && Hls.isSupported()) {
        console.warn("[VideoPlayer] Native HLS failed; falling back to hls.js", { src });
        setForceHlsJs(true);
        setIsBuffering(true);
        setError(null);
        return;
      }

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

    const onEndedInternal = () => onEndedRef.current?.();
    const onPlayInternal = () => setShowStartOverlay(false);

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
    };
  }, [src]);

  return (
    <div className="relative w-full max-w-full overflow-hidden rounded-lg border border-border bg-muted" style={{ aspectRatio: '16 / 9' }}>
      <video
        key={src}
        ref={videoRef}
        className="h-full w-full"
        poster={poster}
        controls
        playsInline
        preload="metadata"
        aria-label={title || "Video player"}
      />

      {/* Quality selector for HLS streams */}
      {(isHls || isBunny) && availableLevels.length > 0 && !showStartOverlay && !error && (
        <div className="absolute right-3 top-3 z-50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md bg-background/80 px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background/95 focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Select video quality"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>{isAutoQuality ? `Auto (${currentQuality})` : currentQuality}</span>
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="z-[100] min-w-[120px] bg-background border border-border shadow-lg"
            >
              <DropdownMenuItem
                onClick={() => handleQualityChange(-1)}
                className={`cursor-pointer ${isAutoQuality ? "bg-accent" : ""}`}
              >
                <span className="flex items-center gap-2">
                  Auto
                  {isAutoQuality && <span className="text-xs text-muted-foreground">({currentQuality})</span>}
                </span>
              </DropdownMenuItem>
              {availableLevels.map((level) => (
                <DropdownMenuItem
                  key={level.height}
                  onClick={() => handleQualityChange(level.index)}
                  className={`cursor-pointer ${!isAutoQuality && currentQuality === `${level.height}p` ? "bg-accent" : ""}`}
                >
                  {level.height}p
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Buffering indicator */}
      {isBuffering && !error && (
        <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-2 rounded-md bg-background/70 px-3 py-2 text-sm text-foreground backdrop-blur-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading…</span>
        </div>
      )}

      {/* Play overlay */}
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

      {/* Error UI */}
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
                      if (hlsRef.current) {
                        hlsRef.current.startLoad();
                      } else {
                        v.load();
                      }
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

      {/* No audio warning */}
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

/**
 * Main VideoPlayer component that automatically detects Vimeo URLs
 * and uses the appropriate player
 */
const VideoPlayer: React.FC<VideoPlayerProps> = (props) => {
  const { src, title, autoPlay, initialTime, onEnded, onProgress, onTimeUpdate } = props;

  // Check if this is a Vimeo URL
  const vimeoId = useMemo(() => getVimeoVideoId(src), [src]);

  if (vimeoId) {
    return (
      <VimeoPlayer
        videoId={vimeoId}
        title={title}
        autoPlay={autoPlay}
        initialTime={initialTime}
        onEnded={onEnded}
        onProgress={onProgress}
        onTimeUpdate={onTimeUpdate}
      />
    );
  }

  // Fall back to native player for non-Vimeo URLs
  return <NativeVideoPlayer {...props} />;
};

export default VideoPlayer;
