/**
 * Extract a YouTube video ID from any common YouTube URL format.
 * Supports:
 *  - https://www.youtube.com/watch?v=VIDEO_ID
 *  - https://youtu.be/VIDEO_ID
 *  - https://www.youtube.com/embed/VIDEO_ID
 *  - https://www.youtube.com/shorts/VIDEO_ID
 *  - https://www.youtube.com/live/VIDEO_ID
 *  - Bare video IDs (11 chars)
 */
export function extractYoutubeId(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Already a bare ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.replace(/^\//, "").split("/")[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const vParam = url.searchParams.get("v");
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) return vParam;

      const parts = url.pathname.split("/").filter(Boolean);
      const [first, second] = parts;
      if (first && ["embed", "shorts", "live", "v"].includes(first) && second) {
        const id = second.split("?")[0];
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
      }
    }
  } catch {
    // not a URL
  }
  return null;
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** Format seconds as mm:ss or h:mm:ss */
export function formatDurationSeconds(total: number): string {
  if (!Number.isFinite(total) || total < 0) return "0:00";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}
