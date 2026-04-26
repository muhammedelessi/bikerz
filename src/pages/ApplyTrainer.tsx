import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import SEOHead from "@/components/common/SEOHead";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserProfile, type ExtendedProfile, type BikeEntry } from "@/hooks/useUserProfile";
import { useTrainerApplication } from "@/hooks/useTrainerApplication";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import TrainerForm from "@/components/trainer/TrainerForm";
import type { TrainerFormSubmission, TrainerFormValues } from "@/types/trainerForm";
import { joinFullName } from "@/lib/trainer-name-utils";
import { parseTrainerPhone } from "@/lib/trainer-phone-utils";
import { uploadTrainerApplicationPhoto } from "@/lib/trainer-uploads";
import { trainerApplicationQueryKey } from "@/types/trainerApplication";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Avatar in DB may be a full URL or a storage path under the `avatars` bucket */
function resolveProfilePhotoUrlForForm(avatarUrl: string | null | undefined): string | null {
  const trimmed = (avatarUrl ?? "").trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const path = trimmed.replace(/^\/+/, "");
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

function splitNameFromFull(full: string | null | undefined): { first: string; last: string } {
  const t = (full ?? "").trim();
  if (!t) return { first: "", last: "" };
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0]!, last: "" };
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

function buildInitialFormValues(profile: ExtendedProfile, email: string): Partial<TrainerFormValues> {
  const { first, last } = splitNameFromFull(profile.full_name);
  const ph = parseTrainerPhone((profile.phone ?? "").trim());
  const bikes = profile.bike_entries;
  const bike_entries: BikeEntry[] =
    Array.isArray(bikes) && bikes.length > 0 ? bikes.map((e) => ({ ...e })) : [];
  return {
    photo_url: resolveProfilePhotoUrlForForm(profile.avatar_url),
    photo_album: [],
    first_name_ar: first,
    last_name_ar: last,
    first_name_en: first,
    last_name_en: last,
    phone: (profile.phone ?? "").trim(),
    phone_country_code: ph.prefixKey,
    email: (email ?? "").trim(),
    date_of_birth: profile.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : null,
    bio_ar: "",
    bio_en: "",
    country: (profile.country ?? "").trim(),
    city: (profile.city ?? "").trim(),
    gender: (profile.gender ?? "").trim(),
    nationality: (profile.nationality ?? "").trim(),
    bike_entries,
    years_of_experience: profile.riding_experience_years ?? 0,
    services: [],
    license_type: "",
    profit_ratio: 0,
  };
}

function buildReadonlyFields(
  profile: ExtendedProfile,
  userEmail: string | null | undefined,
): (keyof TrainerFormValues)[] {
  const ro: (keyof TrainerFormValues)[] = [];
  if ((userEmail ?? "").trim()) ro.push("email");
  if ((profile.full_name ?? "").trim()) {
    ro.push("first_name_ar", "last_name_ar", "first_name_en", "last_name_en");
  }
  if ((profile.phone ?? "").trim()) ro.push("phone");
  if ((profile.country ?? "").trim()) ro.push("country");
  if ((profile.city ?? "").trim()) ro.push("city");
  if (profile.date_of_birth) ro.push("date_of_birth");
  // Do not lock years on apply: DB default is 0 so `!= null` hid the field for almost everyone.
  if ((profile.gender ?? "").trim()) ro.push("gender");
  if ((profile.nationality ?? "").trim()) ro.push("nationality");
  return ro;
}

function bikeEntriesSnapshot(entries: BikeEntry[] | null | undefined): string {
  if (!entries?.length) return "[]";
  return JSON.stringify(
    entries.map((e) => ({
      id: e.id,
      type_id: e.type_id,
      type_name: e.type_name,
      subtype_id: e.subtype_id,
      subtype_name: e.subtype_name,
      brand: e.brand,
      model: e.model,
      photos: e.photos,
    })),
  );
}

