import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Json } from "@/integrations/supabase/types";
import TrainerForm from "@/components/trainer/TrainerForm";
import type { TrainerFormSubmission, TrainerFormValues } from "@/types/trainerForm";
import { joinFullName, splitFullName } from "@/lib/trainer-name-utils";
import { parseTrainerPhone } from "@/lib/trainer-phone-utils";
import { formLanguagesToDb, languageEntriesToForm, parseLanguageLevels } from "@/lib/trainer-form-constants";
import type { BikeEntry as GarageBikeEntry } from "@/hooks/useUserProfile";
import { uploadTrainerProfilePhoto, uploadTrainerAlbumFile } from "@/lib/trainer-uploads";
import { Star, Users, MapPin, Bike, Clock, BookOpen, Briefcase, User, ChevronDown, Plus } from "lucide-react";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { AddTrainingForTrainerDialog } from "@/components/admin/trainer/AddTrainingForTrainerDialog";

export { AddTrainingForTrainerDialog };

export type TrainerProfileMode = "admin" | "self";
export type TrainerProfileVariant = "dialog" | "inline";

export interface Trainer {
  id: string;
  name_ar: string;
  name_en: string;
  photo_url: string | null;
  bio_ar: string;
  bio_en: string;
  country: string;
  city: string;
  bike_type: string;
  years_of_experience: number;
  services: string[];
  status: string;
  created_at: string;
  profit_ratio: number;
}

type LegacyBikeRow = { type: string; brand: string; photos: string[] };

function parseBikeEntriesLegacy(raw: unknown): LegacyBikeRow[] {
  if (!raw || !Array.isArray(raw)) return [];
  return (raw as unknown[])
    .map((x) => {
      const o = x as Record<string, unknown>;
      const type = String(o.type ?? o.type_name ?? "").trim();
      return {
        type,
        brand: String(o.brand ?? "").trim(),
        photos: Array.isArray(o.photos) ? (o.photos as unknown[]).map(String) : [],
      };
    })
    .filter((e) => e.type);
}

function summarizeMotorbikeBrandFromEntries(
  entries: { type: string; brand: string }[],
): string {
  return entries
    .map((e) => (e.brand ? `${e.type}: ${e.brand}` : e.type))
    .filter(Boolean)
    .join(" · ");
}

function flattenBikePhotoUrls(entries: { photos: string[] }[]): string[] {
  return entries.flatMap((e) => e.photos);
}

function mapTrainerRowToFormValues(t: Record<string, unknown>): Partial<TrainerFormValues> {
  const ar = splitFullName(String(t.name_ar ?? ""));
  const en = splitFullName(String(t.name_en ?? ""));
  const ph = parseTrainerPhone(String(t.phone ?? "").trim());
  const rawV2 = parseBikeEntriesLegacy(t.bike_entries);
  const first = rawV2[0];
  const bike_entries: GarageBikeEntry[] =
    rawV2.length > 0 && first && typeof first === "object" && "id" in first
      ? (rawV2 as unknown as GarageBikeEntry[])
      : rawV2.map((e) => ({
          id: crypto.randomUUID(),
          type_id: null,
          type_name: e.type,
          subtype_id: null,
          subtype_name: "",
          brand: e.brand || "",
          model: "",
          is_custom_type: true,
          is_custom_brand: true,
          photos: e.photos,
        }));
  return {
    photo_url: (t.photo_url as string | null) ?? null,
    photo_album: Array.isArray(t.album_photos) ? [...(t.album_photos as string[])] : [],
    first_name_ar: ar.first,
    last_name_ar: ar.last,
    first_name_en: en.first,
    last_name_en: en.last,
    phone: String(t.phone ?? "").trim(),
    phone_country_code: ph.prefixKey,
    email: String(t.email ?? "").trim(),
    date_of_birth: (t.date_of_birth as string | null) ?? null,
    bio_ar: String(t.bio_ar ?? ""),
    bio_en: String(t.bio_en ?? ""),
    country: String(t.country ?? ""),
    city: String(t.city ?? ""),
    gender: String((t as { gender?: string }).gender ?? ""),
    nationality: String((t as { nationality?: string }).nationality ?? ""),
    bike_entries,
    years_of_experience: Number(t.years_of_experience) || 0,
    languages: languageEntriesToForm(parseLanguageLevels(t.language_levels)),
    services: Array.isArray(t.services) ? [...(t.services as string[])] : [],
    license_type: String(t.license_type ?? ""),
    profit_ratio: Number(t.profit_ratio) || 0,
  };
}

