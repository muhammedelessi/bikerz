import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Timer, Flame, ArrowRight, ArrowLeft } from "lucide-react";
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
    <div className="flex items-center gap-1.5">
      {units.map((unit, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-destructive font-bold text-lg self-start mt-1">:</span>}
          <div className="flex flex-col items-center">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-destructive/20 border border-destructive/30 text-destructive font-mono font-black text-lg">
              {unit}
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5">{labels[i]}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

const DiscountUrgencyBanner: React.FC = () => {
  const { isRTL } = useLanguage();
  const { getCoursePriceInfo, getCurrencySymbol } = useCurrency();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const { data: discountedCourse } = useQuery({
    queryKey: ["homepage-discount-banner"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, title_ar, price, discount_percentage, discount_expires_at")
        .eq("is_published", true)
        .gt("discount_percentage", 0)
        .gt("discount_expires_at", now)
        .order("discount_percentage", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000,
  });

  if (!discountedCourse) return null;

  const title = isRTL && discountedCourse.title_ar ? discountedCourse.title_ar : discountedCourse.title;
  const priceInfo = getCoursePriceInfo(discountedCourse.id, discountedCourse.price, discountedCourse.discount_percentage || 0);
  const sym = getCurrencySymbol(priceInfo.currency, isRTL);

  return (
    <motion.section
      id="discount-urgency-banner"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="relative overflow-hidden bg-gradient-to-r from-destructive/10 via-destructive/5 to-destructive/10 border-b border-destructive/20"
    >
      <div className="section-container !py-3 sm:!py-4">
        <Link to={`/courses/${discountedCourse.id}`} className="block group">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
            {/* Flame + text */}
            <div className="flex items-center gap-2 text-center sm:text-start">
              <Flame className="w-5 h-5 text-destructive animate-pulse flex-shrink-0" />
              <span className="text-sm sm:text-base font-bold text-foreground">
                {isRTL
                  ? `خصم ${priceInfo.discountPct}% على "${title}"`
                  : `${priceInfo.discountPct}% OFF on "${title}"`}
              </span>
            </div>

            {/* Countdown */}
            <CountdownDisplay expiresAt={discountedCourse.discount_expires_at!} isRTL={isRTL} />

            {/* Price + CTA */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground line-through">{priceInfo.originalPrice} {sym}</span>
                <span className="text-lg font-black text-primary">{priceInfo.finalPrice} {sym}</span>
              </div>
              <span className="text-xs font-semibold text-primary flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                {isRTL ? "سجّل الآن" : "Enroll Now"}
                <Arrow className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </Link>
      </div>
    </motion.section>
  );
};

export default DiscountUrgencyBanner;
