import React, { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/common/SEOHead";
import { useLanguage } from "@/contexts/LanguageContext";
import { useChampionById } from "@/hooks/useChampions";
import { useYoutubeVideoDurations } from "@/hooks/useYoutubeVideoDurations";
import { extractYoutubeId } from "@/lib/youtube";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, ChevronRight, Trophy, LayoutGrid } from "lucide-react";
import ChampionVideoTeaserCard from "@/components/community/ChampionVideoTeaserCard";

const ChampionVideosList: React.FC = () => {
  const { championId } = useParams<{ championId: string }>();
  const { isRTL } = useLanguage();
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const { data: champion, isLoading } = useChampionById(championId);

  const ytIds = useMemo(() => {
    if (!champion?.videos?.length) return [];
    return champion.videos
      .map((v) => extractYoutubeId(v.youtube_url))
      .filter((id): id is string => !!id);
  }, [champion]);

  const { data: durationMap } = useYoutubeVideoDurations(ytIds);

  const title = champion
    ? isRTL
      ? `فيديوهات ${champion.full_name}`
      : `${champion.full_name} — Videos`
    : isRTL
      ? "فيديوهات البطل"
      : "Champion videos";

  const gridLabel = isRTL ? "المكتبة" : "Library";
  const backLabel = isRTL ? "أبطال المجتمع" : "Community Champions";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SEOHead
        title={title}
        description="Watch all videos from this BIKERZ community champion."
        canonical={championId ? `/community-champions/${championId}` : "/community-champions"}
      />
      <Navbar />

      <div className="flex flex-1 flex-col pt-[var(--navbar-h)]">
      <main className="flex-1">
        <div className="bg-background">
          <div
            className="mx-auto max-w-5xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-6 lg:px-8"
            dir={isRTL ? "rtl" : "ltr"}
          >
            <nav aria-label="Breadcrumb">
              <Button variant="ghost" size="sm" className="-ms-2 h-8 gap-1 px-2 text-xs" asChild>
                <Link to="/community-champions">
                  <BackIcon className="h-4 w-4" />
                  {backLabel}
                </Link>
              </Button>
            </nav>

            {isLoading ? (
              <div className="space-y-5">
                <Skeleton className="h-24 rounded-lg sm:h-20" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-video rounded-md" />
                  ))}
                </div>
              </div>
            ) : !champion ? (
              <div className="rounded-lg border border-border/60 bg-card px-6 py-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <Trophy className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {isRTL ? "البطل غير موجود أو غير متاح." : "Champion not found."}
                </p>
                <Button asChild variant="default" size="sm" className="mt-4">
                  <Link to="/community-champions">{backLabel}</Link>
                </Button>
              </div>
            ) : (
              <>
                <header className="overflow-hidden rounded-lg border border-border/60 bg-card">
                  <div className="flex flex-col items-center gap-4 bg-muted/20 px-4 py-5 text-center sm:flex-row sm:items-center sm:text-start sm:px-5 sm:py-5">
                    <Avatar className="h-20 w-20 shrink-0 rounded-lg border border-border sm:h-24 sm:w-24">
                      {champion.photo_url && (
                        <AvatarImage src={champion.photo_url} alt={champion.full_name} />
                      )}
                      <AvatarFallback className="rounded-lg text-lg font-semibold bg-primary/15 text-primary">
                        {champion.full_name
                          .split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {isRTL ? "بطل المجتمع" : "Community champion"}
                      </p>
                      <h1 className="text-pretty text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                        {champion.full_name}
                      </h1>
                      <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                        <Badge variant="secondary" className="text-xs font-normal">
                          <LayoutGrid className="me-1 h-3 w-3" />
                          {champion.videos.length}{" "}
                          {isRTL
                            ? champion.videos.length === 1
                              ? "فيديو"
                              : "فيديوهات"
                            : champion.videos.length === 1
                              ? "video"
                              : "videos"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </header>

                <Separator className="opacity-40" />

                {champion.videos.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/60 bg-muted/15 py-10 text-center">
                    <p className="text-xs text-muted-foreground">
                      {isRTL ? "لا توجد فيديوهات بعد." : "No videos yet."}
                    </p>
                  </div>
                ) : (
                  <section className="space-y-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <LayoutGrid className="h-3.5 w-3.5 text-primary" />
                      <h2 className="text-[11px] font-semibold uppercase tracking-wide">
                        {gridLabel}
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-4">
                      {champion.videos.map((v) => {
                        const yt = extractYoutubeId(v.youtube_url);
                        const fetched = yt && durationMap ? durationMap[yt] : undefined;
                        return (
                          <ChampionVideoTeaserCard
                            key={v.id}
                            video={v}
                            championId={champion.id}
                            durationSeconds={fetched}
                          />
                        );
                      })}
                    </div>
                  </section>
                )}
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

export default ChampionVideosList;
