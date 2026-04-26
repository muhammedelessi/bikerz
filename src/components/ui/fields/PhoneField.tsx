import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import SearchableDropdown from "@/components/checkout/SearchableDropdown";
import { PHONE_COUNTRIES } from "@/data/phoneCountryCodes";

export interface PhoneFieldProps {
  phonePrefix: string;
  phoneNumber: string;
  onPrefixChange: (prefix: string) => void;
  onNumberChange: (number: string) => void;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
}

export const PhoneField: React.FC<PhoneFieldProps> = ({
  phonePrefix,
  phoneNumber,
  onPrefixChange,
  onNumberChange,
  error,
  required,
  disabled,
}) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const phonePrefixOptions = useMemo(
    () =>
      PHONE_COUNTRIES.map((c) => ({
        value: `${c.prefix}_${c.code}`,
        label: `${c.prefix} ${isRTL ? c.ar : c.en}`,
      })),
    [isRTL],
  );

  return (
    <FormField
      label={t("fields.phone.label")}
      error={error}
      required={required}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="flex gap-2" dir="ltr">
        <div className="flex-shrink-0 w-[110px]">
          <SearchableDropdown
            options={phonePrefixOptions}
            value={phonePrefix}
            onChange={onPrefixChange}
            placeholder="+---"
            searchPlaceholder={isRTL ? "ابحث..." : "Search..."}
            selectedLabelBuilder={(option) =>
              option?.value.split("_")[0] || ""
            }
            hasError={!!error}
            disabled={disabled}
            dir="ltr"
          />
        </div>
        <div className="relative flex-1">
          <Input
            type="tel"
            inputMode="numeric"
            value={phoneNumber}
            onChange={(e) =>
              onNumberChange(e.target.value.replace(/[^0-9]/g, ""))
            }
            placeholder={t("fields.phone.placeholder")}
            className={`${isRTL ? "text-right" : "text-left"} ${error ? "border-destructive" : ""}`}
            dir="ltr"
            disabled={disabled}
          />
        </div>
      </div>
    </FormField>
  );
};
