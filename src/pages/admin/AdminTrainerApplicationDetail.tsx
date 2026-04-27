import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format, formatDistanceToNow } from "date-fns";
import { arSA, enUS } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AdminTrainerApplicationRow } from "@/hooks/useAdminTrainerApplications";
import {
  useAdminTrainerApplication,
  useTrainerApplicationReviewMutations,
} from "@/hooks/useAdminTrainerApplications";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn, formatDobLong } from "@/lib/utils";
import { COUNTRIES, getCityDisplayLabel } from "@/data/countryCityData";
import type { BikeEntry } from "@/hooks/useUserProfile";
import {
  LANGUAGE_LEVEL_OPTIONS,
  languageOptionLabel,
  parseLanguageLevels,
  type TrainerLanguageEntry,
} from "@/lib/trainer-form-constants";
import { BikeGarage } from "@/components/ui/profile/BikeGarage";
import { ArrowLeft, ArrowRight, Bike } from "lucide-react";

function displayName(row: AdminTrainerApplicationRow): string {
  const p = row.profile?.full_name?.trim();
  if (p) return p;
  const en = row.name_en?.trim();
  if (en) return en;
  const ar = row.name_ar?.trim();
  if (ar) return ar;
  return "—";
}

function uniqueOrderedNames(row: AdminTrainerApplicationRow): string[] {
  const parts = [row.name_ar?.trim(), row.name_en?.trim()].filter(Boolean) as string[];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (!seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}

function uniqueBioParagraphs(row: AdminTrainerApplicationRow): string[] {
  const parts = [row.bio?.trim(), row.bio_ar?.trim(), row.bio_en?.trim()].filter(Boolean) as string[];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (!seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}

function statusBadgeClass(status: string): string {
  if (status === "pending") return "bg-amber-500/15 text-amber-700 border-amber-500/40 dark:text-amber-400";
  if (status === "approved") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:text-emerald-400";
  if (status === "rejected") return "bg-destructive/10 text-destructive border-destructive/30";
  return "border-border";
}

function applicationExtras(row: AdminTrainerApplicationRow) {
  const r = row as AdminTrainerApplicationRow & {
    license_type?: string | null;
    specialties?: string[] | null;
    bike_entries?: unknown;
    languages?: unknown;
  };
  return {
    licenseType: typeof r.license_type === "string" ? r.license_type : null,
    specialties: Array.isArray(r.specialties) ? r.specialties : [],
    bikeEntries: r.bike_entries,
    languages: r.languages,
  };
}

function languageLevelLabel(value: string, isRTL: boolean): string {
  const o = LANGUAGE_LEVEL_OPTIONS.find((x) => x.value === value);
  if (!o) return value;
  return isRTL ? o.label_ar : o.label_en;
}

function parseLanguageFromSpecialtyString(s: string): TrainerLanguageEntry | null {
  const idx = s.indexOf(":");
  if (idx <= 0) return null;
  const language = s.slice(0, idx).trim().toLowerCase();
  const level = s.slice(idx + 1).trim().toLowerCase();
  if (!language || !level) return null;
  return { language, level };
}

function mergedApplicationLanguages(
  languagesJson: unknown,
  specialties: string[],
): { entries: TrainerLanguageEntry[]; otherSpecialties: string[] } {
  const fromJson = parseLanguageLevels(languagesJson);
  if (fromJson.length > 0) {
    const otherSpecialties = specialties.filter((s) => parseLanguageFromSpecialtyString(s) == null);
    return { entries: fromJson, otherSpecialties };
  }
  const entries: TrainerLanguageEntry[] = [];
  const otherSpecialties: string[] = [];
  for (const s of specialties) {
    const parsed = parseLanguageFromSpecialtyString(s);
    if (parsed) entries.push(parsed);
    else otherSpecialties.push(s);
  }
  return { entries, otherSpecialties };
}

function normalizeGarageBikeEntries(raw: unknown): BikeEntry[] {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return [];
  return (raw as unknown[])
    .map((x, index) => {
      if (x && typeof x === "object") {
        const o = x as Record<string, unknown>;
        if (typeof o.id === "string" && typeof o.type_name === "string") {
          return {
            id: o.id,
            type_id: typeof o.type_id === "string" ? o.type_id : null,
            type_name: String(o.type_name),
            subtype_id: typeof o.subtype_id === "string" ? o.subtype_id : null,
            subtype_name: String(o.subtype_name ?? ""),
            brand: String(o.brand ?? ""),
            model: String(o.model ?? ""),
            is_custom_type: Boolean(o.is_custom_type),
            is_custom_brand: Boolean(o.is_custom_brand),
            photos: Array.isArray(o.photos) ? (o.photos as unknown[]).map(String) : [],
          } satisfies BikeEntry;
        }
      }
      const o = (x || {}) as Record<string, unknown>;
      const typeName = String(o.type ?? o.type_name ?? "").trim();
      if (!typeName) return null;
      const brand = String(o.brand ?? "").trim();
      const photos = Array.isArray(o.photos) ? (o.photos as unknown[]).map(String) : [];
      return {
        id: `legacy-${index}-${typeName}`,
        type_id: null,
        type_name: typeName,
        subtype_id: null,
        subtype_name: "",
        brand,
        model: String(o.model ?? ""),
        is_custom_type: true,
        is_custom_brand: true,
        photos,
      } satisfies BikeEntry;
    })
    .filter((e): e is BikeEntry => e != null);
}

function ServiceChip({ id }: { id: string }) {
  const { t } = useTranslation();
  const label = t(`applyTrainer.services.${id}`, { defaultValue: id });
  return (
    <Badge variant="secondary" className="text-xs font-normal max-w-full whitespace-normal text-start">
      {label}
    </Badge>
  );
}

const AdminTrainerApplicationDetail: React.FC = () => {
  const { applicationId } = useParams<{ applicationId: string }>();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const dateLocale = isRTL ? arSA : enUS;
  const relLocale = isRTL ? arSA : enUS;

  const { data: row, isLoading, error } = useAdminTrainerApplication(applicationId);
  const { approveApplication, rejectApplication, isApproving, isRejecting } = useTrainerApplicationReviewMutations();

  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);

  // Single-language toasts — always render in the active site language only.
  const toastSuccess = (key: string) => toast.success(t(key));
  const toastError = (key: string) => toast.error(t(key));

  const onConfirmApprove = async () => {
    if (!row) return;
    try {
      await approveApplication(row.id);
      setConfirmApprove(false);
      toastSuccess("admin.trainerApplications.toast.approved");
      const { data: trainerRow } = await (supabase as any).from("trainers").select("id").eq("user_id", row.user_id).maybeSingle();
      if (trainerRow?.id) {
        toast.success(t("admin.trainerApplications.toast.profileCreated"), {
          action: {
            label: t("admin.trainerApplications.dialog.viewTrainer"),
            onClick: () => navigate(`/admin/trainers/${trainerRow.id}`),
          },
          duration: 10000,
        });
      }
      navigate("/admin/trainers?tab=applications");
    } catch {
      toastError("admin.trainerApplications.toast.error");
    }
  };

  const onConfirmReject = async () => {
    if (!row) return;
    try {
      await rejectApplication(row.id);
      setConfirmReject(false);
      toastSuccess("admin.trainerApplications.toast.rejected");
      navigate("/admin/trainers?tab=applications");
    } catch {
      toastError("admin.trainerApplications.toast.error");
    }
  };

  const backHref = "/admin/trainers?tab=applications";
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="max-w-4xl mx-auto space-y-4 p-4" dir={isRTL ? "rtl" : "ltr"}>
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !row) {
    return (
      <AdminLayout>
        <div className="max-w-4xl mx-auto p-6 space-y-4" dir={isRTL ? "rtl" : "ltr"}>
          <Button variant="ghost" size="sm" className="gap-2 -ms-2" asChild>
            <Link to={backHref}>
              <BackIcon className="h-4 w-4" />
              {t("admin.trainerApplications.detail.back")}
            </Link>
          </Button>
          <p className="text-sm text-muted-foreground">{t("admin.trainerApplications.detail.notFound")}</p>
        </div>
      </AdminLayout>
    );
  }

  const profileAv = row.profile?.avatar_url?.trim() || "";
  const appPhoto = row.photo_url?.trim() || "";
  const listAvatar = profileAv || appPhoto;
  const initial = displayName(row).charAt(0) || "?";
  const dobRaw = row.date_of_birth?.trim() || "";
  const dobStr = dobRaw ? formatDobLong(dobRaw, isRTL) || dobRaw : "—";
  const names = uniqueOrderedNames(row);
  const bios = uniqueBioParagraphs(row);
  const extras = applicationExtras(row);

  const countryRaw = row.country?.trim() ?? "";
  // `row.country` may be an ISO code, the English name, or the Arabic name —
  // resolve to the canonical entry so we can render in the active UI language.
  const countryEntry = countryRaw
    ? COUNTRIES.find(
        (c) => c.code === countryRaw || c.en === countryRaw || c.ar === countryRaw,
      )
    : undefined;
  const countryCode = countryEntry?.code ?? "";
  const countryDisplay = countryEntry ? countryEntry[isRTL ? "ar" : "en"] : countryRaw || "—";
  const cityRaw = row.city?.trim() || "";
  const cityDisplay =
    cityRaw && countryCode ? getCityDisplayLabel(countryCode, cityRaw, isRTL) || cityRaw : cityRaw || "—";

  const garageEntries = normalizeGarageBikeEntries(extras.bikeEntries);
  const { entries: languageEntries, otherSpecialties } = mergedApplicationLanguages(
    extras.languages,
    extras.specialties,
  );

  const DetailRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="grid gap-1 sm:grid-cols-[minmax(0,220px)_1fr] sm:gap-4 py-2.5 px-4 sm:px-5 border-b border-border/50 last:border-0">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground min-w-0 break-words">{children}</div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto w-full min-w-0 space-y-6 px-3 py-4 sm:px-6 sm:py-6" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-2 -ms-2 shrink-0" asChild>
            <Link to={backHref}>
              <BackIcon className="h-4 w-4" />
              {t("admin.trainerApplications.detail.back")}
            </Link>
          </Button>
        </div>

        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="space-y-4 bg-muted/20 border-b border-border/60 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <Avatar className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 border-2 border-background shadow-sm">
                <AvatarImage src={listAvatar} className="object-cover" />
                <AvatarFallback className="text-lg">{initial}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("text-xs font-medium", statusBadgeClass(row.status))}>
                    {t(`admin.trainerApplications.status.${row.status}`)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(row.created_at), { addSuffix: true, locale: relLocale })}
                  </span>
                </div>
                <CardTitle className="text-xl sm:text-2xl font-bold leading-tight break-words">
                  {displayName(row)}
                </CardTitle>
                {names.length > 1 || (names.length === 1 && names[0] !== displayName(row)) ? (
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {names.map((n, i) => (
                      <p key={i} className="break-words">
                        {n}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 space-y-8">
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-1">{t("admin.trainerApplications.detail.sectionContact")}</h3>
              <p className="text-xs text-muted-foreground mb-4">{t("admin.trainerApplications.detail.sectionContactHint")}</p>
              <div className="rounded-xl border border-border/60 bg-card">
                <DetailRow label={t("admin.trainerApplications.dialog.email")}>
                  <span className="break-all" dir="ltr">
                    {row.email || "—"}
                  </span>
                </DetailRow>
                <DetailRow label={t("admin.trainerApplications.dialog.phone")}>
                  <span dir="ltr">{row.phone || "—"}</span>
                </DetailRow>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-foreground mb-1">{t("admin.trainerApplications.detail.sectionApplicant")}</h3>
              <p className="text-xs text-muted-foreground mb-4">{t("admin.trainerApplications.detail.sectionApplicantHint")}</p>
              <div className="rounded-xl border border-border/60 bg-card">
                <DetailRow label={t("admin.trainerApplications.dialog.country")}>{countryDisplay}</DetailRow>
                <DetailRow label={t("admin.trainerApplications.dialog.city")}>{cityDisplay}</DetailRow>
                <DetailRow label={t("admin.trainerApplications.dialog.dob")}>{dobStr}</DetailRow>
                <DetailRow label={t("admin.trainerApplications.dialog.gender")}>
                  {row.gender
                    ? (() => {
                        const g = row.gender.trim();
                        const lower = g.toLowerCase();
                        if (isRTL) {
                          if (lower === "male" || g === "Male") return "ذكر";
                          if (lower === "female" || g === "Female") return "أنثى";
                          return g;
                        }
                        if (lower === "male" || g === "Male") return "Male";
                        if (lower === "female" || g === "Female") return "Female";
                        return g.charAt(0).toUpperCase() + g.slice(1);
                      })()
                    : "—"}
                </DetailRow>
                <DetailRow label={t("admin.trainerApplications.dialog.nationality")}>
                  {row.nationality
                    ? COUNTRIES.find((c) => c.code === row.nationality)?.[isRTL ? "ar" : "en"] || row.nationality
                    : "—"}
                </DetailRow>
                {extras.licenseType ? (
                  <DetailRow label={t("admin.trainerApplications.detail.license")}>{extras.licenseType}</DetailRow>
                ) : null}
                <DetailRow label={t("admin.trainerApplications.dialog.yearsExperience")}>
                  {row.years_of_experience ?? "—"}
                </DetailRow>
              </div>
            </section>

            {bios.length > 0 ? (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">{t("admin.trainerApplications.detail.sectionSummary")}</h3>
                <div className="space-y-3">
                  {bios.map((text, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border/60 bg-muted/15 px-4 py-4 sm:px-5 sm:py-5 text-sm leading-relaxed whitespace-pre-wrap break-words"
                    >
                      {text}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {(row.services || []).length > 0 ? (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">{t("admin.trainerApplications.detail.sectionServices")}</h3>
                <div className="flex flex-wrap gap-2">
                  {(row.services || []).map((id) => (
                    <ServiceChip key={id} id={id} />
                  ))}
                </div>
              </section>
            ) : null}

            {languageEntries.length > 0 || otherSpecialties.length > 0 ? (
              <section className="space-y-3" dir={isRTL ? "rtl" : "ltr"}>
                <h3 className="text-sm font-semibold text-foreground">{t("admin.trainerApplications.detail.sectionLanguages")}</h3>
                <div className="rounded-xl border border-border/60 bg-muted/10 p-4 space-y-2 text-sm">
                  {languageEntries.length > 0 ? (
                    <ul className="list-disc ps-5 space-y-1">
                      {languageEntries.map((r, i) => (
                        <li key={`${r.language}-${r.level}-${i}`} className="break-words">
                          {languageOptionLabel(r.language, isRTL)}
                          <span className="text-muted-foreground"> — </span>
                          {languageLevelLabel(r.level, isRTL)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {otherSpecialties.length > 0 ? (
                    <ul className="list-disc ps-5 space-y-1 text-muted-foreground">
                      {otherSpecialties.map((s, i) => (
                        <li key={`other-${i}`} className="break-words">
                          {s}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </section>
            ) : null}

            <section className="space-y-3" dir={isRTL ? "rtl" : "ltr"}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Bike className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{isRTL ? "الجراج" : "Garage"}</h3>
                  {garageEntries.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {garageEntries.length}{" "}
                      {isRTL
                        ? garageEntries.length === 1
                          ? "دراجة مسجلة"
                          : "دراجات مسجلة"
                        : garageEntries.length === 1
                          ? "bike registered"
                          : "bikes registered"}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-2 sm:p-4">
                <BikeGarage readOnly entries={garageEntries} onChange={() => {}} />
              </div>
            </section>

            {row.status !== "pending" && (row.reviewed_at || row.reviewed_by) ? (
              <>
                <Separator />
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">{t("admin.trainerApplications.dialog.reviewMeta")}</h3>
                  <div className="rounded-xl border border-border/60 bg-card">
                    {row.reviewed_at ? (
                      <DetailRow label={t("admin.trainerApplications.dialog.reviewedAt")}>
                        {format(new Date(row.reviewed_at), "PPp", { locale: dateLocale })}
                      </DetailRow>
                    ) : null}
                    {row.reviewed_by ? (
                      <DetailRow label={t("admin.trainerApplications.dialog.reviewedBy")}>
                        {row.reviewer_profile?.full_name?.trim() || row.reviewed_by}
                      </DetailRow>
                    ) : null}
                  </div>
                </section>
              </>
            ) : null}

            {row.status === "pending" ? (
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                <Button type="button" variant="destructive" onClick={() => setConfirmReject(true)} disabled={isRejecting || isApproving}>
                  {t("admin.trainerApplications.dialog.rejectButton")}
                </Button>
                <Button type="button" onClick={() => setConfirmApprove(true)} disabled={isApproving || isRejecting}>
                  {t("admin.trainerApplications.dialog.approveButton")}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmApprove} onOpenChange={setConfirmApprove}>
        <AlertDialogContent dir={isRTL ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.trainerApplications.dialog.approveConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="text-start">
              {t("admin.trainerApplications.dialog.approveConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.users.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onConfirmApprove()} disabled={isApproving}>
              {t("admin.trainerApplications.dialog.approveButton")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmReject} onOpenChange={setConfirmReject}>
        <AlertDialogContent dir={isRTL ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.trainerApplications.dialog.rejectConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="text-start">
              {t("admin.trainerApplications.dialog.rejectConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.users.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void onConfirmReject()}
              disabled={isRejecting}
            >
              {t("admin.trainerApplications.dialog.rejectButton")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminTrainerApplicationDetail;
