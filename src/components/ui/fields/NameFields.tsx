import React from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { cn } from "@/lib/utils";

export interface NameFieldsProps {
  firstName: string;
  lastName: string;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  firstNameError?: string | null;
  lastNameError?: string | null;
  firstNameLabel?: string;
  lastNameLabel?: string;
  firstNamePlaceholder?: string;
  lastNamePlaceholder?: string;
  required?: boolean;
  disabled?: boolean;
  inputDir?: "ltr" | "rtl";
  inputClassName?: string;
}

export const NameFields: React.FC<NameFieldsProps> = ({
  firstName,
  lastName,
  onFirstNameChange,
  onLastNameChange,
  firstNameError,
  lastNameError,
  firstNameLabel,
  lastNameLabel,
  firstNamePlaceholder,
  lastNamePlaceholder,
  required,
  disabled,
  inputDir,
  inputClassName,
}) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <FormField
        label={firstNameLabel || t("fields.firstName.label")}
        error={firstNameError}
        required={required}
      >
        <Input
          value={firstName}
          onChange={(e) => onFirstNameChange(e.target.value)}
          placeholder={firstNamePlaceholder || t("fields.firstName.placeholder")}
          className={cn(inputClassName, firstNameError && "border-destructive")}
          autoComplete="given-name"
          disabled={disabled}
          dir={inputDir}
        />
      </FormField>
      <FormField
        label={lastNameLabel || t("fields.lastName.label")}
        error={lastNameError}
        required={required}
      >
        <Input
          value={lastName}
          onChange={(e) => onLastNameChange(e.target.value)}
          placeholder={lastNamePlaceholder || t("fields.lastName.placeholder")}
          className={cn(inputClassName, lastNameError && "border-destructive")}
          autoComplete="family-name"
          disabled={disabled}
          dir={inputDir}
        />
      </FormField>
    </div>
  );
};
