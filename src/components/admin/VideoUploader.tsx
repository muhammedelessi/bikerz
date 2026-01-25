import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, Video, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface VideoUploaderProps {
  onUploadComplete: (url: string) => void;
  currentVideoUrl?: string;
  isRTL?: boolean;
}

const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

const VideoUploader: React.FC<VideoUploaderProps> = ({
  onUploadComplete,
  currentVideoUrl,
  isRTL = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(currentVideoUrl || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const uploadFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
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
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      clearInterval(progressInterval);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('lesson-videos')
        .getPublicUrl(filePath);

      setUploadProgress(100);
      setUploadedUrl(publicUrl);
      onUploadComplete(publicUrl);
      
      toast.success(isRTL ? 'تم رفع الفيديو بنجاح' : 'Video uploaded successfully');
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || (isRTL ? 'فشل رفع الفيديو' : 'Failed to upload video'));
      toast.error(err.message || (isRTL ? 'فشل رفع الفيديو' : 'Failed to upload video'));
    } finally {
      setIsUploading(false);
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
  }, []);

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
    onUploadComplete('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isExternalUrl = uploadedUrl && !uploadedUrl.includes('lesson-videos');

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
      />

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
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={cn(
            "relative border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer",
            isDragging 
              ? "border-primary bg-primary/5" 
              : "border-border hover:border-primary/50 hover:bg-muted/30",
            isUploading && "pointer-events-none opacity-70"
          )}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            {isUploading ? (
              <>
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <div className="w-full max-w-xs">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-sm text-muted-foreground mt-2">
                    {isRTL ? `جاري الرفع... ${Math.round(uploadProgress)}%` : `Uploading... ${Math.round(uploadProgress)}%`}
                  </p>
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
