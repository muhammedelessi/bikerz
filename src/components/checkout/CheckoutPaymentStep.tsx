import React, { memo, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Gift, Shield, Check, Lock, XCircle, Pencil, X, Phone, MapPin, User, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PHONE_COUNTRIES } from "@/data/phoneCountryCodes";
import SearchableDropdown from "@/components/checkout/SearchableDropdown";
import type { DropdownOption } from "@/components/checkout/SearchableDropdown";
import type { PaymentStatus, AppliedCoupon } from "@/types/payment";
import type { ValidationErrors } from "@/types/payment";
import { COUNTRIES } from "@/data/countryCityData";

interface CheckoutPaymentStepProps {
  isRTL: boolean;
  currencyLabel: string;
  formatLocal: (amount: number) => string;
  promoCode: string;
  setPromoCode: (v: string) => void;
  promoApplied: boolean;
  appliedCoupon: AppliedCoupon | null;
  handleApplyPromo: () => void;
  clearPromo: () => void;
  discountLabel: string;
  discountAmount: number;
  discountedPrice: number;
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
}

const CheckoutPaymentStep: React.FC<CheckoutPaymentStepProps> = memo(
  ({
    isRTL,
    currencyLabel,
    formatLocal,
    promoCode,
    setPromoCode,
    promoApplied,
    appliedCoupon,
    handleApplyPromo,
    clearPromo,
    discountLabel,
    discountAmount,
    discountedPrice,
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
  }) => {
    const { t } = useTranslation();
    const [editOpen, setEditOpen] = useState(false);

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
          className={bundleMode ? "space-y-4" : "space-y-5"}
        >
          {/* Promo Code */}
          {!bundleMode && (
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Gift className="w-3.5 h-3.5 text-primary" />
              {isRTL ? "رمز الخصم" : "Promo Code"}
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder={isRTL ? "أدخل رمز الخصم" : "Enter promo code"}
                  disabled={promoApplied || paymentStatus === "processing"}
                  className="w-full pe-8 h-9"
                />
                {promoCode && !promoApplied && (
                  <button
                    type="button"
                    onClick={() => setPromoCode("")}
                    className="absolute end-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
                {promoApplied && (
                  <button
                    type="button"
                    onClick={clearPromo}
                    className="absolute end-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Button
                variant="outline"
                size="default"
                onClick={handleApplyPromo}
                disabled={!promoCode || promoApplied || paymentStatus === "processing"}
              >
                {promoApplied ? (isRTL ? "مطبق" : "Applied") : isRTL ? "تطبيق" : "Apply"}
              </Button>
            </div>
            {promoApplied && appliedCoupon && (
              <p className="text-xs text-primary flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                {isRTL
                  ? `تم تطبيق خصم ${discountLabel}`
                  : `${discountLabel} discount applied`}
              </p>
            )}
          </div>
          )}

          {/* Order Summary */}
          <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                {bundleMode
                  ? isRTL
                    ? "بياناتك للتواصل"
                    : "Your details"
                  : isRTL
                    ? "ملخص الطلب"
                    : "Order Summary"}
              </p>
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors shrink-0"
              >
                <Pencil className="w-3 h-3" />
                {isRTL ? "تعديل" : "Edit"}
              </button>
            </div>
            <div className="p-4 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  {isRTL ? "الاسم" : "Name"}
                </span>
                <span className="font-medium truncate max-w-[200px]">{fullName}</span>
              </div>
              {displayPhone && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    {isRTL ? "الهاتف" : "Phone"}
                  </span>
                  <span className="font-medium font-mono" dir="ltr">
                    {displayPhone}
                  </span>
                </div>
              )}
              {(effectiveCity || effectiveCountry) && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {isRTL ? "العنوان" : "Address"}
                  </span>
                  <span className="font-medium truncate max-w-[200px]">
                    {[displayCity, displayCountry].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
              {!bundleMode && (
                <>
                  <Separator className="my-1" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{isRTL ? "الدورة" : "Course"}</span>
                    <span className="font-medium truncate max-w-[200px]">
                      {isRTL && courseTitleAr ? courseTitleAr : courseTitle}
                    </span>
                  </div>
                  {promoApplied && appliedCoupon && (
                    <div className="flex justify-between text-sm text-primary">
                      <span>
                        {isRTL ? "الخصم" : "Discount"} ({discountLabel})
                      </span>
                      <span>-{formatLocal(discountAmount)}</span>
                    </div>
                  )}
                  <Separator className="my-1" />
                  <div className="flex justify-between font-bold text-base">
                    <span>
                      {isRTL
                        ? vatPct > 0
                          ? "الإجمالي (شامل الضريبة)"
                          : "الإجمالي"
                        : vatPct > 0
                          ? "Total (incl. VAT)"
                          : "Total"}
                    </span>
                    <span className="text-primary">
                      {totalWithVat} {currencyLabel}
                    </span>
                  </div>

                  {/* Equivalent amount info — for all non-SAR currencies */}
                  {!isSAR &&
                    exchangeRate > 0 &&
                    (() => {
                      const TAP_SUPPORTED = ["KWD", "AED", "USD", "BHD", "QAR", "OMR", "EGP"];
                      const isSupported = TAP_SUPPORTED.some((c) => currencyLabel.includes(c));
                      const sarEquivalent = Math.ceil(totalWithVat / exchangeRate);

                      return (
                        <div className="flex items-center justify-center gap-1.5 flex-wrap text-center px-2 py-2 rounded-lg bg-muted/40 mt-1">
                          <span className="text-[12px] text-muted-foreground">
                            {isRTL ? "سيتم خصم" : "You will be charged"}
                          </span>
                          <span className="text-[12px] font-bold text-primary flex items-center gap-1">
                            {isSupported ? `${totalWithVat} ${currencyLabel}` : `${totalWithVat} ${currencyLabel}`}
                          </span>
                          <span className="text-[12px] text-muted-foreground">
                            {isRTL ? " أي ما يعادل" : "equivalent to"}
                          </span>
                          <span className="text-[12px] font-bold text-foreground">
                            {sarEquivalent}
                            <span>{" SAR "}</span>
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
                </>
              )}
            </div>
          </div>

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

          {/* Trust Badge */}
          <div className="flex flex-col items-center gap-2 pt-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="w-3.5 h-3.5 text-primary" />
              <span>
                {bundleMode
                  ? isRTL
                    ? "دفع إلكتروني مؤمّن"
                    : "Secure online payment"
                  : isRTL
                    ? "مُؤمّن بواسطة Tap Payments"
                    : "Secured by Tap Payments"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                <Shield className="w-3 h-3" />
                <span>3D Secure</span>
              </div>
              <span className="text-muted-foreground/20">|</span>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                <Shield className="w-3 h-3" />
                <span>PCI DSS</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Edit Info Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-[420px] w-full bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                {isRTL ? "تعديل المعلومات" : "Edit Information"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{isRTL ? "الاسم الكامل" : "Full Name"}</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={isRTL ? "الاسم الكامل" : "Full name"}
                  dir={isRTL ? "rtl" : "ltr"}
                  className={errors.fullName ? "border-destructive" : undefined}
                />
                {errors.fullName ? (
                  <p className="text-xs text-destructive">{errors.fullName}</p>
                ) : null}
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
                  {isOtherCountry && (
                    <Input
                      value={countryManual}
                      onChange={(e) => {
                        setCountryManual(e.target.value);
                        setCountry(e.target.value);
                      }}
                      placeholder={isRTL ? "اسم الدولة" : "Country name"}
                      className={errors.country ? "border-destructive" : undefined}
                    />
                  )}
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
                      {isOtherCity && (
                        <Input
                          value={cityManual}
                          onChange={(e) => setCityManual(e.target.value)}
                          placeholder={isRTL ? "اسم المدينة" : "City name"}
                          className={errors.city ? "border-destructive" : undefined}
                        />
                      )}
                    </>
                  )}
                  {errors.city ? <p className="text-xs text-destructive">{errors.city}</p> : null}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
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
              <Button variant="ghost" onClick={() => setEditOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  },
);

CheckoutPaymentStep.displayName = "CheckoutPaymentStep";

export default CheckoutPaymentStep;
