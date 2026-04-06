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

// ── Field Row ─────────────────────────────────────────────────────
const FieldRow: React.FC<{
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  onEdit?: () => void;
  isEditing?: boolean;
  editContent?: React.ReactNode;
  readOnly?: boolean;
  badge?: React.ReactNode;
}> = ({ icon: Icon, label, value, onEdit, isEditing, editContent, readOnly, badge }) => (
  <div className="border-b border-border/20 last:border-0">
    {/* Display row */}
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 transition-colors",
        !readOnly && !isEditing && "hover:bg-muted/20 cursor-default",
      )}
    >
      <div className="w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center flex-shrink-0">
        <Icon className="w-[15px] h-[15px] text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-0.5 font-medium">{label}</p>
        <div className="text-sm font-medium text-foreground truncate">{value}</div>
      </div>
      {badge && <div className="flex-shrink-0">{badge}</div>}
      {onEdit && !isEditing && (
        <button
          onClick={onEdit}
          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-muted/50 transition-colors flex-shrink-0"
        >
          <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
    {/* Edit panel */}
    {isEditing && editContent && (
      <div className="px-4 pb-3 pt-1 bg-muted/10 border-t border-border/20">{editContent}</div>
    )}
  </div>
);

// ── Save/Cancel ───────────────────────────────────────────────────
const Actions: React.FC<{
  onSave: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  isRTL: boolean;
}> = ({ onSave, onCancel, isLoading, isRTL }) => (
  <div className="flex items-center gap-2 mt-2.5">
    <Button size="sm" onClick={onSave} disabled={isLoading} className="h-8 px-4 text-xs font-semibold gap-1.5">
      {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
      {isRTL ? "حفظ" : "Save"}
    </Button>
    <Button size="sm" variant="ghost" onClick={onCancel} className="h-8 px-3 text-xs text-muted-foreground gap-1.5">
      <X className="w-3 h-3" />
      {isRTL ? "إلغاء" : "Cancel"}
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
  const [country, setCountry] = useState(() => {
    const match = COUNTRIES.find(
      (c) => c.en === profile.country || c.ar === profile.country || c.code === profile.country,
    );
    return match ? match.code : profile.country ? OTHER_VALUE : "SA";
  });
  const [customCountry, setCustomCountry] = useState(
    COUNTRIES.find((c) => c.en === profile.country || c.ar === profile.country) ? "" : profile.country || "",
  );
  const [tempCountry, setTempCountry] = useState(country);
  const [tempCustomCountry, setTempCustomCountry] = useState(customCountry);

  // City
  const [isEditingCity, setIsEditingCity] = useState(false);
  const [city, setCity] = useState(profile.city || "");
  const [tempCity, setTempCity] = useState(profile.city || "");
  const [tempCustomCity, setTempCustomCity] = useState("");

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

  const isTempOtherCountry = tempCountry === OTHER_VALUE;
  const isTempOtherCity = tempCity === OTHER_VALUE;

  const selectedCountryEntry = useMemo(() => COUNTRIES.find((c) => c.code === country), [country]);
  const tempCountryEntry = useMemo(() => COUNTRIES.find((c) => c.code === tempCountry), [tempCountry]);
  const cities = useMemo(
    () => tempCountryEntry?.cities || selectedCountryEntry?.cities || [],
    [tempCountryEntry, selectedCountryEntry],
  );
  const hasCities = cities.length > 0 && !isTempOtherCountry;

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
    const d = val.replace(/[^0-9]/g, "");
    if (d.length < 7) {
      setPhoneError(isRTL ? "رقم قصير جداً (7 أرقام على الأقل)" : "Too short (min 7 digits)");
      return false;
    }
    if (d.length > 15) {
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
    const name = isOtherCountry ? customCountry.trim() : selectedCountryEntry ? selectedCountryEntry.en : ""; // دائماً English
    setCountry(tempCountry);
    setCustomCountry(tempCustomCountry);
    setCity("");
    setTempCity("");
    await onUpdate({ country: name, city: "" });
    setIsEditingCountry(false);
  };

  const handleSaveCity = async () => {
    const cityName =
      isOtherCity || isOtherCountry
        ? customCity.trim()
        : selectedCountryEntry?.cities.find((c) => c.ar === city || c.en === city)?.en || city;

    setCity(cityName);
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

  const notSet = (
    <span className="text-muted-foreground/60 text-xs font-normal italic">{isRTL ? "غير محدد" : "Not set"}</span>
  );

  return (
    <div className="card-premium overflow-hidden" dir={isRTL ? "rtl" : "ltr"}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <h3 className="text-sm font-semibold text-foreground">{isRTL ? "الحساب والإعدادات" : "Account & Settings"}</h3>
        <span className="text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-full border border-border/30 truncate max-w-[180px]">
          {user?.email}
        </span>
      </div>

      {/* ── Fields ── */}
      <div className="divide-y divide-border/20">
        {/* Phone */}
        <FieldRow
          icon={Phone}
          label={isRTL ? "رقم الهاتف" : "Phone"}
          value={
            profile.phone ? (
              <span dir="ltr" className="inline-block">
                {profile.phone}
              </span>
            ) : (
              notSet
            )
          }
          onEdit={() => setIsEditingPhone(true)}
          isEditing={isEditingPhone}
          editContent={
            <div className="space-y-2">
              <div className="flex gap-2" dir="ltr">
                <div className="w-[140px] flex-shrink-0">
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
                  className={cn("flex-1 h-9 text-sm", phoneError && "border-destructive")}
                  autoFocus
                />
              </div>
              {phoneError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {phoneError}
                </p>
              )}
              <Actions
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
          }
        />

        {/* Country */}
        <FieldRow
          icon={Globe}
          label={isRTL ? "الدولة" : "Country"}
          value={profile.country || notSet}
          onEdit={() => {
            setTempCountry(country);
            setTempCustomCountry(customCountry);
            setIsEditingCountry(true);
          }}
          isEditing={isEditingCountry}
          editContent={
            <div className="space-y-2">
              <SearchableDropdown
                options={countryOptions}
                value={tempCountry}
                onChange={(val) => {
                  setTempCountry(val);
                  setTempCity("");
                }}
                placeholder={isRTL ? "اختر الدولة" : "Select country"}
                searchPlaceholder={isRTL ? "بحث..." : "Search..."}
                dir={isRTL ? "rtl" : "ltr"}
              />
              {isTempOtherCountry && (
                <Input
                  value={tempCustomCountry}
                  onChange={(e) => setTempCustomCountry(e.target.value)}
                  placeholder={isRTL ? "أدخل اسم الدولة" : "Enter country name"}
                  className="h-9 text-sm"
                />
              )}
              <Actions
                onSave={handleSaveCountry}
                onCancel={() => {
                  setTempCountry(country);
                  setIsEditingCountry(false);
                }}
                isLoading={isUpdating}
                isRTL={isRTL}
              />
            </div>
          }
        />

        {/* City */}
        <FieldRow
          icon={MapPin}
          label={isRTL ? "المدينة" : "City"}
          value={profile.city || notSet}
          onEdit={() => {
            setTempCity(city);
            setTempCustomCity("");
            setIsEditingCity(true);
          }}
          isEditing={isEditingCity}
          editContent={
            <div className="space-y-2">
              {hasCities ? (
                <SearchableDropdown
                  options={cityOptions}
                  value={tempCity}
                  onChange={setTempCity}
                  placeholder={isRTL ? "اختر المدينة" : "Select city"}
                  searchPlaceholder={isRTL ? "بحث..." : "Search..."}
                  dir={isRTL ? "rtl" : "ltr"}
                />
              ) : (
                <Input
                  value={tempCity}
                  onChange={(e) => setTempCity(e.target.value)}
                  placeholder={isRTL ? "أدخل اسم المدينة" : "Enter city name"}
                  className="h-9 text-sm"
                />
              )}
              {isTempOtherCity && (
                <Input
                  value={tempCustomCity}
                  onChange={(e) => setTempCustomCity(e.target.value)}
                  placeholder={isRTL ? "أدخل اسم المدينة" : "Enter city name"}
                  className="h-9 text-sm"
                />
              )}
              <Actions
                onSave={handleSaveCity}
                onCancel={() => setIsEditingCity(false)}
                isLoading={isUpdating}
                isRTL={isRTL}
              />
            </div>
          }
        />

        {/* Gender */}
        <FieldRow
          icon={User}
          label={isRTL ? "الجنس" : "Gender"}
          value={profile.gender ? (isRTL ? (profile.gender === "Male" ? "ذكر" : "أنثى") : profile.gender) : notSet}
          onEdit={() => setIsEditingGender(true)}
          isEditing={isEditingGender}
          editContent={
            <div className="space-y-2">
              <Select value={gender} onValueChange={handleSaveGender} dir={isRTL ? "rtl" : "ltr"}>
                <SelectTrigger className="h-9 text-sm">
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
                className="h-8 px-3 text-xs text-muted-foreground gap-1.5"
                onClick={() => {
                  setGender(profile.gender || "");
                  setIsEditingGender(false);
                }}
              >
                <X className="w-3 h-3" />
                {isRTL ? "إلغاء" : "Cancel"}
              </Button>
            </div>
          }
        />

        {/* DOB */}
        <FieldRow
          icon={CalendarIcon}
          label={isRTL ? "تاريخ الميلاد" : "Date of Birth"}
          value={
            profile.date_of_birth
              ? format(new Date(profile.date_of_birth), "PPP", { locale: isRTL ? arSA : undefined })
              : notSet
          }
          onEdit={() => setIsEditingDob(true)}
          isEditing={isEditingDob}
          editContent={
            <div className="space-y-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("h-9 w-full justify-start text-sm font-normal", !dob && "text-muted-foreground")}
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
                className="h-8 px-3 text-xs text-muted-foreground gap-1.5"
                onClick={() => {
                  setDob(profile.date_of_birth ? new Date(profile.date_of_birth) : undefined);
                  setIsEditingDob(false);
                }}
              >
                <X className="w-3 h-3" />
                {isRTL ? "إلغاء" : "Cancel"}
              </Button>
            </div>
          }
        />

        {/* Password */}
        <FieldRow
          icon={Lock}
          label={isRTL ? "كلمة المرور" : "Password"}
          value={<span className="tracking-widest text-base">••••••••</span>}
          onEdit={() => setIsChangingPassword(true)}
          isEditing={isChangingPassword}
          editContent={
            <div className="space-y-2">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData((p) => ({ ...p, newPassword: e.target.value }))}
                  placeholder={isRTL ? "كلمة المرور الجديدة" : "New password"}
                  dir={isRTL ? "rtl" : "ltr"}
                  className="h-9 text-sm pe-10"
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
                onChange={(e) => setPasswordData((p) => ({ ...p, confirmPassword: e.target.value }))}
                placeholder={isRTL ? "تأكيد كلمة المرور" : "Confirm password"}
                dir={isRTL ? "rtl" : "ltr"}
                className="h-9 text-sm"
              />
              <Actions
                onSave={handleChangePassword}
                onCancel={() => {
                  setIsChangingPassword(false);
                  setPasswordData({ newPassword: "", confirmPassword: "" });
                }}
                isLoading={isPasswordLoading}
                isRTL={isRTL}
              />
            </div>
          }
        />

        {/* Subscription */}
        <FieldRow
          icon={CreditCard}
          label={isRTL ? "حالة الاشتراك" : "Subscription"}
          value={isRTL ? "مجاني" : "Free"}
          readOnly
          badge={
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-muted/40 text-muted-foreground border border-border/30">
              Free Plan
            </span>
          }
        />
      </div>

      {/* ── Logout ── */}
      <div className="px-4 py-3 border-t border-border/30">
        <LogoutConfirmDialog onConfirm={signOut}>
          <Button
            variant="ghost"
            className="w-full h-9 text-sm text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
          >
            <LogOut className="w-4 h-4" />
            {isRTL ? "تسجيل الخروج" : "Sign Out"}
          </Button>
        </LogoutConfirmDialog>
      </div>
    </div>
  );
};
