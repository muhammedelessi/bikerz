/**
 * useCheckoutFlow — shared state + handlers for course checkout.
 *
 * Owns everything that USED to be duplicated between CheckoutModal (drawer
 * UX on mobile) and CheckoutPage (full-page UX on desktop):
 *   - Step transitions (info → payment)
 *   - Tap card SDK lifecycle (tokenize / reinit / track lastTokenId)
 *   - Form prefill + reset
 *   - Promo URL auto-apply
 *   - Visit log
 *   - Post-failure card form reset
 *   - The big handleSubmitPayment with free-enrollment branch + Tap 1126
 *     auto-recovery + GHL pending/purchased webhooks
 *
 * Each consumer (Modal / Page) keeps its own UI chrome but gets behaviour
 * for free. A bug fix to the payment flow now needs to touch ONE file.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useLocalizedNavigate } from "@/hooks/useLocalizedNavigate";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCheckoutForm } from "@/hooks/checkout/useCheckoutForm";
import { useCheckoutPromo } from "@/hooks/checkout/useCheckoutPromo";
import { useTapPayment } from "@/hooks/useTapPayment";
import { useGHLFormWebhook } from "@/hooks/useGHLFormWebhook";
import {
  enrollUserInCourse,
  incrementCouponUsage,
} from "@/services/supabase.service";
import { recordCheckoutPaymentPageVisit } from "@/services/checkoutVisitAnalytics";
import { navigateToSignup } from "@/lib/authReturnUrl";
import type { CheckoutCourse } from "@/types/payment";

const TAP_SUPPORTED = ["SAR", "KWD", "AED", "USD", "BHD", "QAR", "OMR", "EGP"];

export type CheckoutStep = "info" | "payment";

export interface UseCheckoutFlowOptions {
  course: CheckoutCourse;
  /**
   * Whether the checkout surface is currently visible. Modal passes the
   * `open` prop here so closing the modal resets state; the full page
   * passes `true` (it's always active while mounted).
   */
  active: boolean;
  /** Optional override for the course's VAT percentage. */
  vatPct?: number;
  /** Analytics: where this checkout was opened from. */
  visitSource?: string;
  /**
   * Fires when a CARD payment starts (after profile validation, before
   * tokenize). Used by the modal to dismiss any in-page banner. Not
   * called for free-enrollment payments.
   */
  onPaymentStarted?: () => void;
  /**
   * Called when a 100%-coupon free enrollment completes. The Modal uses
   * this to invoke its parent `onSuccess` callback; the Page leaves it
   * undefined and lets us navigate to /payment-success directly.
   */
  onFreeEnrollmentSuccess?: () => void;
  /**
   * Called when the SDK is ready and the user has navigated back to
   * step="info" — used by the Page to scroll the form into view. The
   * Modal doesn't need this (it auto-scrolls within the dialog).
   */
  onAdvanceToPayment?: () => void;
}

export interface UseCheckoutFlowReturn {
  // ── Step ──
  step: CheckoutStep;
  setStep: (s: CheckoutStep) => void;

  // ── Re-exported sub-hooks (consumers pass these to child components) ──
  form: ReturnType<typeof useCheckoutForm>;
  promo: ReturnType<typeof useCheckoutPromo>;
  tap: ReturnType<typeof useTapPayment>;

  // ── Card SDK plumbing ──
  cardApiRef: React.MutableRefObject<{
    tokenize: () => Promise<string>;
    reinit: () => void;
  } | null>;
  cardSdkStatus: {
    sdkLoading: boolean;
    sdkReady: boolean;
    cardValid: boolean;
    sdkError: string | null;
  };
  tokenizing: boolean;
  handleCardApiReady: (api: {
    tokenize: () => Promise<string>;
    reinit: () => void;
  }) => void;
  handleCardSdkStatusChange: (s: {
    sdkLoading: boolean;
    sdkReady: boolean;
    cardValid: boolean;
    sdkError: string | null;
  }) => void;

