import React, { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import LogoutConfirmDialog from '@/components/common/LogoutConfirmDialog';
import SearchableDropdown from '@/components/checkout/SearchableDropdown';
import { PHONE_COUNTRIES } from '@/data/phoneCountryCodes';
import { cn } from '@/lib/utils';
import {
  Mail,
  Phone,
  Lock,
  CreditCard,
  Smartphone,
  LogOut,
  Check,
  X,
  Loader2,
  Eye,
  EyeOff,
  CalendarIcon,
  User,
  Shield,
  Pencil,
  AlertCircle,
} from 'lucide-react';
import { ExtendedProfile } from '@/hooks/useUserProfile';

interface AccountSettingsProps {
  profile: ExtendedProfile;
  onUpdate: (updates: Partial<ExtendedProfile>) => Promise<void>;
  isUpdating: boolean;
}

/** Parse existing phone into prefix + local number */
function parsePhone(fullPhone: string | null | undefined): { prefix: string; local: string } {
  if (!fullPhone) return { prefix: '+966_SA', local: '' };
  // Try to match against known prefixes (longest first)
  const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const c of sorted) {
    if (fullPhone.startsWith(c.prefix)) {
      return { prefix: `${c.prefix}_${c.code}`, local: fullPhone.slice(c.prefix.length) };
    }
  }
  return { prefix: '+966_SA', local: fullPhone.replace(/^\+/, '') };
}

