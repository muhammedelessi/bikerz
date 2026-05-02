import React, { memo, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Gift, Shield, ShieldCheck, Check, Lock, Pencil, X, Phone, MapPin, User, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PHONE_COUNTRIES } from "@/data/phoneCountryCodes";
import SearchableDropdown from "@/components/checkout/SearchableDropdown";
import type { DropdownOption } from "@/components/checkout/SearchableDropdown";
import type { PaymentStatus, AppliedCoupon } from "@/types/payment";
import type { ValidationErrors } from "@/types/payment";
import { COUNTRIES } from "@/data/countryCityData";
import { useIsMobile } from "@/hooks/use-mobile";

interface CheckoutPaymentStepProps {
  isRTL: boolean;
  currencyLabel: string;
  formatLocal: (amount: number) => string;
  promoCode: string;
  setPromoCode: (v: string) => void;
  promoApplied: boolean;
  /** Loading state while we validate the code against the server. */
  promoLoading?: boolean;
  appliedCoupon: AppliedCoupon | null;
  /** Last failed validation message — when set, the input shows red + inline error. */
  invalidCode?: string | null;
  handleApplyPromo: () => void;
  clearPromo: () => void;
  discountLabel: string;
  discountAmount: number;
  discountedPrice: number;
  /** Original (pre-discount) price — used to render the strikethrough next to the new total. */
  originalPrice?: number;
  fullName: string;
  setFullName: (v: string) => void;
  email: string;
  phone: string;
  setPhone: (v: string) => void;
  phonePrefix: string;
  setPhonePrefix: (v: string) => void;
  phonePrefixOptions: DropdownOption[];
  isOtherCountry: boolean;
  isOtherCity: boolean;
  countryManual: string;
  setCountryManual: (v: string) => void;
  country: string;
  setCountry: (v: string) => void;
  cityManual: string;
  setCityManual: (v: string) => void;
  city: string;
  countryOptions: DropdownOption[];
  cityOptions: DropdownOption[];
  selectedCountryCode: string;
  handleCountryChange: (code: string) => void;
  handleCityChange: (val: string) => void;
  errors: ValidationErrors;
  setErrors: (fn: (prev: ValidationErrors) => ValidationErrors) => void;
  courseTitle: string;
  courseTitleAr: string | null;
  paymentStatus: PaymentStatus;
  isPaymentReady: boolean;
  /** When true, billing fields fail validation and Pay must stay disabled — show guidance. */
  billingIncomplete?: boolean;
  /** Run full billing validation (e.g. before closing the edit dialog). Returns true if valid. */
  validateBilling?: () => boolean;
  vatPct?: number;
  exchangeRate?: number;
  isSAR?: boolean;
  onSubmitPayment: () => void;
  /** Bundle checkout: hide promo + duplicate pricing; order box shows contact fields only */
  bundleMode?: boolean;
  /** Lifted state: whether the promo input panel is open. Controlled by the parent modal so the footer can swap Pay → Apply. */
  promoOpen?: boolean;
  onPromoOpenChange?: (open: boolean) => void;
  /** Optional embedded card form rendered directly below the discount section. */
  cardFormSlot?: React.ReactNode;
}

