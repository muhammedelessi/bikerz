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
   * Called once on mount with a `tokenize` function and `reinit` to force a
   * fresh card iframe (needed after a failed charge — Tap rejects the same
   * tok_xxx twice with code 1126 "Source already used").
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

  const { sdkLoading, sdkReady, cardValid, sdkError, cardBrand, tokenize, reinit } = useTapCardSdk({
    containerId: CONTAINER_ID,
    enabled: active,
    config,
  });

  // Bubble status to parent on every change.
  useLayoutEffect(() => {
    onStatusChange({ sdkLoading, sdkReady, cardValid, sdkError });
  }, [sdkLoading, sdkReady, cardValid, sdkError, onStatusChange]);

  // Hand the tokenize + reinit fns up to the parent once.
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

      {/* Branded card frame: cleaner border + subtle shadow, primary header strip, primary border on valid */}
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
        {/* Branded header. Mobile uses a slimmer strip (px-3 py-1.5,
            smaller text, "256-bit encrypted" abbreviated to a lock icon
            only) so we save ~12px of vertical space on small viewports
            without losing the brand color cue. */}
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

        {/* Iframe container — SDK injects its UI here */}
        <div className="relative">
          {(sdkLoading || (!sdkReady && !sdkError)) && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">
                {isRTL ? "جارٍ تحميل نموذج الدفع الآمن…" : "Loading secure payment form…"}
              </p>
            </div>
          )}

          {/*
            Iframe host. min-h ensures the loading overlay has room before the
            SDK injects its content; touch-action prevents iOS Safari from
            inheriting page-level pinch-zoom into the OTP/card iframe.
          */}
          <div
            id={CONTAINER_ID}
            className="min-h-[200px] [&>iframe]:!block [&>iframe]:!w-full"
            style={{ touchAction: "manipulation" }}
          />

          {/* "Card details complete" affirmation. On mobile the primary
              border + shadow already signals validity; the extra strip
              just eats space. Keep it on desktop where vertical room is
              generous and the visual reassurance is welcome. */}
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
