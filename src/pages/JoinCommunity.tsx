import React, { useState, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRIES, type CountryEntry } from "@/data/countryCityData";
import { Check, ChevronDown, Search, MessageCircle, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import logoDark from "@/assets/logo-dark.png";
import logoLight from "@/assets/logo-light.png";
import SEOHead from "@/components/common/SEOHead";

const WHATSAPP_NUMBER = "PHONE_NUMBER"; // Replace with real number

const JoinCommunity: React.FC = () => {
  const { isRTL } = useLanguage();
  const { theme } = useTheme();
  const logo = theme === "light" ? logoDark : logoLight;

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<CountryEntry | null>(null);
  const [city, setCity] = useState("");
  const [hasMotorcycle, setHasMotorcycle] = useState<string>("");
  const [consideringPurchase, setConsideringPurchase] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Country dropdown state
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  // City dropdown state
  const [cityOpen, setCityOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const q = countrySearch.toLowerCase();
    return COUNTRIES.filter(
      (c) => c.en.toLowerCase().includes(q) || c.ar.includes(q)
    );
  }, [countrySearch]);

  const cities = useMemo(() => {
    if (!selectedCountry) return [];
    return selectedCountry.cities;
  }, [selectedCountry]);

  const filteredCities = useMemo(() => {
    if (!citySearch.trim()) return cities;
    const q = citySearch.toLowerCase();
    return cities.filter(
      (c) => c.en.toLowerCase().includes(q) || c.ar.includes(q)
    );
  }, [cities, citySearch]);

  const isOtherCountry = selectedCountry?.code === "OTHER";
  const hasCities = cities.length > 0 && !isOtherCountry;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = isRTL ? "الاسم مطلوب" : "Full name is required";
    if (!phone.trim()) newErrors.phone = isRTL ? "رقم الهاتف مطلوب" : "Phone number is required";
    if (!email.trim() || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))
      newErrors.email = isRTL ? "بريد إلكتروني صالح مطلوب" : "Valid email is required";
    if (!selectedCountry) newErrors.country = isRTL ? "الدولة مطلوبة" : "Country is required";
    if (!city.trim()) newErrors.city = isRTL ? "المدينة مطلوبة" : "City is required";
    if (!hasMotorcycle) newErrors.hasMotorcycle = isRTL ? "هذا الحقل مطلوب" : "This field is required";
    if (hasMotorcycle === "no" && !consideringPurchase)
      newErrors.consideringPurchase = isRTL ? "هذا الحقل مطلوب" : "This field is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("community_members" as any).insert({
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        country: isRTL ? (selectedCountry?.ar || "") : (selectedCountry?.en || ""),
        city: city.trim(),
        has_motorcycle: hasMotorcycle === "yes",
        considering_purchase: hasMotorcycle === "no" ? consideringPurchase : null,
      } as any);
      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      toast({
        title: isRTL ? "خطأ" : "Error",
        description: err.message || (isRTL ? "حدث خطأ، حاول مرة أخرى" : "Something went wrong. Please try again."),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <>
        <Navbar />
        <div className="min-h-[80dvh] flex items-center justify-center bg-background px-4">
          <div className="max-w-md w-full text-center space-y-6 py-16">
            <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              {isRTL ? "🎉 مرحباً بك في مجتمع بايكرز!" : "🎉 Welcome to the Bikerz Community!"}
            </h1>
            <p className="text-muted-foreground">
              {isRTL
                ? "تم تسجيلك بنجاح. سنتواصل معك قريباً!"
                : "You've been registered successfully. We'll be in touch soon!"}
            </p>
            <div className="flex flex-col gap-3">
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="w-full gap-2 text-white" style={{ backgroundColor: "#25D366" }}>
                  <MessageCircle className="w-5 h-5" />
                  {isRTL ? "تواصل معنا على واتساب" : "Contact us on WhatsApp"}
                </Button>
              </a>
              <Link to="/">
                <Button variant="outline" className="w-full">
                  {isRTL ? "العودة للرئيسية" : "Back to Home"}
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
        title={isRTL ? "انضم لمجتمع بايكرز" : "Join Bikerz Community"}
        description={isRTL ? "انضم لمجتمع الدراجين المتنامي" : "Join the growing community of riders"}
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
                {isRTL ? "انضم لمجتمع بايكرز" : "Join the Bikerz Community"}
              </h1>
            </div>
            <p className="text-muted-foreground text-sm sm:text-base max-w-sm mx-auto">
              {isRTL
                ? "كن جزءاً من مجتمع متنامي من الدراجين في المنطقة"
                : "Be part of a growing community of riders across the region"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border rounded-xl p-5 sm:p-8">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName">{isRTL ? "الاسم الكامل" : "Full Name"} *</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={isRTL ? "أدخل اسمك الكامل" : "Enter your full name"}
              />
              {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">{isRTL ? "رقم الهاتف" : "Phone Number"} *</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={isRTL ? "أدخل رقم هاتفك" : "Enter your phone number"}
                dir="ltr"
              />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">{isRTL ? "البريد الإلكتروني" : "Email Address"} *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isRTL ? "أدخل بريدك الإلكتروني" : "Enter your email"}
                dir="ltr"
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            {/* Country */}
            <div className="space-y-2">
              <Label>{isRTL ? "الدولة" : "Country"} *</Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setCountryOpen(!countryOpen); setCityOpen(false); }}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className={selectedCountry ? "text-foreground" : "text-muted-foreground"}>
                    {selectedCountry
                      ? (isRTL ? selectedCountry.ar : selectedCountry.en)
                      : (isRTL ? "اختر الدولة" : "Select country")}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
                {countryOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-60 overflow-hidden">
                    <div className="p-2 border-b border-border">
                      <div className="relative">
                        <Search className="absolute start-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          className="w-full ps-8 pe-3 py-1.5 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                          placeholder={isRTL ? "بحث..." : "Search..."}
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
                          className={`w-full text-start px-3 py-2 text-sm hover:bg-accent transition-colors ${
                            selectedCountry?.code === c.code ? "bg-accent text-accent-foreground" : ""
                          }`}
                          onClick={() => {
                            setSelectedCountry(c);
                            setCity("");
                            setCountryOpen(false);
                            setCountrySearch("");
                          }}
                        >
                          {isRTL ? c.ar : c.en}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {errors.country && <p className="text-xs text-destructive">{errors.country}</p>}
            </div>

            {/* City */}
            <div className="space-y-2">
              <Label>{isRTL ? "المدينة" : "City"} *</Label>
              {hasCities ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setCityOpen(!cityOpen); setCountryOpen(false); }}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className={city ? "text-foreground" : "text-muted-foreground"}>
                      {city || (isRTL ? "اختر المدينة" : "Select city")}
                    </span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>
                  {cityOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-60 overflow-hidden">
                      <div className="p-2 border-b border-border">
                        <div className="relative">
                          <Search className="absolute start-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            className="w-full ps-8 pe-3 py-1.5 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                            placeholder={isRTL ? "بحث..." : "Search..."}
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
                            className={`w-full text-start px-3 py-2 text-sm hover:bg-accent transition-colors ${
                              city === (isRTL ? c.ar : c.en) ? "bg-accent text-accent-foreground" : ""
                            }`}
                            onClick={() => {
                              setCity(isRTL ? c.ar : c.en);
                              setCityOpen(false);
                              setCitySearch("");
                            }}
                          >
                            {isRTL ? c.ar : c.en}
                          </button>
                        ))}
                        {/* Other option */}
                        <button
                          type="button"
                          className="w-full text-start px-3 py-2 text-sm hover:bg-accent transition-colors text-muted-foreground"
                          onClick={() => {
                            setCity("");
                            setCityOpen(false);
                            setCitySearch("");
                            // Switch to text input by clearing cities context
                            setSelectedCountry({ ...selectedCountry!, cities: [] });
                          }}
                        >
                          {isRTL ? "أخرى" : "Other"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={isRTL ? "أدخل اسم المدينة" : "Enter city name"}
                />
              )}
              {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
            </div>

            {/* Has Motorcycle */}
            <div className="space-y-3">
              <Label>{isRTL ? "هل تمتلك دراجة نارية؟" : "Do you own a motorcycle?"} *</Label>
              <RadioGroup value={hasMotorcycle} onValueChange={(v) => { setHasMotorcycle(v); if (v === "yes") setConsideringPurchase(""); }}>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="yes" id="moto-yes" />
                  <Label htmlFor="moto-yes" className="cursor-pointer font-normal">{isRTL ? "نعم" : "Yes"}</Label>
                </div>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="no" id="moto-no" />
                  <Label htmlFor="moto-no" className="cursor-pointer font-normal">{isRTL ? "لا" : "No"}</Label>
                </div>
              </RadioGroup>
              {errors.hasMotorcycle && <p className="text-xs text-destructive">{errors.hasMotorcycle}</p>}
            </div>

            {/* Considering Purchase (shown when no motorcycle) */}
            {hasMotorcycle === "no" && (
              <div className="space-y-3 ps-4 border-s-2 border-primary/30">
                <Label>{isRTL ? "هل تفكر في شراء واحدة؟" : "Are you thinking about buying one?"} *</Label>
                <RadioGroup value={consideringPurchase} onValueChange={setConsideringPurchase}>
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="yes" id="buy-yes" />
                    <Label htmlFor="buy-yes" className="cursor-pointer font-normal">{isRTL ? "نعم" : "Yes"}</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="no" id="buy-no" />
                    <Label htmlFor="buy-no" className="cursor-pointer font-normal">{isRTL ? "لا" : "No"}</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="maybe" id="buy-maybe" />
                    <Label htmlFor="buy-maybe" className="cursor-pointer font-normal">{isRTL ? "ربما" : "Maybe"}</Label>
                  </div>
                </RadioGroup>
                {errors.consideringPurchase && <p className="text-xs text-destructive">{errors.consideringPurchase}</p>}
              </div>
            )}

            {/* Submit */}
            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting
                ? (isRTL ? "جاري الإرسال..." : "Submitting...")
                : (isRTL ? "انضم الآن" : "Join Now")}
            </Button>

            {/* WhatsApp CTA */}
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 text-white hover:text-white border-0"
                style={{ backgroundColor: "#25D366" }}
              >
                <MessageCircle className="w-5 h-5" />
                {isRTL ? "تواصل معنا على واتساب" : "Contact us on WhatsApp"}
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
