import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Copy,
  BookOpen,
  Users,
  Clock,
  DollarSign,
  Filter,
  ArrowUpDown,
  Upload,
  ImageIcon,
  X,
  Loader2,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";

interface Course {
  id: string;
  title: string;
  title_ar: string | null;
  description: string | null;
  description_ar: string | null;
  thumbnail_url: string | null;
  price: number;
  currency: string;
  status: string;
  difficulty_level: string;
  duration_hours: number | null;
  total_lessons: number | null;
  is_published: boolean;
  created_at: string;
  instructor_id: string | null;
  discount_percentage?: number;
  discount_expires_at?: string | null;
}

// ── Inline AllCoursePricesDialog ──────────────────────────────────────────

const PRICING_COUNTRIES = [
  { code: "SA", name: "Saudi Arabia", name_ar: "السعودية", flag: "🇸🇦", currency: "SAR" },
  { code: "AE", name: "UAE", name_ar: "الإمارات", flag: "🇦🇪", currency: "AED" },
  { code: "KW", name: "Kuwait", name_ar: "الكويت", flag: "🇰🇼", currency: "KWD" },
  { code: "BH", name: "Bahrain", name_ar: "البحرين", flag: "🇧🇭", currency: "BHD" },
  { code: "QA", name: "Qatar", name_ar: "قطر", flag: "🇶🇦", currency: "QAR" },
  { code: "OM", name: "Oman", name_ar: "عُمان", flag: "🇴🇲", currency: "OMR" },
  { code: "EG", name: "Egypt", name_ar: "مصر", flag: "🇪🇬", currency: "EGP" },
  { code: "JO", name: "Jordan", name_ar: "الأردن", flag: "🇯🇴", currency: "JOD" },
  { code: "PS", name: "Palestine", name_ar: "فلسطين", flag: "🇵🇸", currency: "ILS" },
  { code: "IQ", name: "Iraq", name_ar: "العراق", flag: "🇮🇶", currency: "IQD" },
  { code: "SY", name: "Syria", name_ar: "سوريا", flag: "🇸🇾", currency: "SYP" },
  { code: "LB", name: "Lebanon", name_ar: "لبنان", flag: "🇱🇧", currency: "LBP" },
  { code: "YE", name: "Yemen", name_ar: "اليمن", flag: "🇾🇪", currency: "YER" },
  { code: "LY", name: "Libya", name_ar: "ليبيا", flag: "🇱🇾", currency: "LYD" },
  { code: "TN", name: "Tunisia", name_ar: "تونس", flag: "🇹🇳", currency: "TND" },
  { code: "DZ", name: "Algeria", name_ar: "الجزائر", flag: "🇩🇿", currency: "DZD" },
  { code: "MA", name: "Morocco", name_ar: "المغرب", flag: "🇲🇦", currency: "MAD" },
  { code: "SD", name: "Sudan", name_ar: "السودان", flag: "🇸🇩", currency: "SDG" },
  { code: "SO", name: "Somalia", name_ar: "الصومال", flag: "🇸🇴", currency: "SOS" },
  { code: "MR", name: "Mauritania", name_ar: "موريتانيا", flag: "🇲🇷", currency: "MRU" },
  { code: "KM", name: "Comoros", name_ar: "جزر القمر", flag: "🇰🇲", currency: "KMF" },
  { code: "DJ", name: "Djibouti", name_ar: "جيبوتي", flag: "🇩🇯", currency: "DJF" },
];

