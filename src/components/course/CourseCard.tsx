import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Play, Clock, BookOpen, ArrowRight, ArrowLeft, Star, Trophy, Star as StarIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-rider.webp";

export interface CourseCardProps {
  course: {
    id: string;
    title: string;
    title_ar?: string | null;
    description?: string | null;
    description_ar?: string | null;
    thumbnail_url?: string | null;
    price: number;
    discount_percentage?: number | null;
    discount_expires_at?: string | null;
    base_rating?: number;
    base_review_count?: number;
    lessonCount: number;
    totalMinutes: number;
  };
  index?: number;
  inView?: boolean;
  enrollment?: { progress_percentage: number; completed_at?: string | null; has_reviewed?: boolean } | null;
}

const CourseCard: React.FC<CourseCardProps> = ({ course, index = 0, inView = true, enrollment }) => {
  const { isRTL } = useLanguage();
  const { t } = useTranslation();
  const { getCoursePriceInfo, getCurrencySymbol } = useCurrency();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const locale = isRTL ? "ar" : "en";

  const title = isRTL && course.title_ar ? course.title_ar : course.title;
  const desc = isRTL && course.description_ar ? course.description_ar : course.description;
  const isDiscountExpired = course.discount_expires_at && new Date(course.discount_expires_at).getTime() <= Date.now();
  const effectiveDiscount = isDiscountExpired ? 0 : (course.discount_percentage || 0);
  const priceInfo = getCoursePriceInfo(course.id, course.price, effectiveDiscount);
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.15, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link to={`/courses/${course.id}`} className="block h-full">
        <div className="group relative h-full rounded-2xl p-[1px] bg-gradient-to-br from-primary/15 via-border/30 to-transparent transition-all duration-500 hover:from-primary/25 hover:via-primary/10">
          <div className="relative h-full rounded-2xl border border-border/60 bg-card/85 backdrop-blur-sm overflow-hidden transition-all duration-500 hover:border-primary/40 hover:shadow-[0_8px_40px_hsl(var(--primary)/0.15)]">
          {/* Enrolled indicator */}
          {isCompleted ? (
            <div className="absolute top-3 start-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-600/90 backdrop-blur-sm text-white text-xs font-semibold">
              <Trophy className="w-3 h-3" />
              {t("courseLearn.completed")}
            </div>
          ) : isEnrolled ? (
            <div className="absolute top-3 start-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/90 backdrop-blur-sm text-primary-foreground text-xs font-semibold">
              {t("courses.courseCard.enrolled")}
            </div>
          ) : null}

          {/* Image Container */}
          <div className="relative aspect-[16/9] overflow-hidden">
            <div className="absolute inset-0 p-2">
              <picture>
                <source srcSet={course.thumbnail_url || heroImage} type="image/webp" />
                <img
                  src={course.thumbnail_url || heroImage}
                  alt={title}
                  width={1280}
                  height={720}
                  className="w-full h-full object-cover rounded-xl transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
                />
              </picture>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-card/20 via-transparent to-card/20" />

            {/* Play button - centered */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/90 backdrop-blur-md flex items-center justify-center shadow-[0_0_30px_hsl(var(--primary)/0.4)] opacity-80 group-hover:opacity-100 transition-all duration-300"
              >
                <Play className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground ms-0.5" />
              </motion.div>
            </div>

            {/* Discount badge */}
            {priceInfo.discountPct > 0 && (
              <div className="absolute top-3 end-3 px-3 py-1.5 rounded-lg bg-destructive/90 backdrop-blur-sm text-destructive-foreground text-xs font-bold shadow-lg">
                {t("courses.courseCard.discountBadge", { pct: priceInfo.discountPct })}
              </div>
            )}

            {/* Bottom meta bar on image */}
            <div className="absolute bottom-0 inset-x-0 p-3 sm:p-4">
              <div className="flex items-center gap-3 text-xs text-foreground/80">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/60 backdrop-blur-sm">
                  <BookOpen className="w-3 h-3" />
                  {course.lessonCount} {t("courses.lesson")}
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/60 backdrop-blur-sm">
                  <Clock className="w-3 h-3" />
                  {formatDuration(course.totalMinutes)}
                </span>
                {reviewCount > 0 && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/60 backdrop-blur-sm ms-auto">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    {rating.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-5 flex flex-col gap-3">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-1.5 group-hover:text-primary transition-colors duration-300 line-clamp-1">
                {title}
              </h3>
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
                      e.preventDefault();
                      e.stopPropagation();
                      window.location.href = `/courses/${course.id}#reviews`;
                    }}
                  >
                    <Star className="w-4 h-4 me-1.5 fill-yellow-500 text-yellow-500" />
                    {t("courses.courseCard.rate")}
                  </Button>
                )}
              </div>
            ) : (
              <Button
                variant="default"
                className="w-full h-11 text-sm font-bold group/btn relative overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {isEnrolled ? (
                    <>
                      {t("courses.courseCard.continueLearning")}
                      <Arrow className="w-4 h-4 transition-transform group-hover/btn:translate-x-1 rtl:group-hover/btn:-translate-x-1" />
                    </>
                  ) : (
                    <>
                      {t("courses.courseCard.subscribeNow", {
                        price: formatAmount(priceInfo.finalPrice),
                        currency: sym,
                      })}
                      <Arrow className="w-4 h-4 transition-transform group-hover/btn:translate-x-1 rtl:group-hover/btn:-translate-x-1" />
                    </>
                  )}
                </span>
              </Button>
            )}
          </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default CourseCard;
