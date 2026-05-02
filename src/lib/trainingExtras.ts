// Shared parsers for the trainings.videos and trainings.skills jsonb columns.
// Kept dependency-free so both admin and public pages can import safely.

export type TrainingVideo = {
  title_ar: string;
  title_en: string;
  url: string;
};

export type TrainingSkill = {
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  points: number;
};

export function parseTrainingVideos(raw: unknown): TrainingVideo[] {
  if (!raw || !Array.isArray(raw)) return [];
  return (raw as unknown[])
    .map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      return {
        title_ar: String(o.title_ar ?? '').trim(),
        title_en: String(o.title_en ?? '').trim(),
        url: String(o.url ?? '').trim(),
      };
    })
    .filter((v) => v.url.length > 0);
}

export function parseTrainingSkills(raw: unknown): TrainingSkill[] {
  if (!raw || !Array.isArray(raw)) return [];
  return (raw as unknown[])
    .map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      return {
        name_ar: String(o.name_ar ?? '').trim(),
        name_en: String(o.name_en ?? '').trim(),
        description_ar: String(o.description_ar ?? '').trim(),
        description_en: String(o.description_en ?? '').trim(),
        points: Number.isFinite(Number(o.points)) ? Math.max(0, Math.floor(Number(o.points))) : 0,
      };
    })
    .filter((s) => s.name_ar.length > 0 || s.name_en.length > 0);
}

/**
 * Convert a YouTube watch / shorts / share URL to an embeddable URL.
 * Returns the original string if it does not look like a YouTube link
 * (so admins can paste Bunny embed iframes / Vimeo / etc.)
 */
export function toEmbeddableVideoUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';

  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace(/^www\./, '');

    // youtu.be/<id>
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\/+/, '').split('/')[0];
      return id ? `https://www.youtube.com/embed/${id}` : trimmed;
    }
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      // /watch?v=ID
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
      // /shorts/ID  or  /embed/ID  or  /live/ID
      const parts = u.pathname.split('/').filter(Boolean);
      const idx = parts.findIndex((p) => p === 'shorts' || p === 'embed' || p === 'live');
      if (idx >= 0 && parts[idx + 1]) {
        return `https://www.youtube.com/embed/${parts[idx + 1]}`;
      }
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}
