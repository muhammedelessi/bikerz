import React, { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useSignupWebhook } from "@/hooks/useSignupWebhook";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import LanguageToggle from "@/components/common/LanguageToggle";
import { useAuthPageContent } from "@/hooks/useAuthPageContent";
import {
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import SEOHead from "@/components/common/SEOHead";
import logoDark from "@/assets/logo-dark.webp";
import logoLight from "@/assets/logo-light.png";
import { useTheme } from "@/components/ThemeProvider";
import { PHONE_COUNTRIES } from "@/data/phoneCountryCodes";
import { COUNTRIES } from "@/data/countryCityData";
import { consumeReturnUrl } from "@/lib/authReturnUrl";
import { activateFreeTrialForCourse, consumeTrialOfferPending } from "@/lib/guestPreview";
import { FormAlert, FormField } from "@/components/ui/form-field";
import { joinFullName } from "@/lib/nameUtils";
import { CountryCityPicker, PasswordField, PhoneField, NameFields } from "@/components/ui/fields";
import type { LcpPreloadLink } from "@/components/common/SEOHead";

const ProfileCompletionWizard = lazy(() => import("@/components/ui/profile/ProfileCompletionWizard"));

const OTHER_VALUE = "__other__";

const Signup: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { isRTL } = useLanguage();
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const { data: authContent } = useAuthPageContent();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phonePrefix, setPhonePrefix] = useState("+966_SA");
  const [country, setCountry] = useState("SA");
  const [city, setCity] = useState("");
  const [customCountry, setCustomCountry] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstNameError, setFirstNameError] = useState<string | null>(null);
  const [lastNameError, setLastNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [countryError, setCountryError] = useState<string | null>(null);
  const [cityError, setCityError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showProfileWizard, setShowProfileWizard] = useState(false);

  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const { sendSignupData } = useSignupWebhook();

  const logoSrc = theme === "light" ? logoDark : logoLight;
  const signupLcpPreloads = useMemo((): LcpPreloadLink[] | undefined => {
    if (!logoSrc) return undefined;
    return [{ href: logoSrc }];
  }, [logoSrc]);

  useEffect(() => {
    if (typeof window.requestIdleCallback !== "function") return;
    const id = window.requestIdleCallback(
      () => void import("@/components/ui/profile/ProfileCompletionWizard"),
      { timeout: 8000 },
    );
    return () => window.cancelIdleCallback(id);
  }, []);

  const isOtherCountry = country === OTHER_VALUE;
  const isOtherCity = city === OTHER_VALUE;

  const selectedCountryEntry = useMemo(() => COUNTRIES.find((c) => c.code === country), [country]);

  const emailErrorMessage = useMemo(() => {
    if (!emailError) return null;
    if (emailError !== "EMAIL_EXISTS") return emailError;
    return isRTL
      ? "البريد الإلكتروني مستخدم مسبقاً، يرجى تسجيل الدخول أو استخدام بريد آخر"
      : "This email is already registered. Please sign in or use a different email";
  }, [emailError, isRTL]);

  // Geo hint — deferred so it never competes with LCP (logo, fonts, critical CSS)
  useEffect(() => {
    const detectCountry = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        if (!res.ok) return;
        const data = await res.json();
        const countryCode = data.country_code;
        const phoneMatch = PHONE_COUNTRIES.find((c) => c.code === countryCode);
        if (phoneMatch) {
          setPhonePrefix(`${phoneMatch.prefix}_${phoneMatch.code}`);
        }
        const countryMatch = COUNTRIES.find((c) => c.code === countryCode);
        if (countryMatch) {
          setCountry(countryCode);
        } else {
          setCountry(OTHER_VALUE);
          setCustomCountry(data.country_name || "");
        }
        if (data.city && countryMatch) {
          const cityMatch = countryMatch.cities.find((c) => c.en.toLowerCase() === data.city.toLowerCase());
          if (cityMatch) {
            setCity(isRTL ? cityMatch.ar : cityMatch.en);
          }
        }
      } catch {
        // fallback to SA
      }
    };
    let idleId: number | undefined;
    let timeoutId: number | undefined;
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(() => void detectCountry(), { timeout: 4000 });
    } else {
      timeoutId = window.setTimeout(() => void detectCountry(), 2000);
    }
    return () => {
      if (idleId !== undefined && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [isRTL]);


  const cms = authContent?.signup || {};
  const title = (isRTL ? cms.title_ar : cms.title_en) || t("auth.signup.title");
  const subtitle = (isRTL ? cms.subtitle_ar : cms.subtitle_en) || t("auth.signup.subtitle");
  const buttonText = (isRTL ? cms.button_ar : cms.button_en) || t("auth.signup.button");
  const emailLabel = (isRTL ? cms.email_label_ar : cms.email_label_en) || t("fields.email.label");
  const hasAccountText = (isRTL ? cms.has_account_ar : cms.has_account_en) || t("auth.signup.hasAccount");
  const loginLinkText = (isRTL ? cms.login_link_ar : cms.login_link_en) || t("auth.signup.loginLink");

  const validatePhone = (phoneValue: string): boolean => {
    const digitsOnly = phoneValue.replace(/[^0-9]/g, "");
    if (digitsOnly.length < 7) {
      setPhoneError(isRTL ? "رقم الهاتف قصير جداً (7 أرقام على الأقل)" : "Phone number too short (min 7 digits)");
      return false;
    }
    if (digitsOnly.length > 15) {
      setPhoneError(isRTL ? "رقم الهاتف طويل جداً (15 رقم كحد أقصى)" : "Phone number too long (max 15 digits)");
      return false;
    }
    setPhoneError(null);
    return true;
  };

  const saveProfileAndSync = async (
    userId: string,
    fullName: string,
    userEmail: string,
    fullPhone: string,
    countryName: string,
    cityName: string,
  ) => {
    try {
      await supabase
        .from("profiles")
        .update({
          phone: fullPhone,
          country: countryName,
          city: cityName,
        })
        .eq("user_id", userId);
    } catch (e) {
      console.error("Failed to save profile:", e);
    }

    try {
      await supabase.functions.invoke("ghl-sync", {
        body: {
          action: "create_or_update_contact",
          data: {
            full_name: fullName,
            email: userEmail,
            phone: fullPhone,
            country: countryName,
            city: cityName,
          },
        },
      });
    } catch (syncErr) {
      console.error("GHL signup sync failed:", syncErr);
    }

    sendSignupData({
      full_name: fullName || "",
      email: userEmail || "",
      phone: fullPhone,
      country: countryName,
      city: cityName,
      date_of_birth: "",
      gender: "",
      silent: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFirstNameError(null);
    setLastNameError(null);
    setEmailError(null);
    setPhoneError(null);
    setCountryError(null);
    setCityError(null);

    let hasError = false;

    if (!firstName.trim()) {
      setFirstNameError(t("validation.firstNameRequired"));
      hasError = true;
    }
    if (!lastName.trim()) {
      setLastNameError(t("validation.lastNameRequired"));
      hasError = true;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setEmailError(isRTL ? "يرجى إدخال البريد الإلكتروني" : "Please enter your email");
      hasError = true;
    } else if (!emailRegex.test(email.trim())) {
      setEmailError(isRTL ? "البريد الإلكتروني غير صالح" : "Invalid email address");
      hasError = true;
    }

    if (!validatePhone(phone)) hasError = true;

    if (password.length < 6) {
      setPasswordError(isRTL ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters");
      hasError = true;
    }

    const finalCountry = isOtherCountry ? customCountry.trim() : selectedCountryEntry?.code || "";
    const finalCity = isOtherCity || isOtherCountry
      ? customCity.trim()
      : selectedCountryEntry?.cities.find((c) => c.ar === city || c.en === city)?.en || city;
    if (!finalCountry) {
      setCountryError(isRTL ? "يرجى اختيار أو إدخال الدولة" : "Please select or enter your country");
      hasError = true;
    }
    if (!finalCity) {
      setCityError(isRTL ? "يرجى اختيار أو إدخال المدينة" : "Please select or enter your city");
      hasError = true;
    }

    if (hasError) return;

    setIsLoading(true);

    // Check if email already exists using secure RPC
    const { data: emailExists } = await supabase.rpc('check_email_exists', { p_email: email.trim() });

    if (emailExists) {
      setEmailError('EMAIL_EXISTS');
      setIsLoading(false);
      return;
    }

    // Check if phone already exists using secure RPC
    const phonePrefixValue = phonePrefix.split("_")[0];
    const phoneDigits = phone.replace(/[^0-9]/g, "");
    const phoneWithoutLeadingZero = phoneDigits.startsWith("0") ? phoneDigits.slice(1) : phoneDigits;
    const fullPhone = `${phonePrefixValue}${phoneWithoutLeadingZero}`;
    const { data: phoneExists } = await supabase.rpc('check_phone_exists', { p_phone: fullPhone });

    if (phoneExists) {
      setPhoneError(isRTL 
        ? 'رقم الهاتف مستخدم مسبقاً. يرجى تسجيل الدخول أو استخدام رقم آخر' 
        : 'This phone number is already registered. Please sign in or use a different number');
      setIsLoading(false);
      return;
    }

    const fullName = joinFullName(firstName, lastName);
    if (!fullName) {
      setFirstNameError(t("validation.firstNameRequired"));
      setLastNameError(t("validation.lastNameRequired"));
      setIsLoading(false);
      return;
    }

    const { error } = await signUp(email, password, fullName);

    if (error) {
      if (error.message === 'EMAIL_EXISTS') {
        setEmailError('EMAIL_EXISTS');
      } else {
        setError(error.message);
      }
      setIsLoading(false);
      return;
    }

    try {
      const {
        data: { user: newUser },
      } = await (supabase.auth as any).getUser();
      if (newUser) {
        await saveProfileAndSync(newUser.id, fullName, email, fullPhone, finalCountry, finalCity);
      }
    } catch (e) {
      console.error("Post-signup sync failed:", e);
    }

    // Save or clear remembered credentials
    if (rememberMe) {
      localStorage.setItem("bikerz_remember", JSON.stringify({ email, password }));
    } else {
      localStorage.removeItem("bikerz_remember");
    }

    toast.success(t("auth.signup.success"));
    setIsLoading(false);

    const pendingTrial = consumeTrialOfferPending();
    if (pendingTrial?.courseId) {
      activateFreeTrialForCourse(pendingTrial.courseId);
    }

    // If coming from checkout / saved return URL, skip profile wizard and redirect directly
    const redirectAfterAuth = consumeReturnUrl() || returnTo;
    if (redirectAfterAuth) {
      navigate(redirectAfterAuth);
      return;
    }
    setShowProfileWizard(true);
  };

  const handleProfileWizardClose = (open: boolean) => {
    setShowProfileWizard(open);
    if (!open) {
      navigate(returnTo || "/dashboard");
    }
  };

  return (
    <div
      id="main-content"
      className="min-h-screen min-h-[100dvh] w-full bg-background flex items-start sm:items-center justify-center p-4 sm:p-6 lg:p-8 pb-8 sm:pb-6 safe-area-inset"
    >
      <SEOHead
        title="Sign Up"
        description="Create your BIKERZ Academy account and start learning motorcycle riding from expert instructors today."
        canonical="/signup"
        lcpPreloads={signupLcpPreloads}
      />
      <div className="w-full max-w-md mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <Link to="/" className="flex items-center">
              <img
                src={logoSrc}
                alt="BIKERZ"
                width={160}
                height={48}
                className="h-6 sm:h-7 lg:h-8 w-auto object-contain"
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />
            </Link>
            <LanguageToggle />
          </div>

          {/* Form Card */}
          <div className="card-premium p-4 sm:p-6 lg:p-8 overflow-visible">
            <div className="text-center mb-6 sm:mb-8">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">{title}</h1>
              <p className="text-sm sm:text-base text-muted-foreground">{subtitle}</p>
            </div>

            <div className="mb-4 sm:mb-6">
              <FormAlert message={error} />
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-4 sm:space-y-5 pb-1"
              onFocusCapture={(e) => {
                const el = e.target as HTMLElement | null;
                if (!el) return;
                window.setTimeout(() => {
                  el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
                }, 50);
              }}
            >
              {/* Name */}
              <NameFields
                firstName={firstName}
                lastName={lastName}
                onFirstNameChange={(val) => { setFirstName(val); setFirstNameError(null); }}
                onLastNameChange={(val) => { setLastName(val); setLastNameError(null); }}
                firstNameError={firstNameError}
                lastNameError={lastNameError}
                required
              />

              {/* Email */}
              <FormField
                label={emailLabel}
                error={emailErrorMessage}
                required
              >
                <div className="relative">
                  <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError(null);
                    }}
                    placeholder={t("fields.email.placeholder")}
                    className={`ps-11 ${emailError ? "border-destructive" : ""}`}
                  />
                </div>
              </FormField>

              {/* Phone */}
              <PhoneField
                phonePrefix={phonePrefix}
                phoneNumber={phone}
                onPrefixChange={(val) => { setPhonePrefix(val); setPhoneError(null); }}
                onNumberChange={(val) => { setPhone(val); setPhoneError(null); }}
                error={phoneError}
                required
              />

              <CountryCityPicker
                country={country}
                city={city}
                onCountryChange={(v) => { setCountry(v); setCountryError(null); setCityError(null); }}
                onCityChange={(v) => { setCity(v); setCityError(null); }}
                customCountry={customCountry}
                onCustomCountryChange={(v) => { setCustomCountry(v); setCountryError(null); }}
                customCity={customCity}
                onCustomCityChange={(v) => { setCustomCity(v); setCityError(null); }}
                countryError={countryError ?? undefined}
                cityError={cityError ?? undefined}
                required
              />

              {/* Password */}
              <PasswordField
                value={password}
                onChange={(val) => { setPassword(val); setPasswordError(null); }}
                error={passwordError}
                required
                autoComplete="new-password"
              />

              <Button variant="cta" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    {buttonText}
                    <Arrow className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-5 sm:mt-6 text-center text-sm sm:text-base text-muted-foreground">
              {hasAccountText}{" "}
              <Link
                to={returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login"}
                className="text-primary hover:underline font-medium"
              >
                {loginLinkText}
              </Link>
            </div>
          </div>
      </div>

      {showProfileWizard && (
        <Suspense fallback={null}>
          <ProfileCompletionWizard open={showProfileWizard} onOpenChange={handleProfileWizardClose} />
        </Suspense>
      )}
    </div>
  );
};

export default Signup;
