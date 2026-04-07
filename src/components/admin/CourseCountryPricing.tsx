import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Search, X } from 'lucide-react';

// ── Types ──
export interface CountryPriceEntry {
  country_code: string;
  original_price: number;
  discount_percentage: number;
  price_after_discount: number;
  vat_percentage: number;
  final_price_local: number;
  final_price_sar: number;
  currency: string;
}

// Keep old types for backward compat (unused but exported previously)
export interface PricingGroup {
  id: string;
  sar_final_price: number;
  discount_percentage: number;
  countries: string[];
}

export interface CountryPriceRow {
  country_code: string;
  original_price: number;
  discount_percentage: number;
  price: number;
  currency: string;
  vat_percentage: number;
  final_price_with_vat: number;
}

// ── All world countries with currencies ──
export const ALL_COUNTRIES: { code: string; name: string; name_ar: string; currency: string; flag: string }[] = [
  // Gulf
  { code: 'SA', name: 'Saudi Arabia', name_ar: 'السعودية', currency: 'SAR', flag: '🇸🇦' },
  { code: 'AE', name: 'UAE', name_ar: 'الإمارات', currency: 'AED', flag: '🇦🇪' },
  { code: 'KW', name: 'Kuwait', name_ar: 'الكويت', currency: 'KWD', flag: '🇰🇼' },
  { code: 'BH', name: 'Bahrain', name_ar: 'البحرين', currency: 'BHD', flag: '🇧🇭' },
  { code: 'QA', name: 'Qatar', name_ar: 'قطر', currency: 'QAR', flag: '🇶🇦' },
  { code: 'OM', name: 'Oman', name_ar: 'عُمان', currency: 'OMR', flag: '🇴🇲' },
  // Arab
  { code: 'EG', name: 'Egypt', name_ar: 'مصر', currency: 'EGP', flag: '🇪🇬' },
  { code: 'JO', name: 'Jordan', name_ar: 'الأردن', currency: 'JOD', flag: '🇯🇴' },
  { code: 'IQ', name: 'Iraq', name_ar: 'العراق', currency: 'IQD', flag: '🇮🇶' },
  { code: 'SY', name: 'Syria', name_ar: 'سوريا', currency: 'SYP', flag: '🇸🇾' },
  { code: 'LB', name: 'Lebanon', name_ar: 'لبنان', currency: 'LBP', flag: '🇱🇧' },
  { code: 'YE', name: 'Yemen', name_ar: 'اليمن', currency: 'YER', flag: '🇾🇪' },
  { code: 'LY', name: 'Libya', name_ar: 'ليبيا', currency: 'LYD', flag: '🇱🇾' },
  { code: 'TN', name: 'Tunisia', name_ar: 'تونس', currency: 'TND', flag: '🇹🇳' },
  { code: 'DZ', name: 'Algeria', name_ar: 'الجزائر', currency: 'DZD', flag: '🇩🇿' },
  { code: 'MA', name: 'Morocco', name_ar: 'المغرب', currency: 'MAD', flag: '🇲🇦' },
  { code: 'SD', name: 'Sudan', name_ar: 'السودان', currency: 'SDG', flag: '🇸🇩' },
  { code: 'SO', name: 'Somalia', name_ar: 'الصومال', currency: 'SOS', flag: '🇸🇴' },
  { code: 'MR', name: 'Mauritania', name_ar: 'موريتانيا', currency: 'MRU', flag: '🇲🇷' },
  { code: 'KM', name: 'Comoros', name_ar: 'جزر القمر', currency: 'KMF', flag: '🇰🇲' },
  { code: 'DJ', name: 'Djibouti', name_ar: 'جيبوتي', currency: 'DJF', flag: '🇩🇯' },
  { code: 'PS', name: 'Palestine', name_ar: 'فلسطين', currency: 'ILS', flag: '🇵🇸' },
  // International
  { code: 'US', name: 'United States', name_ar: 'الولايات المتحدة', currency: 'USD', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', name_ar: 'المملكة المتحدة', currency: 'GBP', flag: '🇬🇧' },
  { code: 'TR', name: 'Turkey', name_ar: 'تركيا', currency: 'TRY', flag: '🇹🇷' },
  { code: 'DE', name: 'Germany', name_ar: 'ألمانيا', currency: 'EUR', flag: '🇩🇪' },
  { code: 'FR', name: 'France', name_ar: 'فرنسا', currency: 'EUR', flag: '🇫🇷' },
  { code: 'IT', name: 'Italy', name_ar: 'إيطاليا', currency: 'EUR', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', name_ar: 'إسبانيا', currency: 'EUR', flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands', name_ar: 'هولندا', currency: 'EUR', flag: '🇳🇱' },
  { code: 'SE', name: 'Sweden', name_ar: 'السويد', currency: 'SEK', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway', name_ar: 'النرويج', currency: 'NOK', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark', name_ar: 'الدنمارك', currency: 'DKK', flag: '🇩🇰' },
  { code: 'CH', name: 'Switzerland', name_ar: 'سويسرا', currency: 'CHF', flag: '🇨🇭' },
  { code: 'CA', name: 'Canada', name_ar: 'كندا', currency: 'CAD', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', name_ar: 'أستراليا', currency: 'AUD', flag: '🇦🇺' },
  { code: 'JP', name: 'Japan', name_ar: 'اليابان', currency: 'JPY', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', name_ar: 'كوريا الجنوبية', currency: 'KRW', flag: '🇰🇷' },
  { code: 'IN', name: 'India', name_ar: 'الهند', currency: 'INR', flag: '🇮🇳' },
  { code: 'PK', name: 'Pakistan', name_ar: 'باكستان', currency: 'PKR', flag: '🇵🇰' },
  { code: 'MY', name: 'Malaysia', name_ar: 'ماليزيا', currency: 'MYR', flag: '🇲🇾' },
  { code: 'ID', name: 'Indonesia', name_ar: 'إندونيسيا', currency: 'IDR', flag: '🇮🇩' },
  { code: 'BR', name: 'Brazil', name_ar: 'البرازيل', currency: 'BRL', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', name_ar: 'المكسيك', currency: 'MXN', flag: '🇲🇽' },
  { code: 'ZA', name: 'South Africa', name_ar: 'جنوب أفريقيا', currency: 'ZAR', flag: '🇿🇦' },
  { code: 'NG', name: 'Nigeria', name_ar: 'نيجيريا', currency: 'NGN', flag: '🇳🇬' },
  { code: 'PL', name: 'Poland', name_ar: 'بولندا', currency: 'PLN', flag: '🇵🇱' },
  { code: 'RU', name: 'Russia', name_ar: 'روسيا', currency: 'RUB', flag: '🇷🇺' },
  { code: 'CN', name: 'China', name_ar: 'الصين', currency: 'CNY', flag: '🇨🇳' },
  { code: 'TH', name: 'Thailand', name_ar: 'تايلاند', currency: 'THB', flag: '🇹🇭' },
  { code: 'PH', name: 'Philippines', name_ar: 'الفلبين', currency: 'PHP', flag: '🇵🇭' },
];

// ── Exchange rates SAR → X ──
export const SAR_RATES: Record<string, number> = {
  SAR: 1, AED: 0.979, KWD: 0.082, BHD: 0.1, QAR: 0.971, OMR: 0.103,
  JOD: 0.189, EGP: 13.97, IQD: 348.89, SYP: 30.37, LBP: 23867,
  YER: 63.58, LYD: 1.694, TND: 0.782, DZD: 35.08, MAD: 2.511,
  SDG: 135.35, SOS: 152, MRU: 10.651, KMF: 114.55, DJF: 47.39,
  ILS: 0.837, USD: 0.267, GBP: 0.211,
  EUR: 0.245, TRY: 9.61, SEK: 2.76, NOK: 2.81, DKK: 1.83,
  CHF: 0.234, CAD: 0.365, AUD: 0.41, JPY: 40.02, KRW: 355.6,
  INR: 22.36, PKR: 74.3, MYR: 1.26, IDR: 4213, BRL: 1.37,
  MXN: 4.59, ZAR: 4.85, NGN: 415, PLN: 1.06, RUB: 24.5,
  CNY: 1.94, THB: 9.56, PHP: 14.92,
};

export function getCountryInfo(code: string) {
  return ALL_COUNTRIES.find(c => c.code === code);
}

export function calcAfterDiscount(original: number, discPct: number): number {
  return Math.ceil(original * (1 - discPct / 100));
}

export function calcFinalWithVat(afterDiscount: number, vatPct: number): number {
  return Math.ceil(afterDiscount * (1 + vatPct / 100));
}

export function localToSar(localPrice: number, currency: string): number {
  const rate = SAR_RATES[currency] || 1;
  return rate > 0 ? Math.ceil(localPrice / rate) : localPrice;
}

// ── Country Picker Dialog ──
function CountryPickerDialog({
  open,
  onClose,
  onConfirm,
  existingCountries,
  isRTL,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (codes: string[]) => void;
  existingCountries: Set<string>;
  isRTL: boolean;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (open) setSelected(new Set());
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return ALL_COUNTRIES;
    const q = search.toLowerCase();
    return ALL_COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.name_ar.includes(search) ||
      c.currency.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q)
    );
  }, [search]);

  const toggle = (code: string) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code); else next.add(code);
    setSelected(next);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isRTL ? 'إضافة دول' : 'Add Countries'}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isRTL ? 'بحث بالاسم أو العملة...' : 'Search by name or currency...'}
            className="ps-10"
          />
        </div>
        <p className="text-xs text-muted-foreground">{selected.size} {isRTL ? 'محددة' : 'selected'}</p>
        <ScrollArea className="flex-1 max-h-[400px] border border-border rounded-md">
          <div className="p-1">
            {filtered.map(c => {
              const isExisting = existingCountries.has(c.code);
              const isChecked = selected.has(c.code);
              return (
                <label
                  key={c.code}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                    isExisting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent'
                  } ${isChecked && !isExisting ? 'bg-accent/50' : ''}`}
                  onClick={e => { if (isExisting) e.preventDefault(); }}
                >
                  <Checkbox
                    checked={isChecked}
                    disabled={isExisting}
                    onCheckedChange={() => !isExisting && toggle(c.code)}
                  />
                  <span className="text-lg leading-none">{c.flag}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {isRTL ? c.name_ar : c.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{c.currency}</p>
                  </div>
                  {isExisting && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {isRTL ? 'مضافة' : 'Added'}
                    </Badge>
                  )}
                </label>
              );
            })}
          </div>
        </ScrollArea>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={() => { onConfirm(Array.from(selected)); onClose(); }}>
            {isRTL ? 'إضافة' : 'Add'} ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Inline editable number input ──
function InlineNum({
  value,
  onChange,
  readOnly,
  className = '',
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
  className?: string;
}) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      value={value || ''}
      onChange={e => {
        if (readOnly || !onChange) return;
        const val = e.target.value;
        if (val === '' || /^\d*\.?\d*$/.test(val)) {
          onChange(val === '' ? 0 : parseFloat(val) || 0);
        }
      }}
      readOnly={readOnly}
      className={`h-8 text-xs px-2 ${readOnly ? 'bg-muted/50 cursor-default' : ''} ${className}`}
    />
  );
}

// ── Props ──
interface Props {
  countryPrices: CountryPriceEntry[];
  onChange: (entries: CountryPriceEntry[]) => void;
  isRTL: boolean;
  // Keep backward compat props (ignored)
  pricingGroups?: PricingGroup[];
}

// ── Main Component ──
export default function CourseCountryPricing({ countryPrices, onChange, isRTL }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const existingCodes = useMemo(() => new Set(countryPrices.map(e => e.country_code)), [countryPrices]);

  const addCountries = (codes: string[]) => {
    const newEntries: CountryPriceEntry[] = codes.map(code => {
      const info = getCountryInfo(code);
      const currency = info?.currency || 'SAR';
      return {
        country_code: code,
        original_price: 0,
        discount_percentage: 0,
        price_after_discount: 0,
        vat_percentage: 15,
        final_price_local: 0,
        final_price_sar: 0,
        currency,
      };
    });
    onChange([...countryPrices, ...newEntries]);
  };

  const removeCountry = (code: string) => {
    onChange(countryPrices.filter(e => e.country_code !== code));
  };

  const updateEntry = (code: string, field: keyof CountryPriceEntry, value: number) => {
    onChange(countryPrices.map(e => {
      if (e.country_code !== code) return e;
      const updated = { ...e, [field]: value };

      // Recalculate dependent fields
      if (field === 'original_price' || field === 'discount_percentage') {
        updated.price_after_discount = calcAfterDiscount(updated.original_price, updated.discount_percentage);
      }
      if (field === 'price_after_discount') {
        // Reverse-calc discount %
        if (updated.original_price > 0 && updated.price_after_discount < updated.original_price) {
          updated.discount_percentage = Math.round((1 - updated.price_after_discount / updated.original_price) * 100);
        } else {
          updated.discount_percentage = 0;
        }
      }
      // Always recalculate finals
      updated.final_price_local = calcFinalWithVat(updated.price_after_discount, updated.vat_percentage);
      updated.final_price_sar = localToSar(updated.final_price_local, updated.currency);

      return updated;
    }));
  };

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-semibold">{isRTL ? 'أسعار الدول' : 'Country Prices'}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isRTL
              ? 'أضف دولاً وحدد أسعارها بالعملة المحلية مع الخصم والضريبة.'
              : 'Add countries and set their local currency prices with discount and VAT.'}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
          <Plus className="w-4 h-4 me-1" />
          {isRTL ? 'إضافة دول' : 'Add Countries'}
        </Button>
      </div>

      {countryPrices.length > 0 && (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-2 py-2 text-start font-medium">{isRTL ? 'الدولة' : 'Country'}</th>
                <th className="px-2 py-2 text-start font-medium">{isRTL ? 'السعر الأصلي' : 'Original'}</th>
                <th className="px-2 py-2 text-start font-medium">{isRTL ? 'خصم %' : 'Disc %'}</th>
                <th className="px-2 py-2 text-start font-medium">{isRTL ? 'بعد الخصم' : 'After Disc'}</th>
                <th className="px-2 py-2 text-start font-medium">{isRTL ? 'ضريبة %' : 'VAT %'}</th>
                <th className="px-2 py-2 text-start font-medium">{isRTL ? 'النهائي (محلي)' : 'Final (local)'}</th>
                <th className="px-2 py-2 text-start font-medium">{isRTL ? 'النهائي (ر.س)' : 'Final (SAR)'}</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {countryPrices.map(entry => {
                const info = getCountryInfo(entry.country_code);
                if (!info) return null;
                return (
                  <tr key={entry.country_code} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5 min-w-[100px]">
                        <span className="text-sm">{info.flag}</span>
                        <span className="font-medium truncate">{isRTL ? info.name_ar : info.name}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0">{info.currency}</Badge>
                      </div>
                    </td>
                    <td className="px-1 py-1.5">
                      <InlineNum
                        value={entry.original_price}
                        onChange={v => updateEntry(entry.country_code, 'original_price', v)}
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <InlineNum
                        value={entry.discount_percentage}
                        onChange={v => updateEntry(entry.country_code, 'discount_percentage', Math.min(100, v))}
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <InlineNum
                        value={entry.price_after_discount}
                        onChange={v => updateEntry(entry.country_code, 'price_after_discount', v)}
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <InlineNum
                        value={entry.vat_percentage}
                        onChange={v => updateEntry(entry.country_code, 'vat_percentage', Math.min(100, Math.max(0, v)))}
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <InlineNum value={entry.final_price_local} readOnly />
                    </td>
                    <td className="px-1 py-1.5">
                      <InlineNum value={entry.final_price_sar} readOnly />
                    </td>
                    <td className="px-1 py-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeCountry(entry.country_code)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {countryPrices.length === 0 && (
        <div className="text-center py-6 border border-dashed border-border rounded-lg">
          <p className="text-sm text-muted-foreground mb-2">
            {isRTL ? 'لا توجد أسعار دول بعد' : 'No country prices yet'}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Plus className="w-4 h-4 me-1" />
            {isRTL ? 'إضافة دول' : 'Add Countries'}
          </Button>
        </div>
      )}

      <CountryPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={addCountries}
        existingCountries={existingCodes}
        isRTL={isRTL}
      />
    </div>
  );
}

// ── Helper: expand entries to flat rows for DB save ──
export function expandEntriesToRows(entries: CountryPriceEntry[]): CountryPriceRow[] {
  return entries.map(e => ({
    country_code: e.country_code,
    original_price: e.original_price,
    discount_percentage: e.discount_percentage,
    price: e.price_after_discount,
    currency: e.currency,
    vat_percentage: e.vat_percentage,
    final_price_with_vat: e.final_price_local,
  }));
}

// Keep old export for backward compat
export function expandGroupsToRows(groups: PricingGroup[]): CountryPriceRow[] {
  const rows: CountryPriceRow[] = [];
  for (const g of groups) {
    for (const code of g.countries) {
      const info = ALL_COUNTRIES.find(c => c.code === code);
      if (!info) continue;
      const rate = SAR_RATES[info.currency] || 1;
      const localPrice = Math.ceil(g.sar_final_price * rate);
      const originalPrice = g.discount_percentage > 0 && g.discount_percentage < 100
        ? Math.ceil(localPrice / (1 - g.discount_percentage / 100))
        : localPrice;
      rows.push({
        country_code: code,
        price: localPrice,
        original_price: originalPrice,
        discount_percentage: g.discount_percentage,
        currency: info.currency,
        vat_percentage: 15,
        final_price_with_vat: localPrice,
      });
    }
  }
  return rows;
}