  // ── Pricing ──
  priceInfo: ReturnType<ReturnType<typeof useCurrency>["getCoursePriceInfo"]>;
  vatPct: number;
  basePrice: number;
  currSym: string;
  discountAmount: number;
  discountedPrice: number;
  discountLabel: string;
  formatLocal: (amount: number) => string;
  tapChargeInfo: { currency: string; amount: number };
  cardPhoneCountryCode: string;
  cardPhoneNumber: string;
  isFreeEnrollment: boolean;
  showEmbeddedCard: boolean;

  // ── Promo panel ──
  promoOpen: boolean;
  setPromoOpen: (b: boolean) => void;

  // ── UI flags ──
  isPaymentReady: boolean;
  isStatusOverlay: boolean;

  // ── Handlers ──
  handleNextStep: () => void;
  handleSubmitPayment: (preTokenizedTokenId?: string) => Promise<void>;
  handleRetryAfterFailure: () => void;
}

export function useCheckoutFlow(
  options: UseCheckoutFlowOptions,
): UseCheckoutFlowReturn {
  const { course, active, vatPct: vatPctProp, visitSource, onPaymentStarted, onFreeEnrollmentSuccess } = options;

  const { isRTL } = useLanguage();
  const { user, profile } = useAuth();
  const navigate = useLocalizedNavigate();
  const { getCoursePriceInfo, getCurrencySymbol, isSAR, exchangeRate } = useCurrency();
  const { sendCourseStatus } = useGHLFormWebhook();

  // ── Step + card state ──────────────────────────────────────────────
  const [step, setStep] = useState<CheckoutStep>("info");
  const cardApiRef = useRef<{
    tokenize: () => Promise<string>;
    reinit: () => void;
  } | null>(null);
  /** Tap rejects token reuse with code 1126 ("Source already used"). We
   *  remember the last token we sent so a retry knows it must reinit
   *  the iframe to get a fresh tok_xxx instead of the consumed one. */
  const lastTokenIdRef = useRef<string | null>(null);
  const [cardSdkStatus, setCardSdkStatus] = useState<{
    sdkLoading: boolean;
    sdkReady: boolean;
    cardValid: boolean;
    sdkError: string | null;
  }>({ sdkLoading: false, sdkReady: false, cardValid: false, sdkError: null });
  const [tokenizing, setTokenizing] = useState(false);
  /** Hard guard against duplicate submissions that bypass the
   *  disabled-button state. Two clicks before the disabled prop applies
   *  (StrictMode + click latency) would otherwise reuse the same token
   *  and trigger Tap 1126. */
  const submittingRef = useRef(false);

  const tap = useTapPayment();

  const handleCardApiReady = useCallback(
    (api: { tokenize: () => Promise<string>; reinit: () => void }) => {
      cardApiRef.current = api;
      // Wire reinit into useTapPayment so cancelChallenge automatically
      // refreshes the form on cancel — prevents Tap 1126 on the next
      // Pay click after the user dismissed the 3DS modal.
      tap.registerCardReinit(() => {
        try {
          cardApiRef.current?.reinit();
          // CRITICAL: clear the cached token. Without this the next Pay
          // click sees lastTokenIdRef and triggers a SECOND reinit on
          // top of this one — two iframe lifecycles racing leaves the
          // user staring at "Validating card…" forever.
          lastTokenIdRef.current = null;
        } catch (e) {
          console.warn("[useCheckoutFlow] cardApi.reinit() threw:", e);
        }
      });
    },
    [tap],
  );

  const handleCardSdkStatusChange = useCallback(
    (s: { sdkLoading: boolean; sdkReady: boolean; cardValid: boolean; sdkError: string | null }) => {
      setCardSdkStatus(s);
    },
    [],
  );

  // ── Pricing ────────────────────────────────────────────────────────
  const priceInfo = useMemo(
    () => getCoursePriceInfo(course.id, course.price, course.discount_percentage || 0),
    [course.id, course.price, course.discount_percentage, getCoursePriceInfo],
  );
  const vatPct = vatPctProp ?? priceInfo.vatPct ?? 0;
  const basePrice = priceInfo.finalPrice;
  const currSym = getCurrencySymbol(priceInfo.currency, isRTL);

  const form = useCheckoutForm(active);
  const promo = useCheckoutPromo(course.id, basePrice);

  const [promoOpen, setPromoOpen] = useState(false);
  // Auto-close the panel once a code is applied (the green confirmation
  // card replaces the input, so the form-mode footer is no longer needed).
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

  const formatLocal = useCallback(
    (amount: number) => `${amount} ${currSym}`,
    [currSym],
  );

  /**
   * What the embedded Tap iframe shows on the card form. Mirrors the
   * fallback logic used in handleSubmitPayment so the card form always
   * displays the actual amount the user is about to pay.
   */
  const tapChargeInfo = useMemo(() => {
    const localCurrency = priceInfo.currency as string;
    if (TAP_SUPPORTED.includes(localCurrency)) {
      return { currency: localCurrency, amount: discountedPrice };
    }
    const sarAmt = isSAR || exchangeRate <= 0 ? discountedPrice : Math.ceil(discountedPrice / exchangeRate);
    return { currency: "SAR", amount: sarAmt };
  }, [priceInfo.currency, discountedPrice, isSAR, exchangeRate]);

  /** Phone country code for the Tap SDK (e.g. "966" without the +). */
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

  // ── Effects ────────────────────────────────────────────────────────

  // Reset on close (modal-style); prefill on open with a logged-in user.
  useEffect(() => {
    if (!active) {
      setStep("info");
      promo.resetPromo();
      tap.reset();
      form.resetForm();
      return;
    }
    if (user) {
      // ALWAYS show Step 1 first — even when the profile is already complete.
      // Confirming billing details before paying builds trust and lets users
      // tweak the phone or address inline. Prefill makes it a one-click
      // confirm, not a re-typing chore.
      void form.prefillAndAutoAdvance();
      setStep("info");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, user]);

  // Apply ?code=XYZ from the URL once after open + auth.
  const urlCodeAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!active || !user) return;
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
  }, [active, user]);

  // Visit log — fire-once per active session.
  const visitLoggedRef = useRef(false);
  useEffect(() => {
    if (!active) {
      visitLoggedRef.current = false;
      return;
    }
    if (!user) return;
    if (visitLoggedRef.current) return;
    visitLoggedRef.current = true;
    recordCheckoutPaymentPageVisit({
      userId: user.id,
      courseId: course.id,
      source: visitSource ?? "course_checkout",
    });
  }, [active, user, course.id, visitSource]);

  // Post-failure card form reset — prevents the "Validating card…" stuck
  // state on the next Pay click. Without this, lastTokenIdRef being set
  // sends the next tokenize through reinit+wait+tokenize, racing visibly.
  // Also clears the billing-snapshot sessionStorage so a returning user
  // on a shared device doesn't see the previous user's PII in their form.
  const lastFailedReinitRef = useRef<string | null>(null);
  useEffect(() => {
    if (tap.status !== "failed") return;
    const tag = tap.chargeId ?? `t-${Date.now()}`;
    if (lastFailedReinitRef.current === tag) return;
    lastFailedReinitRef.current = tag;
    try {
      cardApiRef.current?.reinit();
      lastTokenIdRef.current = null;
    } catch (e) {
      console.warn("[useCheckoutFlow] post-failure reinit threw:", e);
    }
    try {
      sessionStorage.removeItem("bikerz_checkout_data");
    } catch {
      /* ignore */
    }
  }, [tap.status, tap.chargeId]);

  // On charge success → navigate to /payment-success with the actual
  // chargeId so the success page can verify and render the receipt.
  // Hardcoding `tap_success` here would break server-side verification.
  useEffect(() => {
    if (tap.status === "succeeded") {
      const chargeParam = tap.chargeId ? `&tap_id=${encodeURIComponent(tap.chargeId)}` : "";
      navigate(`/payment-success?course=${course.id}${chargeParam}`);
    }
  }, [tap.status, tap.chargeId, course.id, navigate]);

  // ── Handlers ───────────────────────────────────────────────────────
  const handleNextStep = useCallback(() => {
    if (!form.validateInfo()) return;
    form.saveProfileData();
    setStep("payment");
    options.onAdvanceToPayment?.();
  }, [form, options]);

  const handleSubmitPayment = useCallback(
    async (preTokenizedTokenId?: string) => {
      // Idempotency guard against duplicate submissions even if the disabled
      // button hasn't applied yet. A quick double-click (or StrictMode re-fire
      // in dev) can otherwise send the same token twice and Tap rejects with
      // code 1126 "Source already used".
      if (submittingRef.current) {
        console.warn(
          "[useCheckoutFlow] handleSubmitPayment called while already submitting — ignoring",
        );
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
          isRTL
            ? "يرجى تصحيح بيانات الفوترة قبل الدفع"
            : "Please fix your billing details before paying.",
        );
        // Snap the user back to step 1 so they can SEE which field failed.
        setStep("info");
        return;
      }
      await form.saveProfileData();

      onPaymentStarted?.();

      const localCurrency = priceInfo.currency as string;

      // ── Free enrollment (100% coupon) ──
      if (discountedPrice === 0 && promo.appliedCoupon) {
        try {
          await enrollUserInCourse(user.id, course.id, promo.appliedCoupon.coupon_code);
          if (promo.appliedCoupon.coupon_id) {
            await incrementCouponUsage({
              couponId: promo.appliedCoupon.coupon_id,
              userId: user.id,
              courseId: course.id,
              discountAmount,
              originalAmount: basePrice,
              finalAmount: 0,
            });
          }
          if (
            promo.appliedCoupon.coupon_series_id &&
            promo.appliedCoupon.coupon_number != null &&
            promo.appliedCoupon.coupon_code
          ) {
            const { recordSeriesUsage } = await import("@/services/supabase.service");
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
          // Free enrollment → no Tap webhook fires, so the frontend is the
          // only path that informs GHL of the purchase. Profile fields
          // (DOB/gender) ride on the separate profile webhook; don't
          // duplicate them here.
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
          if (onFreeEnrollmentSuccess) {
            onFreeEnrollmentSuccess();
          } else {
            // Default behaviour (Page-style): navigate to the success page
            // with the free-enrollment sentinel.
            navigate(`/payment-success?course=${course.id}&tap_id=free_enrollment`);
          }
        } catch (err: any) {
          toast.error(err?.message || "Enrollment failed");
        } finally {
          submittingRef.current = false;
        }
        return;
      }

      // ── Card payment ──
      let paymentCurrency: string;
      let paymentAmount: number;
      if (TAP_SUPPORTED.includes(localCurrency)) {
        paymentCurrency = localCurrency;
        paymentAmount = discountedPrice;
      } else {
        paymentCurrency = "SAR";
        paymentAmount = isSAR || exchangeRate <= 0
          ? discountedPrice
          : Math.ceil(discountedPrice / exchangeRate);
      }

      // Save checkout snapshot so the success page's webhook calls have
      // the right billing details even after redirect/reload.
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
        /* sessionStorage may be disabled in private mode → continue */
      }

      // Pre-charge "pending" event — lets GHL track checkout starts (used
      // for abandonment workflows). The authoritative "purchased" /
      // "cancelled" signal comes from the tap-webhook backend after Tap
      // confirms, so we intentionally don't fire a follow-up here.
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

      // Tokenize the card client-side first — the secret-key backend only
      // ever sees a tok_xxx; raw card details never leave Tap's iframe.
      // Apple Pay supplies a token directly so we skip this when present.
      let tokenId: string | undefined = preTokenizedTokenId;
      if (!tokenId && cardApiRef.current) {
        try {
          setTokenizing(true);
          // If we already used a token in this checkout session (previous
          // attempt failed / 3DS timed out), force-remount the Tap card
          // iframe so the next tokenize() returns a fresh tok_xxx — Tap
          // rejects token reuse with error 1126 "Source already used".
          if (lastTokenIdRef.current) {
            cardApiRef.current.reinit();
            await new Promise((r) => setTimeout(r, 250));
          }
          tokenId = await cardApiRef.current.tokenize();
          lastTokenIdRef.current = tokenId;
        } catch (err: any) {
          setTokenizing(false);
          submittingRef.current = false;
          const fallback = isRTL
            ? "تعذّر التحقق من بيانات البطاقة"
            : "Could not validate card details";
          const friendly = err?.message || fallback;
          // Belt-and-braces: log to console, surface in the failure overlay,
          // AND fire a toast — silent failures here have repeatedly bitten
          // users in dev where the overlay can be visually missed.
          console.error("[useCheckoutFlow] tokenize() rejected:", err);
          tap.setExternalError(friendly);
          toast.error(friendly);
          return;
        } finally {
          setTokenizing(false);
        }
      } else if (tokenId) {
        // Apple Pay / re-supplied token — track it so a later card retry
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
        couponCode:
          promo.appliedCoupon?.coupon_code ||
          promo.promoCode?.trim().toUpperCase() ||
          undefined,
        amount: paymentAmount,
        courseName: courseDisplayName,
        isRTL,
        tokenId: tid,
      });

      try {
        try {
          await tap.submitPayment(buildSubmit(tokenId));
        } catch (err: any) {
          // Tap error 1126 = "Source already used". Happens when the SDK
          // hands us a cached token without a fresh remount. Auto-recover:
          // reinit the iframe, fetch a brand-new token, resubmit ONCE.
          const msg = String(err?.message || "");
          const errName = String(err?.name || "");
          const errCode = String(err?.code || "");
          const isReused =
            errName === "RecoverableTapSourceUsedError" ||
            errCode === "1126" ||
            /Source already used/i.test(msg) ||
            /\b1126\b/.test(msg);
          if (!isReused || !cardApiRef.current || preTokenizedTokenId) throw err;

          try {
            cardApiRef.current.reinit();
            // 700ms: enough time for cleanup → fetch config → script load
            // chain to start a new mount. tokenize() then polls up to 8s
            // for sdkReady, so total recovery budget is ~8.7s.
            await new Promise((r) => setTimeout(r, 700));
            const freshToken = await cardApiRef.current.tokenize();
            lastTokenIdRef.current = freshToken;
            await tap.submitPayment(buildSubmit(freshToken));
          } catch (retryErr: any) {
            console.error(
              "[useCheckoutFlow] Auto-retry after Tap 1126 failed:",
              retryErr,
            );
            const friendly = isRTL
              ? "تعذّرت إعادة المحاولة تلقائياً. الرجاء إدخال بيانات البطاقة من جديد ثم اضغط ادفع."
              : "Couldn't retry automatically. Please re-enter your card details and tap Pay again.";
            tap.setExternalError(friendly);
            try {
              cardApiRef.current?.reinit();
            } catch {
              /* ignore */
            }
          }
        }
      } finally {
        // Always release the submission lock — successful or not, the next
        // attempt must be allowed to fire (and will be guarded by status
        // flags anyway). Without this, a transient backend error would
        // leave the checkout permanently locked.
        submittingRef.current = false;
      }
    },
    [
      user,
      discountedPrice,
      promo.appliedCoupon,
      promo.promoCode,
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
      onPaymentStarted,
      onFreeEnrollmentSuccess,
      sendCourseStatus,
      navigate,
      priceInfo.currency,
    ],
  );

  /** Used by the failure overlay's Retry button. Resets tap state, forces
   *  a fresh card iframe, releases the submission lock, and snaps back
   *  to the payment step. */
  const handleRetryAfterFailure = useCallback(() => {
    tap.reset();
    cardApiRef.current?.reinit();
    submittingRef.current = false;
    setStep("payment");
  }, [tap]);

  // ── Computed UI flags ──────────────────────────────────────────────
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
    // CRITICAL: include challenging_3ds so the early-return branch in
    // CheckoutModal renders the 3DS modal. Without this, status flips to
    // challenging_3ds but the regular checkout UI keeps rendering and the
    // 3DS iframe is never mounted — the user sees the form "reload" with
    // no error and no way forward.
    tap.status === "challenging_3ds" ||
    tap.status === "succeeded";

  return {
    step,
    setStep,
    form,
    promo,
    tap,
    cardApiRef,
    cardSdkStatus,
    tokenizing,
    handleCardApiReady,
    handleCardSdkStatusChange,
    priceInfo,
    vatPct,
    basePrice,
    currSym,
    discountAmount,
    discountedPrice,
    discountLabel,
    formatLocal,
    tapChargeInfo,
    cardPhoneCountryCode,
    cardPhoneNumber,
    isFreeEnrollment,
    showEmbeddedCard,
    promoOpen,
    setPromoOpen,
    isPaymentReady,
    isStatusOverlay,
    handleNextStep,
    handleSubmitPayment,
    handleRetryAfterFailure,
  };
}
