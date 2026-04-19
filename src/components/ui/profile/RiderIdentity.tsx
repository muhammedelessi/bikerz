import React, { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { FormField } from "@/components/ui/form-field";
import { PHONE_COUNTRIES } from "@/data/phoneCountryCodes";
import { COUNTRIES } from "@/data/countryCityData";
import { Camera, Loader2, CalendarDays, User, Phone, Mail, Globe, Shield, SquarePen, Save, X, AtSign, MapPin, Bike, Plus, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountryCityPicker, GenderPicker, DateOfBirthPicker, PhoneField, NationalityPicker } from "@/components/ui/fields";
import { ExtendedProfile } from "@/hooks/useUserProfile";
import { splitFullName, joinFullName } from "@/lib/nameUtils";

interface RiderIdentityProps {
  profile: ExtendedProfile;
  onUpdate: (updates: Partial<ExtendedProfile>) => Promise<void>;
  onAvatarUpload: (file: File) => Promise<string | null>;
  isUpdating: boolean;
}

const OTHER_VALUE = "__other__";

function parsePhone(fullPhone: string | null | undefined): { prefix: string; local: string } {
  if (!fullPhone) return { prefix: "+966_SA", local: "" };
  const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const c of sorted) {
    if (fullPhone.startsWith(c.prefix)) {
      return { prefix: `${c.prefix}_${c.code}`, local: fullPhone.slice(c.prefix.length) };
    }
  }
  return { prefix: "+966_SA", local: fullPhone.replace(/^\+/, "") };
}

function resolveCountrySelection(countryValue: string | null | undefined): { countryCode: string; customCountry: string } {
  if (!countryValue) return { countryCode: "SA", customCountry: "" };
  const countryEntry = COUNTRIES.find(
    (c) => c.code === countryValue || c.en === countryValue || c.ar === countryValue,
  );
  if (countryEntry) {
    return { countryCode: countryEntry.code, customCountry: "" };
  }
  return { countryCode: OTHER_VALUE, customCountry: countryValue };
}

function resolveCityForDisplay(
  cityValue: string | null | undefined,
  countryCode: string,
  isRTL: boolean,
): { city: string; customCity: string } {
  if (!cityValue) return { city: "", customCity: "" };
  const countryEntry = COUNTRIES.find((c) => c.code === countryCode);
  if (!countryEntry) return { city: cityValue, customCity: "" };

  const cityEntry = countryEntry.cities.find((c) => c.en === cityValue || c.ar === cityValue);
  if (cityEntry) {
    return { city: isRTL ? cityEntry.ar : cityEntry.en, customCity: "" };
  }
  return { city: cityValue, customCity: "" };
}

