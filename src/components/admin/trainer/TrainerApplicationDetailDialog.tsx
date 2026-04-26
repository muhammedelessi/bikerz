import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format, formatDistanceToNow } from "date-fns";
import { arSA, enUS } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AdminTrainerApplicationRow } from "@/hooks/useAdminTrainerApplications";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { COUNTRIES } from "@/data/countryCityData";

function displayName(row: AdminTrainerApplicationRow): string {
  const p = row.profile?.full_name?.trim();
  if (p) return p;
  const en = row.name_en?.trim();
  if (en) return en;
  const ar = row.name_ar?.trim();
  if (ar) return ar;
  return "—";
}

function statusBadgeClass(status: string): string {
  if (status === "pending") return "bg-amber-500/15 text-amber-700 border-amber-500/40 dark:text-amber-400";
  if (status === "approved") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:text-emerald-400";
  if (status === "rejected") return "bg-destructive/10 text-destructive border-destructive/30";
  return "border-border";
}

function parseDob(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type TrainerApplicationDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: AdminTrainerApplicationRow | null;
  approveApplication: (id: string) => Promise<void>;
  rejectApplication: (id: string) => Promise<void>;
  isApproving: boolean;
  isRejecting: boolean;
};

export function TrainerApplicationDetailDialog({
  open,
  onOpenChange,
  row,
  approveApplication,
  rejectApplication,
  isApproving,
  isRejecting,
}: TrainerApplicationDetailDialogProps) {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const dateLocale = isRTL ? arSA : enUS;
  const relLocale = isRTL ? arSA : enUS;

  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmApprove(false);
      setConfirmReject(false);
    }
  }, [open]);

  const toastBilingual = (key: string) => {
    const en = i18n.getFixedT("en")(key);
    const ar = i18n.getFixedT("ar")(key);
    toast.success(`${en}\n${ar}`);
  };

  const toastBilingualError = (key: string) => {
    const en = i18n.getFixedT("en")(key);
    const ar = i18n.getFixedT("ar")(key);
    toast.error(`${en}\n${ar}`);
  };

  const onConfirmApprove = async () => {
    if (!row) return;
    try {
      await approveApplication(row.id);
      setConfirmApprove(false);
      onOpenChange(false);
      toastBilingual("admin.trainerApplications.toast.approved");
      const { data: trainerRow } = await supabase.from("trainers").select("id").eq("user_id", row.user_id).maybeSingle();
      if (trainerRow?.id) {
        toast.success(`${i18n.getFixedT("en")("admin.trainerApplications.toast.profileCreated")}\n${i18n.getFixedT("ar")("admin.trainerApplications.toast.profileCreated")}`, {
          action: {
            label: t("admin.trainerApplications.dialog.viewTrainer"),
            onClick: () => navigate(`/admin/trainers/${trainerRow.id}`),
          },
          duration: 10000,
        });
      }
    } catch {
      toastBilingualError("admin.trainerApplications.toast.error");
    }
  };

  const onConfirmReject = async () => {
    if (!row) return;
    try {
      await rejectApplication(row.id);
      setConfirmReject(false);
      onOpenChange(false);
      toastBilingual("admin.trainerApplications.toast.rejected");
    } catch {
      toastBilingualError("admin.trainerApplications.toast.error");
    }
  };

  if (!row) return null;

  const headerPhoto = row.photo_url || row.profile?.avatar_url || "";
  const listAvatar = row.profile?.avatar_url || row.photo_url || "";
  const initial = displayName(row).charAt(0) || "?";
  const dob = parseDob(row.date_of_birth ?? undefined);
  const dobStr = dob ? format(dob, "PP", { locale: dateLocale }) : row.date_of_birth || "—";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
          dir={isRTL ? "rtl" : "ltr"}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="space-y-3 text-start">
            <div className="flex items-start gap-3">
              <Avatar className="h-14 w-14 shrink-0 border border-border">
                <AvatarImage src={listAvatar} className="object-cover" />
                <AvatarFallback>{initial}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("admin.trainerApplications.dialog.title")}
                </p>
                <DialogTitle className="text-start text-lg leading-tight">{displayName(row)}</DialogTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("text-xs", statusBadgeClass(row.status))}>
                    {t(`admin.trainerApplications.status.${row.status}`)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(row.created_at), { addSuffix: true, locale: relLocale })}
                  </span>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {headerPhoto ? (
              <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
                <img src={headerPhoto} alt="" className="max-h-48 w-full object-contain object-center" />
              </div>
            ) : null}

            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("admin.trainerApplications.dialog.personalInfo")}
              </h4>
              <dl className="grid gap-2 text-sm">
                {row.name_ar?.trim() ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground shrink-0">{t("admin.trainerApplications.dialog.nameAr")}</dt>
                    <dd className="text-start font-medium min-w-0 break-words">{row.name_ar}</dd>
                  </div>
                ) : null}
                {row.name_en?.trim() ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground shrink-0">{t("admin.trainerApplications.dialog.nameEn")}</dt>
                    <dd className="text-start font-medium min-w-0 break-words" dir="ltr">
                      {row.name_en}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground shrink-0">{t("admin.trainerApplications.dialog.email")}</dt>
                  <dd className="text-start font-medium min-w-0 break-all" dir="ltr">
                    {row.email || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground shrink-0">{t("admin.trainerApplications.dialog.phone")}</dt>
                  <dd className="text-start font-medium tabular-nums" dir="ltr">
                    {row.phone || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground shrink-0">{t("admin.trainerApplications.dialog.gender")}</dt>
                  <dd className="text-start font-medium min-w-0">{genderLabelForDialog(row.gender, isRTL)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground shrink-0">{t("admin.trainerApplications.dialog.nationality")}</dt>
                  <dd className="text-start font-medium min-w-0">
                    {row.nationality
                      ? COUNTRIES.find((c) => c.code === row.nationality)?.[isRTL ? "ar" : "en"] || row.nationality
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground shrink-0">{t("admin.trainerApplications.dialog.country")}</dt>
                  <dd className="text-start font-medium min-w-0">{row.country || "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground shrink-0">{t("admin.trainerApplications.dialog.city")}</dt>
                  <dd className="text-start font-medium min-w-0">{row.city || "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground shrink-0">{t("admin.trainerApplications.dialog.dob")}</dt>
                  <dd className="text-start font-medium">{dobStr}</dd>
                </div>
              </dl>
            </section>

            <Separator />

            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("admin.trainerApplications.dialog.trainerProfile")}
              </h4>
              <p className="text-sm whitespace-pre-wrap rounded-md border border-border/60 bg-muted/20 p-3">{row.bio}</p>
              {row.bio_ar?.trim() ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t("admin.trainerApplications.dialog.bioAr")}</p>
                  <p className="text-sm whitespace-pre-wrap rounded-md border border-border/60 bg-muted/10 p-3">{row.bio_ar}</p>
                </div>
              ) : null}
              {row.bio_en?.trim() ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t("admin.trainerApplications.dialog.bioEn")}</p>
                  <p className="text-sm whitespace-pre-wrap rounded-md border border-border/60 bg-muted/10 p-3" dir="ltr">
                    {row.bio_en}
                  </p>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(row.services || []).map((id) => (
                  <Badge key={id} variant="secondary" className="text-xs font-normal">
                    {t(`applyTrainer.services.${id}`, { defaultValue: id })}
                  </Badge>
                ))}
              </div>
              <dl className="grid gap-2 text-sm pt-1">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{t("admin.trainerApplications.dialog.bikeType")}</dt>
                  <dd className="font-medium min-w-0 text-start">{row.bike_type || "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{t("admin.trainerApplications.dialog.yearsExperience")}</dt>
                  <dd className="font-medium tabular-nums">{row.years_of_experience ?? "—"}</dd>
                </div>
              </dl>
            </section>

            {row.status !== "pending" && (row.reviewed_at || row.reviewed_by) ? (
              <>
                <Separator />
                <section className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("admin.trainerApplications.dialog.reviewMeta")}
                  </h4>
                  <dl className="grid gap-2 text-sm">
                    {row.reviewed_at ? (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground shrink-0">{t("admin.trainerApplications.dialog.reviewedAt")}</dt>
                        <dd className="text-start font-medium">
                          {format(new Date(row.reviewed_at), "PPp", { locale: dateLocale })}
                        </dd>
                      </div>
                    ) : null}
                    {row.reviewed_by ? (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground shrink-0">{t("admin.trainerApplications.dialog.reviewedBy")}</dt>
                        <dd className="text-start font-medium min-w-0">
                          {row.reviewer_profile?.full_name?.trim() || row.reviewed_by}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </section>
              </>
            ) : null}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            {row.status === "pending" ? (
              <>
                <Button type="button" variant="destructive" onClick={() => setConfirmReject(true)} disabled={isRejecting || isApproving}>
                  {t("admin.trainerApplications.dialog.rejectButton")}
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    {t("admin.trainerApplications.dialog.close")}
                  </Button>
                  <Button type="button" onClick={() => setConfirmApprove(true)} disabled={isApproving || isRejecting}>
                    {t("admin.trainerApplications.dialog.approveButton")}
                  </Button>
                </div>
              </>
            ) : (
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
                {t("admin.trainerApplications.dialog.close")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </>
  );
}
