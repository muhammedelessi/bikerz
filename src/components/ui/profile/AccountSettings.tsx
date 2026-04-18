import React, { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import LogoutConfirmDialog from "@/components/common/LogoutConfirmDialog";
import { cn } from "@/lib/utils";
import { PasswordField } from "@/components/ui/fields";
import {
  Lock,
  LogOut,
  Check,
  Loader2,
  Sun,
  Moon,
  Globe,
} from "lucide-react";
import { ExtendedProfile } from "@/hooks/useUserProfile";

interface AccountSettingsProps {
  profile: ExtendedProfile;
  onUpdate: (updates: Partial<ExtendedProfile>) => Promise<void>;
  isUpdating: boolean;
}

export const AccountSettings: React.FC<AccountSettingsProps> = () => {
  const { isRTL, language, toggleLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();

  // Password
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ newPassword: "", confirmPassword: "" });
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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <h3 className="text-sm font-semibold text-foreground">{isRTL ? "الحساب والإعدادات" : "Account & Settings"}</h3>
        <span className="text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-full border border-border/30 truncate max-w-[180px]">
          {user?.email}
        </span>
      </div>

      {/* Password */}
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
              <PasswordField
                value={passwordData.newPassword}
                onChange={(val) => setPasswordData((p) => ({ ...p, newPassword: val }))}
                required
                autoComplete="new-password"
              />
              <PasswordField
                value={passwordData.confirmPassword}
                onChange={(val) => setPasswordData((p) => ({ ...p, confirmPassword: val }))}
                label={isRTL ? "تأكيد كلمة المرور" : "Confirm Password"}
                required
                autoComplete="new-password"
              />
              <div className="flex items-center gap-2 mt-2.5">
                <Button size="sm" onClick={handleChangePassword} disabled={isPasswordLoading} className="h-8 px-4 text-xs font-semibold gap-1.5">
                  {isPasswordLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  {isRTL ? "حفظ" : "Save"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preferences */}
      <div className="px-4 py-4 border-b border-border/20 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {isRTL ? "التفضيلات" : "Preferences"}
        </h4>

        {/* Theme mode */}
        <div className="flex items-center gap-3 rounded-md border border-input bg-muted/30 px-3 py-2.5">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {theme === "dark" ? (
              <Moon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <Sun className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )}
            <span className="text-sm text-foreground truncate">
              {isRTL ? "وضع الموقع" : "Website mode"}
            </span>
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {theme === "dark" ? (isRTL ? "داكن" : "Dark") : (isRTL ? "فاتح" : "Light")}
          </span>
          <button
            type="button"
            dir="ltr"
            onClick={toggleTheme}
            className={cn(
              "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              theme === "dark" ? "bg-primary" : "bg-muted-foreground/30",
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                theme === "dark" ? "translate-x-[22px]" : "translate-x-[3px]",
              )}
            />
          </button>
        </div>

        {/* Language */}
        <div className="flex items-center gap-3 rounded-md border border-input bg-muted/30 px-3 py-2.5">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-foreground truncate">
              {isRTL ? "لغة الموقع" : "Website language"}
            </span>
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {language === "ar" ? "عربي" : "English"}
          </span>
          <button
            type="button"
            dir="ltr"
            onClick={toggleLanguage}
            className={cn(
              "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              language === "ar" ? "bg-primary" : "bg-muted-foreground/30",
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                language === "ar" ? "translate-x-[22px]" : "translate-x-[3px]",
              )}
            />
          </button>
        </div>
      </div>

      {/* Logout */}
      <div className="px-4 py-3">
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
