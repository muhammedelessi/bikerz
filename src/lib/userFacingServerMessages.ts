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

/**
 * Pattern-matched bank decline / Tap-acquirer messages.
 *
 * Tap surfaces the bank's reason verbatim (e.g. "Insufficient funds",
 * "Do not honor", or just "Code 51" for an ISO-8583 code). Each pattern
 * maps to an i18n key that resolves to an *actionable* message — telling
 * the user what to do next ("try another card", "contact your bank",
 * "check OTP") instead of a generic "Payment failed".
 *
 * Order matters: more specific patterns must come before generic ones.
 * All regex flags use `i` for case-insensitive matching.
 */
const TAP_PATTERNS: Array<{ test: RegExp; key: string }> = [
  // --- Funds / limits ---
  { test: /insufficient (funds|balance)|not enough (funds|balance|money)/i, key: "checkout.tapErrors.insufficientFunds" },
  { test: /^code\s*51\b/i, key: "checkout.tapErrors.insufficientFunds" },
  { test: /exceed.*(limit|amount|withdrawal)|limit.*exceeded|withdrawal.*limit|over.*(limit|the limit)/i, key: "checkout.tapErrors.exceedsLimit" },
  { test: /^code\s*61\b/i, key: "checkout.tapErrors.exceedsLimit" },

  // --- Card status ---
  { test: /(card|number).*expired|expired.*card|expir(y|ed) date/i, key: "checkout.tapErrors.cardExpired" },
  { test: /^code\s*54\b/i, key: "checkout.tapErrors.cardExpired" },
  { test: /lost (card|or stolen)|stolen card|reported lost/i, key: "checkout.tapErrors.lostStolen" },
  { test: /^code\s*(41|43)\b/i, key: "checkout.tapErrors.lostStolen" },
  { test: /restricted (card)?|card (is )?restricted/i, key: "checkout.tapErrors.restrictedCard" },
  { test: /^code\s*62\b/i, key: "checkout.tapErrors.restrictedCard" },
  { test: /pickup card|pick up card|pick-up card/i, key: "checkout.tapErrors.pickupCard" },
  { test: /^code\s*04\b/i, key: "checkout.tapErrors.pickupCard" },
  { test: /invalid (card|number|account)|incorrect card/i, key: "checkout.tapErrors.invalidCard" },
  { test: /^code\s*(14|15)\b/i, key: "checkout.tapErrors.invalidCard" },

  // --- 3-D Secure / authentication ---
  { test: /3.?d.?s.*(fail|invalid|incorrect|error)|authentication.*(fail|invalid|incorrect|error)|otp.*(fail|invalid|incorrect|wrong)/i, key: "checkout.tapErrors.authFailed" },
  { test: /not enrolled|3.?d.?s.*(not.*available|unavailable|disabled)|card not eligible/i, key: "checkout.tapErrors.notEnrolled" },

  // --- Bank decisions ---
  { test: /do not hono(u)?r|do_not_honou?r|honou?r declined/i, key: "checkout.tapErrors.doNotHonor" },
  { test: /^code\s*05\b/i, key: "checkout.tapErrors.doNotHonor" },
  { test: /suspected fraud|fraud (detected|suspected)|risky transaction/i, key: "checkout.tapErrors.suspectedFraud" },
  { test: /^code\s*59\b/i, key: "checkout.tapErrors.suspectedFraud" },
  { test: /transaction not (permitted|allowed)|not allowed (for|on) (card|cardholder)/i, key: "checkout.tapErrors.notPermitted" },
  { test: /^code\s*(57|58|62)\b/i, key: "checkout.tapErrors.notPermitted" },

  // --- Issuer / acquirer ---
  { test: /issuer.*(unavailable|not available|down|inoperative)|acquirer.*(unavailable|not available|down)/i, key: "checkout.tapErrors.issuerUnavailable" },
  { test: /^code\s*(91|92)\b/i, key: "checkout.tapErrors.issuerUnavailable" },

  // --- System / network ---
  { test: /system (error|malfunction|unavailable)|gateway (error|down|timeout|unavailable)|internal (server )?error/i, key: "checkout.tapErrors.systemError" },
  { test: /^code\s*(96|06)\b/i, key: "checkout.tapErrors.systemError" },
  { test: /timeout|timed out|connection (lost|reset)/i, key: "checkout.tapErrors.timeout" },

  // --- User actions ---
  { test: /cancel(led|ed)? by user|user cancel|customer cancel/i, key: "checkout.tapErrors.userCancelled" },

  // --- Generic fallbacks (last) ---
  { test: /declin(ed|e)\b|reject(ed|e)\b|refused/i, key: "checkout.tapErrors.declined" },
];

/**
 * Map Tap / edge-function errors shown on the checkout failure overlay.
 *
 * Resolution order (first match wins):
 *   1. Exact match in TAP_EXACT (curated English strings from our backend).
 *   2. Pattern match in TAP_PATTERNS (bank decline reasons + ISO-8583 codes).
 *   3. "Minimum purchase amount is X" → coupon-min-amount template.
 *   4. Coupon-validation messages.
 *   5. Generic fallback ("Payment error. Please try again.").
 *
 * Step 2 is the meaningful improvement over older versions: instead of
 * showing "An error occurred" for "Insufficient funds", the user sees
 * "Insufficient balance — try another card or top up" in their language.
 */
export function translateTapPaymentDisplayError(raw: string | null | undefined, t: TFunction): string {
  const s = String(raw || "").trim();
  if (!s) {
    return t("checkout.statusOverlay.paymentErrorFallback");
  }
  // 1. Exact match (curated)
  const exactKey = TAP_EXACT[s];
  if (exactKey) {
    return t(exactKey);
  }
  // 2. Pattern match (bank declines + ISO codes)
  for (const { test, key } of TAP_PATTERNS) {
    if (test.test(s)) {
      return t(key);
    }
  }
  // 3. Coupon "minimum amount" template
  if (/^Minimum purchase amount is\s+/i.test(s)) {
    const m = s.match(/^Minimum purchase amount is\s+(.+)$/i);
    if (m) {
      return t("checkout.couponErrors.minimumAmount", { amount: m[1].trim() });
    }
  }
  // 4. Coupon errors
  if (COUPON_EXACT[s]) {
    return translateCouponValidationMessage(s, t);
  }
  // 5. Fallback
  return t("checkout.statusOverlay.paymentErrorFallback");
}
