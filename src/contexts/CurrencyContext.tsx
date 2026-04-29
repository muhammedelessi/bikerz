import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clampTrainingVatPercent } from "@/lib/trainingPlatformMarkup";
import { fetchCountryCodeFromPublicGeoApis, normalizeCountryCode } from "@/lib/publicGeoCountry";

export type CurrencyCode =
  | "SAR"
  | "AED"
  | "KWD"
  | "BHD"
  | "QAR"
  | "OMR"
  | "JOD"
  | "EGP"
  | "IQD"
  | "SYP"
  | "LBP"
  | "YER"
  | "LYD"
  | "TND"
  | "DZD"
  | "MAD"
  | "SDG"
  | "SOS"
  | "MRU"
  | "KMF"
  | "DJF"
  | "ILS"
  | "USD"
  | "GBP"
  | "EUR"
  | "CAD"
  | "AUD"
  | "NZD"
  | "CHF"
  | "SEK"
  | "NOK"
  | "DKK"
  | "PLN"
  | "CZK"
  | "HUF"
  | "RON"
  | "BGN"
  | "TRY"
  | "RUB"
  | "UAH"
  | "PKR"
  | "INR"
  | "BDT"
  | "LKR"
  | "NPR"
  | "AFN"
  | "IRR"
  | "CNY"
  | "JPY"
  | "KRW"
  | "HKD"
  | "TWD"
  | "SGD"
  | "MYR"
  | "IDR"
  | "THB"
  | "PHP"
  | "VND"
  | "ZAR"
  | "NGN"
  | "KES"
  | "GHS"
  | "TZS"
  | "UGX"
  | "ETB"
  | "XOF"
  | "XAF"
  | "MXN"
  | "BRL"
  | "ARS"
  | "CLP"
  | "COP"
  | "PEN";

interface CurrencyMeta {
  symbol: string;
  symbolAr: string;
}