export const RiderIdentity: React.FC<RiderIdentityProps> = ({
  profile,
  onUpdate,
  onAvatarUpload,
  isUpdating,
}) => {
  const { isRTL } = useLanguage();
  const { t } = useTranslation();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isEditingProfileInfo, setIsEditingProfileInfo] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const initialPhone = parsePhone(profile.phone);
  const initialCountry = resolveCountrySelection(profile.country);
  const initialCity = resolveCityForDisplay(profile.city, initialCountry.countryCode, isRTL);
  const { firstName: initFirst, lastName: initLast } = splitFullName(profile.full_name);
  const [profileDraft, setProfileDraft] = useState({
    firstName: initFirst,
    lastName: initLast,
    rider_nickname: profile.rider_nickname || "",
    phonePrefix: initialPhone.prefix,
    phoneLocal: initialPhone.local,
    date_of_birth: profile.date_of_birth || "",
    gender: profile.gender || "",
    nationality: profile.nationality || "",
    countryCode: initialCountry.countryCode,
    city: initialCity.city,
    customCountry: initialCountry.customCountry,
    customCity: initialCity.customCity,
  });

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    await onAvatarUpload(file);
    setIsUploadingAvatar(false);
  };

  const handleStartEdit = () => {
    const parsedPhone = parsePhone(profile.phone);
    const selectedCountry = resolveCountrySelection(profile.country);
    const resolvedCity = resolveCityForDisplay(profile.city, selectedCountry.countryCode, isRTL);
    const { firstName, lastName } = splitFullName(profile.full_name);
    setProfileDraft({
      firstName,
      lastName,
      rider_nickname: profile.rider_nickname || "",
      phonePrefix: parsedPhone.prefix,
      phoneLocal: parsedPhone.local,
      date_of_birth: profile.date_of_birth || "",
      gender: profile.gender || "",
      nationality: profile.nationality || "",
      countryCode: selectedCountry.countryCode,
      city: resolvedCity.city,
      customCountry: selectedCountry.customCountry,
      customCity: resolvedCity.customCity,
    });
    setFieldErrors({});
    setIsEditingProfileInfo(true);
  };

  const selectedCountryEntry = useMemo(
    () => COUNTRIES.find((c) => c.code === profileDraft.countryCode),
    [profileDraft.countryCode],
  );
  const isOtherCountry = profileDraft.countryCode === OTHER_VALUE;
  const cities = useMemo(() => selectedCountryEntry?.cities || [], [selectedCountryEntry]);
  const hasCities = cities.length > 0 && !isOtherCountry;
  const isOtherCity = profileDraft.city === OTHER_VALUE;

  const validateProfileDraft = () => {
    const errors: Partial<Record<string, string>> = {};
    const phoneDigits = profileDraft.phoneLocal.replace(/[^0-9]/g, "");

    if (!profileDraft.firstName.trim()) {
      errors.firstName = t("validation.firstNameRequired");
    }
    if (!profileDraft.lastName.trim()) {
      errors.lastName = t("validation.lastNameRequired");
    }
    if (!phoneDigits) {
      errors.phone = isRTL ? "يرجى إدخال رقم الهاتف" : "Please enter phone number";
    } else if (phoneDigits.length < 7) {
      errors.phone = isRTL ? "رقم الهاتف قصير جداً (7 أرقام على الأقل)" : "Phone number too short (min 7 digits)";
    } else if (phoneDigits.length > 15) {
      errors.phone = isRTL ? "رقم الهاتف طويل جداً (15 رقم كحد أقصى)" : "Phone number too long (max 15 digits)";
    }

    if (isOtherCountry) {
      if (!profileDraft.customCountry.trim()) {
        errors.country = isRTL ? "يرجى إدخال اسم الدولة" : "Please enter country name";
      }
      if (!profileDraft.customCity.trim()) {
        errors.city = isRTL ? "يرجى إدخال اسم المدينة" : "Please enter city name";
      }
    } else {
      if (!profileDraft.countryCode.trim()) {
        errors.country = isRTL ? "يرجى اختيار الدولة" : "Please select country";
      }
      if (hasCities) {
        if (!profileDraft.city) {
          errors.city = isRTL ? "يرجى اختيار المدينة" : "Please select city";
        } else if (isOtherCity && !profileDraft.customCity.trim()) {
          errors.city = isRTL ? "يرجى إدخال اسم المدينة" : "Please enter city name";
        }
      } else if (!profileDraft.city.trim()) {
        errors.city = isRTL ? "يرجى إدخال اسم المدينة" : "Please enter city name";
      }
    }

    if (profileDraft.date_of_birth) {
      const selectedDate = new Date(profileDraft.date_of_birth);
      const minDate = new Date("1920-01-01");
      const today = new Date();
      if (Number.isNaN(selectedDate.getTime())) {
        errors.date_of_birth = isRTL ? "تاريخ الميلاد غير صالح" : "Invalid date of birth";
      } else if (selectedDate > today) {
        errors.date_of_birth = isRTL ? "تاريخ الميلاد لا يمكن أن يكون في المستقبل" : "Date of birth cannot be in the future";
      } else if (selectedDate < minDate) {
        errors.date_of_birth = isRTL ? "تاريخ الميلاد غير منطقي" : "Date of birth is too old";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveAllProfileInfo = async () => {
    if (!validateProfileDraft()) return;

    const prefix = profileDraft.phonePrefix.split("_")[0];
    const digits = profileDraft.phoneLocal.replace(/[^0-9]/g, "");
    const cleanedPhone = digits.startsWith("0") ? digits.slice(1) : digits;
    const fullPhone = cleanedPhone ? `${prefix}${cleanedPhone}` : null;
    const savedCountry = isOtherCountry
      ? profileDraft.customCountry.trim() || null
      : selectedCountryEntry
        ? selectedCountryEntry.code
        : null;
    const savedCity =
      isOtherCountry || !hasCities
        ? profileDraft.customCity.trim() || profileDraft.city.trim() || null
        : isOtherCity
          ? profileDraft.customCity.trim() || null
          : selectedCountryEntry?.cities.find((c) => c.ar === profileDraft.city || c.en === profileDraft.city)?.en ||
            profileDraft.city ||
            null;

    await onUpdate({
      full_name: joinFullName(profileDraft.firstName, profileDraft.lastName) || null,
      rider_nickname: profileDraft.rider_nickname.trim() || null,
      phone: fullPhone,
      date_of_birth: profileDraft.date_of_birth || null,
      gender: profileDraft.gender || null,
      nationality: profileDraft.nationality || null,
      city: savedCity,
      country: savedCountry,
    });
    setFieldErrors({});
    setIsEditingProfileInfo(false);
  };

  const missingFields = useMemo(() => [
    {
      key: "rider_nickname",
      condition: !profile.rider_nickname,
      label_ar: "اللقب", label_en: "Nickname",
      hint_ar: "أضف لقبك", hint_en: "Add your nickname",
      icon: AtSign, section: "identity",
    },
    {
      key: "date_of_birth",
      condition: !profile.date_of_birth,
      label_ar: "تاريخ الميلاد", label_en: "Date of Birth",
      hint_ar: "أضف تاريخ ميلادك", hint_en: "Add your date of birth",
      icon: CalendarDays, section: "identity",
    },
    {
      key: "city",
      condition: !profile.city || !profile.country,
      label_ar: "الموقع", label_en: "Location",
      hint_ar: "أضف مدينتك ودولتك", hint_en: "Add your city and country",
      icon: MapPin, section: "identity",
    },
    {
      key: "phone",
      condition: !profile.phone,
      label_ar: "رقم الهاتف", label_en: "Phone",
      hint_ar: "أضف رقم هاتفك", hint_en: "Add your phone number",
      icon: Phone, section: "contact",
    },
    {
      key: "bike",
      condition: !profile.bike_brand && (!profile.bike_entries || profile.bike_entries.length === 0),
      label_ar: "الدراجة", label_en: "Bike",
      hint_ar: "أضف دراجتك", hint_en: "Add your bike",
      icon: Bike, section: "bike",
    },
    {
      key: "gender",
      condition: !profile.gender,
      label_ar: "الجنس", label_en: "Gender",
      hint_ar: "أضف جنسك", hint_en: "Add your gender",
      icon: User, section: "identity",
    },
    {
      key: "nationality",
      condition: !profile.nationality,
      label_ar: "الجنسية", label_en: "Nationality",
      hint_ar: "أضف جنسيتك", hint_en: "Add your nationality",
      icon: Globe, section: "identity",
    },
    {
      key: "avatar",
      condition: !profile.avatar_url,
      label_ar: "الصورة الشخصية", label_en: "Profile Photo",
      hint_ar: "أضف صورة شخصية", hint_en: "Add a profile photo",
      icon: Camera, section: "identity",
    },
  ].filter((f) => f.condition), [profile]);

  const totalFields = 8;
  const completionPercent = Math.round(((totalFields - missingFields.length) / totalFields) * 100);

  const scrollToSection = (section: string) => {
    if (section === "identity") { handleStartEdit(); return; }
    const el = document.getElementById(`profile-section-${section}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("ring-2", "ring-primary/30", "rounded-xl");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary/30", "rounded-xl"), 2000);
    }
  };

  const locationLabel = useMemo(() => {
    if (!profile.city && !profile.country) return null;
    let countryLabel = profile.country || "";
    let cityLabel = profile.city || "";
    const countryEntry = COUNTRIES.find(
      (c) => c.en === profile.country || c.ar === profile.country || c.code === profile.country,
    );
    if (countryEntry) {
      countryLabel = isRTL ? countryEntry.ar : countryEntry.en;
      if (profile.city) {
        const cityEntry = countryEntry.cities.find((c) => c.en === profile.city || c.ar === profile.city);
        if (cityEntry) {
          cityLabel = isRTL ? cityEntry.ar : cityEntry.en;
        }
      }
    }
    return [cityLabel, countryLabel].filter(Boolean).join(isRTL ? "، " : ", ");
  }, [profile.city, profile.country, isRTL]);

  const ageLabel = useMemo(() => {
    if (!profile.date_of_birth) return null;
    const birthDate = new Date(profile.date_of_birth);
    const now = new Date();
    let age = now.getFullYear() - birthDate.getFullYear();
    const monthDiff = now.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
      age -= 1;
    }
    if (Number.isNaN(age) || age < 0) return null;
    return `${age} ${isRTL ? "سنة" : "yrs old"}`;
  }, [profile.date_of_birth, isRTL]);
  const dobLabel = useMemo(() => {
    if (!profile.date_of_birth) return null;
    const date = new Date(profile.date_of_birth);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(isRTL ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  }, [profile.date_of_birth, isRTL]);

  const genderLabel = useMemo(() => {
    if (!profile.gender) return null;
    if (!isRTL) return profile.gender;
    return profile.gender === "Male" ? "ذكر" : profile.gender === "Female" ? "أنثى" : profile.gender;
  }, [profile.gender, isRTL]);


  return (
    <div className="card-premium p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative">
          <Avatar className="h-28 w-28 ring-4 ring-primary/15 border-2 border-background shadow-md mx-auto overflow-hidden">
            <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name || "User"} className="object-cover" />
            <AvatarFallback className="text-2xl sm:text-3xl bg-primary/10 text-primary">
              {profile.full_name?.charAt(0) || profile.rider_nickname?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />

          <Button
            size="icon"
            variant="secondary"
            className="absolute bottom-0 end-0 rounded-full w-7 h-7"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingAvatar}
          >
            {isUploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          </Button>
        </div>

        <div className="min-w-0 text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-foreground">{profile.full_name || "-"}</h2>
        </div>
      </div>

      <div className="space-y-3">
        <Separator />

        {isEditingProfileInfo && (
          <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-5">
            {/* Name + Nickname */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label={t("fields.firstName.label")} error={fieldErrors.firstName} required>
                <Input
                  value={profileDraft.firstName}
                  onChange={(e) => {
                    setProfileDraft((prev) => ({ ...prev, firstName: e.target.value }));
                    setFieldErrors((prev) => ({ ...prev, firstName: undefined }));
                  }}
                  placeholder={t("fields.firstName.placeholder")}
                  className={fieldErrors.firstName ? "border-destructive" : ""}
                  autoComplete="given-name"
                />
              </FormField>
              <FormField label={t("fields.lastName.label")} error={fieldErrors.lastName} required>
                <Input
                  value={profileDraft.lastName}
                  onChange={(e) => {
                    setProfileDraft((prev) => ({ ...prev, lastName: e.target.value }));
                    setFieldErrors((prev) => ({ ...prev, lastName: undefined }));
                  }}
                  placeholder={t("fields.lastName.placeholder")}
                  className={fieldErrors.lastName ? "border-destructive" : ""}
                  autoComplete="family-name"
                />
              </FormField>
              <FormField label={isRTL ? "اللقب" : "Nickname"}>
                <Input
                  value={profileDraft.rider_nickname}
                  onChange={(e) => setProfileDraft((prev) => ({ ...prev, rider_nickname: e.target.value }))}
                  placeholder={isRTL ? "اللقب" : "Nickname"}
                />
              </FormField>
            </div>

            {/* Phone */}
            <PhoneField
              phonePrefix={profileDraft.phonePrefix}
              phoneNumber={profileDraft.phoneLocal}
              onPrefixChange={(val) => {
                setProfileDraft((prev) => ({ ...prev, phonePrefix: val }));
                setFieldErrors((prev) => ({ ...prev, phone: undefined }));
              }}
              onNumberChange={(val) => {
                setProfileDraft((prev) => ({ ...prev, phoneLocal: val }));
                setFieldErrors((prev) => ({ ...prev, phone: undefined }));
              }}
              error={fieldErrors.phone}
            />

            {/* DOB, Gender & Nationality */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <DateOfBirthPicker
                value={profileDraft.date_of_birth}
                onChange={(date) => {
                  setProfileDraft((prev) => ({ ...prev, date_of_birth: date || "" }));
                  setFieldErrors((prev) => ({ ...prev, date_of_birth: undefined }));
                }}
                error={fieldErrors.date_of_birth}
              />
              <GenderPicker
                value={profileDraft.gender}
                onChange={(value) => setProfileDraft((prev) => ({ ...prev, gender: value }))}
              />
              <NationalityPicker
                value={profileDraft.nationality}
                onChange={(value) => setProfileDraft((prev) => ({ ...prev, nationality: value }))}
              />
            </div>

            {/* Country & City */}
            <CountryCityPicker
              country={profileDraft.countryCode}
              city={profileDraft.city}
              onCountryChange={(val) => {
                setProfileDraft((prev) => ({ ...prev, countryCode: val, city: "", customCity: "" }));
                setFieldErrors((prev) => ({ ...prev, country: undefined, city: undefined }));
              }}
              onCityChange={(val) => {
                setProfileDraft((prev) => ({ ...prev, city: val }));
                setFieldErrors((prev) => ({ ...prev, city: undefined }));
              }}
              customCountry={profileDraft.customCountry}
              onCustomCountryChange={(val) => {
                setProfileDraft((prev) => ({ ...prev, customCountry: val }));
                setFieldErrors((prev) => ({ ...prev, country: undefined }));
              }}
              customCity={profileDraft.customCity}
              onCustomCityChange={(val) => {
                setProfileDraft((prev) => ({ ...prev, customCity: val }));
                setFieldErrors((prev) => ({ ...prev, city: undefined }));
              }}
              countryError={fieldErrors.country}
              cityError={fieldErrors.city}
            />
          </div>
        )}

        {/* ── Profile Info Section ── */}
        {(profile.rider_nickname || profile.date_of_birth || genderLabel || locationLabel || profile.nationality) && (
          <div className="rounded-xl border border-border/60 bg-card/50 overflow-hidden">
            <div className="px-3 py-2 border-b border-border/40 bg-muted/30 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-1">
                {isRTL ? "المعلومات الشخصية" : "Personal Info"}
              </p>
              {!isEditingProfileInfo ? (
                <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={handleStartEdit}>
                  <SquarePen className="h-3.5 w-3.5" />
                  {isRTL ? "تعديل" : "Edit"}
                </Button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs" onClick={() => setIsEditingProfileInfo(false)}>
                    <X className="h-3.5 w-3.5" />
                    {isRTL ? "إلغاء" : "Cancel"}
                  </Button>
                  <Button size="sm" className="h-7 px-2 gap-1 text-xs" onClick={handleSaveAllProfileInfo} disabled={isUpdating}>
                    <Save className="h-3.5 w-3.5" />
                    {isUpdating ? (isRTL ? "حفظ..." : "Saving...") : isRTL ? "حفظ" : "Save"}
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y divide-border/20 sm:divide-y-0">
              {/* Row 1: Nickname + DOB */}
              {profile.rider_nickname && (
                <div className={cn(
                  "flex items-center gap-3 px-3 py-3",
                  "border-b border-border/20 sm:border-b sm:border-e sm:border-border/20 rtl:sm:border-e-0 rtl:sm:border-s",
                )}>
                  <div className="h-10 w-10 shrink-0 rounded-lg border border-border/60 bg-muted/50 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {isRTL ? "اللقب" : "Nickname"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground" dir="ltr">
                      {profile.rider_nickname}
                    </p>
                  </div>
                </div>
              )}

              {profile.date_of_birth && (
                <div className={cn(
                  "flex items-center gap-3 px-3 py-3",
                  (genderLabel || locationLabel) && "border-b border-border/20",
                )}>
                  <div className="h-10 w-10 shrink-0 rounded-lg border border-border/60 bg-muted/50 flex items-center justify-center">
                    <CalendarDays className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {isRTL ? "تاريخ الميلاد / العمر" : "Date of Birth / Age"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {dobLabel}
                    </p>
                    {ageLabel && (
                      <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">{ageLabel}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Row 2: Gender + Location */}
              {genderLabel && (
                <div className={cn(
                  "flex items-center gap-3 px-3 py-3",
                  locationLabel && "border-b border-border/20 sm:border-b-0",
                  "sm:border-e sm:border-border/20 rtl:sm:border-e-0 rtl:sm:border-s",
                )}>
                  <div className="h-10 w-10 shrink-0 rounded-lg border border-border/60 bg-muted/50 flex items-center justify-center">
                    <Shield className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {isRTL ? "الجنس" : "Gender"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {genderLabel}
                    </p>
                  </div>
                </div>
              )}

              {locationLabel && (
                <div className={cn(
                  "flex items-center gap-3 px-3 py-3",
                  profile.nationality && "border-b border-border/20 sm:border-b-0",
                  profile.nationality && "sm:border-e sm:border-border/20 rtl:sm:border-e-0 rtl:sm:border-s",
                )}>
                  <div className="h-10 w-10 shrink-0 rounded-lg border border-border/60 bg-muted/50 flex items-center justify-center">
                    <Globe className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {isRTL ? "الموقع" : "Location"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground break-words">
                      {locationLabel}
                    </p>
                  </div>
                </div>
              )}

              {/* Nationality */}
              {profile.nationality && (
                <div className="flex items-center gap-3 px-3 py-3">
                  <div className="h-10 w-10 shrink-0 rounded-lg border border-border/60 bg-muted/50 flex items-center justify-center">
                    <Globe className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {isRTL ? "الجنسية" : "Nationality"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {COUNTRIES.find((c) => c.code === profile.nationality)?.[isRTL ? "ar" : "en"] || profile.nationality}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Contact Info Section ── */}
        {(user?.email || profile.phone) && (
          <div className="rounded-xl border border-border/60 bg-card/50 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-border/40 bg-muted/30 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {isRTL ? "معلومات التواصل" : "Contact Info"}
              </p>
            </div>

            <div className={cn(
              "grid",
              user?.email && profile.phone
                ? "grid-cols-1 sm:grid-cols-2 sm:divide-x sm:divide-border/20 rtl:sm:divide-x-reverse"
                : "grid-cols-1",
            )}>
              {user?.email && (
                <div className={cn(
                  "flex items-center gap-3 px-3 py-3",
                  profile.phone && "border-b border-border/20 sm:border-b-0",
                )}>
                  <div className="h-10 w-10 shrink-0 rounded-lg border border-border/60 bg-muted/50 flex items-center justify-center">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {isRTL ? "البريد الإلكتروني" : "Email"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground truncate" dir="ltr">
                      {user.email}
                    </p>
                  </div>
                </div>
              )}

              {profile.phone && (
                <div className="flex items-center gap-3 px-3 py-3">
                  <div className="h-10 w-10 shrink-0 rounded-lg border border-border/60 bg-muted/50 flex items-center justify-center">
                    <Phone className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {isRTL ? "رقم الجوال" : "Phone"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground" dir="ltr">
                      {profile.phone}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <Separator />

        {/* Completion bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{isRTL ? "اكتمال الملف الشخصي" : "Profile Completion"}</p>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground" dir="ltr">{completionPercent}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-1.5 rounded-full transition-all duration-500",
                completionPercent === 100 ? "bg-emerald-500" : "bg-primary",
              )}
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>

        {/* Missing field chips */}
        {missingFields.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {isRTL ? "يرجى إضافة:" : "Please complete:"}
            </p>
            <div className="flex flex-wrap gap-2">
              {missingFields.map((field) => {
                const Icon = field.icon;
                return (
                  <button
                    key={field.key}
                    type="button"
                    onClick={() => {
                      if (field.key === "avatar") { fileInputRef.current?.click(); return; }
                      scrollToSection(field.section);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-dashed border-primary/40 bg-primary/5 text-xs text-primary hover:bg-primary/10 hover:border-primary/60 transition-all group"
                  >
                    <Icon className="w-3 h-3 shrink-0" />
                    {isRTL ? field.hint_ar : field.hint_en}
                    <Plus className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            {isRTL ? "أحسنت! ملفك الشخصي مكتمل" : "Good work! Your profile is complete"}
          </div>
        )}
      </div>
    </div>
  );
};
