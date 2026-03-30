import React, { useState, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRIES, type CountryEntry } from "@/data/countryCityData";
import { PHONE_COUNTRIES } from "@/data/phoneCountryCodes";
import SearchableDropdown from "@/components/checkout/SearchableDropdown";
import type { DropdownOption } from "@/components/checkout/SearchableDropdown";
import { Check, ChevronDown, Search, MessageCircle, Users, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import logoDark from "@/assets/logo-dark.png";
import logoLight from "@/assets/logo-light.png";
import SEOHead from "@/components/common/SEOHead";

const WHATSAPP_NUMBER = "PHONE_NUMBER"; // Replace with real number

const FieldError: React.FC<{ message?: string }> = ({ message }) => {
  if (!message) return null;
  return (
    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
      <AlertCircle className="w-3 h-3" />
      {message}
    </p>
  );
};

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

  // Country dropdown state
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  // City dropdown state
  const [cityOpen, setCityOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");

  // Phone prefix options (same as checkout)
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

  // Build full phone number from prefix + raw
  const getFullPhone = (): string => {
    const prefix = phonePrefix ? phonePrefix.split("_")[0] : "";
    return `${prefix}${phone}`.trim();
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = "Full name is required";
    if (!phonePrefix) newErrors.phone = "Country code is required";
    else if (!phone.trim()) newErrors.phone = "Phone number is required";
    if (!email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Valid email is required";
    if (!selectedCountry) newErrors.country = "Country is required";
    if (!city.trim()) newErrors.city = "City is required";
    if (!hasMotorcycle) newErrors.hasMotorcycle = "This field is required";
    if (hasMotorcycle === "no" && !consideringPurchase)
      newErrors.consideringPurchase = "This field is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    const fullPhone = getFullPhone();
    const countryName = selectedCountry?.en || "";

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

      // Fire webhook via edge function (non-blocking)
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
      } catch (_) {
        // Webhook failure is non-blocking
      }

      setSubmitted(true);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Something went wrong. Please try again.",
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
              🎉 Welcome to the Bikerz Community!
            </h1>
            <p className="text-muted-foreground">
              You've been registered successfully. We'll be in touch soon!
            </p>
            <div className="flex flex-col gap-3">
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="w-full gap-2 text-white" style={{ backgroundColor: "#25D366" }}>
                  <MessageCircle className="w-5 h-5" />
                  Contact us on WhatsApp
                </Button>
              </a>
              <Link to="/">
                <Button variant="outline" className="w-full">
                  Back to Home
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
        title="Join Bikerz Community"
        description="Join the growing community of riders across the region"
      />
      <Navbar />
      {/* Force LTR for the entire form area */}
      <div className="min-h-[80dvh] bg-background py-8 sm:py-12 px-4" dir="ltr">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="text-center mb-8 space-y-4">
            <img src={logo} alt="BIKERZ" className="h-10 sm:h-12 mx-auto object-contain" />
            <div className="flex items-center justify-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                Join the Bikerz Community
              </h1>
            </div>
            <p className="text-muted-foreground text-sm sm:text-base max-w-sm mx-auto">
              Be part of a growing community of riders across the region
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border rounded-xl p-5 sm:p-8">
            {/* Full Name */}
            <div className="space-y-1">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); setErrors((prev) => ({ ...prev, fullName: undefined })); }}
                placeholder="Enter your full name"
              />
              <FieldError message={errors.fullName} />
            </div>

            {/* Phone — same pattern as checkout */}
            <div className="space-y-1">
              <Label>Phone Number *</Label>
              <div className="flex gap-2" dir="ltr">
                <div className="flex-shrink-0 w-[110px]">
                  <SearchableDropdown
                    options={phonePrefixOptions}
                    value={phonePrefix}
                    onChange={(val) => { setPhonePrefix(val); setErrors((prev) => ({ ...prev, phone: undefined })); }}
                    placeholder="+---"
                    searchPlaceholder="Search..."
                    hasError={!!errors.phone}
                    dir="ltr"
                  />
                </div>
                <Input
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, "");
                    setPhone(val);
                    setErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  placeholder="5XXXXXXXX"
                  className={`flex-1 ${errors.phone ? "border-destructive" : ""}`}
                  dir="ltr"
                />
              </div>
              <FieldError message={errors.phone} />
            </div>

            {/* Email */}
            <div className="space-y-1">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((prev) => ({ ...prev, email: undefined })); }}
                placeholder="Enter your email"
                dir="ltr"
              />
              <FieldError message={errors.email} />
            </div>

            {/* Country */}
            <div className="space-y-1">
              <Label>Country *</Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setCountryOpen(!countryOpen); setCityOpen(false); }}
                  className={`flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${errors.country ? "border-destructive" : "border-input"}`}
                >
                  <span className={selectedCountry ? "text-foreground" : "text-muted-foreground"}>
                    {selectedCountry ? selectedCountry.en : "Select country"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
                {countryOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-60 overflow-hidden">
                    <div className="p-2 border-b border-border">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          className="w-full pl-8 pr-3 py-1.5 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                          placeholder="Search..."
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
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${
                            selectedCountry?.code === c.code ? "bg-accent text-accent-foreground" : ""
                          }`}
                          onClick={() => {
                            setSelectedCountry(c);
                            setCity("");
                            setCountryOpen(false);
                            setCountrySearch("");
                            setErrors((prev) => ({ ...prev, country: undefined }));
                          }}
                        >
                          {c.en}
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
              <Label>City *</Label>
              {hasCities ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setCityOpen(!cityOpen); setCountryOpen(false); }}
                    className={`flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${errors.city ? "border-destructive" : "border-input"}`}
                  >
                    <span className={city ? "text-foreground" : "text-muted-foreground"}>
                      {city || "Select city"}
                    </span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>
                  {cityOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-60 overflow-hidden">
                      <div className="p-2 border-b border-border">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            className="w-full pl-8 pr-3 py-1.5 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                            placeholder="Search..."
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
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${
                              city === c.en ? "bg-accent text-accent-foreground" : ""
                            }`}
                            onClick={() => {
                              setCity(c.en);
                              setCityOpen(false);
                              setCitySearch("");
                              setErrors((prev) => ({ ...prev, city: undefined }));
                            }}
                          >
                            {c.en}
                          </button>
                        ))}
                        {/* Other option */}
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors text-muted-foreground"
                          onClick={() => {
                            setCity("");
                            setCityOpen(false);
                            setCitySearch("");
                            setSelectedCountry({ ...selectedCountry!, cities: [] });
                          }}
                        >
                          Other
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Input
                  value={city}
                  onChange={(e) => { setCity(e.target.value); setErrors((prev) => ({ ...prev, city: undefined })); }}
                  placeholder="Enter city name"
                  className={errors.city ? "border-destructive" : ""}
                />
              )}
              <FieldError message={errors.city} />
            </div>

            {/* Has Motorcycle */}
            <div className="space-y-3">
              <Label>Do you own a motorcycle? *</Label>
              <RadioGroup value={hasMotorcycle} onValueChange={(v) => { setHasMotorcycle(v); if (v === "yes") setConsideringPurchase(""); setErrors((prev) => ({ ...prev, hasMotorcycle: undefined })); }}>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="yes" id="moto-yes" />
                  <Label htmlFor="moto-yes" className="cursor-pointer font-normal">Yes</Label>
                </div>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="no" id="moto-no" />
                  <Label htmlFor="moto-no" className="cursor-pointer font-normal">No</Label>
                </div>
              </RadioGroup>
              <FieldError message={errors.hasMotorcycle} />
            </div>

            {/* Considering Purchase (shown when no motorcycle) */}
            {hasMotorcycle === "no" && (
              <div className="space-y-3 pl-4 border-l-2 border-primary/30">
                <Label>Are you thinking about buying one? *</Label>
                <RadioGroup value={consideringPurchase} onValueChange={(v) => { setConsideringPurchase(v); setErrors((prev) => ({ ...prev, consideringPurchase: undefined })); }}>
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="yes" id="buy-yes" />
                    <Label htmlFor="buy-yes" className="cursor-pointer font-normal">Yes</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="no" id="buy-no" />
                    <Label htmlFor="buy-no" className="cursor-pointer font-normal">No</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="maybe" id="buy-maybe" />
                    <Label htmlFor="buy-maybe" className="cursor-pointer font-normal">Maybe</Label>
                  </div>
                </RadioGroup>
                <FieldError message={errors.consideringPurchase} />
              </div>
            )}

            {/* Submit */}
            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? "Submitting..." : "Join Now"}
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
                Contact us on WhatsApp
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
