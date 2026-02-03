/**
 * Video Compressor Utility
 * Uses HTML5 Canvas and MediaRecorder to compress videos client-side
 * Properly captures and preserves audio from original video
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

  // Check if MediaRecorder is supported
  if (!window.MediaRecorder) {
    console.warn('MediaRecorder not supported, skipping compression');
    onProgress?.({
      stage: 'done',
      progress: 100,
      originalSize,
      compressedSize: originalSize,
    });
    return file;
  }

  // Check for supported MIME types early - prefer VP9 with Opus audio
  const mimeTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  
  let selectedMimeType = '';
  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      selectedMimeType = mimeType;
      break;
    }
  }
  
  if (!selectedMimeType) {
    console.warn('No supported video MIME type for compression, using original');
    onProgress?.({
      stage: 'done',
      progress: 100,
      originalSize,
      compressedSize: originalSize,
    });
    return file;
  }

  return new Promise((resolve, reject) => {
    // Create video element to load the source
    const video = document.createElement('video');
    video.muted = true; // Must be muted initially for autoplay, we'll capture audio differently
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    
    // Set a timeout for loading
    const loadTimeout = setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      console.warn('Video load timeout, using original');
      resolve(file);
    }, 30000); // 30 second timeout
    
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    
    video.onloadedmetadata = async () => {
      clearTimeout(loadTimeout);
      
      try {
        // Calculate new dimensions maintaining aspect ratio
        let { videoWidth, videoHeight } = video;
        
        // Validate video dimensions
        if (!videoWidth || !videoHeight || videoWidth <= 0 || videoHeight <= 0) {
          console.warn('Invalid video dimensions, using original');
          URL.revokeObjectURL(objectUrl);
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
        
        // Ensure dimensions are even (required for some codecs)
        videoWidth = Math.floor(videoWidth / 2) * 2;
        videoHeight = Math.floor(videoHeight / 2) * 2;
        
        // Minimum dimensions
        videoWidth = Math.max(videoWidth, 64);
        videoHeight = Math.max(videoHeight, 64);
        
        onProgress?.({
          stage: 'compressing',
          progress: 10,
          originalSize,
        });
        
        // Create canvas for frame processing
        const canvas = document.createElement('canvas');
        canvas.width = videoWidth;
        canvas.height = videoHeight;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          console.warn('Could not get canvas context, using original');
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }
        
        // Create a stream from canvas for video at 30 FPS
        const canvasStream = canvas.captureStream(30);
        
        // Create a combined stream
        const combinedStream = new MediaStream();
        
        // Add video track from canvas
        canvasStream.getVideoTracks().forEach(track => {
          combinedStream.addTrack(track);
        });
        
        // Try to capture audio using captureStream on the video element
        // This is the more reliable approach for audio capture
        let audioContext: AudioContext | null = null;
        let audioDestination: MediaStreamAudioDestinationNode | null = null;
        let audioSource: MediaElementAudioSourceNode | null = null;
        
        try {
          // Create a separate video element for audio capture to avoid conflicts
          const audioVideo = document.createElement('video');
          audioVideo.src = objectUrl;
          audioVideo.muted = false; // Need audio for capture
          audioVideo.volume = 0.001; // Nearly silent to avoid playing out loud
          audioVideo.playsInline = true;
          
          // Wait for audio video to be ready
          await new Promise<void>((resolveAudio) => {
            audioVideo.onloadedmetadata = () => resolveAudio();
            audioVideo.onerror = () => resolveAudio(); // Continue without audio on error
            setTimeout(() => resolveAudio(), 2000); // Timeout after 2s
          });
          
          // Create audio context and capture from the audio video element
          audioContext = new AudioContext();
          audioSource = audioContext.createMediaElementSource(audioVideo);
          audioDestination = audioContext.createMediaStreamDestination();
          
          // Create a gain node to control volume (keep it very low to avoid playback)
          const gainNode = audioContext.createGain();
          gainNode.gain.value = 0.001;
          
          // Connect: source -> destination (for recording) and source -> gain -> output (very quiet)
          audioSource.connect(audioDestination);
          audioSource.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          // Add audio tracks to combined stream
          audioDestination.stream.getAudioTracks().forEach(track => {
            combinedStream.addTrack(track);
          });
          
          // Sync the audio video with main video
          video.addEventListener('timeupdate', () => {
            if (Math.abs(audioVideo.currentTime - video.currentTime) > 0.1) {
              audioVideo.currentTime = video.currentTime;
            }
          });
          
          video.addEventListener('play', () => {
            audioVideo.currentTime = video.currentTime;
            audioVideo.play().catch(() => {});
          });
          
          video.addEventListener('pause', () => {
            audioVideo.pause();
          });
          
          video.addEventListener('ended', () => {
            audioVideo.pause();
          });
          
        } catch (audioError) {
          console.warn('Could not set up audio capture, video will have no sound:', audioError);
          // Continue without audio - better than failing completely
        }
        
        // Create MediaRecorder with optimized settings
        let mediaRecorder: MediaRecorder;
        try {
          const recorderOptions: MediaRecorderOptions = {
            mimeType: selectedMimeType,
            videoBitsPerSecond: opts.videoBitrate,
          };
          
          // Only add audio bitrate if we have audio tracks
          if (combinedStream.getAudioTracks().length > 0) {
            recorderOptions.audioBitsPerSecond = opts.audioBitrate;
          }
          
          mediaRecorder = new MediaRecorder(combinedStream, recorderOptions);
        } catch (recorderError) {
          console.warn('Failed to create MediaRecorder:', recorderError);
          URL.revokeObjectURL(objectUrl);
          if (audioContext) audioContext.close();
          resolve(file);
          return;
        }
        
        const chunks: Blob[] = [];
        let recordingStopped = false;
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          if (recordingStopped) return;
          recordingStopped = true;
          
          URL.revokeObjectURL(objectUrl);
          if (audioContext) {
            audioContext.close().catch(() => {});
          }
          
          if (chunks.length === 0) {
            console.warn('No video data recorded, using original');
            resolve(file);
            return;
          }
          
          const blob = new Blob(chunks, { type: selectedMimeType.split(';')[0] });
          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^/.]+$/, '.webm'),
            { type: 'video/webm' }
          );
          
          onProgress?.({
            stage: 'done',
            progress: 100,
            originalSize,
            compressedSize: compressedFile.size,
          });
          
          // Only use compressed if it's actually smaller
          if (compressedFile.size < originalSize && compressedFile.size > 0) {
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        };
        
        mediaRecorder.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          if (audioContext) audioContext.close().catch(() => {});
          console.warn('MediaRecorder error, using original');
          resolve(file);
        };
        
        // Start recording
        try {
          mediaRecorder.start(100); // Collect data every 100ms
        } catch (startError) {
          console.warn('Failed to start recording:', startError);
          URL.revokeObjectURL(objectUrl);
          if (audioContext) audioContext.close().catch(() => {});
          resolve(file);
          return;
        }
        
        // Play video and draw frames to canvas
        video.currentTime = 0;
        
        try {
          await video.play();
        } catch (playError) {
          console.warn('Failed to play video for compression:', playError);
          if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
          URL.revokeObjectURL(objectUrl);
          if (audioContext) audioContext.close().catch(() => {});
          resolve(file);
          return;
        }
        
        const duration = video.duration;
        let lastProgressUpdate = 0;
        
        // Set a maximum recording time
        const maxRecordingTime = Math.min(duration * 1000 + 5000, 300000); // Max 5 min
        const recordingTimeout = setTimeout(() => {
          if (mediaRecorder.state !== 'inactive') {
            video.pause();
            mediaRecorder.stop();
          }
        }, maxRecordingTime);
        
        const drawFrame = () => {
          if (video.paused || video.ended || recordingStopped) {
            if (mediaRecorder.state !== 'inactive') {
              clearTimeout(recordingTimeout);
              mediaRecorder.stop();
            }
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
            clearTimeout(recordingTimeout);
            if (mediaRecorder.state !== 'inactive') {
              mediaRecorder.stop();
            }
          }, 100);
        };
        
      } catch (error) {
        console.warn('Compression error:', error);
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      }
    };
    
    video.onerror = () => {
      clearTimeout(loadTimeout);
      URL.revokeObjectURL(objectUrl);
      console.warn('Failed to load video for compression, using original');
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
  const ratio = ((original - compressed) / original * 100).toFixed(1);
  return `${ratio}%`;
}