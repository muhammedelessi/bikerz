import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Flame } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DiscountCountdown from "@/components/common/DiscountCountdown";
import { useTranslation } from "react-i18next";

interface DiscountedCourse {
  id: string;
  title: string;
  title_ar: string | null;
  price: number;
  discount_percentage: number | null;
  discount_expires_at: string | null;
}

/** Floating discount badge designed to sit inside the HeroSection */
const DiscountUrgencyBanner: React.FC<{ courseId?: string; floating?: boolean }> = ({
  courseId,
  floating = false,
}) => {
  const { isRTL } = useLanguage();
  const { t } = useTranslation();
  const { getCoursePriceInfo, getCurrencySymbol } = useCurrency();
  const [[activeIndex, direction], setActiveIndex] = useState([0, 1]);

  const { data: discountedCourses } = useQuery({
    queryKey: ["homepage-discount-banner-carousel", courseId],
    queryFn: async () => {
      const now = new Date().toISOString();
      let query = supabase
        .from("courses")
        .select("id, title, title_ar, price, discount_percentage, discount_expires_at")
        .eq("is_published", true)
        .gt("discount_percentage", 0)
        .gt("discount_expires_at", now);
      if (courseId) query = query.eq("id", courseId);
      const { data, error } = await query
        .order("discount_percentage", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as DiscountedCourse[];
    },
    staleTime: 60 * 1000,
  });

  const courses = discountedCourses || [];

  useEffect(() => {
    if (courses.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex(([prev]) => [(prev + 1) % courses.length, 1]);
    }, 6000);
    return () => clearInterval(interval);
  }, [courses.length]);

  if (courses.length === 0) {
    if (!floating) return <div className="h-[52px] sm:h-[40px] bg-near-black" />;
    return null;
  }

  const current = courses[activeIndex % courses.length];
  const title = isRTL && current.title_ar ? current.title_ar : current.title;
  const priceInfo = getCoursePriceInfo(current.id, current.price, current.discount_percentage || 0);
  const sym = getCurrencySymbol(priceInfo.currency, isRTL);

  const slideVariants = {
    enter: (d: number) => ({ y: d > 0 ? 14 : -14, opacity: 0 }),
    center: { y: 0, opacity: 1 },
    exit: (d: number) => ({ y: d > 0 ? -14 : 14, opacity: 0 }),
  };

  // Floating mode: rendered inside hero
  if (floating) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <Link to={`/courses/${current.id}`} className="block group">
          <div className="relative rounded-xl border border-accent-orange/30 bg-near-black/80 backdrop-blur-md px-4 py-2.5 shadow-[0_4px_24px_hsl(var(--accent-orange)/0.2)]">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={current.id}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25 }}
              >
                {/* Mobile: stacked */}
                <div className="flex sm:hidden flex-col items-center gap-1">
                  <div className="flex items-center gap-1.5 justify-center flex-wrap">
                    <Flame className="w-3.5 h-3.5 text-accent-orange animate-pulse flex-shrink-0" />
                    <span className="bg-accent-orange text-near-black text-[10px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
                      {priceInfo.discountPct}% {t("landing.discountUrgencyBanner.discountLabel")}
                    </span>
                    <span className="text-[11px] font-bold text-sand truncate max-w-[110px]">{title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-sand/40 line-through">{priceInfo.originalPrice} {sym}</span>
                    <span className="text-xs font-black text-accent-orange">{priceInfo.finalPrice} {sym}</span>
                    {current.discount_expires_at && (
                      <DiscountCountdown expiresAt={current.discount_expires_at} isRTL={isRTL} />
                    )}
                  </div>
                </div>

                {/* Desktop: single row */}
                <div className="hidden sm:flex items-center justify-center gap-3">
                  <Flame className="w-4 h-4 text-accent-orange animate-pulse flex-shrink-0" />
                  <span className="bg-accent-orange text-near-black text-[11px] font-black px-2 py-0.5 rounded-sm uppercase tracking-wider">
                    {priceInfo.discountPct}% {t("landing.discountUrgencyBanner.discountLabel")}
                  </span>
                  <span className="text-xs font-bold text-sand truncate max-w-[200px]">{title}</span>
                  {current.discount_expires_at && (
                    <DiscountCountdown expiresAt={current.discount_expires_at} isRTL={isRTL} />
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-sand/40 line-through">{priceInfo.originalPrice} {sym}</span>
                    <span className="text-sm font-black text-accent-orange">{priceInfo.finalPrice} {sym}</span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Dot indicators */}
            {courses.length > 1 && (
              <div className="flex items-center justify-center gap-1 mt-1.5">
                {courses.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveIndex([i, i > activeIndex ? 1 : -1]);
                    }}
                    className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full transition-all duration-300 ${
                      i === activeIndex % courses.length
                        ? "bg-accent-orange w-3 sm:w-4"
                        : "bg-sand/20"
                    }`}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </Link>
      </div>
    );
  }

  // Non-floating: standalone bar (used on Index page above hero)
  return (
    <div className="min-h-[52px] sm:min-h-[40px]">
      <section
        id="discount-urgency-banner"
        className="overflow-hidden bg-near-black border-b border-accent-orange/20 shadow-[0_2px_16px_hsl(var(--accent-orange)/0.25)]"
      >
        <div className="px-3 sm:px-6 py-1.5 sm:py-2 relative">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={current.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
            >
              <Link to={`/courses/${current.id}`} className="block group">
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <Flame className="w-4 h-4 text-accent-orange animate-pulse flex-shrink-0" />
                  <span className="bg-accent-orange text-near-black text-[11px] font-black px-2 py-0.5 rounded-sm uppercase tracking-wider">
                    {priceInfo.discountPct}% {t("landing.discountUrgencyBanner.discountLabel")}
                  </span>
                  <span className="text-xs font-bold text-sand truncate max-w-[140px] sm:max-w-[240px]">{title}</span>
                  {current.discount_expires_at && (
                    <DiscountCountdown expiresAt={current.discount_expires_at} isRTL={isRTL} />
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-sand/40 line-through">{priceInfo.originalPrice} {sym}</span>
                    <span className="text-sm font-black text-accent-orange">{priceInfo.finalPrice} {sym}</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          </AnimatePresence>
          {courses.length > 1 && (
            <div className="flex items-center justify-center gap-1 mt-1.5">
              {courses.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex([i, i > activeIndex ? 1 : -1])}
                  className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full transition-all duration-300 ${
                    i === activeIndex % courses.length ? "bg-accent-orange w-3 sm:w-4" : "bg-sand/20"
                  }`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default DiscountUrgencyBanner;
