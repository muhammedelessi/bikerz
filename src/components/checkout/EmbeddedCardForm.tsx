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
import React, { useMemo, useCallback } from "react";
import { Loader2, Lock, ShieldCheck, AlertTriangle, CreditCard } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTheme } from "@/components/ThemeProvider";
import { useTapCardSdk } from "@/hooks/checkout/useTapCardSdk";
import { useTapApplePaySdk } from "@/hooks/checkout/useTapApplePaySdk";
import { splitFullName } from "@/lib/nameUtils";
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
   * Called once on mount with a `tokenize` function. Parent stores the ref and
   * calls it from its own "Pay Now" button so we don't duplicate footer UI.
   */
  onApiReady: (api: { tokenize: () => Promise<string> }) => void;
  /** Live status the parent uses to enable/disable its Pay button + show messaging. */
  onStatusChange: (status: { sdkLoading: boolean; sdkReady: boolean; cardValid: boolean; sdkError: string | null }) => void;
}

const CONTAINER_ID = "tap-card-sdk-container";

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
}) => {
  const { theme } = useTheme();

  const { firstName, lastName } = useMemo(() => splitFullName(customerName), [customerName]);

  const config: Omit<TapCardConfig, "publicKey" | "onReady" | "onSuccess" | "onError" | "onValidInput" | "onInvalidInput"> =
    useMemo(
      () => ({
        transaction: { amount, currency },
        customer: {
          name: [
            {
              lang: isRTL ? "AR" : "EN",
              first: firstName || customerName || "Customer",
              last: lastName || "",
            },
          ],
          editable: false,
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
          supportedCards: "ALL",
        },
        fields: { cardHolder: true },
        addons: { loader: true, saveCard: false, displayPaymentBrands: true },
        interface: {
          locale: isRTL ? "AR" : "EN",
          theme: theme === "dark" ? "DARK" : "LIGHT",
          edges: "CURVED",
          direction: isRTL ? "RTL" : "LTR",
          colorStyle: "#CC4E1D", // BIKERZ primary
        },
      }),
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

  const { sdkLoading, sdkReady, cardValid, sdkError, tokenize } = useTapCardSdk({
    containerId: CONTAINER_ID,
    enabled: active,
    config,
  });

  // Bubble status to parent on every change.
  React.useEffect(() => {
    onStatusChange({ sdkLoading, sdkReady, cardValid, sdkError });
  }, [sdkLoading, sdkReady, cardValid, sdkError, onStatusChange]);

  // Hand the tokenize fn up to the parent once.
  React.useEffect(() => {
    onApiReady({ tokenize });
  }, [tokenize, onApiReady]);

  if (!active) return null;

  return (
    <div className="space-y-3">
      {/* Branded card frame: sand-tinted background, primary header strip, primary border on valid */}
      <div
        className={[
          "relative overflow-hidden rounded-2xl border-2 transition-all duration-300",
          "bg-[#C6BFAA]/15 dark:bg-[#C6BFAA]/5",
          cardValid
            ? "border-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]"
            : "border-[#C6BFAA]/60 dark:border-[#C6BFAA]/20",
        ].join(" ")}
      >
        {/* Branded header */}
        <div className="flex items-center justify-between gap-2 bg-primary px-4 py-2.5 text-primary-foreground">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            <span className="text-sm font-semibold tracking-wide">
              {isRTL ? "بيانات البطاقة" : "Card Details"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium opacity-90">
            <Lock className="w-3 h-3" />
            <span>{isRTL ? "تشفير 256-bit" : "256-bit encrypted"}</span>
          </div>
        </div>

        {/* Iframe container — SDK injects its UI here */}
        <div className="relative bg-card">
          {(sdkLoading || (!sdkReady && !sdkError)) && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-card/80 backdrop-blur-sm">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">
                {isRTL ? "جارٍ تحميل نموذج الدفع الآمن…" : "Loading secure payment form…"}
              </p>
            </div>
          )}

          <div id={CONTAINER_ID} className="min-h-[280px] px-3 py-3" />

          {cardValid && (
            <div className="border-t border-primary/15 bg-primary/5 px-4 py-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <ShieldCheck className="w-3.5 h-3.5" />
                {isRTL ? "بيانات البطاقة مكتملة ✓" : "Card details complete ✓"}
              </p>
            </div>
          )}
        </div>
      </div>

      {sdkError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">{sdkError}</AlertDescription>
        </Alert>
      )}

    </div>
  );
};

export default EmbeddedCardForm;
