import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Flame, ArrowRight, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDiscountCountdown } from "@/hooks/useDiscountCountdown";

const CountdownDisplay: React.FC<{ expiresAt: string; isRTL: boolean }> = ({ expiresAt, isRTL }) => {
  const { timeLeft, isExpired, hasExpiry } = useDiscountCountdown(expiresAt);
  if (!hasExpiry || isExpired) return null;

  const [h, m, s] = timeLeft.split(":");
  const labels = isRTL
    ? ["ساعة", "دقيقة", "ثانية"]
    : ["Hours", "Minutes", "Seconds"];
  const units = [h, m, s];
  return (
    <div className="flex items-center gap-1 sm:gap-1.5">
      {units.map((unit, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-destructive font-bold text-sm sm:text-lg self-start mt-0.5 sm:mt-1">:</span>}
          <div className="flex flex-col items-center">
            <span className="inline-flex items-center justify-center w-7 h-7 sm:w-10 sm:h-10 rounded sm:rounded-lg bg-destructive/20 border border-destructive/30 text-destructive font-mono font-black text-xs sm:text-lg">
              {unit}
            </span>
            <span className="text-[8px] sm:text-[10px] text-muted-foreground mt-0.5">{labels[i]}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

interface DiscountedCourse {
  id: string;
  title: string;
  title_ar: string | null;
  price: number;
  discount_percentage: number | null;
  discount_expires_at: string | null;
}

const SlideItem: React.FC<{
  course: DiscountedCourse;
  isRTL: boolean;
}> = ({ course, isRTL }) => {
  const { getCoursePriceInfo, getCurrencySymbol } = useCurrency();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const title = isRTL && course.title_ar ? course.title_ar : course.title;
  const priceInfo = getCoursePriceInfo(course.id, course.price, course.discount_percentage || 0);
  const sym = getCurrencySymbol(priceInfo.currency, isRTL);

  return (
    <Link to={`/courses/${course.id}`} className="block group">
      <div className="flex items-center justify-center gap-2 sm:gap-6 flex-wrap">
        <div className="flex items-center gap-1 sm:gap-2">
          <Flame className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-destructive animate-pulse flex-shrink-0" />
          <span className="text-[11px] sm:text-sm md:text-base font-bold text-foreground leading-tight truncate max-w-[120px] sm:max-w-[200px] md:max-w-none">
            {isRTL
              ? `خصم ${priceInfo.discountPct}% — ${title}`
              : `${priceInfo.discountPct}% OFF — ${title}`}
          </span>
        </div>

        {course.discount_expires_at && (
          <CountdownDisplay expiresAt={course.discount_expires_at} isRTL={isRTL} />
        )}

        <div className="flex items-center gap-1.5 sm:gap-3">
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-[10px] sm:text-sm text-muted-foreground line-through">{priceInfo.originalPrice} {sym}</span>
            <span className="text-xs sm:text-lg font-black text-primary">{priceInfo.finalPrice} {sym}</span>
          </div>
          <span className="hidden sm:flex text-xs font-semibold text-primary items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
            {isRTL ? "سجّل الآن" : "Enroll Now"}
            <Arrow className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
};

const slideVariants = {
  enter: (direction: number) => ({
    y: direction > 0 ? 20 : -20,
    opacity: 0,
  }),
  center: {
    y: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    y: direction > 0 ? -20 : 20,
    opacity: 0,
  }),
};

const DiscountUrgencyBanner: React.FC = () => {
  const { isRTL } = useLanguage();
  const bannerRef = useRef<HTMLDivElement>(null);
  const [[activeIndex, direction], setActiveIndex] = useState([0, 1]);

  // Publish banner height as CSS variable for navbar offset
  useEffect(() => {
    const el = bannerRef.current;
    if (!el) return;
    const update = () => {
      document.documentElement.style.setProperty('--discount-banner-h', `${el.offsetHeight}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--discount-banner-h');
    };
  }, []);

  const { data: discountedCourses } = useQuery({
    queryKey: ["homepage-discount-banner-carousel"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, title_ar, price, discount_percentage, discount_expires_at")
        .eq("is_published", true)
        .gt("discount_percentage", 0)
        .gt("discount_expires_at", now)
        .order("discount_percentage", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as DiscountedCourse[];
    },
    staleTime: 60 * 1000,
  });

  const courses = discountedCourses || [];

  // Auto-slide every 3 seconds
  useEffect(() => {
    if (courses.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex(([prev]) => [(prev + 1) % courses.length, 1]);
    }, 3000);
    return () => clearInterval(interval);
  }, [courses.length]);

  if (courses.length === 0) return null;

  const currentCourse = courses[activeIndex % courses.length];

  return (
    <div ref={bannerRef} className="fixed top-0 left-0 right-0 z-[60] transition-transform duration-300" style={{ transform: 'translateY(var(--banner-translate, 0))' }}>
      <motion.section
        id="discount-urgency-banner"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="overflow-hidden bg-gradient-to-r from-destructive/10 via-destructive/5 to-destructive/10 border-b border-destructive/20"
      >
        <div className="px-3 sm:px-6 py-2 sm:py-3 relative">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentCourse.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <SlideItem course={currentCourse} isRTL={isRTL} />
            </motion.div>
          </AnimatePresence>

          {/* Dot indicators */}
          {courses.length > 1 && (
            <div className="flex items-center justify-center gap-1 mt-1">
              {courses.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex([i, i > activeIndex ? 1 : -1])}
                  className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full transition-all duration-300 ${
                    i === activeIndex % courses.length
                      ? 'bg-destructive w-3 sm:w-4'
                      : 'bg-muted-foreground/30'
                  }`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );
};

export default DiscountUrgencyBanner;
