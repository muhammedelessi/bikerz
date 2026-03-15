import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, X, CheckCircle, AlertCircle, Loader2, Pause, Play,
  Cloud, Zap, RefreshCw, Wifi, WifiOff, ArrowUpFromLine
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useBunnyStream, formatBytes, formatTime, type UploadStage, type BunnyVideoStatus } from '@/hooks/useBunnyStream';

interface BunnyVideoUploaderProps {
  onUploadComplete: (videoId: string, playbackUrl: string) => void;
  currentVideoId?: string;
  isRTL?: boolean;
}

const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024;

const STAGE_CONFIG: Record<UploadStage, { label: string; labelAr: string; color: string }> = {
  idle:       { label: 'Ready',        labelAr: 'جاهز',           color: 'text-muted-foreground' },
  validating: { label: 'Validating',   labelAr: 'التحقق',         color: 'text-blue-500' },
  uploading:  { label: 'Uploading',    labelAr: 'جاري الرفع',     color: 'text-primary' },
  finalizing: { label: 'Finalizing',   labelAr: 'جاري الإنهاء',   color: 'text-amber-500' },
  processing: { label: 'Processing',   labelAr: 'جاري المعالجة',  color: 'text-violet-500' },
  ready:      { label: 'Ready',        labelAr: 'جاهز',           color: 'text-green-500' },
  error:      { label: 'Error',        labelAr: 'خطأ',            color: 'text-destructive' },
};

