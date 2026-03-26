import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Play, Clock, BookOpen, ArrowRight, ArrowLeft, Star, Trophy, Tag } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  const { getCoursePriceInfo, getCurrencySymbol } = useCurrency();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const title = isRTL && course.title_ar ? course.title_ar : course.title;
  const isDiscountExpired = course.discount_expires_at && new Date(course.discount_expires_at).getTime() <= Date.now();
  const effectiveDiscount = isDiscountExpired ? 0 : (course.discount_percentage || 0);
  const priceInfo = getCoursePriceInfo(course.id, course.price, effectiveDiscount);
  const sym = getCurrencySymbol(priceInfo.currency, isRTL);
  const rating = course.base_rating || 0;
  const reviewCount = course.base_review_count || 0;
  const isEnrolled = !!enrollment;
  const isCompleted = isEnrolled && (enrollment.progress_percentage >= 100 || !!enrollment.completed_at);
  const hasReviewed = enrollment?.has_reviewed ?? false;
  const hasDiscount = priceInfo.discountPct > 0;

  const formatDuration = (minutes: number) => {
    if (!minutes) return isRTL ? "0 ساعة" : "0h";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (isRTL) {
      if (h === 0) return `${m} دقيقة`;
      return m > 0 ? `${h} ساعة ${m} دقيقة` : `${h} ساعة`;
    }
    if (h === 0) return `${m}min`;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.15, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link to={`/courses/${course.id}`} className="block h-full">
        <div className="group relative h-full rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden transition-all duration-500 hover:border-primary/50 hover:shadow-[0_8px_40px_hsl(var(--primary)/0.15)]">
          {/* Status badge */}
          {isCompleted ? (
            <div className="absolute top-3 start-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-600/90 backdrop-blur-sm text-white text-xs font-semibold">
              <Trophy className="w-3 h-3" />
              {isRTL ? "مكتمل" : "Completed"}
            </div>
          ) : isEnrolled ? (
            <div className="absolute top-3 start-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/90 backdrop-blur-sm text-primary-foreground text-xs font-semibold">
              {isRTL ? "مسجّل" : "Enrolled"}
            </div>
          ) : null}

          {/* Image */}
          <div className="relative aspect-[16/9] overflow-hidden">
            <img
              src={course.thumbnail_url || heroImage}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />

            {/* Play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/90 backdrop-blur-md flex items-center justify-center shadow-[0_0_30px_hsl(var(--primary)/0.4)] opacity-0 group-hover:opacity-100 transition-all duration-300"
              >
                <Play className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground ms-0.5" />
              </motion.div>
            </div>

            {/* Discount badge */}
            {hasDiscount && (
              <div className="absolute top-3 end-3 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-destructive/90 backdrop-blur-sm text-destructive-foreground text-xs font-bold shadow-lg">
                <Tag className="w-3 h-3" />
                {isRTL ? `خصم ${priceInfo.discountPct}%` : `${priceInfo.discountPct}% OFF`}
              </div>
            )}

            {/* Meta pills */}
            <div className="absolute bottom-0 inset-x-0 p-3">
              <div className="flex items-center gap-2 text-[11px] text-foreground/80">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-background/60 backdrop-blur-sm">
                  <BookOpen className="w-3 h-3" />
                  {course.lessonCount} {isRTL ? "درس" : "lessons"}
                </span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-background/60 backdrop-blur-sm">
                  <Clock className="w-3 h-3" />
                  {formatDuration(course.totalMinutes)}
                </span>
                {reviewCount > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-background/60 backdrop-blur-sm ms-auto">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    {rating.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-5 flex flex-col gap-3">
            {/* Title */}
            <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors duration-300 line-clamp-2 leading-snug">
              {title}
            </h3>

            {/* Enrollment progress */}
            {isEnrolled && enrollment && (
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">
                    {isRTL ? "التقدم" : "Progress"}
                  </span>
                  <span className={`font-semibold ${isCompleted ? 'text-green-600 dark:text-green-400' : 'text-primary'}`}>
                    {isCompleted ? (isRTL ? 'مكتمل' : 'Completed') : `${enrollment.progress_percentage}%`}
                  </span>
                </div>
                <Progress
                  value={isCompleted ? 100 : enrollment.progress_percentage}
                  className={`h-1.5 ${isCompleted ? '[&>div]:bg-green-500' : ''}`}
                />
              </div>
            )}

            {/* Price + CTA row */}
            {isCompleted ? (
              <div className="flex items-center gap-2 mt-auto">
                <Button
                  variant="default"
                  className="flex-1 h-10 text-sm font-bold bg-green-600 hover:bg-green-700 text-white"
                >
                  <Trophy className="w-4 h-4 me-1.5" />
                  {isRTL ? 'مكتمل ✓' : 'Completed ✓'}
                </Button>
                {!hasReviewed && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 border-yellow-500/50 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      window.location.href = `/courses/${course.id}#reviews`;
                    }}
                  >
                    <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 mt-auto">
                {/* Price block */}
                {!isEnrolled && (
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl sm:text-2xl font-black text-primary leading-none">
                        {priceInfo.finalPrice}
                      </span>
                      <span className="text-xs font-bold text-primary/70">
                        {sym}
                      </span>
                    </div>
                    {hasDiscount && (
                      <span className="text-xs text-muted-foreground line-through mt-0.5">
                        {priceInfo.originalPrice} {sym}
                      </span>
                    )}
                  </div>
                )}

                {/* CTA */}
                <Button
                  variant="default"
                  className={`h-10 text-sm font-bold group/btn ${isEnrolled ? 'w-full' : 'flex-1'}`}
                >
                  <span className="flex items-center gap-2">
                    {isEnrolled ? (
                      <>
                        {isRTL ? "أكمل التعلم" : "Continue Learning"}
                        <Arrow className="w-4 h-4 transition-transform group-hover/btn:translate-x-1 rtl:group-hover/btn:-translate-x-1" />
                      </>
                    ) : (
                      <>
                        {isRTL ? "اشترك الآن" : "Enroll Now"}
                        <Arrow className="w-4 h-4 transition-transform group-hover/btn:translate-x-1 rtl:group-hover/btn:-translate-x-1" />
                      </>
                    )}
                  </span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default CourseCard;
