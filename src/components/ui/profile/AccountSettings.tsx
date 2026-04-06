import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import LogoutConfirmDialog from "@/components/common/LogoutConfirmDialog";
import SearchableDropdown from "@/components/checkout/SearchableDropdown";
import { cn } from "@/lib/utils";
import { PHONE_COUNTRIES } from "@/data/phoneCountryCodes";
import { COUNTRIES, OTHER_OPTION } from "@/data/countryCityData";
import {
  Settings,
  Mail,
  Phone,
  Lock,
  CreditCard,
  Smartphone,
  LogOut,
  Edit2,
  Check,
  X,
  Loader2,
  Eye,
  EyeOff,
  CalendarIcon,
  User,
  Globe,
  MapPin,
  AlertCircle,
} from "lucide-react";
import { ExtendedProfile } from "@/hooks/useUserProfile";

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

interface AccountSettingsProps {
  profile: ExtendedProfile;
  onUpdate: (updates: Partial<ExtendedProfile>) => Promise<void>;
  isUpdating: boolean;
}

export const AccountSettings: React.FC<AccountSettingsProps> = ({ profile, onUpdate, isUpdating }) => {
  const { isRTL } = useLanguage();
  const { user, signOut } = useAuth();

  // Phone
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phonePrefix, setPhonePrefix] = useState(() => parsePhone(profile.phone).prefix);
  const [phoneLocal, setPhoneLocal] = useState(() => parsePhone(profile.phone).local);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Country
  const [isEditingCountry, setIsEditingCountry] = useState(false);
  const [country, setCountry] = useState(() => {
    const match = COUNTRIES.find(
      (c) => c.en === profile.country || c.ar === profile.country || c.code === profile.country,
    );
    return match ? match.code : profile.country ? OTHER_VALUE : "SA";
  });
  const [customCountry, setCustomCountry] = useState(
    COUNTRIES.find((c) => c.en === profile.country || c.ar === profile.country) ? "" : profile.country || "",
  );
  const [countrySearch, setCountrySearch] = useState("");

  // City
  const [isEditingCity, setIsEditingCity] = useState(false);
  const [city, setCity] = useState(profile.city || "");
  const [customCity, setCustomCity] = useState("");
  const [citySearch, setCitySearch] = useState("");

  // Gender
  const [isEditingGender, setIsEditingGender] = useState(false);
  const [gender, setGender] = useState(profile.gender || "");

  // DOB
  const [isEditingDob, setIsEditingDob] = useState(false);
  const [dob, setDob] = useState<Date | undefined>(profile.date_of_birth ? new Date(profile.date_of_birth) : undefined);

  // Password
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ newPassword: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  const isOtherCountry = country === OTHER_VALUE;
  const isOtherCity = city === OTHER_VALUE;

  const selectedCountryEntry = useMemo(() => COUNTRIES.find((c) => c.code === country), [country]);

  const cities = useMemo(() => selectedCountryEntry?.cities || [], [selectedCountryEntry]);
  const hasCities = cities.length > 0 && !isOtherCountry;

  const phonePrefixOptions = useMemo(
    () =>
      PHONE_COUNTRIES.map((c) => ({
        value: `${c.prefix}_${c.code}`,
        label: `${c.prefix} ${isRTL ? c.ar : c.en}`,
      })),
    [isRTL],
  );

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const q = countrySearch.toLowerCase();
    return COUNTRIES.filter((c) => c.en.toLowerCase().includes(q) || c.ar.includes(q));
  }, [countrySearch]);

  const filteredCities = useMemo(() => {
    if (!citySearch.trim()) return cities;
    const q = citySearch.toLowerCase();
    return cities.filter((c) => c.en.toLowerCase().includes(q) || c.ar.includes(q));
  }, [cities, citySearch]);

  const countryOptions = useMemo(
    () => [
      ...filteredCountries.map((c) => ({ value: c.code, label: isRTL ? c.ar : c.en })),
      { value: OTHER_VALUE, label: isRTL ? "أخرى" : "Other" },
    ],
    [filteredCountries, isRTL],
  );

  const cityOptions = useMemo(
    () => [
      ...filteredCities.map((c) => ({ value: isRTL ? c.ar : c.en, label: isRTL ? c.ar : c.en })),
      { value: OTHER_VALUE, label: isRTL ? "أخرى" : "Other" },
    ],
    [filteredCities, isRTL],
  );

  const validatePhone = (val: string) => {
    const digits = val.replace(/[^0-9]/g, "");
    if (digits.length < 7) {
      setPhoneError(isRTL ? "رقم الهاتف قصير جداً (7 أرقام على الأقل)" : "Phone too short (min 7 digits)");
      return false;
    }
    if (digits.length > 15) {
      setPhoneError(isRTL ? "رقم الهاتف طويل جداً (15 رقم كحد أقصى)" : "Phone too long (max 15 digits)");
      return false;
    }
    setPhoneError(null);
    return true;
  };

  const handleSavePhone = async () => {
    if (!validatePhone(phoneLocal)) return;
    const prefix = phonePrefix.split("_")[0];
    const fullPhone = `${prefix}${phoneLocal.replace(/[^0-9]/g, "")}`;
    await onUpdate({ phone: fullPhone });
    setIsEditingPhone(false);
    setPhoneError(null);
  };

  const handleSaveCountry = async () => {
    const countryName = isOtherCountry
      ? customCountry.trim()
      : selectedCountryEntry
        ? isRTL
          ? selectedCountryEntry.ar
          : selectedCountryEntry.en
        : "";
    await onUpdate({ country: countryName });
    setIsEditingCountry(false);
  };

  const handleSaveCity = async () => {
    const cityName = isOtherCity || isOtherCountry ? customCity.trim() : city;
    await onUpdate({ city: cityName });
    setIsEditingCity(false);
  };

  const handleSaveGender = async (value: string) => {
    setGender(value);
    await onUpdate({ gender: value || null });
    setIsEditingGender(false);
  };

  const handleSaveDob = async (date: Date | undefined) => {
    setDob(date);
    if (date) {
      await onUpdate({ date_of_birth: format(date, "yyyy-MM-dd") });
    }
    setIsEditingDob(false);
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error(isRTL ? "كلمات المرور غير متطابقة" : "Passwords do not match");
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error(isRTL ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters");
      return;
    }
    setIsPasswordLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("self-update-password", {
        body: { new_password: passwordData.newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(isRTL ? "تم تغيير كلمة المرور بنجاح" : "Password changed successfully");
      setIsChangingPassword(false);
      setPasswordData({ newPassword: "", confirmPassword: "" });
    } catch {
      toast.error(isRTL ? "فشل في تغيير كلمة المرور" : "Failed to change password");
    } finally {
      setIsPasswordLoading(false);
    }
  };

  return (
    <div className="card-premium p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Settings className="w-5 h-5 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">{isRTL ? "الحساب والإعدادات" : "Account & Settings"}</h3>
      </div>

      {/* Grid layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Email — read only */}
        <div className="bg-muted/20 rounded-lg p-3 border border-border/40">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <Label className="text-xs text-muted-foreground">{isRTL ? "البريد الإلكتروني" : "Email"}</Label>
          </div>
          <p className="text-foreground font-medium truncate text-sm">{user?.email}</p>
        </div>

        {/* Phone */}
        <div className="bg-muted/20 rounded-lg p-3 border border-border/40">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <Label
                dir="ltr"
                style={{ textAlign: isRTL ? "right" : "left" }}
                className="text-xs text-muted-foreground"
              >
                {isRTL ? "رقم الهاتف" : "Phone Number"}
              </Label>
            </div>
            {!isEditingPhone && (
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsEditingPhone(true)}>
                <Edit2 className="w-3 h-3" />
              </Button>
            )}
          </div>
          {isEditingPhone ? (
            <div className="space-y-2">
              <div className="flex gap-2" dir="ltr">
                <div className="w-36 flex-shrink-0">
                  <SearchableDropdown
                    options={phonePrefixOptions}
                    value={phonePrefix}
                    onChange={(val) => {
                      setPhonePrefix(val);
                      setPhoneError(null);
                    }}
                    placeholder="+966"
                    searchPlaceholder={isRTL ? "بحث..." : "Search..."}
                    dir="ltr"
                  />
                </div>
                <Input
                  type="tel"
                  value={phoneLocal}
                  onChange={(e) => {
                    setPhoneLocal(e.target.value.replace(/[^0-9]/g, ""));
                    setPhoneError(null);
                  }}
                  placeholder={isRTL ? "رقم الهاتف" : "Phone number"}
                  dir="ltr"
                  className={cn("flex-1", phoneError && "border-destructive")}
                  autoFocus
                />
              </div>
              {phoneError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {phoneError}
                </p>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSavePhone} disabled={isUpdating} className="h-7">
                  {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  <span className="ms-1">{isRTL ? "حفظ" : "Save"}</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  onClick={() => {
                    const p = parsePhone(profile.phone);
                    setPhonePrefix(p.prefix);
                    setPhoneLocal(p.local);
                    setPhoneError(null);
                    setIsEditingPhone(false);
                  }}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-foreground font-medium text-sm">{profile.phone || (isRTL ? "غير محدد" : "Not set")}</p>
          )}
        </div>

        {/* Country */}
        <div className="bg-muted/20 rounded-lg p-3 border border-border/40">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">{isRTL ? "الدولة" : "Country"}</Label>
            </div>
            {!isEditingCountry && (
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsEditingCountry(true)}>
                <Edit2 className="w-3 h-3" />
              </Button>
            )}
          </div>
          {isEditingCountry ? (
            <div className="space-y-2">
              <SearchableDropdown
                options={countryOptions}
                value={country}
                onChange={(val) => {
                  setCountry(val);
                  setCity("");
                }}
                placeholder={isRTL ? "اختر الدولة" : "Select country"}
                searchPlaceholder={isRTL ? "بحث..." : "Search..."}
                dir={isRTL ? "rtl" : "ltr"}
              />
              {isOtherCountry && (
                <Input
                  value={customCountry}
                  onChange={(e) => setCustomCountry(e.target.value)}
                  placeholder={isRTL ? "أدخل اسم الدولة" : "Enter country name"}
                  dir={isRTL ? "rtl" : "ltr"}
                />
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveCountry} disabled={isUpdating} className="h-7">
                  {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  <span className="ms-1">{isRTL ? "حفظ" : "Save"}</span>
                </Button>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => setIsEditingCountry(false)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-foreground font-medium text-sm">{profile.country || (isRTL ? "غير محدد" : "Not set")}</p>
          )}
        </div>

        {/* City */}
        <div className="bg-muted/20 rounded-lg p-3 border border-border/40">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">{isRTL ? "المدينة" : "City"}</Label>
            </div>
            {!isEditingCity && (
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsEditingCity(true)}>
                <Edit2 className="w-3 h-3" />
              </Button>
            )}
          </div>
          {isEditingCity ? (
            <div className="space-y-2">
              {hasCities ? (
                <SearchableDropdown
                  options={cityOptions}
                  value={city}
                  onChange={(val) => setCity(val)}
                  placeholder={isRTL ? "اختر المدينة" : "Select city"}
                  searchPlaceholder={isRTL ? "بحث..." : "Search..."}
                  dir={isRTL ? "rtl" : "ltr"}
                />
              ) : (
                <Input
                  value={isOtherCity ? customCity : city}
                  onChange={(e) => (isOtherCity ? setCustomCity(e.target.value) : setCity(e.target.value))}
                  placeholder={isRTL ? "أدخل اسم المدينة" : "Enter city name"}
                  dir={isRTL ? "rtl" : "ltr"}
                />
              )}
              {isOtherCity && (
                <Input
                  value={customCity}
                  onChange={(e) => setCustomCity(e.target.value)}
                  placeholder={isRTL ? "أدخل اسم المدينة" : "Enter city name"}
                  dir={isRTL ? "rtl" : "ltr"}
                />
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveCity} disabled={isUpdating} className="h-7">
                  {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  <span className="ms-1">{isRTL ? "حفظ" : "Save"}</span>
                </Button>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => setIsEditingCity(false)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-foreground font-medium text-sm">{profile.city || (isRTL ? "غير محدد" : "Not set")}</p>
          )}
        </div>

        {/* Gender */}
        <div className="bg-muted/20 rounded-lg p-3 border border-border/40">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">{isRTL ? "الجنس" : "Gender"}</Label>
            </div>
            {!isEditingGender && (
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsEditingGender(true)}>
                <Edit2 className="w-3 h-3" />
              </Button>
            )}
          </div>
          {isEditingGender ? (
            <div className="space-y-2">
              <Select value={gender} onValueChange={handleSaveGender} dir={isRTL ? "rtl" : "ltr"}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder={isRTL ? "اختر" : "Select"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">{isRTL ? "ذكر" : "Male"}</SelectItem>
                  <SelectItem value="Female">{isRTL ? "أنثى" : "Female"}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                onClick={() => {
                  setGender(profile.gender || "");
                  setIsEditingGender(false);
                }}
              >
                <X className="w-3 h-3 me-1" />
                {isRTL ? "إلغاء" : "Cancel"}
              </Button>
            </div>
          ) : (
            <p className="text-foreground font-medium text-sm">
              {profile.gender
                ? isRTL
                  ? profile.gender === "Male"
                    ? "ذكر"
                    : "أنثى"
                  : profile.gender
                : isRTL
                  ? "غير محدد"
                  : "Not set"}
            </p>
          )}
        </div>

        {/* Date of Birth */}
        <div className="bg-muted/20 rounded-lg p-3 border border-border/40">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">{isRTL ? "تاريخ الميلاد" : "Date of Birth"}</Label>
            </div>
            {!isEditingDob && (
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsEditingDob(true)}>
                <Edit2 className="w-3 h-3" />
              </Button>
            )}
          </div>
          {isEditingDob ? (
            <div className="space-y-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("h-8 w-full justify-start font-normal", !dob && "text-muted-foreground")}
                  >
                    <CalendarIcon className="me-2 h-4 w-4" />
                    {dob
                      ? format(dob, "PPP", { locale: isRTL ? arSA : undefined })
                      : isRTL
                        ? "اختر تاريخ"
                        : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dob}
                    onSelect={handleSaveDob}
                    disabled={(date) => date > new Date() || date < new Date("1920-01-01")}
                    initialFocus
                    dir={isRTL ? "rtl" : "ltr"}
                  />
                </PopoverContent>
              </Popover>
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                onClick={() => {
                  setDob(profile.date_of_birth ? new Date(profile.date_of_birth) : undefined);
                  setIsEditingDob(false);
                }}
              >
                <X className="w-3 h-3 me-1" />
                {isRTL ? "إلغاء" : "Cancel"}
              </Button>
            </div>
          ) : (
            <p className="text-foreground font-medium text-sm">
              {profile.date_of_birth
                ? format(new Date(profile.date_of_birth), "PPP", { locale: isRTL ? arSA : undefined })
                : isRTL
                  ? "غير محدد"
                  : "Not set"}
            </p>
          )}
        </div>

        {/* Password — full width */}
        <div className="bg-muted/20 rounded-lg p-3 border border-border/40">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">{isRTL ? "كلمة المرور" : "Password"}</Label>
            </div>
            {!isChangingPassword && (
              <Button size="sm" variant="ghost" onClick={() => setIsChangingPassword(true)} className="h-7 text-xs">
                {isRTL ? "تغيير" : "Change"}
              </Button>
            )}
          </div>
          {isChangingPassword ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData((prev) => ({ ...prev, newPassword: e.target.value }))}
                    placeholder={isRTL ? "كلمة المرور الجديدة" : "New password"}
                    dir={isRTL ? "rtl" : "ltr"}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="absolute end-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                <Input
                  type={showPassword ? "text" : "password"}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder={isRTL ? "تأكيد كلمة المرور" : "Confirm password"}
                  dir={isRTL ? "rtl" : "ltr"}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleChangePassword} disabled={isPasswordLoading}>
                  {isPasswordLoading ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
                  {isRTL ? "حفظ" : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setPasswordData({ newPassword: "", confirmPassword: "" });
                  }}
                >
                  {isRTL ? "إلغاء" : "Cancel"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-foreground font-medium text-sm">••••••••</p>
          )}
        </div>

        {/* Subscription — read only, full width */}
        <div className="bg-muted/20 rounded-xl p-4 border border-border/40 md:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
            <Label className="text-xs text-muted-foreground">{isRTL ? "حالة الاشتراك" : "Subscription Status"}</Label>
          </div>
          <p className="text-foreground font-medium text-sm">{isRTL ? "مجاني" : "Free"}</p>
        </div>
      </div>

      {/* Logout */}
      <div className="mt-6">
        <LogoutConfirmDialog onConfirm={signOut}>
          <Button variant="destructive" className="w-full">
            <LogOut className="w-4 h-4 me-2" />
            {isRTL ? "تسجيل الخروج" : "Logout"}
          </Button>
        </LogoutConfirmDialog>
      </div>
    </div>
  );
};
