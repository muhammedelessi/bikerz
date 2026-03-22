import React from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Play, Clock, BookOpen, ArrowRight, ArrowLeft, Star, Users, Zap } from "lucide-react";
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
          discount_expires_at, base_rating, base_review_count,
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
    <section ref={ref} className="relative py-10 sm:py-16 lg:py-20 overflow-hidden">
      {/* Rich background with layered gradients */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-card/40 to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.08),transparent)]" />

      <div className="section-container relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 sm:mb-14"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 mb-5"
          >
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              {isRTL ? "الأكثر طلباً" : "Most Popular"}
            </span>
          </motion.div>

          <h2 className="section-title text-foreground mb-3 sm:mb-4">
            {isRTL ? "دوراتنا التدريبية" : "Our Training Courses"}
          </h2>
          <p className="section-subtitle max-w-xl mx-auto">
            {isRTL
              ? "اختر الدورة المناسبة لمستواك وابدأ رحلتك اليوم"
              : "Choose the course that fits your level and start your riding journey today"}
          </p>
        </motion.div>

        {/* Course Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-7">
          {isLoading
            ? Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />
              ))
            : courses.map((course: any, index: number) => {
                const title = isRTL && course.title_ar ? course.title_ar : course.title;
                const desc = isRTL && course.description_ar ? course.description_ar : course.description;
                const isDiscountExpired = course.discount_expires_at && new Date(course.discount_expires_at).getTime() <= Date.now();
                const effectiveDiscount = isDiscountExpired ? 0 : (course.discount_percentage || 0);
                const priceInfo = getCoursePriceInfo(course.id, course.price, effectiveDiscount);
                const sym = getCurrencySymbol(priceInfo.currency, isRTL);
                const rating = course.base_rating || 4.8;
                const reviewCount = course.base_review_count || 0;

                return (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, y: 40 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6, delay: index * 0.15, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link to={`/courses/${course.id}`} className="block h-full">
                      <div className="group relative h-full rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden transition-all duration-500 hover:border-primary/50 hover:shadow-[0_8px_40px_hsl(var(--primary)/0.15)]">
                        {/* Image Container */}
                        <div className="relative aspect-[16/9] overflow-hidden">
                          <img
                            src={course.thumbnail_url || heroImage}
                            alt={title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            loading="lazy"
                          />
                          {/* Cinematic overlay */}
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
                              {isRTL ? `خصم ${priceInfo.discountPct}%` : `${priceInfo.discountPct}% OFF`}
                            </div>
                          )}

                          {/* Bottom meta bar on image */}
                          <div className="absolute bottom-0 inset-x-0 p-3 sm:p-4">
                            <div className="flex items-center gap-3 text-xs text-foreground/80">
                              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/60 backdrop-blur-sm">
                                <BookOpen className="w-3 h-3" />
                                {course.lessonCount} {isRTL ? "درس" : "lessons"}
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
                        <div className="p-5 sm:p-6 flex flex-col gap-4">
                          <div>
                            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-1.5 group-hover:text-primary transition-colors duration-300 line-clamp-1">
                              {title}
                            </h3>
                            <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">{desc}</p>
                          </div>

                          {/* Divider */}
                          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

                          {/* Price row */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-black text-primary">
                                {priceInfo.finalPrice}
                              </span>
                              <span className="text-sm font-semibold text-primary/70">
                                {sym}
                              </span>
                              {priceInfo.discountPct > 0 && (
                                <span className="text-sm text-muted-foreground line-through ms-1">
                                  {priceInfo.originalPrice} {sym}
                                </span>
                              )}
                            </div>
                            {priceInfo.discountPct > 0 && course.discount_expires_at && (
                              <DiscountCountdown expiresAt={course.discount_expires_at} isRTL={isRTL} />
                            )}
                          </div>

                          {/* CTA Button */}
                          <Button
                            variant="default"
                            className="w-full h-11 text-sm font-bold group/btn relative overflow-hidden"
                          >
                            <span className="relative z-10 flex items-center gap-2">
                              {isRTL
                                ? `اشترك الآن – ${priceInfo.finalPrice} ${sym}`
                                : `Subscribe now – ${priceInfo.finalPrice} ${sym}`}
                              <Arrow className="w-4 h-4 transition-transform group-hover/btn:translate-x-1 rtl:group-hover/btn:-translate-x-1" />
                            </span>
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
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-center mt-10 sm:mt-14"
        >
          <Link to="/courses">
            <Button variant="outline" size="lg" className="group border-primary/30 hover:border-primary/60 hover:bg-primary/5">
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
