import React from "react";
import LocalizedLink from "@/components/common/LocalizedLink";
import { useLanguage } from "@/contexts/LanguageContext";
import { Play, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  extractYoutubeId,
  youtubeThumbnailUrl,
  formatDurationSeconds,
} from "@/lib/youtube";
import type { ChampionVideoRow } from "@/hooks/useChampions";
import { ambassadorClipCardSubLabel } from "@/lib/championAmbassadorClipCategories";

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

  const clipCat = video.ambassador_clip_category ?? null;
  const clipLine =
    clipCat != null ? ambassadorClipCardSubLabel(clipCat, isRTL) : null;

  return (
    <LocalizedLink
      to={`/community-champions/${championId}/videos/${video.id}`}
      className={cn(
        "group flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/40 bg-card/40 p-1.5 shadow-sm",
        "touch-manipulation transition-[box-shadow,transform,background-color] active:scale-[0.99] active:bg-muted/30",
        "sm:rounded-lg sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:active:scale-100 sm:active:bg-transparent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
      )}
    >
      <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-black ring-1 ring-black/10 sm:rounded-md sm:ring-0">
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
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-25 transition-opacity group-hover:opacity-100 sm:opacity-0">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/65 text-white shadow-lg sm:h-11 sm:w-11">
            <Play className="h-5 w-5 translate-x-0.5 fill-current sm:h-5" />
          </span>
        </div>
        {effectiveSec != null && (
          <span className="absolute bottom-1.5 end-1.5 rounded-md bg-black/85 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white sm:bottom-1 sm:end-1 sm:rounded sm:px-1.5">
            {formatDurationSeconds(effectiveSec)}
          </span>
        )}
      </div>
      <div className="flex min-h-[4.5rem] flex-1 flex-col px-0.5 pb-1 pt-2.5 sm:min-h-[4.25rem] sm:px-0 sm:pb-0 sm:pt-2">
        {clipLine && (
          <p className="line-clamp-2 text-xs leading-snug text-primary/95 sm:text-[11px]">
            {clipLine}
          </p>
        )}
        <h3
          className={cn(
            "line-clamp-2 text-base font-semibold leading-snug tracking-tight text-foreground group-hover:text-primary",
            clipLine ? "mt-2 sm:mt-1.5" : "",
          )}
        >
          {video.title}
        </h3>
        <div className="mt-auto pt-2.5 sm:pt-2">
          {isPodcast ? (
            <span
              className={cn(
                "inline-flex min-h-[30px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold sm:min-h-0 sm:gap-1 sm:px-2 sm:py-0.5 sm:text-[11px]",
                "border-amber-500/45 bg-amber-500/15 text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/20 dark:text-amber-200",
              )}
            >
              <Radio className="h-3.5 w-3.5 shrink-0 sm:h-3 sm:w-3" aria-hidden />
              {typeShort}
            </span>
          ) : (
            <span className="inline-flex min-h-[28px] items-center text-xs font-medium leading-tight text-muted-foreground sm:min-h-0 sm:text-[11px]">
              {typeShort}
            </span>
          )}
        </div>
      </div>
    </LocalizedLink>
  );
};

export default ChampionVideoTeaserCard;
