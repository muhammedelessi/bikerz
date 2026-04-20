import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/common/SEOHead";
import { useLanguage } from "@/contexts/LanguageContext";
import { useChampions } from "@/hooks/useChampions";
import { useYoutubeVideoDurations } from "@/hooks/useYoutubeVideoDurations";
import { extractYoutubeId } from "@/lib/youtube";
import {
  AMBASSADOR_COUNTRY_FILTER_ALL,
  AMBASSADOR_COUNTRY_FILTER_UNSET,
  ambassadorCountrySearchBlob,
  distinctAmbassadorCountryValues,
  displayAmbassadorCountry,
} from "@/lib/ambassadorCountry";
import {
  AMBASSADOR_CLIP_SELECT_GROUPS,
  allowedCategoriesForClipFilterSelectValue,
  ambassadorClipCardSubLabel,
  ambassadorClipCategorySearchBlob,
  ambassadorClipPublicFilterLeafOptions,
  clipFilterValueForParent,
  filterVideosByAllowedCategories,
} from "@/lib/championAmbassadorClipCategories";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trophy, Search, Filter, MapPin } from "lucide-react";
import ChampionVideoTeaserCard from "@/components/community/ChampionVideoTeaserCard";
import { useIsMobile } from "@/hooks/use-mobile";

const PREVIEW_VIDEO_COUNT_DESKTOP = 3;
const PREVIEW_VIDEO_COUNT_MOBILE = 2;
const PREVIEW_VIDEO_COUNT_MAX = PREVIEW_VIDEO_COUNT_DESKTOP;
const CLIP_CATEGORY_FILTER_ALL = "all" as const;