function computeProfileUpdates(
  initial: ExtendedProfile,
  submission: TrainerFormSubmission,
  finalAvatarUrl: string | null,
): Partial<ExtendedProfile> {
  const v = submission.values;
  const updates: Partial<ExtendedProfile> = {};

  if (!(initial.phone ?? "").trim() && v.phone.trim()) {
    updates.phone = v.phone.trim();
  }
  if (!(initial.country ?? "").trim() && v.country.trim()) {
    updates.country = v.country.trim();
  }
  if (!(initial.city ?? "").trim() && v.city.trim()) {
    updates.city = v.city.trim();
  }
  if (!initial.date_of_birth && v.date_of_birth) {
    updates.date_of_birth = v.date_of_birth;
  }
  const submittedYears = Number(v.years_of_experience);
  if (Number.isFinite(submittedYears) && submittedYears !== (initial.riding_experience_years ?? null)) {
    updates.riding_experience_years = submittedYears;
  }

  if (!(initial.gender ?? "").trim() && (v.gender ?? "").trim()) {
    updates.gender = v.gender.trim();
  }
  if (!(initial.nationality ?? "").trim() && (v.nationality ?? "").trim()) {
    updates.nationality = v.nationality.trim();
  }

  if (bikeEntriesSnapshot(initial.bike_entries) !== bikeEntriesSnapshot(v.bike_entries as BikeEntry[])) {
    updates.bike_entries = v.bike_entries as BikeEntry[];
  }

  if (!(initial.avatar_url ?? "").trim() && (finalAvatarUrl ?? "").trim()) {
    updates.avatar_url = finalAvatarUrl!.trim();
  }

  return updates;
}

