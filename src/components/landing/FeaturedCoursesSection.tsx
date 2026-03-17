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
import heroImage from "@/assets/hero-rider.jpg";

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
    <section ref={ref} className="relative py-16 sm:py-20 overflow-hidden">
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
        <div className="flex flex-col gap-4 sm:gap-5">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28 sm:h-36 rounded-xl" />
              ))
            : courses.map((course: any, index: number) => {
                const title = isRTL && course.title_ar ? course.title_ar : course.title;
                const desc = isRTL && course.description_ar ? course.description_ar : course.description;
                const priceInfo = getCoursePriceInfo(course.id, course.price, course.discount_percentage || 0);
                const sym = getCurrencySymbol(priceInfo.currency, isRTL);

                return (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, x: isRTL ? 30 : -30 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.5, delay: index * 0.12 }}
                  >
                    <Link to={`/courses/${course.id}`}>
                      <div className="group card-premium overflow-hidden transition-all duration-500 hover:border-primary/40 flex flex-row">
                        {/* Thumbnail */}
                        <div className="relative w-32 sm:w-48 md:w-56 flex-shrink-0 overflow-hidden">
                          <img
                            src={course.thumbnail_url || heroImage}
                            alt={title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-card/40" />

                          {/* Play button */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform shadow-glow">
                              <Play className="w-4 h-4 text-primary-foreground ms-0.5" />
                            </div>
                          </div>

                          {/* Discount badge */}
                          {priceInfo.discountPct > 0 && (
                            <div className="absolute top-2 start-2 px-2 py-0.5 rounded-full bg-destructive/90 backdrop-blur-sm text-destructive-foreground text-[10px] sm:text-xs font-bold">
                              {isRTL ? `خصم ${priceInfo.discountPct}%` : `${priceInfo.discountPct}% OFF`}
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-3 sm:p-5 flex flex-col justify-center min-w-0">
                          <h3 className="text-base sm:text-lg font-bold text-foreground mb-1 group-hover:text-primary transition-colors line-clamp-1">
                            {title}
                          </h3>
                          <p className="text-muted-foreground text-xs sm:text-sm mb-2 sm:mb-3 line-clamp-2 hidden sm:block">{desc}</p>

                          {/* Meta row */}
                          <div className="flex items-center gap-3 text-[11px] sm:text-xs text-muted-foreground mb-2 sm:mb-3">
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              {course.lessonCount} {isRTL ? "درس" : "lessons"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              {formatDuration(course.totalMinutes)}
                            </span>
                          </div>

                          {/* Price & CTA */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-base sm:text-lg font-black text-primary">
                                {priceInfo.finalPrice} {sym}
                              </span>
                              {priceInfo.discountPct > 0 && (
                                <span className="text-xs sm:text-sm text-muted-foreground line-through">
                                  {priceInfo.originalPrice} {sym}
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-medium text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {isRTL ? "عرض الدورة" : "View Course"}
                              <Arrow className="w-3.5 h-3.5" />
                            </span>
                          </div>
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
