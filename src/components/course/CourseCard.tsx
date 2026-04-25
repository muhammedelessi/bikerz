import React from "react";

import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Clock, BookOpen, ArrowRight, ArrowLeft, Star, Trophy, ShoppingCart, Unlock, Play } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { getSupabaseStorageWebpUrl } from "@/lib/supabaseStorageImage";

const heroImage = "/hero-rider.webp";

export interface CourseCardProps {
  course: {
    id: string;
    title: string;
    title_ar?: string | null;
    description?: string | null;
    description_ar?: string | null;
    thumbnail_url?: string | null;
    preview_video_url?: string | null;
    preview_video_thumbnail?: string | null;
    price: number;
    discount_percentage?: number | null;
    discount_expires_at?: string | null;
    vat_percentage?: number | null;
    base_rating?: number;
    base_review_count?: number;
    lessonCount: number;
    freeLessonCount?: number;
    totalMinutes: number;
  };
  index?: number;
  inView?: boolean;
  enrollment?: { progress_percentage: number; completed_at?: string | null; has_reviewed?: boolean } | null;
  activeVideoId?: string | null;
  onPlayVideo?: (courseId: string) => void;
  /** Listing pages: first rows eager; first image can be fetchpriority high for LCP */
  imageLoading?: "eager" | "lazy";
  imageFetchPriority?: "auto" | "high" | "low";
  /** @deprecated use imageLoading + imageFetchPriority */
  imagePriority?: boolean;
}

