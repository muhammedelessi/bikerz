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

export type UploadStage = 'idle' | 'validating' | 'uploading' | 'finalizing' | 'processing' | 'ready' | 'error';

export interface UploadProgress {
  percentage: number;
  bytesUploaded: number;
  bytesTotal: number;
  speed: number; // bytes per second (rolling average)
  remainingTime: number; // seconds
  retryCount: number;
  stage: UploadStage;
}

export interface BunnyUploadState {
  isUploading: boolean;
  isPaused: boolean;
  progress: UploadProgress | null;
  videoId: string | null;
  error: string | null;
  stage: UploadStage;
}

// ── localStorage helpers for cross-session resume ──
const UPLOAD_KEY_PREFIX = 'bunny_upload_';

interface StoredUploadSession {
  videoId: string;
  libraryId: string;
  uploadUrl: string;
  authorizationSignature: string;
  expirationTime: number;
  fileName: string;
  fileSize: number;
  fileLastModified: number;
  createdAt: number;
}

function storeUploadSession(fileKey: string, session: StoredUploadSession) {
  try {
    localStorage.setItem(UPLOAD_KEY_PREFIX + fileKey, JSON.stringify(session));
  } catch { /* quota exceeded – ignore */ }
}

function getStoredUploadSession(fileKey: string): StoredUploadSession | null {
  try {
    const raw = localStorage.getItem(UPLOAD_KEY_PREFIX + fileKey);
    if (!raw) return null;
    const session: StoredUploadSession = JSON.parse(raw);
    // Expire if TUS signature expired (with 5 min buffer)
    if (session.expirationTime < Math.floor(Date.now() / 1000) + 300) {
      localStorage.removeItem(UPLOAD_KEY_PREFIX + fileKey);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function clearUploadSession(fileKey: string) {
  try { localStorage.removeItem(UPLOAD_KEY_PREFIX + fileKey); } catch { /* */ }
}

function getFileKey(file: File): string {
  return `${file.name}_${file.size}_${file.lastModified}`;
}

// ── Rolling average helper for smooth speed display ──
class RollingAverage {
  private samples: number[] = [];
  private maxSamples: number;
  constructor(maxSamples = 8) { this.maxSamples = maxSamples; }
  push(value: number) {
    this.samples.push(value);
    if (this.samples.length > this.maxSamples) this.samples.shift();
  }
  get average(): number {
    if (this.samples.length === 0) return 0;
    return this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
  }
  reset() { this.samples = []; }
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
    stage: 'idle',
  });

  const tusUploadRef = useRef<tus.Upload | null>(null);
  const lastProgressTimeRef = useRef<number>(0);
  const lastBytesUploadedRef = useRef<number>(0);
  const speedAvgRef = useRef(new RollingAverage(8));
  const retryCountRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      tusUploadRef.current?.abort();
      abortControllerRef.current?.abort();
    };
  }, []);

  const setStage = useCallback((stage: UploadStage) => {
    setUploadState(prev => ({ ...prev, stage }));
  }, []);

  /**
   * Create video and get upload credentials in a single API call
   */
  const createAndGetUploadCredentials = useCallback(async (title: string) => {
    const { data, error } = await supabase.functions.invoke('bunny-stream', {
      body: { action: 'create-and-upload', title },
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error || 'Failed to create video');
    return data;
  }, []);

  /**
   * Validate file before upload
   */
  const validateFile = useCallback((file: File): string | null => {
    const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
    const MAX_SIZE = 5 * 1024 * 1024 * 1024; // 5GB

    if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(mp4|webm|mov|avi|mkv)$/i)) {
      return 'Unsupported file type. Please upload MP4, WebM, MOV, AVI, or MKV';
    }
    if (file.size > MAX_SIZE) {
      return 'File is too large. Maximum size is 5GB';
    }
    if (file.size === 0) {
      return 'File is empty';
    }
    return null;
  }, []);

  /**
   * Upload a video file using TUS resumable uploads with high concurrency
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
        // ── Validation phase ──
        setUploadState({
          isUploading: true,
          isPaused: false,
          error: null,
          videoId: null,
          stage: 'validating',
          progress: { percentage: 0, bytesUploaded: 0, bytesTotal: file.size, speed: 0, remainingTime: 0, retryCount: 0, stage: 'validating' },
        });

        const validationError = validateFile(file);
        if (validationError) {
          throw new Error(validationError);
        }

        // ── Check for resumable session in localStorage ──
        const fileKey = getFileKey(file);
        let credentials: any;
        let videoId: string;
        const storedSession = getStoredUploadSession(fileKey);

        if (storedSession) {
          // Reuse existing video + credentials (resume scenario)
          credentials = {
            videoId: storedSession.videoId,
            libraryId: storedSession.libraryId,
            uploadUrl: storedSession.uploadUrl,
            authorizationSignature: storedSession.authorizationSignature,
            expirationTime: storedSession.expirationTime,
          };
          videoId = storedSession.videoId;
        } else {
          // Single API call: create video + get upload credentials
          credentials = await createAndGetUploadCredentials(title);
          videoId = credentials.videoId;

          // Store session for potential resume
          storeUploadSession(fileKey, {
            videoId,
            libraryId: credentials.libraryId,
            uploadUrl: credentials.uploadUrl,
            authorizationSignature: credentials.authorizationSignature,
            expirationTime: credentials.expirationTime,
            fileName: file.name,
            fileSize: file.size,
            fileLastModified: file.lastModified,
            createdAt: Date.now(),
          });
        }

        setUploadState(prev => ({ ...prev, videoId, stage: 'uploading' }));

        // ── Initialize speed tracking ──
        lastProgressTimeRef.current = Date.now();
        lastBytesUploadedRef.current = 0;
        speedAvgRef.current.reset();
        retryCountRef.current = 0;

        // Abort controller for cancel support
        abortControllerRef.current = new AbortController();

        // ── Adaptive chunk sizing ──
        // Larger chunks = fewer round-trips = faster for big files
        const chunkSize = file.size > 1024 * 1024 * 1024 // > 1GB
          ? 50 * 1024 * 1024  // 50MB
          : file.size > 500 * 1024 * 1024
          ? 25 * 1024 * 1024  // 25MB
          : file.size > 100 * 1024 * 1024
          ? 15 * 1024 * 1024  // 15MB
          : 10 * 1024 * 1024; // 10MB

        // ── Concurrency: 5 parallel chunks for maximum throughput ──
        const parallelUploads = file.size > 200 * 1024 * 1024 ? 5 : 3;

        const upload = new tus.Upload(file, {
          endpoint: credentials.uploadUrl,
          retryDelays: [0, 500, 1000, 2000, 5000, 10000, 15000],
          chunkSize,
          parallelUploads,
          storeFingerprintForResuming: true,
          removeFingerprintOnSuccess: true,
          metadata: {
            filename: file.name,
            filetype: file.type || 'video/mp4',
          },
          headers: {
            'AuthorizationSignature': credentials.authorizationSignature,
            'AuthorizationExpire': credentials.expirationTime.toString(),
            'VideoId': videoId,
            'LibraryId': credentials.libraryId,
          },
          onError: (error) => {
            console.error('TUS upload error:', error);
            const errorMessage = error.message || 'Upload failed';

            // Check if it's a retry-able error vs terminal
            if (errorMessage.includes('abort')) {
              // User cancelled – don't show error
              return;
            }

            setUploadState(prev => ({
              ...prev,
              isUploading: false,
              error: errorMessage,
              stage: 'error',
            }));
            onError?.(errorMessage);
            reject(new Error(errorMessage));
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            const now = Date.now();
            const timeDiff = (now - lastProgressTimeRef.current) / 1000;
            const bytesDiff = bytesUploaded - lastBytesUploadedRef.current;

            // Only recalculate speed if enough time has passed (avoid jitter)
            if (timeDiff >= 0.3) {
              const instantSpeed = bytesDiff / timeDiff;
              speedAvgRef.current.push(instantSpeed);
              lastProgressTimeRef.current = now;
              lastBytesUploadedRef.current = bytesUploaded;
            }

            const smoothSpeed = speedAvgRef.current.average;
            const remainingBytes = bytesTotal - bytesUploaded;
            const remainingTime = smoothSpeed > 0 ? remainingBytes / smoothSpeed : 0;

            const progress: UploadProgress = {
              percentage: Math.min(Math.round((bytesUploaded / bytesTotal) * 100), 99), // cap at 99 until finalized
              bytesUploaded,
              bytesTotal,
              speed: smoothSpeed,
              remainingTime,
              retryCount: retryCountRef.current,
              stage: 'uploading',
            };

            setUploadState(prev => ({ ...prev, progress, stage: 'uploading' }));
            onProgress?.(progress);
          },
          onShouldRetry: (err, retryAttempt, _options) => {
            retryCountRef.current = retryAttempt;
            setUploadState(prev => ({
              ...prev,
              progress: prev.progress ? { ...prev.progress, retryCount: retryAttempt } : null,
            }));
            // Retry on network errors and 5xx, not on 4xx (except 409 conflict)
            const status = (err as any)?.originalResponse?.getStatus?.();
            if (status && status >= 400 && status < 500 && status !== 409) {
              return false; // Don't retry client errors
            }
            return true; // Retry everything else
          },
          onSuccess: () => {
            // ── Finalizing stage ──
            clearUploadSession(fileKey);

            setUploadState(prev => ({
              ...prev,
              isUploading: false,
              stage: 'finalizing',
              progress: prev.progress ? { ...prev.progress, percentage: 100, stage: 'finalizing' } : null,
            }));

            // Brief delay to show finalizing, then signal complete
            setTimeout(() => {
              setUploadState(prev => ({
                ...prev,
                stage: 'processing',
                progress: prev.progress ? { ...prev.progress, stage: 'processing' } : null,
              }));
              onComplete?.(videoId);
              resolve(videoId);
            }, 500);
          },
        });

        tusUploadRef.current = upload;

        // Check for previous upload attempts (TUS fingerprint resume)
        const previousUploads = await upload.findPreviousUploads();
        if (previousUploads.length > 0) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }

        upload.start();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        setUploadState(prev => ({
          ...prev,
          isUploading: false,
          error: errorMessage,
          stage: 'error',
        }));
        onError?.(errorMessage);
        reject(error);
      }
    });
  }, [createAndGetUploadCredentials, validateFile]);

  /**
   * Pause the current upload
   */
  const pauseUpload = useCallback(() => {
    tusUploadRef.current?.abort();
    setUploadState(prev => ({ ...prev, isPaused: true }));
  }, []);

  /**
   * Resume a paused upload
   */
  const resumeUpload = useCallback(() => {
    tusUploadRef.current?.start();
    setUploadState(prev => ({ ...prev, isPaused: false }));
  }, []);

  /**
   * Cancel the current upload and clean up
   */
  const cancelUpload = useCallback(() => {
    tusUploadRef.current?.abort();
    tusUploadRef.current = null;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    speedAvgRef.current.reset();
    retryCountRef.current = 0;

    setUploadState({
      isUploading: false,
      isPaused: false,
      progress: null,
      videoId: null,
      error: null,
      stage: 'idle',
    });
  }, []);

  /**
   * Get video processing status
   */
  const getVideoStatus = useCallback(async (videoId: string): Promise<BunnyVideoStatus | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('bunny-stream', {
        body: { action: 'get-status', videoId },
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
    maxWaitTime: number = 600000,
  ): Promise<BunnyVideoStatus | null> => {
    const startTime = Date.now();
    const pollInterval = 3000;

    return new Promise((resolve) => {
      const poll = async () => {
        if (Date.now() - startTime > maxWaitTime) {
          resolve(null);
          return;
        }

        const status = await getVideoStatus(videoId);
        if (status) {
          onProgress?.(status);
          if (status.isReady) { resolve(status); return; }
          if (status.status === 5 || status.status === 6) { resolve(status); return; }
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
      const { data, error } = await supabase.functions.invoke('bunny-stream', {
        body: { action: 'get-playback-url', videoId },
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
      const { data, error } = await supabase.functions.invoke('bunny-stream', {
        body: { action: 'delete-video', videoId },
      });
      if (error) throw error;
      return data.success;
    } catch (error) {
      console.error('Failed to delete video:', error);
      return false;
    }
  }, []);

  /**
   * Create a new video entry (kept for compatibility)
   */
  const createVideo = useCallback(async (title: string) => {
    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke('bunny-stream', {
        body: { action: 'create-video', title },
      });
      if (invokeError) throw invokeError;
      if (!result.success) throw new Error(result.error || 'Failed to create video');
      return { videoId: result.videoId, libraryId: result.libraryId };
    } catch (error) {
      console.error('Failed to create video:', error);
      throw error;
    }
  }, []);

  return {
    uploadVideo,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    uploadState,
    validateFile,
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
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}
