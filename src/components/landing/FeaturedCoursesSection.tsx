import React from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Play, Clock, BookOpen, ArrowRight, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import heroImage from "@/assets/hero-rider.webp";
import DiscountCountdown from "@/components/common/DiscountCountdown";

const FeaturedCoursesSection: React.FC = () => {
  const { isRTL } = useLanguage();
  const { getCoursePriceInfo, getCurrencySymbol } = useCurrency();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["featured-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          id, title, title_ar, description, description_ar,
          thumbnail_url, difficulty_level, price, discount_percentage,
          discount_expires_at,
          chapters (
            id, is_published,
            lessons ( id, duration_minutes, is_published )
          )
        `)
        .eq("is_published", true)
        .order("created_at", { ascending: true })
        .limit(4);

      if (error) throw error;

      return (data || []).map((course: any) => {
        let lessonCount = 0;
        let totalMinutes = 0;
        (course.chapters || []).forEach((ch: any) => {
          if (ch.is_published) {
            (ch.lessons || []).forEach((l: any) => {
              if (l.is_published) {
                lessonCount++;
                totalMinutes += l.duration_minutes || 0;
              }
            });
          }
        });
        return { ...course, lessonCount, totalMinutes };
      });
    },
    staleTime: 5 * 60 * 1000,
  });

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

  if (!isLoading && courses.length === 0) return null;

  return (
    <section ref={ref} className="relative py-6 sm:py-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-card/30 to-background" />

      <div className="section-container relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 sm:mb-12"
        >
          <h2 className="section-title text-foreground mb-3 sm:mb-4">
            {isRTL ? "دوراتنا الأكثر مبيعاً" : "Our Best-Selling Courses"}
          </h2>
          <p className="section-subtitle">
            {isRTL
              ? "اختر الدورة المناسبة لك وابدأ رحلتك اليوم"
              : "Pick the right course for you and start your journey today"}
          </p>
        </motion.div>

        {/* Course Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {isLoading
            ? Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
              ))
            : courses.map((course: any, index: number) => {
                const title = isRTL && course.title_ar ? course.title_ar : course.title;
                const desc = isRTL && course.description_ar ? course.description_ar : course.description;
                const isDiscountExpired = course.discount_expires_at && new Date(course.discount_expires_at).getTime() <= Date.now();
                const effectiveDiscount = isDiscountExpired ? 0 : (course.discount_percentage || 0);
                const priceInfo = getCoursePriceInfo(course.id, course.price, effectiveDiscount);
                const sym = getCurrencySymbol(priceInfo.currency, isRTL);

                return (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.5, delay: index * 0.15 }}
                  >
                    <Link to={`/courses/${course.id}`}>
                      <div className="group card-premium overflow-hidden transition-all duration-500 hover:border-primary/40">
                        {/* Image */}
                        <div className="relative aspect-[16/10] overflow-hidden">
                          <img
                            src={course.thumbnail_url || heroImage}
                            alt={title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />

                          {/* Play button */}
                          <div className="absolute bottom-3 start-3">
                            <div className="w-10 h-10 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform shadow-glow">
                              <Play className="w-4 h-4 text-primary-foreground ms-0.5" />
                            </div>
                          </div>

                          {/* Discount badge */}
                          {priceInfo.discountPct > 0 && (
                            <div className="absolute top-3 end-3 px-2.5 py-1 rounded-full bg-destructive/90 backdrop-blur-sm text-destructive-foreground text-xs font-bold">
                              {isRTL ? `خصم ${priceInfo.discountPct}%` : `${priceInfo.discountPct}% OFF`}
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="p-4 sm:p-5">
                          <h3 className="text-lg sm:text-xl font-bold text-foreground mb-1.5 group-hover:text-primary transition-colors line-clamp-1">
                            {title}
                          </h3>
                          <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{desc}</p>

                          {/* Meta row */}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-3.5 h-3.5" />
                              {course.lessonCount} {isRTL ? "درس" : "lessons"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {formatDuration(course.totalMinutes)}
                            </span>
                          </div>

                          {/* Price & Countdown */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-black text-primary">
                                {priceInfo.finalPrice} {sym}
                              </span>
                              {priceInfo.discountPct > 0 && (
                                <span className="text-sm text-muted-foreground line-through">
                                  {priceInfo.originalPrice} {sym}
                                </span>
                              )}
                            </div>
                            {priceInfo.discountPct > 0 && course.discount_expires_at && (
                              <DiscountCountdown expiresAt={course.discount_expires_at} isRTL={isRTL} />
                            )}
                          </div>

                          {/* Subscribe Now Button */}
                          <Button variant="default" size="sm" className="w-full">
                            {isRTL ? `اشترك الآن – ${priceInfo.finalPrice} ${sym}` : `Subscribe now – ${priceInfo.finalPrice} ${sym}`}
                          </Button>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
        </div>

        {/* View all button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center mt-8 sm:mt-10"
        >
          <Link to="/courses">
            <Button variant="outline" size="lg" className="group">
              {isRTL ? "عرض جميع الدورات" : "View All Courses"}
              <Arrow className="w-4 h-4 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturedCoursesSection;
