import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Loader2, AlertTriangle, Percent, Hash } from "lucide-react";
import { toast } from "sonner";
import type { BundleTierRow } from "@/types/bundle";

type EditableTier = {
  id?: string;
  min_courses: number;
  label_ar: string;
  label_en: string;
  discount_percentage: number;
  is_active: boolean;
};

function mapRow(r: BundleTierRow): EditableTier {
  return {
    id: r.id,
    min_courses: r.min_courses,
    label_ar: r.label_ar ?? "",
    label_en: r.label_en ?? "",
    discount_percentage: Number(r.discount_percentage) || 0,
    is_active: r.is_active !== false,
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const BundleTiersDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const initialIdsRef = useRef<string[]>([]);
  const [rows, setRows] = useState<EditableTier[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["bundle-tiers"],
    queryFn: async () => {
      const { data: tiers, error } = await supabase.from("bundle_tiers").select("*").order("min_courses", { ascending: true });
      if (error) throw error;
      return (tiers ?? []) as BundleTierRow[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open || !data) return;
    setRows(data.map(mapRow));
    initialIdsRef.current = data.map((d) => d.id);
  }, [open, data]);

  const duplicateMins = useMemo(() => {
    const seen = new Map<number, number>();
    for (const r of rows) {
      const n = Math.floor(Number(r.min_courses));
      seen.set(n, (seen.get(n) || 0) + 1);
    }
    const dups: number[] = [];
    seen.forEach((c, k) => {
      if (c > 1) dups.push(k);
    });
    return dups;
  }, [rows]);

  const monotonicWarning = useMemo(() => {
    const sorted = [...rows].sort((a, b) => a.min_courses - b.min_courses);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1].discount_percentage;
      const cur = sorted[i].discount_percentage;
      if (cur < prev) return true;
    }
    return false;
  }, [rows]);

  const sortedIndices = useMemo(() => {
    return rows
      .map((_, i) => i)
      .sort((a, b) => rows[a].min_courses - rows[b].min_courses);
  }, [rows]);

  const updateRow = (index: number, patch: Partial<EditableTier>) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const addRow = () => {
    setRows((prev) => {
      const nextMin = prev.length === 0 ? 2 : Math.max(2, ...prev.map((r) => r.min_courses)) + 1;
      return [
        ...prev,
        {
          min_courses: nextMin,
          label_ar: "",
          label_en: "",
          discount_percentage: 0,
          is_active: true,
        },
      ];
    });
  };

  const removeRowAt = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    for (const r of rows) {
      const mc = Math.floor(Number(r.min_courses));
      if (mc < 2) {
        toast.error(isRTL ? "الحد الأدنى لعدد الكورسات هو 2" : "Minimum courses per tier is 2");
        return;
      }
      const d = Number(r.discount_percentage);
      if (d < 0 || d > 80) {
        toast.error(isRTL ? "الخصم يجب أن يكون بين 0 و 80%" : "Discount must be between 0 and 80%");
        return;
      }
    }
    if (duplicateMins.length > 0) {
      toast.error(isRTL ? "لا يمكن تكرار عدد الكورسات لكل مستوى" : "Duplicate min_courses values are not allowed");
      return;
    }

    setSaving(true);
    try {
      const currentIds = new Set(rows.map((r) => r.id).filter(Boolean) as string[]);
      const toRemove = initialIdsRef.current.filter((id) => !currentIds.has(id));
      for (const id of toRemove) {
        const { error } = await supabase.from("bundle_tiers").delete().eq("id", id);
        if (error) throw error;
      }

      for (const r of rows) {
        const payload = {
          min_courses: Math.floor(Number(r.min_courses)),
          label_ar: r.label_ar.trim() || null,
          label_en: r.label_en.trim() || null,
          discount_percentage: Number(r.discount_percentage),
          is_active: r.is_active,
        };
        if (r.id) {
          const { error } = await supabase.from("bundle_tiers").update(payload).eq("id", r.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("bundle_tiers").insert(payload);
          if (error) throw error;
        }
      }

      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["bundle-tiers"] });
      if (monotonicWarning) {
        toast.warning(
          isRTL
            ? "تم الحفظ. تنبيه: الخصم لا يزداد مع زيادة عدد الكورسات في بعض المستويات."
            : "Saved. Note: discount does not increase with course count for some tiers.",
        );
      } else {
        toast.success(isRTL ? "تم حفظ مستويات الباقات" : "Bundle tiers saved");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || (isRTL ? "فشل الحفظ" : "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteRow = () => {
    if (!deleteId) return;
    const idx = rows.findIndex((r) => r.id === deleteId);
    if (idx >= 0) removeRowAt(idx);
    setDeleteId(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-xl" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader className="space-y-2 text-start sm:text-start">
            <DialogTitle className="text-lg">
              {isRTL ? "خصومات الباقات" : "Bundle discount tiers"}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {isRTL
                ? "كل مستوى يربط عدداً أدنى من الكورسات بنسبة خصم. يجب أن تكون قيماً min_courses مختلفة، ويفضّل أن يزداد الخصم عند طلب عدد أكبر من الكورسات."
                : "Each tier maps a minimum number of courses to a discount percentage. Use unique course counts; higher counts should usually mean a higher discount."}
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-14">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {duplicateMins.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {isRTL
                      ? "يوجد تكرار في الحد الأدنى لعدد الكورسات. عدّل القيم ثم احفظ."
                      : "Duplicate minimum course counts. Fix the values before saving."}
                  </AlertDescription>
                </Alert>
              )}
              {monotonicWarning && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {isRTL
                      ? "من الأفضل أن يكون الخصم أعلى عندما يتطلّب المستوى كورسات أكثر."
                      : "Consider increasing the discount percentage for tiers that require more courses."}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                {sortedIndices.map((i) => {
                  const row = rows[i];
                  return (
                    <div
                      key={row.id ?? `new-${i}`}
                      className="rounded-lg border border-border bg-card p-4 shadow-sm"
                    >
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {isRTL ? `المستوى · ${row.min_courses}+ كورسات` : `Tier · ${row.min_courses}+ courses`}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={row.is_active}
                              onCheckedChange={(c) => updateRow(i, { is_active: c })}
                              aria-label={isRTL ? "نشط" : "Active"}
                            />
                            <span className="text-xs text-muted-foreground">{isRTL ? "نشط" : "On"}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => {
                              if (row.id) setDeleteId(row.id);
                              else removeRowAt(i);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor={`min-${i}`} className="flex items-center gap-1.5 text-xs font-medium">
                            <Hash className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                            {isRTL ? "الحد الأدنى للكورسات" : "Minimum courses"}
                          </Label>
                          <Input
                            id={`min-${i}`}
                            type="number"
                            min={2}
                            className="h-9"
                            value={row.min_courses || ""}
                            onChange={(e) => {
                              const v = e.target.value === "" ? 2 : parseInt(e.target.value, 10);
                              updateRow(i, { min_courses: Number.isFinite(v) ? Math.max(2, v) : 2 });
                            }}
                          />
                          <p className="text-[11px] text-muted-foreground">
                            {isRTL ? "من 2 فما فوق." : "2 or more."}
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`pct-${i}`} className="flex items-center gap-1.5 text-xs font-medium">
                            <Percent className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                            {isRTL ? "نسبة الخصم" : "Discount %"}
                          </Label>
                          <Input
                            id={`pct-${i}`}
                            type="number"
                            min={0}
                            max={80}
                            className="h-9"
                            value={row.discount_percentage}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              updateRow(i, { discount_percentage: Number.isFinite(v) ? v : 0 });
                            }}
                          />
                          <p className="text-[11px] text-muted-foreground">
                            {isRTL ? "بين 0 و 80." : "Between 0 and 80."}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor={`ar-${i}`} className="text-xs font-medium">
                            {isRTL ? "الاسم (عربي)" : "Name (Arabic)"}
                          </Label>
                          <Input
                            id={`ar-${i}`}
                            value={row.label_ar}
                            onChange={(e) => updateRow(i, { label_ar: e.target.value })}
                            placeholder={isRTL ? "مثال: باقة الثنائي" : "e.g. Duo"}
                            dir="rtl"
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`en-${i}`} className="text-xs font-medium">
                            {isRTL ? "الاسم (إنجليزي)" : "Name (English)"}
                          </Label>
                          <Input
                            id={`en-${i}`}
                            value={row.label_en}
                            onChange={(e) => updateRow(i, { label_en: e.target.value })}
                            placeholder={isRTL ? "Duo bundle" : "e.g. Duo bundle"}
                            className="h-9"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button type="button" variant="outline" className="w-full gap-2 border-dashed" onClick={addRow}>
                <Plus className="h-4 w-4" />
                {isRTL ? "إضافة مستوى خصم" : "Add discount tier"}
              </Button>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSave} disabled={saving || isLoading}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {isRTL ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent dir={isRTL ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? "حذف المستوى؟" : "Delete tier?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL ? "سيتم حذف هذا المستوى عند تأكيد الحفظ في قاعدة البيانات." : "This tier will be removed when you save."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRow} className="bg-destructive text-destructive-foreground">
              {isRTL ? "حذف من القائمة" : "Remove from list"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BundleTiersDialog;
