import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Clock, GraduationCap, Loader2, Lock, Save, Wrench } from "lucide-react";
import { CountryCityPicker } from "@/components/ui/fields";
import { COUNTRIES } from "@/data/countryCityData";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TrainingCatalogRow = {
  id: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  type: string | null;
  level: string | null;
  default_sessions_count: number | null;
  default_session_duration_hours: number | null;
  sessions: unknown;
  trainer_supplies: unknown;
};

type SessionItem = {
  title_ar?: string;
  title_en?: string;
  name_ar?: string;
  name_en?: string;
  duration_hours?: number;
  description_ar?: string;
  description_en?: string;
};

type Props = {
  trainerId: string;
  existingTrainingIds: string[];
  onClose: () => void;
};

const levelClass: Record<string, string> = {
  beginner: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  intermediate: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  advanced: "bg-red-500/15 text-red-600 border-red-500/30",
};

export const TrainerAddTrainingPage: React.FC<Props> = ({ trainerId, existingTrainingIds, onClose }) => {
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [, setSearchParams] = useSearchParams();
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const [trainingId, setTrainingId] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [locationDetail, setLocationDetail] = useState<string>("");
  const [price, setPrice] = useState<number>(0);

  const { data: trainings, isLoading: loadingList } = useQuery({
    queryKey: ["all-trainings-catalog-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trainings")
        .select(
          "id, name_ar, name_en, description_ar, description_en, type, level, default_sessions_count, default_session_duration_hours, sessions, trainer_supplies",
        );
      if (error) throw error;
      return (data || []) as TrainingCatalogRow[];
    },
  });

  const availableTrainings = useMemo(
    () => (trainings || []).filter((tr) => !existingTrainingIds.includes(tr.id)),
    [trainings, existingTrainingIds],
  );

  const selected = useMemo(
    () => (trainings || []).find((tr) => tr.id === trainingId) ?? null,
    [trainings, trainingId],
  );

  const sessionItems: SessionItem[] = useMemo(() => {
    if (!selected || !Array.isArray(selected.sessions)) return [];
    return selected.sessions as SessionItem[];
  }, [selected]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!trainingId) throw new Error("missing-training");
      if (!country) throw new Error("missing-country");
      if (!city) throw new Error("missing-city");

      const countryEntry = COUNTRIES.find((c) => c.code === country);
      const countryEn = countryEntry?.en ?? country;
      const locationStr = `${countryEn} - ${city}`;

      const { error } = await supabase.from("trainer_courses").insert({
        trainer_id: trainerId,
        training_id: trainingId,
        price: price,
        sessions_count: Math.max(1, Number(selected?.default_sessions_count ?? 1)),
        duration_hours: Math.max(0.25, Number(selected?.default_session_duration_hours ?? 2)),
        location: locationStr,
        location_detail: locationDetail.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["trainer-profile-courses", trainerId] });
      void queryClient.invalidateQueries({ queryKey: ["trainer-profile-view", trainerId] });
      void queryClient.invalidateQueries({ queryKey: ["current-trainer"] });
      toast.success(isRTL ? "تم إضافة التدريب" : "Training added");
      // Clear form and go back
      setTrainingId("");
      setCountry("");
      setCity("");
      setLocationDetail("");
      setPrice(0);
      // Remove ?action from URL and navigate back to trainings list
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.delete("action");
        return p;
      }, { replace: true });
      onClose();
    },
    onError: (err: Error) => {
      const code = err?.message;
      if (code === "missing-training") toast.error(isRTL ? "اختر تدريباً أولاً" : "Select a training first");
      else if (code === "missing-country") toast.error(isRTL ? "اختر الدولة" : "Select a country");
      else if (code === "missing-city") toast.error(isRTL ? "اختر المدينة" : "Select a city");
      else toast.error(isRTL ? "فشل الحفظ" : "Save failed");
    },
  });

  const handleBack = () => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete("action");
      return p;
    }, { replace: true });
    onClose();
  };

  const canSubmit = !!trainingId && !!country && !!city && !saveMutation.isPending;

  // Localized text helper
  const tx = (ar: string, en: string) => (isRTL ? ar : en);

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header with Back button */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={handleBack}>
          <BackIcon className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-tight">{tx("إضافة تدريب جديد", "Add a new training")}</h2>
          <p className="text-xs text-muted-foreground">
            {tx("اختر التدريب من الكتالوج وعدّل الموقع والسعر فقط", "Pick a training and set only the location & price")}
          </p>
        </div>
      </div>

      {/* Step 1: Pick training */}
      <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3 sm:p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            1
          </span>
          <Label className="text-sm font-semibold">{tx("اختر التدريب", "Select training")}</Label>
        </div>
        {loadingList ? (
          <Skeleton className="h-10 w-full rounded-md" />
        ) : (
          <Select value={trainingId} onValueChange={setTrainingId} dir={isRTL ? "rtl" : "ltr"}>
            <SelectTrigger dir={isRTL ? "rtl" : "ltr"} className={isRTL ? "text-right" : "text-left"}>
              <SelectValue placeholder={tx("اختر تدريب من الكتالوج", "Select a training from the catalog")} />
            </SelectTrigger>
            <SelectContent dir={isRTL ? "rtl" : "ltr"} className={isRTL ? "text-right" : "text-left"}>
              {availableTrainings.length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  {tx("لا توجد تدريبات متاحة للإضافة", "No more trainings available")}
                </div>
              ) : (
                availableTrainings.map((tr) => (
                  <SelectItem key={tr.id} value={tr.id} className={isRTL ? "text-right" : "text-left"}>
                    {isRTL ? tr.name_ar : tr.name_en}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Step 2: Training details (read-only) */}
      {selected ? (
        <div className="rounded-2xl border border-border/60 bg-muted/15 p-4 space-y-4 sm:p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
              2
            </span>
            <Label className="text-sm font-semibold">{tx("تفاصيل التدريب", "Training details")}</Label>
            <span className="ms-auto inline-flex items-center gap-1 rounded-full border border-border/50 bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Lock className="h-3 w-3" />
              {tx("للقراءة فقط", "Read-only")}
            </span>
          </div>

          {/* Title + chips */}
          <div className="space-y-2">
            <h3 className="text-base font-bold leading-tight" lang={isRTL ? "ar" : "en"}>
              {isRTL ? selected.name_ar : selected.name_en}
            </h3>
            <div className="flex flex-wrap gap-2">
              {selected.type ? (
                <Badge variant="outline" className="gap-1.5 font-normal">
                  {selected.type === "theory" ? <GraduationCap className="h-3 w-3" /> : <Wrench className="h-3 w-3" />}
                  {selected.type === "theory" ? tx("نظري", "Theory") : tx("تطبيقي", "Practical")}
                </Badge>
              ) : null}
              {selected.level ? (
                <Badge variant="outline" className={cn("font-normal", levelClass[selected.level] ?? "")}>
                  {selected.level === "beginner"
                    ? tx("مبتدئ", "Beginner")
                    : selected.level === "intermediate"
                      ? tx("متوسط", "Intermediate")
                      : selected.level === "advanced"
                        ? tx("متقدم", "Advanced")
                        : selected.level}
                </Badge>
              ) : null}
              {typeof selected.default_sessions_count === "number" ? (
                <Badge variant="secondary" className="gap-1 font-normal">
                  <Clock className="h-3 w-3" />
                  {selected.default_sessions_count}{" "}
                  {tx(
                    selected.default_sessions_count === 1 ? "جلسة" : "جلسات",
                    selected.default_sessions_count === 1 ? "session" : "sessions",
                  )}
                </Badge>
              ) : null}
              {typeof selected.default_session_duration_hours === "number" ? (
                <Badge variant="secondary" className="gap-1 font-normal">
                  <Clock className="h-3 w-3" />
                  {selected.default_session_duration_hours}{" "}
                  {tx("ساعة/جلسة", "hr/session")}
                </Badge>
              ) : null}
            </div>
          </div>

          {/* Description */}
          {(isRTL ? selected.description_ar : selected.description_en) ? (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {tx("الوصف", "Description")}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {isRTL ? selected.description_ar : selected.description_en}
              </p>
            </div>
          ) : null}

          {/* Sessions breakdown */}
          {sessionItems.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {tx("الجلسات", "Sessions")}
              </p>
              <ol className="space-y-2">
                {sessionItems.map((s, i) => {
                  const sTitle = isRTL ? (s.title_ar || s.name_ar) : (s.title_en || s.name_en);
                  const sDesc = isRTL ? s.description_ar : s.description_en;
                  return (
                    <li key={i} className="flex gap-3 rounded-lg border border-border/40 bg-background/80 p-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{sTitle || tx(`الجلسة ${i + 1}`, `Session ${i + 1}`)}</p>
                        {typeof s.duration_hours === "number" ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            <Clock className="me-1 inline-block h-3 w-3" />
                            {s.duration_hours} {tx("ساعة", "hr")}
                          </p>
                        ) : null}
                        {sDesc ? (
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">{sDesc}</p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Step 3: Editable location + price */}
      {selected ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-4 sm:p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
              3
            </span>
            <Label className="text-sm font-semibold">{tx("الموقع والسعر", "Location & price")}</Label>
          </div>

          <div className="space-y-3">
            <CountryCityPicker
              country={country}
              city={city}
              onCountryChange={(code) => {
                setCountry(code);
                setCity("");
              }}
              onCityChange={setCity}
            />

            <div className="space-y-2">
              <Label className="text-xs font-semibold">{tx("العنوان التفصيلي", "Detailed address")}</Label>
              <Input
                value={locationDetail}
                onChange={(e) => setLocationDetail(e.target.value)}
                placeholder={tx("مثال: حي الياسمين، شارع الملك فهد، مبنى 12", "e.g. Al Yasmin district, King Fahd St, Bldg 12")}
                dir={isRTL ? "rtl" : "ltr"}
              />
              <p className="text-[10px] text-muted-foreground">
                {tx("يساعد الطلاب على الوصول بدقة", "Helps students find the exact spot")}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">{tx("السعر (ر.س)", "Price (SAR)")}</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={price}
                onChange={(e) => setPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                dir="ltr"
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground bg-muted/40 border border-border rounded-md p-2">
                {tx(
                  "ملاحظة: هذا هو السعر الذي ستحصل عليه. ستتم إضافة عمولات المنصة والضرائب تلقائيًا من قبل الإدارة في قسم التسعير، وسيظهر للطالب السعر النهائي شاملاً تلك العمولات.",
                  "Note: This is the price you receive. Platform commissions and taxes will be added automatically by admin in the pricing section, and students will see the final price including those fees."
                )}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <Button variant="outline" onClick={handleBack} disabled={saveMutation.isPending}>
          {tx("إلغاء", "Cancel")}
        </Button>
        <Button onClick={() => saveMutation.mutate()} disabled={!canSubmit} className="gap-2">
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {tx("حفظ التدريب", "Save training")}
        </Button>
      </div>
    </div>
  );
};

export default TrainerAddTrainingPage;