// Fallback rates (used if live fetch fails)
const PRICING_SAR_RATES_FALLBACK: Record<string, number> = {
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

type CountryPriceRow = {
  original: number; // local currency original price
  discount: number; // discount %
  after_discount: number; // local currency after discount (auto-calculated)
  vat: number; // vat %
  final: number; // local currency final (auto-calculated: after_discount * (1 + vat/100))
  enabled: boolean; // is this row custom or auto from SA?
};

const calcRow = (
  original: number,
  discount: number,
  vat: number,
): Pick<CountryPriceRow, "after_discount" | "final"> => {
  const after = discount > 0 ? Math.round(original * (1 - discount / 100)) : original;
  const final = Math.round(after * (1 + vat / 100));
  return { after_discount: after, final };
};

const AllCoursePricesDialog: React.FC<{ open: boolean; onOpenChange: (v: boolean) => void }> = ({
  open,
  onOpenChange,
}) => {
  const { isRTL } = useLanguage();
  const [saving, setSaving] = React.useState(false);
  const [liveRates, setLiveRates] = React.useState<Record<string, number>>(PRICING_SAR_RATES_FALLBACK);
  const [ratesLoading, setRatesLoading] = React.useState(false);

  // One row per country
  const initRows = (): Record<string, CountryPriceRow> => {
    const rows: Record<string, CountryPriceRow> = {};
    PRICING_COUNTRIES.forEach((c) => {
      rows[c.code] = { original: 0, discount: 0, after_discount: 0, vat: 0, final: 0, enabled: c.code === "SA" };
    });
    return rows;
  };

  const [rows, setRows] = React.useState<Record<string, CountryPriceRow>>(initRows);
  const [courseBasePrice, setCourseBasePrice] = React.useState<number>(0); // SAR price before discount & VAT

  // Fetch live exchange rates
  React.useEffect(() => {
    if (!open) return;
    setRatesLoading(true);
    fetch("https://open.er-api.com/v6/latest/SAR")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.rates) setLiveRates((prev) => ({ ...prev, ...data.rates }));
      })
      .catch(() => {})
      .finally(() => setRatesLoading(false));
  }, [open]);

  // Load existing prices on open
  React.useEffect(() => {
    if (!open) return;
    const load = async () => {
      // Just get SA defaults from first course
      const { data: courses } = await supabase.from("courses").select("id, price, discount_percentage").limit(1);
      const { data: prices } = await supabase.from("course_country_prices").select("*").limit(100);

      setRows((prev) => {
        const updated = { ...prev };
        // Set SA from course base
        if (courses?.[0]) {
          const c = courses[0];
          const disc = c.discount_percentage || 0;
          const { after_discount, final } = calcRow(c.price, disc, 0);
          updated["SA"] = { original: c.price, discount: disc, after_discount, vat: 0, final, enabled: true };
          setCourseBasePrice(c.price); // save base price before discount
        }
        // Set custom countries from saved prices (take first course's prices as template)
        if (prices && courses?.[0]) {
          const courseId = courses[0].id;
          prices
            .filter((p: any) => p.course_id === courseId)
            .forEach((p: any) => {
              const disc = Number(p.discount_percentage) || 0;
              const vat = Number(p.vat_percentage) || 0;
              const orig = Number(p.original_price) || 0;
              const { after_discount, final } = calcRow(orig, disc, vat);
              updated[p.country_code] = { original: orig, discount: disc, after_discount, vat, final, enabled: true };
            });
        }
        return updated;
      });
    };
    load();
  }, [open]);

  const updateRow = (code: string, field: "original" | "discount" | "vat" | "after_discount", val: number) => {
    setRows((prev) => {
      const row = { ...prev[code], [field]: val };
      if (field === "original" || field === "discount" || field === "vat") {
        const { after_discount, final } = calcRow(row.original, row.discount, row.vat);
        row.after_discount = after_discount;
        row.final = final;
      }
      if (field === "after_discount") {
        row.discount = row.original > 0 ? Math.round((1 - val / row.original) * 100) : 0;
        row.final = Math.round(val * (1 + row.vat / 100));
      }
      return { ...prev, [code]: row };
    });
  };

  const toggleRow = (code: string, enabled: boolean) => {
    setRows((prev) => {
      if (!enabled) {
        return { ...prev, [code]: { ...initRows()[code], enabled: false } };
      }
      // Pre-fill from SA when enabling
      const sa = prev["SA"];
      const country = PRICING_COUNTRIES.find((c) => c.code === code)!;
      const rate = liveRates[country.currency] || 1;
      const orig = Math.round(sa.original * rate);
      const disc = sa.discount;
      const vat = sa.vat;
      const { after_discount, final } = calcRow(orig, disc, vat);
      return { ...prev, [code]: { original: orig, discount: disc, after_discount, vat, final, enabled: true } };
    });
  };

  // Get effective row (custom or SA-based)
  const getEffective = (code: string, currency: string): CountryPriceRow => {
    const row = rows[code];
    if (row?.enabled && row.original > 0) return row;
    // Auto: use course base price (before discount) converted to local currency
    const baseSAR = courseBasePrice > 0 ? courseBasePrice : rows["SA"]?.original || 0;
    const rate = liveRates[currency] || 1;
    const orig = Math.round(baseSAR * rate);
    const { after_discount, final } = calcRow(orig, 0, 0); // no discount, no VAT for auto
    return { original: orig, discount: 0, after_discount, vat: 0, final, enabled: false };
  };

  const handleSave = async () => {
    const sa = rows["SA"];
    if (!sa || sa.original <= 0) {
      toast.error(isRTL ? "يرجى إدخال سعر السعودية أولاً" : "Please enter Saudi Arabia price first");
      return;
    }
    setSaving(true);
    try {
      const { data: courses } = await supabase.from("courses").select("id");
      if (!courses?.length) {
        setSaving(false);
        return;
      }

      // Update all courses base price from SA
      await Promise.all(
        courses.map((c: any) =>
          supabase
            .from("courses")
            .update({
              price: sa.original,
              discount_percentage: sa.discount,
            })
            .eq("id", c.id),
        ),
      );

      // Delete all existing country prices
      await supabase
        .from("course_country_prices")
        .delete()
        .in(
          "course_id",
          courses.map((c: any) => c.id),
        );

      // Insert new prices for all countries × all courses
      const insertRows: any[] = [];
      courses.forEach((course: any) => {
        PRICING_COUNTRIES.forEach((country) => {
          const eff = getEffective(country.code, country.currency);
          if (eff.original <= 0) return;
          insertRows.push({
            course_id: course.id,
            country_code: country.code,
            currency: country.currency,
            original_price: eff.original,
            discount_percentage: eff.discount,
            price: eff.after_discount,
            vat_percentage: eff.vat,
            final_price_with_vat: eff.final,
          });
        });
      });

      if (insertRows.length > 0) {
        await supabase.from("course_country_prices").insert(insertRows);
      }

      toast.success(isRTL ? "تم تطبيق الأسعار على جميع الكورسات" : "Prices applied to all courses");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || (isRTL ? "فشل الحفظ" : "Save failed"));
    }
    setSaving(false);
  };

  const nonSA = PRICING_COUNTRIES.filter((c) => c.code !== "SA");
  const sa = rows["SA"];
  // Only show enabled non-SA countries
  const enabledCountries = nonSA.filter((c) => rows[c.code]?.enabled && rows[c.code]?.original > 0);
  // Countries not yet added
  const availableCountries = nonSA.filter((c) => !rows[c.code]?.enabled || rows[c.code]?.original <= 0);
  const [showCountryPicker, setShowCountryPicker] = React.useState(false);
  const [countrySearch, setCountrySearch] = React.useState("");

  const filteredAvailable = availableCountries.filter(
    (c) =>
      c.name_ar.includes(countrySearch) ||
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.currency.toLowerCase().includes(countrySearch.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[780px] w-full max-h-[90vh] flex flex-col p-0 gap-0" dir={isRTL ? "rtl" : "ltr"}>
        <DialogHeader className="px-6 py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-base font-bold">
            {isRTL ? "تسعير موحد لجميع الكورسات" : "Unified Pricing for All Courses"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {isRTL
              ? "أدخل الأسعار مرة واحدة — تُطبَّق على جميع الكورسات. الدول غير المضافة تأخذ سعر السعودية تلقائياً."
              : "Enter prices once — applied to all courses. Countries not added inherit Saudi Arabia price."}
            {ratesLoading && (
              <span className="ms-2 text-primary inline-flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin inline" />
                {isRTL ? "جاري تحديث أسعار الصرف..." : "Updating exchange rates..."}
              </span>
            )}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-muted/90">
              <tr>
                <th className="border border-border px-3 py-2 text-start font-semibold min-w-[140px]">
                  {isRTL ? "الدولة" : "Country"}
                </th>
                <th className="border border-border px-2 py-2 text-center font-semibold min-w-[80px]">
                  {isRTL ? "السعر الأصلي" : "Original"}
                </th>
                <th className="border border-border px-2 py-2 text-center font-semibold min-w-[70px]">
                  {isRTL ? "خصم %" : "Disc %"}
                </th>
                <th className="border border-border px-2 py-2 text-center font-semibold min-w-[80px]">
                  {isRTL ? "بعد الخصم" : "After Disc"}
                </th>
                <th className="border border-border px-2 py-2 text-center font-semibold min-w-[70px]">
                  {isRTL ? "ضريبة %" : "VAT %"}
                </th>
                <th className="border border-border px-2 py-2 text-center font-semibold min-w-[100px] bg-primary/5">
                  {isRTL ? "النهائي (محلي)" : "Final (Local)"}
                </th>
                <th className="border border-border px-2 py-2 text-center font-semibold min-w-[90px] bg-green-500/5">
                  {isRTL ? "النهائي (ر.س)" : "Final (SAR)"}
                </th>
                <th className="border border-border px-2 py-2 text-center font-semibold min-w-[60px]">
                  {isRTL ? "حذف" : "Del"}
                </th>
              </tr>
            </thead>
            <tbody>
              {/* SA row — always editable, no delete */}
              <tr className="bg-primary/5">
                <td className="border border-border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🇸🇦</span>
                    <div>
                      <div className="font-semibold text-primary text-xs">{isRTL ? "السعودية" : "Saudi Arabia"}</div>
                      <div className="text-[10px] text-primary/60">SAR — {isRTL ? "الأساس" : "Base"}</div>
                    </div>
                  </div>
                </td>
                <td className="border border-border px-1 py-1">
                  <Input
                    type="number"
                    min={0}
                    value={sa?.original || ""}
                    placeholder="0"
                    onChange={(e) => updateRow("SA", "original", parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs text-center px-1"
                  />
                </td>
                <td className="border border-border px-1 py-1">
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    value={sa?.discount || ""}
                    placeholder="0"
                    onChange={(e) => updateRow("SA", "discount", parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs text-center px-1"
                  />
                </td>
                <td className="border border-border px-1 py-1">
                  <Input
                    type="number"
                    min={0}
                    value={sa?.after_discount || ""}
                    placeholder="0"
                    onChange={(e) => updateRow("SA", "after_discount", parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs text-center px-1"
                  />
                </td>
                <td className="border border-border px-1 py-1">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={sa?.vat ?? 0}
                    onChange={(e) => updateRow("SA", "vat", parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs text-center px-1"
                  />
                </td>
                <td className="border border-border px-2 py-1 text-center bg-primary/5">
                  <span className="font-bold text-primary text-sm">
                    {sa?.final > 0 ? sa.final.toLocaleString() : "—"}
                  </span>
                  <span className="text-muted-foreground ms-1 text-[10px]">SAR</span>
                </td>
                <td className="border border-border px-2 py-1 text-center bg-green-500/5">
                  <span className="font-bold text-green-600 dark:text-green-400 text-sm">
                    {sa?.final > 0 ? sa.final.toLocaleString() : "—"}
                  </span>
                  <span className="text-muted-foreground ms-1 text-[10px]">SAR</span>
                </td>
                <td className="border border-border px-2 py-1 text-center">
                  <span className="text-[10px] text-muted-foreground">—</span>
                </td>
              </tr>

              {/* Enabled custom countries */}
              {enabledCountries.map((country, ri) => {
                const row = rows[country.code];
                const eff = getEffective(country.code, country.currency);
                const rate = liveRates[country.currency] || 1;
                const finalSAR = rate > 0 ? Math.round(eff.final / rate) : 0;
                return (
                  <tr key={country.code} className={ri % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                    <td className="border border-border px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{country.flag}</span>
                        <div>
                          <div className="font-medium text-xs">{isRTL ? country.name_ar : country.name}</div>
                          <div className="text-[10px] text-muted-foreground">{country.currency}</div>
                        </div>
                      </div>
                    </td>
                    <td className="border border-border px-1 py-1">
                      <Input
                        type="number"
                        min={0}
                        value={row.original || ""}
                        placeholder="0"
                        onChange={(e) => updateRow(country.code, "original", parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs text-center px-1"
                      />
                    </td>
                    <td className="border border-border px-1 py-1">
                      <Input
                        type="number"
                        min={0}
                        max={99}
                        value={row.discount || ""}
                        placeholder="0"
                        onChange={(e) => updateRow(country.code, "discount", parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs text-center px-1"
                      />
                    </td>
                    <td className="border border-border px-1 py-1">
                      <Input
                        type="number"
                        min={0}
                        value={row.after_discount || ""}
                        placeholder="0"
                        onChange={(e) => updateRow(country.code, "after_discount", parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs text-center px-1"
                      />
                    </td>
                    <td className="border border-border px-1 py-1">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={row.vat ?? 0}
                        onChange={(e) => updateRow(country.code, "vat", parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs text-center px-1"
                      />
                    </td>
                    <td className="border border-border px-2 py-1 text-center bg-primary/5">
                      <span className="font-bold text-primary text-sm">
                        {eff.final > 0 ? eff.final.toLocaleString() : "—"}
                      </span>
                      <span className="text-muted-foreground ms-1 text-[10px]">{country.currency}</span>
                    </td>
                    <td className="border border-border px-2 py-1 text-center bg-green-500/5">
                      <span className="font-bold text-green-600 dark:text-green-400 text-sm">
                        {finalSAR > 0 ? finalSAR.toLocaleString() : "—"}
                      </span>
                      <span className="text-muted-foreground ms-1 text-[10px]">SAR</span>
                    </td>
                    <td className="border border-border px-2 py-1 text-center">
                      <button
                        onClick={() => toggleRow(country.code, false)}
                        className="text-destructive hover:bg-destructive/10 rounded p-1 transition-colors"
                        title={isRTL ? "حذف" : "Remove"}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {/* Add country row */}
              <tr>
                <td colSpan={8} className="border border-border px-3 py-2">
                  <button
                    onClick={() => {
                      setShowCountryPicker(true);
                      setCountrySearch("");
                    }}
                    className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {isRTL ? "إضافة دولة مخصصة" : "Add Custom Country"}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Country Picker Overlay */}
        {showCountryPicker && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 rounded-lg">
            <div className="bg-card border border-border rounded-lg w-72 max-h-80 flex flex-col shadow-xl">
              <div className="p-3 border-b border-border flex items-center gap-2">
                <Input
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder={isRTL ? "ابحث عن دولة..." : "Search country..."}
                  className="h-8 text-xs"
                  autoFocus
                />
                <button
                  onClick={() => setShowCountryPicker(false)}
                  className="text-muted-foreground hover:text-foreground flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-1">
                {filteredAvailable.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {isRTL ? "لا توجد دول متاحة" : "No countries available"}
                  </p>
                ) : (
                  filteredAvailable.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => {
                        toggleRow(c.code, true);
                        setShowCountryPicker(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded-md transition-colors text-start"
                    >
                      <span className="text-sm">{c.flag}</span>
                      <span className="flex-1">{isRTL ? c.name_ar : c.name}</span>
                      <span className="text-muted-foreground">{c.currency}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="px-6 py-4 border-t border-border flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isRTL ? "إلغاء" : "Cancel"}
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isRTL ? "تطبيق على جميع الكورسات" : "Apply to All Courses"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

const AdminCourses: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPricesOpen, setIsPricesOpen] = useState(false);
  const navigate = useNavigate();

  // Form state
  interface CountryPrice {
    id?: string;
    country_code: string;
    original_price: number;
    discount_percentage: number;
    price: number;
    currency: string;
  }

  const ARAB_COUNTRIES = [
    { code: "SA", name: "Saudi Arabia", name_ar: "السعودية", currency: "SAR" },
    { code: "AE", name: "UAE", name_ar: "الإمارات", currency: "AED" },
    { code: "KW", name: "Kuwait", name_ar: "الكويت", currency: "KWD" },
    { code: "BH", name: "Bahrain", name_ar: "البحرين", currency: "BHD" },
    { code: "QA", name: "Qatar", name_ar: "قطر", currency: "QAR" },
    { code: "OM", name: "Oman", name_ar: "عُمان", currency: "OMR" },
    { code: "EG", name: "Egypt", name_ar: "مصر", currency: "EGP" },
    { code: "JO", name: "Jordan", name_ar: "الأردن", currency: "JOD" },
    { code: "IQ", name: "Iraq", name_ar: "العراق", currency: "IQD" },
    { code: "SY", name: "Syria", name_ar: "سوريا", currency: "SYP" },
    { code: "LB", name: "Lebanon", name_ar: "لبنان", currency: "LBP" },
    { code: "YE", name: "Yemen", name_ar: "اليمن", currency: "YER" },
    { code: "LY", name: "Libya", name_ar: "ليبيا", currency: "LYD" },
    { code: "TN", name: "Tunisia", name_ar: "تونس", currency: "TND" },
    { code: "DZ", name: "Algeria", name_ar: "الجزائر", currency: "DZD" },
    { code: "MA", name: "Morocco", name_ar: "المغرب", currency: "MAD" },
    { code: "SD", name: "Sudan", name_ar: "السودان", currency: "SDG" },
    { code: "SO", name: "Somalia", name_ar: "الصومال", currency: "SOS" },
    { code: "MR", name: "Mauritania", name_ar: "موريتانيا", currency: "MRU" },
    { code: "KM", name: "Comoros", name_ar: "جزر القمر", currency: "KMF" },
    { code: "DJ", name: "Djibouti", name_ar: "جيبوتي", currency: "DJF" },
    { code: "PS", name: "Palestine", name_ar: "فلسطين", currency: "ILS" },
  ];

  // Exchange rates SAR → X (fallback/approximate)
  const SAR_RATES: Record<string, number> = {
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

  const VAT_RATE = 15;

  const [formData, setFormData] = useState({
    title: "",
    title_ar: "",
    description: "",
    description_ar: "",
    thumbnail_url: "",
    price: 0,
    discount_percentage: 0,
    discount_duration: "" as string,
    discount_expires_at: null as string | null,
    currency: "SAR",
    difficulty_level: "beginner",
    duration_hours: 0,
    is_published: false,
    learning_outcomes: [] as { text_en: string; text_ar: string }[],
  });

  const [countryPrices, setCountryPrices] = useState<CountryPrice[]>([]);

  // Fetch courses
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").order("created_at", { ascending: false });

      if (error) throw error;
      return data as Course[];
    },
  });

  // Create course mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const expiresAt = computeDiscountExpiry(data.discount_duration, data.discount_expires_at);
      const { error } = await supabase.from("courses").insert({
        title: data.title,
        title_ar: data.title_ar || null,
        description: data.description || null,
        description_ar: data.description_ar || null,
        thumbnail_url: data.thumbnail_url || null,
        price: data.price,
        discount_percentage: data.discount_percentage || 0,
        discount_expires_at: data.discount_percentage > 0 ? expiresAt : null,
        currency: data.currency,
        difficulty_level: data.difficulty_level,
        duration_hours: data.duration_hours || null,
        is_published: data.is_published,
        status: data.is_published ? "published" : "draft",
        learning_outcomes: data.learning_outcomes.length > 0 ? data.learning_outcomes : [],
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      setIsCreateOpen(false);
      resetForm();
      toast.success(isRTL ? "تم إنشاء الدورة بنجاح" : "Course created successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || (isRTL ? "فشل في إنشاء الدورة" : "Failed to create course"));
    },
  });

  // Update course mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const expiresAt = computeDiscountExpiry(data.discount_duration, data.discount_expires_at);
      const { error } = await supabase
        .from("courses")
        .update({
          title: data.title,
          title_ar: data.title_ar || null,
          description: data.description || null,
          description_ar: data.description_ar || null,
          thumbnail_url: data.thumbnail_url || null,
          price: data.price,
          discount_percentage: data.discount_percentage || 0,
          discount_expires_at: data.discount_percentage > 0 ? expiresAt : null,
          currency: data.currency,
          difficulty_level: data.difficulty_level,
          duration_hours: data.duration_hours || null,
          is_published: data.is_published,
          status: data.is_published ? "published" : "draft",
          learning_outcomes: data.learning_outcomes.length > 0 ? data.learning_outcomes : [],
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      setEditingCourse(null);
      resetForm();
      toast.success(isRTL ? "تم تحديث الدورة بنجاح" : "Course updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || (isRTL ? "فشل في تحديث الدورة" : "Failed to update course"));
    },
  });

  // Delete course mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      setDeleteConfirm(null);
      toast.success(isRTL ? "تم حذف الدورة بنجاح" : "Course deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || (isRTL ? "فشل في حذف الدورة" : "Failed to delete course"));
    },
  });

  const computeDiscountExpiry = (duration: string, existingExpiry: string | null): string | null => {
    if (!duration || duration === "none") return null;
    if (duration === "keep" && existingExpiry) return existingExpiry;
    const durMap: Record<string, number> = {
      "24h": 24,
      "48h": 48,
      "72h": 72,
      "1week": 168,
    };
    const hours = durMap[duration];
    if (!hours) return existingExpiry;
    return new Date(Date.now() + hours * 3600000).toISOString();
  };

  const resetForm = () => {
    setFormData({
      title: "",
      title_ar: "",
      description: "",
      description_ar: "",
      thumbnail_url: "",
      price: 0,
      discount_percentage: 0,
      discount_duration: "",
      discount_expires_at: null,
      currency: "SAR",
      difficulty_level: "beginner",
      duration_hours: 0,
      is_published: false,
      learning_outcomes: [],
    });
    setCountryPrices([]);
  };

  const handleThumbnailUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error(isRTL ? "يرجى اختيار صورة" : "Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(isRTL ? "حجم الصورة يجب أن لا يتجاوز 5 ميجابايت" : "Image size must be less than 5MB");
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `thumbnails/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("course-thumbnails").upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("course-thumbnails").getPublicUrl(filePath);

      setFormData({ ...formData, thumbnail_url: publicUrl });
      toast.success(isRTL ? "تم رفع الصورة بنجاح" : "Image uploaded successfully");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || (isRTL ? "فشل في رفع الصورة" : "Failed to upload image"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeThumbnail = () => {
    setFormData({ ...formData, thumbnail_url: "" });
  };

  const renewDiscount = async (courseId: string) => {
    const duration = formData.discount_duration || "24h";
    const expiresAt = computeDiscountExpiry(duration, null);
    const { error } = await supabase
      .from("courses")
      .update({ discount_expires_at: expiresAt } as any)
      .eq("id", courseId);
    if (error) {
      toast.error(isRTL ? "فشل في تجديد الخصم" : "Failed to renew discount");
      return;
    }
    setFormData({ ...formData, discount_expires_at: expiresAt });
    queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
    toast.success(isRTL ? "تم تجديد مدة الخصم" : "Discount timer renewed");
  };

  const openEditDialog = async (course: Course) => {
    setFormData({
      title: course.title,
      title_ar: course.title_ar || "",
      description: course.description || "",
      description_ar: course.description_ar || "",
      thumbnail_url: course.thumbnail_url || "",
      price: course.price,
      discount_percentage: (course as any).discount_percentage || 0,
      discount_duration: (course as any).discount_expires_at ? "keep" : "",
      discount_expires_at: (course as any).discount_expires_at || null,
      currency: course.currency || "SAR",
      difficulty_level: course.difficulty_level,
      duration_hours: course.duration_hours || 0,
      is_published: Boolean(course.is_published),
      learning_outcomes: Array.isArray((course as any).learning_outcomes) ? (course as any).learning_outcomes : [],
    });
    // Load country prices
    const { data: prices } = await supabase
      .from("course_country_prices")
      .select("id, country_code, price, currency, original_price, discount_percentage")
      .eq("course_id", course.id);
    setCountryPrices(
      (prices || []).map((p) => ({
        id: p.id,
        country_code: p.country_code,
        original_price: Number((p as any).original_price) || Number(p.price),
        discount_percentage: Number((p as any).discount_percentage) || 0,
        price: Number(p.price),
        currency: p.currency,
      })),
    );
    setEditingCourse(course);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error(isRTL ? "عنوان الدورة مطلوب" : "Course title is required");
      return;
    }

    if (editingCourse) {
      updateMutation.mutate(
        { id: editingCourse.id, data: formData },
        {
          onSuccess: async () => {
            // Save country prices
            await saveCountryPrices(editingCourse.id);
          },
        },
      );
    } else {
      createMutation.mutate(formData, {
        onSuccess: async () => {
          // For new courses, we need the course ID — refetch and save
          const { data: latest } = await supabase
            .from("courses")
            .select("id")
            .eq("title", formData.title)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (latest && countryPrices.length > 0) {
            await saveCountryPrices(latest.id);
          }
        },
      });
    }
  };

  const saveCountryPrices = async (courseId: string) => {
    // Delete existing prices for this course
    await supabase.from("course_country_prices").delete().eq("course_id", courseId);
    // Insert new ones
    if (countryPrices.length > 0) {
      const rows = countryPrices.map((cp) => ({
        course_id: courseId,
        country_code: cp.country_code,
        original_price: cp.original_price,
        discount_percentage: cp.discount_percentage,
        price: cp.price,
        currency: cp.currency,
      }));
      await supabase.from("course_country_prices").insert(rows);
    }
  };

  const DEFAULT_COUNTRY_DISCOUNT = 78;
  const addCountryPrice = () => {
    setCountryPrices([
      ...countryPrices,
      { country_code: "", original_price: 0, discount_percentage: DEFAULT_COUNTRY_DISCOUNT, price: 0, currency: "" },
    ]);
  };

  const removeCountryPrice = (index: number) => {
    setCountryPrices(countryPrices.filter((_, i) => i !== index));
  };

  const recalcCountryPrice = (originalPrice: number, discountPct: number): number => {
    if (discountPct > 0 && discountPct <= 100) {
      return Math.ceil(originalPrice * (1 - discountPct / 100));
    }
    return originalPrice;
  };

  const updateCountryPrice = (index: number, field: keyof CountryPrice, value: any) => {
    const updated = [...countryPrices];
    if (field === "country_code") {
      const country = ARAB_COUNTRIES.find((c) => c.code === value);
      updated[index] = { ...updated[index], country_code: value, currency: country?.currency || "" };
    } else if (field === "original_price") {
      const op = typeof value === "number" ? value : parseFloat(value) || 0;
      updated[index] = {
        ...updated[index],
        original_price: op,
        price: recalcCountryPrice(op, updated[index].discount_percentage),
      };
    } else if (field === "discount_percentage") {
      const dp = typeof value === "number" ? value : parseFloat(value) || 0;
      updated[index] = {
        ...updated[index],
        discount_percentage: dp,
        price: recalcCountryPrice(updated[index].original_price, dp),
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setCountryPrices(updated);
  };

  // Filter courses
  const filteredCourses = courses.filter((course) => {
    const matchesSearch =
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (course.title_ar && course.title_ar.includes(searchQuery));

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "published" && course.is_published) ||
      (statusFilter === "draft" && !course.is_published);

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (course: Course) => {
    if (course.is_published) {
      return (
        <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">{isRTL ? "منشور" : "Published"}</Badge>
      );
    }
    return <Badge variant="secondary">{isRTL ? "مسودة" : "Draft"}</Badge>;
  };

  const getDifficultyLabel = (level: string) => {
    const labels: Record<string, { en: string; ar: string }> = {
      beginner: { en: "Beginner", ar: "مبتدئ" },
      intermediate: { en: "Intermediate", ar: "متوسط" },
      advanced: { en: "Advanced", ar: "متقدم" },
    };
    return isRTL ? labels[level]?.ar || level : labels[level]?.en || level;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{isRTL ? "إدارة الدورات" : "Course Management"}</h1>
            <p className="text-muted-foreground">
              {isRTL ? "إنشاء وتعديل وإدارة جميع الدورات" : "Create, edit, and manage all courses"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsPricesOpen(true)} className="gap-2">
              <DollarSign className="w-4 h-4" />
              {isRTL ? "إدارة الأسعار" : "Manage Prices"}
            </Button>
            <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              {isRTL ? "إنشاء دورة" : "Create Course"}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{isRTL ? "إجمالي الدورات" : "Total Courses"}</p>
                <p className="text-2xl font-bold">{courses.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-500/10">
                <Eye className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{isRTL ? "منشورة" : "Published"}</p>
                <p className="text-2xl font-bold">{courses.filter((c) => c.is_published).length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-500/10">
                <Edit className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{isRTL ? "مسودات" : "Drafts"}</p>
                <p className="text-2xl font-bold">{courses.filter((c) => !c.is_published).length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-500/10">
                <Users className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{isRTL ? "إجمالي الطلاب" : "Total Students"}</p>
                <p className="text-2xl font-bold">0</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={isRTL ? "البحث عن دورة..." : "Search courses..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ps-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="w-4 h-4 me-2" />
                  <SelectValue placeholder={isRTL ? "الحالة" : "Status"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? "الكل" : "All"}</SelectItem>
                  <SelectItem value="published">{isRTL ? "منشور" : "Published"}</SelectItem>
                  <SelectItem value="draft">{isRTL ? "مسودة" : "Draft"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Courses Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="p-12 text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {isRTL ? "لا توجد دورات" : "No courses found"}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {isRTL ? "ابدأ بإنشاء أول دورة" : "Start by creating your first course"}
                </p>
                <Button onClick={() => setIsCreateOpen(true)} variant="outline">
                  <Plus className="w-4 h-4 me-2" />
                  {isRTL ? "إنشاء دورة" : "Create Course"}
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? "الدورة" : "Course"}</TableHead>
                    <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                    <TableHead>{isRTL ? "المستوى" : "Level"}</TableHead>
                    <TableHead>{isRTL ? "السعر" : "Price"}</TableHead>
                    <TableHead>{isRTL ? "المدة" : "Duration"}</TableHead>
                    <TableHead className="text-end">{isRTL ? "الإجراءات" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCourses.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">
                            {isRTL && course.title_ar ? course.title_ar : course.title}
                          </p>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {isRTL && course.description_ar ? course.description_ar : course.description}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(course)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getDifficultyLabel(course.difficulty_level)}</Badge>
                      </TableCell>
                      <TableCell>
                        {course.price === 0
                          ? isRTL
                            ? "مجاني"
                            : "Free"
                          : `${course.price} ${course.currency || "SAR"}`}
                      </TableCell>
                      <TableCell>{course.duration_hours ? `${course.duration_hours}h` : "-"}</TableCell>
                      <TableCell className="text-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={isRTL ? "start" : "end"}>
                            <DropdownMenuLabel>{isRTL ? "الإجراءات" : "Actions"}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link to={`/admin/courses/${course.id}`}>
                                <Edit className="w-4 h-4 me-2" />
                                {isRTL ? "تعديل المحتوى" : "Edit Content"}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(course)}>
                              <Edit className="w-4 h-4 me-2" />
                              {isRTL ? "تعديل الإعدادات" : "Edit Settings"}
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to={`/courses/${course.id}`} target="_blank">
                                <Eye className="w-4 h-4 me-2" />
                                {isRTL ? "معاينة" : "Preview"}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to={`/admin/courses/${course.id}/reviews`}>
                                <Star className="w-4 h-4 me-2" />
                                {isRTL ? "التقييمات والمراجعات" : "Reviews & Ratings"}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/admin/courses/${course.id}/students`)}>
                              <Users className="w-4 h-4 me-2" />
                              {isRTL ? "عرض الطلاب" : "View Students"}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="w-4 h-4 me-2" />
                              {isRTL ? "استنساخ" : "Duplicate"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDeleteConfirm(course.id)} className="text-destructive">
                              <Trash2 className="w-4 h-4 me-2" />
                              {isRTL ? "حذف" : "Delete"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog
          open={isCreateOpen || !!editingCourse}
          onOpenChange={(open) => {
            if (!open) {
              setIsCreateOpen(false);
              setEditingCourse(null);
              resetForm();
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCourse
                  ? isRTL
                    ? "تعديل الدورة"
                    : "Edit Course"
                  : isRTL
                    ? "إنشاء دورة جديدة"
                    : "Create New Course"}
              </DialogTitle>
              <DialogDescription>{isRTL ? "أدخل تفاصيل الدورة" : "Enter course details"}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isRTL ? "العنوان (إنجليزي)" : "Title (English)"}</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Course title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? "العنوان (عربي)" : "Title (Arabic)"}</Label>
                  <Input
                    value={formData.title_ar}
                    onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
                    placeholder="عنوان الدورة"
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isRTL ? "الوصف (إنجليزي)" : "Description (English)"}</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Course description"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? "الوصف (عربي)" : "Description (Arabic)"}</Label>
                  <Textarea
                    value={formData.description_ar}
                    onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                    placeholder="وصف الدورة"
                    dir="rtl"
                    rows={3}
                  />
                </div>
              </div>

              {/* Thumbnail Upload */}
              <div className="space-y-2">
                <Label>{isRTL ? "صورة الدورة" : "Course Thumbnail"}</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailUpload}
                  className="hidden"
                />

                {formData.thumbnail_url ? (
                  <div className="relative w-full h-40 rounded-lg overflow-hidden border border-border">
                    <img
                      src={formData.thumbnail_url}
                      alt="Course thumbnail"
                      width={1280}
                      height={720}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 end-2 h-8 w-8"
                      onClick={removeThumbnail}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-40 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <span className="text-sm text-muted-foreground">
                          {isRTL ? "جاري الرفع..." : "Uploading..."}
                        </span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {isRTL ? "انقر لرفع صورة" : "Click to upload image"}
                        </span>
                        <span className="text-xs text-muted-foreground/70">
                          {isRTL ? "الحد الأقصى 5 ميجابايت" : "Max 5MB"}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>{isRTL ? "السعر" : "Price"}</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formData.price || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                        setFormData({ ...formData, price: val === "" ? 0 : parseFloat(val) || 0 });
                      }
                    }}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? "نسبة الخصم %" : "Discount %"}</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formData.discount_percentage || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                        const num = val === "" ? 0 : parseFloat(val) || 0;
                        setFormData({ ...formData, discount_percentage: Math.min(100, Math.max(0, num)) });
                      }
                    }}
                    placeholder="0"
                  />
                  {formData.discount_percentage > 0 && formData.price > 0 && (
                    <p className="text-xs text-primary font-medium">
                      {isRTL ? "السعر بعد الخصم:" : "After discount:"}{" "}
                      {Math.round(formData.price * (1 - formData.discount_percentage / 100))} {formData.currency}
                    </p>
                  )}
                </div>

                {/* Discount Duration Row */}
                {formData.discount_percentage > 0 && (
                  <div className="col-span-2 md:col-span-4 grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{isRTL ? "مدة الخصم" : "Discount Duration"}</Label>
                      <Select
                        value={formData.discount_duration}
                        onValueChange={(value) => setFormData({ ...formData, discount_duration: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={isRTL ? "اختر المدة" : "Select duration"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{isRTL ? "بدون انتهاء" : "No expiry"}</SelectItem>
                          <SelectItem value="24h">24 {isRTL ? "ساعة" : "hours"}</SelectItem>
                          <SelectItem value="48h">48 {isRTL ? "ساعة" : "hours"}</SelectItem>
                          <SelectItem value="72h">72 {isRTL ? "ساعة" : "hours"}</SelectItem>
                          <SelectItem value="1week">{isRTL ? "أسبوع" : "1 week"}</SelectItem>
                          {formData.discount_expires_at && (
                            <SelectItem value="keep">{isRTL ? "إبقاء الحالي" : "Keep current"}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    {editingCourse && formData.discount_expires_at && (
                      <div className="space-y-2">
                        <Label>{isRTL ? "ينتهي في" : "Expires at"}</Label>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground flex-1">
                            {new Date(formData.discount_expires_at).toLocaleString()}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => renewDiscount(editingCourse.id)}
                            className="text-xs"
                          >
                            {isRTL ? "تجديد" : "Renew"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{isRTL ? "العملة" : "Currency"}</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SAR">SAR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="AED">AED</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? "المستوى" : "Level"}</Label>
                  <Select
                    value={formData.difficulty_level}
                    onValueChange={(value) => setFormData({ ...formData, difficulty_level: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">{isRTL ? "مبتدئ" : "Beginner"}</SelectItem>
                      <SelectItem value="intermediate">{isRTL ? "متوسط" : "Intermediate"}</SelectItem>
                      <SelectItem value="advanced">{isRTL ? "متقدم" : "Advanced"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* SAR Price Calculator */}
              {formData.price > 0 && (
                <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-primary" />
                    {isRTL ? "حاسبة السعر (ر.س)" : "Price Calculator (SAR)"}
                  </h4>
                  {(() => {
                    const orig = formData.price;
                    const disc = formData.discount_percentage > 0 ? formData.discount_percentage : 0;
                    const afterDiscount = disc > 0 ? Math.ceil(orig * (1 - disc / 100)) : orig;
                    const vat = Math.ceil(afterDiscount * (VAT_RATE / 100));
                    const total = afterDiscount + vat;
                    return (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div className="bg-background rounded-md p-3 border border-border">
                          <p className="text-muted-foreground text-xs">{isRTL ? "السعر الأصلي" : "Original Price"}</p>
                          <p className="font-bold text-lg">
                            {orig} <span className="text-xs font-normal">SAR</span>
                          </p>
                        </div>
                        <div className="bg-background rounded-md p-3 border border-border">
                          <p className="text-muted-foreground text-xs">
                            {isRTL ? "بعد الخصم" : "After Discount"}
                            {disc > 0 ? ` (-${disc}%)` : ""}
                          </p>
                          <p className="font-bold text-lg">
                            {afterDiscount} <span className="text-xs font-normal">SAR</span>
                          </p>
                        </div>
                        <div className="bg-background rounded-md p-3 border border-border">
                          <p className="text-muted-foreground text-xs">
                            {isRTL ? "ضريبة القيمة المضافة" : "VAT"} (15%)
                          </p>
                          <p className="font-bold text-lg">
                            {vat} <span className="text-xs font-normal">SAR</span>
                          </p>
                        </div>
                        <div className="bg-primary/10 rounded-md p-3 border border-primary/30">
                          <p className="text-primary text-xs font-medium">
                            {isRTL ? "السعر الشامل للمستخدم" : "User Sees (Total)"}
                          </p>
                          <p className="font-bold text-lg text-primary">
                            {total} <span className="text-xs font-normal">SAR</span>
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">{isRTL ? "ماذا ستتعلم" : "What You Will Learn"}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        learning_outcomes: [...formData.learning_outcomes, { text_en: "", text_ar: "" }],
                      })
                    }
                  >
                    <Plus className="w-4 h-4 me-1" />
                    {isRTL ? "إضافة" : "Add"}
                  </Button>
                </div>
                {formData.learning_outcomes.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {isRTL
                      ? "لم يتم إضافة نقاط تعلم. سيتم عرض عناوين الفصول تلقائياً."
                      : "No outcomes added. Chapter titles will be shown automatically."}
                  </p>
                )}
                {formData.learning_outcomes.map((outcome, idx) => (
                  <div key={idx} className="flex gap-2 items-start border border-border/50 rounded-lg p-3">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <Input
                        value={outcome.text_en}
                        onChange={(e) => {
                          const updated = [...formData.learning_outcomes];
                          updated[idx] = { ...updated[idx], text_en: e.target.value };
                          setFormData({ ...formData, learning_outcomes: updated });
                        }}
                        placeholder={isRTL ? "النص بالإنجليزية" : "English text"}
                      />
                      <Input
                        value={outcome.text_ar}
                        onChange={(e) => {
                          const updated = [...formData.learning_outcomes];
                          updated[idx] = { ...updated[idx], text_ar: e.target.value };
                          setFormData({ ...formData, learning_outcomes: updated });
                        }}
                        placeholder={isRTL ? "النص بالعربية" : "Arabic text"}
                        dir="rtl"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive flex-shrink-0"
                      onClick={() => {
                        const updated = formData.learning_outcomes.filter((_, i) => i !== idx);
                        setFormData({ ...formData, learning_outcomes: updated });
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Country-Specific Pricing */}
              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold">{isRTL ? "أسعار حسب الدولة" : "Country Pricing"}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isRTL
                        ? "حدد أسعار مخصصة لكل دولة. إذا لم يتم التحديد، سيتم التحويل تلقائياً من السعر الأساسي."
                        : "Set custom prices per country. If not set, base price will be auto-converted."}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addCountryPrice}>
                    <Plus className="w-4 h-4 me-1" />
                    {isRTL ? "إضافة سعر" : "Add Country Price"}
                  </Button>
                </div>
                {countryPrices.map((cp, idx) => {
                  const usedCodes = countryPrices.filter((_, i) => i !== idx).map((p) => p.country_code);
                  const availableCountries = ARAB_COUNTRIES.filter((c) => !usedCodes.includes(c.code));
                  return (
                    <div key={idx} className="border border-border/50 rounded-lg p-3 space-y-2">
                      <div className="flex gap-2 items-center">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <Select
                            value={cp.country_code}
                            onValueChange={(val) => updateCountryPrice(idx, "country_code", val)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={isRTL ? "الدولة" : "Country"} />
                            </SelectTrigger>
                            <SelectContent>
                              {availableCountries.map((c) => (
                                <SelectItem key={c.code} value={c.code}>
                                  {isRTL ? c.name_ar : c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={cp.currency}
                            readOnly
                            disabled
                            className="bg-muted"
                            placeholder={isRTL ? "العملة" : "Currency"}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive flex-shrink-0"
                          onClick={() => removeCountryPrice(idx)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      {/* Row 1: SAR final price input → auto-converts everything */}
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-primary">
                          {isRTL
                            ? "السعر النهائي بالريال (شامل الخصم والضريبة)"
                            : "Final SAR Price (incl. discount & VAT)"}
                        </Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder={isRTL ? "أدخل السعر النهائي بالريال" : "Enter final SAR amount"}
                          className="border-primary/50 font-semibold"
                          value={(() => {
                            if (!cp.price || !cp.currency) return "";
                            const rate = SAR_RATES[cp.currency] || 1;
                            const localWithVat = cp.price + Math.ceil(cp.price * (VAT_RATE / 100));
                            return rate > 0 ? Math.ceil(localWithVat / rate) : "";
                          })()}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || /^\d*\.?\d*$/.test(val)) {
                              const sarFinal = val === "" ? 0 : parseFloat(val) || 0;
                              if (sarFinal > 0 && cp.currency) {
                                const rate = SAR_RATES[cp.currency] || 1;
                                const sarPreTax = sarFinal / (1 + VAT_RATE / 100);
                                const localPreTax = Math.ceil(sarPreTax * rate);
                                const disc =
                                  cp.discount_percentage > 0 ? cp.discount_percentage : DEFAULT_COUNTRY_DISCOUNT;
                                const localOriginal =
                                  disc > 0 && disc < 100 ? Math.ceil(localPreTax / (1 - disc / 100)) : localPreTax;
                                const updated = [...countryPrices];
                                updated[idx] = {
                                  ...updated[idx],
                                  discount_percentage: disc,
                                  original_price: localOriginal,
                                  price: localPreTax,
                                };
                                setCountryPrices(updated);
                              } else if (val === "") {
                                const updated = [...countryPrices];
                                updated[idx] = { ...updated[idx], original_price: 0, price: 0 };
                                setCountryPrices(updated);
                              }
                            }
                          }}
                        />
                      </div>

                      {/* Row 2: Local currency detail fields */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            {isRTL ? "السعر الأصلي (محلي)" : "Original (local)"}
                          </Label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={cp.original_price || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "" || /^\d*\.?\d*$/.test(val)) {
                                updateCountryPrice(idx, "original_price", val === "" ? 0 : parseFloat(val) || 0);
                              }
                            }}
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{isRTL ? "الخصم %" : "Discount %"}</Label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={cp.discount_percentage || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "" || /^\d*\.?\d*$/.test(val)) {
                                const num = val === "" ? 0 : parseFloat(val) || 0;
                                if (num <= 100) {
                                  updateCountryPrice(idx, "discount_percentage", num);
                                }
                              }
                            }}
                            placeholder={String(DEFAULT_COUNTRY_DISCOUNT)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            {isRTL ? "بعد الخصم (محلي)" : "After Disc. (local)"}
                          </Label>
                          <Input value={cp.price} readOnly disabled className="bg-muted font-semibold" />
                        </div>
                      </div>

                      {/* Price Summary */}
                      {cp.original_price > 0 && cp.currency && (
                        <div className="bg-muted/50 rounded-md p-3 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            {isRTL ? "ملخص السعر" : "Price Summary"}
                          </p>
                          {(() => {
                            const rate = SAR_RATES[cp.currency] || 1;
                            const sarOriginal = rate > 0 ? Math.ceil(cp.original_price / rate) : 0;
                            const afterDisc = cp.price;
                            const vat = Math.ceil(afterDisc * (VAT_RATE / 100));
                            const totalLocal = afterDisc + vat;
                            const sarTotal = rate > 0 ? Math.ceil(totalLocal / rate) : 0;
                            return (
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                                <div className="bg-background rounded p-2 border border-border">
                                  <p className="text-muted-foreground">{isRTL ? "الأصلي بالريال" : "SAR Original"}</p>
                                  <p className="font-semibold">{sarOriginal} SAR</p>
                                </div>
                                <div className="bg-background rounded p-2 border border-border">
                                  <p className="text-muted-foreground">
                                    {isRTL ? "بعد الخصم" : "After Disc."} (-{cp.discount_percentage}%)
                                  </p>
                                  <p className="font-semibold">
                                    {afterDisc} {cp.currency}
                                  </p>
                                </div>
                                <div className="bg-background rounded p-2 border border-border">
                                  <p className="text-muted-foreground">
                                    {isRTL ? "الضريبة" : "VAT"} ({VAT_RATE}%)
                                  </p>
                                  <p className="font-semibold">
                                    {vat} {cp.currency}
                                  </p>
                                </div>
                                <div className="bg-primary/10 rounded p-2 border border-primary/30">
                                  <p className="text-primary font-medium">{isRTL ? "يظهر للمستخدم" : "User Sees"}</p>
                                  <p className="font-bold text-primary">
                                    {totalLocal} {cp.currency}
                                  </p>
                                </div>
                                <div className="bg-background rounded p-2 border border-border">
                                  <p className="text-muted-foreground">{isRTL ? "الإجمالي بالريال" : "SAR Total"}</p>
                                  <p className="font-semibold">{sarTotal} SAR</p>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <Label>{isRTL ? "المدة (ساعات)" : "Duration (hours)"}</Label>
                <Input
                  type="number"
                  value={formData.duration_hours}
                  onChange={(e) => setFormData({ ...formData, duration_hours: parseInt(e.target.value) || 0 })}
                  min={0}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-6 pt-4">
                <div className="flex items-center gap-3">
                  <Switch
                    id="is_published"
                    checked={Boolean(formData.is_published)}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                  />
                  <Label htmlFor="is_published" className="cursor-pointer">
                    {isRTL ? "نشر الدورة" : "Publish Course"}
                  </Label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingCourse(null);
                  resetForm();
                }}
              >
                {isRTL ? "إلغاء" : "Cancel"}
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending
                  ? isRTL
                    ? "جاري الحفظ..."
                    : "Saving..."
                  : editingCourse
                    ? isRTL
                      ? "تحديث"
                      : "Update"
                    : isRTL
                      ? "إنشاء"
                      : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isRTL ? "تأكيد الحذف" : "Confirm Delete"}</DialogTitle>
              <DialogDescription>
                {isRTL
                  ? "هل أنت متأكد من حذف هذه الدورة؟ لا يمكن التراجع عن هذا الإجراء."
                  : "Are you sure you want to delete this course? This action cannot be undone."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                {isRTL ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (isRTL ? "جاري الحذف..." : "Deleting...") : isRTL ? "حذف" : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AllCoursePricesDialog open={isPricesOpen} onOpenChange={setIsPricesOpen} />
      </div>
    </AdminLayout>
  );
};

export default AdminCourses;
