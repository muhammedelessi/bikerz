import { PHONE_COUNTRIES } from "@/data/phoneCountryCodes";
import { translateTrainerHomeLocation } from "@/lib/trainerCourseLocation";

/** Digits only for `wa.me` links (includes country code when stored as E.164). */
export function digitsForWhatsApp(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const d = phone.replace(/\D/g, "");
  return d.length > 0 ? d : null;
}

/** Match longest dial prefix and show `+966 …` with spaced national digits (same idea as checkout). */
export function formatProfilePhoneDisplay(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  const normalized = raw.trim().replace(/\s+/g, "");
  const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const c of sorted) {
    if (normalized.startsWith(c.prefix)) {
      const national = normalized.slice(c.prefix.length).replace(/\D/g, "");
      if (!national) return c.prefix;
      const grouped = national.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
      return `${c.prefix} ${grouped}`;
    }
  }
  if (normalized.startsWith("+")) return normalized;
  const digits = normalized.replace(/\D/g, "");
  return digits ? `+${digits}` : raw.trim();
}

/** Profile city + country using `COUNTRIES` labels and locale-appropriate punctuation (matches trainer-style data). */
export function formatProfileAddressLine(
  country: string | null | undefined,
  city: string | null | undefined,
  isRTL: boolean,
): string {
  const raw = translateTrainerHomeLocation(country ?? "", city ?? "", isRTL);
  if (!raw) return "";
  return raw.replace(/\s*-\s*/, isRTL ? "، " : ", ");
}