const BunnyVideoUploader: React.FC<BunnyVideoUploaderProps> = ({
  onUploadComplete,
  currentVideoId,
  isRTL = false,
}) => {
  const [stage, setStage] = useState<'idle' | 'active' | 'processing' | 'ready' | 'error'>(
    currentVideoId ? 'ready' : 'idle'
  );
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
        setStage('processing');
        monitorProcessing(videoId);
      }
    }
  };

  const monitorProcessing = async (videoId: string) => {
    const finalStatus = await waitForProcessing(
      videoId,
      (status) => setProcessingStatus(status),
      600000
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

  const handleUpload = async (file: File) => {
    // Quick client-side check
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(mp4|webm|mov|avi|mkv)$/i)) {
      toast.error(isRTL ? 'نوع الملف غير مدعوم' : 'Unsupported file type');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(isRTL ? 'حجم الملف كبير جداً (الحد الأقصى 5GB)' : 'File too large (max 5GB)');
      return;
    }

    setStage('active');

    try {
      await uploadVideo(
        file,
        file.name.replace(/\.[^/.]+$/, ''),
        undefined,
        async (completedVideoId) => {
          setStage('processing');
          toast.success(isRTL ? 'تم رفع الفيديو! جاري المعالجة...' : 'Upload complete! Processing...');
          monitorProcessing(completedVideoId);
        },
        (err) => {
          setStage('error');
          toast.error(err);
        }
      );
    } catch {
      setStage('error');
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
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
  const handleCancel = () => { cancelUpload(); setStage('idle'); setProcessingStatus(null); };
  const handleRemove = () => {
    setStage('idle');
    setProcessingStatus(null);
    onUploadComplete('', '');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const { isPaused, progress } = uploadState;
  const currentUploadStage = uploadState.stage;

  return (
    <div className="space-y-4">
      <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />

      {/* Info Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="text-xs text-muted-foreground">
          <p className="font-medium text-foreground">
            {isRTL ? 'بث عالي الجودة • رفع مباشر' : 'Premium Streaming • Direct Upload'}
          </p>
          <p className="mt-0.5">
            {isRTL 
              ? 'رفع مباشر بسرعة عالية مع دعم الاستئناف التلقائي وتعدد المسارات • حتى 5GB'
              : 'High-speed direct upload with auto-resume & parallel chunking • up to 5GB'
            }
          </p>
        </div>
      </div>

      {/* IDLE – Drop Zone */}
      {stage === 'idle' && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-all",
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
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
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> {isRTL ? 'رفع متوازي' : '5x Parallel'}</span>
              <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" /> {isRTL ? 'استئناف تلقائي' : 'Auto-Resume'}</span>
              <span className="flex items-center gap-1"><ArrowUpFromLine className="h-3 w-3" /> {isRTL ? 'مباشر' : 'Direct'}</span>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE – Uploading / Validating / Finalizing */}
      {stage === 'active' && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className={cn("h-5 w-5 text-primary", !isPaused && "animate-spin")} />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">
                    {isPaused
                      ? (isRTL ? 'مُوقف مؤقتاً' : 'Paused')
                      : (isRTL ? STAGE_CONFIG[currentUploadStage]?.labelAr : STAGE_CONFIG[currentUploadStage]?.label) || 'Uploading'
                    }
                  </p>
                  {/* Stage badge */}
                  <span className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    STAGE_CONFIG[currentUploadStage]?.color || 'text-muted-foreground'
                  )}>
                    {isPaused ? (
                      <><WifiOff className="me-1 h-2.5 w-2.5" /> {isRTL ? 'متوقف' : 'Paused'}</>
                    ) : (
                      <><Wifi className="me-1 h-2.5 w-2.5" /> {isRTL ? 'متصل' : 'Connected'}</>
                    )}
                  </span>
                </div>
                {/* Stats line */}
                {progress && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatBytes(progress.bytesUploaded)} / {formatBytes(progress.bytesTotal)}
                    {progress.speed > 0 && !isPaused && (
                      <> &bull; <span className="font-medium text-foreground">{formatBytes(progress.speed)}/s</span> &bull; {formatTime(progress.remainingTime)} {isRTL ? 'متبقي' : 'left'}</>
                    )}
                    {progress.retryCount > 0 && (
                      <> &bull; <span className="text-amber-500">{progress.retryCount} {isRTL ? 'إعادة' : 'retries'}</span></>
                    )}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={isPaused ? resumeUpload : pauseUpload}>
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={handleCancel}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <Progress value={progress?.percentage || 0} className="h-2" />
          <p className="text-center text-sm font-semibold tabular-nums">{progress?.percentage || 0}%</p>
        </div>
      )}

      {/* PROCESSING */}
      {stage === 'processing' && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-violet-500" />
            <div>
              <p className="text-sm font-medium">
                {isRTL ? 'جاري معالجة الفيديو...' : 'Processing video...'}
              </p>
              <p className="text-xs text-muted-foreground">
                {processingStatus?.statusMessage || (isRTL ? 'تحويل إلى جودات متعددة' : 'Transcoding to multiple qualities')}
              </p>
            </div>
          </div>
          {processingStatus && <Progress value={processingStatus.encodeProgress} className="h-2" />}
          <p className="text-center text-sm text-muted-foreground">{processingStatus?.encodeProgress || 0}%</p>
        </div>
      )}

      {/* READY */}
      {stage === 'ready' && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-500/10 p-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{isRTL ? 'الفيديو جاهز' : 'Video Ready'}</p>
              {processingStatus && (
                <p className="text-xs text-muted-foreground">
                  {processingStatus.duration && `${Math.floor(processingStatus.duration / 60)}:${String(Math.floor(processingStatus.duration % 60)).padStart(2, '0')}`}
                  {processingStatus.availableResolutions?.length ? ` • ${processingStatus.availableResolutions.join(', ')}` : ''}
                </p>
              )}
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={handleRemove} className="text-destructive hover:text-destructive">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ERROR */}
      {stage === 'error' && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                {isRTL ? 'فشل في رفع/معالجة الفيديو' : 'Upload or processing failed'}
              </p>
              <p className="text-xs text-muted-foreground">
                {uploadState.error || (isRTL ? 'حاول مرة أخرى' : 'Please try again')}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setStage('idle')}>
              {isRTL ? 'إعادة المحاولة' : 'Retry'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BunnyVideoUploader;
