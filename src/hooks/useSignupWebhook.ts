import { useCallback } from "react";
import { COUNTRIES } from "@/data/countryCityData";
import { sendGHLFormData } from "@/services/ghl.service";

export interface SignupWebhookData {
  full_name: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  date_of_birth?: string;
  gender?: string;
  has_motorcycle?: boolean;
  considering_purchase?: boolean | null;
  silent?: boolean;
}

function resolveCountryEnglish(country: string): string {
  if (!country) return "";
  const entry = COUNTRIES.find((c) => c.code === country || c.en === country || c.ar === country);
  return entry?.en || country;
}

function resolveCityEnglish(city: string, country: string): string {
  if (!city) return "";
  const countryEntry = COUNTRIES.find((c) => c.code === country || c.en === country || c.ar === country);
  const cityEntry = countryEntry?.cities.find((c) => c.en === city || c.ar === city);
  return cityEntry?.en || city;
}

function normalizePhone(phone: string): string {
  if (!phone) return "";
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  const withoutLeadingZeros = digits.replace(/^0+/, "");
  if (!withoutLeadingZeros) return "";
  return hasPlus ? `+${withoutLeadingZeros}` : withoutLeadingZeros;
}

export function useSignupWebhook() {
  const sendSignupData = useCallback(async (data: SignupWebhookData) => {
    const countryEnglish = resolveCountryEnglish(data.country || "");
    const cityEnglish = resolveCityEnglish(data.city || "", data.country || "");
    const phoneCleaned = normalizePhone(data.phone || "");

    // Signup-survey event — only send fields that matter for this event:
    // identity + survey answers. Profile fields (DOB / gender) go through
    // the dedicated profile webhook. Defaults like
    // `orderStatus: "not purchased"`, `courses: "[]"`, `totalPurchased: 0`
    // were noise — sendGHLFormData now omits them automatically.
    return sendGHLFormData({
      full_name: data.full_name || "",
      email: data.email || "",
      phone: phoneCleaned,
      country: countryEnglish,
      city: cityEnglish,
      has_motorcycle: data.has_motorcycle,
      considering_purchase: data.considering_purchase,
      silent: data.silent,
    });
  }, []);

  return { sendSignupData };
}
