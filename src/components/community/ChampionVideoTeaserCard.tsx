import React from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  extractYoutubeId,
  youtubeThumbnailUrl,
  formatDurationSeconds,
} from "@/lib/youtube";
import type { ChampionVideoRow } from "@/hooks/useChampions";

interface Props {
  video: ChampionVideoRow;
  championId: string;
  durationSeconds?: number | null;
}

/**
 * Compact YouTube-style card: thumbnail on top, title + type below.
 * Dense padding, small type scale.
 */
const ChampionVideoTeaserCard: React.FC<Props> = ({
  video,
  championId,
  durationSeconds,
}) => {
  const { isRTL } = useLanguage();
  const videoId = extractYoutubeId(video.youtube_url);
  const thumbnail =
    video.thumbnail_url || (videoId ? youtubeThumbnailUrl(videoId) : null);
  const isPodcast = video.video_type === "podcast";

  const fromDb = video.duration_seconds;
  const effectiveSec =
    (typeof fromDb === "number" && fromDb > 0 ? fromDb : null) ??
    (typeof durationSeconds === "number" && durationSeconds > 0
      ? durationSeconds
      : null);

  const typeShort = isPodcast
    ? isRTL
      ? "بودكاست"
      : "Podcast"
    : isRTL
      ? "فيديو"
      : "Video";

  return (
    <Link
      to={`/community-champions/${championId}/videos/${video.id}`}
      className={cn(
        "group block overflow-hidden rounded-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="h-full w-full bg-muted" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-60" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white">
            <Play className="h-5 w-5 translate-x-0.5 fill-current" />
          </span>
        </div>
        {effectiveSec != null && (
          <span className="absolute bottom-1 end-1 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
            {formatDurationSeconds(effectiveSec)}
          </span>
        )}
      </div>
      <div className="pt-2">
        <h3 className="line-clamp-2 text-sm font-medium leading-tight text-foreground group-hover:text-primary">
          {video.title}
        </h3>
        <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{typeShort}</p>
      </div>
    </Link>
  );
};

export default ChampionVideoTeaserCard;
