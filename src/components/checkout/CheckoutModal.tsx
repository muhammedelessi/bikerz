import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import { DialogHeader } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2, CreditCard, Check } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCheckoutForm } from "@/hooks/checkout/useCheckoutForm";
import { useCheckoutPromo } from "@/hooks/checkout/useCheckoutPromo";
import { useTapPayment } from "@/hooks/useTapPayment";
import { useGHLFormWebhook } from "@/hooks/useGHLFormWebhook";
import { useGuestSignup } from "@/hooks/checkout/useGuestSignup";
import { enrollUserInCourse, incrementCouponUsage } from "@/services/supabase.service";
import CheckoutInfoStep from "@/components/checkout/CheckoutInfoStep";
import CheckoutPaymentStep from "@/components/checkout/CheckoutPaymentStep";
import CheckoutStatusOverlay from "@/components/checkout/CheckoutStatusOverlay";
import CheckoutStepIndicator from "@/components/checkout/CheckoutStepIndicator";
import EmbeddedCardForm from "@/components/checkout/EmbeddedCardForm";
import Checkout3DSModal from "@/components/checkout/Checkout3DSModal";
import ResponsiveCheckoutShell from "@/components/checkout/ResponsiveCheckoutShell";
import CheckoutWhatsAppHelp from "@/components/checkout/CheckoutWhatsAppHelp";
import type { CheckoutCourse } from "@/types/payment";
import { navigateToSignup } from "@/lib/authReturnUrl";
import { recordCheckoutPaymentPageVisit } from "@/services/checkoutVisitAnalytics";

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: CheckoutCourse;
  onSuccess: () => void;
  onPaymentStarted?: () => void;
  vatPct?: number;
  /** Analytics: where checkout was opened (e.g. course page vs learn page). */
  visitSource?: string;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  open,
  onOpenChange,
  course,
  onSuccess,
  onPaymentStarted,
  vatPct: vatPctProp,
  visitSource = "course_checkout",
}) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { getCoursePriceInfo, getCurrencySymbol, isSAR, exchangeRate } = useCurrency();
  const { sendCourseStatus } = useGHLFormWebhook();
  const { handleGuestSignup, guestSigningUp } = useGuestSignup();

  // Default to "info" — for returning customers with a complete profile, the
  // open-effect below auto-advances to "payment" right after prefillAndAutoAdvance().
  const [step, setStep] = useState<"info" | "payment">("info");
  /** Tokenize + reinit handles wired up from the embedded card form.
   *  reinit() is called on retry so we never re-submit a consumed token. */
  const cardApiRef = useRef<{ tokenize: () => Promise<string>; reinit: () => void } | null>(null);
  /** Last token we sent — Tap rejects reuse with code 1126, so we force a
   *  reinit before tokenizing again on every retry after the first attempt. */
  const lastTokenIdRef = useRef<string | null>(null);
  const [cardSdkStatus, setCardSdkStatus] = useState<{
    sdkLoading: boolean; sdkReady: boolean; cardValid: boolean; sdkError: string | null;
  }>({ sdkLoading: false, sdkReady: false, cardValid: false, sdkError: null });
  const [tokenizing, setTokenizing] = useState(false);
  /** Hard guard against duplicate submissions that bypass the disabled-button state.
   *  React StrictMode + click latency can fire two clicks before the disabled
   *  prop applies, leading to two `submitPayment` calls reusing the same
   *  one-shot token (Tap error 1126: "Source already used"). Pairs with
   *  lastTokenIdRef above — the ref catches reuse, this guard catches the
   *  race that produces it in the first place. */
  const submittingRef = useRef(false);
  const handleCardApiReady = useCallback((api: { tokenize: () => Promise<string>; reinit: () => void }) => {
    cardApiRef.current = api;
  }, []);
  const handleCardSdkStatusChange = useCallback(
    (s: { sdkLoading: boolean; sdkReady: boolean; cardValid: boolean; sdkError: string | null }) => {
      setCardSdkStatus(s);
    },
    [],
  );

  const priceInfo = useMemo(
    () => getCoursePriceInfo(course.id, course.price, course.discount_percentage || 0),
    [course.id, course.price, course.discount_percentage, getCoursePriceInfo],
  );

  const vatPct = vatPctProp ?? priceInfo.vatPct ?? 0;
  const basePrice = priceInfo.finalPrice;
  const currSym = getCurrencySymbol(priceInfo.currency, isRTL);

  const form = useCheckoutForm(open);
  const promo = useCheckoutPromo(course.id, basePrice);
  const tap = useTapPayment();
  const isMobile = useIsMobile();
  /**
   * Lifted promo-panel state — when the user opens the discount field, the
   * footer's primary CTA swaps from "Pay Now" to "Apply code". Single, focused
   * action prevents accidental payment without applying the discount.
   */
  const [promoOpen, setPromoOpen] = useState(false);
  // Auto-close the panel once a code is applied (the green confirmation card replaces the input).
  useEffect(() => {
    if (promo.promoApplied && promoOpen) setPromoOpen(false);
  }, [promo.promoApplied, promoOpen]);

  const discountAmount = promo.appliedCoupon ? promo.appliedCoupon.discount_amount : 0;
  const discountedPrice = promo.appliedCoupon ? promo.appliedCoupon.final_amount : basePrice;
  const discountLabel = promo.appliedCoupon
    ? promo.appliedCoupon.discount_type === "percentage"
      ? `${promo.appliedCoupon.discount_value}%`
      : `${Math.round((promo.appliedCoupon.discount_amount / basePrice) * 100)}%`
    : "";

  const formatLocal = useCallback((amount: number) => `${amount} ${currSym}`, [currSym]);

  /**
   * Compute the actual currency + amount that will be charged on the card.
   * Mirrors the same fallback logic used in handleSubmitPayment so the embedded
   * Tap iframe always shows the user the exact amount they're about to pay.
   */
  const tapChargeInfo = useMemo(() => {
    const TAP_SUPPORTED = ["SAR", "KWD", "AED", "USD", "BHD", "QAR", "OMR", "EGP"];
    const localCurrency = priceInfo.currency as string;
    if (TAP_SUPPORTED.includes(localCurrency)) {
      return { currency: localCurrency, amount: discountedPrice };
    }
    const sarAmt = isSAR || exchangeRate <= 0 ? discountedPrice : Math.ceil(discountedPrice / exchangeRate);
    return { currency: "SAR", amount: sarAmt };
  }, [priceInfo.currency, discountedPrice, isSAR, exchangeRate]);

  /** Phone country code for the SDK (e.g. "966" without the +). */
  const cardPhoneCountryCode = useMemo(() => {
    const raw = form.actualPrefix || "";
    return raw.replace(/^\+/, "").trim();
  }, [form.actualPrefix]);
  const cardPhoneNumber = useMemo(() => {
    const v = (form.phone || "").trim().replace(/[^0-9]/g, "");
    return v.startsWith("0") ? v.slice(1) : v;
  }, [form.phone]);

  /** Skip the embedded SDK entirely when the order is free (100%-off coupon). */
  const isFreeEnrollment = discountedPrice <= 0 && !!promo.appliedCoupon;
  const showEmbeddedCard = step === "payment" && !isFreeEnrollment;

  useEffect(() => {
    if (!open) {
      setStep("info");
      promo.resetPromo();
      tap.reset();
      form.resetForm();
      return;
    }
    if (user) {
      // ALWAYS show Step 1 first — even when the profile is already complete.
      // Reasoning: users want to confirm their billing details before paying;
      // it builds trust ("I see exactly what's being submitted") and lets
      // them tweak the phone or address inline without going back later.
      // The fields are silently prefilled, so it's a one-click confirm —
      // not a re-typing chore.
      void form.prefillAndAutoAdvance();
      setStep("info");
    }
  }, [open, user]);

  /**
   * If the URL carries `?code=XYZ`, validate and apply it as soon as the modal
   * opens for an authenticated user. The hook silently shows the discounted
   * summary on success — and on failure it just leaves the field collapsed
   * (the user sees no confusing prefilled-but-broken code).
   */
  const urlCodeAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open || !user) return;
    let code: string | null = null;
    try {
      const params = new URLSearchParams(window.location.search);
      code = params.get("code") || params.get("coupon");
    } catch {
      /* ignore */
    }
    if (!code) return;
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || urlCodeAppliedRef.current === trimmed) return;
    urlCodeAppliedRef.current = trimmed;
    void promo.applyCodeFromUrl(trimmed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  useEffect(() => {
    if (!open || user) return;
    onOpenChange(false);
    navigateToSignup(navigate);
  }, [open, user, navigate, onOpenChange]);

  const visitLoggedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      visitLoggedRef.current = false;
      return;
    }
    if (!user) return;
    if (visitLoggedRef.current) return;
    visitLoggedRef.current = true;
    recordCheckoutPaymentPageVisit({
      userId: user.id,
      courseId: course.id,
      source: visitSource,
    });
  }, [open, user, course.id, visitSource]);

  const handleNextStep = useCallback(() => {
    if (!form.validateInfo()) return;
    form.saveProfileData();
    setStep("payment");
  }, [form]);

  const handleSubmitPayment = useCallback(async (preTokenizedTokenId?: string) => {
    // Idempotency guard — refuse duplicate submissions even if the disabled
    // button state hasn't applied yet. Without this, a quick double-click (or
    // a StrictMode re-fire in dev) can send the same token twice and the
    // second call gets Tap error 1126: "Source already used".
    if (submittingRef.current) {
      console.warn("[Checkout] handleSubmitPayment called while already submitting — ignoring");
      return;
    }
    submittingRef.current = true;

    if (!user) {
      submittingRef.current = false;
      navigateToSignup(navigate);
      return;
    }

    if (!form.validateInfo()) {
      submittingRef.current = false;
      toast.error(
        isRTL ? "يرجى تصحيح بيانات الفوترة قبل الدفع" : "Please fix your billing details before paying.",
      );
      return;
    }
    await form.saveProfileData();

    onPaymentStarted?.();

    const localCurrency = priceInfo.currency as string;

    // Free enrollment (100% coupon)
    if (discountedPrice === 0 && promo.appliedCoupon) {
      try {
        await enrollUserInCourse(user.id, course.id);
        if (promo.appliedCoupon?.coupon_id) {
          await incrementCouponUsage({
            couponId: promo.appliedCoupon.coupon_id,
            userId: user.id,
            courseId: course.id,
            discountAmount,
            originalAmount: basePrice,
            finalAmount: 0,
          });
        }
        if (promo.appliedCoupon?.coupon_series_id && promo.appliedCoupon?.coupon_number != null && promo.appliedCoupon?.coupon_code) {
          const { recordSeriesUsage } = await import('@/services/supabase.service');
          await recordSeriesUsage({
            seriesId: promo.appliedCoupon.coupon_series_id,
            codeUsed: promo.appliedCoupon.coupon_code,
            codeNumber: promo.appliedCoupon.coupon_number,
            userId: user.id,
            courseId: course.id,
            discountAmount,
            originalAmount: basePrice,
            finalAmount: 0,
          });
        }
        // Free enrollment — no Tap webhook will fire, so the frontend is
        // the only path that informs GHL. Profile fields (DOB/gender) are
        // sent by the separate profile webhook; don't duplicate them here.
        sendCourseStatus(user.id, course.id, course.title, "purchased", {
          full_name: form.fullName,
          email: form.email,
          phone: form.fullPhone,
          country: form.effectiveCountry,
          city: form.effectiveCity,
          amount: "0",
          currency: localCurrency,
          silent: true,
        });
        onSuccess();
      } catch (err: any) {
        toast.error(err.message || "Enrollment failed");
      } finally {
        submittingRef.current = false;
      }
      return;
    }

    // Tap supported currencies
    const TAP_SUPPORTED = ["SAR", "KWD", "AED", "USD", "BHD", "QAR", "OMR", "EGP"];

    let paymentCurrency: string;
    let paymentAmount: number;

    if (TAP_SUPPORTED.includes(localCurrency)) {
      paymentCurrency = localCurrency;
      paymentAmount = discountedPrice;
    } else {
      paymentCurrency = "SAR";
      paymentAmount = isSAR || exchangeRate <= 0 ? discountedPrice : Math.ceil(discountedPrice / exchangeRate);
    }

    // Save checkout data for PaymentSuccess webhook
    try {
      sessionStorage.setItem(
        "bikerz_checkout_data",
        JSON.stringify({
          fullName: form.fullName,
          phone: form.fullPhone,
          country: form.effectiveCountry,
          city: form.effectiveCity,
          amount: String(paymentAmount),
          currency: paymentCurrency,
        }),
      );
    } catch {
      /* ignore */
    }

    // Pre-charge "pending" event — lets GHL track checkout starts (useful
    // for abandonment workflows). The authoritative "purchased" / "cancelled"
    // signal comes from the tap-webhook backend after Tap confirms, so we
    // intentionally don't fire a follow-up here.
    sendCourseStatus(user.id, course.id, course.title, "pending", {
      full_name: form.fullName,
      email: form.email,
      phone: form.fullPhone,
      country: form.effectiveCountry,
      city: form.effectiveCity,
      amount: String(paymentAmount),
      currency: paymentCurrency,
      silent: true,
    });

    const courseDisplayName = isRTL && course.title_ar ? course.title_ar : course.title;

    // Tokenize the card client-side first so the secret-key backend only ever
    // sees a tok_xxx — raw card details never leave Tap's iframe. Apple Pay
    // already supplies a token (preTokenizedTokenId), so skip the card SDK call.
    let tokenId: string | undefined = preTokenizedTokenId;
    if (!tokenId && cardApiRef.current) {
      try {
        setTokenizing(true);
        // If we already used a token in this modal session (previous attempt
        // failed / 3DS timed out), force-remount the Tap card iframe so the
        // next tokenize() returns a fresh tok_xxx. Tap rejects token reuse
        // with error 1126 "Source already used".
        if (lastTokenIdRef.current) {
          cardApiRef.current.reinit();
          // Give the SDK a tick to remount before tokenizing again.
          await new Promise((r) => setTimeout(r, 250));
        }
        tokenId = await cardApiRef.current.tokenize();
        lastTokenIdRef.current = tokenId;
      } catch (err: any) {
        setTokenizing(false);
        submittingRef.current = false;
        const fallback = isRTL ? "تعذّر التحقق من بيانات البطاقة" : "Could not validate card details";
        const friendly = err?.message || fallback;
        // Belt-and-braces: log to console, surface in the failure overlay,
        // AND fire a toast — silent failures here have repeatedly bitten
        // users in dev where the overlay can be visually missed.
        console.error("[Checkout] tokenize() rejected:", err);
        tap.setExternalError(friendly);
        toast.error(friendly);
        return;
      } finally {
        setTokenizing(false);
      }
    } else if (tokenId) {
      // Apple Pay / re-supplied token — track it too so any later card retry
      // forces a clean reinit.
      lastTokenIdRef.current = tokenId;
    }

    const buildSubmit = (tid: string | undefined) => ({
      courseId: course.id,
      currency: paymentCurrency,
      customerName: form.fullName,
      customerEmail: form.email,
      customerPhone: form.fullPhone,
      billingCity: form.effectiveCity,
      billingCountry: form.effectiveCountry,
      couponId: promo.appliedCoupon?.coupon_id,
      couponSeriesId: promo.appliedCoupon?.coupon_series_id || undefined,
      couponNumber: promo.appliedCoupon?.coupon_number ?? undefined,
      couponCode: promo.appliedCoupon?.coupon_code || promo.promoCode?.trim().toUpperCase() || undefined,
      amount: paymentAmount,
      courseName: courseDisplayName,
      isRTL,
      tokenId: tid,
    });

    try {
      try {
        await tap.submitPayment(buildSubmit(tokenId));
      } catch (err: any) {
        // Tap error 1126 = "Source already used". Happens when the card SDK
        // hands us a token that was already consumed (sometimes the SDK
        // returns a cached token without a fresh remount). Auto-recover:
        // reinit the iframe, get a brand-new token, and resubmit ONCE.
        const msg = String(err?.message || "");
        const errName = String(err?.name || "");
        const errCode = String(err?.code || "");
        const isReused =
          errName === "RecoverableTapSourceUsedError" ||
          errCode === "1126" ||
          /Source already used/i.test(msg) ||
          /\b1126\b/.test(msg);
        if (!isReused || !cardApiRef.current || preTokenizedTokenId) throw err;

        // Auto-recovery path: reinit the iframe, wait for it to come back
        // online, fetch a fresh token, then resubmit. If anything in this
        // chain fails (slow network, SDK rejected the new tokenize, etc.)
        // we surface it as a clear "couldn't retry automatically — please
        // re-enter card details" message instead of an unhandled promise
        // rejection that just shows a blank failure overlay.
        try {
          cardApiRef.current.reinit();
          // 700ms: enough time for the cleanup → fetch config → script load
          // chain to start the new mount cycle. tokenize() then polls up to
          // 8s for sdkReady, so total recovery budget is ~8.7s.
          await new Promise((r) => setTimeout(r, 700));
          const freshToken = await cardApiRef.current.tokenize();
          lastTokenIdRef.current = freshToken;
          await tap.submitPayment(buildSubmit(freshToken));
        } catch (retryErr: any) {
          console.error("[Checkout] Auto-retry after Tap 1126 failed:", retryErr);
          const friendly = isRTL
            ? "تعذّرت إعادة المحاولة تلقائياً. الرجاء إدخال بيانات البطاقة من جديد ثم اضغط ادفع."
            : "Couldn't retry automatically. Please re-enter your card details and tap Pay again.";
          tap.setExternalError(friendly);
          // Reinit one more time so the next manual attempt starts clean.
          try { cardApiRef.current?.reinit(); } catch { /* ignore */ }
        }
      }
    } finally {
      // Always release the submission lock — successful or not, the next
      // attempt must be allowed to fire (and will be guarded by status flags
      // anyway). Without this, a transient backend error would leave the
      // checkout permanently locked.
      submittingRef.current = false;
    }
  }, [
    user,
    discountedPrice,
    promo.appliedCoupon,
    // Use individual fields so a parent re-render that produces a new course
    // object reference doesn't recreate handleSubmitPayment unnecessarily.
    course.id,
    course.title,
    course.title_ar,
    form,
    tap,
    basePrice,
    discountAmount,
    isSAR,
    exchangeRate,
    isRTL,
    profile,
    onPaymentStarted,
    onSuccess,
    sendCourseStatus,
    t,
    navigate,
  ]);

  useEffect(() => {
    if (tap.status === "succeeded") {
      // Pass the actual chargeId so the success page can verify and render
      // the receipt. Hardcoding `tap_success` here breaks server-side
      // verification and leaves the user without a valid receipt link.
      const chargeParam = tap.chargeId ? `&tap_id=${encodeURIComponent(tap.chargeId)}` : "";
      navigate(`/payment-success?course=${course.id}${chargeParam}`);
    }
  }, [tap.status, tap.chargeId, course.id, navigate]);

  const isPaymentReady =
    form.isInfoValid &&
    !tap.error &&
    tap.status !== "processing" &&
    tap.status !== "verifying" &&
    tap.status !== "confirming" &&
    tap.status !== "challenging_3ds";

  const isStatusOverlay =
    tap.status === "processing" ||
    tap.status === "verifying" ||
    tap.status === "confirming" ||
    // CRITICAL: include challenging_3ds so the early-return branch
    // renders Checkout3DSModal. Without this the user clicks Pay,
    // backend returns a 3DS redirect_url, status flips to
    // challenging_3ds — but the regular checkout UI keeps rendering
    // and the 3DS iframe is never mounted, so the user sees the form
    // "reload" with no error and no way forward.
    tap.status === "challenging_3ds" ||
    tap.status === "succeeded";

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const BackArrowIcon = isRTL ? ArrowRight : ArrowLeft;

  if (open && !user) {
    return null;
  }

  if (isStatusOverlay) {
    // Lock the modal while a charge is mid-flight — closing during
    // processing/verifying/confirming doesn't cancel the charge, it just
    // hides our status UI and confuses the user about whether they were billed.
    const lockClose =
      tap.status === "processing" ||
      tap.status === "verifying" ||
      tap.status === "confirming" ||
      tap.status === "challenging_3ds";

    return (
      <>
        <ResponsiveCheckoutShell
          open={open}
          onOpenChange={onOpenChange}
          preventClose={lockClose}
          a11yLabel={isRTL ? "حالة الدفع" : "Payment status"}
          className="sm:max-w-md"
        >
          <div className="overflow-y-auto">
            <CheckoutStatusOverlay
              paymentStatus={tap.status}
              paymentError={tap.error}
              courseId={course.id}
              onSuccess={onSuccess}
              onOpenChange={onOpenChange}
              onRetry={() => {
                // Reset tap state, then force the embedded card form to
                // re-mount via reinit() — Tap tokens are single-use, so a
                // retry MUST start with a fresh iframe (otherwise the next
                // tokenize() can return the consumed token and Tap rejects
                // with code 1126: "Source already used").
                tap.reset();
                cardApiRef.current?.reinit();
                submittingRef.current = false;
                setStep("payment");
              }}
              onRecheck={tap.recheckStatus}
              navigate={navigate}
            />
          </div>
        </ResponsiveCheckoutShell>
        {tap.challengeUrl && (
          <Checkout3DSModal url={tap.challengeUrl} onCancel={tap.cancelChallenge} />
        )}
      </>
    );
  }

  return (
    <ResponsiveCheckoutShell
      open={open}
      onOpenChange={onOpenChange}
      a11yLabel={
        step === "info"
          ? (isRTL ? "معلومات الدفع" : "Billing information")
          : (isRTL ? "إتمام الشراء" : "Complete purchase")
      }
    >
        {/* ---- Header (top of modal) ----------------------------------
            Two-tier layout:
            • Top tier: title + step indicator (compact on mobile, full on desktop)
            • Bottom tier: course thumb + title + price chip
            ------------------------------------------------------------ */}
        <div className={[
          "bg-gradient-to-b from-muted/40 to-muted/15 border-b-2 border-border flex-shrink-0",
          isMobile ? "px-4 pt-3 pb-3" : "px-5 pt-5 pb-4",
        ].join(" ")}>
          {isMobile ? (
            <div className="mb-2.5">
              <CheckoutStepIndicator currentStep={step} isRTL={isRTL} compact />
            </div>
          ) : (
            <>
              <DialogHeader className="mb-3">
                {/* Visible heading — the accessible Title for screen readers
                    lives in ResponsiveCheckoutShell as sr-only, so this is
                    a plain h2 to avoid duplicate Radix Title nodes. */}
                <h2 className="text-xl font-extrabold tracking-tight text-foreground">
                  {step === "info"
                    ? (isRTL ? "معلومات الفوترة" : "Billing Information")
                    : (isRTL ? "إتمام الشراء" : "Complete Your Purchase")}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {step === "info"
                    ? (isRTL ? "نحتاج بياناتك لإصدار الفاتورة وتأكيد التسجيل" : "We need your details to issue the invoice and confirm enrollment")
                    : (isRTL ? "ادفع بأمان واستلم وصولك للكورس فوراً" : "Pay securely and get instant access to your course")}
                </p>
              </DialogHeader>
              <CheckoutStepIndicator currentStep={step} isRTL={isRTL} />
            </>
          )}

          {/* Course info — visual product card */}
          <div className={[
            "flex items-center gap-3 rounded-xl bg-background/80 border border-border/60 shadow-sm",
            isMobile ? "p-2 mt-0" : "p-3 mt-4",
          ].join(" ")}>
            <div className={[
              "rounded-lg overflow-hidden bg-muted flex-shrink-0 ring-1 ring-border",
              isMobile ? "w-11 h-11" : "w-14 h-14",
            ].join(" ")}>
              {course.thumbnail_url ? (
                <img
                  src={course.thumbnail_url}
                  alt={course.title}
                  width={112}
                  height={112}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                  <CreditCard className={isMobile ? "w-5 h-5 text-primary" : "w-6 h-6 text-primary"} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                {isRTL ? "تشتري الآن" : "You're buying"}
              </p>
              <h3 className={[
                "font-bold text-foreground truncate leading-tight",
                isMobile ? "text-sm" : "text-base",
              ].join(" ")}>
                {isRTL && course.title_ar ? course.title_ar : course.title}
              </h3>
            </div>
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              {priceInfo.discountPct > 0 && (
                <span className="text-[10px] text-muted-foreground line-through tabular-nums">
                  {formatLocal(priceInfo.originalPrice)}
                </span>
              )}
              <span className={[
                "font-extrabold text-primary tabular-nums leading-none",
                isMobile ? "text-base" : "text-lg",
              ].join(" ")}>
                {formatLocal(discountedPrice)}
              </span>
              {promo.promoApplied && discountLabel && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full tabular-nums">
                  −{discountLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Step-2 status bar — confirms who's being charged + single-click
            edit shortcut. Cleaner pill-style design that reads like a
            confirmed-detail receipt rather than another form section. */}
        {step === "payment" && (
          <div className={[
            "bg-emerald-500/5 dark:bg-emerald-500/10 border-b border-emerald-500/20 flex-shrink-0 flex items-center justify-between gap-3",
            isMobile ? "px-4 py-2" : "px-5 py-2.5",
          ].join(" ")}>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className={[
                "shrink-0 inline-flex items-center justify-center rounded-full bg-emerald-500 text-white",
                isMobile ? "h-5 w-5" : "h-6 w-6",
              ].join(" ")}>
                <Check className={isMobile ? "w-3 h-3" : "w-3.5 h-3.5"} strokeWidth={3} />
              </div>
              <div className="min-w-0 flex flex-col leading-tight">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/80 dark:text-emerald-300/80">
                  {isRTL ? "تم تأكيد البيانات" : "Details confirmed"}
                </span>
                <p className="text-xs font-semibold text-foreground truncate" dir="auto">
                  {form.fullName || (isRTL ? "—" : "—")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStep("info")}
              className={[
                "inline-flex items-center gap-1.5 rounded-lg border border-border bg-background font-semibold text-foreground hover:bg-muted hover:border-primary/40 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isMobile ? "h-8 px-2.5 text-[11px] min-h-[32px]" : "h-9 px-3 text-xs min-h-[36px]",
              ].join(" ")}
              aria-label={isRTL ? "رجوع للخطوة الأولى لتعديل البيانات" : "Back to step 1 to edit info"}
            >
              <BackArrowIcon className={isMobile ? "w-3 h-3" : "w-3.5 h-3.5"} />
              <span>{isRTL ? "تعديل" : "Edit"}</span>
            </button>
          </div>
        )}

        {/* Content — animated step transitions.
            • info → payment : slide in from the leading edge (right in LTR, left in RTL)
            • payment → info : slide in from the trailing edge
            mode="wait" ensures the outgoing step finishes before the incoming
            one mounts, so the embedded card SDK iframe never overlaps the
            previous step during the transition. */}
        <div className={[
          "overflow-y-auto flex-1 min-h-0 relative",
          // Mobile: tight padding so the iframe + footer fit above the fold.
          isMobile ? "px-3 py-2.5" : "p-4 sm:p-5",
        ].join(" ")}>
          <AnimatePresence mode="wait" initial={false}>
            {step === "info" ? (
              <motion.div
                key="step-info"
                initial={{ opacity: 0, x: isRTL ? -24 : 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isRTL ? 24 : -24 }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              >
              <CheckoutInfoStep
                key="info"
                isRTL={isRTL}
                user={user}
                fullName={form.fullName}
                setFullName={form.setFullName}
                hasNamePrefilled={form.hasNamePrefilled}
                isEditingName={form.isEditingName}
                setIsEditingName={form.setIsEditingName}
                email={form.email}
                setEmail={form.setEmail}
                phone={form.phone}
                setPhone={form.setPhone}
                phonePrefix={form.phonePrefix}
                setPhonePrefix={form.setPhonePrefix}
                phonePrefixOptions={form.phonePrefixOptions}
                countryOptions={form.countryOptions}
                cityOptions={form.cityOptions}
                selectedCountryCode={form.selectedCountryCode}
                isOtherCountry={form.isOtherCountry}
                isOtherCity={form.isOtherCity}
                countryManual={form.countryManual}
                setCountryManual={form.setCountryManual}
                setCountry={form.setCountry}
                cityManual={form.cityManual}
                setCityManual={form.setCityManual}
                handleCountryChange={form.handleCountryChange}
                handleCityChange={form.handleCityChange}
                city={form.city}
                errors={form.errors}
                setErrors={form.setErrors}
              />
              </motion.div>
            ) : (
              <motion.div
                key="step-payment"
                initial={{ opacity: 0, x: isRTL ? -24 : 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isRTL ? 24 : -24 }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              >
              <CheckoutPaymentStep
                key="payment"
                isRTL={isRTL}
                currencyLabel={currSym}
                formatLocal={formatLocal}
                promoCode={promo.promoCode}
                setPromoCode={promo.setPromoCode}
                promoApplied={promo.promoApplied}
                promoLoading={promo.promoLoading}
                appliedCoupon={promo.appliedCoupon}
                invalidCode={promo.invalidCode}
                handleApplyPromo={promo.handleApplyPromo}
                clearPromo={promo.clearPromo}
                discountLabel={discountLabel}
                discountAmount={discountAmount}
                discountedPrice={discountedPrice}
                originalPrice={basePrice}
                promoOpen={promoOpen}
                onPromoOpenChange={setPromoOpen}
                fullName={form.fullName}
                setFullName={form.setFullName}
                email={form.email}
                phone={form.phone}
                setPhone={form.setPhone}
                phonePrefix={form.phonePrefix}
                setPhonePrefix={form.setPhonePrefix}
                phonePrefixOptions={form.phonePrefixOptions}
                isOtherCountry={form.isOtherCountry}
                isOtherCity={form.isOtherCity}
                countryManual={form.countryManual}
                setCountryManual={form.setCountryManual}
                country={form.country}
                setCountry={form.setCountry}
                cityManual={form.cityManual}
                setCityManual={form.setCityManual}
                city={form.city}
                countryOptions={form.countryOptions}
                cityOptions={form.cityOptions}
                selectedCountryCode={form.selectedCountryCode}
                handleCountryChange={form.handleCountryChange}
                handleCityChange={form.handleCityChange}
                errors={form.errors}
                setErrors={form.setErrors}
                courseTitle={course.title}
                courseTitleAr={course.title_ar}
                paymentStatus={tap.status}
                isPaymentReady={isPaymentReady}
                billingIncomplete={!form.isInfoValid}
                validateBilling={form.validateInfo}
                vatPct={vatPct}
                exchangeRate={exchangeRate}
                isSAR={isSAR}
                onSubmitPayment={handleSubmitPayment}
                cardFormSlot={
                  showEmbeddedCard ? (
                    <EmbeddedCardForm
                      isRTL={isRTL}
                      active={showEmbeddedCard}
                      amount={tapChargeInfo.amount}
                      currency={tapChargeInfo.currency}
                      customerName={form.fullName}
                      customerEmail={form.email}
                      customerPhoneCountryCode={cardPhoneCountryCode}
                      customerPhoneNumber={cardPhoneNumber}
                      onApiReady={handleCardApiReady}
                      onStatusChange={handleCardSdkStatusChange}
                      onApplePayToken={(tokenId) => {
                        // Apple Pay sheet completed — submit immediately, bypassing
                        // the card SDK tokenize step (we already have a tok_xxx).
                        void handleSubmitPayment(tokenId);
                      }}
                    />
                  ) : null
                }
              />
              </motion.div>
            )}
          </AnimatePresence>
        </div>



        {/* Footer */}
        <div className={[
          "border-t-2 border-border flex-shrink-0 flex flex-col",
          // Mobile: snug padding + smaller gap so the Pay button stays above
          // any safe-area inset without pushing the form content up.
          isMobile
            ? "px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] gap-1.5"
            : "p-4 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))] gap-3",
        ].join(" ")}>
          {/* Persistent WhatsApp help — visible on both steps so a hesitant
              user can ping support without abandoning. The link variant is
              quiet so it doesn't compete with the primary Pay CTA. */}
          <div className="flex justify-center">
            <CheckoutWhatsAppHelp
              context="idle"
              variant="inline"
              courseId={course.id}
            />
          </div>
          <div className="flex gap-2">
          {step === "info" ? (
            <Button
              className="flex-1 h-12 rounded-xl text-sm font-bold btn-cta shadow-md hover:shadow-lg transition-shadow"
              onClick={handleNextStep}
              disabled={form.profileSaving || !form.isInfoValid}
            >
              {form.profileSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                  {isRTL ? "جاري الحفظ..." : "Saving..."}
                </>
              ) : (
                <>
                  {isRTL ? "متابعة للدفع" : "Continue to Payment"}
                  <ArrowIcon className="w-4 h-4 ms-2" />
                </>
              )}
            </Button>
          ) : promoOpen && !promo.promoApplied ? (
            /*
              Promo panel is open — swap the Pay button for an Apply button so the
              user has a single, focused CTA. After successful apply, the panel
              auto-closes (see useEffect above) and the footer reverts to "Pay Now".
            */
            <Button
              className="flex-1 h-11 rounded-xl text-sm font-bold"
              variant="cta"
              onClick={promo.handleApplyPromo}
              disabled={!promo.promoCode || promo.promoLoading || tap.status === "processing"}
            >
              {promo.promoLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                  {isRTL ? "جارٍ التحقق..." : "Verifying…"}
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 me-2" />
                  {isRTL ? "تطبيق الكود" : "Apply code"}
                </>
              )}
            </Button>
          ) : discountedPrice <= 0 && promo.appliedCoupon ? (
            <Button
              className="flex-1"
              variant="cta"
              onClick={() => handleSubmitPayment()}
              disabled={tap.status === "processing" || !isPaymentReady}
            >
              {tap.status === "processing" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                  {isRTL ? "جاري التسجيل..." : "Enrolling..."}
                </>
              ) : isRTL ? (
                "سجّل مجاناً"
              ) : (
                "Enroll for Free"
              )}
            </Button>
          ) : (
            <Button
              className="flex-1 h-12 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-shadow"
              variant="cta"
              onClick={() => handleSubmitPayment()}
              disabled={tap.status === "processing" || guestSigningUp || !isPaymentReady || tokenizing || (showEmbeddedCard && (!cardSdkStatus.sdkReady || !cardSdkStatus.cardValid))}
            >
              {guestSigningUp ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                  {isRTL ? "جاري إنشاء الحساب..." : "Creating account..."}
                </>
              ) : tokenizing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                  {isRTL ? "جاري التحقق من البطاقة..." : "Validating card..."}
                </>
              ) : showEmbeddedCard && !cardSdkStatus.sdkReady ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                  {isRTL ? "جاري تحميل نموذج الدفع..." : "Loading payment form..."}
                </>
              ) : showEmbeddedCard && !cardSdkStatus.cardValid ? (
                <>
                  <CreditCard className="w-4 h-4 me-2" />
                  {isRTL ? "أكمل بيانات البطاقة" : "Complete card details"}
                </>
              ) : tap.status === "processing" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                  {isRTL ? "جاري تجهيز الدفع..." : "Preparing payment..."}
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 me-2" />
                  {/*
                    Pay button must always carry the actual amount the user is about to pay,
                    so they never doubt whether the discount applied. Use the same fallback
                    logic the order summary uses (local currency when Tap supports it,
                    otherwise show the SAR equivalent).
                  */}
                  {(() => {
                    const TAP_SUPPORTED = ["SAR", "KWD", "AED", "USD", "BHD", "QAR", "OMR", "EGP"];
                    const showLocal = TAP_SUPPORTED.includes(priceInfo.currency as string);
                    const displayAmt = showLocal
                      ? discountedPrice
                      : isSAR || exchangeRate <= 0
                        ? discountedPrice
                        : Math.ceil(discountedPrice / exchangeRate);
                    const displaySym = showLocal ? currSym : isRTL ? "ر.س" : "SAR";
                    return isRTL
                      ? `ادفع الآن — ${displayAmt} ${displaySym}`
                      : `Pay Now — ${displayAmt} ${displaySym}`;
                  })()}
                </>
              )}
            </Button>
          )}
          </div>
        </div>

        {tap.status === "failed" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 sm:p-5">
            <div className="w-full max-w-md rounded-2xl border-2 border-border bg-card shadow-2xl">
              <CheckoutStatusOverlay
                paymentStatus={tap.status}
                paymentError={tap.error}
                courseId={course.id}
                onSuccess={onSuccess}
                onOpenChange={onOpenChange}
                onRetry={() => {
                  tap.reset();
                  setStep("payment");
                }}
                onRecheck={tap.recheckStatus}
                navigate={navigate}
              />
            </div>
          </div>
        )}
    </ResponsiveCheckoutShell>
  );
};

export default CheckoutModal;
