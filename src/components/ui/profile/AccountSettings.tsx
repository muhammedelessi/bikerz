import React, { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import LogoutConfirmDialog from "@/components/common/LogoutConfirmDialog";
import { cn } from "@/lib/utils";
import {
  Lock,
  LogOut,
  Check,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { ExtendedProfile } from "@/hooks/useUserProfile";

interface AccountSettingsProps {
  profile: ExtendedProfile;
  onUpdate: (updates: Partial<ExtendedProfile>) => Promise<void>;
  isUpdating: boolean;
}

const Actions: React.FC<{
  onSave: () => void;
  isLoading?: boolean;
  isRTL: boolean;
}> = ({ onSave, isLoading, isRTL }) => (
  <div className="flex items-center gap-2 mt-2.5">
    <Button size="sm" onClick={onSave} disabled={isLoading} className="h-8 px-4 text-xs font-semibold gap-1.5">
      {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
      {isRTL ? "حفظ" : "Save"}
    </Button>
  </div>
);

export const AccountSettings: React.FC<AccountSettingsProps> = ({ profile, onUpdate, isUpdating }) => {
  const { isRTL } = useLanguage();
  const { user, signOut } = useAuth();

  // Password
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ newPassword: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

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
    <div id="account-settings" className="card-premium overflow-hidden" dir={isRTL ? "rtl" : "ltr"}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <h3 className="text-sm font-semibold text-foreground">{isRTL ? "الحساب والإعدادات" : "Account & Settings"}</h3>
        <span className="text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-full border border-border/30 truncate max-w-[180px]">
          {user?.email}
        </span>
      </div>

      {/* ── Security ── */}
      <div className="px-4 py-4 border-b border-border/20">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          {isRTL ? "الأمان" : "Security"}
        </h4>
        <div className="space-y-2">
          <Button
            variant="outline"
            className={cn("w-full justify-start gap-2", isChangingPassword && "border-primary/40")}
            onClick={() => setIsChangingPassword((prev) => !prev)}
          >
            <Lock className="w-4 h-4" />
            {isRTL ? "تغيير كلمة المرور" : "Change password"}
          </Button>
          {isChangingPassword && (
            <div className="rounded-lg border border-border/30 p-3 bg-muted/10 space-y-2">
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
              <Actions onSave={handleChangePassword} isLoading={isPasswordLoading} isRTL={isRTL} />
            </div>
          )}
        </div>
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

      {/* ── Danger Zone (if enabled later) ── */}
      {false && (
        <div className="px-4 py-3 border-t border-destructive/30">
          <Button
            variant="ghost"
            className="w-full h-9 text-sm text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
          >
            {isRTL ? "حذف الحساب" : "Delete Account"}
          </Button>
        </div>
      )}
    </div>
  );
};
