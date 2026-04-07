import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  ALL_COUNTRIES,
  SAR_RATES,
  getCountryInfo,
} from '@/components/admin/CourseCountryPricing';

/* ── Types ── */
interface CourseRow {
  id: string;
  title: string;
  title_ar: string | null;
  price: number;
  discount_percentage: number;
  vat_percentage: number;
  original_price: number;
}

interface CountryPriceData {
  original_price: number;
  discount_percentage: number;
  price_after_discount: number;
  vat_percentage: number;
  final_price_local: number;
  final_price_sar: number;
  currency: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

/* ── Helpers ── */
function recalc(d: CountryPriceData): CountryPriceData {
  const pad = Math.round(d.original_price * (1 - d.discount_percentage / 100));
  const fpl = Math.round(pad * (1 + d.vat_percentage / 100));
  const rate = SAR_RATES[d.currency] || 1;
  return { ...d, price_after_discount: pad, final_price_local: fpl, final_price_sar: rate > 0 ? Math.round(fpl / rate) : fpl };
}

function emptyRow(currency: string): CountryPriceData {
  return { original_price: 0, discount_percentage: 0, price_after_discount: 0, vat_percentage: 15, final_price_local: 0, final_price_sar: 0, currency };
}

/* ── Inline input ── */
function NumInput({ value, onChange, readOnly, className = '' }: {
  value: number; onChange?: (v: number) => void; readOnly?: boolean; className?: string;
}) {
  return (
    <Input
      type="text" inputMode="numeric" value={value || ''}
      onChange={e => {
        if (readOnly || !onChange) return;
        const v = e.target.value;
        if (v === '' || /^\d*\.?\d*$/.test(v)) onChange(v === '' ? 0 : parseFloat(v) || 0);
      }}
      readOnly={readOnly}
      className={`h-7 text-[11px] px-1.5 w-[72px] ${readOnly ? 'bg-muted/50 cursor-default' : ''} ${className}`}
    />
  );
}

/* ── Main Dialog ── */
export default function ManageCoursePricesDialog({ open, onClose }: Props) {
  const { isRTL } = useLanguage();
  const [tab, setTab] = useState('country');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  // One price row per country (applies to ALL courses)
  const [countryPrices, setCountryPrices] = useState<Record<string, CountryPriceData>>({});

  useEffect(() => {
    if (open) loadData();
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: coursesData }, { data: pricesData }] = await Promise.all([
        supabase.from('courses').select('id, title, title_ar, price, discount_percentage, vat_percentage').order('created_at', { ascending: false }),
        supabase.from('course_country_prices').select('*'),
      ]);

      const rows: CourseRow[] = (coursesData || []).map((c: any) => {
        const discPct = c.discount_percentage || 0;
        const origPrice = discPct > 0 ? Math.round(c.price / (1 - discPct / 100)) : c.price;
        return { id: c.id, title: c.title, title_ar: c.title_ar, price: c.price, discount_percentage: discPct, vat_percentage: c.vat_percentage ?? 15, original_price: origPrice };
      });
      setCourses(rows);

      // Load country prices — take the first occurrence per country (unified, not per-course)
      const map: Record<string, CountryPriceData> = {};
      (pricesData || []).forEach((p: any) => {
        if (map[p.country_code]) return; // already loaded
        const info = getCountryInfo(p.country_code);
        const currency = p.currency || info?.currency || 'SAR';
        const origPrice = Number(p.original_price) || 0;
        const discPct = Number(p.discount_percentage) || 0;
        const pad = Number(p.price) || 0;
        const vatPct = Number(p.vat_percentage) ?? 15;
        const fpl = Number(p.final_price_with_vat) || Math.round(pad * (1 + vatPct / 100));
        const rate = SAR_RATES[currency] || 1;
        map[p.country_code] = {
          original_price: origPrice, discount_percentage: discPct, price_after_discount: pad,
          vat_percentage: vatPct, final_price_local: fpl, final_price_sar: rate > 0 ? Math.round(fpl / rate) : fpl, currency,
        };
      });
      setCountryPrices(map);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateCountry = useCallback((code: string, field: keyof CountryPriceData, val: number) => {
    setCountryPrices(prev => {
      const info = getCountryInfo(code);
      const existing = prev[code] || emptyRow(info?.currency || 'SAR');
      const next = { ...existing, [field]: val };

      if (field === 'original_price' || field === 'discount_percentage' || field === 'vat_percentage') {
        return { ...prev, [code]: recalc(next) };
      }
      if (field === 'price_after_discount') {
        if (next.original_price > 0 && val < next.original_price) {
          next.discount_percentage = Math.round((1 - val / next.original_price) * 100);
        } else {
          next.discount_percentage = 0;
        }
        next.price_after_discount = val;
        const fpl = Math.round(val * (1 + next.vat_percentage / 100));
        const rate = SAR_RATES[next.currency] || 1;
        next.final_price_local = fpl;
        next.final_price_sar = rate > 0 ? Math.round(fpl / rate) : fpl;
        return { ...prev, [code]: next };
      }
      return { ...prev, [code]: next };
    });
  }, []);

  const updateCourseField = (id: string, field: keyof CourseRow, value: number) => {
    setCourses(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, [field]: value };
      if (field === 'original_price' || field === 'price') {
        if (updated.original_price > 0 && updated.price > 0 && updated.price < updated.original_price) {
          updated.discount_percentage = Math.round((1 - updated.price / updated.original_price) * 100);
        } else {
          updated.discount_percentage = 0;
        }
      }
      return updated;
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save base prices
      for (const c of courses) {
        await supabase.from('courses').update({
          price: c.price, discount_percentage: c.discount_percentage, vat_percentage: c.vat_percentage,
        } as any).eq('id', c.id);
      }

      // Delete ALL existing country prices
      for (const c of courses) {
        await supabase.from('course_country_prices').delete().eq('course_id', c.id);
      }

      // Insert unified country prices for ALL courses
      const inserts: any[] = [];
      for (const [countryCode, data] of Object.entries(countryPrices)) {
        if (data.original_price <= 0) continue;
        for (const c of courses) {
          inserts.push({
            course_id: c.id, country_code: countryCode, currency: data.currency,
            original_price: data.original_price, discount_percentage: data.discount_percentage,
            price: data.price_after_discount, vat_percentage: data.vat_percentage,
            final_price_with_vat: data.final_price_local,
          });
        }
      }
      if (inserts.length > 0) {
        for (let i = 0; i < inserts.length; i += 100) {
          await supabase.from('course_country_prices').insert(inserts.slice(i, i + 100));
        }
      }

      toast.success(isRTL ? 'تم حفظ جميع الأسعار بنجاح' : 'All prices saved successfully');
      onClose();
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'فشل في الحفظ' : 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isRTL ? 'إدارة أسعار الكورسات' : 'Manage Course Prices'}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="country">{isRTL ? 'الأسعار حسب الدولة' : 'Country Prices'}</TabsTrigger>
              <TabsTrigger value="base">{isRTL ? 'الأسعار الأساسية' : 'Base Prices'}</TabsTrigger>
            </TabsList>

            {/* ── Country Prices Tab ── */}
            <TabsContent value="country" className="flex-1 min-h-0">
              <p className="text-xs text-muted-foreground mb-2">
                {isRTL ? 'سعر موحّد لكل دولة يُطبَّق على جميع الكورسات تلقائياً.' : 'One price per country, applied to all courses automatically.'}
              </p>
              <div dir={isRTL ? 'rtl' : 'ltr'} className="h-[55vh] overflow-auto border border-border rounded-lg">
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-start font-semibold min-w-[150px] border-b border-e border-border">{isRTL ? 'الدولة' : 'Country'}</th>
                      <th className="px-2 py-2 text-start font-semibold border-b border-e border-border">{isRTL ? 'السعر الأصلي' : 'Original'}</th>
                      <th className="px-2 py-2 text-start font-semibold border-b border-e border-border">{isRTL ? 'خصم %' : 'Disc %'}</th>
                      <th className="px-2 py-2 text-start font-semibold border-b border-e border-border">{isRTL ? 'بعد الخصم' : 'After Disc'}</th>
                      <th className="px-2 py-2 text-start font-semibold border-b border-e border-border">{isRTL ? 'ضريبة %' : 'VAT %'}</th>
                      <th className="px-2 py-2 text-start font-semibold border-b border-e border-border">{isRTL ? 'النهائي (محلي)' : 'Final (local)'}</th>
                      <th className="px-2 py-2 text-start font-semibold border-b border-border">{isRTL ? 'النهائي (ر.س)' : 'Final (SAR)'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ALL_COUNTRIES.map(country => {
                      const data = countryPrices[country.code] || emptyRow(country.currency);
                      return (
                        <tr key={country.code} className="border-b border-border/50 hover:bg-accent/20">
                          <td className="px-3 py-1.5 border-e border-border/50">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{country.flag}</span>
                              <span className="font-medium truncate">{isRTL ? country.name_ar : country.name}</span>
                              <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">{country.currency}</Badge>
                            </div>
                          </td>
                          <td className="px-1 py-1.5">
                            <NumInput value={data.original_price} onChange={v => updateCountry(country.code, 'original_price', v)} />
                          </td>
                          <td className="px-1 py-1.5">
                            <NumInput value={data.discount_percentage} onChange={v => updateCountry(country.code, 'discount_percentage', Math.min(100, v))} />
                          </td>
                          <td className="px-1 py-1.5">
                            <NumInput value={data.price_after_discount} onChange={v => updateCountry(country.code, 'price_after_discount', v)} />
                          </td>
                          <td className="px-1 py-1.5">
                            <NumInput value={data.vat_percentage} onChange={v => updateCountry(country.code, 'vat_percentage', Math.min(100, Math.max(0, v)))} />
                          </td>
                          <td className="px-1 py-1.5">
                            <NumInput value={data.final_price_local} readOnly />
                          </td>
                          <td className="px-1 py-1.5">
                            <NumInput value={data.final_price_sar} readOnly />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* ── Base Prices Tab ── */}
            <TabsContent value="base" className="flex-1 min-h-0">
              <ScrollArea className="h-[55vh]">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-3 py-2 text-start font-medium">{isRTL ? 'الدورة' : 'Course'}</th>
                        <th className="px-3 py-2 text-start font-medium">{isRTL ? 'السعر الأصلي' : 'Original (SAR)'}</th>
                        <th className="px-3 py-2 text-start font-medium">{isRTL ? 'بعد الخصم' : 'After Disc (SAR)'}</th>
                        <th className="px-3 py-2 text-start font-medium">{isRTL ? 'خصم %' : 'Disc %'}</th>
                        <th className="px-3 py-2 text-start font-medium">{isRTL ? 'ضريبة %' : 'VAT %'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courses.map(c => (
                        <tr key={c.id} className="border-b border-border/50">
                          <td className="px-3 py-2">
                            <p className="font-medium truncate max-w-[200px]">{isRTL && c.title_ar ? c.title_ar : c.title}</p>
                          </td>
                          <td className="px-2 py-2">
                            <Input type="text" inputMode="numeric" value={c.original_price || ''}
                              onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) updateCourseField(c.id, 'original_price', v === '' ? 0 : parseFloat(v) || 0); }}
                              className="h-8 text-sm w-24" />
                          </td>
                          <td className="px-2 py-2">
                            <Input type="text" inputMode="numeric" value={c.price || ''}
                              onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) updateCourseField(c.id, 'price', v === '' ? 0 : parseFloat(v) || 0); }}
                              className="h-8 text-sm w-24" />
                          </td>
                          <td className="px-2 py-2">
                            <span className="text-xs text-muted-foreground">{c.discount_percentage > 0 ? `${c.discount_percentage}%` : '—'}</span>
                          </td>
                          <td className="px-2 py-2">
                            <Input type="text" inputMode="numeric" value={c.vat_percentage}
                              onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) updateCourseField(c.id, 'vat_percentage', v === '' ? 0 : Math.min(100, parseFloat(v) || 0)); }}
                              className="h-8 text-sm w-16" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin me-1" /> : null}
            {isRTL ? 'حفظ الكل' : 'Save All'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
