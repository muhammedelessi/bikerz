import React from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ShoppingBag, UserPlus } from "lucide-react";

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
    <div className="fixed inset-0 z-[120] overflow-hidden" dir={isRTL ? "rtl" : "ltr"}>
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
          className="w-full max-w-sm rounded-2xl border border-border/60 bg-background/95 backdrop-blur-md p-6 text-foreground shadow-2xl"
        >
          <div className="pb-4 border-b border-border/70">
            <h3 className="text-xl font-black mb-1">{isRTL ? "🎬 شكراً لمشاهدتك!" : "🎬 Thank you for watching!"}</h3>
            <p className="text-sm text-muted-foreground">
              {isRTL ? "سعداء أنك استمتعت بالمشاهدة المجانية." : "Glad you enjoyed the free preview."}
            </p>
          </div>

          <section className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2.5">
            <div className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-500">
              {isRTL ? "مجاني / FREE" : "FREE / مجاني"}
            </div>
            <p className="text-sm font-semibold">
              {isRTL ? "تريد مشاهدة المزيد من الفيديوهات المجانية؟" : "Want to watch more free videos?"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isRTL
                ? "أنشئ حسابًا مجانيًا للمتابعة. بدون أي دفعة الآن."
                : "Create a free account to continue. No payment required now."}
            </p>
            <Button className="btn-cta w-full" onClick={onCreateAccount}>
              <UserPlus className="size-4" />
              {isRTL
                ? "أنشئ حسابك وشاهد المقاطع المجانية"
                : "Create Account & Watch Free Videos"}
            </Button>
          </section>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border/70" />
            <span>{isRTL ? "— أو —" : "— or —"}</span>
            <span className="h-px flex-1 bg-border/70" />
          </div>

          <section className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-3">
            <p className="text-sm font-semibold">
              {isRTL ? "احصل على الوصول الكامل لهذه الدورة" : "Get full access to this course"}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {hasDiscount && (
                <span className="text-sm text-muted-foreground line-through">
                  {originalPriceText} {currencySymbol}
                </span>
              )}
              <span className="text-2xl font-black text-primary">
                {finalPriceText} {currencySymbol}
              </span>
              {hasDiscount && (
                <span className="inline-flex rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                  {isRTL ? `خصم ${discountPercentage}%` : `${discountPercentage}% off`}
                </span>
              )}
            </div>
            <Button
              variant="outline"
              className="w-full border-emerald-500/90 bg-transparent font-semibold text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400"
              onClick={onBuyCourse}
            >
              <ShoppingBag className="size-4" />
              {isRTL ? "شراء الدورة الآن" : "Buy Course Now"}
            </Button>
          </section>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {isRTL ? "لديك حساب بالفعل؟ " : "Already have an account? "}
            <button type="button" onClick={onLogin} className="text-primary underline underline-offset-4 hover:opacity-90">
              {isRTL ? "تسجيل الدخول" : "Login"}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default GuestPreviewHardGate;
