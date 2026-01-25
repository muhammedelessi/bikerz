import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface VideoQuality {
  label: string;
  value: string;
  src?: string;
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
}

const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const DEFAULT_QUALITIES: VideoQuality[] = [
  { label: 'Auto', value: 'auto' },
  { label: '1080p', value: '1080' },
  { label: '720p', value: '720' },
  { label: '480p', value: '480' },
  { label: '360p', value: '360' },
];

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
}) => {
  const { isRTL } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hideControlsTimeout = useRef<NodeJS.Timeout>();

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
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
  const lastSavedTimeRef = useRef<number>(0);

  // Format time helper
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Video event handlers
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      if (onProgress && duration > 0) {
        onProgress((time / duration) * 100);
      }
      
      // Save progress every 5 seconds to avoid too many updates
      if (onTimeUpdate && Math.abs(time - lastSavedTimeRef.current) >= 5) {
        lastSavedTimeRef.current = time;
        onTimeUpdate(Math.floor(time));
      }
    }
  }, [duration, onProgress, onTimeUpdate]);

  // Restore initial time when video loads
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsLoading(false);
      
      // Restore watch position if provided and not already restored
      if (initialTime > 0 && !hasRestoredTime) {
        // Don't restore if very close to the end (within last 10 seconds)
        const isNearEnd = initialTime >= videoRef.current.duration - 10;
        if (!isNearEnd) {
          videoRef.current.currentTime = initialTime;
          setCurrentTime(initialTime);
        }
        setHasRestoredTime(true);
      }
    }
  }, [initialTime, hasRestoredTime]);

  const handleProgress = useCallback(() => {
    if (videoRef.current && videoRef.current.buffered.length > 0) {
      const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      setBuffered(bufferedEnd);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    onEnded?.();
  }, [onEnded]);

  const handleWaiting = useCallback(() => {
    setIsLoading(true);
  }, []);

  const handleCanPlay = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Control functions
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.muted = false;
      videoRef.current.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      videoRef.current.muted = true;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const handleVolumeChange = useCallback((value: number[]) => {
    if (!videoRef.current) return;
    const newVolume = value[0];
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    videoRef.current.muted = newVolume === 0;
  }, []);

  const handleSeek = useCallback((value: number[]) => {
    if (!videoRef.current) return;
    const time = value[0];
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    // For RTL, calculate from right side
    const isRtl = document.documentElement.dir === 'rtl';
    const pos = isRtl 
      ? (rect.right - e.clientX) / rect.width 
      : (e.clientX - rect.left) / rect.width;
    const time = Math.max(0, Math.min(1, pos)) * duration;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  }, [duration]);

  const skip = useCallback((amount: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + amount));
  }, [duration]);

  const replay = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play();
    setIsPlaying(true);
  }, []);

  const handleSpeedChange = useCallback((speed: string) => {
    if (!videoRef.current) return;
    const speedNum = parseFloat(speed);
    videoRef.current.playbackRate = speedNum;
    setPlaybackSpeed(speedNum);
  }, []);

  const handleQualityChange = useCallback((quality: string) => {
    if (!videoRef.current) return;
    const currentTime = videoRef.current.currentTime;
    const wasPlaying = !videoRef.current.paused;
    
    setCurrentQuality(quality);
    
    // Find the quality source
    const selectedQuality = qualities.find(q => q.value === quality);
    if (selectedQuality?.src) {
      videoRef.current.src = selectedQuality.src;
      videoRef.current.load();
      videoRef.current.currentTime = currentTime;
      if (wasPlaying) {
        videoRef.current.play();
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

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
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
          e.preventDefault();
          skip(-10);
          break;
        case 'arrowright':
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
        case 'j':
          e.preventDefault();
          skip(-10);
          break;
        case 'l':
          e.preventDefault();
          skip(10);
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
          if (videoRef.current) {
            videoRef.current.currentTime = (duration * parseInt(e.key)) / 10;
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
          "relative bg-black group aspect-video w-full overflow-hidden",
          isFullscreen && "fixed inset-0 z-50 aspect-auto"
        )}
        onMouseMove={resetHideControlsTimer}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        onClick={(e) => {
          // Only toggle play if clicking on the video area, not controls
          if (e.target === videoRef.current || (e.target as HTMLElement).closest('.video-overlay')) {
            togglePlay();
          }
        }}
      >
        {/* Video Element */}
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onProgress={handleProgress}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={handleEnded}
          onWaiting={handleWaiting}
          onCanPlay={handleCanPlay}
          playsInline
          autoPlay={autoPlay}
        />

        {/* Loading Spinner */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/20 video-overlay"
            >
              <Loader2 className="w-12 h-12 text-white animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Big Play Button (when paused) */}
        <AnimatePresence>
          {!isPlaying && !isLoading && showControls && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center video-overlay"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/90 hover:bg-primary flex items-center justify-center transition-all hover:scale-110 shadow-2xl"
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
          {showControls && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none"
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
                {/* Progress Bar */}
                <div
                  ref={progressRef}
                  className="relative h-1.5 bg-white/30 rounded-full mb-3 cursor-pointer group/progress"
                  onClick={handleProgressClick}
                >
                  {/* Buffered Progress */}
                  <div
                    className={cn(
                      "absolute h-full bg-white/40 rounded-full transition-all",
                      isRTL ? "right-0" : "left-0"
                    )}
                    style={{ width: `${bufferedPercentage}%` }}
                  />
                  {/* Playback Progress */}
                  <div
                    className={cn(
                      "absolute h-full bg-primary rounded-full transition-all",
                      isRTL ? "right-0" : "left-0"
                    )}
                    style={{ width: `${progressPercentage}%` }}
                  />
                  {/* Seek Handle */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-primary rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-lg"
                    style={{ 
                      [isRTL ? 'right' : 'left']: `calc(${progressPercentage}% - 7px)` 
                    }}
                  />
                  {/* Hover Time Preview */}
                  <Slider
                    value={[currentTime]}
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    onValueChange={handleSeek}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
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
                          className="h-9 w-9 sm:h-10 sm:w-10 text-white hover:bg-white/20"
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
                          >
                            <VolumeIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{isRTL ? 'كتم الصوت (M)' : 'Mute (M)'}</TooltipContent>
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
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Time Display */}
                    <span className="text-white text-xs sm:text-sm ms-1 sm:ms-2 font-mono">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  {/* Right Controls */}
                  <div className="flex items-center gap-1 sm:gap-2">
                    {/* Settings Menu (Speed + Quality) */}
                    <DropdownMenu open={showSettingsMenu} onOpenChange={setShowSettingsMenu}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => e.stopPropagation()}
                          className="h-8 w-8 sm:h-9 sm:w-9 text-white hover:bg-white/20"
                        >
                          <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                        </Button>
                      </DropdownMenuTrigger>
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
