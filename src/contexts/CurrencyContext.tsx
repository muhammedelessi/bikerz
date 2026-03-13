import React, { createContext, useContext, useEffect, useState } from 'react';

type CurrencyCode = 'SAR' | 'EGP';

interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  symbolAr: string;
  rate: number; // conversion rate from SAR
  vatRate: number; // VAT percentage
  vatLabel: string;
  vatLabelAr: string;
  countryCode: string;
  phoneCountryCode: string;
}

const CURRENCY_CONFIGS: Record<CurrencyCode, CurrencyConfig> = {
  SAR: {
    code: 'SAR',
    symbol: 'SAR',
    symbolAr: 'ر.س',
    rate: 1,
    vatRate: 15,
    vatLabel: 'VAT (15%)',
    vatLabelAr: 'ضريبة القيمة المضافة (15%)',
    countryCode: 'SA',
    phoneCountryCode: '966',
  },
  EGP: {
    code: 'EGP',
    symbol: 'EGP',
    symbolAr: 'ج.م',
    rate: 13.2, // approximate SAR to EGP rate
    vatRate: 14,
    vatLabel: 'VAT (14%)',
    vatLabelAr: 'ضريبة القيمة المضافة (14%)',
    countryCode: 'EG',
    phoneCountryCode: '20',
  },
};

interface CurrencyContextType {
  currency: CurrencyConfig;
  setCurrency: (code: CurrencyCode) => void;
  convertPrice: (sarPrice: number) => number;
  formatPrice: (sarPrice: number, isRTL?: boolean) => string;
  calculateTax: (sarPrice: number) => { subtotal: number; tax: number; total: number };
  calculateTotalWithTax: (sarPrice: number) => number;
  isDetecting: boolean;
  detectedCountry: string | null;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem('bikerz_currency');
    if (saved === 'EGP' || saved === 'SAR') return saved;
    return 'SAR';
  });
  const [isDetecting, setIsDetecting] = useState(true);
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);

  const currency = CURRENCY_CONFIGS[currencyCode];

  // Auto-detect location on mount
  useEffect(() => {
    const saved = localStorage.getItem('bikerz_currency');
    if (saved === 'EGP' || saved === 'SAR') {
      setIsDetecting(false);
      return;
    }

    const detectLocation = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
        const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
        clearTimeout(timeout);
        
        if (res.ok) {
          const data = await res.json();
          const country = data?.country_code?.toUpperCase();
          setDetectedCountry(country || null);
          
          if (country === 'EG') {
            setCurrencyCode('EGP');
            localStorage.setItem('bikerz_currency', 'EGP');
          } else {
            localStorage.setItem('bikerz_currency', 'SAR');
          }
        }
      } catch {
        // Silently fail - default to SAR
      } finally {
        setIsDetecting(false);
      }
    };

    detectLocation();
  }, []);

  const setCurrency = (code: CurrencyCode) => {
    setCurrencyCode(code);
    localStorage.setItem('bikerz_currency', code);
  };

  const convertPrice = (sarPrice: number): number => {
    if (currencyCode === 'SAR') return sarPrice;
    return Math.round(sarPrice * currency.rate * 100) / 100;
  };

  const formatPrice = (sarPrice: number, isRTL = false): string => {
    const converted = convertPrice(sarPrice);
    const symbol = isRTL ? currency.symbolAr : currency.symbol;
    return `${converted} ${symbol}`;
  };

  const calculateTax = (sarPrice: number) => {
    const converted = convertPrice(sarPrice);
    // Prices are VAT-inclusive; extract tax from total
    const subtotal = Math.round((converted / (1 + currency.vatRate / 100)) * 100) / 100;
    const tax = Math.round((converted - subtotal) * 100) / 100;
    return { subtotal, tax, total: converted };
  };

  return (
    <CurrencyContext.Provider value={{
      currency,
      setCurrency,
      convertPrice,
      formatPrice,
      calculateTax,
      isDetecting,
      detectedCountry,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
