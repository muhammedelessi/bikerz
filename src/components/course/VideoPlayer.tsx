import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  RotateCcw,
  Settings,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface VideoQuality {
  label: string;
  value: string;
  src?: string;
}

interface ChapterMarker {
  id: string;
  title: string;
  titleAr?: string;
  startTime: number;
  endTime?: number;
  thumbnail?: string;
}

interface VideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  onEnded?: () => void;
  onProgress?: (progress: number) => void;
  onTimeUpdate?: (timeSeconds: number) => void;
  autoPlay?: boolean;
  qualities?: VideoQuality[];
  initialTime?: number;
  chapters?: ChapterMarker[];
}

const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const DEFAULT_QUALITIES: VideoQuality[] = [
  { label: 'Auto', value: 'auto' },
  { label: '1080p', value: '1080' },
  { label: '720p', value: '720' },
  { label: '480p', value: '480' },
  { label: '360p', value: '360' },
];

// Format time helper - pure function, no dependencies
const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Safe number check utility
const safeNumber = (value: number, fallback: number = 0): number => {
  return Number.isFinite(value) ? value : fallback;
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  poster,
  title,
  onEnded,
  onProgress,
  onTimeUpdate,
  autoPlay = false,
  qualities = DEFAULT_QUALITIES,
  initialTime = 0,
  chapters = [],
}) => {
  const { isRTL } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hideControlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedTimeRef = useRef<number>(0);
  const userInteractedRef = useRef<boolean>(false);

  // Core state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [previousVolume, setPreviousVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [currentQuality, setCurrentQuality] = useState<string>('auto');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [hasRestoredTime, setHasRestoredTime] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [hoveredChapter, setHoveredChapter] = useState<ChapterMarker | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);


  // Video event handlers
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || isSeeking) return;
    const time = safeNumber(videoRef.current.currentTime);
    const dur = safeNumber(videoRef.current.duration);
    
    setCurrentTime(time);
    
    if (onProgress && dur > 0) {
      onProgress((time / dur) * 100);
    }
    
    // Save progress every 5 seconds
    if (onTimeUpdate && Math.abs(time - lastSavedTimeRef.current) >= 5) {
      lastSavedTimeRef.current = time;
      onTimeUpdate(Math.floor(time));
    }
  }, [onProgress, onTimeUpdate, isSeeking]);

  const handleLoadedMetadata = useCallback(() => {
    if (!videoRef.current) return;
    const dur = safeNumber(videoRef.current.duration);
    setDuration(dur);
    setIsLoading(false);
    setError(null);
    
    // Restore watch position
    if (initialTime > 0 && !hasRestoredTime && dur > 0) {
      const isNearEnd = initialTime >= dur - 10;
      if (!isNearEnd) {
        videoRef.current.currentTime = Math.min(initialTime, dur);
        setCurrentTime(initialTime);
      }
      setHasRestoredTime(true);
    }
  }, [initialTime, hasRestoredTime]);

  const handleProgress = useCallback(() => {
    if (!videoRef.current) return;
    const buf = videoRef.current.buffered;
    if (buf.length > 0) {
      setBuffered(safeNumber(buf.end(buf.length - 1)));
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    onEnded?.();
  }, [onEnded]);

  const handleWaiting = useCallback(() => setIsLoading(true), []);
  const handleCanPlay = useCallback(() => setIsLoading(false), []);
  const handlePlaying = useCallback(() => {
    setIsPlaying(true);
    setIsLoading(false);
  }, []);
  const handlePause = useCallback(() => setIsPlaying(false), []);

  const handleError = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const mediaError = video.error;
    setIsLoading(false);
    
    let errorMessage = isRTL ? 'فشل تحميل الفيديو' : 'Failed to load video';
    
    if (mediaError) {
      switch (mediaError.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = isRTL ? 'تم إلغاء تحميل الفيديو' : 'Video loading aborted';
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = isRTL ? 'خطأ في الشبكة أثناء تحميل الفيديو' : 'Network error while loading video';
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage = isRTL ? 'خطأ في فك تشفير الفيديو' : 'Video decode error';
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = isRTL ? 'تنسيق الفيديو غير مدعوم' : 'Video format not supported';
          break;
      }
    }
    
    setError(errorMessage);
  }, [isRTL]);

  // Control functions
  const togglePlay = useCallback(() => {
    if (!videoRef.current || error) return;
    userInteractedRef.current = true;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(err => {
        console.error('Play failed:', err);
        if (err.name === 'NotAllowedError') {
          // Autoplay was prevented, try muted
          videoRef.current!.muted = true;
          setIsMuted(true);
          videoRef.current!.play().catch(() => {});
        }
      });
    }
  }, [isPlaying, error]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    
    if (isMuted) {
      videoRef.current.muted = false;
      const newVol = previousVolume > 0 ? previousVolume : 0.5;
      videoRef.current.volume = newVol;
      setVolume(newVol);
      setIsMuted(false);
    } else {
      setPreviousVolume(volume);
      videoRef.current.muted = true;
      setIsMuted(true);
    }
  }, [isMuted, volume, previousVolume]);

  const handleVolumeChange = useCallback((value: number[]) => {
    if (!videoRef.current) return;
    const newVolume = Math.max(0, Math.min(1, value[0]));
    
    videoRef.current.volume = newVolume;
    videoRef.current.muted = newVolume === 0;
    
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    
    if (newVolume > 0) {
      setPreviousVolume(newVolume);
    }
  }, []);

  const handleSeek = useCallback((value: number[]) => {
    if (!videoRef.current) return;
    const dur = safeNumber(videoRef.current.duration);
    if (dur <= 0) return;
    
    const time = Math.max(0, Math.min(safeNumber(value[0]), dur));
    setIsSeeking(true);
    videoRef.current.currentTime = time;
    setCurrentTime(time);
    
    // Reset seeking state after a short delay
    setTimeout(() => setIsSeeking(false), 100);
  }, []);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressRef.current) return;
    const dur = safeNumber(videoRef.current.duration);
    if (dur <= 0) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const isRtl = document.documentElement.dir === 'rtl';
    const pos = isRtl 
      ? (rect.right - e.clientX) / rect.width 
      : (e.clientX - rect.left) / rect.width;
    
    const clampedPos = Math.max(0, Math.min(1, pos));
    const time = clampedPos * dur;
    
    setIsSeeking(true);
    videoRef.current.currentTime = time;
    setCurrentTime(time);
    setTimeout(() => setIsSeeking(false), 100);
  }, []);

  const handleProgressHover = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || duration <= 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const isRtl = document.documentElement.dir === 'rtl';
    const pos = isRtl 
      ? (rect.right - e.clientX) / rect.width 
      : (e.clientX - rect.left) / rect.width;
    const clampedPos = Math.max(0, Math.min(1, pos));
    const time = clampedPos * duration;
    
    setHoverTime(time);
    setHoverPosition(clampedPos * 100);
    
    const chapter = chapters.find(ch => {
      const endTime = ch.endTime ?? duration;
      return time >= ch.startTime && time < endTime;
    });
    setHoveredChapter(chapter || null);
  }, [duration, chapters]);

  const handleProgressLeave = useCallback(() => {
    setHoverTime(null);
    setHoveredChapter(null);
  }, []);

  const getChapterPosition = useCallback((chapter: ChapterMarker) => {
    if (duration <= 0) return 0;
    return (chapter.startTime / duration) * 100;
  }, [duration]);

  const skip = useCallback((amount: number) => {
    if (!videoRef.current) return;
    const dur = safeNumber(videoRef.current.duration);
    const cur = safeNumber(videoRef.current.currentTime);
    if (dur <= 0) return;
    
    const newTime = Math.max(0, Math.min(dur, cur + amount));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  const replay = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    setCurrentTime(0);
    videoRef.current.play().catch(() => {});
    setIsPlaying(true);
  }, []);

  const handleSpeedChange = useCallback((speed: string) => {
    if (!videoRef.current) return;
    const speedNum = parseFloat(speed);
    if (Number.isFinite(speedNum) && speedNum > 0) {
      videoRef.current.playbackRate = speedNum;
      setPlaybackSpeed(speedNum);
    }
  }, []);

  const handleQualityChange = useCallback((quality: string) => {
    if (!videoRef.current) return;
    const currentPos = videoRef.current.currentTime;
    const wasPlaying = !videoRef.current.paused;
    
    setCurrentQuality(quality);
    
    const selectedQuality = qualities.find(q => q.value === quality);
    if (selectedQuality?.src) {
      videoRef.current.src = selectedQuality.src;
      videoRef.current.load();
      videoRef.current.currentTime = currentPos;
      if (wasPlaying) {
        videoRef.current.play().catch(() => {});
      }
    }
    
    setShowSettingsMenu(false);
  }, [qualities]);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await containerRef.current.requestFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, []);

  const retryLoad = useCallback(() => {
    if (!videoRef.current) return;
    setError(null);
    setIsLoading(true);
    videoRef.current.load();
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Hide controls on inactivity
  const resetHideControlsTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    if (isPlaying) {
      hideControlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    } else {
      resetHideControlsTimer();
    }
    return () => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
  }, [isPlaying, resetHideControlsTimer]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      // Check if the video player is focused or if the container is active
      if (!containerRef.current?.contains(document.activeElement) && document.activeElement !== document.body) {
        return;
      }
      
      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          skip(-10);
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          skip(10);
          break;
        case 'arrowup':
          e.preventDefault();
          handleVolumeChange([Math.min(1, volume + 0.1)]);
          break;
        case 'arrowdown':
          e.preventDefault();
          handleVolumeChange([Math.max(0, volume - 0.1)]);
          break;
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault();
          if (videoRef.current && duration > 0) {
            const seekTo = (duration * parseInt(e.key)) / 10;
            videoRef.current.currentTime = seekTo;
            setCurrentTime(seekTo);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleMute, toggleFullscreen, skip, handleVolumeChange, volume, duration]);

  // Volume icon based on level
  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercentage = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <TooltipProvider>
      <div
        ref={containerRef}
        className={cn(
          "relative bg-black group aspect-video w-full overflow-hidden select-none",
          isFullscreen && "fixed inset-0 z-50 aspect-auto"
        )}
        onMouseMove={resetHideControlsTimer}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        onTouchStart={resetHideControlsTimer}
        tabIndex={0}
        role="application"
        aria-label={title || (isRTL ? 'مشغل الفيديو' : 'Video player')}
      >
        {/* Video Element */}
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          className="w-full h-full object-contain cursor-pointer"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onProgress={handleProgress}
          onPlay={handlePlaying}
          onPause={handlePause}
          onEnded={handleEnded}
          onWaiting={handleWaiting}
          onCanPlay={handleCanPlay}
          onError={handleError}
          onClick={togglePlay}
          playsInline
          autoPlay={autoPlay}
          preload="metadata"
          crossOrigin="anonymous"
        />

        {/* Error State */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20"
            >
              <AlertCircle className="w-12 h-12 text-destructive mb-4" />
              <p className="text-white text-center mb-4 px-4">{error}</p>
              <Button
                onClick={retryLoad}
                variant="secondary"
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                {isRTL ? 'إعادة المحاولة' : 'Retry'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading Spinner */}
        <AnimatePresence>
          {isLoading && !error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none z-10"
            >
              <Loader2 className="w-12 h-12 text-white animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Big Play Button (when paused) */}
        <AnimatePresence>
          {!isPlaying && !isLoading && !error && showControls && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/90 hover:bg-primary flex items-center justify-center transition-all hover:scale-110 shadow-2xl pointer-events-auto focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                aria-label={isRTL ? 'تشغيل' : 'Play'}
              >
                <Play className={cn(
                  "w-8 h-8 sm:w-10 sm:h-10 text-primary-foreground",
                  isRTL ? "me-1" : "ms-1"
                )} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls Overlay */}
        <AnimatePresence>
          {showControls && !error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none z-10"
            >
              {/* Top Bar - Title */}
              {title && (
                <div className="absolute top-0 left-0 right-0 p-4 pointer-events-auto">
                  <h3 className="text-white text-sm sm:text-base font-medium truncate">
                    {title}
                  </h3>
                </div>
              )}

              {/* Bottom Controls */}
              <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 pointer-events-auto">
                {/* Progress Bar Container */}
                <div className="relative mb-3">
                  {/* Hover Preview Tooltip */}
                  <AnimatePresence>
                    {hoverTime !== null && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute bottom-full mb-3 pointer-events-none z-20"
                        style={{
                          [isRTL ? 'right' : 'left']: `${hoverPosition}%`,
                          transform: `translateX(${isRTL ? '50%' : '-50%'})`
                        }}
                      >
                        <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-xl overflow-hidden">
                          {hoveredChapter?.thumbnail && (
                            <div className="w-40 h-24 relative">
                              <img 
                                src={hoveredChapter.thumbnail} 
                                alt="" 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="px-3 py-2 text-center">
                            <span className="text-white font-mono text-sm font-medium">
                              {formatTime(hoverTime)}
                            </span>
                            {hoveredChapter && (
                              <p className="text-muted-foreground text-xs mt-0.5 max-w-[150px] truncate">
                                {isRTL ? hoveredChapter.titleAr || hoveredChapter.title : hoveredChapter.title}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Progress Bar */}
                  <div
                    ref={progressRef}
                    className="relative h-1.5 hover:h-2.5 bg-white/30 rounded-full cursor-pointer group/progress transition-all touch-none"
                    onClick={handleProgressClick}
                    onMouseMove={handleProgressHover}
                    onMouseLeave={handleProgressLeave}
                    role="slider"
                    aria-label={isRTL ? 'شريط التقدم' : 'Progress bar'}
                    aria-valuemin={0}
                    aria-valuemax={duration}
                    aria-valuenow={currentTime}
                  >
                    {/* Buffered Progress */}
                    <div
                      className={cn(
                        "absolute h-full bg-white/40 rounded-full transition-all",
                        isRTL ? "right-0" : "left-0"
                      )}
                      style={{ width: `${Math.min(100, bufferedPercentage)}%` }}
                    />
                    {/* Playback Progress */}
                    <div
                      className={cn(
                        "absolute h-full bg-primary rounded-full transition-all",
                        isRTL ? "right-0" : "left-0"
                      )}
                      style={{ width: `${Math.min(100, progressPercentage)}%` }}
                    />
                    
                    {/* Chapter Markers */}
                    {chapters.length > 0 && chapters.map((chapter) => {
                      const position = getChapterPosition(chapter);
                      if (position <= 0 || position >= 100) return null;
                      return (
                        <Tooltip key={chapter.id}>
                          <TooltipTrigger asChild>
                            <div
                              className="absolute top-0 bottom-0 w-1 bg-white/70 hover:bg-white cursor-pointer transition-colors z-10"
                              style={{
                                [isRTL ? 'right' : 'left']: `${position}%`,
                                transform: 'translateX(-50%)'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (videoRef.current) {
                                  videoRef.current.currentTime = chapter.startTime;
                                  setCurrentTime(chapter.startTime);
                                }
                              }}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px]">
                            <div className="text-center">
                              {chapter.thumbnail && (
                                <img 
                                  src={chapter.thumbnail} 
                                  alt="" 
                                  className="w-32 h-20 object-cover rounded mb-1"
                                />
                              )}
                              <p className="text-sm font-medium">
                                {isRTL ? chapter.titleAr || chapter.title : chapter.title}
                              </p>
                              <span className="text-xs text-muted-foreground">
                                {formatTime(chapter.startTime)}
                              </span>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                    
                    {/* Seek Handle */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-primary rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-lg pointer-events-none"
                      style={{ 
                        [isRTL ? 'right' : 'left']: `calc(${Math.min(100, progressPercentage)}% - 7px)` 
                      }}
                    />
                    {/* Hidden Slider for accessibility */}
                    <Slider
                      value={[currentTime]}
                      min={0}
                      max={duration || 100}
                      step={0.1}
                      onValueChange={handleSeek}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      aria-hidden="true"
                    />
                  </div>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-between gap-2">
                  {/* Left Controls */}
                  <div className="flex items-center gap-1 sm:gap-2">
                    {/* Play/Pause */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePlay();
                          }}
                          className="h-9 w-9 sm:h-10 sm:w-10 text-white hover:bg-white/20 focus:ring-2 focus:ring-white/50"
                          aria-label={isPlaying ? (isRTL ? 'إيقاف مؤقت' : 'Pause') : (isRTL ? 'تشغيل' : 'Play')}
                        >
                          {isPlaying ? (
                            <Pause className="w-5 h-5 sm:w-6 sm:h-6" />
                          ) : (
                            <Play className={cn(
                              "w-5 h-5 sm:w-6 sm:h-6",
                              isRTL ? "me-0.5" : "ms-0.5"
                            )} />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isPlaying ? (isRTL ? 'إيقاف مؤقت (K)' : 'Pause (K)') : (isRTL ? 'تشغيل (K)' : 'Play (K)')}
                      </TooltipContent>
                    </Tooltip>

                    {/* Skip Back */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            skip(-10);
                          }}
                          className="h-8 w-8 sm:h-9 sm:w-9 text-white hover:bg-white/20"
                          aria-label={isRTL ? '10 ثوانٍ للخلف' : 'Skip back 10 seconds'}
                        >
                          {isRTL ? (
                            <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
                          ) : (
                            <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{isRTL ? '10 ثوانٍ للخلف (J)' : '10 seconds back (J)'}</TooltipContent>
                    </Tooltip>

                    {/* Skip Forward */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            skip(10);
                          }}
                          className="h-8 w-8 sm:h-9 sm:w-9 text-white hover:bg-white/20"
                          aria-label={isRTL ? '10 ثوانٍ للأمام' : 'Skip forward 10 seconds'}
                        >
                          {isRTL ? (
                            <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
                          ) : (
                            <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{isRTL ? '10 ثوانٍ للأمام (L)' : '10 seconds forward (L)'}</TooltipContent>
                    </Tooltip>

                    {/* Replay */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            replay();
                          }}
                          className="h-8 w-8 sm:h-9 sm:w-9 text-white hover:bg-white/20 hidden sm:flex"
                          aria-label={isRTL ? 'إعادة التشغيل' : 'Replay'}
                        >
                          <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{isRTL ? 'إعادة التشغيل' : 'Replay'}</TooltipContent>
                    </Tooltip>

                    {/* Volume Control */}
                    <div 
                      className="relative flex items-center gap-1"
                      onMouseEnter={() => setShowVolumeSlider(true)}
                      onMouseLeave={() => setShowVolumeSlider(false)}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMute();
                            }}
                            className="h-8 w-8 sm:h-9 sm:w-9 text-white hover:bg-white/20"
                            aria-label={isMuted ? (isRTL ? 'إلغاء كتم الصوت' : 'Unmute') : (isRTL ? 'كتم الصوت' : 'Mute')}
                          >
                            <VolumeIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{isMuted ? (isRTL ? 'إلغاء الكتم (M)' : 'Unmute (M)') : (isRTL ? 'كتم الصوت (M)' : 'Mute (M)')}</TooltipContent>
                      </Tooltip>
                      
                      <AnimatePresence>
                        {showVolumeSlider && (
                          <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 80, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            className="overflow-hidden hidden sm:block"
                          >
                            <Slider
                              value={[isMuted ? 0 : volume]}
                              min={0}
                              max={1}
                              step={0.01}
                              onValueChange={handleVolumeChange}
                              onClick={(e) => e.stopPropagation()}
                              className="w-20"
                              aria-label={isRTL ? 'مستوى الصوت' : 'Volume'}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Time Display */}
                    <span className="text-white text-xs sm:text-sm ms-1 sm:ms-2 font-mono tabular-nums">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  {/* Right Controls */}
                  <div className="flex items-center gap-1 sm:gap-2">
                    {/* Settings Menu (Speed + Quality) */}
                    <DropdownMenu open={showSettingsMenu} onOpenChange={setShowSettingsMenu}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => e.stopPropagation()}
                              className="h-8 w-8 sm:h-9 sm:w-9 text-white hover:bg-white/20"
                              aria-label={isRTL ? 'الإعدادات' : 'Settings'}
                            >
                              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>{isRTL ? 'الإعدادات' : 'Settings'}</TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent 
                        align="end" 
                        className="min-w-[200px] bg-background/95 backdrop-blur-sm border-border"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Quality Section */}
                        <div className="px-3 py-2 border-b border-border">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {isRTL ? 'الجودة' : 'Quality'}
                          </span>
                        </div>
                        <div className="py-1">
                          {qualities.map((quality) => (
                            <DropdownMenuItem
                              key={quality.value}
                              onClick={() => handleQualityChange(quality.value)}
                              className={cn(
                                "flex items-center justify-between cursor-pointer",
                                currentQuality === quality.value && "bg-primary/20"
                              )}
                            >
                              <span>{quality.label}</span>
                              {currentQuality === quality.value && (
                                <div className="w-2 h-2 rounded-full bg-primary" />
                              )}
                            </DropdownMenuItem>
                          ))}
                        </div>

                        {/* Speed Section */}
                        <div className="px-3 py-2 border-t border-b border-border">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {isRTL ? 'السرعة' : 'Speed'}
                          </span>
                        </div>
                        <div className="py-1 max-h-[200px] overflow-y-auto">
                          {PLAYBACK_SPEEDS.map((speed) => (
                            <DropdownMenuItem
                              key={speed}
                              onClick={() => {
                                handleSpeedChange(speed.toString());
                                setShowSettingsMenu(false);
                              }}
                              className={cn(
                                "flex items-center justify-between cursor-pointer",
                                speed === playbackSpeed && "bg-primary/20"
                              )}
                            >
                              <span>{speed === 1 ? (isRTL ? 'عادي' : 'Normal') : `${speed}x`}</span>
                              {speed === playbackSpeed && (
                                <div className="w-2 h-2 rounded-full bg-primary" />
                              )}
                            </DropdownMenuItem>
                          ))}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Fullscreen */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFullscreen();
                          }}
                          className="h-8 w-8 sm:h-9 sm:w-9 text-white hover:bg-white/20"
                          aria-label={isFullscreen ? (isRTL ? 'خروج من ملء الشاشة' : 'Exit fullscreen') : (isRTL ? 'ملء الشاشة' : 'Fullscreen')}
                        >
                          {isFullscreen ? (
                            <Minimize className="w-4 h-4 sm:w-5 sm:h-5" />
                          ) : (
                            <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isFullscreen 
                          ? (isRTL ? 'خروج من ملء الشاشة (F)' : 'Exit Fullscreen (F)') 
                          : (isRTL ? 'ملء الشاشة (F)' : 'Fullscreen (F)')}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
};

export default VideoPlayer;
export type { ChapterMarker, VideoPlayerProps };
