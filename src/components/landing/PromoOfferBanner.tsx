import React, { useState } from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { Gift, Copy, Check, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PromoOfferBanner: React.FC = () => {
  const { isRTL } = useLanguage();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.2 });
  const [copied, setCopied] = useState(false);

  // Fetch the first active global coupon to display
  const { data: promo } = useQuery({
    queryKey: ["landing-promo"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("coupons")
        .select("code, value, type, description, description_ar")
        .eq("status", "active")
        .eq("is_global", true)
        .eq("is_deleted", false)
        .lte("start_date", now)
        .gte("expiry_date", now)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });

  if (!promo) return null;

  const discountText =
    promo.type === "percentage"
      ? isRTL
        ? `خصم ${promo.value}%`
        : `${promo.value}% OFF`
      : isRTL
        ? `خصم ${promo.value} ر.س`
        : `${promo.value} SAR OFF`;

  const description = isRTL
    ? promo.description_ar || "استخدم الكود أدناه واحصل على خصم فوري عند التسجيل!"
    : promo.description || "Use the code below and get an instant discount on enrollment!";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promo.code);
      setCopied(true);
      toast.success(isRTL ? "تم نسخ الكود!" : "Code copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(isRTL ? "فشل النسخ" : "Failed to copy");
    }
  };

  return (
    <section ref={ref} className="relative py-6 sm:py-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/15 via-primary/5 to-primary/15" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="section-container relative z-10 !py-0"
      >
        <div className="relative rounded-2xl border border-primary/30 bg-card/80 p-6 sm:p-8 overflow-hidden">
          {/* Glow effect */}
          <div className="absolute -top-20 -end-20 w-40 h-40 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-20 -start-20 w-40 h-40 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            {/* Icon */}
            <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-glow">
              <Gift className="w-7 h-7 text-primary-foreground" />
            </div>

            {/* Text */}
            <div className="flex-1 text-center sm:text-start">
              <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-primary uppercase tracking-wider">
                  {isRTL ? "عرض خاص" : "Special Offer"}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-foreground mb-1">
                {discountText}
              </h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>

            {/* Coupon code */}
            <button
              onClick={handleCopy}
              className="flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-dashed border-primary/50 bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer group"
            >
              <span className="text-lg font-mono font-black text-primary tracking-widest">
                {promo.code}
              </span>
              {copied ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : (
                <Copy className="w-5 h-5 text-primary opacity-60 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default PromoOfferBanner;
