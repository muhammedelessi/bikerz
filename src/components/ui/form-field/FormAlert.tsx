import React from "react";
import { AlertCircle } from "lucide-react";

interface FormAlertProps {
  message: string | null;
}

export const FormAlert: React.FC<FormAlertProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
      <AlertCircle className="w-5 h-5 text-destructive" />
      <p className="text-sm text-destructive">{message}</p>
    </div>
  );
};

export type { FormAlertProps };
