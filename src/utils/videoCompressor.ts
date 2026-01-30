/**
 * Video Compressor Utility
 * Uses HTML5 Canvas and MediaRecorder to compress videos client-side
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
  videoBitrate?: number; // in bits per second
  audioBitrate?: number; // in bits per second
  onProgress?: (progress: CompressionProgress) => void;
}

const DEFAULT_OPTIONS: Required<Omit<CompressionOptions, 'onProgress'>> = {
  maxWidth: 1280,
  maxHeight: 720,
  videoBitrate: 1500000, // 1.5 Mbps
  audioBitrate: 128000,  // 128 Kbps
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

  return new Promise((resolve, reject) => {
    // Create video element to load the source
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    
    video.onloadedmetadata = async () => {
      try {
        // Calculate new dimensions maintaining aspect ratio
        let { videoWidth, videoHeight } = video;
        const aspectRatio = videoWidth / videoHeight;
        
        if (videoWidth > opts.maxWidth) {
          videoWidth = opts.maxWidth;
          videoHeight = Math.round(videoWidth / aspectRatio);
        }
        if (videoHeight > opts.maxHeight) {
          videoHeight = opts.maxHeight;
          videoWidth = Math.round(videoHeight * aspectRatio);
        }
        
        // Ensure dimensions are even (required for some codecs)
        videoWidth = Math.floor(videoWidth / 2) * 2;
        videoHeight = Math.floor(videoHeight / 2) * 2;
        
        onProgress?.({
          stage: 'compressing',
          progress: 10,
          originalSize,
        });
        
        // Create canvas for frame processing
        const canvas = document.createElement('canvas');
        canvas.width = videoWidth;
        canvas.height = videoHeight;
        const ctx = canvas.getContext('2d')!;
        
        // Create a stream from canvas
        const stream = canvas.captureStream(30); // 30 FPS
        
        // Try to add audio track if available
        try {
          const audioContext = new AudioContext();
          const source = audioContext.createMediaElementSource(video);
          const destination = audioContext.createMediaStreamDestination();
          source.connect(destination);
          source.connect(audioContext.destination);
          
          destination.stream.getAudioTracks().forEach(track => {
            stream.addTrack(track);
          });
        } catch (audioError) {
          console.log('No audio track or audio processing failed:', audioError);
        }
        
        // Check for supported MIME types
        const mimeTypes = [
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm',
          'video/mp4',
        ];
        
        let selectedMimeType = '';
        for (const mimeType of mimeTypes) {
          if (MediaRecorder.isTypeSupported(mimeType)) {
            selectedMimeType = mimeType;
            break;
          }
        }
        
        if (!selectedMimeType) {
          // Fallback: return original file if compression not supported
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }
        
        // Create MediaRecorder with optimized settings
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: selectedMimeType,
          videoBitsPerSecond: opts.videoBitrate,
        });
        
        const chunks: Blob[] = [];
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          URL.revokeObjectURL(objectUrl);
          
          const blob = new Blob(chunks, { type: selectedMimeType.split(';')[0] });
          const extension = selectedMimeType.includes('webm') ? 'webm' : 'mp4';
          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^/.]+$/, `.${extension}`),
            { type: selectedMimeType.split(';')[0] }
          );
          
          onProgress?.({
            stage: 'done',
            progress: 100,
            originalSize,
            compressedSize: compressedFile.size,
          });
          
          // Only use compressed if it's actually smaller
          if (compressedFile.size < originalSize) {
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        };
        
        mediaRecorder.onerror = (e) => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('MediaRecorder error'));
        };
        
        // Start recording
        mediaRecorder.start(100); // Collect data every 100ms
        
        // Play video and draw frames to canvas
        video.currentTime = 0;
        await video.play();
        
        const duration = video.duration;
        let lastProgressUpdate = 0;
        
        const drawFrame = () => {
          if (video.paused || video.ended) {
            mediaRecorder.stop();
            return;
          }
          
          ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
          
          // Update progress
          const currentProgress = 10 + (video.currentTime / duration) * 80;
          if (currentProgress - lastProgressUpdate > 5) {
            lastProgressUpdate = currentProgress;
            onProgress?.({
              stage: 'encoding',
              progress: Math.round(currentProgress),
              originalSize,
            });
          }
          
          requestAnimationFrame(drawFrame);
        };
        
        drawFrame();
        
        video.onended = () => {
          setTimeout(() => {
            if (mediaRecorder.state !== 'inactive') {
              mediaRecorder.stop();
            }
          }, 100);
        };
        
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load video'));
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
  const ratio = ((original - compressed) / original * 100).toFixed(1);
  return `${ratio}%`;
}
