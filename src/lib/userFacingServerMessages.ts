import type { TFunction } from "i18next";

/** Map Supabase GoTrue / hosted error messages and codes to i18n (password update / recovery). */
export function translateSupabasePasswordUpdateError(error: unknown, t: TFunction): string {
  if (!error || typeof error !== "object") {
    return t("errors.generic");
  }
  const err = error as { message?: string; code?: string };
  const code = String(err.code || "")
    .toLowerCase()
    .trim();
  if (code === "weak_password") {
    return t("auth.passwordErrors.weakPassword");
  }
  if (code === "same_password") {
    return t("auth.passwordErrors.sameAsOld");
  }
  const msg = String(err.message || "").trim();
  const lower = msg.toLowerCase();

  if (
    lower.includes("different from the old password") ||
    lower.includes("same as the old") ||
    lower.includes("same as your old") ||
    lower.includes("previous password")
  ) {
    return t("auth.passwordErrors.sameAsOld");
  }
  if (
    lower.includes("weak") ||
    lower.includes("easy to guess") ||
    lower.includes("pwned") ||
    lower.includes("known to be weak")
  ) {
    return t("auth.passwordErrors.weakPassword");
  }
  if (lower.includes("at least 6") || lower.includes("least 6 characters")) {
    return t("auth.signup.passwordTooShort");
  }
  if (
    lower.includes("expired") ||
    lower.includes("invalid token") ||
    lower.includes("jwt expired") ||
    lower.includes("session missing") ||
    lower.includes("auth session")
  ) {
    return t("auth.passwordErrors.sessionInvalid");
  }

  return t("errors.generic");
}

const COUPON_EXACT: Record<string, string> = {
  "Missing coupon code": "checkout.couponErrors.missingCode",
  "Invalid amount": "checkout.couponErrors.invalidAmount",
  "Too many attempts. Please wait a few minutes.": "checkout.couponErrors.rateLimited",
  "Validation failed": "checkout.couponErrors.validationFailed",
  "No validation result": "checkout.couponErrors.validationFailed",
  "An unexpected error occurred": "checkout.couponErrors.unexpected",
  Unauthorized: "checkout.couponErrors.unauthorized",
  "Invalid coupon code": "checkout.invalidPromoCode",
  "This coupon is no longer active": "checkout.couponErrors.notActive",
  "This coupon is not yet valid": "checkout.couponErrors.notYetValid",
  "This coupon has expired": "checkout.couponErrors.expired",
  "This coupon has reached its maximum usage limit": "checkout.couponErrors.maxUsage",
  "You have already used this coupon": "checkout.couponErrors.alreadyUsedCoupon",
  "This coupon is not valid for this course": "checkout.couponErrors.notForCourse",
  "You cannot use your own affiliate code": "checkout.couponErrors.ownAffiliate",
  "Coupon not found": "checkout.couponErrors.couponNotFound",
  "Code already used": "checkout.couponErrors.codeAlreadyUsed",
  "Already used by you": "checkout.couponErrors.alreadyUsedByYouSeries",
};

/** Map coupon-validate / RPC English messages to current locale. */
export function translateCouponValidationMessage(raw: string | undefined | null, t: TFunction): string {
  const s = String(raw || "").trim();
  if (!s) {
    return t("checkout.invalidPromoCode");
  }
  const key = COUPON_EXACT[s];
  if (key) {
    return t(key);
  }
  const minMatch = s.match(/^Minimum purchase amount is\s+(.+)$/i);
  if (minMatch) {
    return t("checkout.couponErrors.minimumAmount", { amount: minMatch[1].trim() });
  }
  return t("checkout.invalidPromoCode");
}

const TAP_EXACT: Record<string, string> = {
  "Payment was declined. Please try again.": "checkout.tapErrors.paymentDeclined",
  "Payment is still being confirmed. Please wait a moment and try again from the success page if needed.":
    "checkout.tapErrors.stillConfirming",
  "Payment response missing. Please try again.": "checkout.tapErrors.responseMissing",
  "Please sign in to make a payment": "checkout.tapErrors.signInRequired",
  "Payment gateway did not return a payment page.": "checkout.tapErrors.noPaymentPage",
  "Payment window was closed": "checkout.tapErrors.windowClosed",
  "تم إغلاق نافذة الدفع": "checkout.tapErrors.windowClosed",
  "Payment failed. Please try again.": "checkout.tapErrors.genericFailed",
  "Payment verification failed": "checkout.tapErrors.verificationFailed",
  Unauthorized: "checkout.tapErrors.unauthorized",
  "User profile not found. Please complete your profile before payment.": "checkout.tapErrors.profileNotFound",
  "Profile incomplete. Please fill all required fields before payment.": "checkout.tapErrors.profileIncomplete",
  "You are already enrolled in this course": "checkout.tapErrors.alreadyEnrolled",
  "Invalid phone number. Please use a valid number with country code (for example +966501234567 or +970599123456).":
    "checkout.tapErrors.invalidPhone",
  "Payment gateway is temporarily unavailable. Please try again.": "checkout.tapErrors.gatewayUnavailable",
  "Payment gateway returned an invalid response. Please try again.": "checkout.tapErrors.gatewayInvalidResponse",
  "Payment gateway returned a malformed response. Please try again.": "checkout.tapErrors.gatewayMalformed",
  "Payment gateway returned a malformed response.": "checkout.tapErrors.gatewayMalformed",
  "Payment gateway did not provide a payment page. Please try again.": "checkout.tapErrors.noPaymentPage",
  "Payment service not configured": "checkout.tapErrors.serviceNotConfigured",
  "Payment service misconfigured": "checkout.tapErrors.serviceMisconfigured",
  "Invalid request body": "checkout.tapErrors.invalidRequest",
  "Failed to create payment record": "checkout.tapErrors.createRecordFailed",
  "An unexpected error occurred": "checkout.tapErrors.unexpected",
  "Payment request failed": "checkout.tapErrors.requestFailed",
  "Verification request failed": "checkout.tapErrors.verificationFailed",
};

/** Map Tap / edge-function English errors shown on checkout failure overlay. */
export function translateTapPaymentDisplayError(raw: string | null | undefined, t: TFunction): string {
  const s = String(raw || "").trim();
  if (!s) {
    return t("checkout.statusOverlay.paymentErrorFallback");
  }
  const key = TAP_EXACT[s];
  if (key) {
    return t(key);
  }
  if (/^Minimum purchase amount is\s+/i.test(s)) {
    const m = s.match(/^Minimum purchase amount is\s+(.+)$/i);
    if (m) {
      return t("checkout.couponErrors.minimumAmount", { amount: m[1].trim() });
    }
  }
  if (COUPON_EXACT[s]) {
    return translateCouponValidationMessage(s, t);
  }
  return t("checkout.statusOverlay.paymentErrorFallback");
}