export const AccountSettings: React.FC<AccountSettingsProps> = ({
  profile,
  onUpdate,
  isUpdating,
}) => {
  const { isRTL } = useLanguage();
  const { user, signOut } = useAuth();

  // Phone state
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phonePrefix, setPhonePrefix] = useState(() => parsePhone(profile.phone).prefix);
  const [phoneLocal, setPhoneLocal] = useState(() => parsePhone(profile.phone).local);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Gender state
  const [isEditingGender, setIsEditingGender] = useState(false);
  const [gender, setGender] = useState(profile.gender || '');

  // DOB state
  const [isEditingDob, setIsEditingDob] = useState(false);
  const [dob, setDob] = useState<Date | undefined>(profile.date_of_birth ? new Date(profile.date_of_birth) : undefined);

  // Password state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ newPassword: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  // Sync prefix when profile country changes
  useEffect(() => {
    if (profile.country) {
      const match = PHONE_COUNTRIES.find(c =>
        c.en.toLowerCase() === profile.country?.toLowerCase() ||
        c.ar === profile.country ||
        c.code === profile.country
      );
      if (match && !isEditingPhone) {
        setPhonePrefix(`${match.prefix}_${match.code}`);
      }
    }
  }, [profile.country]);

  const phonePrefixOptions = useMemo(() =>
    PHONE_COUNTRIES.map(c => ({
      value: `${c.prefix}_${c.code}`,
      label: `${c.prefix} ${isRTL ? c.ar : c.en}`,
    })),
    [isRTL]
  );

  const validatePhone = (val: string): boolean => {
    const digits = val.replace(/[^0-9]/g, '');
    if (digits.length < 7) {
      setPhoneError(isRTL ? 'رقم الهاتف قصير جداً (7 أرقام على الأقل)' : 'Phone number too short (min 7 digits)');
      return false;
    }
    if (digits.length > 15) {
      setPhoneError(isRTL ? 'رقم الهاتف طويل جداً (15 رقم كحد أقصى)' : 'Phone number too long (max 15 digits)');
      return false;
    }
    setPhoneError(null);
    return true;
  };

  const handleSavePhone = async () => {
    if (!validatePhone(phoneLocal)) return;
    const prefix = phonePrefix.split('_')[0];
    const fullPhone = `${prefix}${phoneLocal.replace(/[^0-9]/g, '')}`;
    await onUpdate({ phone: fullPhone });
    setIsEditingPhone(false);
    setPhoneError(null);
  };

  const handleCancelPhone = () => {
    const p = parsePhone(profile.phone);
    setPhonePrefix(p.prefix);
    setPhoneLocal(p.local);
    setPhoneError(null);
    setIsEditingPhone(false);
  };

  const handleSaveGender = async (value: string) => {
    setGender(value);
    await onUpdate({ gender: value || null });
    setIsEditingGender(false);
  };

  const handleSaveDob = async (date: Date | undefined) => {
    setDob(date);
    if (date) {
      await onUpdate({ date_of_birth: format(date, 'yyyy-MM-dd') });
    }
    setIsEditingDob(false);
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error(isRTL ? 'كلمات المرور غير متطابقة' : 'Passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error(isRTL ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }
    setIsPasswordLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('self-update-password', {
        body: { new_password: passwordData.newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(isRTL ? 'تم تغيير كلمة المرور بنجاح' : 'Password changed successfully');
      setIsChangingPassword(false);
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error(isRTL ? 'فشل في تغيير كلمة المرور' : 'Failed to change password');
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const displayPhone = profile.phone || (isRTL ? 'غير محدد' : 'Not set');
  const displayGender = profile.gender
    ? (isRTL ? (profile.gender === 'Male' ? 'ذكر' : 'أنثى') : profile.gender)
    : (isRTL ? 'غير محدد' : 'Not set');
  const displayDob = profile.date_of_birth
    ? format(new Date(profile.date_of_birth), 'PPP', { locale: isRTL ? arSA : undefined })
    : (isRTL ? 'غير محدد' : 'Not set');

  const SettingRow: React.FC<{
    icon: React.ElementType;
    label: string;
    value?: string;
    isEditing: boolean;
    onEdit: () => void;
    editContent: React.ReactNode;
    iconColor?: string;
  }> = ({ icon: Icon, label, value, isEditing, onEdit, editContent, iconColor }) => (
    <div className="group rounded-xl border border-border/50 bg-card/50 p-4 transition-all hover:border-border hover:bg-card/80">
      <div className="flex items-start gap-3.5">
        <div className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          iconColor || "bg-primary/10 text-primary"
        )}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
          {isEditing ? (
            <div className="mt-1">{editContent}</div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground truncate">{value}</p>
              {onEdit && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={onEdit}
                >
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border border-border/60 bg-card/30 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-border/40 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {isRTL ? 'الحساب والإعدادات' : 'Account & Settings'}
          </h3>
          <p className="text-xs text-muted-foreground">
            {isRTL ? 'إدارة بيانات حسابك وتفضيلاتك' : 'Manage your account details and preferences'}
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-3">
        {/* Email — read-only */}
        <SettingRow
          icon={Mail}
          label={isRTL ? 'البريد الإلكتروني' : 'Email Address'}
          value={user?.email || ''}
          isEditing={false}
          onEdit={() => {}}
          editContent={null}
          iconColor="bg-blue-500/10 text-blue-500"
        />

        {/* Phone */}
        <SettingRow
          icon={Phone}
          label={isRTL ? 'رقم الهاتف' : 'Phone Number'}
          value={displayPhone}
          isEditing={isEditingPhone}
          onEdit={() => setIsEditingPhone(true)}
          iconColor="bg-emerald-500/10 text-emerald-500"
          editContent={
            <div className="space-y-2">
              <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`} dir="ltr">
                <div className="flex-shrink-0 w-[120px]">
                  <SearchableDropdown
                    options={phonePrefixOptions}
                    value={phonePrefix}
                    onChange={(val) => { setPhonePrefix(val); setPhoneError(null); }}
                    placeholder="+---"
                    searchPlaceholder={isRTL ? 'ابحث...' : 'Search...'}
                    hasError={!!phoneError}
                    dir="ltr"
                  />
                </div>
                <div className="relative flex-1">
                  <Phone className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none ${isRTL ? 'right-3' : 'left-3'}`} />
                  <Input
                    type="tel"
                    value={phoneLocal}
                    onChange={(e) => {
                      setPhoneLocal(e.target.value.replace(/[^0-9]/g, ''));
                      setPhoneError(null);
                    }}
                    placeholder={isRTL ? 'رقم الهاتف' : 'Phone Number'}
                    className={cn(
                      isRTL ? 'pr-9 text-right' : 'pl-9 text-left',
                      phoneError && 'border-destructive'
                    )}
                    dir={isRTL ? 'rtl' : 'ltr'}
                  />
                </div>
              </div>
              {phoneError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {phoneError}
                </p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" onClick={handleSavePhone} disabled={isUpdating} className="h-8 px-4 text-xs">
                  {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin me-1.5" /> : <Check className="w-3.5 h-3.5 me-1.5" />}
                  {isRTL ? 'حفظ' : 'Save'}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancelPhone} className="h-8 px-3 text-xs">
                  <X className="w-3.5 h-3.5 me-1" />
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Button>
              </div>
            </div>
          }
        />

        {/* Gender */}
        <SettingRow
          icon={User}
          label={isRTL ? 'الجنس' : 'Gender'}
          value={displayGender}
          isEditing={isEditingGender}
          onEdit={() => setIsEditingGender(true)}
          iconColor="bg-violet-500/10 text-violet-500"
          editContent={
            <div className="flex items-center gap-2">
              <Select value={gender} onValueChange={handleSaveGender}>
                <SelectTrigger className="h-9 w-44">
                  <SelectValue placeholder={isRTL ? 'اختر' : 'Select'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">{isRTL ? 'ذكر' : 'Male'}</SelectItem>
                  <SelectItem value="Female">{isRTL ? 'أنثى' : 'Female'}</SelectItem>
                </SelectContent>
              </Select>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setGender(profile.gender || ''); setIsEditingGender(false); }}>
                <X className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          }
        />

        {/* Date of Birth */}
        <SettingRow
          icon={CalendarIcon}
          label={isRTL ? 'تاريخ الميلاد' : 'Date of Birth'}
          value={displayDob}
          isEditing={isEditingDob}
          onEdit={() => setIsEditingDob(true)}
          iconColor="bg-amber-500/10 text-amber-500"
          editContent={
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("h-9 w-52 justify-start text-start font-normal", !dob && "text-muted-foreground")}
                  >
                    <CalendarIcon className="me-2 h-4 w-4" />
                    {dob
                      ? format(dob, 'PPP', { locale: isRTL ? arSA : undefined })
                      : (isRTL ? 'اختر تاريخ' : 'Pick a date')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dob}
                    onSelect={(date) => handleSaveDob(date)}
                    disabled={(date) => date > new Date() || date < new Date('1920-01-01')}
                    initialFocus
                    className="p-3 pointer-events-auto"
                    dir={isRTL ? 'rtl' : 'ltr'}
                  />
                </PopoverContent>
              </Popover>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setDob(profile.date_of_birth ? new Date(profile.date_of_birth) : undefined); setIsEditingDob(false); }}>
                <X className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          }
        />

        {/* Password */}
        <div className="group rounded-xl border border-border/50 bg-card/50 p-4 transition-all hover:border-border hover:bg-card/80">
          <div className="flex items-start gap-3.5">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
              <Lock className="h-4.5 w-4.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                {isRTL ? 'كلمة المرور' : 'Password'}
              </p>
              {isChangingPassword ? (
                <div className="space-y-3 mt-1">
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder={isRTL ? 'كلمة المرور الجديدة' : 'New password'}
                      className="pe-10"
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
                    type={showPassword ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder={isRTL ? 'تأكيد كلمة المرور' : 'Confirm password'}
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={handleChangePassword} disabled={isPasswordLoading} className="h-8 px-4 text-xs">
                      {isPasswordLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin me-1.5" /> : <Check className="w-3.5 h-3.5 me-1.5" />}
                      {isRTL ? 'حفظ' : 'Save'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-3 text-xs"
                      onClick={() => { setIsChangingPassword(false); setPasswordData({ newPassword: '', confirmPassword: '' }); }}
                    >
                      <X className="w-3.5 h-3.5 me-1" />
                      {isRTL ? 'إلغاء' : 'Cancel'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground tracking-widest">••••••••</p>
                  <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={() => setIsChangingPassword(true)}>
                    {isRTL ? 'تغيير' : 'Change'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info row — Subscription */}
        <SettingRow
          icon={CreditCard}
          label={isRTL ? 'حالة الاشتراك' : 'Subscription'}
          value={isRTL ? 'مجاني' : 'Free'}
          isEditing={false}
          onEdit={() => {}}
          editContent={null}
          iconColor="bg-pink-500/10 text-pink-500"
        />

        {/* Info row — Sessions */}
        <SettingRow
          icon={Smartphone}
          label={isRTL ? 'الجلسات النشطة' : 'Active Sessions'}
          value={`1 ${isRTL ? 'جهاز' : 'device'}`}
          isEditing={false}
          onEdit={() => {}}
          editContent={null}
          iconColor="bg-cyan-500/10 text-cyan-500"
        />

        {/* Logout */}
        <div className="pt-2">
          <LogoutConfirmDialog onConfirm={() => signOut()}>
            <Button variant="destructive" className="w-full h-11 rounded-xl font-medium">
              <LogOut className="w-4 h-4 me-2" />
              {isRTL ? 'تسجيل الخروج' : 'Logout'}
            </Button>
          </LogoutConfirmDialog>
        </div>
      </div>
    </div>
  );
};
