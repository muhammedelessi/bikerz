import React, { useMemo } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/common/SEOHead";
import { useLanguage } from "@/contexts/LanguageContext";
import { useChampionById } from "@/hooks/useChampions";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, ChevronRight, Trophy, Play, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import ChampionVideoPlayer from "@/components/community/ChampionVideoPlayer";
import {
  ambassadorClipCardSubLabel,
  isAmbassadorClipCategory,
} from "@/lib/championAmbassadorClipCategories";

const ChampionVideoDetail: React.FC = () => {
  const { championId, videoId } = useParams<{ championId: string; videoId: string }>();
  const location = useLocation();
  const { isRTL } = useLanguage();
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  const returnTo = `${location.pathname}${location.search}`;
  const { data: champion, isLoading } = useChampionById(championId);

  const video = useMemo(
    () => champion?.videos.find((v) => v.id === videoId) ?? null,
    [champion, videoId],
  );

  const pageTitle = video?.title ?? (isRTL ? "فيديو" : "Video");
  const isPodcast = video?.video_type === "podcast";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title={pageTitle}
        description={
          video?.description?.slice(0, 160) ??
          "Watch and discuss BIKERZ Ambassador videos."
        }
        canonical={
          championId && videoId
            ? `/community-champions/${championId}/videos/${videoId}`
            : "/community-champions"
        }
      />
      <Navbar />

      <div className="flex flex-1 flex-col pt-[var(--navbar-h)]">
      <main className="flex-1">
        <div className="bg-background">
          <div
            className="mx-auto max-w-4xl space-y-4 px-4 py-5 sm:space-y-5 sm:px-6 sm:py-6 lg:px-8"
            dir={isRTL ? "rtl" : "ltr"}
          >
            {/* Breadcrumb row */}
            <nav
              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2"
              aria-label="Breadcrumb"
            >
              <div className="flex flex-wrap items-center gap-1">
                <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" asChild>
                  <Link to="/community-champions">
                    <BackIcon className="h-4 w-4" />
                    {isRTL ? "السفراء" : "Ambassadors"}
                  </Link>
                </Button>
                {champion && (
                  <>
                    <span className="text-muted-foreground/50">/</span>
                    <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" asChild>
                      <Link to={`/community-champions/${champion.id}`}>
                        {isRTL ? "قائمة الفيديو" : "All videos"}
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </nav>

            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-3/4 max-w-md rounded-lg" />
                <Skeleton className="h-4 w-40 rounded" />
                <Skeleton className="aspect-video w-full max-w-4xl rounded-2xl" />
                <Skeleton className="h-32 rounded-2xl" />
              </div>
            ) : !champion || !video ? (
              <div className="rounded-lg border border-border/60 bg-card px-6 py-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <Trophy className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {isRTL ? "الفيديو غير موجود." : "Video not found."}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isRTL ? "تحقق من الرابط أو عد إلى السفراء." : "Check the link or go back to Ambassadors."}
                </p>
                <Button asChild variant="default" size="sm" className="mt-4">
                  <Link to="/community-champions">{isRTL ? "السفراء" : "Ambassadors"}</Link>
                </Button>
              </div>
            ) : (
              <>
                {/* Page title + meta */}
                <header className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "gap-0.5 rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                        isPodcast
                          ? "border border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          : "border border-primary/20 bg-primary/10 text-primary",
                      )}
                    >
                      {isPodcast ? (
                        <Radio className="h-3 w-3" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      {isPodcast ? (isRTL ? "بودكاست" : "Podcast") : isRTL ? "فيديو" : "Video"}
                    </Badge>
                  </div>
                  {video.ambassador_clip_category &&
                    isAmbassadorClipCategory(video.ambassador_clip_category) && (
                      <p className="mt-1.5 text-[11px] leading-snug text-primary">
                        {ambassadorClipCardSubLabel(video.ambassador_clip_category, isRTL)}
                      </p>
                    )}
                  <h1
                    className={cn(
                      "text-pretty text-lg font-semibold leading-snug tracking-tight text-foreground sm:text-xl",
                      video.ambassador_clip_category &&
                        isAmbassadorClipCategory(video.ambassador_clip_category)
                        ? "mt-1.5"
                        : "",
                    )}
                  >
                    {video.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-9 w-9 border border-border sm:h-10 sm:w-10">
                        {champion.photo_url && (
                          <AvatarImage src={champion.photo_url} alt="" />
                        )}
                        <AvatarFallback className="text-[10px] font-semibold bg-primary/15 text-primary sm:text-xs">
                          {champion.full_name
                            .split(" ")
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {isRTL ? "السفير" : "Ambassador"}
                        </p>
                        <p className="truncate text-xs font-medium text-foreground sm:text-sm">
                          {champion.full_name}
                        </p>
                      </div>
                    </div>
                  </div>
                </header>

                <Separator className="opacity-60" />

                <ChampionVideoPlayer
                  video={video}
                  championName={champion.full_name}
                  defaultCommentsOpen
                  returnTo={returnTo}
                  showTitleInCard={false}
                />
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
      </div>
    </div>
  );
};

export default ChampionVideoDetail;
