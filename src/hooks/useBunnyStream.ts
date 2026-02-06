import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import * as tus from 'tus-js-client';

export interface BunnyVideoStatus {
  videoId: string;
  status: number;
  statusMessage: string;
  encodeProgress: number;
  duration?: number;
  width?: number;
  height?: number;
  size?: number;
  availableResolutions?: string[];
  isReady: boolean;
}

export interface BunnyPlaybackInfo {
  success: boolean;
  playbackUrl?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
  availableResolutions?: string[];
  status?: number;
  statusMessage?: string;
  encodeProgress?: number;
}

export interface UploadProgress {
  percentage: number;
  bytesUploaded: number;
  bytesTotal: number;
  speed: number; // bytes per second
  remainingTime: number; // seconds
}

export interface BunnyUploadState {
  isUploading: boolean;
  isPaused: boolean;
  progress: UploadProgress | null;
  videoId: string | null;
  error: string | null;
}

/**
 * Hook for interacting with Bunny Stream via edge function
 */
export function useBunnyStream() {
  const [uploadState, setUploadState] = useState<BunnyUploadState>({
    isUploading: false,
    isPaused: false,
    progress: null,
    videoId: null,
    error: null,
  });

  const tusUploadRef = useRef<tus.Upload | null>(null);
  const lastProgressTimeRef = useRef<number>(0);
  const lastBytesUploadedRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tusUploadRef.current) {
        tusUploadRef.current.abort();
      }
    };
  }, []);

  /**
   * Create a new video entry in Bunny Stream
   */
  const createVideo = useCallback(async (title: string): Promise<{ videoId: string; libraryId: string } | null> => {
    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke('bunny-stream?action=create-video', {
        body: { title },
      });

      if (invokeError) throw invokeError;
      if (!result.success) throw new Error(result.error || 'Failed to create video');

      return {
        videoId: result.videoId,
        libraryId: result.libraryId,
      };
    } catch (error) {
      console.error('Failed to create video:', error);
      throw error;
    }
  }, []);

  /**
   * Get upload credentials for TUS resumable upload
   */
  const getUploadCredentials = useCallback(async (videoId: string) => {
    const { data, error } = await supabase.functions.invoke('bunny-stream?action=get-upload-url', {
      body: { videoId },
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error || 'Failed to get upload URL');

    return data;
  }, []);

  /**
   * Upload a video file using TUS resumable uploads
   */
  const uploadVideo = useCallback(async (
    file: File,
    title: string,
    onProgress?: (progress: UploadProgress) => void,
    onComplete?: (videoId: string) => void,
    onError?: (error: string) => void,
  ): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        setUploadState(prev => ({
          ...prev,
          isUploading: true,
          isPaused: false,
          error: null,
          progress: { percentage: 0, bytesUploaded: 0, bytesTotal: file.size, speed: 0, remainingTime: 0 },
        }));

        // Step 1: Create video entry
        const createResult = await createVideo(title);
        if (!createResult) throw new Error('Failed to create video entry');

        const { videoId, libraryId } = createResult;
        setUploadState(prev => ({ ...prev, videoId }));

        // Step 2: Get upload credentials
        const credentials = await getUploadCredentials(videoId);

        // Step 3: Start TUS upload
        lastProgressTimeRef.current = Date.now();
        lastBytesUploadedRef.current = 0;

        const upload = new tus.Upload(file, {
          endpoint: credentials.uploadUrl,
          retryDelays: [0, 1000, 3000, 5000, 10000],
          chunkSize: 5 * 1024 * 1024, // 5MB chunks
          metadata: {
            filename: file.name,
            filetype: file.type,
          },
          headers: {
            'AuthorizationSignature': credentials.apiKey,
            'AuthorizationExpire': credentials.expirationTime.toString(),
            'VideoId': videoId,
            'LibraryId': libraryId,
          },
          onError: (error) => {
            console.error('TUS upload error:', error);
            const errorMessage = error.message || 'Upload failed';
            setUploadState(prev => ({
              ...prev,
              isUploading: false,
              error: errorMessage,
            }));
            onError?.(errorMessage);
            reject(new Error(errorMessage));
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            const now = Date.now();
            const timeDiff = (now - lastProgressTimeRef.current) / 1000;
            const bytesDiff = bytesUploaded - lastBytesUploadedRef.current;
            
            const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
            const remainingBytes = bytesTotal - bytesUploaded;
            const remainingTime = speed > 0 ? remainingBytes / speed : 0;
            
            const progress: UploadProgress = {
              percentage: Math.round((bytesUploaded / bytesTotal) * 100),
              bytesUploaded,
              bytesTotal,
              speed,
              remainingTime,
            };

            lastProgressTimeRef.current = now;
            lastBytesUploadedRef.current = bytesUploaded;

            setUploadState(prev => ({ ...prev, progress }));
            onProgress?.(progress);
          },
          onSuccess: () => {
            setUploadState(prev => ({
              ...prev,
              isUploading: false,
              progress: prev.progress ? { ...prev.progress, percentage: 100 } : null,
            }));
            onComplete?.(videoId);
            resolve(videoId);
          },
        });

        tusUploadRef.current = upload;

        // Check for previous upload attempts
        const previousUploads = await upload.findPreviousUploads();
        if (previousUploads.length > 0) {
          // Resume from previous upload
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }

        // Start the upload
        upload.start();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        setUploadState(prev => ({
          ...prev,
          isUploading: false,
          error: errorMessage,
        }));
        onError?.(errorMessage);
        reject(error);
      }
    });
  }, [createVideo, getUploadCredentials]);

  /**
   * Pause the current upload
   */
  const pauseUpload = useCallback(() => {
    if (tusUploadRef.current) {
      tusUploadRef.current.abort();
      setUploadState(prev => ({ ...prev, isPaused: true }));
    }
  }, []);

  /**
   * Resume a paused upload
   */
  const resumeUpload = useCallback(() => {
    if (tusUploadRef.current) {
      tusUploadRef.current.start();
      setUploadState(prev => ({ ...prev, isPaused: false }));
    }
  }, []);

  /**
   * Cancel the current upload
   */
  const cancelUpload = useCallback(() => {
    if (tusUploadRef.current) {
      tusUploadRef.current.abort();
      tusUploadRef.current = null;
    }
    setUploadState({
      isUploading: false,
      isPaused: false,
      progress: null,
      videoId: null,
      error: null,
    });
  }, []);

  /**
   * Get video processing status
   */
  const getVideoStatus = useCallback(async (videoId: string): Promise<BunnyVideoStatus | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('bunny-stream?action=get-status', {
        body: { videoId },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to get video status');

      return {
        videoId: data.videoId,
        status: data.status,
        statusMessage: data.statusMessage,
        encodeProgress: data.encodeProgress,
        duration: data.duration,
        width: data.width,
        height: data.height,
        size: data.size,
        availableResolutions: data.availableResolutions,
        isReady: data.isReady,
      };
    } catch (error) {
      console.error('Failed to get video status:', error);
      return null;
    }
  }, []);

  /**
   * Poll for video processing status until ready
   */
  const waitForProcessing = useCallback(async (
    videoId: string,
    onProgress?: (status: BunnyVideoStatus) => void,
    maxWaitTime: number = 600000, // 10 minutes
  ): Promise<BunnyVideoStatus | null> => {
    const startTime = Date.now();
    const pollInterval = 3000; // 3 seconds

    return new Promise((resolve) => {
      const poll = async () => {
        if (Date.now() - startTime > maxWaitTime) {
          resolve(null);
          return;
        }

        const status = await getVideoStatus(videoId);
        if (status) {
          onProgress?.(status);

          if (status.isReady) {
            resolve(status);
            return;
          }

          if (status.status === 5 || status.status === 6) {
            // Failed
            resolve(status);
            return;
          }
        }

        setTimeout(poll, pollInterval);
      };

      poll();
    });
  }, [getVideoStatus]);

  /**
   * Get playback URL for a video
   */
  const getPlaybackInfo = useCallback(async (videoId: string): Promise<BunnyPlaybackInfo> => {
    try {
      const { data, error } = await supabase.functions.invoke('bunny-stream?action=get-playback-url', {
        body: { videoId },
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get playback info:', error);
      return { success: false };
    }
  }, []);

  /**
   * Delete a video
   */
  const deleteVideo = useCallback(async (videoId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('bunny-stream?action=delete-video', {
        body: { videoId },
      });

      if (error) throw error;
      return data.success;
    } catch (error) {
      console.error('Failed to delete video:', error);
      return false;
    }
  }, []);

  return {
    // Upload methods
    uploadVideo,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    uploadState,

    // Video management
    createVideo,
    getVideoStatus,
    waitForProcessing,
    getPlaybackInfo,
    deleteVideo,
  };
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format seconds to human readable time
 */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}