const CommunityChampions: React.FC = () => {
  const { isRTL } = useLanguage();
  const isMobile = useIsMobile();
  const { data: champions, isLoading } = useChampions();
  const [search, setSearch] = useState("");
  const [clipCategoryFilter, setClipCategoryFilter] = useState<string>(
    CLIP_CATEGORY_FILTER_ALL,
  );
  const [countryFilter, setCountryFilter] = useState<string>(AMBASSADOR_COUNTRY_FILTER_ALL);

  useEffect(() => {
    setClipCategoryFilter((prev) =>
      prev === "think_what_if_tips" ? clipFilterValueForParent("think_what_if") : prev,
    );
  }, []);

  const allowedClipCategories = useMemo(
    () => allowedCategoriesForClipFilterSelectValue(clipCategoryFilter),
    [clipCategoryFilter],
  );

  const countryFilterValues = useMemo(
    () => (champions?.length ? distinctAmbassadorCountryValues(champions) : []),
    [champions],
  );

  const visibleChampions = useMemo(() => {
    if (!champions?.length) return [];
    const q = search.trim().toLowerCase();
    return champions
      .map((c) => {
        const vids = filterVideosByAllowedCategories(c.videos, allowedClipCategories);
        return { champion: c, videos: vids };
      })
      .filter(({ champion: c, videos: vids }) => {
        if (countryFilter !== AMBASSADOR_COUNTRY_FILTER_ALL) {
          const co = (c.country ?? "").trim();
          if (countryFilter === AMBASSADOR_COUNTRY_FILTER_UNSET) {
            if (co !== "") return false;
          } else if (co !== countryFilter) {
            return false;
          }
        }
        if (vids.length === 0) return false;
        if (!q) return true;
        if (c.full_name.toLowerCase().includes(q)) return true;
        if (ambassadorCountrySearchBlob(c.country).includes(q)) return true;
        return vids.some((v) =>
          ambassadorClipCategorySearchBlob(v.ambassador_clip_category).includes(q),
        );
      });
  }, [champions, allowedClipCategories, search, countryFilter]);

  const youtubeIdsForPreviews = useMemo(() => {
    const ids: string[] = [];
    for (const { champion: c, videos: vids } of visibleChampions) {
      for (const v of vids.slice(0, PREVIEW_VIDEO_COUNT_MAX)) {
        const id = extractYoutubeId(v.youtube_url);
        if (id) ids.push(id);
      }
    }
    return ids;
  }, [visibleChampions]);

  const { data: durationMap } = useYoutubeVideoDurations(youtubeIdsForPreviews);

  const title = isRTL ? "السفراء — مجتمع بايكرز" : "Ambassadors — Bikerz community";

  const subtitle = isRTL
    ? "اكتشف سفراء مجتمع بايكرز، صفِّ المقاطع حسب التصنيف والدولة، وابحث بالاسم أو التصنيف أو الدولة."
    : "Discover BIKERZ Ambassadors, filter clips by category and country, and search by name, category, or country.";

  const viewAllLabel = isRTL ? "عرض الكل" : "View all";
  const searchPlaceholder = isRTL
    ? "ابحث عن سفير أو تصنيف أو دولة…"
    : "Search by ambassador, category, or country…";
  const filterCategoryLabel = isRTL ? "تصنيف المقاطع" : "Video category";
  const allClipsLabel = isRTL ? "كل التصنيفات" : "All categories";
  const filterCountryLabel = isRTL ? "الدولة" : "Country";
  const allCountriesLabel = isRTL ? "كل الدول" : "All countries";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SEOHead
        title={title}
        description="Watch videos from BIKERZ Ambassadors. Filter by category and search by name."
        canonical="/community-champions"
      />

      <Navbar />

      <div className="flex flex-1 flex-col pt-[var(--navbar-h)]">
      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border/60 bg-muted/30 px-3 pb-5 pt-6 sm:px-6 sm:pb-8 sm:pt-10">
          <div className="relative mx-auto max-w-5xl text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/12 sm:h-11 sm:w-11 sm:rounded-lg">
              <Trophy className="h-7 w-7 text-primary sm:h-6 sm:w-6" strokeWidth={2} />
            </div>
            <h1 className="mb-2 text-[1.35rem] font-semibold leading-tight tracking-tight text-foreground sm:text-2xl">
              {isRTL ? "السفراء" : "Ambassadors"}
            </h1>
            <p className="mx-auto max-w-xl px-1 text-[13px] leading-relaxed text-muted-foreground sm:px-0 sm:text-sm">
              {subtitle}
            </p>
          </div>
        </section>

        {/* Ambassadors */}
        <section className="px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto max-w-5xl space-y-5 sm:space-y-8">
            {!isLoading && champions && champions.length > 0 && (
              <div
                className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-3 shadow-sm sm:flex-row sm:items-end sm:gap-3 sm:p-4"
                dir={isRTL ? "rtl" : "ltr"}
              >
                {/* Mobile: full-width search alone; desktop: same row as filters, aligned with select row */}
                <div className="flex w-full min-w-0 flex-col gap-1.5 sm:flex-1 sm:min-w-[12rem]">
                  <div className="hidden shrink-0 sm:block sm:h-[14px]" aria-hidden />
                  <div className="relative min-w-0">
                    <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground sm:start-3" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={searchPlaceholder}
                      className="h-11 min-h-[44px] ps-10 text-base sm:h-10 sm:min-h-0 sm:ps-9 sm:text-sm"
                      aria-label={searchPlaceholder}
                    />
                  </div>
                </div>
                {/* Mobile: filters on one row; desktop: continuation of same line */}
                <div className="flex w-full min-w-0 flex-row items-stretch gap-2 sm:w-auto sm:shrink-0 sm:items-end sm:gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:w-[11.5rem] sm:flex-none md:w-[13rem]">
                    <div className="flex min-h-[14px] items-center gap-1.5 text-[11px] font-medium text-muted-foreground sm:text-[10px]">
                      <Filter className="h-3.5 w-3.5 shrink-0 sm:h-3 sm:w-3" />
                      <span>{filterCategoryLabel}</span>
                    </div>
                    <Select
                      value={clipCategoryFilter}
                      onValueChange={(v) => setClipCategoryFilter(v)}
                    >
                      <SelectTrigger
                        className="h-11 min-h-[44px] w-full text-sm sm:h-10 sm:min-h-0 sm:text-xs"
                        dir={isRTL ? "rtl" : "ltr"}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        className="max-h-[min(70vh,420px)]"
                        dir={isRTL ? "rtl" : "ltr"}
                      >
                      <SelectItem value={CLIP_CATEGORY_FILTER_ALL}>{allClipsLabel}</SelectItem>
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
                  {countryFilterValues.length > 0 && (
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:w-[11.5rem] sm:flex-none md:w-[13rem]">
                      <div className="flex min-h-[14px] items-center gap-1.5 text-[11px] font-medium text-muted-foreground sm:text-[10px]">
                        <MapPin className="h-3.5 w-3.5 shrink-0 sm:h-3 sm:w-3" />
                        <span>{filterCountryLabel}</span>
                      </div>
                      <Select value={countryFilter} onValueChange={(v) => setCountryFilter(v)}>
                        <SelectTrigger
                          className="h-11 min-h-[44px] w-full text-sm sm:h-10 sm:min-h-0 sm:text-xs"
                          dir={isRTL ? "rtl" : "ltr"}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent
                          className="max-h-[min(70vh,420px)]"
                          dir={isRTL ? "rtl" : "ltr"}
                        >
                        <SelectItem value={AMBASSADOR_COUNTRY_FILTER_ALL}>
                          {allCountriesLabel}
                        </SelectItem>
                        {countryFilterValues.map((stored) => (
                          <SelectItem
                            key={stored === "" ? AMBASSADOR_COUNTRY_FILTER_UNSET : stored}
                            value={stored === "" ? AMBASSADOR_COUNTRY_FILTER_UNSET : stored}
                            className="text-xs"
                          >
                            {displayAmbassadorCountry(stored === "" ? null : stored, isRTL)}
                          </SelectItem>
                        ))}
                        </SelectContent>
                        </Select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="space-y-6">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="overflow-hidden rounded-xl border border-border/60 bg-card sm:rounded-lg"
                  >
                    <div className="bg-background px-3 pt-3 sm:px-4 sm:pt-5">
                      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                        <Skeleton className="aspect-video rounded-md" />
                        <Skeleton className="aspect-video rounded-md" />
                        <Skeleton className="aspect-video rounded-md" />
                      </div>
                      <div className="-mx-3 mt-3 flex items-center gap-3 border-t border-border/40 bg-background px-3 pb-3 pt-3 sm:-mx-4 sm:border-border/50 sm:bg-muted/20 sm:px-5 sm:py-3.5">
                        <Skeleton className="h-[3.25rem] w-[3.25rem] shrink-0 rounded-full sm:h-16 sm:w-16" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-2.5 w-16 rounded" />
                          <Skeleton className="h-4 w-40 rounded" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : !champions || champions.length === 0 ? (
              <div className="rounded-xl border border-border/60 bg-card px-4 py-9 text-center sm:rounded-lg sm:px-6 sm:py-10">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted sm:rounded-lg">
                  <Trophy className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-base font-medium text-foreground">
                  {isRTL ? "لا يوجد سفراء بعد" : "No Ambassadors yet"}
                </p>
                <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground sm:mt-1.5 sm:text-xs">
                  {isRTL
                    ? "ترقّب إضافة سفراء المجتمع قريباً."
                    : "Community Ambassadors will appear here soon."}
                </p>
              </div>
            ) : visibleChampions.length === 0 ? (
              <div className="rounded-xl border border-border/60 bg-card px-4 py-9 text-center sm:rounded-lg sm:px-6 sm:py-10">
                <p className="text-base font-medium text-foreground">
                  {isRTL ? "لا نتائج" : "No results"}
                </p>
                <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground sm:mt-1.5 sm:text-xs">
                  {isRTL
                    ? "جرّب تغيير البحث أو تصنيف المقاطع."
                    : "Try adjusting your search or video category filter."}
                </p>
              </div>
            ) : (
              visibleChampions.map(({ champion: c, videos: vids }) => {
                const previewLimit = isMobile
                  ? PREVIEW_VIDEO_COUNT_MOBILE
                  : PREVIEW_VIDEO_COUNT_DESKTOP;
                const initials = c.full_name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                const preview = vids.slice(0, previewLimit);
                const hasMore = vids.length > previewLimit;

                return (
                  <article
                    key={c.id}
                    dir={isRTL ? "rtl" : "ltr"}
                    className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm sm:rounded-lg sm:shadow-none"
                  >
                    <div className="bg-background px-2.5 pt-3.5 sm:px-4 sm:pt-5">
                      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 min-[420px]:gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-4">
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
                      <footer className="-mx-2.5 mt-3 flex min-w-0 items-center justify-between gap-3 border-t border-border/40 bg-background px-2.5 pb-3 pt-3 sm:-mx-4 sm:border-border/50 sm:bg-muted/20 sm:px-5 sm:py-3.5">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <Avatar className="h-[3.25rem] w-[3.25rem] shrink-0 rounded-full border border-border sm:h-16 sm:w-16">
                            {c.photo_url && (
                              <AvatarImage src={c.photo_url} alt={c.full_name} />
                            )}
                            <AvatarFallback className="rounded-full text-sm font-semibold bg-primary/15 text-primary">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 py-0.5">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {isRTL ? "سفير المجتمع" : "Community Ambassador"}
                            </p>
                            <p className="line-clamp-2 text-[1.0625rem] font-semibold leading-snug tracking-tight text-foreground sm:line-clamp-1 sm:truncate sm:text-lg">
                              {c.full_name}
                            </p>
                          </div>
                        </div>
                        {hasMore && (
                          <Button
                            asChild
                            variant="default"
                            size="sm"
                            className="h-9 shrink-0 px-3 text-xs sm:h-8"
                          >
                            <Link to={`/community-champions/${c.id}`}>{viewAllLabel}</Link>
                          </Button>
                        )}
                      </footer>
                    </div>
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
