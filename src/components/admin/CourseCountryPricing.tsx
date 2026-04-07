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
import { Plus, Trash2, Search, X, Eye } from 'lucide-react';

// ── Types ──
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
}

// ── All world countries with currencies ──
const ALL_COUNTRIES: { code: string; name: string; name_ar: string; currency: string; flag: string }[] = [
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
const SAR_RATES: Record<string, number> = {
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

const GROUP_COLORS = [
  { bg: 'bg-blue-500/10', border: 'border-blue-500/30', dot: 'bg-blue-500', text: 'text-blue-600' },
  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-500', text: 'text-emerald-600' },
  { bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-500', text: 'text-amber-600' },
  { bg: 'bg-purple-500/10', border: 'border-purple-500/30', dot: 'bg-purple-500', text: 'text-purple-600' },
  { bg: 'bg-rose-500/10', border: 'border-rose-500/30', dot: 'bg-rose-500', text: 'text-rose-600' },
];

function getCountryInfo(code: string) {
  return ALL_COUNTRIES.find(c => c.code === code);
}

function getLocalPrice(sarFinalPrice: number, currencyCode: string): number {
  const rate = SAR_RATES[currencyCode] || 1;
  return Math.ceil(sarFinalPrice * rate);
}

function getOriginalPrice(localPrice: number, discountPct: number): number {
  if (discountPct > 0 && discountPct < 100) {
    return Math.ceil(localPrice / (1 - discountPct / 100));
  }
  return localPrice;
}

interface Props {
  pricingGroups: PricingGroup[];
  onChange: (groups: PricingGroup[]) => void;
  isRTL: boolean;
}

// ── Country Picker Dialog ──
function CountryPickerDialog({
  open,
  onClose,
  onConfirm,
  currentSelection,
  reservedCountries,
  isRTL,
  sarFinalPrice,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (codes: string[]) => void;
  currentSelection: string[];
  reservedCountries: Set<string>;
  isRTL: boolean;
  sarFinalPrice: number;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(currentSelection));

  React.useEffect(() => {
    if (open) setSelected(new Set(currentSelection));
  }, [open, currentSelection]);

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
          <DialogTitle>{isRTL ? 'اختيار الدول' : 'Select Countries'}</DialogTitle>
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
              const isReserved = reservedCountries.has(c.code);
              const isChecked = selected.has(c.code);
              const localPrice = sarFinalPrice > 0 ? getLocalPrice(sarFinalPrice, c.currency) : 0;
              return (
                <label
                  key={c.code}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                    isReserved ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent'
                  } ${isChecked && !isReserved ? 'bg-accent/50' : ''}`}
                  onClick={e => { if (isReserved) e.preventDefault(); }}
                >
                  <Checkbox
                    checked={isChecked}
                    disabled={isReserved}
                    onCheckedChange={() => !isReserved && toggle(c.code)}
                  />
                  <span className="text-lg leading-none">{c.flag}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {isRTL ? c.name_ar : c.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{c.currency}</p>
                  </div>
                  {isReserved ? (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {isRTL ? 'محجوزة' : 'Reserved'}
                    </Badge>
                  ) : localPrice > 0 ? (
                    <span className="text-xs text-muted-foreground font-medium">
                      {localPrice} {c.currency}
                    </span>
                  ) : null}
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
            {isRTL ? 'تأكيد' : 'Confirm'} ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ──
export default function CourseCountryPricing({ pricingGroups, onChange, isRTL }: Props) {
  const [pickerGroupId, setPickerGroupId] = useState<string | null>(null);

  // All countries reserved in OTHER groups (for the picker)
  const getReservedForGroup = (groupId: string): Set<string> => {
    const reserved = new Set<string>();
    pricingGroups.forEach(g => {
      if (g.id !== groupId) g.countries.forEach(c => reserved.add(c));
    });
    return reserved;
  };

  const addGroup = () => {
    onChange([
      ...pricingGroups,
      { id: crypto.randomUUID(), sar_final_price: 0, discount_percentage: 78, countries: [] },
    ]);
  };

  const removeGroup = (id: string) => {
    onChange(pricingGroups.filter(g => g.id !== id));
  };

  const updateGroup = (id: string, patch: Partial<PricingGroup>) => {
    onChange(pricingGroups.map(g => g.id === id ? { ...g, ...patch } : g));
  };

  const removeCountryFromGroup = (groupId: string, countryCode: string) => {
    onChange(pricingGroups.map(g =>
      g.id === groupId ? { ...g, countries: g.countries.filter(c => c !== countryCode) } : g
    ));
  };

  const pickerGroup = pricingGroups.find(g => g.id === pickerGroupId);

  // Build preview data
  const previewRows = useMemo(() => {
    const rows: { code: string; flag: string; name: string; currency: string; localPrice: number; originalPrice: number; discountPct: number; colorIdx: number }[] = [];
    pricingGroups.forEach((g, gi) => {
      g.countries.forEach(code => {
        const info = getCountryInfo(code);
        if (!info) return;
        const localPrice = getLocalPrice(g.sar_final_price, info.currency);
        const originalPrice = getOriginalPrice(localPrice, g.discount_percentage);
        rows.push({
          code,
          flag: info.flag,
          name: isRTL ? info.name_ar : info.name,
          currency: info.currency,
          localPrice,
          originalPrice,
          discountPct: g.discount_percentage,
          colorIdx: gi % GROUP_COLORS.length,
        });
      });
    });
    return rows;
  }, [pricingGroups, isRTL]);

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-semibold">{isRTL ? 'مجموعات التسعير حسب الدولة' : 'Country Pricing Groups'}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isRTL
              ? 'أنشئ مجموعات تسعير وأضف الدول لكل مجموعة. السعر النهائي بالريال هو المبلغ الذي سيتم تحصيله.'
              : 'Create pricing groups and assign countries. The SAR final price is the amount charged.'}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addGroup}>
          <Plus className="w-4 h-4 me-1" />
          {isRTL ? 'إضافة مجموعة تسعير' : 'Add Pricing Group'}
        </Button>
      </div>

      {/* Group cards */}
      {pricingGroups.map((group, gi) => {
        const color = GROUP_COLORS[gi % GROUP_COLORS.length];
        return (
          <div key={group.id} className={`rounded-lg border ${color.border} ${color.bg} p-4 space-y-3`}>
            {/* Header row */}
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${color.dot} flex-shrink-0`} />
              <span className="text-sm font-semibold flex-1">
                {isRTL ? `مجموعة ${gi + 1}` : `Group ${gi + 1}`}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => removeGroup(group.id)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Price inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">{isRTL ? 'السعر النهائي (ر.س)' : 'Final Price (SAR)'}</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={group.sar_final_price || ''}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      updateGroup(group.id, { sar_final_price: val === '' ? 0 : parseFloat(val) || 0 });
                    }
                  }}
                  placeholder="0"
                  className="font-semibold"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">{isRTL ? 'نسبة الخصم %' : 'Discount %'}</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={group.discount_percentage || ''}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      const num = val === '' ? 0 : Math.min(100, parseFloat(val) || 0);
                      updateGroup(group.id, { discount_percentage: num });
                    }
                  }}
                  placeholder="78"
                />
              </div>
            </div>

            {/* Country tags */}
            <div className="flex flex-wrap gap-1.5">
              {group.countries.map(code => {
                const info = getCountryInfo(code);
                if (!info) return null;
                const localPrice = group.sar_final_price > 0 ? getLocalPrice(group.sar_final_price, info.currency) : 0;
                return (
                  <Badge
                    key={code}
                    variant="secondary"
                    className="gap-1 pe-1 py-1 text-xs"
                  >
                    <span>{info.flag}</span>
                    <span>{isRTL ? info.name_ar : info.name}</span>
                    {localPrice > 0 && (
                      <span className="text-muted-foreground font-normal">
                        ({localPrice} {info.currency})
                      </span>
                    )}
                    <button
                      type="button"
                      className="ms-0.5 hover:bg-destructive/20 rounded-full p-0.5"
                      onClick={() => removeCountryFromGroup(group.id, code)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                );
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setPickerGroupId(group.id)}
              >
                <Plus className="w-3 h-3" />
                {isRTL ? 'اختيار الدول' : 'Select Countries'}
              </Button>
            </div>
          </div>
        );
      })}

      {pricingGroups.length === 0 && (
        <div className="text-center py-6 border border-dashed border-border rounded-lg">
          <p className="text-sm text-muted-foreground mb-2">
            {isRTL ? 'لا توجد مجموعات تسعير بعد' : 'No pricing groups yet'}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={addGroup}>
            <Plus className="w-4 h-4 me-1" />
            {isRTL ? 'إضافة مجموعة تسعير' : 'Add Pricing Group'}
          </Button>
        </div>
      )}

      {/* Live Preview */}
      {previewRows.length > 0 && (
        <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            {isRTL ? 'معاينة — ما سيراه المستخدم' : 'Preview — What the user will see'}
          </h4>
          <div className="grid gap-2">
            {previewRows.map(row => (
              <div key={row.code} className="flex items-center gap-2 bg-background rounded-md p-2.5 border border-border text-sm">
                <div className={`w-2 h-2 rounded-full ${GROUP_COLORS[row.colorIdx].dot} flex-shrink-0`} />
                <span className="text-base leading-none">{row.flag}</span>
                <span className="font-medium flex-1 truncate">{row.name}</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">{row.currency}</Badge>
                {row.discountPct > 0 && (
                  <>
                    <span className="text-muted-foreground line-through text-xs">
                      {row.originalPrice}
                    </span>
                    <Badge className="text-[10px] px-1.5 py-0 bg-destructive/10 text-destructive border-destructive/20">
                      -{row.discountPct}%
                    </Badge>
                  </>
                )}
                <span className="font-bold">{row.localPrice} {row.currency}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Country Picker Dialog */}
      {pickerGroup && (
        <CountryPickerDialog
          open={!!pickerGroupId}
          onClose={() => setPickerGroupId(null)}
          onConfirm={codes => updateGroup(pickerGroup.id, { countries: codes })}
          currentSelection={pickerGroup.countries}
          reservedCountries={getReservedForGroup(pickerGroup.id)}
          isRTL={isRTL}
          sarFinalPrice={pickerGroup.sar_final_price}
        />
      )}
    </div>
  );
}

// ── Helper: expand groups into flat country price rows for DB save ──
export function expandGroupsToRows(groups: PricingGroup[]): CountryPriceRow[] {
  const rows: CountryPriceRow[] = [];
  for (const g of groups) {
    for (const code of g.countries) {
      const info = ALL_COUNTRIES.find(c => c.code === code);
      if (!info) continue;
      const localPrice = getLocalPrice(g.sar_final_price, info.currency);
      const originalPrice = getOriginalPrice(localPrice, g.discount_percentage);
      rows.push({
        country_code: code,
        price: localPrice,
        original_price: originalPrice,
        discount_percentage: g.discount_percentage,
        currency: info.currency,
      });
    }
  }
  return rows;
}
