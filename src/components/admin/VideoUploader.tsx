import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, Video, CheckCircle, AlertCircle, Loader2, Zap, Settings2, Server, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  compressVideo, 
  formatFileSize, 
  getCompressionRatio,
  type CompressionProgress 
} from '@/utils/videoCompressor';

interface VideoUploaderProps {
  onUploadComplete: (url: string) => void;
  currentVideoUrl?: string;
  isRTL?: boolean;
}

const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

type UploadStage = 'idle' | 'compressing' | 'uploading' | 'transcoding' | 'done';
type CompressionMode = 'none' | 'client' | 'server';

const VideoUploader: React.FC<VideoUploaderProps> = ({
  onUploadComplete,
  currentVideoUrl,
  isRTL = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStage, setUploadStage] = useState<UploadStage>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [compressionProgress, setCompressionProgress] = useState<CompressionProgress | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(currentVideoUrl || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Compression settings
  const [compressionMode, setCompressionMode] = useState<CompressionMode>('client');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxResolution, setMaxResolution] = useState(720); // 720p default
  const [quality, setQuality] = useState(70); // 70% quality

  const isProcessing = uploadStage === 'compressing' || uploadStage === 'uploading' || uploadStage === 'transcoding';

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return isRTL 
        ? 'نوع الملف غير مدعوم. يرجى رفع ملف فيديو (MP4, WebM, MOV, AVI, MKV)'
        : 'Unsupported file type. Please upload a video file (MP4, WebM, MOV, AVI, MKV)';
    }
    if (file.size > MAX_FILE_SIZE) {
      return isRTL
        ? 'حجم الملف كبير جداً. الحد الأقصى 500 ميجابايت'
        : 'File is too large. Maximum size is 500MB';
    }
    return null;
  };

  const getVideoBitrate = (qualityPercent: number): number => {
    // Map quality 0-100 to bitrate 500kbps - 4Mbps
    return 500000 + (qualityPercent / 100) * 3500000;
  };

  const serverTranscode = async (filePath: string): Promise<string | null> => {
    try {
      setUploadStage('transcoding');
      setUploadProgress(50);

      const maxWidth = maxResolution === 1080 ? 1920 : maxResolution === 720 ? 1280 : 854;

      const response = await supabase.functions.invoke('transcode-video', {
        body: {
          videoPath: filePath,
          maxWidth,
          maxHeight: maxResolution,
          quality,
          outputFormat: 'mp4',
        },
      });

      if (response.error) {
        throw response.error;
      }

      const result = response.data;
      
      if (result.success) {
        // Server validates the video but recommends client-side compression
        toast.info(
          isRTL 
            ? 'تم التحقق من الفيديو. للضغط الأمثل، استخدم وضع ضغط المتصفح'
            : 'Video validated. For optimal compression, use browser compression mode'
        );
        return result.publicUrl;
      } else {
        throw new Error(result.error || 'Validation failed');
      }
    } catch (err) {
      console.error('Server validation error:', err);
      toast.warning(
        isRTL
          ? 'فشل التحقق على السيرفر، استخدام الفيديو الأصلي'
          : 'Server validation failed, using original video'
      );
      return null;
    }
  };

  const uploadFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    setError(null);
    setUploadProgress(0);
    setCompressionProgress(null);

    let fileToUpload = file;

    // Client-side compression
    if (compressionMode === 'client') {
      setUploadStage('compressing');
      
      try {
        const maxWidth = maxResolution === 1080 ? 1920 : maxResolution === 720 ? 1280 : 854;
        const maxHeight = maxResolution;
        
        fileToUpload = await compressVideo(file, {
          maxWidth,
          maxHeight,
          videoBitrate: getVideoBitrate(quality),
          onProgress: (progress) => {
            setCompressionProgress(progress);
          },
        });

        if (fileToUpload.size < file.size) {
          const saved = getCompressionRatio(file.size, fileToUpload.size);
          toast.success(
            isRTL 
              ? `تم ضغط الفيديو! تم توفير ${saved} من الحجم`
              : `Video compressed! Saved ${saved} in size`
          );
        } else {
          toast.info(
            isRTL
              ? 'الفيديو محسّن بالفعل، جاري الرفع بدون ضغط'
              : 'Video already optimized, uploading without compression'
          );
        }
      } catch (compressError) {
        console.error('Compression failed:', compressError);
        toast.warning(
          isRTL
            ? 'فشل الضغط، جاري رفع الفيديو الأصلي'
            : 'Compression failed, uploading original video'
        );
        fileToUpload = file;
      }
    }

    // Upload the file
    setUploadStage('uploading');
    setUploadProgress(0);

    try {
      // Generate unique filename
      const fileExt = fileToUpload.name.split('.').pop() || 'mp4';
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `videos/${fileName}`;

      // Simulate progress for UX (actual upload doesn't report progress easily)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 10;
        });
      }, 500);

      const { data, error: uploadError } = await supabase.storage
        .from('lesson-videos')
        .upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: false,
        });

      clearInterval(progressInterval);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      let { data: { publicUrl } } = supabase.storage
        .from('lesson-videos')
        .getPublicUrl(filePath);

      // Server-side transcoding (after upload)
      if (compressionMode === 'server') {
        const transcodedUrl = await serverTranscode(filePath);
        if (transcodedUrl) {
          publicUrl = transcodedUrl;
        }
      }

      setUploadProgress(100);
      setUploadStage('done');
      setUploadedUrl(publicUrl);
      onUploadComplete(publicUrl);
      
      toast.success(isRTL ? 'تم رفع الفيديو بنجاح' : 'Video uploaded successfully');
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || (isRTL ? 'فشل رفع الفيديو' : 'Failed to upload video'));
      toast.error(err.message || (isRTL ? 'فشل رفع الفيديو' : 'Failed to upload video'));
      setUploadStage('idle');
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      uploadFile(file);
    }
  }, [compressionMode, maxResolution, quality]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handleRemoveVideo = async () => {
    if (uploadedUrl) {
      // Extract file path from URL
      const urlParts = uploadedUrl.split('/lesson-videos/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        try {
          await supabase.storage.from('lesson-videos').remove([filePath]);
        } catch (err) {
          console.error('Error removing file:', err);
        }
      }
    }
    setUploadedUrl(null);
    setUploadStage('idle');
    onUploadComplete('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getProgressText = () => {
    if (uploadStage === 'compressing' && compressionProgress) {
      const stageText = {
        loading: isRTL ? 'جاري تحميل الفيديو...' : 'Loading video...',
        compressing: isRTL ? 'جاري الضغط...' : 'Compressing...',
        encoding: isRTL ? 'جاري الترميز...' : 'Encoding...',
        done: isRTL ? 'اكتمل الضغط!' : 'Compression complete!',
      };
      return `${stageText[compressionProgress.stage]} ${compressionProgress.progress}%`;
    }
    if (uploadStage === 'uploading') {
      return isRTL ? `جاري الرفع... ${Math.round(uploadProgress)}%` : `Uploading... ${Math.round(uploadProgress)}%`;
    }
    if (uploadStage === 'transcoding') {
      return isRTL ? 'جاري التحويل على السيرفر...' : 'Server transcoding...';
    }
    return '';
  };

  const getCurrentProgress = () => {
    if (uploadStage === 'compressing' && compressionProgress) {
      return compressionProgress.progress;
    }
    if (uploadStage === 'transcoding') {
      return 50; // Indeterminate progress for server transcoding
    }
    return uploadProgress;
  };

  const isExternalUrl = uploadedUrl && !uploadedUrl.includes('lesson-videos');

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Compression Settings */}
      {!uploadedUrl && (
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              {isRTL ? 'وضع الضغط' : 'Compression Mode'}
            </Label>
            
            <RadioGroup
              value={compressionMode}
              onValueChange={(v) => setCompressionMode(v as CompressionMode)}
              className="grid grid-cols-1 gap-2"
              disabled={isProcessing}
            >
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <RadioGroupItem value="none" id="none" />
                <Label htmlFor="none" className="text-sm cursor-pointer flex items-center gap-2">
                  <X className="w-4 h-4 text-muted-foreground" />
                  {isRTL ? 'بدون ضغط' : 'No compression'}
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <RadioGroupItem value="client" id="client" />
                <Label htmlFor="client" className="text-sm cursor-pointer flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-blue-500" />
                  {isRTL ? 'ضغط في المتصفح (سريع)' : 'Browser compression (fast)'}
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <RadioGroupItem value="server" id="server" />
                <Label htmlFor="server" className="text-sm cursor-pointer flex items-center gap-2">
                  <Server className="w-4 h-4 text-green-500" />
                  {isRTL ? 'التحقق على السيرفر' : 'Server validation'}
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          {compressionMode !== 'none' && (
            <p className="text-xs text-muted-foreground">
              {compressionMode === 'client' 
                ? (isRTL 
                    ? 'سيتم ضغط الفيديو في المتصفح قبل الرفع - موصى به للحجم الأصغر'
                    : 'Video compressed in browser before upload - recommended for smaller size')
                : (isRTL
                    ? 'سيتم رفع الفيديو والتحقق منه على السيرفر'
                    : 'Video uploaded and validated on server')
              }
            </p>
          )}

          {compressionMode !== 'none' && (
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-8 text-xs">
                  <Settings2 className="w-3 h-3" />
                  {isRTL ? 'إعدادات متقدمة' : 'Advanced settings'}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">{isRTL ? 'الدقة القصوى' : 'Max Resolution'}</Label>
                    <span className="text-xs text-muted-foreground">{maxResolution}p</span>
                  </div>
                  <Slider
                    value={[maxResolution]}
                    onValueChange={(v) => setMaxResolution(v[0])}
                    min={480}
                    max={1080}
                    step={240}
                    disabled={isProcessing}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>480p</span>
                    <span>720p</span>
                    <span>1080p</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">{isRTL ? 'الجودة' : 'Quality'}</Label>
                    <span className="text-xs text-muted-foreground">{quality}%</span>
                  </div>
                  <Slider
                    value={[quality]}
                    onValueChange={(v) => setQuality(v[0])}
                    min={30}
                    max={100}
                    step={10}
                    disabled={isProcessing}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{isRTL ? 'حجم أصغر' : 'Smaller'}</span>
                    <span>{isRTL ? 'جودة أعلى' : 'Higher quality'}</span>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}

      {uploadedUrl ? (
        <div className="relative rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              {isExternalUrl ? (
                <Video className="w-5 h-5 text-primary" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {isExternalUrl 
                  ? (isRTL ? 'رابط فيديو خارجي' : 'External video link')
                  : (isRTL ? 'فيديو مرفوع' : 'Uploaded video')
                }
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {uploadedUrl}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="flex-shrink-0 text-destructive hover:text-destructive"
              onClick={handleRemoveVideo}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Video Preview */}
          {!isExternalUrl && (
            <div className="mt-3 aspect-video rounded-lg overflow-hidden bg-black">
              <video
                src={uploadedUrl}
                controls
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          className={cn(
            "relative border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer",
            isDragging 
              ? "border-primary bg-primary/5" 
              : "border-border hover:border-primary/50 hover:bg-muted/30",
            isProcessing && "pointer-events-none opacity-70"
          )}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            {isProcessing ? (
              <>
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <div className="w-full max-w-xs space-y-2">
                  <Progress value={getCurrentProgress()} className="h-2" />
                  <p className="text-sm text-muted-foreground">
                    {getProgressText()}
                  </p>
                  {uploadStage === 'compressing' && compressionProgress && (
                    <p className="text-xs text-muted-foreground">
                      {isRTL ? 'الحجم الأصلي:' : 'Original size:'} {formatFileSize(compressionProgress.originalSize)}
                      {compressionProgress.compressedSize && (
                        <> → {formatFileSize(compressionProgress.compressedSize)}</>
                      )}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {isRTL ? 'اسحب وأفلت الفيديو هنا' : 'Drag and drop your video here'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isRTL 
                      ? 'أو انقر للاختيار • MP4, WebM, MOV • حتى 500 ميجابايت'
                      : 'or click to browse • MP4, WebM, MOV • up to 500MB'
                    }
                  </p>
                  {compressionMode !== 'none' && (
                    <p className="text-xs text-primary mt-2 flex items-center justify-center gap-1">
                      {compressionMode === 'client' ? (
                        <>
                          <Monitor className="w-3 h-3" />
                          {isRTL ? 'سيتم الضغط في المتصفح' : 'Browser compression'}
                        </>
                      ) : (
                        <>
                          <Server className="w-3 h-3" />
                          {isRTL ? 'سيتم التحويل على السيرفر' : 'Server transcoding'}
                        </>
                      )}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  );
};

export default VideoUploader;
