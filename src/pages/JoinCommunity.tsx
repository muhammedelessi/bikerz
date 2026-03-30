import React, { useState, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRIES, type CountryEntry } from "@/data/countryCityData";
import { PHONE_COUNTRIES } from "@/data/phoneCountryCodes";
import SearchableDropdown from "@/components/checkout/SearchableDropdown";
import type { DropdownOption } from "@/components/checkout/SearchableDropdown";
import {
  Check, ChevronDown, Search, MessageCircle, Users,
  AlertCircle, User, Phone, Mail, Globe, MapPin, Bike,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import logoDark from "@/assets/logo-dark.png";
import logoLight from "@/assets/logo-light.png";
import SEOHead from "@/components/common/SEOHead";

const WHATSAPP_NUMBER = "PHONE_NUMBER";

const FieldError: React.FC<{ message?: string }> = ({ message }) => {
  if (!message) return null;
  return (
    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
      <AlertCircle className="w-3 h-3" />
      {message}
    </p>
  );
};

/* Toggle chip — clicking the active value again deselects it */
const ToggleChip: React.FC<{
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ selected, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition-all duration-200 ${
      selected
        ? "bg-primary text-primary-foreground border-primary shadow-sm"
        : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
    }`}
  >
    {children}
  </button>
);

const JoinCommunity: React.FC = () => {
  const { isRTL } = useLanguage();
  const { theme } = useTheme();
  const logo = theme === "light" ? logoDark : logoLight;

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [phonePrefix, setPhonePrefix] = useState("");
  const [email, setEmail] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<CountryEntry | null>(null);
  const [city, setCity] = useState("");
  const [hasMotorcycle, setHasMotorcycle] = useState<string>("");
  const [consideringPurchase, setConsideringPurchase] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");

  const phonePrefixOptions: DropdownOption[] = useMemo(
    () =>
      PHONE_COUNTRIES.map((pc) => ({
        value: `${pc.prefix}_${pc.code}`,
        label: `${pc.prefix} ${pc.en}`,
      })),
    []
  );

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const q = countrySearch.toLowerCase();
    return COUNTRIES.filter((c) => c.en.toLowerCase().includes(q) || c.ar.includes(q));
  }, [countrySearch]);

  const cities = useMemo(() => selectedCountry?.cities || [], [selectedCountry]);

  const filteredCities = useMemo(() => {
    if (!citySearch.trim()) return cities;
    const q = citySearch.toLowerCase();
    return cities.filter((c) => c.en.toLowerCase().includes(q) || c.ar.includes(q));
  }, [cities, citySearch]);

  const hasCities = cities.length > 0 && selectedCountry?.code !== "OTHER";

  const getFullPhone = (): string => {
    const prefix = phonePrefix ? phonePrefix.split("_")[0] : "";
    return `${prefix}${phone}`.trim();
  };

  const t = (en: string, ar: string) => (isRTL ? ar : en);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = t("Full name is required", "الاسم مطلوب");
    if (!phonePrefix) e.phone = t("Country code is required", "كود الدولة مطلوب");
    else if (!phone.trim()) e.phone = t("Phone number is required", "رقم الهاتف مطلوب");
    if (!email.trim()) e.email = t("Email is required", "البريد مطلوب");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = t("Valid email is required", "بريد إلكتروني صالح مطلوب");
    if (!selectedCountry) e.country = t("Country is required", "الدولة مطلوبة");
    if (!city.trim()) e.city = t("City is required", "المدينة مطلوبة");
    if (!hasMotorcycle) e.hasMotorcycle = t("This field is required", "هذا الحقل مطلوب");
    if (hasMotorcycle === "no" && !consideringPurchase) e.consideringPurchase = t("This field is required", "هذا الحقل مطلوب");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    const fullPhone = getFullPhone();
    const countryName = isRTL ? (selectedCountry?.ar || "") : (selectedCountry?.en || "");
    try {
      const { error } = await supabase.from("community_members" as any).insert({
        full_name: fullName.trim(),
        phone: fullPhone,
        email: email.trim().toLowerCase(),
        country: countryName,
        city: city.trim(),
        has_motorcycle: hasMotorcycle === "yes",
        considering_purchase: hasMotorcycle === "no" ? consideringPurchase : null,
      } as any);
      if (error) throw error;
      try {
        await supabase.functions.invoke("community-webhook", {
          body: {
            full_name: fullName.trim(),
            phone: fullPhone,
            email: email.trim().toLowerCase(),
            country: countryName,
            city: city.trim(),
            has_motorcycle: hasMotorcycle === "yes",
            considering_purchase: hasMotorcycle === "no" ? consideringPurchase : null,
          },
        });
      } catch (_) {}
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: t("Error", "خطأ"), description: err.message || t("Something went wrong", "حدث خطأ"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle handler — clicking the already-selected value deselects it
  const toggleMotorcycle = (val: string) => {
    setHasMotorcycle((prev) => (prev === val ? "" : val));
    if (val === "yes") setConsideringPurchase("");
    setErrors((prev) => ({ ...prev, hasMotorcycle: undefined }));
  };
  const toggleConsidering = (val: string) => {
    setConsideringPurchase((prev) => (prev === val ? "" : val));
    setErrors((prev) => ({ ...prev, consideringPurchase: undefined }));
  };

  if (submitted) {
    return (
      <>
        <Navbar />
        <div className="min-h-[80dvh] flex items-center justify-center bg-background px-4">
          <div className="max-w-md w-full text-center space-y-6 py-16" dir={isRTL ? "rtl" : "ltr"}>
            <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              {t("🎉 Welcome to the Bikerz Community!", "🎉 مرحباً بك في مجتمع بايكرز!")}
            </h1>
            <p className="text-muted-foreground">
              {t("You've been registered successfully. We'll be in touch soon!", "تم تسجيلك بنجاح. سنتواصل معك قريباً!")}
            </p>
            <div className="flex flex-col gap-3">
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer">
                <Button className="w-full gap-2 text-white" style={{ backgroundColor: "#25D366" }}>
                  <MessageCircle className="w-5 h-5" />
                  {t("Contact us on WhatsApp", "تواصل معنا على واتساب")}
                </Button>
              </a>
              <Link to="/">
                <Button variant="outline" className="w-full">
                  {t("Back to Home", "العودة للرئيسية")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <SEOHead
        title={t("Join Bikerz Community", "انضم لمجتمع بايكرز")}
        description={t("Join the growing community of riders", "انضم لمجتمع الدراجين المتنامي")}
      />
      <Navbar />
      <div className="min-h-[80dvh] bg-background py-8 sm:py-12 px-4" dir={isRTL ? "rtl" : "ltr"}>
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="text-center mb-8 space-y-4">
            <img src={logo} alt="BIKERZ" className="h-10 sm:h-12 mx-auto object-contain" />
            <div className="flex items-center justify-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                {t("Join the Bikerz Community", "انضم لمجتمع بايكرز")}
              </h1>
            </div>
            <p className="text-muted-foreground text-sm sm:text-base max-w-sm mx-auto">
              {t("Be part of a growing community of riders across the region", "كن جزءاً من مجتمع متنامي من الدراجين في المنطقة")}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-xl p-5 sm:p-8">
            {/* Full Name — icon inside, no label */}
            <div className="space-y-1">
              <div className="relative">
                <User className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); setErrors((p) => ({ ...p, fullName: undefined })); }}
                  placeholder={t("Full Name", "الاسم الكامل")}
                  className={`ps-9 ${errors.fullName ? "border-destructive" : ""}`}
                />
              </div>
              <FieldError message={errors.fullName} />
            </div>

            {/* Phone — prefix dropdown + input, icon-driven */}
            <div className="space-y-1">
              <div className="flex gap-2" dir="ltr">
                <div className="flex-shrink-0 w-[110px]">
                  <SearchableDropdown
                    options={phonePrefixOptions}
                    value={phonePrefix}
                    onChange={(val) => { setPhonePrefix(val); setErrors((p) => ({ ...p, phone: undefined })); }}
                    placeholder="+---"
                    searchPlaceholder={t("Search...", "بحث...")}
                    hasError={!!errors.phone}
                    dir="ltr"
                  />
                </div>
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/[^0-9]/g, ""));
                      setErrors((p) => ({ ...p, phone: undefined }));
                    }}
                    placeholder="5XXXXXXXX"
                    className={`pl-9 text-left ${errors.phone ? "border-destructive" : ""}`}
                    dir="ltr"
                  />
                </div>
              </div>
              <FieldError message={errors.phone} />
            </div>

            {/* Email — icon inside, always LTR */}
            <div className="space-y-1">
              <div className="relative" dir="ltr">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
                  placeholder="email@example.com"
                  className={`pl-9 text-left ${errors.email ? "border-destructive" : ""}`}
                  dir="ltr"
                />
              </div>
              <FieldError message={errors.email} />
            </div>

            {/* Country & City — horizontal row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Country */}
              <div className="space-y-1">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setCountryOpen(!countryOpen); setCityOpen(false); }}
                    className={`flex h-10 w-full items-center rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${errors.country ? "border-destructive" : "border-input"}`}
                  >
                    <Globe className="w-4 h-4 text-muted-foreground me-2 flex-shrink-0" />
                    <span className={`flex-1 text-start truncate ${selectedCountry ? "text-foreground" : "text-muted-foreground"}`}>
                      {selectedCountry ? (isRTL ? selectedCountry.ar : selectedCountry.en) : t("Country", "الدولة")}
                    </span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>
                  {countryOpen && (
                    <div className="absolute z-50 mt-1 w-full min-w-[200px] rounded-md border border-border bg-popover shadow-lg max-h-60 overflow-hidden">
                      <div className="p-2 border-b border-border">
                        <div className="relative">
                          <Search className="absolute start-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            className="w-full ps-8 pe-3 py-1.5 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                            placeholder={t("Search...", "بحث...")}
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {filteredCountries.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            className={`w-full text-start px-3 py-2 text-sm hover:bg-accent transition-colors ${selectedCountry?.code === c.code ? "bg-accent text-accent-foreground" : ""}`}
                            onClick={() => {
                              setSelectedCountry(c);
                              setCity("");
                              setCountryOpen(false);
                              setCountrySearch("");
                              setErrors((p) => ({ ...p, country: undefined }));
                            }}
                          >
                            {isRTL ? c.ar : c.en}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <FieldError message={errors.country} />
              </div>

              {/* City */}
              <div className="space-y-1">
                {hasCities ? (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => { setCityOpen(!cityOpen); setCountryOpen(false); }}
                      className={`flex h-10 w-full items-center rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${errors.city ? "border-destructive" : "border-input"}`}
                    >
                      <MapPin className="w-4 h-4 text-muted-foreground me-2 flex-shrink-0" />
                      <span className={`flex-1 text-start truncate ${city ? "text-foreground" : "text-muted-foreground"}`}>
                        {city || t("City", "المدينة")}
                      </span>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </button>
                    {cityOpen && (
                      <div className="absolute z-50 mt-1 w-full min-w-[200px] rounded-md border border-border bg-popover shadow-lg max-h-60 overflow-hidden">
                        <div className="p-2 border-b border-border">
                          <div className="relative">
                            <Search className="absolute start-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                              className="w-full ps-8 pe-3 py-1.5 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                              placeholder={t("Search...", "بحث...")}
                              value={citySearch}
                              onChange={(e) => setCitySearch(e.target.value)}
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {filteredCities.map((c) => (
                            <button
                              key={c.en}
                              type="button"
                              className={`w-full text-start px-3 py-2 text-sm hover:bg-accent transition-colors ${city === (isRTL ? c.ar : c.en) ? "bg-accent text-accent-foreground" : ""}`}
                              onClick={() => {
                                setCity(isRTL ? c.ar : c.en);
                                setCityOpen(false);
                                setCitySearch("");
                                setErrors((p) => ({ ...p, city: undefined }));
                              }}
                            >
                              {isRTL ? c.ar : c.en}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="w-full text-start px-3 py-2 text-sm hover:bg-accent transition-colors text-muted-foreground"
                            onClick={() => {
                              setCity("");
                              setCityOpen(false);
                              setCitySearch("");
                              setSelectedCountry({ ...selectedCountry!, cities: [] });
                            }}
                          >
                            {t("Other", "أخرى")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <MapPin className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      value={city}
                      onChange={(e) => { setCity(e.target.value); setErrors((p) => ({ ...p, city: undefined })); }}
                      placeholder={t("City", "المدينة")}
                      className={`ps-9 ${errors.city ? "border-destructive" : ""}`}
                    />
                  </div>
                )}
                <FieldError message={errors.city} />
              </div>
            </div>

            {/* Has Motorcycle — toggle chips */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Bike className="w-4 h-4 text-primary" />
                {t("Do you currently own a motorcycle?", "هل تمتلك دراجة نارية حالياً؟")}
              </div>
              <div className="flex gap-2">
                <ToggleChip selected={hasMotorcycle === "yes"} onClick={() => toggleMotorcycle("yes")}>
                  {t("Yes, I do", "نعم، أمتلك")}
                </ToggleChip>
                <ToggleChip selected={hasMotorcycle === "no"} onClick={() => toggleMotorcycle("no")}>
                  {t("Not yet", "ليس بعد")}
                </ToggleChip>
              </div>
              <FieldError message={errors.hasMotorcycle} />
            </div>

            {/* Considering Purchase — toggle chips with slide animation */}
            {hasMotorcycle === "no" && (
              <div className="space-y-2 ps-4 border-s-2 border-primary/30">
                <div className="text-sm font-medium text-foreground">
                  {t("Are you planning to buy a motorcycle?", "هل تخطط لشراء دراجة نارية؟")}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <ToggleChip selected={consideringPurchase === "yes"} onClick={() => toggleConsidering("yes")}>
                    {t("Yes, soon", "نعم، قريباً")}
                  </ToggleChip>
                  <ToggleChip selected={consideringPurchase === "no"} onClick={() => toggleConsidering("no")}>
                    {t("No plans", "لا أخطط")}
                  </ToggleChip>
                  <ToggleChip selected={consideringPurchase === "maybe"} onClick={() => toggleConsidering("maybe")}>
                    {t("Maybe later", "ربما لاحقاً")}
                  </ToggleChip>
                </div>
                <FieldError message={errors.consideringPurchase} />
              </div>
            )}

            {/* Submit */}
            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? t("Submitting...", "جاري الإرسال...") : t("Join Now", "انضم الآن")}
            </Button>

            {/* WhatsApp CTA */}
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="block">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 text-white hover:text-white border-0"
                style={{ backgroundColor: "#25D366" }}
              >
                <MessageCircle className="w-5 h-5" />
                {t("Contact us on WhatsApp", "تواصل معنا على واتساب")}
              </Button>
            </a>
          </form>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default JoinCommunity;
