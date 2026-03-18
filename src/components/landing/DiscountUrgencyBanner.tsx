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
  const { days, hours, minutes, seconds, isExpired, hasExpiry } = useDiscountCountdown(expiresAt);
  if (!hasExpiry || isExpired) return null;

  const label = isRTL ? "متبقي:" : "Ends in:";
  const parts = isRTL
    ? [
        { value: days, unit: "يوم" },
        { value: hours, unit: "ساعة" },
        { value: minutes, unit: "دقيقة" },
        { value: seconds, unit: "ثانية" },
      ]
    : [
        { value: days, unit: "day" },
        { value: hours, unit: "hour" },
        { value: minutes, unit: "min" },
        { value: seconds, unit: "sec" },
      ];

  return (
    <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
      <span className="text-[10px] sm:text-xs font-semibold text-sand/70">{label}</span>
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-sand/30 text-[10px]">:</span>}
          <span className="inline-flex flex-col items-center leading-none">
            <span className="font-mono font-black text-sm sm:text-base text-accent-orange drop-shadow-[0_0_6px_hsl(var(--accent-orange)/0.5)]">{String(p.value).padStart(2, '0')}</span>
            <span className="text-[8px] sm:text-[9px] font-medium text-sand/60 uppercase tracking-wider">{p.unit}</span>
          </span>
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
      <div className="flex items-center justify-center gap-2 sm:gap-4">
        {/* Discount badge */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-accent-orange animate-pulse flex-shrink-0 drop-shadow-[0_0_8px_hsl(var(--accent-orange)/0.6)]" />
          <span className="bg-accent-orange text-near-black text-[10px] sm:text-xs font-black px-1.5 sm:px-2 py-0.5 rounded-sm uppercase tracking-wider">
            {priceInfo.discountPct}% {isRTL ? "خصم" : "OFF"}
          </span>
        </div>

        {/* Title - hidden on very small screens */}
        <span className="hidden sm:block text-xs md:text-sm font-bold text-sand truncate max-w-[180px] md:max-w-none">
          {title}
        </span>

        {/* Countdown */}
        {course.discount_expires_at && (
          <CountdownDisplay expiresAt={course.discount_expires_at} isRTL={isRTL} />
        )}

        {/* Price */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] sm:text-xs text-sand/40 line-through">{priceInfo.originalPrice} {sym}</span>
          <span className="text-sm sm:text-base font-black text-accent-orange drop-shadow-[0_0_6px_hsl(var(--accent-orange)/0.4)]">{priceInfo.finalPrice} {sym}</span>
        </div>

        {/* CTA */}
        <span className="hidden md:flex text-[11px] font-bold text-accent-orange items-center gap-1 group-hover:gap-2 transition-all uppercase tracking-wider">
          {isRTL ? "سجّل" : "Enroll"}
          <Arrow className="w-3 h-3" />
        </span>
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
    }, 6000);
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
        className="overflow-hidden bg-gradient-to-r from-red-700 via-orange-600 to-red-700 border-b border-red-900/50 shadow-[0_2px_12px_rgba(220,38,38,0.4)]"
      >
        <div className="px-3 sm:px-6 py-2.5 sm:py-3 relative">
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
            <div className="flex items-center justify-center gap-1 mt-1.5">
              {courses.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex([i, i > activeIndex ? 1 : -1])}
                  className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full transition-all duration-300 ${
                    i === activeIndex % courses.length
                      ? 'bg-yellow-300 w-3 sm:w-4'
                      : 'bg-white/30'
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
