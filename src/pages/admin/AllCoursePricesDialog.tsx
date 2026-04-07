import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Course {
  id: string;
  title: string;
  title_ar: string | null;
  price: number;
  discount_percentage: number;
}

interface CountryPrice {
  course_id: string;
  country_code: string;
  original_price: number;
  discount_percentage: number;
  price: number;
  vat_percentage: number;
  currency: string;
}

// Cell state: one per [country_code][course_id]
type PriceMatrix = Record<string, Record<string, {
  original_price: number;
  discount_percentage: number;
  price_after_discount: number;
  vat_percentage: number;
}>>;

const ARAB_COUNTRIES = [
  { code: 'SA', name: 'Saudi Arabia', name_ar: 'السعودية', flag: '🇸🇦', currency: 'SAR' },
  { code: 'AE', name: 'UAE', name_ar: 'الإمارات', flag: '🇦🇪', currency: 'AED' },
  { code: 'KW', name: 'Kuwait', name_ar: 'الكويت', flag: '🇰🇼', currency: 'KWD' },
  { code: 'BH', name: 'Bahrain', name_ar: 'البحرين', flag: '🇧🇭', currency: 'BHD' },
  { code: 'QA', name: 'Qatar', name_ar: 'قطر', flag: '🇶🇦', currency: 'QAR' },
  { code: 'OM', name: 'Oman', name_ar: 'عُمان', flag: '🇴🇲', currency: 'OMR' },
  { code: 'EG', name: 'Egypt', name_ar: 'مصر', flag: '🇪🇬', currency: 'EGP' },
  { code: 'JO', name: 'Jordan', name_ar: 'الأردن', flag: '🇯🇴', currency: 'JOD' },
  { code: 'PS', name: 'Palestine', name_ar: 'فلسطين', flag: '🇵🇸', currency: 'ILS' },
  { code: 'IQ', name: 'Iraq', name_ar: 'العراق', flag: '🇮🇶', currency: 'IQD' },
  { code: 'SY', name: 'Syria', name_ar: 'سوريا', flag: '🇸🇾', currency: 'SYP' },
  { code: 'LB', name: 'Lebanon', name_ar: 'لبنان', flag: '🇱🇧', currency: 'LBP' },
  { code: 'YE', name: 'Yemen', name_ar: 'اليمن', flag: '🇾🇪', currency: 'YER' },
  { code: 'LY', name: 'Libya', name_ar: 'ليبيا', flag: '🇱🇾', currency: 'LYD' },
  { code: 'TN', name: 'Tunisia', name_ar: 'تونس', flag: '🇹🇳', currency: 'TND' },
  { code: 'DZ', name: 'Algeria', name_ar: 'الجزائر', flag: '🇩🇿', currency: 'DZD' },
  { code: 'MA', name: 'Morocco', name_ar: 'المغرب', flag: '🇲🇦', currency: 'MAD' },
  { code: 'SD', name: 'Sudan', name_ar: 'السودان', flag: '🇸🇩', currency: 'SDG' },
  { code: 'SO', name: 'Somalia', name_ar: 'الصومال', flag: '🇸🇴', currency: 'SOS' },
  { code: 'MR', name: 'Mauritania', name_ar: 'موريتانيا', flag: '🇲🇷', currency: 'MRU' },
  { code: 'KM', name: 'Comoros', name_ar: 'جزر القمر', flag: '🇰🇲', currency: 'KMF' },
  { code: 'DJ', name: 'Djibouti', name_ar: 'جيبوتي', flag: '🇩🇯', currency: 'DJF' },
];

const SAR_RATES: Record<string, number> = {
  SAR: 1, AED: 0.979, KWD: 0.082, BHD: 0.1, QAR: 0.971, OMR: 0.103,
  JOD: 0.189, EGP: 13.97, IQD: 348.89, SYP: 30.37, LBP: 23867,
  YER: 63.58, LYD: 1.694, TND: 0.782, DZD: 35.08, MAD: 2.511,
  SDG: 135.35, SOS: 152, MRU: 10.651, KMF: 114.55, DJF: 47.39,
  ILS: 0.837, USD: 0.267, GBP: 0.211,
};