const CURRENCY_META: Record<CurrencyCode, CurrencyMeta> = {
  SAR: { symbol: "SAR", symbolAr: "ر.س" },
  AED: { symbol: "AED", symbolAr: "د.إ" },
  KWD: { symbol: "KWD", symbolAr: "د.ك" },
  BHD: { symbol: "BHD", symbolAr: "د.ب" },
  QAR: { symbol: "QAR", symbolAr: "ر.ق" },
  OMR: { symbol: "OMR", symbolAr: "ر.ع" },
  JOD: { symbol: "JOD", symbolAr: "د.أ" },
  EGP: { symbol: "EGP", symbolAr: "ج.م" },
  IQD: { symbol: "IQD", symbolAr: "د.ع" },
  SYP: { symbol: "SYP", symbolAr: "ل.س" },
  LBP: { symbol: "LBP", symbolAr: "ل.ل" },
  YER: { symbol: "YER", symbolAr: "ر.ي" },
  LYD: { symbol: "LYD", symbolAr: "د.ل" },
  TND: { symbol: "TND", symbolAr: "د.ت" },
  DZD: { symbol: "DZD", symbolAr: "د.ج" },
  MAD: { symbol: "MAD", symbolAr: "د.م" },
  SDG: { symbol: "SDG", symbolAr: "ج.س" },
  SOS: { symbol: "SOS", symbolAr: "ش.ص" },
  MRU: { symbol: "MRU", symbolAr: "أ.م" },
  KMF: { symbol: "KMF", symbolAr: "ف.ق" },
  DJF: { symbol: "DJF", symbolAr: "ف.ج" },
  ILS: { symbol: "ILS", symbolAr: "₪" },
  USD: { symbol: "USD", symbolAr: "$" },
  GBP: { symbol: "GBP", symbolAr: "£" },
  EUR: { symbol: "EUR", symbolAr: "€" },
  CAD: { symbol: "CAD", symbolAr: "$" },
  AUD: { symbol: "AUD", symbolAr: "$" },
  NZD: { symbol: "NZD", symbolAr: "$" },
  CHF: { symbol: "CHF", symbolAr: "Fr" },
  SEK: { symbol: "SEK", symbolAr: "kr" },
  NOK: { symbol: "NOK", symbolAr: "kr" },
  DKK: { symbol: "DKK", symbolAr: "kr" },
  PLN: { symbol: "PLN", symbolAr: "zł" },
  CZK: { symbol: "CZK", symbolAr: "Kč" },
  HUF: { symbol: "HUF", symbolAr: "Ft" },
  RON: { symbol: "RON", symbolAr: "lei" },
  BGN: { symbol: "BGN", symbolAr: "лв" },
  TRY: { symbol: "TRY", symbolAr: "₺" },
  RUB: { symbol: "RUB", symbolAr: "₽" },
  UAH: { symbol: "UAH", symbolAr: "₴" },
  PKR: { symbol: "PKR", symbolAr: "₨" },
  INR: { symbol: "INR", symbolAr: "₹" },
  BDT: { symbol: "BDT", symbolAr: "৳" },
  LKR: { symbol: "LKR", symbolAr: "₨" },
  NPR: { symbol: "NPR", symbolAr: "₨" },
  AFN: { symbol: "AFN", symbolAr: "؋" },
  IRR: { symbol: "IRR", symbolAr: "﷼" },
  CNY: { symbol: "CNY", symbolAr: "¥" },
  JPY: { symbol: "JPY", symbolAr: "¥" },
  KRW: { symbol: "KRW", symbolAr: "₩" },
  HKD: { symbol: "HKD", symbolAr: "$" },
  TWD: { symbol: "TWD", symbolAr: "$" },
  SGD: { symbol: "SGD", symbolAr: "$" },
  MYR: { symbol: "MYR", symbolAr: "RM" },
  IDR: { symbol: "IDR", symbolAr: "Rp" },
  THB: { symbol: "THB", symbolAr: "฿" },
  PHP: { symbol: "PHP", symbolAr: "₱" },
  VND: { symbol: "VND", symbolAr: "₫" },
  ZAR: { symbol: "ZAR", symbolAr: "R" },
  NGN: { symbol: "NGN", symbolAr: "₦" },
  KES: { symbol: "KES", symbolAr: "KSh" },
  GHS: { symbol: "GHS", symbolAr: "₵" },
  TZS: { symbol: "TZS", symbolAr: "TSh" },
  UGX: { symbol: "UGX", symbolAr: "USh" },
  ETB: { symbol: "ETB", symbolAr: "Br" },
  XOF: { symbol: "XOF", symbolAr: "CFA" },
  XAF: { symbol: "XAF", symbolAr: "FCFA" },
  MXN: { symbol: "MXN", symbolAr: "$" },
  BRL: { symbol: "BRL", symbolAr: "R$" },
  ARS: { symbol: "ARS", symbolAr: "$" },
  CLP: { symbol: "CLP", symbolAr: "$" },
  COP: { symbol: "COP", symbolAr: "$" },
  PEN: { symbol: "PEN", symbolAr: "S/" },
};

/** Placeholder course id for `getCoursePriceInfo` when pricing SAR training offers like video courses */
export const TRAINING_PRICE_PLACEHOLDER_COURSE_ID = "00000000-0000-4000-8000-000000000001";

