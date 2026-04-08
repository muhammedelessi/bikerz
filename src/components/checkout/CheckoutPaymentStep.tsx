import React, { memo, useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Gift, Shield, Check, Lock, XCircle, Pencil, X, Phone, MapPin, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PHONE_COUNTRIES } from "@/data/phoneCountryCodes";
import SearchableDropdown from "@/components/checkout/SearchableDropdown";
import type { DropdownOption } from "@/components/checkout/SearchableDropdown";
import type { PaymentStatus, AppliedCoupon } from "@/types/payment";
import type { ValidationErrors } from "@/types/payment";
import PaymentMethodIcons from "@/components/checkout/PaymentMethodIcons";
import { COUNTRIES } from "@/data/countryCityData";

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

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
  vatPct?: number;
  onSubmitPayment: () => void;
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
    vatPct = 0,
    onSubmitPayment,
  }) => {
    const [editOpen, setEditOpen] = useState(false);
    const [editErrors, setEditErrors] = useState<Record<string, string>>({});

    const effectiveCountry = isOtherCountry ? countryManual : country;
    const effectiveCity = isOtherCity ? cityManual : city;
    const totalWithVat = discountedPrice;

    const validateEditFields = (): boolean => {
      const errs: Record<string, string> = {};
      if (!fullName || fullName.trim().length < 3) {
        errs.fullName = isRTL ? "الاسم مطلوب (3 أحرف على الأقل)" : "Name is required (min 3 characters)";
      }
      const rawPhone = phone?.replace(/[^0-9]/g, "") || "";
      if (!rawPhone || rawPhone.length < 7 || rawPhone.length > 15) {
        errs.phone = isRTL ? "رقم هاتف صحيح مطلوب (7-15 رقم)" : "Valid phone required (7-15 digits)";
      }
      const effCountry = isOtherCountry ? countryManual : country;
      if (!effCountry || effCountry.trim().length === 0) {
        errs.country = isRTL ? "الدولة مطلوبة" : "Country is required";
      }
      const effCity = isOtherCity ? cityManual : city;
      if (!effCity || effCity.trim().length === 0) {
        errs.city = isRTL ? "المدينة مطلوبة" : "City is required";
      }
      setEditErrors(errs);
      return Object.keys(errs).length === 0;
    };

    const handleEditDone = () => {
      if (validateEditFields()) {
        setEditOpen(false);
        setEditErrors({});
      }
    };

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
          className="space-y-5"
        >
          {/* Payment Methods */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              <h4 className="font-semibold text-foreground text-sm">
                {isRTL ? "طرق الدفع المتاحة" : "Accepted Payment Methods"}
              </h4>
            </div>
            <PaymentMethodIcons
              showLabel={false}
              className={`scale-90 ${isRTL ? "origin-right self-end" : "origin-left self-start"}`}
            />
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
              <p className="text-xs text-muted-foreground flex-1 leading-relaxed">
                {isRTL
                  ? "إذا طريقة الدفع المناسبة لك غير متاحة، تواصل معنا عبر واتساب لنوفرها لك فوراً"
                  : "If your preferred payment method isn't available, contact us via WhatsApp and we'll accommodate you right away"}
              </p>
              <a
                href="https://wa.me/966562562368"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#25D366] text-white text-xs font-semibold hover:bg-[#1fb855] transition-colors"
              >
                <WhatsAppIcon />
                {isRTL ? "واتساب" : "WhatsApp"}
              </a>
            </div>
          </div>

          {/* Promo Code */}
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
                  className="w-full pe-9 h-10"
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
                  ? `تم تطبيق خصم ${discountLabel} (وفّرت ${formatLocal(discountAmount)})`
                  : `${discountLabel} discount applied (saved ${formatLocal(discountAmount)})`}
              </p>
            )}
          </div>

          {/* Order Summary */}
          <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                {isRTL ? "ملخص الطلب" : "Order Summary"}
              </p>
              <button
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
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
              {vatPct > 0 && (
                <div className="pt-2 border-t border-border/50">
                  <p className="text-[11px] text-muted-foreground text-center">
                    {isRTL ? "الرقم الضريبي" : "VAT Number"}:{" "}
                    <span className="font-mono font-medium text-foreground/70">311508395300003</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Trust Badge */}
          <div className="flex flex-col items-center gap-2 pt-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="w-3.5 h-3.5 text-primary" />
              <span>{isRTL ? "🔒 مُؤمّن بواسطة Tap Payments" : "🔒 Secured by Tap Payments"}</span>
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
                />
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
                    className="flex-1"
                  />
                </div>
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
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{isRTL ? "المدينة" : "City"}</Label>
                  {isOtherCountry ? (
                    <Input
                      value={cityManual}
                      onChange={(e) => setCityManual(e.target.value)}
                      placeholder={isRTL ? "اسم المدينة" : "City name"}
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
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={() => setEditOpen(false)}>
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
