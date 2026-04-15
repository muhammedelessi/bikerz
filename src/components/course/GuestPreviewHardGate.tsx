import React from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface GuestPreviewHardGateProps {
  isRTL: boolean;
  thumbnailUrl?: string | null;
  originalPriceText: string;
  finalPriceText: string;
  discountPercentage?: number | null;
  currencySymbol: string;
  onCreateAccount: () => void;
  onBuyCourse: () => void;
  onLogin: () => void;
}

const GuestPreviewHardGate: React.FC<GuestPreviewHardGateProps> = ({
  isRTL,
  thumbnailUrl,
  originalPriceText,
  finalPriceText,
  discountPercentage,
  currencySymbol,
  onCreateAccount,
  onBuyCourse,
  onLogin,
}) => {
  const hasDiscount = Boolean(discountPercentage && discountPercentage > 0);

  return (
    <div className="relative w-full h-full min-h-[220px] overflow-hidden" dir={isRTL ? "rtl" : "ltr"}>
      {thumbnailUrl ? (
        <>
          <img src={thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover scale-105 blur-xl opacity-60" />
          <div className="absolute inset-0 bg-black/60" />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/70" />
      )}

      <div className="relative z-10 h-full flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-xl rounded-2xl border border-white/20 bg-black/55 backdrop-blur-md p-5 sm:p-7 text-white"
        >
          <div className="mb-4">
            <h3 className="text-xl sm:text-2xl font-bold mb-1">{isRTL ? "🎬 شكراً لمشاهدتك!" : "🎬 Thank you for watching!"}</h3>
            <p className="text-sm sm:text-base text-white/85">
              {isRTL ? "سعداء أنك استمتعت بالمشاهدة المجانية." : "Glad you enjoyed the free preview."}
            </p>
          </div>

          <div className="my-4 h-px bg-white/20" />

          <div className="mb-4">
            <p className="text-sm sm:text-base font-semibold mb-1">
              {isRTL ? "تريد مشاهدة المزيد من الفيديوهات المجانية؟" : "Want to watch more free videos?"}
            </p>
            <p className="text-xs sm:text-sm text-white/85">
              {isRTL
                ? "أنشئ حسابًا مجانيًا للمتابعة. بدون أي دفعة الآن."
                : "Create a free account to continue. No payment required now."}
            </p>
          </div>

          <div className="my-4 h-px bg-white/20" />

          <div className="mb-5">
            <p className="text-sm sm:text-base font-semibold mb-2">
              {isRTL ? "احصل على الوصول الكامل لهذه الدورة" : "Get full access to this course"}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {hasDiscount && (
                <span className="text-sm text-white/60 line-through">
                  {originalPriceText} {currencySymbol}
                </span>
              )}
              <span className="text-xl sm:text-2xl font-black">
                {finalPriceText} {currencySymbol}
              </span>
              {hasDiscount && (
                <span className="inline-flex rounded-full bg-amber-300/20 text-amber-200 text-xs font-semibold px-2.5 py-1">
                  {isRTL ? `خصم ${discountPercentage}%` : `${discountPercentage}% off`}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <Button className="btn-cta w-full" onClick={onCreateAccount}>
              {isRTL
                ? "أنشئ حسابك وشاهد باقي المقاطع المجانية"
                : "Create your account and watch the remaining free clips"}
            </Button>
            <p className="text-xs sm:text-sm text-white/85 text-center">
              {isRTL
                ? "أو اشترِ الدورة بسعر العرض وشاهدها كاملة"
                : "Or buy the course at the offer price and watch it in full"}
            </p>
            <Button variant="secondary" className="w-full font-semibold" onClick={onBuyCourse}>
              {isRTL ? "شراء الدورة" : "Buy Course"}
            </Button>
            <Button variant="outline" className="w-full bg-transparent text-white border-white/40" onClick={onLogin}>
              {isRTL ? "تسجيل الدخول" : "Login"}
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default GuestPreviewHardGate;
