import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Lock, Eye, EyeOff } from "lucide-react";

export interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  showHint?: boolean;
  autoComplete?: string;
}

export const PasswordField: React.FC<PasswordFieldProps> = ({
  value,
  onChange,
  error,
  label,
  placeholder,
  required,
  disabled,
  showHint,
  autoComplete = "current-password",
}) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [show, setShow] = useState(false);

  return (
    <FormField
      label={label || t("fields.password.label")}
      error={error}
      required={required}
      hint={showHint ? t("fields.password.hint") : undefined}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="relative" dir="ltr">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || t("fields.password.placeholder")}
          className={`pl-10 pr-10 ${isRTL ? "text-right" : "text-left"} ${error ? "border-destructive" : ""}`}
          dir="ltr"
          disabled={disabled}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
          tabIndex={-1}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </FormField>
  );
};
