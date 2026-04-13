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
import { Plus, Trash2, Loader2, AlertTriangle } from "lucide-react";
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
      const { data: tiers, error } = await supabase
        .from("bundle_tiers")
        .select("*")
        .order("min_courses", { ascending: true });
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

  const updateRow = (index: number, patch: Partial<EditableTier>) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const addRow = () => {
    setRows((prev) => {
      const nextMin =
        prev.length === 0 ? 2 : Math.max(2, ...prev.map((r) => r.min_courses)) + 1;
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
        <DialogContent
          className="max-w-3xl max-h-[90vh] overflow-y-auto"
          dir={isRTL ? "rtl" : "ltr"}
        >
          <DialogHeader>
            <DialogTitle>{isRTL ? "إعداد خصومات الباقات" : "Bundle discount tiers"}</DialogTitle>
            <DialogDescription>
              {isRTL
                ? "كلما اختار المستخدم كورسات أكثر، حصل على خصم أكبر."
                : "The more courses a user selects, the larger the discount can be."}
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {duplicateMins.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {isRTL
                      ? "يوجد تكرار في عدد الكورسات لبعض الصفوف."
                      : "Duplicate min_courses values in the table."}
                  </AlertDescription>
                </Alert>
              )}
              {monotonicWarning && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {isRTL
                      ? "تنبيه: من الأفضل أن يزداد الخصم عند زيادة عدد الكورسات المطلوبة."
                      : "Warning: discount should generally increase as the required course count increases."}
                  </AlertDescription>
                </Alert>
              )}

              <div className="rounded-md border border-border overflow-hidden">
                <div className="grid grid-cols-12 gap-2 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <div className="col-span-2">{isRTL ? "عدد الكورسات" : "Min courses"}</div>
                  <div className="col-span-4">{isRTL ? "الاسم (عربي)" : "Label (AR)"}</div>
                  <div className="col-span-4">{isRTL ? "الاسم (إنجليزي)" : "Label (EN)"}</div>
                  <div className="col-span-1 text-center">{isRTL ? "خصم %" : "% off"}</div>
                  <div className="col-span-1" />
                </div>
                <div className="divide-y divide-border">
                  {rows.map((row, i) => (
                    <div key={row.id ?? `new-${i}`} className="grid grid-cols-12 gap-2 px-3 py-3 items-center">
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min={2}
                          value={row.min_courses || ""}
                          onChange={(e) => {
                            const v = e.target.value === "" ? 2 : parseInt(e.target.value, 10);
                            updateRow(i, { min_courses: Number.isFinite(v) ? Math.max(2, v) : 2 });
                          }}
                        />
                      </div>
                      <div className="col-span-4">
                        <Input
                          value={row.label_ar}
                          onChange={(e) => updateRow(i, { label_ar: e.target.value })}
                          placeholder="باقة الثنائي"
                          dir="rtl"
                        />
                      </div>
                      <div className="col-span-4">
                        <Input
                          value={row.label_en}
                          onChange={(e) => updateRow(i, { label_en: e.target.value })}
                          placeholder="Duo bundle"
                        />
                      </div>
                      <div className="col-span-1">
                        <Input
                          type="number"
                          min={0}
                          max={80}
                          value={row.discount_percentage}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            updateRow(i, { discount_percentage: Number.isFinite(v) ? v : 0 });
                          }}
                        />
                      </div>
                      <div className="col-span-1 flex flex-col items-center gap-1">
                        <Switch
                          checked={row.is_active}
                          onCheckedChange={(c) => updateRow(i, { is_active: c })}
                          aria-label={isRTL ? "نشط" : "Active"}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => {
                            if (row.id) setDeleteId(row.id);
                            else removeRowAt(i);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button type="button" variant="outline" className="w-full gap-2" onClick={addRow}>
                <Plus className="h-4 w-4" />
                {isRTL ? "إضافة مستوى جديد" : "Add tier"}
              </Button>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSave} disabled={saving || isLoading}>
              {saving && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {isRTL ? "حفظ التغييرات" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent dir={isRTL ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? "حذف المستوى؟" : "Delete tier?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL ? "سيتم حذف هذا المستوى نهائياً عند الحفظ." : "This tier will be removed when you confirm."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRow} className="bg-destructive text-destructive-foreground">
              {isRTL ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BundleTiersDialog;