const CourseCard: React.FC<CourseCardProps> = ({
  course,
  index = 0,
  inView = true,
  enrollment,
  activeVideoId,
  onPlayVideo,
  imageLoading: imageLoadingProp,
  imageFetchPriority: imageFetchProp,
  imagePriority = false,
}) => {
  const imageLoading: "eager" | "lazy" = imageLoadingProp ?? (imagePriority ? "eager" : "lazy");
  const imageFetchPriority: "auto" | "high" | "low" = imageFetchProp ?? (imagePriority ? "high" : "auto");
  const { isRTL } = useLanguage();
  const { t } = useTranslation();
  const { getCoursePriceInfo, getCurrencySymbol } = useCurrency();
  const navigate = useNavigate();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const locale = isRTL ? "ar" : "en";
  

  const title = isRTL && course.title_ar ? course.title_ar : course.title;
  const isDiscountExpired = course.discount_expires_at && new Date(course.discount_expires_at).getTime() <= Date.now();
  const effectiveDiscount = isDiscountExpired ? 0 : (course.discount_percentage || 0);
  const courseVat = course.vat_percentage ?? 15;
  const priceInfo = getCoursePriceInfo(course.id, course.price, effectiveDiscount, {
    vatPercent: courseVat,
  });
  const sym = getCurrencySymbol(priceInfo.currency, isRTL);
  const formatAmount = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
  const rating = course.base_rating || 0;
  const reviewCount = course.base_review_count || 0;
  const isEnrolled = !!enrollment;
  const isCompleted = isEnrolled && (enrollment.progress_percentage >= 100 || !!enrollment.completed_at);
  const hasReviewed = enrollment?.has_reviewed ?? false;
  

  const formatDuration = (minutes: number) => {
    if (!minutes) return t("courses.courseCard.duration0");
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return t("courses.courseCard.duration.minutesOnly", { m });
    return m > 0
      ? t("courses.courseCard.duration.hoursMinutes", { h, m })
      : t("courses.courseCard.duration.hoursOnly", { h });
  };

  const rawThumbnail = course.preview_video_thumbnail || course.thumbnail_url;
  const thumbnailSrc = rawThumbnail || heroImage;
  const thumbWebp =
    rawThumbnail && rawThumbnail !== heroImage
      ? getSupabaseStorageWebpUrl(rawThumbnail, { width: 800, height: 450, quality: 78 })
      : undefined;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on buttons or video area
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('[data-video-area]')) return;
    navigate(`/courses/${course.id}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.15, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        className="group relative h-full rounded-2xl p-[1px] transition-all duration-500 cursor-pointer"
        onClick={handleCardClick}
      >
        <div className="relative h-full rounded-2xl border border-border/60 bg-card/85 backdrop-blur-sm overflow-hidden transition-all duration-500 hover:border-primary/40">

          {/* Video / Thumbnail Area */}
          <div className="relative aspect-video overflow-hidden w-full">
            <div className="absolute inset-0 p-2">
              <picture>
                {thumbWebp && <source srcSet={thumbWebp} type="image/webp" />}
                <img
                  src={thumbnailSrc}
                  alt={title}
                  width={1280}
                  height={720}
                  className="w-full h-full object-cover rounded-xl transition-transform duration-700 group-hover:scale-105"
                  loading={imageLoading}
                  decoding="async"
                  fetchPriority={imageFetchPriority}
                  sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
                />
              </picture>
              {/* Play icon overlay — suggests the card is interactive */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm ring-1 ring-white/25 shadow-xl transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/85">
                  <Play className="h-6 w-6 text-white fill-white ms-0.5" />
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-5 flex flex-col gap-3">
            {/* Title */}
            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-0 group-hover:text-primary transition-colors duration-300 line-clamp-1">
              {title}
            </h3>

            {/* Metadata + Badges */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {isCompleted ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-600/15 text-green-600 dark:text-green-400 font-semibold">
                  <Trophy className="w-3 h-3" />
                  {t("courseLearn.completed")}
                </span>
              ) : isEnrolled ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">
                  {t("courses.courseCard.enrolled")}
                </span>
              ) : null}

              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted">
                <BookOpen className="w-3 h-3" />
                {course.lessonCount} {t("courses.lesson")}
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted">
                <Clock className="w-3 h-3" />
                {formatDuration(course.totalMinutes)}
              </span>
              {reviewCount > 0 && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted">
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  {rating.toFixed(1)}
                </span>
              )}
              {!isEnrolled && (course.freeLessonCount ?? 0) > 0 && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 font-semibold">
                  <Unlock className="w-3 h-3" />
                  {course.freeLessonCount} {t('courseDetail.freePreview')}
                </span>
              )}
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            {/* Price row — hidden when completed */}
            {!isCompleted && (
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl leading-none font-black text-primary tabular-nums whitespace-nowrap" dir="ltr">
                      {formatAmount(priceInfo.finalPrice)}
                    </span>
                    <span className="text-sm font-bold text-primary/75 whitespace-nowrap" dir="ltr">
                      {sym}
                    </span>
                  </div>
                  {priceInfo.discountPct > 0 && (
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground line-through tabular-nums whitespace-nowrap" dir="ltr">
                        {formatAmount(priceInfo.originalPrice)} {sym}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-bold">
                        -{priceInfo.discountPct}%
                      </span>
                    </div>
                  )}
                </div>

                {priceInfo.discountPct > 0 && (
                  <div className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold whitespace-nowrap">
                    {t("courses.courseCard.discountBadge", { pct: priceInfo.discountPct })}
                  </div>
                )}
              </div>
            )}

            {/* CTA Buttons */}
            {isCompleted ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  className="flex-1 h-11 text-sm font-bold bg-green-600 hover:bg-green-700 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/courses/${course.id}`);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    {t("courses.courseCard.completedWithCheck")}
                  </span>
                </Button>
                {!hasReviewed && (
                  <Button
                    variant="outline"
                    className="h-11 px-4 text-sm font-bold border-yellow-500/50 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/courses/${course.id}#reviews`);
                    }}
                  >
                    <Star className="w-4 h-4 me-1.5 fill-yellow-500 text-yellow-500" />
                    {t("courses.courseCard.rate")}
                  </Button>
                )}
              </div>
            ) : isEnrolled ? (
              <Button
                variant="default"
                className="w-full h-11 text-sm font-bold"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/courses/${course.id}`);
                }}
              >
                <span className="flex items-center gap-2">
                  {t("courses.courseCard.continueLearning")}
                  <Arrow className="w-4 h-4" />
                </span>
              </Button>
            ) : (
              <Button
                variant="default"
                className="w-full min-h-[44px] h-11 text-sm text-[14px] font-bold group/btn relative overflow-hidden"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/courses/${course.id}?checkout=true`);
                }}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  {t("courses.courseCard.subscribeNow", {
                    price: formatAmount(priceInfo.finalPrice),
                    currency: sym,
                  })}
                </span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default CourseCard;
