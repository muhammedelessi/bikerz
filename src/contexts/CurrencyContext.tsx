import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clampTrainingVatPercent } from "@/lib/trainingPlatformMarkup";

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
  | "GBP";

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
};

const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
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
  GB: "GBP",
};

// Fallback rates (SAR → X) used if live fetch fails
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
    let savedCurrency: string | null = null;
    try {
      savedCurrency = sessionStorage.getItem(CURRENCY_CACHE_KEY);
    } catch {
      savedCurrency = null;
    }
    const hasSavedCurrency = !!(savedCurrency && savedCurrency in CURRENCY_META);
    if (hasSavedCurrency) setIsDetecting(false);

    const detectLocation = async () => {
      try {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timeout = setTimeout(() => controller?.abort(), 5000);
        const res = await fetch("https://ipapi.co/json/", controller ? { signal: controller.signal } : undefined);
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          const country = data?.country_code?.toUpperCase() || null;
          setDetectedCountry(country);

          if (country) {
            try {
              sessionStorage.setItem(COUNTRY_CACHE_KEY, country);
            } catch {
              // Ignore restricted-storage environments on iOS
            }
          }

          const detected = country ? COUNTRY_TO_CURRENCY[country] : undefined;
          if (detected) {
            // Always sync currency with the latest detected country.
            // This avoids stale sessionStorage values when a user changes location/country.
            setCurrencyCodeState((prev) => (prev === detected ? prev : detected));
            try {
              sessionStorage.setItem(CURRENCY_CACHE_KEY, detected);
            } catch {
              // Ignore restricted-storage environments on iOS
            }
          } else {
            // Non-Arab country → USD
            setCurrencyCodeState((prev) => (prev === "USD" ? prev : "USD"));
            try {
              sessionStorage.setItem(CURRENCY_CACHE_KEY, "USD");
            } catch {
              // Ignore restricted-storage environments on iOS
            }
          }
        }
      } catch {
        // If geolocation fetch fails, use a small timezone-based fallback.
        // This helps cases where users are in Palestine but the IP lookup is blocked.
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

        // Default SAR
        setDetectedCountry(null);
        setCurrencyCodeState("SAR");
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