/** Arabic full currency name after amount (value first, then name) */
const CURRENCY_FULL_NAME_AR: Record<CurrencyCode, string> = {
  SAR: "ريال سعودي",
  AED: "درهم إماراتي",
  KWD: "دينار كويتي",
  BHD: "دينار بحريني",
  QAR: "ريال قطري",
  OMR: "ريال عماني",
  JOD: "دينار أردني",
  EGP: "جنيه مصري",
  IQD: "دينار عراقي",
  SYP: "ليرة سورية",
  LBP: "ليرة لبنانية",
  YER: "ريال يمني",
  LYD: "دينار ليبي",
  TND: "دينار تونسي",
  DZD: "دينار جزائري",
  MAD: "درهم مغربي",
  SDG: "جنيه سوداني",
  SOS: "شلن صومالي",
  MRU: "أوقية موريتانية",
  KMF: "فرنك قمري",
  DJF: "فرنك جيبوتي",
  ILS: "شيكل إسرائيلي",
  USD: "دولار أمريكي",
  GBP: "جنيه إسترليني",
  EUR: "يورو",
  CAD: "دولار كندي",
  AUD: "دولار أسترالي",
  NZD: "دولار نيوزيلندي",
  CHF: "فرنك سويسري",
  SEK: "كرونة سويدية",
  NOK: "كرونة نرويجية",
  DKK: "كرونة دنماركية",
  PLN: "زلوتي بولندي",
  CZK: "كرونة تشيكية",
  HUF: "فورنت مجري",
  RON: "ليو روماني",
  BGN: "ليف بلغاري",
  TRY: "ليرة تركية",
  RUB: "روبل روسي",
  UAH: "هريفنيا أوكرانية",
  PKR: "روبية باكستانية",
  INR: "روبية هندية",
  BDT: "تاكا بنغلاديشي",
  LKR: "روبية سريلانكية",
  NPR: "روبية نيبالية",
  AFN: "أفغاني",
  IRR: "ريال إيراني",
  CNY: "يوان صيني",
  JPY: "ين ياباني",
  KRW: "وون كوري",
  HKD: "دولار هونغ كونغ",
  TWD: "دولار تايواني",
  SGD: "دولار سنغافوري",
  MYR: "رينغيت ماليزي",
  IDR: "روبية إندونيسية",
  THB: "بات تايلندي",
  PHP: "بيزو فلبيني",
  VND: "دونغ فيتنامي",
  ZAR: "راند جنوب أفريقي",
  NGN: "نايرا نيجيري",
  KES: "شلن كيني",
  GHS: "سيدي غاني",
  TZS: "شلن تنزاني",
  UGX: "شلن أوغندي",
  ETB: "بير إثيوبي",
  XOF: "فرنك غرب أفريقي",
  XAF: "فرنك وسط أفريقي",
  MXN: "بيزو مكسيكي",
  BRL: "ريال برازيلي",
  ARS: "بيزو أرجنتيني",
  CLP: "بيزو تشيلي",
  COP: "بيزو كولومبي",
  PEN: "سول بيروفي",
};

const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
  // GCC + Arab world
  SA: "SAR",
  AE: "AED",
  KW: "KWD",
  BH: "BHD",
  QA: "QAR",
  OM: "OMR",
  JO: "JOD",
  EG: "EGP",
  IQ: "IQD",
  SY: "SYP",
  LB: "LBP",
  YE: "YER",
  LY: "LYD",
  TN: "TND",
  DZ: "DZD",
  MA: "MAD",
  SD: "SDG",
  SO: "SOS",
  MR: "MRU",
  KM: "KMF",
  DJ: "DJF",
  PS: "ILS",
  IL: "ILS",
  // Anglosphere
  US: "USD",
  GB: "GBP",
  CA: "CAD",
  AU: "AUD",
  NZ: "NZD",
  IE: "EUR",
  // Eurozone
  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  PT: "EUR",
  FI: "EUR",
  GR: "EUR",
  LU: "EUR",
  SK: "EUR",
  SI: "EUR",
  EE: "EUR",
  LV: "EUR",
  LT: "EUR",
  CY: "EUR",
  MT: "EUR",
  HR: "EUR",
  // Other Europe
  CH: "CHF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  PL: "PLN",
  CZ: "CZK",
  HU: "HUF",
  RO: "RON",
  BG: "BGN",
  TR: "TRY",
  RU: "RUB",
  UA: "UAH",
  // South Asia
  PK: "PKR",
  IN: "INR",
  BD: "BDT",
  LK: "LKR",
  NP: "NPR",
  AF: "AFN",
  IR: "IRR",
  // East / SE Asia
  CN: "CNY",
  JP: "JPY",
  KR: "KRW",
  HK: "HKD",
  TW: "TWD",
  SG: "SGD",
  MY: "MYR",
  ID: "IDR",
  TH: "THB",
  PH: "PHP",
  VN: "VND",
  // Sub-Saharan Africa
  ZA: "ZAR",
  NG: "NGN",
  KE: "KES",
  GH: "GHS",
  TZ: "TZS",
  UG: "UGX",
  ET: "ETB",
  SN: "XOF",
  CI: "XOF",
  ML: "XOF",
  BF: "XOF",
  BJ: "XOF",
  TG: "XOF",
  NE: "XOF",
  GW: "XOF",
  CM: "XAF",
  GA: "XAF",
  CG: "XAF",
  TD: "XAF",
  CF: "XAF",
  GQ: "XAF",
  // Latin America
  MX: "MXN",
  BR: "BRL",
  AR: "ARS",
  CL: "CLP",
  CO: "COP",
  PE: "PEN",
};

