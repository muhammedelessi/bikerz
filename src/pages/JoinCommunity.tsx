import React, { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRIES, type CountryEntry } from "@/data/countryCityData";
import { CountryCityPicker, PhoneField, NameFields } from "@/components/ui/fields";
import { PHONE_COUNTRIES } from "@/data/phoneCountryCodes";
import { useSignupWebhook } from "@/hooks/useSignupWebhook";
import {
  Check, MessageCircle, Users,
  Mail, Bike,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import logoDark from "@/assets/logo-dark.png";
import logoLight from "@/assets/logo-light.png";
import SEOHead from "@/components/common/SEOHead";
import { FormField } from "@/components/ui/form-field";
import { joinFullName } from "@/lib/nameUtils";

const WHATSAPP_NUMBER = "966562562368";

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
  const { t } = useTranslation();
  const { sendSignupData } = useSignupWebhook();
  const logo = theme === "light" ? logoDark : logoLight;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [phonePrefix, setPhonePrefix] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [city, setCity] = useState("");
  const [hasMotorcycle, setHasMotorcycle] = useState<string>("");
  const [consideringPurchase, setConsideringPurchase] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateFound, setDuplicateFound] = useState(false);

  // Auto-detect country & phone prefix by user location
  useEffect(() => {
    const detect = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (!res.ok) return;
        const data = await res.json();
        const cc = data.country_code;
        const phoneMatch = PHONE_COUNTRIES.find(c => c.code === cc);
        if (phoneMatch) setPhonePrefix(`${phoneMatch.prefix}_${phoneMatch.code}`);
        const countryMatch = COUNTRIES.find(c => c.code === cc);
        if (countryMatch) {
          setCountryCode(countryMatch.code);
          if (data.city) {
            const cityMatch = countryMatch.cities.find(
              c => c.en.toLowerCase() === data.city.toLowerCase()
            );
            if (cityMatch) setCity(isRTL ? cityMatch.ar : cityMatch.en);
          }
        }
      } catch {}
    };
    detect();
  }, []);

  const selectedCountry = useMemo(() => COUNTRIES.find(c => c.code === countryCode) || null, [countryCode]);


  const getFullPhone = (): string => {
    const prefix = phonePrefix ? phonePrefix.split("_")[0] : "";
    return `${prefix}${phone}`.trim();
  };

  const pickText = (en: string, ar: string) => (isRTL ? ar : en);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = t("validation.firstNameRequired");
    if (!lastName.trim()) e.lastName = t("validation.lastNameRequired");
    if (!phonePrefix) e.phone = pickText("Country code is required", "كود الدولة مطلوب");
    else if (!phone.trim()) e.phone = pickText("Phone number is required", "رقم الهاتف مطلوب");
    if (!email.trim()) e.email = pickText("Email is required", "البريد مطلوب");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = pickText("Valid email is required", "بريد إلكتروني صالح مطلوب");
    if (!countryCode) e.country = pickText("Country is required", "الدولة مطلوبة");
    if (!city.trim()) e.city = pickText("City is required", "المدينة مطلوبة");
    if (!hasMotorcycle) e.hasMotorcycle = pickText("This field is required", "هذا الحقل مطلوب");
    if (hasMotorcycle === "no" && !consideringPurchase) e.consideringPurchase = pickText("This field is required", "هذا الحقل مطلوب");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setDuplicateFound(false);
    const fullPhone = getFullPhone();
    const fullName = joinFullName(firstName, lastName);
    if (!fullName) {
      setErrors((prev) => ({
        ...prev,
        firstName: t("validation.firstNameRequired"),
        lastName: t("validation.lastNameRequired"),
      }));
      setSubmitting(false);
      return;
    }
    const countryName = isRTL ? (selectedCountry?.ar || "") : (selectedCountry?.en || "");
    try {
      // Duplicate check
      const emailLower = email.trim().toLowerCase();
      const { data: byEmail } = await supabase
        .from("community_members" as any)
        .select("id")
        .eq("email", emailLower)
        .limit(1) as any;
      const { data: byPhone } = await supabase
        .from("community_members" as any)
        .select("id")
        .eq("phone", fullPhone)
        .limit(1) as any;

      const dupErrors: Record<string, string> = {};
      if (byEmail && byEmail.length > 0) {
        dupErrors.email = t(
          "This email is already registered in the community",
          "هذا البريد الإلكتروني مسجل مسبقاً في المجتمع"
        );
      }
      if (byPhone && byPhone.length > 0) {
        dupErrors.phone = t(
          "This phone number is already registered in the community",
          "رقم الهاتف هذا مسجل مسبقاً في المجتمع"
        );
      }
      if (Object.keys(dupErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...dupErrors }));
        setDuplicateFound(true);
        setSubmitting(false);
        return;
      }

      const { error } = await supabase.from("community_members" as any).insert({
        full_name: fullName,
        phone: fullPhone,
        email: emailLower,
        country: countryName,
        city: city.trim(),
        has_motorcycle: hasMotorcycle === "yes",
        considering_purchase: hasMotorcycle === "no" ? consideringPurchase : null,
      } as any);
      if (error) throw error;
      sendSignupData({
        full_name: fullName,
        email: emailLower,
        phone: fullPhone,
        country: selectedCountry?.code || countryName,
        city: city.trim(),
        has_motorcycle: hasMotorcycle === "yes",
        considering_purchase: hasMotorcycle === "no" ? consideringPurchase === "yes" : null,
        silent: true,
      });
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: pickText("Error", "خطأ"), description: err.message || pickText("Something went wrong", "حدث خطأ"), variant: "destructive" });
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
              {pickText("🎉 Welcome to the Bikerz Community!", "🎉 مرحباً بك في مجتمع بايكرز!")}
            </h1>
            <p className="text-muted-foreground">
              {pickText("You've been registered successfully. We'll be in touch soon!", "تم تسجيلك بنجاح. سنتواصل معك قريباً!")}
            </p>
            <div className="flex flex-col gap-3">
              <Link to="/">
                <Button variant="outline" className="w-full">
                  {pickText("Back to Home", "العودة للرئيسية")}
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
        title={pickText("Join Bikerz Community", "انضم لمجتمع بايكرز")}
        description={pickText("Join the growing community of riders", "انضم لمجتمع الدراجين المتنامي")}
      />
      <Navbar />
      <div className="min-h-[80dvh] bg-background pt-[var(--navbar-h,64px)] pb-8 sm:pb-12 px-4" dir={isRTL ? "rtl" : "ltr"}>
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="text-center mb-8 space-y-4">
            <div className="flex items-center justify-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                {pickText("Join the Bikerz Community", "انضم لمجتمع بايكرز")}
              </h1>
            </div>
            <p className="text-muted-foreground text-sm sm:text-base max-w-sm mx-auto">
              {pickText("Be part of a growing community of riders across the region", "كن جزءاً من مجتمع متنامي من الدراجين في المنطقة")}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-xl p-5 sm:p-8">
            <NameFields
              firstName={firstName}
              lastName={lastName}
              onFirstNameChange={(val) => { setFirstName(val); setErrors((p) => ({ ...p, firstName: undefined })); }}
              onLastNameChange={(val) => { setLastName(val); setErrors((p) => ({ ...p, lastName: undefined })); }}
              firstNameError={errors.firstName}
              lastNameError={errors.lastName}
              required
            />

            {/* Phone */}
            <PhoneField
              phonePrefix={phonePrefix}
              phoneNumber={phone}
              onPrefixChange={(val) => { setPhonePrefix(val); setErrors((p) => ({ ...p, phone: undefined })); }}
              onNumberChange={(val) => { setPhone(val); setErrors((p) => ({ ...p, phone: undefined })); }}
              error={errors.phone}
              required
            />

            {/* Email — icon inside, supports RTL */}
            <FormField
              label={t('fields.email.label')}
              error={errors.email}
              required
            >
              <div className="relative">
                <Mail className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none ${isRTL ? "right-3" : "left-3"}`} />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
                  placeholder={t('fields.email.placeholder')}
                  className={`${isRTL ? "pr-11 text-right" : "pl-11 text-left"} ${errors.email ? "border-destructive" : ""}`}
                  dir={isRTL ? "rtl" : "ltr"}
                />
              </div>
            </FormField>

            {/* Country & City */}
            <CountryCityPicker
              country={countryCode}
              city={city}
              onCountryChange={(v) => { setCountryCode(v); setErrors((p) => ({ ...p, country: undefined, city: undefined })); }}
              onCityChange={(v) => { setCity(v); setErrors((p) => ({ ...p, city: undefined })); }}
              countryError={errors.country}
              cityError={errors.city}
              required
            />

            {/* Has Motorcycle — toggle chips */}
            <FormField
              label={pickText("Do you currently own a motorcycle?", "هل تمتلك دراجة نارية حالياً؟")}
              required
              error={errors.hasMotorcycle}
            >
              <div className="flex gap-2">
                <ToggleChip selected={hasMotorcycle === "yes"} onClick={() => toggleMotorcycle("yes")}>
                  {pickText("Yes, I do", "نعم، أمتلك")}
                </ToggleChip>
                <ToggleChip selected={hasMotorcycle === "no"} onClick={() => toggleMotorcycle("no")}>
                  {pickText("Not yet", "ليس بعد")}
                </ToggleChip>
              </div>
            </FormField>

            {/* Considering Purchase — toggle chips with slide animation */}
            {hasMotorcycle === "no" && (
              <FormField
                label={pickText("Are you planning to buy a motorcycle?", "هل تخطط لشراء دراجة نارية؟")}
                required
                error={errors.consideringPurchase}
              >
                <div className="space-y-2 ps-4 border-s-2 border-primary/30">
                  <div className="flex gap-2 flex-wrap">
                    <ToggleChip selected={consideringPurchase === "yes"} onClick={() => toggleConsidering("yes")}>
                      {pickText("Yes, soon", "نعم، قريباً")}
                    </ToggleChip>
                    <ToggleChip selected={consideringPurchase === "no"} onClick={() => toggleConsidering("no")}>
                      {pickText("No plans", "لا أخطط")}
                    </ToggleChip>
                    <ToggleChip selected={consideringPurchase === "maybe"} onClick={() => toggleConsidering("maybe")}>
                      {pickText("Maybe later", "ربما لاحقاً")}
                    </ToggleChip>
                  </div>
                </div>
              </FormField>
            )}

            {/* Submit */}
            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? pickText("Submitting...", "جاري الإرسال...") : pickText("Join Now", "انضم الآن")}
            </Button>

            {/* Duplicate detected — WhatsApp suggestion */}
            {duplicateFound && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 p-4 space-y-3 text-center">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 leading-relaxed">
                  {t(
                    "It looks like you're already registered in the Bikerz community! 🎉\nIf you need help or have a question, contact us directly on WhatsApp",
                    "يبدو أنك مسجل مسبقاً في مجتمع بايكرز! 🎉\nإذا كنت بحاجة إلى مساعدة أو لديك استفسار،\nتواصل معنا مباشرة على واتساب"
                  )}
                </p>
                <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="block">
                  <Button
                    type="button"
                    className="w-full gap-2 text-white hover:text-white border-0 hover:opacity-90"
                    style={{ backgroundColor: "#25D366" }}
                  >
                    <MessageCircle className="w-5 h-5" />
                    {pickText("💬 Contact us on WhatsApp", "💬 تواصل معنا على واتساب")}
                  </Button>
                </a>
              </div>
            )}

            {/* WhatsApp CTA */}
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="block">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 text-white hover:text-white border-0"
                style={{ backgroundColor: "#25D366" }}
              >
                <MessageCircle className="w-5 h-5" />
                {pickText("Contact us on WhatsApp", "تواصل معنا على واتساب")}
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
