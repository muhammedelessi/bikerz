/**
 * EmbeddedCardForm — renders the Tap Card SDK iframe and exposes a Pay button.
 *
 * Lives inside Step 2 of the checkout modal. Receives all customer + transaction
 * details from the parent, mounts the SDK on demand, and bubbles tokenization
 * results up via onPaymentReady → tokenize().
 *
 * Why a separate component:
 * - Keeps SDK lifecycle (load + render + unmount) bound to the *visibility* of
 *   Step 2. The SDK script is heavy (~1 MB) so we only ever pay that cost once
 *   the user actually wants to enter card details.
 * - Lets the modal render the order summary / promo code / footer Pay button
 *   without leaking SDK state into them.
 */
import React, { useMemo, useCallback, useLayoutEffect } from "react";
import { Loader2, Lock, ShieldCheck, AlertTriangle, CreditCard, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";
import { useTapCardSdk } from "@/hooks/checkout/useTapCardSdk";
import { useTapApplePaySdk } from "@/hooks/checkout/useTapApplePaySdk";
import { splitFullName } from "@/lib/nameUtils";
import { useIsMobile } from "@/hooks/use-mobile";
import type { TapCardConfig } from "@/types/tapCardSdk";

interface EmbeddedCardFormProps {
  isRTL: boolean;
  /** When false, the SDK is unmounted (e.g. user went back to Step 1). */
  active: boolean;
  /** Charge amount in `currency`. Whole units (the SDK formats decimals itself). */
  amount: number;
  /** Tap-supported currency code (SAR, USD, AED, …). */
  currency: string;
  customerName: string;
  customerEmail: string;
  /** Phone country prefix without "+", e.g. "966". */
  customerPhoneCountryCode: string;
  /** Local subscriber number (no leading 0). */
  customerPhoneNumber: string;
  /**
   * Called once on mount with the SDK API surface. Parent stores the ref and
   * uses it from its own "Pay Now" button so we don't duplicate footer UI.
   *
   * - tokenize(): ask the iframe to produce a fresh `tok_xxx`. Tap tokens are
   *   single-use, so each successful charge MUST be preceded by a fresh call.
   * - reinit(): destroy + remount the iframe. Use this after a failed charge
   *   that consumed the previous token (Tap error 1126 "Source already used")
   *   so the user gets a clean form and a NEW token on retry, instead of a
   *   stale one.
   */
  onApiReady: (api: { tokenize: () => Promise<string>; reinit: () => void }) => void;
  /** Live status the parent uses to enable/disable its Pay button + show messaging. */
  onStatusChange: (status: { sdkLoading: boolean; sdkReady: boolean; cardValid: boolean; sdkError: string | null }) => void;
  /**
   * Fired when the user completes Apple Pay. The parent should treat this as a
   * pre-tokenized payment and skip the regular tokenize() + Pay Now footer flow.
   */
  onApplePayToken?: (tokenId: string) => void;
}

const CONTAINER_ID = "tap-card-sdk-container";
const APPLE_PAY_CONTAINER_ID = "tap-apple-pay-container";

/** Friendly card-brand label for the small chip shown when the BIN matches. */
function brandLabel(brand: string | null): string | null {
  if (!brand) return null;
  const u = brand.toUpperCase();
  if (u.includes("VISA")) return "Visa";
  if (u.includes("MASTER")) return "Mastercard";
  if (u === "MADA" || u.includes("MADA")) return "mada";
  if (u.includes("AMEX") || u.includes("AMERICAN")) return "Amex";
  if (u.includes("DISCOVER")) return "Discover";
  if (u.includes("JCB")) return "JCB";
  if (u.includes("UNION")) return "UnionPay";
  return brand;
}

const EmbeddedCardForm: React.FC<EmbeddedCardFormProps> = ({
  isRTL,
  active,
  amount,
  currency,
  customerName,
  customerEmail,
  customerPhoneCountryCode,
  customerPhoneNumber,
  onApiReady,
  onStatusChange,
  onApplePayToken,
}) => {
  const { theme } = useTheme();
  const isMobile = useIsMobile();

  const { firstName, lastName } = useMemo(() => splitFullName(customerName), [customerName]);

  const config: Omit<TapCardConfig, "publicKey" | "onReady" | "onSuccess" | "onError" | "onValidInput" | "onInvalidInput"> =
    useMemo(
      () => {
        // Build a defensive customer object: Tap's tokenize endpoint can 400
        // on empty strings in optional fields, so omit when we don't have
        // values rather than passing "".
        const safeFirst = (firstName || customerName || "Customer").trim();
        const safeLast = (lastName || safeFirst).trim();
        const safeEmail = (customerEmail || "").trim();
        const safeFullName = `${safeFirst} ${safeLast}`.trim();
        const phone =
          customerPhoneCountryCode && customerPhoneNumber
            ? { countryCode: customerPhoneCountryCode.trim(), number: customerPhoneNumber.trim() }
            : undefined;
        const contact: { email?: string; phone?: { countryCode: string; number: string } } = {};
        if (safeEmail) contact.email = safeEmail;
        if (phone) contact.phone = phone;

        // Tap's live merchant validates the SDK config more strictly than
        // the test merchant. On production we were seeing the iframe POST
        // to /v2/card/index.html with `customer=""` in the URL and getting
        // back a 400 (test merchant happily ignored the empty fields).
        // Fix: OMIT every field we don't have a real value for instead of
        // sending it as an empty string. The docs at
        //   https://developers.tap.company/docs/card-sdk-web-v2
        // show all of these as optional, so leaving them out is canonical.
        // NOTE: `merchant.id` is intentionally NOT set here — useTapCardSdk
        // injects it from tap-config's TAP_MERCHANT_ID secret. Passing
        // `{ id: "" }` made the SDK build a request with `mid=` empty,
        // which Tap rejects with HTTP 400 in live mode.
        // Local var renamed to avoid shadowing the `customerName` PROP
        // that's still used in the dependency list below.
        const nameEntries = [
          {
            lang: isRTL ? ("ar" as const) : ("en" as const),
            first: safeFirst,
            ...(safeLast ? { last: safeLast } : {}),
          },
        ];

        return {
          transaction: { amount, currency },
          customer: {
            // No customer.id — when we don't have a saved Tap customer,
            // sending "" causes a live-merchant 400. Omit instead.
            name: nameEntries,
            ...(safeFullName ? { nameOnCard: safeFullName } : {}),
            // Drop `editable: false` — undocumented field, was a 400
            // contributor on stricter merchant configs.
            ...(Object.keys(contact).length > 0 ? { contact } : {}),
          },
          acceptance: {
            supportedBrands: ["AMERICAN_EXPRESS", "VISA", "MASTERCARD", "MADA"],
            supportedCards: "ALL" as const,
            supportedPaymentAuthentications: ["3DS"],
          },
          fields: { cardHolder: true },
          addons: { loader: true, saveCard: false, displayPaymentBrands: true },
          interface: {
            locale: isRTL ? ("ar" as const) : ("en" as const),
            theme: theme === "dark" ? ("dark" as const) : ("light" as const),
            edges: "curved" as const,
            direction: isRTL ? ("rtl" as const) : ("ltr" as const),
            // "colored" keyword renders the merchant's brand color rather
            // than a custom hex (which some merchants block).
            colorStyle: "colored",
          },
        };
      },
      [
        amount,
        currency,
        firstName,
        lastName,
        customerName,
        customerEmail,
        customerPhoneCountryCode,
        customerPhoneNumber,
        isRTL,
        theme,
      ],
    );

  const { sdkLoading, sdkReady, cardValid, sdkError, cardBrand, environment, tokenize, reinit } = useTapCardSdk({
    containerId: CONTAINER_ID,
    enabled: active,
    config,
  });

  /**
   * Detect the two misconfigurations that have been silently breaking
   * checkout in Lovable preview / localhost:
   *
   * 1. LIVE key on a dev domain — Tap rejects /v2/card/token with HTTP 400
   *    because live keys are whitelisted only for production domains.
   * 2. Domain not whitelisted on the Tap account — even the TEST key
   *    requires the merchant's "Whitelisted Domains" to include the
   *    current origin, otherwise the iframe loads but tokenize() hangs
   *    forever (postMessage from the iframe to the parent gets dropped
   *    by the SDK's internal origin check).
   *
   * Both surface as "I clicked Pay and nothing happened." We render a
   * loud bilingual banner ABOVE the card form whenever we're on a dev
   * domain so the cause + fix are visible BEFORE the user wastes a
   * card attempt.
   */
  const hostname = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
  // Production hosts — never treat as dev, even though they live on
  // *.lovable.app / *.bikerz.com infrastructure. Must mirror the
  // isProductionHost logic in tap-create-charge / tap-config.
  const isProductionHost =
    hostname === "bikerz.lovable.app" ||
    hostname === "bikerz.com" ||
    hostname.endsWith(".bikerz.com");
  const isDevHost =
    !isProductionHost && (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".lovableproject.com") ||
      hostname.endsWith(".lovable.app") ||
      hostname.endsWith(".lovable.dev")
    );
  const showLiveOnDevWarning = environment === "live" && isDevHost;
  const showTestOnDevHint = environment === "test" && isDevHost;

  // Bubble status to parent on every change.
  useLayoutEffect(() => {
    onStatusChange({ sdkLoading, sdkReady, cardValid, sdkError });
  }, [sdkLoading, sdkReady, cardValid, sdkError, onStatusChange]);

  // Hand the SDK API up to the parent. Re-runs whenever tokenize/reinit
  // identities change so the parent always holds the current closure.
  React.useEffect(() => {
    onApiReady({ tokenize, reinit });
  }, [tokenize, reinit, onApiReady]);

  // ---- Apple Pay (only renders on supported Safari/Apple devices) ----
  const applePayConfig = useMemo(
    () => ({
      transaction: { amount, currency },
      customer: {
        name: [
          {
            lang: (isRTL ? "AR" : "EN") as "EN" | "AR",
            first: firstName || customerName || "Customer",
            last: lastName || "",
          },
        ],
        contact: {
          email: customerEmail,
          phone:
            customerPhoneCountryCode && customerPhoneNumber
              ? { countryCode: customerPhoneCountryCode, number: customerPhoneNumber }
              : undefined,
        },
      },
      acceptance: {
        supportedBrands: ["VISA", "MASTERCARD", "MADA", "AMERICAN_EXPRESS"],
        supportedCards: "ALL" as const,
      },
      interface: {
        locale: (isRTL ? "AR" : "EN") as "EN" | "AR",
        theme: (theme === "dark" ? "DARK" : "LIGHT") as "DARK" | "LIGHT",
        type: "buy" as const,
        edges: "CURVED" as const,
      },
    }),
    [amount, currency, firstName, lastName, customerName, customerEmail, customerPhoneCountryCode, customerPhoneNumber, isRTL, theme],
  );

  const handleApplePayToken = useCallback(
    (tokenId: string) => {
      onApplePayToken?.(tokenId);
    },
    [onApplePayToken],
  );

  const { available: applePayAvailable } = useTapApplePaySdk({
    containerId: APPLE_PAY_CONTAINER_ID,
    enabled: active && !!onApplePayToken,
    config: applePayConfig,
    onToken: handleApplePayToken,
  });

  if (!active) return null;

  const detectedBrand = brandLabel(cardBrand);

  return (
    <div className="space-y-3">
      {/* Test-mode hint — visible on dev domains when the test key is
          loaded. Tells the user (a) they're in test mode (so a real card
          won't actually charge) and (b) the EXACT test card to use. Also
          warns that if tokenize hangs, the dev domain probably isn't on
          the merchant's whitelist (Tap dashboard → Settings → Integration
          → Whitelisted Domains). */}
      {showTestOnDevHint && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-snug text-amber-800 dark:text-amber-200 space-y-1">
          <p className="font-semibold">
            {isRTL ? "وضع الاختبار — لن تُخصم أي مبالغ" : "Test mode — no real charges"}
          </p>
          <p>
            {isRTL ? "استخدم بطاقة Tap التجريبية:" : "Use the Tap test card:"}{" "}
            <code className="font-mono">4508 7500 1574 1019</code>{" "}
            <span className="opacity-70">·</span>{" "}
            <code className="font-mono">01/39</code>{" "}
            <span className="opacity-70">·</span>{" "}
            <code className="font-mono">CVV 100</code>
          </p>
          <p className="opacity-80">
            {isRTL
              ? "إذا لم يستجب الزر بعد الضغط، أضف "
              : "If Pay seems unresponsive, whitelist "}
            <code className="font-mono text-[10px]">{hostname}</code>
            {isRTL
              ? " في حساب Tap (Settings → Integration → Whitelisted Domains)."
              : " on your Tap account (Settings → Integration → Whitelisted Domains)."}
          </p>
        </div>
      )}

      {/* Diagnostic banner — silent failure prevention for dev/preview.
          When using the LIVE key on localhost or *.lovable.app domains,
          Tap silently 400s on tokenize with no overlay. This banner makes
          the cause + fix visible BEFORE the user wastes a card attempt. */}
      {showLiveOnDevWarning && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-sm">
            {isRTL ? "بيئة الاختبار غير مهيّأة" : "Test environment not configured"}
          </AlertTitle>
          <AlertDescription className="space-y-1.5 text-xs">
            <p>
              {isRTL ? (
                <>
                  أنت تستخدم مفتاح Tap الحقيقي (live) على دومين تطوير{" "}
                  <code className="font-mono text-[10px] bg-destructive/10 px-1 rounded">
                    {hostname}
                  </code>
                  . سيرفض Tap التوكينة بـ HTTP 400 لأن هذا الدومين غير مسجّل في حساب Live.
                </>
              ) : (
                <>
                  You're using the LIVE Tap key on a dev domain (
                  <code className="font-mono text-[10px] bg-destructive/10 px-1 rounded">
                    {hostname}
                  </code>
                  ). Tap will reject tokenization with HTTP 400 because this domain isn't
                  whitelisted on your Live merchant.
                </>
              )}
            </p>
            <p className="font-semibold">
              {isRTL ? "الحل:" : "Fix:"}
            </p>
            <ul className="list-disc ps-4 space-y-0.5">
              <li>
                {isRTL
                  ? "أضف TAP_PUBLIC_TEST_KEY و TAP_MERCHANT_TEST_ID في Supabase Secrets"
                  : "Add TAP_PUBLIC_TEST_KEY + TAP_MERCHANT_TEST_ID to Supabase Secrets"}
              </li>
              <li>
                {isRTL
                  ? "أو اختبر مباشرة على academy.bikerz.com"
                  : "Or test directly on academy.bikerz.com"}
              </li>
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/*
        Apple Pay — only render the container + divider once we've actually
        confirmed the SDK rendered the button. Earlier code rendered a divider
        with placeholder space for ~800ms even when Apple Pay was unavailable,
        which looked broken. The wrapper stays display:none until available.
      */}
      <div className={applePayAvailable ? "space-y-3" : "hidden"}>
        <div id={APPLE_PAY_CONTAINER_ID} className="min-h-[44px] [&>*]:!w-full" />
        <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          <span>{isRTL ? "أو ادفع بالبطاقة" : "Or pay with card"}</span>
          <span className="h-px flex-1 bg-border" />
        </div>
      </div>

      {/*
        Two-section layout:
          1) Card-number section header (its own labeled card-strip).
          2) Iframe — Tap renders Card Number on its first row and Expiry+CVV
             on its second row; we can't physically split the iframe (cross-
             origin), so we add EXTERNAL labelled section bars above and
             below to brand each "field group" visually.
          3) Expiry/CVV section footer (labeled card-strip below).
        The whole thing is wrapped in a single rounded card so it still
        reads as one secure block.
      */}
      <div
        role="region"
        aria-label={isRTL ? "نموذج بيانات البطاقة الآمن" : "Secure card details form"}
        className={[
          "relative overflow-hidden rounded-2xl border-2 transition-all duration-300 bg-card shadow-sm",
          cardValid
            ? "border-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]"
            : "border-border hover:border-primary/30",
        ].join(" ")}
      >
        {/* Branded header (kept). */}
        <div className={[
          "flex items-center justify-between gap-2 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground",
          isMobile ? "px-3 py-2" : "px-4 py-2.5",
        ].join(" ")}>
          <div className="flex items-center gap-2 min-w-0">
            <CreditCard className={isMobile ? "w-3.5 h-3.5" : "w-4 h-4"} />
            <span className={[
              "font-semibold tracking-wide",
              isMobile ? "text-xs" : "text-sm",
            ].join(" ")}>
              {isRTL ? "بيانات البطاقة" : "Card Details"}
            </span>
            {detectedBrand && (
              <span
                className={[
                  "ml-1 inline-flex items-center rounded-full bg-primary-foreground/20 font-bold uppercase tracking-wide text-primary-foreground",
                  isMobile ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
                ].join(" ")}
                aria-live="polite"
              >
                {detectedBrand}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium opacity-95 shrink-0">
            <Lock className="w-3 h-3" />
            {!isMobile ? (
              <span>{isRTL ? "تشفير 256-bit" : "256-bit encrypted"}</span>
            ) : (
              <span className="text-[10px]">{isRTL ? "آمن" : "Secure"}</span>
            )}
          </div>
        </div>

        {/* SECTION 1 LABEL — sits directly above the card-number input row of
            the Tap iframe. The user sees "1 · رقم البطاقة" then the input. */}
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b border-border/40">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
            1
          </span>
          <span className="text-xs font-semibold text-foreground">
            {isRTL ? "رقم البطاقة" : "Card Number"}
          </span>
          <span className="ms-auto text-[10px] text-muted-foreground">
            {isRTL ? "16 رقماً" : "16 digits"}
          </span>
        </div>

        {/* Iframe container — SDK injects its UI here.
            Padding sandwiches the iframe so its rows aren't flush with the
            section bars above and below. */}
        <div className="relative px-2 py-2">
          {(sdkLoading || (!sdkReady && !sdkError)) && (
            <div
              className="absolute inset-0 z-10 flex flex-col gap-3 bg-card p-4"
              role="status"
              aria-live="polite"
              aria-label={isRTL ? "جارٍ تحميل نموذج الدفع الآمن" : "Loading secure payment form"}
            >
              {/* Card number row */}
              <div className="h-11 w-full rounded-lg bg-gradient-to-r from-muted via-muted/40 to-muted bg-[length:200%_100%] animate-shimmer" />
              {/* Expiry + CVV row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="h-11 rounded-lg bg-gradient-to-r from-muted via-muted/40 to-muted bg-[length:200%_100%] animate-shimmer" />
                <div className="h-11 rounded-lg bg-gradient-to-r from-muted via-muted/40 to-muted bg-[length:200%_100%] animate-shimmer" />
              </div>
              {/* Cardholder name row */}
              <div className="h-11 w-full rounded-lg bg-gradient-to-r from-muted via-muted/40 to-muted bg-[length:200%_100%] animate-shimmer" />
              <p className="mt-1 text-center text-[11px] text-muted-foreground">
                {isRTL ? "جارٍ تحميل نموذج الدفع الآمن…" : "Loading secure payment form…"}
              </p>
            </div>
          )}

          {/*
            Iframe host. min-h ensures the loading overlay has room before the
            SDK injects its content; touch-action prevents iOS Safari from
            inheriting page-level pinch-zoom into the OTP/card iframe.

            max-w-[380px] is intentional: Tap's Card SDK v2 picks its layout
            (inline single-row vs. stacked two-row) based on container width.
            On a wide desktop wrapper Tap fits Card Number + MM/YY + CVV all
            in one row, which collides visually with the section bars we
            added above (label says "Card Number" but the user actually
            sees three fields in one line). Constraining to ~380px is below
            Tap's inline-layout breakpoint, so the SDK switches to:
              Row 1 — Card Number (full width)
              Row 2 — MM/YY  |  CVV  (split half/half)
              Row 3 — brand icons strip
            …which matches what our two section bars promise.

            Centering with mx-auto keeps the form centered on wide screens
            so it doesn't visually drift off to one side of the wrapper.
          */}
          <div
            id={CONTAINER_ID}
            className="min-h-[200px] mx-auto max-w-[380px] [&>iframe]:!block [&>iframe]:!w-full"
            style={{ touchAction: "manipulation" }}
          />
        </div>

        {/* SECTION 2 LABEL — sits directly below the iframe so the user sees
            "2 · تاريخ الانتهاء والرمز السري" right after they finish those
            fields. Visually labels the bottom half of the form. */}
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-t border-border/40">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
            2
          </span>
          <span className="text-xs font-semibold text-foreground">
            {isRTL ? "تاريخ الانتهاء والرمز السري" : "Expiry & Security Code"}
          </span>
          <span className="ms-auto text-[10px] text-muted-foreground">
            {isRTL ? "MM/YY · CVV" : "MM/YY · CVV"}
          </span>
        </div>

        {/* "Card details complete" affirmation. Kept at the very bottom so it
            doesn't fight the section labels above. Mobile suppresses it because
            the primary border + shadow already signals validity. */}
        {cardValid && !isMobile && (
          <div
            className="border-t border-primary/15 bg-primary/5 px-4 py-2"
            aria-live="polite"
          >
            <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <ShieldCheck className="w-3.5 h-3.5" />
              {isRTL ? "بيانات البطاقة مكتملة ✓" : "Card details complete ✓"}
            </p>
          </div>
        )}
      </div>

      {/* Recoverable error: SDK init / load failure. Show a Reload button so
          the user doesn't have to close the entire modal to retry. */}
      {sdkError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-sm">
            {isRTL ? "تعذّر تحميل نموذج البطاقة" : "Could not load card form"}
          </AlertTitle>
          <AlertDescription className="space-y-2">
            <p className="text-xs">{sdkError}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={reinit}
              className="h-9"
            >
              <RefreshCw className="w-3.5 h-3.5 me-2" />
              {isRTL ? "إعادة المحاولة" : "Reload form"}
            </Button>
          </AlertDescription>
        </Alert>
      )}

    </div>
  );
};

export default EmbeddedCardForm;
