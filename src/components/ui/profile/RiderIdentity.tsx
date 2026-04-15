import React, { useMemo, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import SearchableDropdown from "@/components/checkout/SearchableDropdown";
import { PHONE_COUNTRIES } from "@/data/phoneCountryCodes";
import { COUNTRIES, OTHER_OPTION } from "@/data/countryCityData";
import { Camera, Loader2, CalendarDays, User, Phone, Globe, Shield, SquarePen, Save, X, AlertCircle } from "lucide-react";
import { ExtendedProfile } from "@/hooks/useUserProfile";

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
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dobInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isEditingProfileInfo, setIsEditingProfileInfo] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const initialPhone = parsePhone(profile.phone);
  const initialCountry = resolveCountrySelection(profile.country);
  const initialCity = resolveCityForDisplay(profile.city, initialCountry.countryCode, isRTL);
  const [profileDraft, setProfileDraft] = useState({
    full_name: profile.full_name || "",
    rider_nickname: profile.rider_nickname || "",
    phonePrefix: initialPhone.prefix,
    phoneLocal: initialPhone.local,
    date_of_birth: profile.date_of_birth || "",
    gender: profile.gender || "",
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
    setProfileDraft({
      full_name: profile.full_name || "",
      rider_nickname: profile.rider_nickname || "",
      phonePrefix: parsedPhone.prefix,
      phoneLocal: parsedPhone.local,
      date_of_birth: profile.date_of_birth || "",
      gender: profile.gender || "",
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
  const phonePrefixOptions = useMemo(
    () =>
      PHONE_COUNTRIES.map((c) => ({
        value: `${c.prefix}_${c.code}`,
        label: `${c.prefix} ${isRTL ? c.ar : c.en}`,
      })),
    [isRTL],
  );
  const countryOptions = useMemo(
    () => [
      ...COUNTRIES.map((c) => ({ value: c.code, label: isRTL ? c.ar : c.en })),
      { value: OTHER_VALUE, label: isRTL ? OTHER_OPTION.ar : OTHER_OPTION.en },
    ],
    [isRTL],
  );
  const cityOptions = useMemo(
    () => [
      ...cities.map((c) => ({ value: isRTL ? c.ar : c.en, label: isRTL ? c.ar : c.en })),
      { value: OTHER_VALUE, label: isRTL ? OTHER_OPTION.ar : OTHER_OPTION.en },
    ],
    [cities, isRTL],
  );

  const validateProfileDraft = () => {
    const errors: Partial<Record<string, string>> = {};
    const fullName = profileDraft.full_name.trim();
    const phoneDigits = profileDraft.phoneLocal.replace(/[^0-9]/g, "");

    if (!fullName) {
      errors.full_name = isRTL ? "يرجى إدخال الاسم الكامل" : "Please enter full name";
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
      full_name: profileDraft.full_name.trim() || null,
      rider_nickname: profileDraft.rider_nickname.trim() || null,
      phone: fullPhone,
      date_of_birth: profileDraft.date_of_birth || null,
      gender: profileDraft.gender || null,
      city: savedCity,
      country: savedCountry,
    });
    setFieldErrors({});
    setIsEditingProfileInfo(false);
  };

  const completionFields = useMemo(
    () => [
      { key: "full_name", label: isRTL ? "الاسم الكامل" : "Full Name", value: profile.full_name },
      { key: "phone", label: isRTL ? "رقم الجوال" : "Phone", value: profile.phone },
      { key: "city", label: isRTL ? "المدينة" : "City", value: profile.city },
      { key: "country", label: isRTL ? "الدولة" : "Country", value: profile.country },
      { key: "date_of_birth", label: isRTL ? "تاريخ الميلاد" : "Date of Birth", value: profile.date_of_birth },
      { key: "gender", label: isRTL ? "الجنس" : "Gender", value: profile.gender },
      { key: "bike_brand", label: isRTL ? "نوع الدراجة" : "Bike Brand", value: profile.bike_brand },
      { key: "bike_model", label: isRTL ? "موديل الدراجة" : "Bike Model", value: profile.bike_model },
      { key: "avatar", label: isRTL ? "الصورة الشخصية" : "Profile Photo", value: profile.avatar_url },
    ],
    [profile, isRTL],
  );
  const filledCount = completionFields.filter((field) => Boolean(field.value)).length;
  const completionPercent = Math.round((filledCount / completionFields.length) * 100);
  const missingFields = completionFields.filter((field) => !field.value);

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

  const detailItems = [
    { key: "name", icon: User, label: isRTL ? "الاسم الكامل" : "Full Name", value: profile.full_name || "-" },
    {
      key: "nickname",
      icon: User,
      label: isRTL ? "اللقب" : "Nickname",
      value: profile.rider_nickname || "-",
      dir: "ltr" as const,
    },
    {
      key: "email",
      icon: User,
      label: isRTL ? "البريد الإلكتروني" : "Email",
      value: user?.email || "-",
      dir: isRTL ? ("rtl" as const) : ("ltr" as const),
    },
    { key: "phone", icon: Phone, label: isRTL ? "رقم الجوال" : "Phone", value: profile.phone || "-", dir: "ltr" as const },
    {
      key: "dob",
      icon: CalendarDays,
      label: isRTL ? "تاريخ الميلاد" : "Date of Birth",
      value: dobLabel || "-",
      dir: isRTL ? ("rtl" as const) : ("ltr" as const),
    },
    {
      key: "age",
      icon: CalendarDays,
      label: isRTL ? "العمر" : "Age",
      value: ageLabel || "-",
      tabular: true,
    },
    { key: "gender", icon: Shield, label: isRTL ? "الجنس" : "Gender", value: genderLabel || "-" },
    { key: "location", icon: Globe, label: isRTL ? "الموقع" : "Location", value: locationLabel || "-" },
  ] as const satisfies readonly { key: string; icon: any; label: string; value: string; tabular?: boolean; dir?: string }[];

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
        <div className="flex items-center justify-end">
          {!isEditingProfileInfo ? (
            <Button variant="outline" size="sm" className="gap-2" onClick={handleStartEdit}>
              <SquarePen className="h-4 w-4" />
              {isRTL ? "تعديل معلومات الملف" : "Edit Profile Info"}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="gap-2" onClick={() => setIsEditingProfileInfo(false)}>
                <X className="h-4 w-4" />
                {isRTL ? "إلغاء" : "Cancel"}
              </Button>
              <Button size="sm" className="gap-2" onClick={handleSaveAllProfileInfo} disabled={isUpdating}>
                <Save className="h-4 w-4" />
                {isUpdating ? (isRTL ? "جارٍ الحفظ..." : "Saving...") : isRTL ? "حفظ الكل" : "Save All"}
              </Button>
            </div>
          )}
        </div>

        {isEditingProfileInfo && (
          <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{isRTL ? "الاسم الكامل" : "Full Name"}</p>
                <Input
                  placeholder={isRTL ? "الاسم الكامل" : "Full Name"}
                  value={profileDraft.full_name}
                  onChange={(e) => {
                    setProfileDraft((prev) => ({ ...prev, full_name: e.target.value }));
                    setFieldErrors((prev) => ({ ...prev, full_name: undefined }));
                  }}
                  dir={isRTL ? "rtl" : "ltr"}
                />
                {fieldErrors.full_name && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.full_name}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{isRTL ? "اللقب" : "Nickname"}</p>
                <Input
                  placeholder={isRTL ? "اللقب" : "Nickname"}
                  value={profileDraft.rider_nickname}
                  onChange={(e) => setProfileDraft((prev) => ({ ...prev, rider_nickname: e.target.value }))}
                  dir={isRTL ? "rtl" : "ltr"}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{isRTL ? "رقم الجوال" : "Phone Number"}</p>
                <div className="flex gap-2" dir="ltr">
                  <div className="w-[120px] shrink-0">
                    <SearchableDropdown
                      options={phonePrefixOptions}
                      value={profileDraft.phonePrefix}
                      onChange={(val) => {
                        setProfileDraft((prev) => ({ ...prev, phonePrefix: val }));
                        setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                      }}
                      placeholder="+966"
                      searchPlaceholder={isRTL ? "ابحث..." : "Search..."}
                      selectedLabelBuilder={(option) => option?.value.split("_")[0] || ""}
                      dir="ltr"
                    />
                  </div>
                  <Input
                    placeholder={isRTL ? "رقم الجوال" : "Phone"}
                    value={profileDraft.phoneLocal}
                    onChange={(e) => {
                      setProfileDraft((prev) => ({ ...prev, phoneLocal: e.target.value.replace(/[^0-9]/g, "") }));
                      setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                    }}
                    dir="ltr"
                    className="flex-1"
                  />
                </div>
                {fieldErrors.phone && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.phone}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{isRTL ? "تاريخ الميلاد" : "Date of Birth"}</p>
                <Input
                  ref={dobInputRef}
                  type="date"
                  value={profileDraft.date_of_birth}
                  onChange={(e) => {
                    setProfileDraft((prev) => ({ ...prev, date_of_birth: e.target.value }));
                    setFieldErrors((prev) => ({ ...prev, date_of_birth: undefined }));
                  }}
                  onClick={() => dobInputRef.current?.showPicker?.()}
                  lang={isRTL ? "ar-SA" : "en-US"}
                  dir={isRTL ? "rtl" : "ltr"}
                  className={`cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 ${
                    isRTL ? "text-right" : "text-left"
                  }`}
                />
                {fieldErrors.date_of_birth && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.date_of_birth}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{isRTL ? "الجنس" : "Gender"}</p>
                <Select
                  value={profileDraft.gender || "unset"}
                  onValueChange={(value) => setProfileDraft((prev) => ({ ...prev, gender: value === "unset" ? "" : value }))}
                  dir={isRTL ? "rtl" : "ltr"}
                >
                  <SelectTrigger className={isRTL ? "text-right" : "text-left"}>
                    <SelectValue placeholder={isRTL ? "الجنس" : "Gender"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">{isRTL ? "غير محدد" : "Not set"}</SelectItem>
                    <SelectItem value="Male">{isRTL ? "ذكر" : "Male"}</SelectItem>
                    <SelectItem value="Female">{isRTL ? "أنثى" : "Female"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{isRTL ? "الدولة" : "Country"}</p>
                <SearchableDropdown
                  options={countryOptions}
                  value={profileDraft.countryCode}
                   onChange={(val) => {
                    setProfileDraft((prev) => ({
                      ...prev,
                      countryCode: val,
                      city: "",
                      customCity: "",
                    }));
                    setFieldErrors((prev) => ({ ...prev, country: undefined, city: undefined }));
                  }
                  }
                  placeholder={isRTL ? "الدولة" : "Country"}
                  searchPlaceholder={isRTL ? "ابحث..." : "Search..."}
                  dir={isRTL ? "rtl" : "ltr"}
                />
                {fieldErrors.country && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.country}
                  </p>
                )}
              </div>
              {isOtherCountry ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{isRTL ? "اسم الدولة" : "Country Name"}</p>
                  <Input
                    placeholder={isRTL ? "اسم الدولة" : "Country name"}
                    value={profileDraft.customCountry}
                    onChange={(e) => {
                      setProfileDraft((prev) => ({ ...prev, customCountry: e.target.value }));
                      setFieldErrors((prev) => ({ ...prev, country: undefined }));
                    }}
                    dir={isRTL ? "rtl" : "ltr"}
                  />
                </div>
              ) : hasCities ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{isRTL ? "المدينة" : "City"}</p>
                  <SearchableDropdown
                    options={cityOptions}
                    value={profileDraft.city}
                    onChange={(val) => {
                      setProfileDraft((prev) => ({ ...prev, city: val }));
                      setFieldErrors((prev) => ({ ...prev, city: undefined }));
                    }}
                    placeholder={isRTL ? "المدينة" : "City"}
                    searchPlaceholder={isRTL ? "ابحث..." : "Search..."}
                    dir={isRTL ? "rtl" : "ltr"}
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{isRTL ? "المدينة" : "City"}</p>
                  <Input
                    placeholder={isRTL ? "المدينة" : "City"}
                    value={profileDraft.city}
                    onChange={(e) => {
                      setProfileDraft((prev) => ({ ...prev, city: e.target.value }));
                      setFieldErrors((prev) => ({ ...prev, city: undefined }));
                    }}
                    dir={isRTL ? "rtl" : "ltr"}
                  />
                </div>
              )}
              {(isOtherCountry || isOtherCity) && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{isRTL ? "اسم المدينة" : "City Name"}</p>
                  <Input
                    placeholder={isRTL ? "اسم المدينة" : "City name"}
                    value={profileDraft.customCity}
                    onChange={(e) => {
                      setProfileDraft((prev) => ({ ...prev, customCity: e.target.value }));
                      setFieldErrors((prev) => ({ ...prev, city: undefined }));
                    }}
                    dir={isRTL ? "rtl" : "ltr"}
                  />
                </div>
              )}
              {fieldErrors.city && (
                <div className="md:col-span-3">
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.city}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {detailItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.key} className="rounded-xl border border-border/60 bg-card/50 px-3 py-3">
                <div className="flex items-center gap-3 min-h-[56px]">
                  <div className="h-10 w-10 shrink-0 rounded-lg border border-border/60 bg-muted/50 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
                    <p
                      className={`mt-1 text-sm font-semibold text-foreground break-words ${
                        item.tabular ? "tabular-nums" : ""
                      }`}
                      dir={item.dir}
                    >
                      {item.value}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {completionPercent < 100 && (
        <div className="space-y-3">
          <Separator className="my-4" />
          <div className="space-y-2">
            <div className="flex justify-between">
              <p className="text-sm text-muted-foreground">{isRTL ? "اكتمال الملف الشخصي" : "Profile Completion"}</p>
              <span className="text-sm font-semibold tabular-nums" dir="ltr">
                {completionPercent}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-2 bg-primary rounded-full transition-all" style={{ width: `${completionPercent}%` }} />
            </div>
          </div>
          {missingFields.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {isRTL ? "معلومات ناقصة (اضغط لإضافتها):" : "Missing information (click to add):"}
              </p>
              <div className="flex flex-wrap gap-2">
                {missingFields.map((field) => (
                  <button
                    key={field.key}
                    type="button"
                    className="inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-foreground hover:bg-muted transition-colors"
                    onClick={() => {
                      if (field.key === "avatar") {
                        fileInputRef.current?.click();
                        return;
                      }
                      const accountSettings = document.getElementById("account-settings");
                      accountSettings?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    {field.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
