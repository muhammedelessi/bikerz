import React, { useState, useEffect } from "react";
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
  Fingerprint,
  ShieldCheck,
  X,
} from "lucide-react";
import { ExtendedProfile } from "@/hooks/useUserProfile";
import {
  isBiometricSupported,
  isPlatformAuthenticatorAvailable,
  isBiometricEnrolled,
  getEnrolledEmail,
  enrollBiometric,
  clearBiometric,
} from "@/lib/biometric";

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

  // Biometric
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioChecked, setBioChecked] = useState(false);
  const [bioEnrolled, setBioEnrolled] = useState<boolean>(isBiometricEnrolled());
  const [bioEmail, setBioEmail] = useState<string | null>(getEnrolledEmail());
  const [bioStep, setBioStep] = useState<"idle" | "verify" | "enroll">("idle");
  const [bioPassword, setBioPassword] = useState("");
  const [bioPasswordError, setBioPasswordError] = useState<string | null>(null);
  const [bioLoading, setBioLoading] = useState(false);

  const isSecureContext = typeof window !== "undefined" && window.isSecureContext;
  const hasWebAuthnApi = isBiometricSupported();

  const unavailableReason: string | null = !isSecureContext
    ? isRTL
      ? "تتطلب هذه الميزة اتصالاً آمناً (HTTPS) أو الوصول عبر localhost."
      : "This feature requires a secure connection (HTTPS) or localhost access."
    : !hasWebAuthnApi
      ? isRTL
        ? "متصفحك لا يدعم مصادقة الويب (WebAuthn)."
        : "Your browser does not support Web Authentication (WebAuthn)."
      : bioChecked && !bioAvailable
        ? isRTL
          ? "لم يتم العثور على بصمة / تعرف على الوجه مُفعَّل على جهازك. يرجى إعداد Windows Hello أو Touch ID / Face ID من إعدادات النظام أولاً."
          : "No fingerprint or face recognition set up on this device. Please enable Windows Hello, Touch ID, or Face ID in your system settings first."
        : null;

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!hasWebAuthnApi) {
        if (mounted) {
          setBioAvailable(false);
          setBioChecked(true);
        }
        return;
      }
      try {
        const available = await isPlatformAuthenticatorAvailable();
        if (mounted) {
          setBioAvailable(available);
          setBioChecked(true);
        }
      } catch {
        if (mounted) {
          setBioAvailable(false);
          setBioChecked(true);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [hasWebAuthnApi]);

  /** Step 1: verify password only (must stay separate from WebAuthn on Safari / iOS). */
  const handleVerifyPasswordForBiometric = async () => {
    setBioPasswordError(null);
    if (!user?.email) {
      toast.error(isRTL ? "لم يتم العثور على البريد الإلكتروني" : "Email not found");
      return;
    }
    if (!bioPassword || bioPassword.length < 6) {
      setBioPasswordError(
        isRTL
          ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل"
          : "Password must be at least 6 characters",
      );
      return;
    }

    setBioLoading(true);
    try {
      const { error: verifyError } = await (supabase.auth as any).signInWithPassword({
        email: user.email,
        password: bioPassword,
      });
      if (verifyError) {
        setBioPasswordError(isRTL ? "كلمة المرور غير صحيحة" : "Incorrect password");
        return;
      }
      setBioStep("enroll");
    } finally {
      setBioLoading(false);
    }
  };

  /** Step 2: WebAuthn only — call from its own button press (fresh user gesture for Face ID / Touch ID). */
  const handleRegisterBiometricOnDevice = async () => {
    if (!user?.email || !bioPassword) {
      toast.error(isRTL ? "أعد إدخال كلمة المرور" : "Please enter your password again");
      setBioStep("verify");
      return;
    }

    try {
      await enrollBiometric(user.email, bioPassword);
      setBioEnrolled(true);
      setBioEmail(user.email);
      setBioStep("idle");
      setBioPassword("");
      toast.success(isRTL ? "تم تفعيل تسجيل الدخول بالبصمة" : "Biometric sign-in enabled");
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : "";
      const name = err instanceof Error ? err.name : "";
      if (code === "BIOMETRIC_UNSUPPORTED" || name === "NotSupportedError") {
        toast.error(isRTL ? "متصفحك لا يدعم هذه الميزة" : "Your browser does not support this feature");
      } else if (code === "NotAllowedError" || code === "BIOMETRIC_CANCELLED") {
        toast.error(isRTL ? "تم إلغاء العملية" : "Operation cancelled");
      } else {
        toast.error(isRTL ? "فشل تفعيل البصمة" : "Failed to enable biometric");
      }
    }
  };

  const handleDisableBiometric = () => {
    clearBiometric();
    setBioEnrolled(false);
    setBioEmail(null);
    setBioStep("idle");
    setBioPassword("");
    toast.success(
      isRTL ? "تم تعطيل تسجيل الدخول بالبصمة" : "Biometric sign-in disabled",
    );
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

          {/* Biometric login */}
          <div className="pt-1">
            {!bioAvailable ? (
              <div className="rounded-lg border border-border/30 bg-muted/10 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Fingerprint className="w-4 h-4 text-muted-foreground" />
                  {isRTL
                    ? "تسجيل الدخول بالبصمة أو التعرف على الوجه"
                    : "Fingerprint or face sign-in"}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {!bioChecked
                    ? isRTL
                      ? "جارٍ التحقق من دعم الجهاز..."
                      : "Checking device support..."
                    : unavailableReason}
                </p>
              </div>
            ) : bioEnrolled ? (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Fingerprint className="w-3.5 h-3.5" />
                      {isRTL ? "تسجيل الدخول بالبصمة مفعّل" : "Biometric sign-in enabled"}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {bioEmail}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDisableBiometric}
                      className="h-7 px-2 mt-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                    >
                      <X className="w-3 h-3" />
                      {isRTL ? "تعطيل" : "Disable"}
                    </Button>
                  </div>
                </div>
              ) : bioStep === "idle" ? (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setBioStep("verify")}
                >
                  <Fingerprint className="w-4 h-4" />
                  {isRTL
                    ? "تفعيل البصمة أو التعرف على الوجه"
                    : "Enable fingerprint or face sign-in"}
                </Button>
              ) : bioStep === "verify" ? (
                <div className="rounded-lg border border-border/30 p-3 bg-muted/10 space-y-2">
                  <div className="flex items-start gap-2">
                    <Fingerprint className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {isRTL
                        ? "أدخل كلمة المرور الحالية للتحقق أولاً."
                        : "Enter your current password to verify first."}
                    </p>
                  </div>
                  <PasswordField
                    value={bioPassword}
                    onChange={(val) => {
                      setBioPassword(val);
                      setBioPasswordError(null);
                    }}
                    label={isRTL ? "كلمة المرور الحالية" : "Current password"}
                    error={bioPasswordError}
                    required
                    autoComplete="current-password"
                    disabled={bioLoading}
                  />
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleVerifyPasswordForBiometric}
                      disabled={bioLoading}
                      className="h-8 gap-1.5 px-4 text-xs font-semibold"
                    >
                      {bioLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      {isRTL ? "متابعة" : "Continue"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setBioStep("idle");
                        setBioPassword("");
                        setBioPasswordError(null);
                      }}
                      disabled={bioLoading}
                      className="h-8 px-3 text-xs"
                    >
                      {isRTL ? "إلغاء" : "Cancel"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-border/30 p-3 bg-muted/10 space-y-3">
                  <div className="flex items-start gap-2">
                    <Fingerprint className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
                      <p>
                        {isRTL
                          ? "اضغط الزر التالي، ثم أكّد الطلب على جهازك (Face ID أو Touch ID أو Windows Hello)."
                          : "Tap the button below, then confirm on your device (Face ID, Touch ID, or Windows Hello)."}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    type="button"
                    className="h-9 w-full gap-2 text-xs font-semibold"
                    onClick={handleRegisterBiometricOnDevice}
                  >
                    <Fingerprint className="h-3.5 w-3.5" />
                    {isRTL ? "تسجيل البصمة على هذا الجهاز" : "Register biometrics on this device"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    className="h-8 w-full text-xs"
                    onClick={() => setBioStep("verify")}
                  >
                    {isRTL ? "← العودة لكلمة المرور" : "← Back to password"}
                  </Button>
                </div>
              )}
          </div>
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
