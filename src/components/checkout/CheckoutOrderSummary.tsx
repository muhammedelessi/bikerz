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
        "w-full lg:w-[320px] shrink-0",
        sticky ? "lg:sticky lg:top-[calc(var(--navbar-h)+0.75rem)]" : "",
      ].join(" ")}
      aria-label={isRTL ? "ملخص الطلب" : "Order summary"}
    >
      <div className="rounded-2xl border-2 border-border bg-card p-3.5 sm:p-4 shadow-sm space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-foreground">
            {isRTL ? "ملخص الطلب" : "Order Summary"}
          </h2>
          {promoApplied && discountLabel && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
              <Check className="w-3 h-3" />
              {discountLabel}
            </span>
          )}
        </div>

        {/* Course card — single row, smaller thumb */}
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/30 border border-border/60">
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 ring-1 ring-border">
            {courseThumbnailUrl ? (
              <img
                src={courseThumbnailUrl}
                alt={courseTitle}
                width={96}
                height={96}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
            )}
          </div>
          <h3 className="flex-1 text-xs font-bold text-foreground leading-snug line-clamp-2">
            {courseTitle}
          </h3>
        </div>

        {/* Price breakdown — compact */}
        <div className="space-y-1.5 text-xs">
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
          <div className="flex justify-between items-baseline pt-0.5">
            <span className="text-sm font-bold">
              {isRTL
                ? vatPct > 0 ? "الإجمالي" : "الإجمالي"
                : vatPct > 0 ? "Total" : "Total"}
            </span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={`total-${discountedPrice}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="text-lg font-extrabold text-primary tabular-nums"
              >
                {formatLocal(discountedPrice)}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* Currency conversion hint */}
          {sarEquivalent != null && (
            <div className="rounded-md bg-muted/40 px-2 py-1.5 text-[10px] text-muted-foreground text-center leading-tight">
              {isRTL ? "تُخصم على بطاقتك " : "Charged: "}
              <span className="font-bold text-foreground tabular-nums">
                {sarEquivalent} {sarLabel}
              </span>
            </div>
          )}
        </div>

        {/* Edit billing — Step 2 only */}
        {showEditBilling && onEditBilling && (
          <button
            type="button"
            onClick={onEditBilling}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted hover:border-primary/40 active:scale-[0.98] transition-all min-h-[34px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Pencil className="w-3 h-3" />
            {isRTL ? "تعديل بيانات الفوترة" : "Edit billing details"}
          </button>
        )}

        {/* Trust signals — compact single row */}
        <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 pt-2 border-t border-border">
          <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-foreground/80">
            <Lock className="w-3 h-3 text-primary" />
            <span>Tap Payments</span>
          </div>
          <span className="text-muted-foreground/30">•</span>
          <div className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
            <Shield className="w-3 h-3" />
            <span>3D Secure</span>
          </div>
          <span className="text-muted-foreground/30">•</span>
          <div className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
            <ShieldCheck className="w-3 h-3" />
            <span>PCI DSS</span>
          </div>
        </div>

        {/* WhatsApp help */}
        <div className="flex justify-center">
          <CheckoutWhatsAppHelp context="idle" variant="inline" courseId={courseId} />
        </div>
      </div>
    </aside>
  );
};

export default CheckoutOrderSummary;
