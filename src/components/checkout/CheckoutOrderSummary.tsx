/**
 * CheckoutOrderSummary — sticky sidebar for the desktop CheckoutPage.
 *
 * Shows course thumbnail, title, price breakdown (subtotal, discount, total),
 * currency conversion hint, VAT note, trust signals, and an optional "Edit
 * billing details" link (visible on step 2 to nudge the user back to step 1
 * if they want to fix something).
 *
 * Why a separate component:
 *   - Keeps CheckoutPage focused on flow / state
 *   - Reusable later for BundleCheckoutPage with minor tweaks
 *   - Cleaner mobile fallback (the same component renders inline above the
 *     form on small viewports instead of as a fixed sidebar)
 */
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Shield, ShieldCheck, Pencil, CreditCard, Check } from "lucide-react";
import CheckoutWhatsAppHelp from "@/components/checkout/CheckoutWhatsAppHelp";

interface CheckoutOrderSummaryProps {
  isRTL: boolean;
  /** Sticky on desktop (≥lg). On mobile/tablet renders as a regular block. */
  sticky?: boolean;

  // Course
  courseTitle: string;
  courseThumbnailUrl: string | null;

  // Pricing
  originalPrice: number;
  discountedPrice: number;
  discountAmount: number;
  /** "20%", "150 SAR", or empty when no discount applied */
  discountLabel: string;
  promoApplied: boolean;
  currencyLabel: string;
  vatPct?: number;

  // Currency conversion (for non-SAR display)
  isSAR: boolean;
  exchangeRate?: number;

  // Step 2 only — show "Edit billing" button to jump back to step 1
  onEditBilling?: () => void;
  showEditBilling?: boolean;

  // Optional: course id for the WhatsApp help button context
  courseId?: string;
}

const CheckoutOrderSummary: React.FC<CheckoutOrderSummaryProps> = ({
  isRTL,
  sticky = true,
  courseTitle,
  courseThumbnailUrl,
  originalPrice,
  discountedPrice,
  discountAmount,
  discountLabel,
  promoApplied,
  currencyLabel,
  vatPct = 0,
  isSAR,
  exchangeRate = 1,
  onEditBilling,
  showEditBilling = false,
  courseId,
}) => {
  const formatLocal = (amount: number) => `${amount} ${currencyLabel}`;

  const sarLabel = isRTL ? "ر.س" : "SAR";
  const sarEquivalent = !isSAR && exchangeRate > 0 ? Math.ceil(discountedPrice / exchangeRate) : null;

  return (
    <aside
      className={[
        "w-full lg:w-[360px] shrink-0",
        sticky ? "lg:sticky lg:top-[calc(var(--navbar-h)+1rem)]" : "",
      ].join(" ")}
      aria-label={isRTL ? "ملخص الطلب" : "Order summary"}
    >
      <div className="rounded-2xl border-2 border-border bg-card p-4 sm:p-5 shadow-sm space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground">
            {isRTL ? "ملخص الطلب" : "Order Summary"}
          </h2>
          {promoApplied && discountLabel && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
              <Check className="w-3 h-3" />
              {discountLabel}
            </span>
          )}
        </div>

        {/* Course card */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/60">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0 ring-1 ring-border">
            {courseThumbnailUrl ? (
              <img
                src={courseThumbnailUrl}
                alt={courseTitle}
                width={160}
                height={160}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                <CreditCard className="w-7 h-7 text-primary" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              {isRTL ? "الكورس" : "Course"}
            </p>
            <h3 className="text-sm font-bold text-foreground leading-snug line-clamp-3">
              {courseTitle}
            </h3>
          </div>
        </div>

        {/* Price breakdown */}
        <div className="space-y-2 text-sm">
          {promoApplied && originalPrice > discountedPrice && (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>{isRTL ? "السعر الأصلي" : "Subtotal"}</span>
                <span className="line-through tabular-nums">{formatLocal(originalPrice)}</span>
              </div>
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                <span>{isRTL ? "الخصم" : "Discount"}</span>
                <span className="tabular-nums">−{formatLocal(discountAmount)}</span>
              </div>
              <div className="border-t border-border" />
            </>
          )}
          <div className="flex justify-between items-baseline pt-1">
            <span className="text-base font-bold">
              {isRTL
                ? vatPct > 0 ? "الإجمالي شامل الضريبة" : "الإجمالي"
                : vatPct > 0 ? "Total (incl. VAT)" : "Total"}
            </span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={`total-${discountedPrice}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="text-xl font-extrabold text-primary tabular-nums"
              >
                {formatLocal(discountedPrice)}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* Currency conversion hint */}
          {sarEquivalent != null && (
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground text-center leading-snug">
              {isRTL ? "سيُخصم على بطاقتك " : "Charged on your card: "}
              <span className="font-bold text-foreground tabular-nums">
                {sarEquivalent} {sarLabel}
              </span>
            </div>
          )}

          {/* VAT note */}
          {vatPct > 0 && (
            <p className="text-[10px] text-muted-foreground text-center pt-1">
              {isRTL ? "الرقم الضريبي" : "VAT Number"}:{" "}
              <span className="font-mono font-medium text-foreground/70">311508395300003</span>
            </p>
          )}
        </div>

        {/* Edit billing — Step 2 only */}
        {showEditBilling && onEditBilling && (
          <button
            type="button"
            onClick={onEditBilling}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted hover:border-primary/40 active:scale-[0.98] transition-all min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Pencil className="w-3.5 h-3.5" />
            {isRTL ? "تعديل بيانات الفوترة" : "Edit billing details"}
          </button>
        )}

        {/* Trust signals */}
        <div className="space-y-2 pt-1 border-t border-border">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-foreground/80 pt-3">
            <Lock className="w-3.5 h-3.5 text-primary" />
            <span>{isRTL ? "مُؤمّن بواسطة Tap Payments" : "Secured by Tap Payments"}</span>
          </div>
          <div className="flex items-center justify-center gap-3 text-[10px] font-medium text-muted-foreground">
            <div className="inline-flex items-center gap-1">
              <Shield className="w-3 h-3" />
              <span>3D Secure</span>
            </div>
            <span className="text-muted-foreground/30">•</span>
            <div className="inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>PCI DSS</span>
            </div>
          </div>
        </div>

        {/* WhatsApp help — visible from the start so hesitant users can ask */}
        <div className="flex justify-center pt-1">
          <CheckoutWhatsAppHelp context="idle" variant="inline" courseId={courseId} />
        </div>
      </div>
    </aside>
  );
};

export default CheckoutOrderSummary;
