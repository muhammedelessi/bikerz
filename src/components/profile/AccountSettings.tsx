import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
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
} from 'lucide-react';
import { ExtendedProfile } from '@/hooks/useUserProfile';

interface AccountSettingsProps {
  profile: ExtendedProfile;
  onUpdate: (updates: Partial<ExtendedProfile>) => Promise<void>;
  isUpdating: boolean;
}

export const AccountSettings: React.FC<AccountSettingsProps> = ({
  profile,
  onUpdate,
  isUpdating,
}) => {
  const { isRTL } = useLanguage();
  const { user, signOut } = useAuth();
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phone, setPhone] = useState(profile.phone || '');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ newPassword: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  const handleSavePhone = async () => {
    await onUpdate({ phone: phone || null });
    setIsEditingPhone(false);
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
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

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

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="card-premium p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
          <Settings className="w-5 h-5 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          {isRTL ? 'الحساب والإعدادات' : 'Account & Settings'}
        </h3>
      </div>

      <div className="space-y-6">
        {/* Email */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0">
            <Mail className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <Label className="text-xs text-muted-foreground">{isRTL ? 'البريد الإلكتروني' : 'Email'}</Label>
            <p className="text-foreground font-medium truncate">{user?.email}</p>
          </div>
        </div>

        <Separator />

        {/* Phone */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0">
            <Phone className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <Label className="text-xs text-muted-foreground">{isRTL ? 'رقم الهاتف' : 'Phone Number'}</Label>
            {isEditingPhone ? (
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={isRTL ? 'رقم الهاتف' : 'Phone number'}
                  className="h-8"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={handleSavePhone}
                  disabled={isUpdating}
                >
                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-green-500" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => {
                    setPhone(profile.phone || '');
                    setIsEditingPhone(false);
                  }}
                >
                  <X className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-foreground font-medium">
                  {profile.phone || (isRTL ? 'غير محدد' : 'Not set')}
                </p>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => setIsEditingPhone(true)}
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Password Management */}
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0">
            <Lock className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">{isRTL ? 'كلمة المرور' : 'Password'}</Label>
            {isChangingPassword ? (
              <div className="space-y-3 mt-2">
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                    placeholder={isRTL ? 'كلمة المرور الجديدة' : 'New password'}
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
                  <Button
                    size="sm"
                    onClick={handleChangePassword}
                    disabled={isPasswordLoading}
                  >
                    {isPasswordLoading ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
                    {isRTL ? 'حفظ' : 'Save'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsChangingPassword(false);
                      setPasswordData({ newPassword: '', confirmPassword: '' });
                    }}
                  >
                    {isRTL ? 'إلغاء' : 'Cancel'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-foreground font-medium">••••••••</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsChangingPassword(true)}
                >
                  {isRTL ? 'تغيير' : 'Change'}
                </Button>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Subscription Status */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">{isRTL ? 'حالة الاشتراك' : 'Subscription Status'}</Label>
            <p className="text-foreground font-medium">
              {isRTL ? 'مجاني' : 'Free'}
            </p>
          </div>
        </div>

        <Separator />

        {/* Device Sessions */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">{isRTL ? 'الجلسات النشطة' : 'Active Sessions'}</Label>
            <p className="text-foreground font-medium">
              1 {isRTL ? 'جهاز' : 'device'}
            </p>
          </div>
        </div>

        <Separator />

        {/* Logout */}
        <Button
          variant="destructive"
          className="w-full"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 me-2" />
          {isRTL ? 'تسجيل الخروج' : 'Logout'}
        </Button>
      </div>
    </div>
  );
};
