import React from "react";
import { AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";

interface FormFieldProps {
  label: string;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
  dir?: "ltr" | "rtl" | "auto";
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  required,
  children,
  hint,
  dir = "auto",
}) => {
  return (
    <div className="space-y-1.5" dir={dir}>
      <Label>
        {label} {required ? <span className="text-destructive ms-0.5">*</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      ) : null}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
};

export type { FormFieldProps };
