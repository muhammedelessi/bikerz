import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  type CountryPriceEntry,
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

interface CellData {
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
function calcCell(d: CellData): CellData {
  const pad = Math.round(d.original_price * (1 - d.discount_percentage / 100));
  const fpl = Math.round(pad * (1 + d.vat_percentage / 100));
  const rate = SAR_RATES[d.currency] || 1;
  const fps = rate > 0 ? Math.round(fpl / rate) : fpl;
  return { ...d, price_after_discount: pad, final_price_local: fpl, final_price_sar: fps };
}

function emptyCellFor(currency: string): CellData {
  return { original_price: 0, discount_percentage: 0, price_after_discount: 0, vat_percentage: 15, final_price_local: 0, final_price_sar: 0, currency };
}

function cellKey(countryCode: string, courseId: string) {
  return `${countryCode}::${courseId}`;
}

/* ── Inline input ── */
function NumInput({ value, onChange, readOnly, className = '' }: {
  value: number; onChange?: (v: number) => void; readOnly?: boolean; className?: string;
}) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      value={value || ''}
      onChange={e => {
        if (readOnly || !onChange) return;
        const v = e.target.value;
        if (v === '' || /^\d*\.?\d*$/.test(v)) onChange(v === '' ? 0 : parseFloat(v) || 0);
      }}
      readOnly={readOnly}
      className={`h-7 text-[11px] px-1.5 w-[70px] ${readOnly ? 'bg-muted/50 cursor-default' : ''} ${className}`}
    />
  );
}

/* ── Cell editor ── */
const CellEditor = React.memo(({ data, onChange, isRTL }: {
  data: CellData; onChange: (d: CellData) => void; isRTL: boolean;
}) => {
  const update = (field: keyof CellData, val: number) => {
    const next = { ...data, [field]: val };
    if (field === 'original_price' || field === 'discount_percentage' || field === 'vat_percentage') {
      onChange(calcCell(next));
    } else if (field === 'price_after_discount') {
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
      onChange(next);
    }
  };

  return (
    <div className="flex flex-col gap-1 p-1.5 min-w-[160px]">
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground w-[50px] shrink-0">{isRTL ? 'أصلي' : 'Orig'}</span>
        <NumInput value={data.original_price} onChange={v => update('original_price', v)} />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground w-[50px] shrink-0">{isRTL ? 'خصم%' : 'Disc%'}</span>
        <NumInput value={data.discount_percentage} onChange={v => update('discount_percentage', Math.min(100, v))} />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground w-[50px] shrink-0">{isRTL ? 'بعد' : 'After'}</span>
        <NumInput value={data.price_after_discount} onChange={v => update('price_after_discount', v)} />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground w-[50px] shrink-0">{isRTL ? 'ضريبة%' : 'VAT%'}</span>
        <NumInput value={data.vat_percentage} onChange={v => update('vat_percentage', Math.min(100, Math.max(0, v)))} />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground w-[50px] shrink-0">{isRTL ? 'نهائي' : 'Final'}</span>
        <NumInput value={data.final_price_local} readOnly />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground w-[50px] shrink-0">SAR</span>
        <NumInput value={data.final_price_sar} readOnly />
      </div>
    </div>
  );
});
CellEditor.displayName = 'CellEditor';

