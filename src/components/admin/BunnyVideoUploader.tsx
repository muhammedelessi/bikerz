import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  X, 
  Video, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Pause, 
  Play,
  Cloud,
  Zap,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useBunnyStream, formatBytes, formatTime, BunnyVideoStatus } from '@/hooks/useBunnyStream';

interface BunnyVideoUploaderProps {
  onUploadComplete: (videoId: string, playbackUrl: string) => void;
  currentVideoId?: string;
  isRTL?: boolean;
}

const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB (Bunny Stream supports large files)

type UploadStage = 'idle' | 'uploading' | 'processing' | 'ready' | 'error';

const BunnyVideoUploader: React.FC<BunnyVideoUploaderProps> = ({
  onUploadComplete,
  currentVideoId,
  isRTL = false,
}) => {
  const [stage, setStage] = useState<UploadStage>(currentVideoId ? 'ready' : 'idle');
  const [processingStatus, setProcessingStatus] = useState<BunnyVideoStatus | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const {
    uploadVideo,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    uploadState,
    getVideoStatus,
    waitForProcessing,
    getPlaybackInfo,
  } = useBunnyStream();

  // Check existing video status on mount
  useEffect(() => {
    if (currentVideoId && stage === 'ready') {
      checkVideoStatus(currentVideoId);
    }
  }, [currentVideoId]);

  const checkVideoStatus = async (videoId: string) => {
    const status = await getVideoStatus(videoId);
    if (status) {
      setProcessingStatus(status);
      if (!status.isReady && status.status !== 5 && status.status !== 6) {
        // Still processing, wait for it
        setStage('processing');
        monitorProcessing(videoId);
      }
    }
  };

  const monitorProcessing = async (videoId: string) => {
    const finalStatus = await waitForProcessing(
      videoId,
      (status) => setProcessingStatus(status),
      600000 // 10 minutes max
    );

    if (finalStatus?.isReady) {
      setStage('ready');
      const playbackInfo = await getPlaybackInfo(videoId);
      if (playbackInfo.playbackUrl) {
        onUploadComplete(videoId, playbackInfo.playbackUrl);
        toast.success(isRTL ? 'الفيديو جاهز للتشغيل!' : 'Video ready for playback!');
      }
    } else if (finalStatus?.status === 5 || finalStatus?.status === 6) {
      setStage('error');
      toast.error(isRTL ? 'فشل معالجة الفيديو' : 'Video processing failed');
    }
  };

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return isRTL 
        ? 'نوع الملف غير مدعوم. يرجى رفع ملف فيديو'
        : 'Unsupported file type. Please upload a video file';
    }
    if (file.size > MAX_FILE_SIZE) {
      return isRTL
        ? 'حجم الملف كبير جداً. الحد الأقصى 5 جيجابايت'
        : 'File is too large. Maximum size is 5GB';
    }
    return null;
  };

  const handleUpload = async (file: File) => {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    setStage('uploading');
    
    try {
      const videoId = await uploadVideo(
        file,
        file.name.replace(/\.[^/.]+$/, ''), // Title without extension
        undefined,
        async (completedVideoId) => {
          // Upload complete, start monitoring processing
          setStage('processing');
          toast.success(isRTL ? 'تم رفع الفيديو! جاري المعالجة...' : 'Upload complete! Processing...');
          monitorProcessing(completedVideoId);
        },
        (err) => {
          setStage('error');
          toast.error(err);
        }
      );
    } catch (err) {
      setStage('error');
      toast.error(isRTL ? 'فشل رفع الفيديو' : 'Upload failed');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const handleCancel = () => {
    cancelUpload();
    setStage('idle');
    setProcessingStatus(null);
  };

  const handleRemove = () => {
    setStage('idle');
    setProcessingStatus(null);
    onUploadComplete('', '');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const { isUploading, isPaused, progress } = uploadState;

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Info Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="text-xs text-muted-foreground">
          <p className="font-medium text-foreground">
            {isRTL ? 'بث عالي الجودة' : 'Premium Streaming'}
          </p>
          <p className="mt-0.5">
            {isRTL 
              ? 'يتم تحويل الفيديو تلقائياً إلى جودات متعددة (240p-1080p) وبثه عبر CDN عالمي'
              : 'Videos are automatically transcoded to multiple qualities (240p-1080p) and streamed via global CDN'
            }
          </p>
        </div>
      </div>

      {/* Upload States */}
      {stage === 'idle' && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-all",
            isDragging 
              ? "border-primary bg-primary/5" 
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-full bg-primary/10 p-4">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-medium">
                {isRTL ? 'اسحب وأفلت الفيديو هنا' : 'Drag and drop video here'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isRTL ? 'أو انقر للاختيار • حتى 5 جيجابايت' : 'or click to browse • up to 5GB'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Zap className="h-3 w-3" />
              <span>{isRTL ? 'دعم الرفع المتقطع' : 'Resumable uploads supported'}</span>
            </div>
          </div>
        </div>
      )}

      {stage === 'uploading' && progress && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className={cn("h-5 w-5 text-primary", !isPaused && "animate-spin")} />
              <div>
                <p className="text-sm font-medium">
                  {isPaused 
                    ? (isRTL ? 'مُوقف مؤقتاً' : 'Paused')
                    : (isRTL ? 'جاري الرفع...' : 'Uploading...')
                  }
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(progress.bytesUploaded)} / {formatBytes(progress.bytesTotal)}
                  {progress.speed > 0 && !isPaused && (
                    <> • {formatBytes(progress.speed)}/s • {formatTime(progress.remainingTime)} {isRTL ? 'متبقي' : 'left'}</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={isPaused ? resumeUpload : pauseUpload}
              >
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleCancel}
                className="text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Progress value={progress.percentage} className="h-2" />
          <p className="text-center text-sm font-medium">{progress.percentage}%</p>
        </div>
      )}

      {stage === 'processing' && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium">
                {isRTL ? 'جاري معالجة الفيديو...' : 'Processing video...'}
              </p>
              <p className="text-xs text-muted-foreground">
                {processingStatus?.statusMessage || (isRTL ? 'تحويل إلى جودات متعددة' : 'Transcoding to multiple qualities')}
              </p>
            </div>
          </div>
          {processingStatus && (
            <Progress value={processingStatus.encodeProgress} className="h-2" />
          )}
          <p className="text-center text-sm text-muted-foreground">
            {processingStatus?.encodeProgress || 0}%
          </p>
        </div>
      )}

      {stage === 'ready' && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-500/10 p-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">
                {isRTL ? 'الفيديو جاهز' : 'Video Ready'}
              </p>
              {processingStatus && (
                <p className="text-xs text-muted-foreground">
                  {processingStatus.duration && `${Math.floor(processingStatus.duration / 60)}:${String(Math.floor(processingStatus.duration % 60)).padStart(2, '0')}`}
                  {processingStatus.availableResolutions?.length && (
                    <> • {processingStatus.availableResolutions.join(', ')}</>
                  )}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleRemove}
              className="text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {stage === 'error' && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                {isRTL ? 'فشل في معالجة الفيديو' : 'Video processing failed'}
              </p>
              <p className="text-xs text-muted-foreground">
                {uploadState.error || (isRTL ? 'حاول مرة أخرى' : 'Please try again')}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStage('idle')}
            >
              {isRTL ? 'إعادة المحاولة' : 'Retry'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BunnyVideoUploader;
