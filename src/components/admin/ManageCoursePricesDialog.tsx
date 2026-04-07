import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
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
import CourseCountryPricing, {
  CountryPriceEntry,
  expandEntriesToRows,
  SAR_RATES,
  getCountryInfo,
  calcAfterDiscount,
  calcFinalWithVat,
  localToSar,
} from '@/components/admin/CourseCountryPricing';

interface CourseRow {
  id: string;
  title: string;
  title_ar: string | null;
  price: number;
  discount_percentage: number;
  vat_percentage: number;
  original_price: number; // local state only
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ManageCoursePricesDialog({ open, onClose }: Props) {
  const { isRTL } = useLanguage();
  const [tab, setTab] = useState('base');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [countryPricesMap, setCountryPricesMap] = useState<Record<string, CountryPriceEntry[]>>({});
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) loadData();
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: coursesData } = await supabase
        .from('courses')
        .select('id, title, title_ar, price, discount_percentage, vat_percentage')
        .order('created_at', { ascending: false });

      const rows: CourseRow[] = (coursesData || []).map((c: any) => {
        const discPct = c.discount_percentage || 0;
        const origPrice = discPct > 0 ? Math.round(c.price / (1 - discPct / 100)) : c.price;
        return {
          id: c.id,
          title: c.title,
          title_ar: c.title_ar,
          price: c.price,
          discount_percentage: discPct,
          vat_percentage: c.vat_percentage ?? 15,
          original_price: origPrice,
        };
      });
      setCourses(rows);

      // Load all country prices
      const { data: pricesData } = await supabase
        .from('course_country_prices')
        .select('*');

      const map: Record<string, CountryPriceEntry[]> = {};
      (pricesData || []).forEach((p: any) => {
        if (!map[p.course_id]) map[p.course_id] = [];
        const info = getCountryInfo(p.country_code);
        const currency = p.currency || info?.currency || 'SAR';
        const originalPrice = Number(p.original_price) || 0;
        const discPct = Number(p.discount_percentage) || 0;
        const priceAfterDiscount = Number(p.price) || 0;
        const vatPct = Number(p.vat_percentage) ?? 15;
        const finalLocal = Number(p.final_price_with_vat) || calcFinalWithVat(priceAfterDiscount, vatPct);
        map[p.course_id].push({
          country_code: p.country_code,
          original_price: originalPrice,
          discount_percentage: discPct,
          price_after_discount: priceAfterDiscount,
          vat_percentage: vatPct,
          final_price_local: finalLocal,
          final_price_sar: localToSar(finalLocal, currency),
          currency,
        });
      });
      setCountryPricesMap(map);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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

  const toggleExpand = (id: string) => {
    setExpandedCourses(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Tab 1: Update base prices
      for (const c of courses) {
        await supabase.from('courses').update({
          price: c.price,
          discount_percentage: c.discount_percentage,
          vat_percentage: c.vat_percentage,
        } as any).eq('id', c.id);
      }

      // Tab 2: Update country prices
      for (const courseId of Object.keys(countryPricesMap)) {
        await supabase.from('course_country_prices').delete().eq('course_id', courseId);
        const entries = countryPricesMap[courseId];
        if (entries && entries.length > 0) {
          const dbRows = expandEntriesToRows(entries).map(r => ({
            course_id: courseId,
            ...r,
          }));
          await supabase.from('course_country_prices').insert(dbRows);
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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
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
              <TabsTrigger value="base">{isRTL ? 'الأسعار الأساسية' : 'Base Prices'}</TabsTrigger>
              <TabsTrigger value="country">{isRTL ? 'الأسعار حسب الدولة' : 'Country Prices'}</TabsTrigger>
            </TabsList>

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
                            <p className="font-medium truncate max-w-[200px]">
                              {isRTL && c.title_ar ? c.title_ar : c.title}
                            </p>
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={c.original_price || ''}
                              onChange={e => {
                                const val = e.target.value;
                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                  updateCourseField(c.id, 'original_price', val === '' ? 0 : parseFloat(val) || 0);
                                }
                              }}
                              className="h-8 text-sm w-24"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={c.price || ''}
                              onChange={e => {
                                const val = e.target.value;
                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                  updateCourseField(c.id, 'price', val === '' ? 0 : parseFloat(val) || 0);
                                }
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
                              type="text"
                              inputMode="numeric"
                              value={c.vat_percentage}
                              onChange={e => {
                                const val = e.target.value;
                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                  updateCourseField(c.id, 'vat_percentage', val === '' ? 0 : Math.min(100, parseFloat(val) || 0));
                                }
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

            <TabsContent value="country" className="flex-1 min-h-0">
              <ScrollArea className="h-[55vh]">
                <div className="space-y-2 p-1">
                  {courses.map(c => {
                    const isExpanded = expandedCourses.has(c.id);
                    const entries = countryPricesMap[c.id] || [];
                    return (
                      <div key={c.id} className="border border-border rounded-lg">
                        <button
                          type="button"
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors"
                          onClick={() => toggleExpand(c.id)}
                        >
                          <span className="font-medium text-sm truncate">
                            {isRTL && c.title_ar ? c.title_ar : c.title}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">{entries.length} {isRTL ? 'دول' : 'countries'}</Badge>
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-4">
                            <CourseCountryPricing
                              countryPrices={entries}
                              onChange={updated => setCountryPricesMap(prev => ({ ...prev, [c.id]: updated }))}
                              isRTL={isRTL}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
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