const CheckoutPaymentStep: React.FC<CheckoutPaymentStepProps> = memo(
  (props) => {
    const {
    isRTL,
    currencyLabel,
    formatLocal,
    promoCode,
    setPromoCode,
    promoApplied,
    promoLoading = false,
    appliedCoupon,
    invalidCode = null,
    handleApplyPromo,
    clearPromo,
    discountLabel,
    discountAmount,
    discountedPrice,
    originalPrice,
    fullName,
    setFullName,
    email,
    phone,
    setPhone,
    phonePrefix,
    setPhonePrefix,
    phonePrefixOptions,
    isOtherCountry,
    isOtherCity,
    countryManual,
    setCountryManual,
    country,
    setCountry,
    cityManual,
    setCityManual,
    city,
    countryOptions,
    cityOptions,
    selectedCountryCode,
    handleCountryChange,
    handleCityChange,
    errors,
    setErrors,
    courseTitle,
    courseTitleAr,
    paymentStatus,
    isPaymentReady,
    billingIncomplete = false,
    validateBilling,
    vatPct = 0,
    exchangeRate = 1,
    isSAR = true,
    onSubmitPayment,
    bundleMode = false,
    promoOpen: promoOpenProp,
    onPromoOpenChange,
    cardFormSlot,
  } = props;
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const [editOpen, setEditOpen] = useState(false);
    /**
     * Promo input is hidden by default — user reveals it via the small link below the total.
     * State is controlled when `promoOpen` / `onPromoOpenChange` are provided (CheckoutModal lifts
     * it up so the footer can swap the Pay button for an Apply button), uncontrolled otherwise.
     */
    const [internalPromoOpen, setInternalPromoOpen] = useState(false);
    const promoOpen = promoOpenProp ?? internalPromoOpen;
    const setPromoOpen = (next: boolean) => {
      if (onPromoOpenChange) onPromoOpenChange(next);
      else setInternalPromoOpen(next);
    };

    const billingIssueLines = useMemo(
      () =>
        [errors.fullName, errors.email, errors.phone, errors.city, errors.country].filter(
          (line): line is string => Boolean(line && String(line).trim()),
        ),
      [errors.fullName, errors.email, errors.phone, errors.city, errors.country],
    );

    const effectiveCountry = isOtherCountry ? countryManual : country;
    const effectiveCity = isOtherCity ? cityManual : city;
    const totalWithVat = discountedPrice;

    // Translate country/city to user's language for display only
    const displayCountry = (() => {
      if (!effectiveCountry) return "";
      const entry = COUNTRIES.find(
        (c) => c.en === effectiveCountry || c.ar === effectiveCountry || c.code === effectiveCountry,
      );
      if (!entry) return effectiveCountry;
      return isRTL ? entry.ar : entry.en;
    })();

    const displayCity = (() => {
      if (!effectiveCity) return "";
      const countryEntry = COUNTRIES.find(
        (c) => c.en === effectiveCountry || c.ar === effectiveCountry || c.code === effectiveCountry,
      );
      if (!countryEntry) return effectiveCity;
      const cityEntry = countryEntry.cities.find((c) => c.en === effectiveCity || c.ar === effectiveCity);
      if (!cityEntry) return effectiveCity;
      return isRTL ? cityEntry.ar : cityEntry.en;
    })();

    const prefixEntry = PHONE_COUNTRIES.find((pc) => phonePrefix === pc.prefix + "_" + pc.code);
    const prefixStr = prefixEntry ? prefixEntry.prefix : "";
    const displayPhone = phone ? `${prefixStr}${phone}` : "";

    return (
      <>
        <motion.div
          key="payment"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          // Tighter rhythm on mobile so the iframe + footer fit above the
          // fold; spacing is generous on desktop where vertical room is plentiful.
          className={bundleMode ? "space-y-3 sm:space-y-4" : "space-y-3 sm:space-y-5"}
        >
          {/*
            Promo Code (collapsed-by-default UX)
            - No field visible until the user clicks the small "Do you have a discount code?" link.
            - On open, the [input] [Apply] row slides in (300ms via AnimatePresence + height/opacity).
            - Success: green confirmation card with "Code X applied — You saved Y SAR" + Remove button.
            - Failure: input gets a red border + "Invalid code" inline message.
            - Auto-uppercase is enforced in the hook (`setPromoCode` lowercases→uppercases).
          */}
          {!bundleMode && (
            <AnimatePresence mode="wait" initial={false}>
              {promoApplied && appliedCoupon ? (
                /* === Applied state — strong, unambiguous confirmation === */
                <motion.div
                  key="promo-applied"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5 sm:px-4 sm:py-3"
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                        {isRTL
                          ? `تم تطبيق كود ${appliedCoupon.coupon_code ?? promoCode} بنجاح`
                          : `Code ${appliedCoupon.coupon_code ?? promoCode} applied successfully`}
                      </p>
                      <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80 mt-0.5">
                        {isRTL
                          ? `تم خصم ${discountLabel} من سعر الكورس 🎉 تهانينا`
                          : `${discountLabel} discount applied 🎉 Congratulations`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        clearPromo();
                        setPromoOpen(false);
                      }}
                      disabled={paymentStatus === "processing"}
                      className="shrink-0 min-h-[36px] px-2 -mx-2 text-xs font-semibold text-emerald-900/80 dark:text-emerald-100/80 hover:text-emerald-950 dark:hover:text-emerald-50 underline underline-offset-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
                    >
                      {isRTL ? "إزالة" : "Remove"}
                    </button>
                  </div>
                </motion.div>
              ) : promoOpen ? (
                /* === Open input row — slides in at 300ms === */
                <motion.div
                  key="promo-open"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 px-3 sm:px-4 pt-1">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-primary" />
                      {isRTL ? "كود الخصم" : "Discount code"}
                    </Label>
                    <Input
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (promoCode && !promoLoading) handleApplyPromo();
                        }
                      }}
                      placeholder="MOH301"
                      disabled={promoLoading || paymentStatus === "processing"}
                      autoFocus
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      dir="ltr"
                      className={`w-full h-8 px-3 text-center uppercase tracking-[0.2em] font-mono text-sm placeholder:tracking-normal placeholder:text-muted-foreground/40 ${
                        invalidCode
                          ? "border-destructive/60 bg-destructive/5 focus-visible:ring-destructive/30"
                          : ""
                      }`}
                    />
                    {invalidCode ? (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {isRTL ? "كود غير صالح" : "Invalid code"}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground/80">
                        {isRTL
                          ? "اضغط زر «تطبيق الكود» أدناه للتحقق."
                          : "Tap the “Apply code” button below to verify."}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setPromoOpen(false);
                        setPromoCode("");
                      }}
                      className="min-h-[36px] px-2 -mx-2 text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                    >
                      {isRTL ? "إلغاء" : "Cancel"}
                    </button>
                  </div>
                </motion.div>
              ) : (
                /* === Default state — just a small gray link === */
                <motion.button
                  key="promo-link"
                  type="button"
                  onClick={() => setPromoOpen(true)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary transition-all hover:border-primary hover:bg-primary/10 hover:shadow-sm"
                >
                  <Gift className="w-4 h-4 transition-transform group-hover:scale-110" />
                  <span>{isRTL ? "هل لديك كود خصم؟" : "Do you have a discount code?"}</span>
                </motion.button>
              )}
            </AnimatePresence>
          )}

          {/* Compact order summary — always visible on mobile + desktop.
              Provides a clear, persistent reference of what the user is about
              to pay, even if they scroll past the original modal header. */}
          {!bundleMode && (
            <div className="rounded-xl border border-border bg-card/60 p-3 sm:p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {isRTL ? "تفاصيل الطلب" : "Order summary"}
                </span>
                {promoApplied && discountLabel && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    <Check className="w-3 h-3" />
                    {discountLabel}
                  </span>
                )}
              </div>

              <div className="flex items-baseline justify-between gap-2 pt-1">
                <span className="text-sm font-medium text-muted-foreground">
                  {isRTL
                    ? vatPct > 0 ? "الإجمالي شامل الضريبة" : "الإجمالي"
                    : vatPct > 0 ? "Total (incl. VAT)" : "Total"}
                </span>
                <span className="flex items-baseline gap-2">
                  {promoApplied && originalPrice != null && originalPrice > totalWithVat ? (
                    <motion.span
                      key="old-price"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs font-medium text-muted-foreground line-through tabular-nums"
                    >
                      {formatLocal(originalPrice)}
                    </motion.span>
                  ) : null}
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={`total-${totalWithVat}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="text-base sm:text-lg font-extrabold text-primary tabular-nums"
                    >
                      {totalWithVat} {currencyLabel}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </div>

              {/* Currency conversion hint (only when not SAR) */}
              {!isSAR && exchangeRate > 0 && (() => {
                const sarEquivalent = Math.ceil(totalWithVat / exchangeRate);
                const sarLabel = isRTL ? "ر.س" : "SAR";
                return (
                  <p className="text-[11px] text-muted-foreground text-center bg-muted/30 rounded-md py-1.5 px-2 leading-tight">
                    {isRTL ? "سيُخصم على بطاقتك" : "Charged on your card"}:{" "}
                    <span className="font-bold text-foreground tabular-nums">{sarEquivalent} {sarLabel}</span>
                  </p>
                );
              })()}
            </div>
          )}

          {/* Embedded card form rendered directly under the discount/promo section */}
          {cardFormSlot}

          {/* Detailed total breakdown — desktop-only; mobile relies on the
              compact summary above + the Pay button label. */}
          {!bundleMode && !isMobile && (
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2.5">
              <div className="flex justify-between font-bold text-base items-baseline gap-2">
                <span>
                  {isRTL
                    ? vatPct > 0
                      ? "الإجمالي (شامل الضريبة)"
                      : "الإجمالي"
                    : vatPct > 0
                      ? "Total (incl. VAT)"
                      : "Total"}
                </span>
                <span className="flex items-baseline gap-2">
                  {promoApplied && originalPrice != null && originalPrice > totalWithVat ? (
                    <motion.span
                      key="old-price"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs font-medium text-muted-foreground line-through tabular-nums"
                    >
                      {formatLocal(originalPrice)}
                    </motion.span>
                  ) : null}
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={`total-${totalWithVat}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="text-primary tabular-nums"
                    >
                      {totalWithVat} {currencyLabel}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </div>

              {promoApplied && appliedCoupon && (
                <div className="flex justify-between text-xs text-primary">
                  <span>
                    {isRTL ? "الخصم المطبّق" : "Discount applied"} ({discountLabel})
                  </span>
                  <span>-{formatLocal(discountAmount)}</span>
                </div>
              )}

              {/* Equivalent amount info — for all non-SAR currencies.
                  Show the user's local-currency total + the SAR equivalent
                  they'll see on their card statement (Tap charges in SAR
                  for currencies it doesn't directly support). */}
              {!isSAR &&
                exchangeRate > 0 &&
                (() => {
                  const sarEquivalent = Math.ceil(totalWithVat / exchangeRate);
                  const sarLabel = isRTL ? "ر.س" : "SAR";

                  return (
                    <div className="flex items-center justify-center gap-1.5 flex-wrap text-center px-2 py-2 rounded-lg bg-muted/40 mt-1">
                      <span className="text-[12px] text-muted-foreground">
                        {isRTL ? "سيتم خصم" : "You will be charged"}
                      </span>
                      <span className="text-[12px] font-bold text-primary tabular-nums">
                        {totalWithVat} {currencyLabel}
                      </span>
                      <span className="text-[12px] text-muted-foreground">
                        {isRTL ? "أي ما يعادل" : "equivalent to"}
                      </span>
                      <span className="text-[12px] font-bold text-foreground tabular-nums">
                        {sarEquivalent} {sarLabel}
                      </span>
                    </div>
                  );
                })()}

              {vatPct > 0 && (
                <div className="pt-2 border-t border-border/50">
                  <p className="text-[11px] text-muted-foreground text-center">
                    {isRTL ? "الرقم الضريبي" : "VAT Number"}:{" "}
                    <span className="font-mono font-medium text-foreground/70">311508395300003</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {billingIncomplete && paymentStatus === "idle" && (
            <Alert variant="destructive" className="text-start">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t("checkout.validation.payBlockedTitle")}</AlertTitle>
              <AlertDescription className="space-y-2">
                {billingIssueLines.length > 0 ? (
                  <ul className="list-disc ps-4 space-y-0.5 text-xs">
                    {billingIssueLines.map((line, idx) => (
                      <li key={`${idx}-${line}`}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs">{t("checkout.validation.payBlockedHint")}</p>
                )}
                <Button type="button" variant="outline" size="sm" className="mt-1 h-8" onClick={() => setEditOpen(true)}>
                  {t("checkout.validation.editDetails")}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Unified trust strip — single horizontal line on both mobile and
              desktop. Visually grouped with subtle separators so all three
              signals (Tap, 3D Secure, PCI DSS) read as one cohesive badge
              rather than competing labels. */}
          <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-1.5 pt-1.5 pb-0.5">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground/80">
              <Lock className="w-3.5 h-3.5 text-primary" />
              <span>
                {bundleMode
                  ? isRTL
                    ? "دفع آمن"
                    : "Secure payment"
                  : isRTL
                    ? "Tap Payments"
                    : "Tap Payments"}
              </span>
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
        </motion.div>

        {editOpen ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-[420px] rounded-2xl border border-border bg-card p-4 shadow-2xl sm:p-5">
              <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                <h3 className="text-base font-bold text-foreground">
                  {isRTL ? "تعديل المعلومات" : "Edit Information"}
                </h3>
                <Button type="button" variant="ghost" size="icon" onClick={() => setEditOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{isRTL ? "الاسم الكامل" : "Full Name"}</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={isRTL ? "الاسم الكامل" : "Full name"}
                    dir={isRTL ? "rtl" : "ltr"}
                    className={errors.fullName ? "border-destructive" : undefined}
                  />
                  {errors.fullName ? <p className="text-xs text-destructive">{errors.fullName}</p> : null}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{isRTL ? "رقم الهاتف" : "Phone Number"}</Label>
                  <div className="flex gap-2" dir="ltr">
                    <div className="w-[110px] flex-shrink-0">
                      <SearchableDropdown
                        options={phonePrefixOptions}
                        value={phonePrefix}
                        onChange={setPhonePrefix}
                        placeholder="+---"
                        searchPlaceholder="Search..."
                        selectedLabelBuilder={(option) => (option?.value.split("_")[0] ? option.value.split("_")[0] : "")}
                        dir="ltr"
                      />
                    </div>
                    <Input
                      value={phone}
                      onChange={(e) => {
                        let val = e.target.value.replace(/[^0-9]/g, "");
                        if (val.startsWith("0")) val = val.slice(1);
                        setPhone(val);
                      }}
                      placeholder="5XXXXXXXX"
                      dir="ltr"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="tel-national"
                      className={`flex-1 ${errors.phone ? "border-destructive" : ""}`}
                    />
                  </div>
                  {errors.phone ? <p className="text-xs text-destructive">{errors.phone}</p> : null}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{isRTL ? "الدولة" : "Country"}</Label>
                    <SearchableDropdown
                      options={countryOptions}
                      value={isOtherCountry ? "__other__" : selectedCountryCode}
                      onChange={handleCountryChange}
                      placeholder={isRTL ? "اختر الدولة" : "Select country"}
                      searchPlaceholder={isRTL ? "ابحث..." : "Search..."}
                      dir={isRTL ? "rtl" : "ltr"}
                    />
                    {isOtherCountry ? (
                      <Input
                        value={countryManual}
                        onChange={(e) => {
                          setCountryManual(e.target.value);
                          setCountry(e.target.value);
                        }}
                        placeholder={isRTL ? "اسم الدولة" : "Country name"}
                        className={errors.country ? "border-destructive" : undefined}
                      />
                    ) : null}
                    {errors.country ? <p className="text-xs text-destructive">{errors.country}</p> : null}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{isRTL ? "المدينة" : "City"}</Label>
                    {isOtherCountry ? (
                      <Input
                        value={cityManual}
                        onChange={(e) => setCityManual(e.target.value)}
                        placeholder={isRTL ? "اسم المدينة" : "City name"}
                        className={errors.city ? "border-destructive" : undefined}
                      />
                    ) : (
                      <>
                        <SearchableDropdown
                          options={cityOptions}
                          value={isOtherCity ? "__other__" : city}
                          onChange={handleCityChange}
                          placeholder={isRTL ? "اختر المدينة" : "Select city"}
                          searchPlaceholder={isRTL ? "ابحث..." : "Search..."}
                          dir={isRTL ? "rtl" : "ltr"}
                        />
                        {isOtherCity ? (
                          <Input
                            value={cityManual}
                            onChange={(e) => setCityManual(e.target.value)}
                            placeholder={isRTL ? "اسم المدينة" : "City name"}
                            className={errors.city ? "border-destructive" : undefined}
                          />
                        ) : null}
                      </>
                    )}
                    {errors.city ? <p className="text-xs text-destructive">{errors.city}</p> : null}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => {
                    if (validateBilling && !validateBilling()) return;
                    setEditOpen(false);
                  }}
                >
                  <Check className="w-4 h-4 me-2" />
                  {isRTL ? "تم" : "Done"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }),
);

CheckoutPaymentStep.displayName = "CheckoutPaymentStep";

export default CheckoutPaymentStep;