interface TrainerProfileDialogProps {
  trainer: Trainer | null;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  mode?: TrainerProfileMode;
  variant?: TrainerProfileVariant;
  onTrainerUpdated?: () => void;
}

// ─── Training Section (students & reviews per training) ──────────────
export const TrainingSection: React.FC<{
  tc: Record<string, unknown> & { trainings?: { name_ar?: string; name_en?: string }; training_id: string };
  trainerId: string;
  students: Record<string, unknown>[];
  reviews: Record<string, unknown>[];
  isRTL: boolean;
}> = ({ tc, trainerId: _trainerId, students, reviews, isRTL }) => {
  const [open, setOpen] = useState(false);
  const trainingStudents = students.filter((s) => (s as { training_id: string }).training_id === tc.training_id);
  const trainingReviews = reviews.filter((r) => (r as { training_id?: string | null }).training_id === tc.training_id);
  const avgRating = trainingReviews.length
    ? (trainingReviews.reduce((a: number, r: Record<string, unknown>) => a + Number((r as { rating: number }).rating), 0) / trainingReviews.length).toFixed(1)
    : null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardContent className="p-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                <span className="font-medium text-sm">{isRTL ? tc.trainings?.name_ar : tc.trainings?.name_en}</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {tc.price as number} {isRTL ? "ر.س" : "SAR"}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground ms-6">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {tc.duration_hours as number} {isRTL ? "ساعات" : "hrs"}
              </span>
              {!!tc.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {String(tc.location)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {trainingStudents.length} {isRTL ? "طالب" : "students"}
              </span>
              {avgRating && (
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  {avgRating}
                </span>
              )}
            </div>
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border px-3 pb-3 space-y-3">
            <div className="pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {isRTL ? "الطلاب" : "Students"} ({trainingStudents.length})
              </p>
              {trainingStudents.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">{isRTL ? "لا يوجد طلاب" : "No students"}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="h-7">{isRTL ? "الاسم" : "Name"}</TableHead>
                      <TableHead className="h-7">{isRTL ? "الهاتف" : "Phone"}</TableHead>
                      <TableHead className="h-7">{isRTL ? "الإيميل" : "Email"}</TableHead>
                      <TableHead className="h-7">{isRTL ? "التاريخ" : "Date"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trainingStudents.map((s: Record<string, unknown>) => (
                      <TableRow key={String((s as { id: string }).id)} className="text-xs">
                        <TableCell className="py-1.5">{(s as { full_name: string }).full_name}</TableCell>
                        <TableCell className="py-1.5" dir="ltr">
                          {(s as { phone: string }).phone}
                        </TableCell>
                        <TableCell className="py-1.5">{(s as { email: string }).email}</TableCell>
                        <TableCell className="py-1.5">{format(new Date((s as { enrolled_at: string }).enrolled_at), "yyyy-MM-dd")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {isRTL ? "التقييمات" : "Reviews"} ({trainingReviews.length})
              </p>
              {trainingReviews.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">{isRTL ? "لا توجد تقييمات" : "No reviews"}</p>
              ) : (
                <div className="space-y-2">
                  {trainingReviews.map((r: Record<string, unknown>) => (
                    <div key={String((r as { id: string }).id)} className="rounded-lg border border-border p-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{(r as { student_name: string }).student_name}</span>
                        <span className="text-[10px] text-muted-foreground">{format(new Date((r as { created_at: string }).created_at), "yyyy-MM-dd")}</span>
                      </div>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${i < (r as { rating: number }).rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                          />
                        ))}
                      </div>
                      {(r as { comment?: string }).comment ? (
                        <p className="text-[11px] text-muted-foreground">{(r as { comment: string }).comment}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

// ─── Unlinked reviews (no training_id) ───────────────────────────────
export const UnlinkedReviews: React.FC<{ reviews: Record<string, unknown>[]; isRTL: boolean }> = ({ reviews, isRTL }) => {
  const unlinked = reviews.filter((r) => !(r as { training_id?: string | null }).training_id);
  if (unlinked.length === 0) return null;
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          {isRTL ? "تقييمات عامة" : "General Reviews"} ({unlinked.length})
        </p>
        <div className="space-y-2">
          {unlinked.map((r: Record<string, unknown>) => (
            <div key={String((r as { id: string }).id)} className="rounded-lg border border-border p-2.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{(r as { student_name: string }).student_name}</span>
                <span className="text-[10px] text-muted-foreground">{format(new Date((r as { created_at: string }).created_at), "yyyy-MM-dd")}</span>
              </div>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3 h-3 ${i < (r as { rating: number }).rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                  />
                ))}
              </div>
              {(r as { comment?: string }).comment ? <p className="text-[11px] text-muted-foreground">{(r as { comment: string }).comment}</p> : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

function TrainerSelfEditForm({
  trainer,
  isRTL,
  onSaved,
}: {
  trainer: Trainer;
  isRTL: boolean;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [formNonce, setFormNonce] = useState(0);
  const [initial, setInitial] = useState<Partial<TrainerFormValues>>(() =>
    mapTrainerRowToFormValues(trainer as unknown as Record<string, unknown>),
  );

  useEffect(() => {
    setInitial(mapTrainerRowToFormValues(trainer as unknown as Record<string, unknown>));
    setFormNonce((n) => n + 1);
  }, [trainer]);

  const saveMutation = useMutation({
    mutationFn: async (submission: TrainerFormSubmission) => {
      const form = submission.values;
      let photoUrl = form.photo_url;
      if (submission.profilePhotoFile) {
        photoUrl = await uploadTrainerProfilePhoto(submission.profilePhotoFile);
      }
      const name_en = joinFullName(form.first_name_en, form.last_name_en);
      const name_ar = joinFullName(form.first_name_ar, form.last_name_ar);
      let albumPhotos = [...(form.photo_album || [])];
      for (const { file } of submission.pendingAlbumFiles) {
        albumPhotos.push(await uploadTrainerAlbumFile(trainer.id, file));
      }
      const garageEntries = form.bike_entries as GarageBikeEntry[];
      const bike_type = garageEntries.map((e) => e.type_name).filter(Boolean).join(", ");
      const bikeEntriesSlim = garageEntries.map((e) => ({
        type: e.type_name,
        brand: [e.brand, e.model].filter(Boolean).join(" "),
        photos: [...e.photos],
      }));
      const row = {
        name_en,
        name_ar,
        phone: form.phone.trim(),
        email: form.email.trim(),
        bio_ar: form.bio_ar,
        bio_en: form.bio_en,
        country: form.country,
        city: form.city,
        bike_type,
        bike_entries: garageEntries as unknown as Json,
        bike_photos: flattenBikePhotoUrls(bikeEntriesSlim),
        album_photos: albumPhotos,
        motorbike_brand: summarizeMotorbikeBrandFromEntries(bikeEntriesSlim),
        license_type: form.license_type ?? "",
        years_of_experience: form.years_of_experience,
        profit_ratio: form.profit_ratio ?? 0,
        services: form.services,
        photo_url: photoUrl,
        language_levels: formLanguagesToDb(form.languages) as unknown as Json,
        date_of_birth: form.date_of_birth,
      };
      const { error } = await supabase.from("trainers").update(row).eq("id", trainer.id);
      if (error) throw error;
    },
    onSuccess: (_data, submission: TrainerFormSubmission) => {
      submission.pendingAlbumFiles.forEach((p) => URL.revokeObjectURL(p.preview));
      queryClient.invalidateQueries({ queryKey: ["trainer-profile-students", trainer.id] });
      queryClient.invalidateQueries({ queryKey: ["trainer-profile-reviews", trainer.id] });
      queryClient.invalidateQueries({ queryKey: ["trainer-profile-courses", trainer.id] });
      queryClient.invalidateQueries({ queryKey: ["trainer-profile-view", trainer.id] });
      queryClient.invalidateQueries({ queryKey: ["current-trainer"] });
      toast.success(isRTL ? "تم حفظ الملف" : "Profile saved");
      onSaved();
    },
    onError: () => toast.error(isRTL ? "تعذّر الحفظ" : "Save failed"),
  });

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-4">
        <h3 className="text-sm font-bold text-foreground">{t("trainerDashboard.profile.editSectionTitle")}</h3>
        <TrainerForm
          mode="self-edit"
          formResetKey={formNonce}
          initialValues={initial}
          garageStorageUserId={trainer.id}
          onSubmit={(s) => saveMutation.mutateAsync(s)}
          isSubmitting={saveMutation.isPending}
          submitLabel={t("trainerDashboard.profile.editButton")}
        />
      </CardContent>
    </Card>
  );
}

// ─── Main Dialog / inline panel ───────────────────────────────────────
const TrainerProfileDialog: React.FC<TrainerProfileDialogProps> = ({
  trainer,
  open = false,
  onOpenChange = () => {},
  mode = "admin",
  variant = "dialog",
  onTrainerUpdated,
}) => {
  const { isRTL } = useLanguage();
  const { t } = useTranslation();
  const [addTrainingOpen, setAddTrainingOpen] = useState(false);

  const { data: students, isLoading: loadingStudents } = useQuery({
    queryKey: ["trainer-profile-students", trainer?.id],
    queryFn: async () => {
      const { data } = await supabase.from("training_students").select("*").eq("trainer_id", trainer!.id).order("enrolled_at", { ascending: false });
      return data || [];
    },
    enabled: !!trainer,
  });

  const { data: reviews, isLoading: loadingReviews } = useQuery({
    queryKey: ["trainer-profile-reviews", trainer?.id],
    queryFn: async () => {
      const { data } = await supabase.from("trainer_reviews").select("*").eq("trainer_id", trainer!.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!trainer,
  });

  const { data: trainerCourses, isLoading: loadingCourses } = useQuery({
    queryKey: ["trainer-profile-courses", trainer?.id],
    queryFn: async () => {
      const { data } = await supabase.from("trainer_courses").select("*, trainings(name_ar, name_en)").eq("trainer_id", trainer!.id);
      return data || [];
    },
    enabled: !!trainer,
  });

  if (!trainer) return null;

  const avgRating = reviews?.length ? (reviews.reduce((a: number, r: Record<string, unknown>) => a + Number((r as { rating: number }).rating), 0) / reviews.length).toFixed(1) : "0.0";
  const isLoading = loadingStudents || loadingReviews || loadingCourses;
  const showTrainings = variant === "dialog";
  const initial = (trainer.name_en || trainer.name_ar || "?").trim().charAt(0) || "?";

  const innerBody = (
    <div className="p-6 pt-2 space-y-6">
      {mode === "self" && variant === "inline" ? (
        <TrainerSelfEditForm trainer={trainer} isRTL={isRTL} onSaved={() => onTrainerUpdated?.()} />
      ) : null}

      <div className="flex items-start gap-4">
        <Avatar className="h-16 w-16 border-2 border-border">
          <AvatarImage src={trainer.photo_url || ""} />
          <AvatarFallback className="text-lg bg-primary/10 text-primary">{initial}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold">{isRTL ? trainer.name_ar : trainer.name_en}</h2>
          <p className="text-sm text-muted-foreground">{isRTL ? trainer.name_en : trainer.name_ar}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {mode === "admin" ? (
              <Badge
                className={trainer.status === "active" ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" : ""}
                variant={trainer.status === "active" ? "default" : "outline"}
              >
                {trainer.status === "active" ? (isRTL ? "نشط" : "Active") : isRTL ? "غير نشط" : "Inactive"}
              </Badge>
            ) : null}
            <Badge variant="secondary" className="gap-1">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              {avgRating} ({reviews?.length || 0})
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Users className="w-3 h-3" />
              {students?.length || 0} {isRTL ? "طالب" : "students"}
            </Badge>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {t("trainerDashboard.profile.title")}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? "الموقع" : "Location"}</p>
                <p className="font-medium">
                  {trainer.city}, {trainer.country}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Bike className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? "نوع الدراجة" : "Bike Type"}</p>
                <p className="font-medium">{trainer.bike_type}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? "الخبرة" : "Experience"}</p>
                <p className="font-medium">
                  {trainer.years_of_experience} {isRTL ? "سنة" : "years"}
                </p>
              </div>
            </div>
            {mode === "admin" ? (
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{isRTL ? "نسبة الربح" : "Profit Ratio"}</p>
                  <p className="font-medium">{trainer.profit_ratio}%</p>
                </div>
              </div>
            ) : null}
            <div className="flex items-center gap-2 col-span-2">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? "تاريخ الانضمام" : "Joined"}</p>
                <p className="font-medium">{format(new Date(trainer.created_at), "yyyy-MM-dd")}</p>
              </div>
            </div>
          </div>
          {(trainer.bio_ar || trainer.bio_en) && mode === "admin" ? (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">{isRTL ? "نبذة" : "Bio"}</p>
              <p className="text-sm leading-relaxed">{isRTL ? trainer.bio_ar : trainer.bio_en}</p>
            </div>
          ) : null}
          {trainer.services?.length > 0 ? (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">{isRTL ? "الخدمات" : "Services"}</p>
              <div className="flex flex-wrap gap-1.5">
                {trainer.services.map((s, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {showTrainings ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              {isRTL ? "التدريبات" : "Trainings"} ({trainerCourses?.length || 0})
            </h3>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setAddTrainingOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              {isRTL ? "إضافة تدريب" : "Add Training"}
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : !trainerCourses?.length ? (
            <p className="text-center py-8 text-sm text-muted-foreground">{isRTL ? "لا توجد تدريبات معينة" : "No trainings assigned"}</p>
          ) : (
            <div className="space-y-2">
              {trainerCourses.map((tc: Record<string, unknown> & { training_id: string; trainings?: { name_ar?: string; name_en?: string } }) => (
                <TrainingSection
                  key={String(tc.id ?? tc.training_id)}
                  tc={tc}
                  trainerId={trainer.id}
                  students={(students || []) as Record<string, unknown>[]}
                  reviews={(reviews || []) as Record<string, unknown>[]}
                  isRTL={isRTL}
                />
              ))}
            </div>
          )}

          {reviews && <UnlinkedReviews reviews={reviews as Record<string, unknown>[]} isRTL={isRTL} />}
        </div>
      ) : null}
    </div>
  );

  if (variant === "inline") {
    return (
      <div className="space-y-4">
        <ScrollArea className="max-h-[min(70vh,640px)]">
          <div className="pe-2">{innerBody}</div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="sr-only">{isRTL ? "ملف المدرب" : "Trainer Profile"}</DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[80vh]">
            <div className="p-6 pt-2 space-y-6">{innerBody}</div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AddTrainingForTrainerDialog
        open={addTrainingOpen}
        onOpenChange={setAddTrainingOpen}
        trainerId={trainer.id}
        existingTrainingIds={trainerCourses?.map((tc: { training_id: string }) => tc.training_id) || []}
        isRTL={isRTL}
        mode={mode}
      />
    </>
  );
};

export default TrainerProfileDialog;
