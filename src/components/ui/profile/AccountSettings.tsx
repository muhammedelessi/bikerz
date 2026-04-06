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
import { COUNTRIES } from "@/data/countryCityData";
import {
  Mail,
  Phone,
  Lock,
  CreditCard,
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
  ChevronRight,
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

// ── Reusable row wrapper ──────────────────────────────────────────
const SettingRow: React.FC<{
  icon: React.ElementType;
  label: string;
  onEdit?: () => void;
  isEditing?: boolean;
  children: React.ReactNode;
}> = ({ icon: Icon, label, onEdit, isEditing, children }) => (
  <div className="flex items-start gap-3 py-3.5 border-b border-border/30 last:border-0">
    <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 mt-0.5">
      <Icon className="w-4 h-4 text-muted-foreground" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[11px] text-muted-foreground mb-0.5 uppercase tracking-wide">{label}</p>
      {children}
    </div>
    {onEdit && !isEditing && (
      <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-muted/50 transition-colors flex-shrink-0 mt-0.5">
        <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    )}
  </div>
);

// ── Save / Cancel buttons ─────────────────────────────────────────
const EditActions: React.FC<{
  onSave: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  isRTL: boolean;
}> = ({ onSave, onCancel, isLoading, isRTL }) => (
  <div className="flex items-center gap-2 mt-2">
    <Button size="sm" onClick={onSave} disabled={isLoading} className="h-7 px-3 text-xs">
      {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
      <span className="ms-1">{isRTL ? "حفظ" : "Save"}</span>
    </Button>
    <Button size="sm" variant="ghost" onClick={onCancel} className="h-7 px-3 text-xs text-muted-foreground">
      <X className="w-3 h-3" />
      <span className="ms-1">{isRTL ? "إلغاء" : "Cancel"}</span>
    </Button>
  </div>
);

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
  const [tempCountry, setTempCountry] = useState(country);
  const [tempCustomCountry, setTempCustomCountry] = useState(customCountry);
  const [country, setCountry] = useState(() => {
    const match = COUNTRIES.find(
      (c) => c.en === profile.country || c.ar === profile.country || c.code === profile.country,
    );
    return match ? match.code : profile.country ? OTHER_VALUE : "SA";
  });
  const [customCountry, setCustomCountry] = useState(
    COUNTRIES.find((c) => c.en === profile.country || c.ar === profile.country) ? "" : profile.country || "",
  );

  // City
  const [isEditingCity, setIsEditingCity] = useState(false);
  const [city, setCity] = useState(profile.city || "");
  const [customCity, setCustomCity] = useState("");

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
    () => PHONE_COUNTRIES.map((c) => ({ value: `${c.prefix}_${c.code}`, label: `${c.prefix} ${isRTL ? c.ar : c.en}` })),
    [isRTL],
  );

  const countryOptions = useMemo(
    () => [
      ...COUNTRIES.map((c) => ({ value: c.code, label: isRTL ? c.ar : c.en })),
      { value: OTHER_VALUE, label: isRTL ? "أخرى" : "Other" },
    ],
    [isRTL],
  );

  const cityOptions = useMemo(
    () => [
      ...cities.map((c) => ({ value: isRTL ? c.ar : c.en, label: isRTL ? c.ar : c.en })),
      { value: OTHER_VALUE, label: isRTL ? "أخرى" : "Other" },
    ],
    [cities, isRTL],
  );

  const validatePhone = (val: string) => {
    const digits = val.replace(/[^0-9]/g, "");
    if (digits.length < 7) {
      setPhoneError(isRTL ? "رقم قصير جداً (7 أرقام على الأقل)" : "Too short (min 7 digits)");
      return false;
    }
    if (digits.length > 15) {
      setPhoneError(isRTL ? "رقم طويل جداً (15 رقم كحد أقصى)" : "Too long (max 15 digits)");
      return false;
    }
    setPhoneError(null);
    return true;
  };

  const handleSavePhone = async () => {
    if (!validatePhone(phoneLocal)) return;
    const prefix = phonePrefix.split("_")[0];
    await onUpdate({ phone: `${prefix}${phoneLocal.replace(/[^0-9]/g, "")}` });
    setIsEditingPhone(false);
    setPhoneError(null);
  };

  const handleSaveCountry = async () => {
    setCountry(tempCountry);
    setCustomCountry(tempCustomCountry);
    setCity(""); // reset city only on save
    const match = COUNTRIES.find((c) => c.code === tempCountry);
    const name = tempCountry === OTHER_VALUE ? tempCustomCountry.trim() : match ? (isRTL ? match.ar : match.en) : "";
    await onUpdate({ country: name });
    setIsEditingCountry(false);
  };

  const handleSaveCity = async () => {
    await onUpdate({ city: isOtherCity || isOtherCountry ? customCity.trim() : city });
    setIsEditingCity(false);
  };

  const handleSaveGender = async (value: string) => {
    setGender(value);
    await onUpdate({ gender: value || null });
    setIsEditingGender(false);
  };

  const handleSaveDob = async (date: Date | undefined) => {
    setDob(date);
    if (date) await onUpdate({ date_of_birth: format(date, "yyyy-MM-dd") });
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
    <div className="card-premium overflow-hidden">
      {/* ── Header ── */}
      <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{isRTL ? "الحساب والإعدادات" : "Account & Settings"}</h3>
        <span className="text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">{user?.email}</span>
      </div>

      {/* ── Rows ── */}
      <div className="px-5 divide-y divide-border/20">
        {/* Phone */}
        <SettingRow
          icon={Phone}
          label={isRTL ? "رقم الهاتف" : "Phone"}
          onEdit={() => setIsEditingPhone(true)}
          isEditing={isEditingPhone}
        >
          {isEditingPhone ? (
            <div className="space-y-1.5 mt-1">
              <div className="flex gap-2" dir="ltr">
                <div className="w-full">
                  <SearchableDropdown
                    options={phonePrefixOptions}
                    value={phonePrefix}
                    onChange={(val) => {
                      setPhonePrefix(val);
                      setPhoneError(null);
                    }}
                    placeholder="+966"
                    searchPlaceholder="Search..."
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
                  placeholder="501234567"
                  dir="ltr"
                  className={cn("flex-1 h-9", phoneError && "border-destructive")}
                  autoFocus
                />
              </div>
              {phoneError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {phoneError}
                </p>
              )}
              <EditActions
                onSave={handleSavePhone}
                onCancel={() => {
                  const p = parsePhone(profile.phone);
                  setPhonePrefix(p.prefix);
                  setPhoneLocal(p.local);
                  setPhoneError(null);
                  setIsEditingPhone(false);
                }}
                isLoading={isUpdating}
                isRTL={isRTL}
              />
            </div>
          ) : (
            <p
              className="text-sm font-medium text-foreground"
              dir="ltr"
              style={{ textAlign: isRTL ? "right" : "left" }}
            >
              {profile.phone || <span className="text-muted-foreground text-xs">{isRTL ? "غير محدد" : "Not set"}</span>}
            </p>
          )}
        </SettingRow>

        {/* Country */}
        <SettingRow
          icon={Globe}
          label={isRTL ? "الدولة" : "Country"}
          onEdit={() => setIsEditingCountry(true)}
          isEditing={isEditingCountry}
        >
          {isEditingCountry ? (
            <div className="space-y-1.5 mt-1">
              <SearchableDropdown
                options={countryOptions}
                value={tempCountry}
                onChange={(val) => setTempCountry(val)}
                onCancel={() => {
                  setTempCountry(country);
                  setTempCustomCountry(customCountry);
                  setIsEditingCountry(false);
                }}
                onEdit={() => {
                  setTempCountry(country);
                  setTempCustomCountry(customCountry);
                  setIsEditingCountry(true);
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
                  className="h-9"
                />
              )}
              <EditActions
                onSave={handleSaveCountry}
                onCancel={() => setIsEditingCountry(false)}
                isLoading={isUpdating}
                isRTL={isRTL}
              />
            </div>
          ) : (
            <p className="text-sm font-medium text-foreground">
              {profile.country || (
                <span className="text-muted-foreground text-xs">{isRTL ? "غير محدد" : "Not set"}</span>
              )}
            </p>
          )}
        </SettingRow>

        {/* City */}
        <SettingRow
          icon={MapPin}
          label={isRTL ? "المدينة" : "City"}
          onEdit={() => setIsEditingCity(true)}
          isEditing={isEditingCity}
        >
          {isEditingCity ? (
            <div className="space-y-1.5 mt-1">
              {hasCities ? (
                <SearchableDropdown
                  options={cityOptions}
                  value={city}
                  onChange={setCity}
                  placeholder={isRTL ? "اختر المدينة" : "Select city"}
                  searchPlaceholder={isRTL ? "بحث..." : "Search..."}
                  dir={isRTL ? "rtl" : "ltr"}
                />
              ) : (
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={isRTL ? "أدخل اسم المدينة" : "Enter city name"}
                  dir={isRTL ? "rtl" : "ltr"}
                  className="h-9"
                />
              )}
              {isOtherCity && (
                <Input
                  value={customCity}
                  onChange={(e) => setCustomCity(e.target.value)}
                  placeholder={isRTL ? "أدخل اسم المدينة" : "Enter city name"}
                  dir={isRTL ? "rtl" : "ltr"}
                  className="h-9"
                />
              )}
              <EditActions
                onSave={handleSaveCity}
                onCancel={() => setIsEditingCity(false)}
                isLoading={isUpdating}
                isRTL={isRTL}
              />
            </div>
          ) : (
            <p className="text-sm font-medium text-foreground">
              {profile.city || <span className="text-muted-foreground text-xs">{isRTL ? "غير محدد" : "Not set"}</span>}
            </p>
          )}
        </SettingRow>

        {/* Gender */}
        <SettingRow
          icon={User}
          label={isRTL ? "الجنس" : "Gender"}
          onEdit={() => setIsEditingGender(true)}
          isEditing={isEditingGender}
        >
          {isEditingGender ? (
            <div className="space-y-1.5 mt-1">
              <Select value={gender} onValueChange={handleSaveGender} dir={isRTL ? "rtl" : "ltr"}>
                <SelectTrigger className="h-9">
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
                className="h-7 px-3 text-xs text-muted-foreground"
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
            <p className="text-sm font-medium text-foreground">
              {profile.gender ? (
                isRTL ? (
                  profile.gender === "Male" ? (
                    "ذكر"
                  ) : (
                    "أنثى"
                  )
                ) : (
                  profile.gender
                )
              ) : (
                <span className="text-muted-foreground text-xs">{isRTL ? "غير محدد" : "Not set"}</span>
              )}
            </p>
          )}
        </SettingRow>

        {/* Date of Birth */}
        <SettingRow
          icon={CalendarIcon}
          label={isRTL ? "تاريخ الميلاد" : "Date of Birth"}
          onEdit={() => setIsEditingDob(true)}
          isEditing={isEditingDob}
        >
          {isEditingDob ? (
            <div className="space-y-1.5 mt-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("h-9 w-full justify-start font-normal text-sm", !dob && "text-muted-foreground")}
                  >
                    <CalendarIcon className="me-2 h-3.5 w-3.5" />
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
                className="h-7 px-3 text-xs text-muted-foreground"
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
            <p className="text-sm font-medium text-foreground">
              {profile.date_of_birth ? (
                format(new Date(profile.date_of_birth), "PPP", { locale: isRTL ? arSA : undefined })
              ) : (
                <span className="text-muted-foreground text-xs">{isRTL ? "غير محدد" : "Not set"}</span>
              )}
            </p>
          )}
        </SettingRow>

        {/* Password */}
        <SettingRow
          icon={Lock}
          label={isRTL ? "كلمة المرور" : "Password"}
          onEdit={() => setIsChangingPassword(true)}
          isEditing={isChangingPassword}
        >
          {isChangingPassword ? (
            <div className="space-y-2 mt-1">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData((prev) => ({ ...prev, newPassword: e.target.value }))}
                  placeholder={isRTL ? "كلمة المرور الجديدة" : "New password"}
                  dir={isRTL ? "rtl" : "ltr"}
                  className="h-9 pe-10"
                />
                <button
                  type="button"
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Input
                type={showPassword ? "text" : "password"}
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder={isRTL ? "تأكيد كلمة المرور" : "Confirm password"}
                dir={isRTL ? "rtl" : "ltr"}
                className="h-9"
              />
              <EditActions
                onSave={handleChangePassword}
                onCancel={() => {
                  setIsChangingPassword(false);
                  setPasswordData({ newPassword: "", confirmPassword: "" });
                }}
                isLoading={isPasswordLoading}
                isRTL={isRTL}
              />
            </div>
          ) : (
            <p className="text-sm font-medium text-foreground tracking-widest">••••••••</p>
          )}
        </SettingRow>

        {/* Subscription — read only */}
        <SettingRow icon={CreditCard} label={isRTL ? "حالة الاشتراك" : "Subscription"}>
          <p className="text-sm font-medium text-foreground">
            <span className="inline-flex items-center gap-1.5 text-xs bg-muted/50 px-2 py-0.5 rounded-full">
              {isRTL ? "مجاني" : "Free Plan"}
            </span>
          </p>
        </SettingRow>
      </div>

      {/* ── Logout ── */}
      <div className="px-5 py-4 border-t border-border/40">
        <LogoutConfirmDialog onConfirm={signOut}>
          <Button
            variant="ghost"
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 h-9 text-sm"
          >
            <LogOut className="w-4 h-4 me-2" />
            {isRTL ? "تسجيل الخروج" : "Sign Out"}
          </Button>
        </LogoutConfirmDialog>
      </div>
    </div>
  );
};
