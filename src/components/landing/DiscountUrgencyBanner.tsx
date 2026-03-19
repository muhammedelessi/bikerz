import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Flame, ArrowRight, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DiscountCountdown from "@/components/common/DiscountCountdown";

interface DiscountedCourse {
  id: string;
  title: string;
  title_ar: string | null;
  price: number;
  discount_percentage: number | null;
  discount_expires_at: string | null;
}

function SlideItemContent(props: { course: DiscountedCourse; isRTL: boolean }) {
  var course = props.course;
  var isRTL = props.isRTL;
  var currencyCtx = useCurrency();
  var getCoursePriceInfo = currencyCtx.getCoursePriceInfo;
  var getCurrencySymbol = currencyCtx.getCurrencySymbol;
  var Arrow = isRTL ? ArrowLeft : ArrowRight;

  var title = isRTL && course.title_ar ? course.title_ar : course.title;
  var discountPct = course.discount_percentage != null ? course.discount_percentage : 0;
  var priceInfo = getCoursePriceInfo(course.id, course.price, discountPct);
  var sym = getCurrencySymbol(priceInfo.currency, isRTL);
  var offLabel = isRTL ? "خصم" : "OFF";
  var enrollLabel = isRTL ? "سجّل" : "Enroll";
  var expiresAt = course.discount_expires_at != null ? course.discount_expires_at : null;

  return (
    <Link to={"/courses/" + course.id} className="block group">
      <div>
        {/* Mobile layout */}
        <div className="flex sm:hidden flex-col items-center gap-1">
          <div className="flex items-center gap-1.5 w-full justify-center">
            <Flame className="w-3.5 h-3.5 text-accent-orange animate-pulse flex-shrink-0 drop-shadow-[0_0_6px_hsl(var(--accent-orange)/0.6)]" />
            <span className="bg-accent-orange text-near-black text-[10px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider flex-shrink-0">
              {priceInfo.discountPct}% {offLabel}
            </span>
            <span className="text-[11px] font-bold text-sand truncate max-w-[120px]">
              {title}
            </span>
            <span className="text-[10px] text-sand/40 line-through flex-shrink-0">{priceInfo.originalPrice} {sym}</span>
            <span className="text-xs font-black text-accent-orange flex-shrink-0">{priceInfo.finalPrice} {sym}</span>
          </div>
          {expiresAt && (
            <DiscountCountdown expiresAt={expiresAt} isRTL={isRTL} />
          )}
        </div>

        {/* Desktop layout */}
        <div className="hidden sm:flex items-center justify-center gap-4">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Flame className="w-5 h-5 text-accent-orange animate-pulse flex-shrink-0 drop-shadow-[0_0_8px_hsl(var(--accent-orange)/0.6)]" />
            <span className="bg-accent-orange text-near-black text-xs font-black px-2 py-0.5 rounded-sm uppercase tracking-wider">
              {priceInfo.discountPct}% {offLabel}
            </span>
          </div>

          <span className="text-xs md:text-sm font-bold text-sand truncate max-w-[180px] md:max-w-[280px]">
            {title}
          </span>

          {expiresAt && (
            <DiscountCountdown expiresAt={expiresAt} isRTL={isRTL} />
          )}

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs text-sand/40 line-through">{priceInfo.originalPrice} {sym}</span>
            <span className="text-base font-black text-accent-orange drop-shadow-[0_0_6px_hsl(var(--accent-orange)/0.4)]">{priceInfo.finalPrice} {sym}</span>
          </div>

          <span className="hidden md:flex text-[11px] font-bold text-accent-orange items-center gap-1 group-hover:gap-2 transition-all uppercase tracking-wider">
            {enrollLabel}
            <Arrow className="w-3 h-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}

var slideVariants = {
  enter: function (direction: number) {
    return { y: direction > 0 ? 20 : -20, opacity: 0 };
  },
  center: { y: 0, opacity: 1 },
  exit: function (direction: number) {
    return { y: direction > 0 ? -20 : 20, opacity: 0 };
  },
};

var DiscountUrgencyBanner: React.FC<{ courseId?: string }> = function (props) {
  var courseId = props.courseId;
  var langCtx = useLanguage();
  var isRTL = langCtx.isRTL;
  var state = useState<[number, number]>([0, 1]);
  var activeState = state[0];
  var setActiveIndex = state[1];
  var activeIndex = activeState[0];
  var direction = activeState[1];

  var queryResult = useQuery<DiscountedCourse[]>({
    queryKey: ["homepage-discount-banner-carousel", courseId],
    queryFn: async function () {
      var now = new Date().toISOString();
      var query = supabase
        .from("courses")
        .select("id, title, title_ar, price, discount_percentage, discount_expires_at")
        .eq("is_published", true)
        .gt("discount_percentage", 0)
        .gt("discount_expires_at", now);
      if (courseId) {
        query = query.eq("id", courseId);
      }
      var res = await query
        .order("discount_percentage", { ascending: false })
        .limit(10);
      if (res.error) throw res.error;
      return (res.data || []) as DiscountedCourse[];
    },
    staleTime: 60 * 1000,
  });

  var courses = queryResult.data || [];

  useEffect(function () {
    if (courses.length <= 1) return;
    var interval = setInterval(function () {
      setActiveIndex(function (prev) {
        return [(prev[0] + 1) % courses.length, 1];
      });
    }, 6000);
    return function () { clearInterval(interval); };
  }, [courses.length]);

  if (courses.length === 0) return null;

  var currentCourse = courses[activeIndex % courses.length];

  return (
    <div>
      <motion.section
        id="discount-urgency-banner"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="discount-banner overflow-hidden bg-near-black border-b border-accent-orange/20 shadow-[0_2px_16px_hsl(var(--accent-orange)/0.25)]"
      >
        <div className="px-3 sm:px-6 py-1.5 sm:py-2 relative">
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
              <SlideItemContent course={currentCourse} isRTL={isRTL} />
            </motion.div>
          </AnimatePresence>

          {courses.length > 1 && (
            <div className="flex items-center justify-center gap-1 mt-1.5">
              {courses.map(function (_, i) {
                var isActive = i === activeIndex % courses.length;
                var cls = "rounded-full transition-all duration-300 " +
                  (isActive
                    ? "bg-accent-orange w-3 sm:w-4 h-1 sm:h-1.5"
                    : "bg-sand/20 w-1 h-1 sm:w-1.5 sm:h-1.5");
                return (
                  <button
                    key={i}
                    onClick={function () {
                      setActiveIndex([i, i > activeIndex ? 1 : -1]);
                    }}
                    className={cls}
                    aria-label={"Slide " + (i + 1)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );
};

export default DiscountUrgencyBanner;
