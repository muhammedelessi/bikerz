/**
 * Video Compressor Utility
 * Uses HTML5 Canvas and MediaRecorder to compress videos client-side
 * ROBUST audio capture: uses a SINGLE video element with captureStream()
 */

export interface CompressionProgress {
  stage: 'loading' | 'compressing' | 'encoding' | 'done';
  progress: number;
  originalSize: number;
  compressedSize?: number;
}

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  videoBitrate?: number;
  audioBitrate?: number;
  onProgress?: (progress: CompressionProgress) => void;
}

const DEFAULT_OPTIONS: Required<Omit<CompressionOptions, 'onProgress'>> = {
  maxWidth: 1280,
  maxHeight: 720,
  videoBitrate: 1500000,
  audioBitrate: 128000,
};

export async function compressVideo(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { onProgress } = options;

  const originalSize = file.size;

  onProgress?.({
    stage: 'loading',
    progress: 0,
    originalSize,
  });

  if (!window.MediaRecorder) {
    console.warn('MediaRecorder not supported, skipping compression');
    onProgress?.({ stage: 'done', progress: 100, originalSize, compressedSize: originalSize });
    return file;
  }

  // Prefer codecs that include audio
  const mimeTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];

  let selectedMimeType = '';
  for (const mt of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mt)) {
      selectedMimeType = mt;
      break;
    }
  }

  if (!selectedMimeType) {
    console.warn('No supported MIME type for compression');
    onProgress?.({ stage: 'done', progress: 100, originalSize, compressedSize: originalSize });
    return file;
  }

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    // Keep video muted for autoplay policy, but we capture audio from captureStream
    video.muted = true;

    const objectUrl = URL.createObjectURL(file);

    const loadTimeout = setTimeout(() => {
      cleanup();
      console.warn('Video load timeout');
      resolve(file);
    }, 30000);

    const cleanup = () => {
      clearTimeout(loadTimeout);
      URL.revokeObjectURL(objectUrl);
      video.pause();
      video.src = '';
      video.load();
    };

    video.src = objectUrl;

    video.onloadedmetadata = async () => {
      clearTimeout(loadTimeout);

      try {
        let { videoWidth, videoHeight } = video;

        if (!videoWidth || !videoHeight || videoWidth <= 0 || videoHeight <= 0) {
          cleanup();
          console.warn('Invalid video dimensions');
          resolve(file);
          return;
        }

        const aspectRatio = videoWidth / videoHeight;

        if (videoWidth > opts.maxWidth) {
          videoWidth = opts.maxWidth;
          videoHeight = Math.round(videoWidth / aspectRatio);
        }
        if (videoHeight > opts.maxHeight) {
          videoHeight = opts.maxHeight;
          videoWidth = Math.round(videoHeight * aspectRatio);
        }

        videoWidth = Math.floor(videoWidth / 2) * 2;
        videoHeight = Math.floor(videoHeight / 2) * 2;
        videoWidth = Math.max(videoWidth, 64);
        videoHeight = Math.max(videoHeight, 64);

        onProgress?.({ stage: 'compressing', progress: 10, originalSize });

        const canvas = document.createElement('canvas');
        canvas.width = videoWidth;
        canvas.height = videoHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          cleanup();
          resolve(file);
          return;
        }

        // ========== RELIABLE AUDIO CAPTURE ==========
        // Use captureStream on the video element itself. This captures the raw audio
        // track even if the video element is muted (muted only affects speakers).
        const videoStreamWithAudio = (video as any).captureStream
          ? (video as any).captureStream()
          : (video as any).mozCaptureStream
          ? (video as any).mozCaptureStream()
          : null;

        // Canvas stream for re-encoded video frames
        const canvasStream = canvas.captureStream(30);

        // Build combined stream: canvas video + original audio
        const combinedStream = new MediaStream();

        // Add re-encoded video track from canvas
        canvasStream.getVideoTracks().forEach((t: MediaStreamTrack) => combinedStream.addTrack(t));

        // Add original audio tracks from video element
        if (videoStreamWithAudio) {
          const audioTracks = videoStreamWithAudio.getAudioTracks();
          console.log(`[videoCompressor] Captured ${audioTracks.length} audio track(s) from source`);
          audioTracks.forEach((t: MediaStreamTrack) => combinedStream.addTrack(t));
        }

        // Create MediaRecorder
        let mediaRecorder: MediaRecorder;
        try {
          const recorderOptions: MediaRecorderOptions = {
            mimeType: selectedMimeType,
            videoBitsPerSecond: opts.videoBitrate,
          };
          if (combinedStream.getAudioTracks().length > 0) {
            recorderOptions.audioBitsPerSecond = opts.audioBitrate;
          }
          mediaRecorder = new MediaRecorder(combinedStream, recorderOptions);
        } catch (err) {
          console.warn('Failed to create MediaRecorder:', err);
          cleanup();
          resolve(file);
          return;
        }

        const chunks: Blob[] = [];
        let stopped = false;

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          if (stopped) return;
          stopped = true;
          cleanup();

          if (chunks.length === 0) {
            console.warn('No data recorded');
            resolve(file);
            return;
          }

          const blob = new Blob(chunks, { type: selectedMimeType.split(';')[0] });
          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^/.]+$/, '.webm'),
            { type: 'video/webm' }
          );

          onProgress?.({ stage: 'done', progress: 100, originalSize, compressedSize: compressedFile.size });

          if (compressedFile.size < originalSize && compressedFile.size > 0) {
            console.log(`[videoCompressor] Compressed ${formatFileSize(originalSize)} → ${formatFileSize(compressedFile.size)}`);
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        };

        mediaRecorder.onerror = () => {
          cleanup();
          resolve(file);
        };

        try {
          mediaRecorder.start(100);
        } catch (err) {
          console.warn('Failed to start recording:', err);
          cleanup();
          resolve(file);
          return;
        }

        video.currentTime = 0;

        try {
          await video.play();
        } catch (err) {
          console.warn('Failed to play for compression:', err);
          if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
          cleanup();
          resolve(file);
          return;
        }

        const duration = video.duration;
        let lastProgress = 0;

        const maxTime = Math.min(duration * 1000 + 5000, 300000);
        const recordingTimeout = setTimeout(() => {
          if (mediaRecorder.state !== 'inactive') {
            video.pause();
            mediaRecorder.stop();
          }
        }, maxTime);

        const drawFrame = () => {
          if (video.paused || video.ended || stopped) {
            if (mediaRecorder.state !== 'inactive') {
              clearTimeout(recordingTimeout);
              mediaRecorder.stop();
            }
            return;
          }

          ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

          const prog = 10 + (video.currentTime / duration) * 80;
          if (prog - lastProgress > 5) {
            lastProgress = prog;
            onProgress?.({ stage: 'encoding', progress: Math.round(prog), originalSize });
          }

          requestAnimationFrame(drawFrame);
        };

        drawFrame();

        video.onended = () => {
          setTimeout(() => {
            clearTimeout(recordingTimeout);
            if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
          }, 100);
        };
      } catch (err) {
        console.warn('Compression error:', err);
        cleanup();
        resolve(file);
      }
    };

    video.onerror = () => {
      cleanup();
      console.warn('Failed to load video for compression');
      resolve(file);
    };
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getCompressionRatio(original: number, compressed: number): string {
  const ratio = (((original - compressed) / original) * 100).toFixed(1);
  return `${ratio}%`;
}