/* ── Main Dialog ── */
export default function ManageCoursePricesDialog({ open, onClose }: Props) {
  const { isRTL } = useLanguage();
  const [tab, setTab] = useState('country');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [matrix, setMatrix] = useState<Record<string, CellData>>({});

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

      const m: Record<string, CellData> = {};
      (pricesData || []).forEach((p: any) => {
        const info = getCountryInfo(p.country_code);
        const currency = p.currency || info?.currency || 'SAR';
        const origPrice = Number(p.original_price) || 0;
        const discPct = Number(p.discount_percentage) || 0;
        const pad = Number(p.price) || 0;
        const vatPct = Number(p.vat_percentage) ?? 15;
        const fpl = Number(p.final_price_with_vat) || Math.round(pad * (1 + vatPct / 100));
        const rate = SAR_RATES[currency] || 1;
        m[cellKey(p.country_code, p.course_id)] = {
          original_price: origPrice, discount_percentage: discPct, price_after_discount: pad,
          vat_percentage: vatPct, final_price_local: fpl, final_price_sar: rate > 0 ? Math.round(fpl / rate) : fpl, currency,
        };
      });
      setMatrix(m);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateCell = useCallback((countryCode: string, courseId: string, data: CellData) => {
    setMatrix(prev => ({ ...prev, [cellKey(countryCode, courseId)]: data }));
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

      // Save country prices: delete all, then insert non-empty
      const courseIds = courses.map(c => c.id);
      for (const cid of courseIds) {
        await supabase.from('course_country_prices').delete().eq('course_id', cid);
      }

      const inserts: any[] = [];
      for (const [key, data] of Object.entries(matrix)) {
        if (data.original_price <= 0) continue;
        const [countryCode, courseId] = key.split('::');
        inserts.push({
          course_id: courseId, country_code: countryCode, currency: data.currency,
          original_price: data.original_price, discount_percentage: data.discount_percentage,
          price: data.price_after_discount, vat_percentage: data.vat_percentage,
          final_price_with_vat: data.final_price_local,
        });
      }
      if (inserts.length > 0) {
        // Batch in chunks of 100
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

  const countries = ALL_COUNTRIES;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] flex flex-col">
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

            {/* ── Country Matrix Tab ── */}
            <TabsContent value="country" className="flex-1 min-h-0">
              <div
                dir={isRTL ? 'rtl' : 'ltr'}
                className="h-[60vh] overflow-auto border border-border rounded-lg relative"
              >
                <table className="border-collapse text-xs">
                  <thead className="sticky top-0 z-20 bg-background">
                    <tr>
                      {/* Country header cell - sticky corner */}
                      <th
                        className={`sticky ${isRTL ? 'right-0' : 'left-0'} z-30 bg-muted border-b border-e border-border px-3 py-2 text-start font-semibold min-w-[160px]`}
                      >
                        {isRTL ? 'الدولة' : 'Country'}
                      </th>
                      {courses.map(c => (
                        <th
                          key={c.id}
                          className="border-b border-e border-border px-2 py-2 text-center font-semibold bg-muted min-w-[180px]"
                        >
                          <p className="truncate max-w-[170px] mx-auto text-[11px]">
                            {isRTL && c.title_ar ? c.title_ar : c.title}
                          </p>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {countries.map(country => (
                      <tr key={country.code} className="border-b border-border/50 hover:bg-accent/20">
                        {/* Sticky country column */}
                        <td
                          className={`sticky ${isRTL ? 'right-0' : 'left-0'} z-10 bg-background border-e border-border px-3 py-2`}
                        >
                          <div className="flex items-center gap-1.5 min-w-[140px]">
                            <span className="text-sm">{country.flag}</span>
                            <span className="font-medium text-xs truncate">{isRTL ? country.name_ar : country.name}</span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">{country.currency}</Badge>
                          </div>
                        </td>
                        {courses.map(c => {
                          const key = cellKey(country.code, c.id);
                          const data = matrix[key] || emptyCellFor(country.currency);
                          return (
                            <td key={c.id} className="border-e border-border/50 align-top">
                              <CellEditor
                                data={data}
                                onChange={d => updateCell(country.code, c.id, d)}
                                isRTL={isRTL}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* ── Base Prices Tab ── */}
            <TabsContent value="base" className="flex-1 min-h-0">
              <ScrollArea className="h-[60vh]">
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
                            <p className="font-medium truncate max-w-[200px]">
                              {isRTL && c.title_ar ? c.title_ar : c.title}
                            </p>
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="text" inputMode="numeric" value={c.original_price || ''}
                              onChange={e => {
                                const val = e.target.value;
                                if (val === '' || /^\d*\.?\d*$/.test(val))
                                  updateCourseField(c.id, 'original_price', val === '' ? 0 : parseFloat(val) || 0);
                              }}
                              className="h-8 text-sm w-24"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="text" inputMode="numeric" value={c.price || ''}
                              onChange={e => {
                                const val = e.target.value;
                                if (val === '' || /^\d*\.?\d*$/.test(val))
                                  updateCourseField(c.id, 'price', val === '' ? 0 : parseFloat(val) || 0);
                              }}
                              className="h-8 text-sm w-24"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <span className="text-xs text-muted-foreground">
                              {c.discount_percentage > 0 ? `${c.discount_percentage}%` : '—'}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="text" inputMode="numeric" value={c.vat_percentage}
                              onChange={e => {
                                const val = e.target.value;
                                if (val === '' || /^\d*\.?\d*$/.test(val))
                                  updateCourseField(c.id, 'vat_percentage', val === '' ? 0 : Math.min(100, parseFloat(val) || 0));
                              }}
                              className="h-8 text-sm w-16"
                            />
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
          <Button variant="outline" onClick={onClose}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin me-1" /> : null}
            {isRTL ? 'حفظ الكل' : 'Save All'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