const EMPTY_CELL = { original_price: 0, discount_percentage: 0, price_after_discount: 0, vat_percentage: 15 };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const AllCoursePricesDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { isRTL } = useLanguage();
  const [courses, setCourses] = useState<Course[]>([]);
  const [matrix, setMatrix] = useState<PriceMatrix>({});
  const [basePrices, setBasePrices] = useState<Record<string, { original: number; after_discount: number; vat: number }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    loadData();
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: coursesData }, { data: pricesData }] = await Promise.all([
      supabase.from('courses').select('id, title, title_ar, price, discount_percentage').order('created_at'),
      supabase.from('course_country_prices').select('*'),
    ]);

    const c = (coursesData || []) as Course[];
    setCourses(c);

    // Base prices
    const bp: Record<string, { original: number; after_discount: number; vat: number }> = {};
    c.forEach(course => {
      const afterDiscount = course.discount_percentage > 0
        ? Math.round(course.price * (1 - course.discount_percentage / 100))
        : course.price;
      bp[course.id] = { original: course.price, after_discount: afterDiscount, vat: 15 };
    });
    setBasePrices(bp);

    // Country prices matrix
    const m: PriceMatrix = {};
    ARAB_COUNTRIES.forEach(country => {
      m[country.code] = {};
      c.forEach(course => {
        m[country.code][course.id] = { ...EMPTY_CELL };
      });
    });

    (pricesData || []).forEach((p: any) => {
      if (m[p.country_code]?.[p.course_id]) {
        const afterDisc = p.discount_percentage > 0
          ? Math.round(p.original_price * (1 - p.discount_percentage / 100))
          : p.price;
        m[p.country_code][p.course_id] = {
          original_price: Number(p.original_price) || 0,
          discount_percentage: Number(p.discount_percentage) || 0,
          price_after_discount: afterDisc,
          vat_percentage: Number(p.vat_percentage) || 15,
        };
      }
    });
    setMatrix(m);
    setLoading(false);
  };

  const updateCell = (countryCode: string, courseId: string, field: string, value: number) => {
    setMatrix(prev => {
      const cell = { ...(prev[countryCode]?.[courseId] || EMPTY_CELL), [field]: value };
      // Auto-recalculate
      if (field === 'original_price' || field === 'discount_percentage') {
        cell.price_after_discount = cell.discount_percentage > 0
          ? Math.round(cell.original_price * (1 - cell.discount_percentage / 100))
          : cell.original_price;
      }
      if (field === 'price_after_discount') {
        cell.discount_percentage = cell.original_price > 0
          ? Math.round((1 - cell.price_after_discount / cell.original_price) * 100)
          : 0;
      }
      return { ...prev, [countryCode]: { ...prev[countryCode], [courseId]: cell } };
    });
  };

  const updateBase = (courseId: string, field: string, value: number) => {
    setBasePrices(prev => {
      const bp = { ...(prev[courseId] || { original: 0, after_discount: 0, vat: 15 }), [field]: value };
      if (field === 'original' || field === 'after_discount') {
        if (field === 'original' && bp.after_discount > 0) {
          // keep after_discount, recalc discount
        }
        if (field === 'after_discount') {
          // keep original, recalc discount
        }
      }
      return { ...prev, [courseId]: bp };
    });
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      // Save base prices
      await Promise.all(
        courses.map(course => {
          const bp = basePrices[course.id];
          if (!bp) return Promise.resolve();
          const discPct = bp.original > 0 && bp.after_discount > 0
            ? Math.round((1 - bp.after_discount / bp.original) * 100)
            : 0;
          return supabase.from('courses').update({
            price: bp.original,
            discount_percentage: discPct,
          }).eq('id', course.id);
        })
      );

      // Save country prices — delete all then insert
      await supabase.from('course_country_prices').delete().in('course_id', courses.map(c => c.id));

      const rows: any[] = [];
      ARAB_COUNTRIES.forEach(country => {
        courses.forEach(course => {
          const cell = matrix[country.code]?.[course.id];
          if (!cell || cell.original_price <= 0) return;
          const finalLocal = Math.round(cell.price_after_discount * (1 + (cell.vat_percentage || 0) / 100));
          rows.push({
            course_id: course.id,
            country_code: country.code,
            currency: country.currency,
            original_price: cell.original_price,
            discount_percentage: cell.discount_percentage,
            price: cell.price_after_discount,
            vat_percentage: cell.vat_percentage,
            final_price_with_vat: finalLocal,
          });
        });
      });

      if (rows.length > 0) {
        await supabase.from('course_country_prices').insert(rows);
      }

      toast.success(isRTL ? 'تم حفظ جميع الأسعار بنجاح' : 'All prices saved successfully');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'فشل الحفظ' : 'Save failed'));
    }
    setSaving(false);
  };

  const courseName = (c: Course) => isRTL && c.title_ar ? c.title_ar : c.title;

  const calcFinalLocal = (cell: typeof EMPTY_CELL) =>
    Math.round(cell.price_after_discount * (1 + (cell.vat_percentage || 0) / 100));

  const calcFinalSAR = (cell: typeof EMPTY_CELL, currency: string) => {
    const rate = SAR_RATES[currency] || 1;
    return rate > 0 ? Math.round(calcFinalLocal(cell) / rate) : 0;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0 gap-0"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <DialogHeader className="px-6 py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg font-bold">
            {isRTL ? 'إدارة أسعار جميع الكورسات' : 'Manage All Course Prices'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="country" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-6 mt-3 flex-shrink-0 w-fit">
              <TabsTrigger value="country">
                {isRTL ? 'أسعار حسب الدولة' : 'Country Prices'}
              </TabsTrigger>
              <TabsTrigger value="base">
                {isRTL ? 'الأسعار الأساسية' : 'Base Prices'}
              </TabsTrigger>
            </TabsList>

            {/* ── Tab 1: Country Prices Matrix ── */}
            <TabsContent value="country" className="flex-1 overflow-auto m-0 p-0">
              <div className="overflow-auto h-full">
                <table className="border-collapse text-xs" style={{ minWidth: '100%' }}>
                  <thead className="sticky top-0 z-20 bg-muted/90">
                    <tr>
                      {/* Country column header */}
                      <th className={`sticky ${isRTL ? 'right-0' : 'left-0'} z-30 bg-muted/90 border border-border px-3 py-2 text-start font-semibold min-w-[140px]`}>
                        {isRTL ? 'الدولة' : 'Country'}
                      </th>
                      {courses.map(course => (
                        <th key={course.id} colSpan={6} className="border border-border px-2 py-2 text-center font-semibold bg-primary/5 min-w-[480px]">
                          {courseName(course)}
                        </th>
                      ))}
                    </tr>
                    <tr className="bg-muted/60">
                      <th className={`sticky ${isRTL ? 'right-0' : 'left-0'} z-30 bg-muted/60 border border-border px-3 py-1.5`} />
                      {courses.map(course => (
                        <React.Fragment key={course.id}>
                          {[
                            isRTL ? 'الأصلي' : 'Original',
                            isRTL ? 'الخصم %' : 'Disc %',
                            isRTL ? 'بعد الخصم' : 'After Disc',
                            isRTL ? 'الضريبة %' : 'VAT %',
                            isRTL ? 'النهائي محلي' : 'Final Local',
                            isRTL ? 'النهائي ر.س' : 'Final SAR',
                          ].map((label, i) => (
                            <th key={i} className="border border-border px-2 py-1.5 text-center text-muted-foreground font-medium min-w-[80px]">
                              {label}
                            </th>
                          ))}
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ARAB_COUNTRIES.map((country, ri) => (
                      <tr key={country.code} className={ri % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                        {/* Country label */}
                        <td className={`sticky ${isRTL ? 'right-0' : 'left-0'} z-10 border border-border px-3 py-2 font-medium bg-inherit`}>
                          <div className="flex items-center gap-2">
                            <span className="text-base">{country.flag}</span>
                            <div>
                              <div className="font-medium">{isRTL ? country.name_ar : country.name}</div>
                              <div className="text-muted-foreground text-[10px]">{country.currency}</div>
                            </div>
                          </div>
                        </td>
                        {courses.map(course => {
                          const cell = matrix[country.code]?.[course.id] || EMPTY_CELL;
                          const finalLocal = calcFinalLocal(cell);
                          const finalSAR = calcFinalSAR(cell, country.currency);
                          return (
                            <React.Fragment key={course.id}>
                              {/* Original Price */}
                              <td className="border border-border px-1 py-1">
                                <Input
                                  type="number" min={0}
                                  value={cell.original_price || ''}
                                  onChange={e => updateCell(country.code, course.id, 'original_price', parseFloat(e.target.value) || 0)}
                                  className="h-7 text-xs text-center px-1 w-full"
                                  placeholder="0"
                                />
                              </td>
                              {/* Discount % */}
                              <td className="border border-border px-1 py-1">
                                <Input
                                  type="number" min={0} max={99}
                                  value={cell.discount_percentage || ''}
                                  onChange={e => updateCell(country.code, course.id, 'discount_percentage', parseFloat(e.target.value) || 0)}
                                  className="h-7 text-xs text-center px-1 w-full"
                                  placeholder="0"
                                />
                              </td>
                              {/* After Discount */}
                              <td className="border border-border px-1 py-1">
                                <Input
                                  type="number" min={0}
                                  value={cell.price_after_discount || ''}
                                  onChange={e => updateCell(country.code, course.id, 'price_after_discount', parseFloat(e.target.value) || 0)}
                                  className="h-7 text-xs text-center px-1 w-full"
                                  placeholder="0"
                                />
                              </td>
                              {/* VAT % */}
                              <td className="border border-border px-1 py-1">
                                <Input
                                  type="number" min={0} max={100}
                                  value={cell.vat_percentage ?? 15}
                                  onChange={e => updateCell(country.code, course.id, 'vat_percentage', parseFloat(e.target.value) || 0)}
                                  className="h-7 text-xs text-center px-1 w-full"
                                />
                              </td>
                              {/* Final Local — read only */}
                              <td className="border border-border px-2 py-1 text-center">
                                <span className="font-semibold text-primary">
                                  {cell.price_after_discount > 0 ? finalLocal.toLocaleString() : '—'}
                                </span>
                                <span className="text-muted-foreground ms-1">{country.currency}</span>
                              </td>
                              {/* Final SAR — read only */}
                              <td className="border border-border px-2 py-1 text-center">
                                <span className="font-semibold text-green-600 dark:text-green-400">
                                  {cell.price_after_discount > 0 ? finalSAR.toLocaleString() : '—'}
                                </span>
                                <span className="text-muted-foreground ms-1 text-[10px]">ر.س</span>
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* ── Tab 2: Base Prices ── */}
            <TabsContent value="base" className="flex-1 overflow-auto m-0 p-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border border-border px-4 py-2 text-start">{isRTL ? 'الكورس' : 'Course'}</th>
                    <th className="border border-border px-4 py-2 text-center">{isRTL ? 'السعر الأصلي (ر.س)' : 'Original Price (SAR)'}</th>
                    <th className="border border-border px-4 py-2 text-center">{isRTL ? 'بعد الخصم (ر.س)' : 'After Discount (SAR)'}</th>
                    <th className="border border-border px-4 py-2 text-center">{isRTL ? 'الخصم %' : 'Discount %'}</th>
                    <th className="border border-border px-4 py-2 text-center">{isRTL ? 'الضريبة %' : 'VAT %'}</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course, i) => {
                    const bp = basePrices[course.id] || { original: 0, after_discount: 0, vat: 15 };
                    const discPct = bp.original > 0 && bp.after_discount > 0
                      ? Math.round((1 - bp.after_discount / bp.original) * 100)
                      : 0;
                    return (
                      <tr key={course.id} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
                        <td className="border border-border px-4 py-2 font-medium">{courseName(course)}</td>
                        <td className="border border-border px-2 py-1">
                          <Input type="number" min={0}
                            value={bp.original || ''}
                            onChange={e => updateBase(course.id, 'original', parseFloat(e.target.value) || 0)}
                            className="h-8 text-center" placeholder="0"
                          />
                        </td>
                        <td className="border border-border px-2 py-1">
                          <Input type="number" min={0}
                            value={bp.after_discount || ''}
                            onChange={e => updateBase(course.id, 'after_discount', parseFloat(e.target.value) || 0)}
                            className="h-8 text-center" placeholder="0"
                          />
                        </td>
                        <td className="border border-border px-4 py-2 text-center font-semibold text-primary">
                          {discPct > 0 ? `${discPct}%` : '—'}
                        </td>
                        <td className="border border-border px-2 py-1">
                          <Input type="number" min={0} max={100}
                            value={bp.vat ?? 15}
                            onChange={e => updateBase(course.id, 'vat', parseFloat(e.target.value) || 0)}
                            className="h-8 text-center"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter className="px-6 py-4 border-t border-border flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={saveAll} disabled={saving} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isRTL ? 'حفظ الكل' : 'Save All'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AllCoursePricesDialog;