// Fallback rates (SAR → X) used if live fetch fails. Live rates from open.er-api.com override these.
const FALLBACK_RATES: Record<CurrencyCode, number> = {
  SAR: 1,
  AED: 0.979,
  KWD: 0.082,
  BHD: 0.1,
  QAR: 0.971,
  OMR: 0.103,
  JOD: 0.189,
  EGP: 13.97,
  IQD: 348.89,
  SYP: 30.37,
  LBP: 23867,
  YER: 63.58,
  LYD: 1.694,
  TND: 0.782,
  DZD: 35.08,
  MAD: 2.511,
  SDG: 135.35,
  SOS: 152,
  MRU: 10.651,
  KMF: 114.55,
  DJF: 47.39,
  ILS: 0.837,
  USD: 0.267,
  GBP: 0.211,
  EUR: 0.247,
  CAD: 0.367,
  AUD: 0.41,
  NZD: 0.448,
  CHF: 0.235,
  SEK: 2.83,
  NOK: 2.85,
  DKK: 1.84,
  PLN: 1.08,
  CZK: 6.13,
  HUF: 96.4,
  RON: 1.23,
  BGN: 0.483,
  TRY: 9.16,
  RUB: 24.6,
  UAH: 11.05,
  PKR: 74.5,
  INR: 22.5,
  BDT: 31.8,
  LKR: 80.6,
  NPR: 36.0,
  AFN: 19.0,
  IRR: 11250,
  CNY: 1.93,
  JPY: 41.5,
  KRW: 365,
  HKD: 2.08,
  TWD: 8.55,
  SGD: 0.36,
  MYR: 1.26,
  IDR: 4250,
  THB: 9.45,
  PHP: 15.5,
  VND: 6750,
  ZAR: 4.95,
  NGN: 415,
  KES: 34.5,
  GHS: 4.05,
  TZS: 705,
  UGX: 990,
  ETB: 33.0,
  XOF: 162,
  XAF: 162,
  MXN: 5.05,
  BRL: 1.55,
  ARS: 268,
  CLP: 256,
  COP: 1090,
  PEN: 1.0,
};


const VAT_RATE = 15; // Saudi VAT — server always charges 15%

const RATES_CACHE_KEY = "bikerz_exchange_rates";
const CURRENCY_CACHE_KEY = "bikerz_currency";
const COUNTRY_CACHE_KEY = "bikerz_detected_country";
const CACHE_TTL_MS = 3600_000; // 1 hour

interface CachedRates {
  rates: Record<string, number>;
  fetchedAt: number;
}

interface CountryPrice {
  course_id: string;
  country_code: string;
  original_price: number;
  discount_percentage: number;
  price: number;
  currency: string;
}

export interface CoursePriceInfo {
  /** The base price to display (country original_price or converted SAR) */
  originalPrice: number;
  /** Discount percentage (country-level if exists, otherwise course-level) */
  discountPct: number;
  /** Final price after discount */
  finalPrice: number;
  /** Currency code */
  currency: CurrencyCode;
  /** Whether a country-specific price was used */
  isCountryPrice: boolean;
  /** VAT percentage for this country (0 for non-SA countries unless explicitly set) */
  vatPct: number;
}

