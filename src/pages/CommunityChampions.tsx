import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/common/SEOHead";
import { useLanguage } from "@/contexts/LanguageContext";
import { useChampions } from "@/hooks/useChampions";
import { useYoutubeVideoDurations } from "@/hooks/useYoutubeVideoDurations";
import { extractYoutubeId } from "@/lib/youtube";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Trophy, Video } from "lucide-react";
import ChampionVideoTeaserCard from "@/components/community/ChampionVideoTeaserCard";

const PREVIEW_VIDEO_COUNT = 3;

const CommunityChampions: React.FC = () => {
  const { isRTL } = useLanguage();
  const { data: champions, isLoading } = useChampions();

  const youtubeIdsForPreviews = useMemo(() => {
    if (!champions?.length) return [];
    const ids: string[] = [];
    for (const c of champions) {
      for (const v of c.videos.slice(0, PREVIEW_VIDEO_COUNT)) {
        const id = extractYoutubeId(v.youtube_url);
        if (id) ids.push(id);
      }
    }
    return ids;
  }, [champions]);

  const { data: durationMap } = useYoutubeVideoDurations(youtubeIdsForPreviews);

  const title = isRTL ? "أبطال المجتمع" : "Community Champions";
  const subtitle = isRTL
    ? "اكتشف أبطال مجتمع BIKERZ وشاهد مقاطعهم المميزة."
    : "Discover BIKERZ community champions and watch their standout videos.";

  const viewAllLabel = isRTL ? "عرض الكل" : "View all";
  const previewLabel = isRTL ? "أحدث المقاطع" : "Latest clips";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SEOHead
        title={title}
        description="Watch videos from BIKERZ community champions. Like and comment when signed in."
        canonical="/community-champions"
      />

      <Navbar />

      <div className="flex flex-1 flex-col pt-[var(--navbar-h)]">
      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border/60 bg-muted/30 px-4 pb-6 pt-8 sm:px-6 sm:pb-8 sm:pt-10">
          <div className="relative mx-auto max-w-5xl text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/12">
              <Trophy className="h-6 w-6 text-primary" strokeWidth={2} />
            </div>
            <h1 className="mb-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {title}
            </h1>
            <p className="mx-auto max-w-xl text-xs leading-snug text-muted-foreground sm:text-sm">
              {subtitle}
            </p>
          </div>
        </section>

        {/* Champions */}
        <section className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto max-w-5xl space-y-6 sm:space-y-8">
            {isLoading ? (
              <div className="space-y-6">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="overflow-hidden rounded-lg border border-border/60"
                  >
                    <div className="flex flex-row-reverse items-center justify-between gap-3 border-b border-border/50 bg-card px-4 py-3 sm:px-5">
                      <Skeleton className="h-8 w-24 rounded-md" />
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
                        <Skeleton className="h-6 w-36" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 bg-background p-3 sm:grid-cols-3 sm:gap-3">
                      <Skeleton className="aspect-video rounded-md" />
                      <Skeleton className="aspect-video rounded-md" />
                      <Skeleton className="aspect-video rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !champions || champions.length === 0 ? (
              <div className="rounded-lg border border-border/60 bg-card px-6 py-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <Trophy className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {isRTL ? "لا يوجد أبطال بعد" : "No champions yet"}
                </p>
                <p className="mx-auto mt-1.5 max-w-sm text-xs text-muted-foreground">
                  {isRTL
                    ? "ترقّب إضافة أبطال المجتمع قريباً."
                    : "Community champions will appear here soon."}
                </p>
              </div>
            ) : (
              champions.map((c) => {
                const initials = c.full_name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                const preview = c.videos.slice(0, PREVIEW_VIDEO_COUNT);
                const hasMore = c.videos.length > PREVIEW_VIDEO_COUNT;

                return (
                  <article
                    key={c.id}
                    dir={isRTL ? "rtl" : "ltr"}
                    className="overflow-hidden rounded-lg border border-border/60 bg-card"
                  >
                    <header className="flex flex-col gap-3 border-b border-border/50 bg-muted/20 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="h-14 w-14 shrink-0 rounded-lg border border-border sm:h-16 sm:w-16">
                          {c.photo_url && (
                            <AvatarImage src={c.photo_url} alt={c.full_name} />
                          )}
                          <AvatarFallback className="rounded-lg text-sm font-semibold bg-primary/15 text-primary">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 py-0.5">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {isRTL ? "البطل" : "Champion"}
                          </p>
                          <p className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
                            {c.full_name}
                          </p>
                        </div>
                      </div>
                      {hasMore && (
                        <Button
                          asChild
                          variant="default"
                          size="sm"
                          className="w-full shrink-0 sm:w-auto"
                        >
                          <Link to={`/community-champions/${c.id}`}>{viewAllLabel}</Link>
                        </Button>
                      )}
                    </header>

                    {c.videos.length === 0 ? (
                      <div className="px-4 py-8 text-center sm:px-5">
                        <p className="text-xs text-muted-foreground">
                          {isRTL ? "لا توجد فيديوهات بعد." : "No videos yet."}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-background px-3 py-4 sm:px-4 sm:py-5">
                        <div className="mb-3 flex items-center gap-1.5 text-muted-foreground">
                          <Video className="h-3.5 w-3.5 shrink-0 text-primary/80" />
                          <span className="text-[11px] font-medium uppercase tracking-wide">
                            {previewLabel}
                          </span>
                          <span className="text-[11px] opacity-70">
                            ({preview.length}
                            {hasMore ? "+" : ""})
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-4">
                          {preview.map((v) => {
                            const yt = extractYoutubeId(v.youtube_url);
                            const fetched = yt && durationMap ? durationMap[yt] : undefined;
                            return (
                              <ChampionVideoTeaserCard
                                key={v.id}
                                video={v}
                                championId={c.id}
                                durationSeconds={fetched}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </main>

      <Footer />
      </div>
    </div>
  );
};

export default CommunityChampions;
