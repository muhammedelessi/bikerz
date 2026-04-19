import { useQuery } from "@tanstack/react-query";

function parseIso8601Duration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const h = parseInt(m[1] || "0", 10);
  const min = parseInt(m[2] || "0", 10);
  const s = parseInt(m[3] || "0", 10);
  return h * 3600 + min * 60 + s;
}

async function fetchDurationFromGoogleApi(videoId: string): Promise<number | null> {
  const key = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;
  if (!key?.trim()) return null;
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(key)}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const iso = j?.items?.[0]?.contentDetails?.duration as string | undefined;
    if (iso) return parseIso8601Duration(iso);
  } catch {
    /* ignore */
  }
  return null;
}

async function fetchDurationFromInvidious(videoId: string): Promise<number | null> {
  const mirrors = [
    "https://invidious.privacyredirect.com",
    "https://vid.puffyan.us",
    "https://inv.nadeko.net",
  ];
  for (const base of mirrors) {
    try {
      const r = await fetch(`${base}/api/v1/videos/${encodeURIComponent(videoId)}`);
      if (!r.ok) continue;
      const j = await r.json();
      if (typeof j.lengthSeconds === "number") return j.lengthSeconds;
    } catch {
      /* next mirror */
    }
  }
  return null;
}

async function fetchOneDuration(videoId: string): Promise<number | null> {
  const fromGoogle = await fetchDurationFromGoogleApi(videoId);
  if (fromGoogle != null) return fromGoogle;
  return fetchDurationFromInvidious(videoId);
}

/**
 * Resolve YouTube durations for a list of video IDs (deduped).
 * Uses VITE_YOUTUBE_API_KEY when set, otherwise tries public Invidious mirrors (best-effort).
 */
export function useYoutubeVideoDurations(youtubeIds: (string | null | undefined)[]) {
  const unique = [...new Set(youtubeIds.filter((id): id is string => !!id && id.length === 11))];
  const key = unique.slice().sort().join(",");

  return useQuery<Record<string, number>>({
    queryKey: ["youtube-durations", key],
    enabled: unique.length > 0,
    staleTime: 1000 * 60 * 60 * 24,
    queryFn: async () => {
      const out: Record<string, number> = {};
      await Promise.all(
        unique.map(async (id) => {
          const sec = await fetchOneDuration(id);
          if (sec != null) out[id] = sec;
        }),
      );
      return out;
    },
  });
}
