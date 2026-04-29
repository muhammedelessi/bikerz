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
import React, { useMemo } from "react";
import { Loader2, Lock, Shield, ShieldCheck, AlertTriangle, CreditCard } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTheme } from "@/components/ThemeProvider";
import { useTapCardSdk } from "@/hooks/checkout/useTapCardSdk";
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
      {/* Iframe container — the SDK injects its own UI here. The border turns primary when card is valid. */}
      <div
        className={[
          "relative rounded-xl border-2 bg-card transition-colors",
          cardValid ? "border-primary" : "border-border",
        ].join(" ")}
      >
        {/* Skeleton overlay while the SDK initializes. */}
        {(sdkLoading || (!sdkReady && !sdkError)) && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-[10px] bg-muted/60 backdrop-blur-sm">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">
              {isRTL ? "جارٍ تحميل نموذج الدفع الآمن…" : "Loading secure payment form…"}
            </p>
          </div>
        )}

        <div id={CONTAINER_ID} className="min-h-[280px] p-2" />

        {cardValid && (
          <div className="px-3 pb-2 -mt-1">
            <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              {isRTL ? "بيانات البطاقة مكتملة ✓" : "Card details complete ✓"}
            </p>
          </div>
        )}
      </div>

      {sdkError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">{sdkError}</AlertDescription>
        </Alert>
      )}

      {/* Trust badges */}
      <div className="flex flex-col items-center gap-1.5 pt-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="w-3.5 h-3.5 text-primary" />
          <span>{isRTL ? "مُؤمَّن بواسطة Tap Payments" : "Secured by Tap Payments"}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70">
          <span className="rounded bg-muted px-1.5 py-0.5 font-semibold">VISA</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-semibold">MC</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-semibold">MADA</span>
          <span className="text-muted-foreground/40">|</span>
          <Shield className="w-3 h-3" />
          <span>3D Secure</span>
        </div>
      </div>
    </div>
  );
};

export default EmbeddedCardForm;
