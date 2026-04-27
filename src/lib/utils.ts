import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Long-form DOB (aligned with profile / DateOfBirthPicker display). */
export function formatDobLong(isoDate: string | null | undefined, isRTL: boolean): string {
  if (!isoDate?.trim()) return "";
  try {
    return new Date(`${isoDate.trim()}T12:00:00`).toLocaleDateString(isRTL ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return isoDate.trim();
  }
}