const ApplyTrainer: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isInstructor } = useAuth();
  const { profile, isLoading: profileLoading } = useUserProfile();
  const { latestApplication, canApply, retryAvailableAt, isLoading: appLoading } = useTrainerApplication();
  const [submitting, setSubmitting] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const initialProfileRef = useRef<ExtendedProfile | null>(null);

  useEffect(() => {
    if (profile) {
      initialProfileRef.current = { ...profile };
      setFormKey((k) => k + 1);
    }
  }, [profile?.user_id, profile?.updated_at]);

  const loading = profileLoading || appLoading;

  const initialValues = useMemo(() => {
    if (!profile || !user) return undefined;
    return buildInitialFormValues(profile, user.email ?? "");
  }, [profile, user]);

  const readonlyFields = useMemo(() => {
    if (!profile) return [] as (keyof TrainerFormValues)[];
    return buildReadonlyFields(profile, user?.email);
  }, [profile, user?.email]);

  const hiddenFields = useMemo(
    (): (keyof TrainerFormValues)[] => ["photo_album", "status", "assigned_training_ids"],
    [],
  );

  const handleSubmit = async (submission: TrainerFormSubmission) => {
    if (!user || !profile) return;
    const initial = initialProfileRef.current;
    if (!initial) return;

    setSubmitting(true);
    try {
      let finalPhotoUrl = submission.values.photo_url?.trim() || null;
      if (submission.profilePhotoFile) {
        finalPhotoUrl = await uploadTrainerApplicationPhoto(user.id, submission.profilePhotoFile);
      }

      const profileUpdates = computeProfileUpdates(initial, submission, finalPhotoUrl);
      if (Object.keys(profileUpdates).length > 0) {
        const { error: upErr } = await supabase.from("profiles").update(profileUpdates).eq("user_id", user.id);
        if (upErr) throw upErr;
      }

      const v = submission.values;
      const name_ar = joinFullName(v.first_name_ar, v.last_name_ar).trim() || null;
      const name_en = joinFullName(v.first_name_en, v.last_name_en).trim() || null;
      const primaryBio = v.bio_ar.trim() || v.bio_en.trim();
      const firstBike = (v.bike_entries as BikeEntry[])[0];
      const bike_type = firstBike?.type_name?.trim() || null;

      // Omit gender/nationality here: older DBs without 20260429100000 columns get PostgREST 400.
      // Those values are saved on profiles (see computeProfileUpdates) before this insert.
      const insertRow = {
        user_id: user.id,
        bio: primaryBio,
        bio_ar: v.bio_ar.trim() || null,
        bio_en: v.bio_en.trim() || null,
        name_ar,
        name_en,
        services: Array.isArray(v.services) ? v.services : [],
        photo_url: finalPhotoUrl,
        bike_type,
        years_of_experience: v.years_of_experience,
        country: v.country.trim() || null,
        city: v.city.trim() || null,
        date_of_birth: v.date_of_birth || null,
        phone: v.phone.trim() || null,
      };

      const { error: insErr } = await supabase.from("trainer_applications").insert(insertRow);
      if (insErr) throw insErr;

      toast.success(t("applyTrainer.successToast"));
      await queryClient.invalidateQueries({ queryKey: trainerApplicationQueryKey(user.id) });
      navigate("/profile");
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      const code = err?.code;
      const msg = (err?.message || "").toLowerCase();
      if (code === "42501" || msg.includes("row-level security") || code === "23505") {
        toast.error(t("applyTrainer.errorToast"));
      } else {
        toast.error(err?.message || t("common.error"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  const outletBody = (children: React.ReactNode) => (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full space-y-6 safe-area-bottom" dir={isRTL ? "rtl" : "ltr"}>
      {children}
    </div>
  );

  if (isInstructor) {
    return (
      <>
        <SEOHead title={t("applyTrainer.title")} description={t("applyTrainer.subtitle")} noindex />
        {outletBody(
          <Card>
            <CardHeader>
              <CardTitle>{t("applyTrainer.statusInstructor")}</CardTitle>
              <CardDescription>{t("applyTrainer.statusInstructorDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/trainer/dashboard">{t("applyTrainer.trainerDashboardCta")}</Link>
              </Button>
            </CardContent>
          </Card>,
        )}
      </>
    );
  }

  if (latestApplication?.status === "pending") {
    return (
      <>
        <SEOHead title={t("applyTrainer.title")} description={t("applyTrainer.subtitle")} noindex />
        {outletBody(
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader>
              <CardTitle>{t("applyTrainer.statusPending")}</CardTitle>
              <CardDescription>{t("applyTrainer.statusPendingDescription")}</CardDescription>
              <p className="text-sm text-muted-foreground pt-2">
                {t("applyTrainer.submittedAt", { date: new Date(latestApplication.created_at).toLocaleString() })}
              </p>
            </CardHeader>
          </Card>,
        )}
      </>
    );
  }

  if (latestApplication?.status === "rejected" && retryAvailableAt && retryAvailableAt.getTime() > Date.now()) {
    const days = Math.max(1, Math.ceil((retryAvailableAt.getTime() - Date.now()) / MS_PER_DAY));
    return (
      <>
        <SEOHead title={t("applyTrainer.title")} description={t("applyTrainer.subtitle")} noindex />
        {outletBody(
          <Card>
            <CardHeader>
              <CardTitle>{t("applyTrainer.statusRejected")}</CardTitle>
              <CardDescription>{t("applyTrainer.retryAfter", { days })}</CardDescription>
            </CardHeader>
          </Card>,
        )}
      </>
    );
  }

  if (!canApply && latestApplication?.status === "approved") {
    return (
      <>
        <SEOHead title={t("applyTrainer.title")} description={t("applyTrainer.subtitle")} noindex />
        {outletBody(
          <Card>
            <CardHeader>
              <CardTitle>{t("applyTrainer.statusApprovedTitle")}</CardTitle>
              <CardDescription>{t("applyTrainer.statusApprovedDescription")}</CardDescription>
            </CardHeader>
          </Card>,
        )}
      </>
    );
  }

  return (
    <>
      <SEOHead title={t("applyTrainer.title")} description={t("applyTrainer.subtitle")} noindex />
      <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full space-y-6 pb-16 safe-area-bottom" dir={isRTL ? "rtl" : "ltr"}>
        {loading || !profile || !initialValues ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ) : (
          <TrainerForm
            mode="apply"
            formResetKey={formKey}
            initialValues={initialValues}
            readonlyFields={readonlyFields}
            hiddenFields={hiddenFields}
            requireSingleBio
            garageStorageUserId={user.id}
            onSubmit={handleSubmit}
            isSubmitting={submitting}
            submitLabel={t("applyTrainer.submitButton")}
          />
        )}
      </div>
    </>
  );
};

export default ApplyTrainer;
