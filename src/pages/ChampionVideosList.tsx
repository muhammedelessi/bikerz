import React, { useEffect, useMemo, useState } from "react";
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
import { ChevronLeft, ChevronRight, Trophy, LayoutGrid, Filter, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import ChampionVideoTeaserCard from "@/components/community/ChampionVideoTeaserCard";
import {
  AMBASSADOR_CLIP_SELECT_GROUPS,
  allowedCategoriesForClipFilterSelectValue,
  ambassadorClipCardSubLabel,
  ambassadorClipCategorySearchBlob,
  ambassadorClipPublicFilterLeafOptions,
  clipFilterValueForParent,
} from "@/lib/championAmbassadorClipCategories";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CLIP_CATEGORY_FILTER_ALL = "all" as const;

const ChampionVideosList: React.FC = () => {
  const { championId } = useParams<{ championId: string }>();
  const { isRTL } = useLanguage();
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const { data: champion, isLoading } = useChampionById(championId);
  const [clipCategoryFilter, setClipCategoryFilter] = useState<string>(
    CLIP_CATEGORY_FILTER_ALL,
  );
  const [search, setSearch] = useState("");

  useEffect(() => {
    setClipCategoryFilter(CLIP_CATEGORY_FILTER_ALL);
    setSearch("");
  }, [championId]);

  useEffect(() => {
    setClipCategoryFilter((prev) =>
      prev === "think_what_if_tips" ? clipFilterValueForParent("think_what_if") : prev,
    );
  }, []);

  const allowedClipCategories = useMemo(
    () => allowedCategoriesForClipFilterSelectValue(clipCategoryFilter),
    [clipCategoryFilter],
  );

  const filteredVideos = useMemo(() => {
    if (!champion?.videos?.length) return [];
    if (!allowedClipCategories) return champion.videos;
    return champion.videos.filter(
      (v) =>
        v.ambassador_clip_category != null &&
        allowedClipCategories.has(v.ambassador_clip_category),
    );
  }, [champion, allowedClipCategories]);

  const searchFilteredVideos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return filteredVideos;
    return filteredVideos.filter((v) => {
      const titleHit = v.title.toLowerCase().includes(q);
      const catHit = ambassadorClipCategorySearchBlob(v.ambassador_clip_category).includes(q);
      return titleHit || catHit;
    });
  }, [filteredVideos, search]);

  const ytIds = useMemo(() => {
    if (!searchFilteredVideos.length) return [];
    return searchFilteredVideos
      .map((v) => extractYoutubeId(v.youtube_url))
      .filter((id): id is string => !!id);
  }, [searchFilteredVideos]);

  const { data: durationMap } = useYoutubeVideoDurations(ytIds);

  const title = champion
    ? isRTL
      ? `مقاطع ${champion.full_name}`
      : `${champion.full_name} — Videos`
    : isRTL
      ? "مقاطع السفير"
      : "Ambassador videos";

  const gridLabel = isRTL ? "المكتبة" : "Library";
  const backLabel = isRTL ? "السفراء" : "Ambassadors";
  const filterCategoryLabel = isRTL ? "تصنيف المقاطع" : "Video category";
  const allClipsLabel = isRTL ? "كل التصنيفات" : "All categories";
  const searchPlaceholder = isRTL
    ? "ابحث في العنوان أو التصنيف…"
    : "Search by title or category…";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SEOHead
        title={title}
        description="Watch all videos from this BIKERZ Ambassador."
        canonical={championId ? `/community-champions/${championId}` : "/community-champions"}
      />
      <Navbar />

      <div className="flex flex-1 flex-col pt-[var(--navbar-h)]">
      <main className="flex-1">
        <div className="bg-background">
          <div
            className="mx-auto max-w-5xl space-y-5 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-6 lg:px-8"
            dir={isRTL ? "rtl" : "ltr"}
          >
            <nav aria-label="Breadcrumb">
              <Button variant="ghost" size="sm" className="-ms-2 min-h-10 gap-1 px-2 text-xs sm:min-h-8" asChild>
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
                  {isRTL ? "السفير غير موجود أو غير متاح." : "Ambassador not found."}
                </p>
                <Button asChild variant="default" size="sm" className="mt-4">
                  <Link to="/community-champions">{backLabel}</Link>
                </Button>
              </div>
            ) : (
              <>
                <header className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm sm:rounded-lg sm:shadow-none">
                  <div className="flex flex-col items-center gap-3 bg-muted/20 px-3 py-4 text-center sm:flex-row sm:items-center sm:gap-4 sm:px-5 sm:py-5 sm:text-start">
                    <Avatar className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-full border border-border sm:h-24 sm:w-24">
                      {champion.photo_url && (
                        <AvatarImage src={champion.photo_url} alt={champion.full_name} />
                      )}
                      <AvatarFallback className="rounded-full text-lg font-semibold bg-primary/15 text-primary">
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
                        {isRTL ? "سفير المجتمع" : "Community Ambassador"}
                      </p>
                      <h1 className="text-pretty text-[1.125rem] font-semibold leading-snug tracking-tight text-foreground sm:text-xl">
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
                  <section className="space-y-3 sm:space-y-4">
                    <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-3 shadow-sm sm:gap-4 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                      <div className="relative w-full sm:max-w-md">
                        <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground sm:start-3" />
                        <Input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder={searchPlaceholder}
                          className="h-11 min-h-[44px] ps-10 text-base sm:h-10 sm:min-h-0 sm:ps-9 sm:text-sm"
                          dir={isRTL ? "rtl" : "ltr"}
                          aria-label={searchPlaceholder}
                        />
                      </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <LayoutGrid className="h-3.5 w-3.5 text-primary" />
                        <h2 className="text-[11px] font-semibold uppercase tracking-wide">
                          {gridLabel}
                        </h2>
                      </div>
                      <div className="flex w-full flex-col gap-1.5 sm:max-w-md sm:gap-3">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground sm:text-[10px]">
                          <Filter className="h-3.5 w-3.5 shrink-0 sm:h-3 sm:w-3" />
                          <span>{filterCategoryLabel}</span>
                        </div>
                        <Select
                          value={clipCategoryFilter}
                          onValueChange={(v) => setClipCategoryFilter(v)}
                        >
                          <SelectTrigger
                            className="h-11 min-h-[44px] text-sm sm:h-9 sm:min-h-0 sm:text-xs"
                            dir={isRTL ? "rtl" : "ltr"}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent
                            className="max-h-[min(70vh,420px)]"
                            dir={isRTL ? "rtl" : "ltr"}
                          >
                            <SelectItem value={CLIP_CATEGORY_FILTER_ALL}>
                              {allClipsLabel}
                            </SelectItem>
                            {AMBASSADOR_CLIP_SELECT_GROUPS.map((g) => {
                              const leafOpts = ambassadorClipPublicFilterLeafOptions(g);
                              return (
                                <SelectGroup key={g.heading.en}>
                                  <SelectItem
                                    value={clipFilterValueForParent(g.parent)}
                                    className="text-xs font-semibold"
                                  >
                                    {isRTL ? g.heading.ar : g.heading.en}
                                  </SelectItem>
                                  {leafOpts.map((o) => (
                                    <SelectItem
                                      key={o.value}
                                      value={o.value}
                                      className="ps-6 text-xs font-normal"
                                    >
                                      {ambassadorClipCardSubLabel(o.value, isRTL) ?? ""}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    </div>
                    {searchFilteredVideos.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border/60 bg-muted/15 py-8 text-center">
                        <p className="text-xs text-muted-foreground">
                          {isRTL
                            ? "لا توجد مقاطع تطابق التصنيف أو البحث."
                            : "No clips match this category or search."}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 min-[420px]:gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-4">
                        {searchFilteredVideos.map((v) => {
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
                    )}
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
