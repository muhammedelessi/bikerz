import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { COUNTRIES, OTHER_OPTION } from "@/data/countryCityData";
import { PHONE_COUNTRIES } from "@/data/phoneCountryCodes";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { fetchProfileBillingData, updateProfile } from "@/services/supabase.service";
import type { DropdownOption } from "@/components/checkout/SearchableDropdown";
import type { ValidationErrors } from "@/types/payment";

export function useCheckoutForm(open: boolean) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, profile } = useAuth();
  const { detectedCountry } = useCurrency();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [cityManual, setCityManual] = useState("");
  const [isOtherCity, setIsOtherCity] = useState(false);
  const [country, setCountry] = useState("");
  const [countryManual, setCountryManual] = useState("");
  const [isOtherCountry, setIsOtherCountry] = useState(false);
  const [selectedCountryCode, setSelectedCountryCode] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [phonePrefix, setPhonePrefix] = useState("");

  const selectedCountry = useMemo(
    () => COUNTRIES.find((c) => c.code === selectedCountryCode) || null,
    [selectedCountryCode],
  );

  const handleCountryChange = useCallback(
    (code: string) => {
      if (code === "__other__") {
        setIsOtherCountry(true);
        setSelectedCountryCode("");
        setCountry("");
        setCountryManual("");
      } else {
        setIsOtherCountry(false);
        setSelectedCountryCode(code);
        setCountryManual("");
        const found = COUNTRIES.find((c) => c.code === code);
        if (found) {
          setCountry(isRTL ? found.ar : found.en);
        }
      }
      setCity("");
      setCityManual("");
      setIsOtherCity(false);
      setErrors((prev) => ({ ...prev, country: undefined, city: undefined }));
    },
    [isRTL],
  );

  const handleCityChange = useCallback((val: string) => {
    if (val === "__other__") {
      setIsOtherCity(true);
      setCity("");
      setCityManual("");
    } else {
      setIsOtherCity(false);
      setCity(val);
      setCityManual("");
    }
    setErrors((prev) => ({ ...prev, city: undefined }));
  }, []);

  const countryOptions = useMemo((): DropdownOption[] => {
    const items = COUNTRIES.map((c) => ({ value: c.code, label: isRTL ? c.ar : c.en }));
    items.push({ value: "__other__", label: isRTL ? OTHER_OPTION.ar : OTHER_OPTION.en });
    return items;
  }, [isRTL]);

  const cityOptions = useMemo((): DropdownOption[] => {
    if (!selectedCountry) return [];
    const items = selectedCountry.cities.map((ct) => {
      const label = isRTL ? ct.ar : ct.en;
      return { value: label, label };
    });
    items.push({ value: "__other__", label: isRTL ? OTHER_OPTION.ar : OTHER_OPTION.en });
    return items;
  }, [selectedCountry, isRTL]);

  const phonePrefixOptions = useMemo((): DropdownOption[] => {
    return PHONE_COUNTRIES.map((pc) => {
      const name = isRTL ? pc.ar : pc.en;
      return { value: pc.prefix + "_" + pc.code, label: `${pc.prefix}  ${name}` };
    });
  }, [isRTL]);

  const actualPrefix = phonePrefix ? phonePrefix.split("_")[0] : "";
  const effectiveCity =
    isOtherCity || isOtherCountry
      ? cityManual.trim()
      : selectedCountry?.cities.find((c) => c.ar === city || c.en === city)?.en || city.trim();
  const effectiveCountry = isOtherCountry
    ? countryManual.trim()
    : COUNTRIES.find((c) => c.code === selectedCountryCode)?.en || country.trim();
  const getFullPhone = useCallback(() => {
    const rawPhone = phone.trim();
    if (!rawPhone) return "";
    if (rawPhone.startsWith("+")) return rawPhone;
    if (actualPrefix) {
      return `${actualPrefix}${rawPhone}`;
    }
    return rawPhone;
  }, [phone, actualPrefix]);
  const fullPhone = getFullPhone();
  const rawPhoneTrimmed = phone.trim();
  const isPhoneValid = rawPhoneTrimmed.length > 0;
  const hasNamePrefilled = !!(profile?.full_name && profile.full_name.trim().length >= 3);

  const isInfoValid =
    fullName.trim().length >= 3 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    isPhoneValid &&
    (isOtherCity || isOtherCountry ? cityManual.trim().length > 0 : city.trim().length > 0) &&
    (isOtherCountry ? countryManual.trim().length > 0 : country.trim().length > 0);

  const validateInfo = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};
    if (!fullName.trim() || fullName.trim().length < 3) {
      newErrors.fullName = t("checkout.validation.fullNameRequired");
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email)) {
      newErrors.email = t("checkout.validation.validEmailRequired");
    }
    if (!rawPhoneTrimmed) {
      newErrors.phone = t("checkout.validation.phoneRequired", "Phone number is required");
    }
    const c = isOtherCity || isOtherCountry ? cityManual.trim() : city.trim();
    if (!c) {
      newErrors.city = t("checkout.validation.cityRequired");
    }
    const cn = isOtherCountry ? countryManual.trim() : country.trim();
    if (!cn) {
      newErrors.country = t("checkout.validation.countryRequired");
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [fullName, email, phone, actualPrefix, city, cityManual, isOtherCity, country, countryManual, isOtherCountry, t]);

  // Set phone prefix and country based on detected country
  useEffect(() => {
    if (detectedCountry) {
      const code = detectedCountry.toUpperCase();
      // Auto-select phone prefix
      const found = PHONE_COUNTRIES.find((pc) => pc.code === code);
      if (found) {
        setPhonePrefix(found.prefix + "_" + found.code);
      }
      // Auto-select country dropdown (only if not already set from profile)
      if (!country && !isOtherCountry) {
        const matchedCountry = COUNTRIES.find((c) => c.code === code);
        if (matchedCountry) {
          setSelectedCountryCode(code);
          setCountry(isRTL ? matchedCountry.ar : matchedCountry.en);
          setIsOtherCountry(false);
        }
      }
    }
  }, [detectedCountry]);

  // Pre-fill from profile
  useEffect(() => {
    if (!open) return;
    if (!user) return;
    if (profile?.full_name) setFullName(profile.full_name);
    if (user?.email) setEmail(user.email);
    if (profile?.phone) {
      let rawPhone = profile.phone;
      let matchedPc: (typeof PHONE_COUNTRIES)[number] | null = null;
      for (const pc of PHONE_COUNTRIES) {
        if (rawPhone.startsWith(pc.prefix)) {
          matchedPc = pc;
          rawPhone = rawPhone.slice(pc.prefix.length);
          break;
        }
      }
      setPhone(rawPhone);
      if (matchedPc) {
        setPhonePrefix(matchedPc.prefix + "_" + matchedPc.code);
      }
    }
  }, [profile, user, open]);

  // Load profile billing data and auto-advance
  const prefillAndAutoAdvance = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;
    const data = await fetchProfileBillingData(user.id);
    if (!data) return false;

    if (data.city) setCity(data.city);
    if (data.country) setCountry(data.country);
    if (data.postal_code) setPostalCode(data.postal_code);

    // Pre-fill phone from DB if not already set from profile
    if (data.phone && !phone) {
      let rawPhone = data.phone;
      let matchedPc: (typeof PHONE_COUNTRIES)[number] | null = null;
      for (const pc of PHONE_COUNTRIES) {
        if (rawPhone.startsWith(pc.prefix)) {
          matchedPc = pc;
          rawPhone = rawPhone.slice(pc.prefix.length);
          break;
        }
      }
      setPhone(rawPhone);
      if (matchedPc) {
        setPhonePrefix(matchedPc.prefix + "_" + matchedPc.code);
      }
    }

    if (data.country) {
      const matched = COUNTRIES.find((c) => c.en === data.country || c.ar === data.country);
      if (matched) {
        setSelectedCountryCode(matched.code);
        setIsOtherCountry(false);
      } else {
        setIsOtherCountry(true);
        setCountryManual(data.country);
      }
    }

    if (data.city && data.country) {
      const matchedCountry = COUNTRIES.find((c) => c.en === data.country || c.ar === data.country);
      if (matchedCountry) {
        const cityMatch = matchedCountry.cities.find((ct) => ct.en === data.city || ct.ar === data.city);
        if (!cityMatch) {
          setIsOtherCity(true);
          setCityManual(data.city);
        }
      } else {
        setCityManual(data.city);
      }
    }

    const hasProfile =
      profile?.full_name && profile.full_name.trim().length >= 3 && user.email && (data.phone || profile?.phone);
    const hasBilling = data.city && data.country;

    return !!(hasProfile && hasBilling);
  }, [user, profile, phone]);

  const saveProfileData = useCallback(
    async (userId?: string) => {
      const targetUserId = userId || user?.id;
      if (!targetUserId) return false;
      setProfileSaving(true);
      try {
        await updateProfile(targetUserId, {
          full_name: fullName.trim(),
          phone: fullPhone,
          city: effectiveCity,
          country: effectiveCountry,
          postal_code: postalCode.trim() || null,
          profile_complete: true,
        });
        return true;
      } catch {
        return false;
      } finally {
        setProfileSaving(false);
      }
    },
    [user?.id, fullName, fullPhone, effectiveCity, effectiveCountry, postalCode],
  );

  const resetForm = useCallback(() => {
    setErrors({});
    setIsEditingName(false);
  }, []);

  return {
    // State
    fullName,
    setFullName,
    email,
    setEmail,
    phone,
    setPhone,
    city,
    setCity,
    cityManual,
    setCityManual,
    isOtherCity,
    setIsOtherCity,
    country,
    setCountry,
    countryManual,
    setCountryManual,
    isOtherCountry,
    setIsOtherCountry,
    selectedCountryCode,
    postalCode,
    setPostalCode,
    errors,
    setErrors,
    profileSaving,
    isEditingName,
    setIsEditingName,
    phonePrefix,
    setPhonePrefix,
    // Computed
    selectedCountry,
    countryOptions,
    cityOptions,
    phonePrefixOptions,
    actualPrefix,
    effectiveCity,
    effectiveCountry,
    fullPhone,
    isPhoneValid,
    isInfoValid,
    hasNamePrefilled,
    // Methods
    handleCountryChange,
    handleCityChange,
    validateInfo,
    saveProfileData,
    prefillAndAutoAdvance,
    resetForm,
  };
}