interface CurrencyContextType {
  currencyCode: CurrencyCode;
  symbol: string;
  symbolAr: string;
  setCurrency: (code: CurrencyCode) => void;
  /** Convert a SAR price to local currency, Math.ceil()'d */
  convertPrice: (sarPrice: number) => number;
  /** Get price for a specific course considering country-specific pricing */
  getCoursePrice: (courseId: string, sarPrice: number) => number;
  /** Get full price info for a course (original, discount, final) considering country pricing */
  getCoursePriceInfo: (
    courseId: string,
    sarPrice: number,
    courseDiscountPct?: number,
    opts?: { vatPercent?: number | null },
  ) => CoursePriceInfo;
  /** Get the currency code for a course price (may differ from user currency if country price exists) */
  getCourseCurrency: (courseId: string) => CurrencyCode;
  /** Format a SAR price as local currency string */
  formatPrice: (sarPrice: number, isRTL?: boolean) => string;
  /** Format a course price using country-specific pricing if available */
  formatCoursePrice: (courseId: string, sarPrice: number, isRTL?: boolean) => string;
  /** Get SAR total with 15% VAT, Math.round()'d — this is what Tap charges */
  getSarTotalWithVat: (sarPrice: number) => number;
  /** Tax breakdown in local currency for display */
  calculateTax: (sarPrice: number) => { subtotal: number; tax: number; total: number };
  /** Calculate tax for a course with country-specific pricing */
  calculateCourseTax: (courseId: string, sarPrice: number) => { subtotal: number; tax: number; total: number };
  /** Same as getSarTotalWithVat (kept for backward compat) */
  calculateTotalWithTax: (sarPrice: number) => number;
  isDetecting: boolean;
  detectedCountry: string | null;
  vatRate: number;
  vatLabel: string;
  vatLabelAr: string;
  isSAR: boolean;
  /** Raw exchange rate: how many local currency units = 1 SAR */
  exchangeRate: number;
  /** Check if a country-specific price exists for a course */
  hasCountryPrice: (courseId: string) => boolean;
  /** Get the display symbol for a given CurrencyCode based on locale */
  getCurrencySymbol: (code: CurrencyCode, isRTL?: boolean) => string;
  /** Formatted as "{amount} {currency name}" using user locale; SAR → "… ريال سعودي" in Arabic, "… SAR" in English */
  formatPriceValueThenCurrencyName: (info: CoursePriceInfo, isRTL?: boolean) => string;
  /** Training offer: pass SAR subtotal after platform markup (before VAT); VAT% from admin when provided */
  formatTrainingOfferPrice: (sarPrice: number, isRTL?: boolean, opts?: { vatPercent?: number | null }) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currencyCode, setCurrencyCodeState] = useState<CurrencyCode>(() => {
    try {
      const saved = sessionStorage.getItem(CURRENCY_CACHE_KEY);
      if (saved && saved in CURRENCY_META) return saved as CurrencyCode;
    } catch {
      // Ignore restricted-storage environments on iOS
    }
    return "SAR";
  });
  const [rates, setRates] = useState<Record<string, number>>(FALLBACK_RATES);
  const [isDetecting, setIsDetecting] = useState(true);
  const [detectedCountry, setDetectedCountry] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(COUNTRY_CACHE_KEY);
    } catch {
      return null;
    }
  });
  const [countryPrices, setCountryPrices] = useState<CountryPrice[]>([]);

  const meta = CURRENCY_META[currencyCode];
  const isSAR = currencyCode === "SAR";

  // Keep currency synced with cached detected country (avoids stale sessionStorage mismatches).
  useEffect(() => {
    if (!detectedCountry) return;
    const upper = detectedCountry.toUpperCase();
    const mapped = COUNTRY_TO_CURRENCY[upper];
    if (mapped && mapped !== currencyCode) {
      setCurrencyCodeState(mapped);
      try {
        sessionStorage.setItem(CURRENCY_CACHE_KEY, mapped);
      } catch {
        // Ignore restricted-storage environments on iOS
      }
    }
  }, [detectedCountry, currencyCode]);

  // ── Fetch country-specific prices ──
  useEffect(() => {
    const loadCountryPrices = async () => {
      const { data } = await supabase
        .from("course_country_prices")
        .select("course_id, country_code, price, currency, original_price, discount_percentage");
      if (data) {
        setCountryPrices(
          data.map((d) => ({
            course_id: d.course_id,
            country_code: d.country_code,
            original_price: Number(d.original_price) || Number(d.price),
            discount_percentage: Number(d.discount_percentage) || 0,
            price: Number(d.price),
            currency: d.currency,
          })),
        );
      }
    };
    loadCountryPrices();
  }, []);

  // ── Fetch live exchange rates ──
  useEffect(() => {
    const loadRates = async () => {
      // Check sessionStorage cache
      let cached: string | null = null;
      try {
        cached = sessionStorage.getItem(RATES_CACHE_KEY);
      } catch {
        cached = null;
      }

      if (cached) {
        try {
          const parsed: CachedRates = JSON.parse(cached);
          if (Date.now() - parsed.fetchedAt < CACHE_TTL_MS) {
            setRates((prev) => ({ ...prev, ...parsed.rates }));
            return;
          }
        } catch {
          /* ignore corrupt cache */
        }
      }

      try {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timeout = setTimeout(() => controller?.abort(), 8000);
        const res = await fetch(
          "https://open.er-api.com/v6/latest/SAR",
          controller ? { signal: controller.signal } : undefined,
        );
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          if (data?.rates) {
            const newRates: Record<string, number> = { SAR: 1 };
            for (const code of Object.keys(CURRENCY_META)) {
              if (data.rates[code] != null) {
                newRates[code] = data.rates[code];
              }
            }
            setRates((prev) => ({ ...prev, ...newRates }));

            try {
              sessionStorage.setItem(
                RATES_CACHE_KEY,
                JSON.stringify({ rates: newRates, fetchedAt: Date.now() } as CachedRates),
              );
            } catch {
              // Ignore restricted-storage environments on iOS
            }
          }
        }
      } catch {
        // Silently fall back to hardcoded rates
      }
    };

    loadRates();
  }, []);

  // ── Auto-detect country on mount ──
  useEffect(() => {
    const applyGeoFallback = () => {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone?.toUpperCase() || "";
        const isPalestineTz = tz.includes("GAZA") || tz.includes("HEBRON") || tz.includes("JERUSALEM");

        if (isPalestineTz) {
          setDetectedCountry("PS");
          setCurrencyCodeState("ILS");
          try {
            sessionStorage.setItem(COUNTRY_CACHE_KEY, "PS");
            sessionStorage.setItem(CURRENCY_CACHE_KEY, "ILS");
          } catch {
            // Ignore restricted-storage environments on iOS
          }
          return;
        }
      } catch {
        // Ignore timezone detection failures
      }

      setDetectedCountry(null);
      setCurrencyCodeState("SAR");
    };

    const detectLocation = async () => {
      let cachedCountry: string | null = null;
      try {
        cachedCountry = sessionStorage.getItem(COUNTRY_CACHE_KEY);
      } catch {
        cachedCountry = null;
      }
      const normalizedCache = normalizeCountryCode(cachedCountry);
      if (normalizedCache) {
        setDetectedCountry(normalizedCache);
        const detected = COUNTRY_TO_CURRENCY[normalizedCache];
        if (detected) {
          setCurrencyCodeState((prev) => (prev === detected ? prev : detected));
          try {
            sessionStorage.setItem(CURRENCY_CACHE_KEY, detected);
          } catch {
            // Ignore restricted-storage environments on iOS
          }
        } else {
          setCurrencyCodeState((prev) => (prev === "USD" ? prev : "USD"));
          try {
            sessionStorage.setItem(CURRENCY_CACHE_KEY, "USD");
          } catch {
            // Ignore restricted-storage environments on iOS
          }
        }
        setIsDetecting(false);
        return;
      }

      try {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timeout = setTimeout(() => controller?.abort(), 8000);
        const country = await fetchCountryCodeFromPublicGeoApis(controller?.signal);
        clearTimeout(timeout);

        if (country) {
          setDetectedCountry(country);
          try {
            sessionStorage.setItem(COUNTRY_CACHE_KEY, country);
          } catch {
            // Ignore restricted-storage environments on iOS
          }

          const detected = COUNTRY_TO_CURRENCY[country];
          if (detected) {
            setCurrencyCodeState((prev) => (prev === detected ? prev : detected));
            try {
              sessionStorage.setItem(CURRENCY_CACHE_KEY, detected);
            } catch {
              // Ignore restricted-storage environments on iOS
            }
          } else {
            setCurrencyCodeState((prev) => (prev === "USD" ? prev : "USD"));
            try {
              sessionStorage.setItem(CURRENCY_CACHE_KEY, "USD");
            } catch {
              // Ignore restricted-storage environments on iOS
            }
          }
        } else {
          applyGeoFallback();
        }
      } catch {
        applyGeoFallback();
      } finally {
        setIsDetecting(false);
      }
    };

    detectLocation();
  }, []);

  const setCurrency = useCallback((code: CurrencyCode) => {
    setCurrencyCodeState(code);
    try {
      sessionStorage.setItem(CURRENCY_CACHE_KEY, code);
    } catch {
      // Ignore restricted-storage environments on iOS
    }
  }, []);

  const rate = rates[currencyCode] ?? FALLBACK_RATES[currencyCode] ?? 1;

  /** Check if country-specific price exists for a course */
  const hasCountryPrice = useCallback(
    (courseId: string): boolean => {
      if (!detectedCountry) return false;
      return countryPrices.some((cp) => cp.course_id === courseId && cp.country_code === detectedCountry);
    },
    [detectedCountry, countryPrices],
  );

  /** Get the country-specific price for a course, or null */
  const getCountryPriceEntry = useCallback(
    (courseId: string): CountryPrice | null => {
      if (!detectedCountry) return null;
      return countryPrices.find((cp) => cp.course_id === courseId && cp.country_code === detectedCountry) || null;
    },
    [detectedCountry, countryPrices],
  );

  /** Get price for a specific course — uses country price if available, otherwise converts */
  const getCoursePrice = useCallback(
    (courseId: string, sarPrice: number): number => {
      const entry = getCountryPriceEntry(courseId);
      if (entry) return Math.ceil(entry.price);
      // Fallback to conversion
      if (currencyCode === "SAR") return Math.ceil(sarPrice);
      return Math.ceil(sarPrice * rate);
    },
    [getCountryPriceEntry, currencyCode, rate],
  );

  /** Get full price info for display — uses country pricing when available */
  const getCoursePriceInfo = useCallback(
    (courseId: string, sarPrice: number, courseDiscountPct = 0, opts?: { vatPercent?: number | null }): CoursePriceInfo => {
      const entry = getCountryPriceEntry(courseId);
      if (entry) {
        const ccy = currencyCode;
        const origNoVat = Math.ceil(entry.original_price);
        const entryVat = (entry as any).vat_percentage ?? (detectedCountry === "SA" ? 15 : 0);
        const finalPrice = entryVat > 0 ? Math.ceil(entry.price * (1 + entryVat / 100)) : Math.ceil(entry.price);
        return {
          originalPrice: origNoVat,
          discountPct: entry.discount_percentage,
          finalPrice,
          currency: ccy,
          isCountryPrice: true,
          vatPct: entryVat,
        };
      }
      /**
       * Practical training: `sarPrice` is subtotal after platform commission (before VAT), always in SAR.
       * Tap charges SAR — show the same SAR total to every user (no FX conversion on this price).
       */
      if (courseId === TRAINING_PRICE_PLACEHOLDER_COURSE_ID) {
        const rawVat = opts?.vatPercent;
        const trainingVat = clampTrainingVatPercent(
          rawVat !== undefined && rawVat !== null && Number.isFinite(Number(rawVat)) ? Number(rawVat) : 0,
        );
        const subtotalSar = Math.max(0, Math.round(Number(sarPrice) * 100) / 100);
        const finalSar =
          subtotalSar <= 0 ? 0 : Math.ceil(subtotalSar * (1 + trainingVat / 100));
        return {
          originalPrice: subtotalSar,
          discountPct: 0,
          finalPrice: finalSar,
          currency: "SAR",
          isCountryPrice: false,
          vatPct: trainingVat,
        };
      }
      const convertedBase =
        currencyCode === "SAR"
          ? Math.ceil(sarPrice)
          : Math.ceil(sarPrice * rate);
      const dPct = courseDiscountPct > 0 ? courseDiscountPct : 0;
      const finalBeforeVat = dPct > 0 ? Math.ceil(convertedBase * (1 - dPct / 100)) : convertedBase;
      const vatForFallback = currencyCode === "SAR" ? VAT_RATE : 0;
      const finalPrice = vatForFallback > 0 ? Math.ceil(finalBeforeVat * (1 + vatForFallback / 100)) : finalBeforeVat;
      return {
        originalPrice: convertedBase,
        discountPct: dPct,
        finalPrice,
        currency: currencyCode,
        isCountryPrice: false,
        vatPct: vatForFallback,
      };
    },
    [getCountryPriceEntry, currencyCode, rate, detectedCountry],
  );

  const getCourseCurrency = useCallback(
    (courseId: string): CurrencyCode => {
      const entry = getCountryPriceEntry(courseId);
      // Keep currency aligned with the user's detected currency.
      return entry ? currencyCode : currencyCode;
    },
    [getCountryPriceEntry, currencyCode],
  );

  /** Convert SAR → local, rounded */
  const convertPrice = useCallback(
    (sarPrice: number): number => {
      if (currencyCode === "SAR") return Math.ceil(sarPrice);
      return Math.ceil(sarPrice * rate);
    },
    [currencyCode, rate],
  );

  /** Format SAR price as local currency string */
  const formatPrice = useCallback(
    (sarPrice: number, isRTL = false): string => {
      const converted = convertPrice(sarPrice);
      const sym = isRTL ? meta.symbolAr : meta.symbol;
      return `${converted} ${sym}`;
    },
    [convertPrice, meta],
  );

  /** Format a course price using country-specific pricing if available */
  const formatCoursePrice = useCallback(
    (courseId: string, sarPrice: number, isRTL = false): string => {
      const price = getCoursePrice(courseId, sarPrice);
      const courseCurrency = getCourseCurrency(courseId);
      const courseMeta = CURRENCY_META[courseCurrency];
      const sym = isRTL ? courseMeta.symbolAr : courseMeta.symbol;
      return `${price} ${sym}`;
    },
    [getCoursePrice, getCourseCurrency],
  );

  /** SAR total after 15% VAT — the exact amount Tap will charge */
  const getSarTotalWithVat = useCallback((sarPrice: number): number => Math.ceil(sarPrice * 1.15), []);

  /** Tax breakdown in local currency for display purposes */
  const calculateTax = useCallback(
    (sarPrice: number) => {
      const subtotal = convertPrice(sarPrice);
      const tax = Math.ceil(subtotal * (VAT_RATE / 100));
      const total = subtotal + tax;
      return { subtotal, tax, total };
    },
    [convertPrice],
  );

  /** Tax breakdown for a course with country-specific pricing */
  const calculateCourseTax = useCallback(
    (courseId: string, sarPrice: number) => {
      const subtotal = getCoursePrice(courseId, sarPrice);
      const tax = Math.ceil(subtotal * (VAT_RATE / 100));
      const total = subtotal + tax;
      return { subtotal, tax, total };
    },
    [getCoursePrice],
  );

  /** Alias for backward compat */
  const calculateTotalWithTax = useCallback(
    (sarPrice: number): number => {
      if (currencyCode === "SAR") return getSarTotalWithVat(sarPrice);
      const subtotal = convertPrice(sarPrice);
      return subtotal + Math.ceil(subtotal * (VAT_RATE / 100));
    },
    [currencyCode, convertPrice, getSarTotalWithVat],
  );

  const getCurrencySymbol = useCallback((code: CurrencyCode, isRTL = false): string => {
    const m = CURRENCY_META[code];
    if (!m) return code;
    return isRTL ? m.symbolAr : m.symbol;
  }, []);

  const formatPriceValueThenCurrencyName = useCallback((info: CoursePriceInfo, isRTL = false): string => {
    const n = Math.round(Number(info.finalPrice));
    const formatted = n.toLocaleString(isRTL ? "ar-SA" : "en-US");
    const currencyName = isRTL
      ? CURRENCY_FULL_NAME_AR[info.currency] ?? CURRENCY_META[info.currency]?.symbolAr ?? info.currency
      : info.currency;
    return `${formatted} ${currencyName}`;
  }, []);

  const formatTrainingOfferPrice = useCallback(
    (sarPrice: number, isRTL = false, opts?: { vatPercent?: number | null }): string => {
      const info = getCoursePriceInfo(TRAINING_PRICE_PLACEHOLDER_COURSE_ID, Number(sarPrice), 0, opts);
      return formatPriceValueThenCurrencyName(info, isRTL);
    },
    [getCoursePriceInfo, formatPriceValueThenCurrencyName],
  );

  return (
    <CurrencyContext.Provider
      value={{
        currencyCode,
        symbol: meta.symbol,
        symbolAr: meta.symbolAr,
        setCurrency,
        convertPrice,
        getCoursePrice,
        getCoursePriceInfo,
        getCourseCurrency,
        formatPrice,
        formatCoursePrice,
        getSarTotalWithVat,
        calculateTax,
        calculateCourseTax,
        calculateTotalWithTax,
        isDetecting,
        detectedCountry,
        vatRate: VAT_RATE,
        vatLabel: `VAT (${VAT_RATE}%)`,
        vatLabelAr: `ضريبة القيمة المضافة (${VAT_RATE}%)`,
        isSAR,
        exchangeRate: rate,
        hasCountryPrice,
        getCurrencySymbol,
        formatPriceValueThenCurrencyName,
        formatTrainingOfferPrice,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
};
