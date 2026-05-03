import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { invalidateTrainerQueries } from '@/lib/trainerCacheKeys';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminTrainers } from '@/hooks/admin/useAdminTrainers';
import { useAdminTrainerApplicationsPendingCount } from '@/hooks/useAdminTrainerApplications';
import TrainerApplicationsList from '@/components/admin/trainer/TrainerApplicationsList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/ui/form-field';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Star, X, ArrowLeft, ArrowRight, Users, Bike, MapPin, Clock, AlertTriangle, TrendingUp, Eye, Check, Minus } from 'lucide-react';
import TrainerForm, { type TrainerFormHandle } from '@/components/trainer/TrainerForm';
import type { TrainerFormSubmission, TrainerFormValues } from '@/types/trainerForm';
import { uploadTrainerProfilePhoto, uploadTrainerAlbumFile } from '@/lib/trainer-uploads';
import { joinFullName, splitFullName } from '@/lib/trainer-name-utils';
import { parseTrainerPhone } from '@/lib/trainer-phone-utils';
import {
  formLanguagesToDb,
  languageEntriesToForm,
  parseLanguageLevels,
} from '@/lib/trainer-form-constants';
import type { BikeEntry as GarageBikeEntry } from '@/hooks/useUserProfile';
import { COUNTRIES, OTHER_OPTION } from '@/data/countryCityData';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { parseTrainingSessions } from '@/lib/trainingSessionCurriculum';

export type BikeEntry = {
  type: string;
  brand: string;
  photos: string[];
};

function parseBikeEntries(raw: unknown): BikeEntry[] {
  if (!raw || !Array.isArray(raw)) return [];
  return (raw as unknown[])
    .map((x) => {
      const o = x as Record<string, unknown>;
      return {
        type: String(o.type ?? '').trim(),
        brand: String(o.brand ?? ''),
        photos: Array.isArray(o.photos) ? (o.photos as unknown[]).map(String) : [],
      };
    })
    .filter((e) => e.type);
}

function summarizeMotorbikeBrand(entries: BikeEntry[]): string {
  return entries
    .map((e) => (e.brand ? `${e.type}: ${e.brand}` : e.type))
    .filter(Boolean)
    .join(' · ');
}

function flattenBikePhotos(entries: BikeEntry[]): string[] {
  return entries.flatMap((e) => e.photos);
}

function trainerTableLocationDisplay(t: Trainer, isRTL: boolean): string {
  const countryEntry = COUNTRIES.find((c) => c.code === t.country);
  const displayCountry = countryEntry ? (isRTL ? countryEntry.ar : countryEntry.en) : (t.country || '').trim();
  const cityEntry = countryEntry?.cities.find((c) => c.en === t.city || c.ar === t.city);
  const displayCity = cityEntry ? (isRTL ? cityEntry.ar : cityEntry.en) : (t.city || '').trim();
  const parts = [displayCity, displayCountry].filter(Boolean);
  if (parts.length === 0) return '—';
  return parts.join(isRTL ? '، ' : ', ');
}

function parseAssignmentLocation(location: string): { countryCode: string; city: string } {
  const loc = (location || '').trim();
  if (!loc) return { countryCode: '', city: '' };
  const idx = loc.indexOf(' - ');
  if (idx === -1) return { countryCode: '', city: loc };
  const countryPart = loc.slice(0, idx).trim();
  const cityPart = loc.slice(idx + 3).trim();
  const country = COUNTRIES.find((c) => c.en === countryPart || c.ar === countryPart || c.code === countryPart);
  return { countryCode: country?.code || '', city: cityPart };
}

function buildTrainerCourseLocation(countryCode: string, city: string): string {
  const country = COUNTRIES.find((c) => c.code === countryCode);
  if (!country) return (city || '').trim();
  return `${country.en} - ${(city || '').trim()}`;
}

function trainingTypeLabel(type: string | null | undefined, isRTL: boolean): string {
  if (type === 'theory') return isRTL ? 'نظري' : 'Theory';
  if (type === 'practical') return isRTL ? 'عملي' : 'Practical';
  return type || '';
}

interface Trainer {
  id: string;
  name_ar: string;
  name_en: string;
  phone?: string;
  email?: string;
  photo_url: string | null;
  bio_ar: string;
  bio_en: string;
  country: string;
  city: string;
  bike_type: string;
  bike_entries?: unknown;
  bike_photos?: string[] | null;
  album_photos?: string[] | null;
  motorbike_brand: string;
  license_type: string;
  years_of_experience: number;
  services: string[];
  status: string;
  created_at: string;
  profit_ratio: number;
  language_levels?: unknown;
  date_of_birth?: string | null;
}

function buildTrainerFormInitialValues(t: Trainer): Partial<TrainerFormValues> {
  const ar = splitFullName(t.name_ar);
  const en = splitFullName(t.name_en);
  const ph = parseTrainerPhone((t.phone ?? '').trim());
  const rawV2 = parseBikeEntries(t.bike_entries);
  const bike_entries: GarageBikeEntry[] =
    rawV2.length > 0 && 'id' in (rawV2[0] as object)
      ? (rawV2 as unknown as GarageBikeEntry[])
      : rawV2.map((e) => ({
          id: crypto.randomUUID(),
          type_id: null,
          type_name: e.type,
          subtype_id: null,
          subtype_name: '',
          brand: e.brand || '',
          model: '',
          is_custom_type: true,
          is_custom_brand: true,
          photos: e.photos,
        }));
  return {
    photo_url: t.photo_url,
    photo_album: Array.isArray(t.album_photos) ? [...t.album_photos] : [],
    first_name_ar: ar.first,
    last_name_ar: ar.last,
    first_name_en: en.first,
    last_name_en: en.last,
    phone: (t.phone ?? '').trim(),
    phone_country_code: ph.prefixKey,
    email: (t.email ?? '').trim(),
    date_of_birth: t.date_of_birth ?? null,
    bio_ar: t.bio_ar || '',
    bio_en: t.bio_en || '',
    country: t.country,
    city: t.city,
    gender: '',
    nationality: '',
    bike_entries,
    years_of_experience: t.years_of_experience,
    languages: languageEntriesToForm(parseLanguageLevels(t.language_levels)),
    services: t.services || [],
    status: t.status === 'inactive' ? 'inactive' : 'active',
    license_type: t.license_type || '',
    profit_ratio: t.profit_ratio ?? 0,
  };
}

interface TrainerCourse {
  training_id: string;
  price: number;
  /** Locked from `trainings.default_sessions_count` — not user-editable. */
  sessions_count: number;
  /** Locked from `trainings.default_session_duration_hours` — not user-editable. */
  duration_hours: number;
  location_country: string;
  location_city: string;
  location_detail: string;
  available_schedule: Json;
  services: string[];
}

type TrainingDetailsCache = {
  default_sessions_count: number;
  default_session_duration_hours: number;
  sessions: unknown;
};

function assignmentMissingKeys(at: TrainerCourse): Array<'price' | 'country' | 'city'> {
  const missing: Array<'price' | 'country' | 'city'> = [];
  if (!(Number(at.price) > 0)) missing.push('price');
  if (!(at.location_country || '').trim()) missing.push('country');
  if (!(at.location_city || '').trim()) missing.push('city');
  return missing;
}

function toTrainerCourseInsertRow(trainerId: string, at: TrainerCourse) {
  return {
    trainer_id: trainerId,
    training_id: at.training_id,
    price: at.price,
    sessions_count: at.sessions_count,
    duration_hours: at.duration_hours,
    location: buildTrainerCourseLocation(at.location_country, at.location_city),
    location_detail: at.location_detail || '',
    available_schedule: at.available_schedule ?? {},
    services: at.services ?? [],
  };
}

type TrainingCatalogRow = {
  id: string;
  name_ar?: string | null;
  name_en?: string | null;
  type?: string | null;
  default_sessions_count?: number | null;
  default_session_duration_hours?: number | null;
  sessions?: unknown;
};

type TrainingCatalogBaseRow = Omit<TrainingCatalogRow, 'sessions'>;

type TrainingCatalogWithRequiredDefaults = {
  id: string;
  default_sessions_count: number | null;
  default_session_duration_hours: number | null;
  sessions?: unknown;
};

function withTrainingSessions(row: unknown): TrainingCatalogRow | null {
  if (!row || typeof row !== 'object' || !("id" in row)) return null;

  const typedRow = row as TrainingCatalogBaseRow & { sessions?: unknown };
  return {
    ...typedRow,
    sessions: typedRow.sessions ?? [],
  };
}

/** Force session count & duration from training defaults (never stale user input). */
function resolveLockedTrainerCourse(
  at: TrainerCourse,
  details: Record<string, TrainingDetailsCache>,
  catalog: TrainingCatalogRow[] | undefined,
): TrainerCourse {
  const det = details[at.training_id];
  const meta = catalog?.find((x) => x.id === at.training_id);
  if (det) {
    return {
      ...at,
      sessions_count: Math.max(1, Number(det.default_sessions_count)),
      duration_hours: Math.max(0.25, Number(det.default_session_duration_hours)),
    };
  }
  if (meta) {
    return {
      ...at,
      sessions_count: Math.max(1, Number(meta.default_sessions_count ?? 1)),
      duration_hours: Math.max(0.25, Number(meta.default_session_duration_hours ?? 2)),
    };
  }
  return {
    ...at,
    sessions_count: Math.max(1, Number(at.sessions_count) || 1),
    duration_hours: Math.max(0.25, Number(at.duration_hours) || 0.25),
  };
}

// ─── Main Page ───────────────────────────────────────────────────────
const AdminTrainers: React.FC = () => {
  const { useRQ, useRM, queryClient, dbFrom } = useAdminTrainers();
  const { isRTL } = useLanguage();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: pendingApplicationsCount = 0 } = useAdminTrainerApplicationsPendingCount();
  const mainTab = searchParams.get('tab') === 'applications' ? 'applications' : 'trainers';

  const setMainTab = (v: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v === 'applications') next.set('tab', 'applications');
        else next.delete('tab');
        return next;
      },
      { replace: true },
    );
  };
  const locationFieldDir = isRTL ? 'rtl' : 'ltr';
  const trainerFormRef = useRef<TrainerFormHandle>(null);
  const trainerFormSnapshotRef = useRef<Partial<TrainerFormValues>>({});
  const [trainerFormNonce, setTrainerFormNonce] = useState(0);
  const [trainerFormInitial, setTrainerFormInitial] = useState<Partial<TrainerFormValues>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null);
  const [assignedTrainings, setAssignedTrainings] = useState<TrainerCourse[]>([]);
  const [trainingDetails, setTrainingDetails] = useState<Record<string, TrainingDetailsCache>>({});

  const { data: trainers, isLoading } = useRQ({
    queryKey: ['admin-trainers'],
    queryFn: async () => {
      const { data, error } = await dbFrom('trainers').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Trainer[];
    },
  });

  const { data: allTrainings } = useRQ({
    queryKey: ['all-trainings-catalog'],
    queryFn: async () => {
      const withSessions = await supabase
        .from('trainings')
        .select('id, name_ar, name_en, type, default_sessions_count, default_session_duration_hours, sessions');
      if (withSessions.error && String(withSessions.error.code) === '42703') {
        const legacy = await supabase
          .from('trainings')
          .select('id, name_ar, name_en, type, default_sessions_count, default_session_duration_hours');
        if (legacy.error) throw legacy.error;
        return (legacy.data || []).map(withTrainingSessions).filter((row): row is TrainingCatalogRow => row !== null);
      }
      if (withSessions.error) throw withSessions.error;
      return (withSessions.data || []).map(withTrainingSessions).filter((row): row is TrainingCatalogRow => row !== null);
    },
  });

  const { data: reviewStats } = useRQ({
    queryKey: ['trainer-review-stats'],
    queryFn: async () => {
      const { data, error } = await dbFrom('trainer_reviews').select('trainer_id, rating');
      if (error) throw error;
      const stats: Record<string, { avg: number; count: number }> = {};
      const grouped: Record<string, number[]> = {};
      data?.forEach(r => { if (!grouped[r.trainer_id]) grouped[r.trainer_id] = []; grouped[r.trainer_id].push(r.rating); });
      Object.entries(grouped).forEach(([id, ratings]) => {
        stats[id] = { avg: ratings.reduce((a, b) => a + b, 0) / ratings.length, count: ratings.length };
      });
      return stats;
    },
  });

  const { data: studentCounts } = useRQ({
    queryKey: ['trainer-student-counts'],
    queryFn: async () => {
      const { data, error } = await dbFrom('training_students').select('trainer_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach(s => { counts[s.trainer_id] = (counts[s.trainer_id] || 0) + 1; });
      return counts;
    },
  });

  const { data: studentTrainerTrainingRows } = useRQ({
    queryKey: ['admin-training-students-by-pair'],
    queryFn: async () => {
      const { data, error } = await dbFrom('training_students').select('trainer_id, training_id');
      if (error) throw error;
      return (data || []) as { trainer_id: string; training_id: string }[];
    },
  });

  const { data: trainerCourseRows } = useRQ({
    queryKey: ['admin-trainer-courses-summary'],
    queryFn: async () => {
      const { data, error } = await dbFrom('trainer_courses').select('trainer_id, training_id, price');
      if (error) throw error;
      return (data || []) as { trainer_id: string; training_id: string; price: number | string }[];
    },
  });

  const studentsPerTrainerTraining = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    studentTrainerTrainingRows?.forEach(({ trainer_id, training_id }) => {
      if (!m[trainer_id]) m[trainer_id] = {};
      m[trainer_id][training_id] = (m[trainer_id][training_id] || 0) + 1;
    });
    return m;
  }, [studentTrainerTrainingRows]);

  const trainingCountByTrainer = useMemo(() => {
    const c: Record<string, number> = {};
    trainerCourseRows?.forEach((r) => {
      c[r.trainer_id] = (c[r.trainer_id] || 0) + 1;
    });
    return c;
  }, [trainerCourseRows]);

  const revenueByTrainer = useMemo(() => {
    const rev: Record<string, number> = {};
    if (!trainerCourseRows || !trainers) return rev;
    const grossByTrainer: Record<string, number> = {};
    trainerCourseRows.forEach((tc) => {
      const n = studentsPerTrainerTraining[tc.trainer_id]?.[tc.training_id] || 0;
      const price = Number(tc.price) || 0;
      grossByTrainer[tc.trainer_id] = (grossByTrainer[tc.trainer_id] || 0) + price * n;
    });
    trainers.forEach((t) => {
      const gross = grossByTrainer[t.id] || 0;
      const ratio = (Number(t.profit_ratio) || 0) / 100;
      rev[t.id] = gross * ratio;
    });
    return rev;
  }, [trainerCourseRows, trainers, studentsPerTrainerTraining]);

  const saveMutation = useRM({
    mutationFn: async (submission: TrainerFormSubmission) => {
      const form = submission.values;
      let photoUrl = form.photo_url;
      if (submission.profilePhotoFile) photoUrl = await uploadTrainerProfilePhoto(submission.profilePhotoFile);

      const name_en = joinFullName(form.first_name_en, form.last_name_en);
      const name_ar = joinFullName(form.first_name_ar, form.last_name_ar);
      const albumPhotos = [...(form.photo_album || [])];

      const garageEntries = form.bike_entries as GarageBikeEntry[];
      const bike_type = garageEntries.map((e) => e.type_name).filter(Boolean).join(', ');
      const bikeEntries: BikeEntry[] = garageEntries.map((e) => ({
        type: e.type_name,
        brand: [e.brand, e.model].filter(Boolean).join(' '),
        photos: [...e.photos],
      }));

      let trainerId: string;

      const rowBeforeUploads = {
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
        bike_photos: flattenBikePhotos(bikeEntries),
        album_photos: albumPhotos,
        motorbike_brand: summarizeMotorbikeBrand(bikeEntries),
        license_type: form.license_type ?? '',
        years_of_experience: form.years_of_experience,
        profit_ratio: form.profit_ratio ?? 0,
        services: form.services,
        status: form.status ?? 'active',
        photo_url: photoUrl,
        language_levels: formLanguagesToDb(form.languages) as unknown as Json,
        date_of_birth: form.date_of_birth,
      };

      if (editingTrainer) {
        trainerId = editingTrainer.id;
        const { error } = await dbFrom('trainers').update(rowBeforeUploads).eq('id', trainerId);
        if (error) {
          const msg = String(error.message || '');
          const missingPhoneOrEmailColumn =
            msg.includes("Could not find the 'email' column of 'trainers'") ||
            msg.includes("Could not find the 'phone' column of 'trainers'");
          if (!missingPhoneOrEmailColumn) throw error;
          const legacyRow = { ...rowBeforeUploads } as Record<string, unknown>;
          delete legacyRow.phone;
          delete legacyRow.email;
          const { error: retryError } = await dbFrom('trainers').update(legacyRow).eq('id', trainerId);
          if (retryError) throw retryError;
          toast.warning(
            isRTL
              ? 'تم الحفظ بدون البريد/الهاتف لأن قاعدة البيانات لم تُحدَّث بعد.'
              : 'Saved without phone/email because DB migration is not applied yet.',
          );
        }
      } else {
        let { data, error } = await dbFrom('trainers').insert(rowBeforeUploads).select('id').single();
        if (error) {
          const msg = String(error.message || '');
          const missingPhoneOrEmailColumn =
            msg.includes("Could not find the 'email' column of 'trainers'") ||
            msg.includes("Could not find the 'phone' column of 'trainers'");
          if (!missingPhoneOrEmailColumn) throw error;
          const legacyRow = { ...rowBeforeUploads } as Record<string, unknown>;
          delete legacyRow.phone;
          delete legacyRow.email;
          const retry = await dbFrom('trainers').insert(legacyRow).select('id').single();
          data = retry.data;
          error = retry.error;
          if (error) throw error;
          toast.warning(
            isRTL
              ? 'تم الحفظ بدون البريد/الهاتف لأن قاعدة البيانات لم تُحدَّث بعد.'
              : 'Saved without phone/email because DB migration is not applied yet.',
          );
        }
        trainerId = data.id;
      }

      for (const { file } of submission.pendingAlbumFiles) {
        albumPhotos.push(await uploadTrainerAlbumFile(trainerId, file));
      }

      if (submission.pendingAlbumFiles.length > 0) {
        const { error: upErr } = await supabase
          .from('trainers')
          .update({ album_photos: albumPhotos })
          .eq('id', trainerId);
        if (upErr) throw upErr;
      }

      if (editingTrainer) {
        await dbFrom('trainer_courses').delete().eq('trainer_id', editingTrainer.id);
        if (assignedTrainings.length > 0) {
          const { error: tcError } = await dbFrom('trainer_courses').insert(
            assignedTrainings.map((at) =>
              toTrainerCourseInsertRow(
                trainerId,
                resolveLockedTrainerCourse(at, trainingDetails, allTrainings as TrainingCatalogRow[] | undefined),
              ),
            ),
          );
          if (tcError) throw tcError;
        }
      } else if (assignedTrainings.length > 0) {
        const { error: tcError } = await dbFrom('trainer_courses').insert(
          assignedTrainings.map((at) =>
            toTrainerCourseInsertRow(
              trainerId,
              resolveLockedTrainerCourse(at, trainingDetails, allTrainings as TrainingCatalogRow[] | undefined),
            ),
          ),
        );
        if (tcError) throw tcError;
      }

      // Surface the trainer id to onSuccess so we can fire the
      // trainer-scoped invalidations precisely.
      return { trainerId };
    },
    onSuccess: (data, submission: TrainerFormSubmission) => {
      submission.pendingAlbumFiles.forEach((p) => URL.revokeObjectURL(p.preview));
      // Use the centralised helper so we don't miss public-facing query keys
      // (the recurring "admin saves but /trainers public list shows old data"
      // bug). See src/lib/trainerCacheKeys.ts for the full key list.
      invalidateTrainerQueries(queryClient, data?.trainerId ?? editingTrainer?.id);
      setFormOpen(false);
      toast.success(isRTL ? 'تم الحفظ بنجاح' : 'Saved successfully');
    },
    onError: (error) => {
      console.error('[AdminTrainers] saveMutation failed', error);
      const err = error as { message?: string; details?: string; hint?: string; code?: string };
      const parts = [err.message, err.details, err.hint].filter(Boolean);
      const msg = parts.length ? parts.join(' — ') : String(error);
      toast.error(isRTL ? `حدث خطأ: ${msg}` : `Save failed: ${msg}`);
    },
  });

  const deleteMutation = useRM({
    mutationFn: async (id: string) => {
      // Get trainer's user_id before deletion to revert their role
      const { data: trainerRow } = await dbFrom('trainers').select('user_id').eq('id', id).maybeSingle();
      const userId = trainerRow?.user_id as string | undefined;

      const { error } = await dbFrom('trainers').delete().eq('id', id);
      if (error) throw error;

      // Revert role: remove instructor, add student (idempotent)
      if (userId) {
        await dbFrom('user_roles').delete().eq('user_id', userId).eq('role', 'instructor');
        const { error: insErr } = await dbFrom('user_roles').insert({ user_id: userId, role: 'student' });
        // Ignore unique-violation if student role already exists
        if (insErr && !String(insErr.message || '').toLowerCase().includes('duplicate')) {
          console.warn('Failed to assign student role after trainer deletion:', insErr.message);
        }
      }

      return { trainerId: id };
    },
    onSuccess: (data) => {
      // Same centralised helper — covers public-trainers, the trainer's
      // detail page, the booking flow, plus all admin-scoped keys.
      invalidateTrainerQueries(queryClient, data?.trainerId);
      setDeleteId(null);
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
    },
    onError: () => toast.error(isRTL ? 'حدث خطأ' : 'An error occurred'),
  });

  const openAdd = () => {
    setEditingTrainer(null);
    setTrainerFormInitial({});
    setTrainerFormNonce((n) => n + 1);
    setAssignedTrainings([]);
    setTrainingDetails({});
    setFormOpen(true);
  };

  const openEdit = async (t: Trainer) => {
    setEditingTrainer(t);
    setTrainerFormInitial(buildTrainerFormInitialValues(t));
    setTrainerFormNonce((n) => n + 1);
    const { data: courseRows } = await supabase
      .from('trainer_courses')
      .select('training_id, price, sessions_count, duration_hours, location, location_detail, available_schedule, services')
      .eq('trainer_id', t.id);

    const rows = courseRows || [];
    const trainingIds = [...new Set(rows.map((r) => r.training_id))];
    let detailsMap: Record<string, TrainingDetailsCache> = {};
    if (trainingIds.length > 0) {
    const withSessions = await supabase
      .from('trainings')
      .select('id, default_sessions_count, default_session_duration_hours, sessions')
      .in('id', trainingIds);
    if (withSessions.error && String(withSessions.error.code) === '42703') {
      // Backward-compat for DBs where `trainings.sessions` isn't migrated yet.
      const legacy = await supabase
        .from('trainings')
        .select('id, default_sessions_count, default_session_duration_hours')
        .in('id', trainingIds);
      if (legacy.error) {
        console.error('[AdminTrainers] openEdit training details', legacy.error);
      }
      legacy.data?.forEach((tr) => {
        const normalized = withTrainingSessions(tr);
        if (!normalized) return;
        detailsMap[normalized.id] = {
          default_sessions_count: Math.max(1, Number(normalized.default_sessions_count ?? 1)),
          default_session_duration_hours: Math.max(0.25, Number(normalized.default_session_duration_hours ?? 2)),
          sessions: [],
        };
      });
    } else {
      if (withSessions.error) console.error('[AdminTrainers] openEdit training details', withSessions.error);
      withSessions.data?.forEach((tr) => {
        const normalized = withTrainingSessions(tr);
        if (!normalized) return;
        detailsMap[normalized.id] = {
          default_sessions_count: Math.max(1, Number(normalized.default_sessions_count ?? 1)),
          default_session_duration_hours: Math.max(0.25, Number(normalized.default_session_duration_hours ?? 2)),
          sessions: normalized.sessions ?? [],
        };
      });
    }
    }
    setTrainingDetails(detailsMap);

    setAssignedTrainings(
      rows.map((d) => {
        const det = detailsMap[d.training_id];
        return {
          training_id: d.training_id,
          price: Number(d.price),
          sessions_count: det
            ? det.default_sessions_count
            : Math.max(1, Number((d as { sessions_count?: number }).sessions_count ?? 1)),
          duration_hours: det ? det.default_session_duration_hours : Number(d.duration_hours),
          location_country: parseAssignmentLocation(d.location).countryCode,
          location_city: parseAssignmentLocation(d.location).city,
          location_detail: (d as { location_detail?: string }).location_detail || '',
          available_schedule: d.available_schedule,
          services: (d as { services?: string[] }).services ?? [],
        };
      }),
    );
    setFormOpen(true);
  };

  const openEditRef = useRef(openEdit);
  openEditRef.current = openEdit;

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId) return;

    const clearParam = () => setSearchParams({}, { replace: true });

    const run = async () => {
      const fromList = trainers?.find((x) => x.id === editId);
      if (fromList) {
        await openEditRef.current(fromList);
        clearParam();
        return;
      }
      if (trainers === undefined) return;
      const { data, error } = await dbFrom('trainers').select('*').eq('id', editId).single();
      if (!error && data) {
        await openEditRef.current(data as Trainer);
      }
      clearParam();
    };

    void run();
  }, [searchParams, trainers, setSearchParams]);

  /**
   * Add/remove a training assignment. New rows snapshot trainer country/city/services from the form;
   * changing trainer location later does not update existing assignments.
   * Session count and duration are locked from `trainings` defaults (fetched on add).
   */
  const toggleTraining = async (trainingId: string, checked: boolean) => {
    if (!checked) {
      setAssignedTrainings((prev) => prev.filter((at) => at.training_id !== trainingId));
      return;
    }

    let training: TrainingCatalogWithRequiredDefaults | null = null;

    const withSessions = await supabase
      .from('trainings')
      .select('id, default_sessions_count, default_session_duration_hours, sessions')
      .eq('id', trainingId)
      .single();

    if (withSessions.error && String(withSessions.error.code) === '42703') {
      const legacy = await supabase
        .from('trainings')
        .select('id, default_sessions_count, default_session_duration_hours')
        .eq('id', trainingId)
        .single();
      if (legacy.error || !legacy.data) {
        console.error('[AdminTrainers] toggleTraining fetch', legacy.error);
        toast.error(isRTL ? 'تعذر تحميل بيانات التدريب' : 'Could not load training details');
        return;
      }
      training = { ...legacy.data, sessions: [] };
    } else if (withSessions.error || !withSessions.data) {
      console.error('[AdminTrainers] toggleTraining fetch', withSessions.error);
      toast.error(isRTL ? 'تعذر تحميل بيانات التدريب' : 'Could not load training details');
      return;
    } else {
      const normalized = withTrainingSessions(withSessions.data);
      if (!normalized) {
        toast.error(isRTL ? 'تعذر تحميل بيانات التدريب' : 'Could not load training details');
        return;
      }
      training = {
        id: normalized.id,
        default_sessions_count: normalized.default_sessions_count ?? 1,
        default_session_duration_hours: normalized.default_session_duration_hours ?? 2,
        sessions: normalized.sessions ?? [],
      };
    }

    const defSessions = Math.max(1, Number(training.default_sessions_count ?? 1));
    const defDur = Math.max(0.25, Number(training.default_session_duration_hours ?? 2));

    setTrainingDetails((prev) => ({
      ...prev,
      [trainingId]: {
        default_sessions_count: defSessions,
        default_session_duration_hours: defDur,
        sessions: training.sessions ?? [],
      },
    }));

    const snap = trainerFormSnapshotRef.current;
    const location_country = (snap.country ?? editingTrainer?.country ?? '').trim();
    const location_city = (snap.city ?? editingTrainer?.city ?? '').trim();
    setAssignedTrainings((prev) => {
      if (prev.some((a) => a.training_id === trainingId)) return prev;
      return [
        ...prev,
        {
          training_id: trainingId,
          price: 0,
          sessions_count: defSessions,
          duration_hours: defDur,
          location_country,
          location_city,
          location_detail: '',
          available_schedule: {},
          services: [],
        },
      ];
    });
  };

  const updateAssignment = (trainingId: string, field: keyof TrainerCourse, value: unknown) => {
    setAssignedTrainings((prev) =>
      prev.map((at) => (at.training_id === trainingId ? { ...at, [field]: value } : at)),
    );
  };

  const setAssignmentCountry = (trainingId: string, countryCode: string) => {
    setAssignedTrainings((prev) =>
      prev.map((at) => {
        if (at.training_id !== trainingId) return at;
        return { ...at, location_country: countryCode, location_city: '' };
      }),
    );
  };

  const setAssignmentCityFromSelect = (trainingId: string, cityEn: string) => {
    setAssignedTrainings((prev) =>
      prev.map((at) => {
        if (at.training_id !== trainingId) return at;
        if (cityEn === 'Other') {
          return { ...at, location_city: '' };
        }
        return { ...at, location_city: cityEn };
      }),
    );
  };

  const setAssignmentCityManual = (trainingId: string, cityText: string) => {
    setAssignedTrainings((prev) =>
      prev.map((at) => {
        if (at.training_id !== trainingId) return at;
        return { ...at, location_city: cityText };
      }),
    );
  };

  const validateAssignedTrainings = () => {
    for (const at of assignedTrainings) {
      const missing = assignmentMissingKeys(at);
      if (missing.length === 0) continue;
      const tr = allTrainings?.find((x) => x.id === at.training_id);
      const trainingName = tr ? (isRTL ? tr.name_ar : tr.name_en) : at.training_id;
      const labels = missing.map((k) => {
        if (k === 'price') return isRTL ? 'السعر' : 'Price';
        if (k === 'country') return isRTL ? 'الدولة' : 'Country';
        return isRTL ? 'المدينة' : 'City';
      });
      return {
        ok: false as const,
        message: isRTL
          ? `أكمل بيانات التدريب "${trainingName}": ${labels.join('، ')}`
          : `Complete "${trainingName}" fields: ${labels.join(', ')}`,
      };
    }
    return { ok: true as const, message: '' };
  };

  const handleTrainerFormSubmit = async (submission: TrainerFormSubmission) => {
    const v = validateAssignedTrainings();
    if (!v.ok) {
      toast.error(v.message);
      return;
    }
    await saveMutation.mutateAsync(submission);
  };

  const onSaveTrainer = () => {
    void trainerFormRef.current?.submit();
  };

  useEffect(() => {
    if (!formOpen) return;
    trainerFormSnapshotRef.current = { ...trainerFormInitial };
  }, [formOpen, trainerFormNonce, trainerFormInitial]);

  // ─── Full-page form view ────────────────────────────────────────
  if (formOpen) {
    return (
      <AdminLayout>
        <div className="space-y-6 max-w-4xl mx-auto" dir={isRTL ? 'rtl' : 'ltr'}>
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setFormOpen(false)}>
              {isRTL ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{editingTrainer ? (isRTL ? 'تعديل مدرب' : 'Edit Trainer') : (isRTL ? 'إضافة مدرب' : 'Add Trainer')}</h1>
            </div>
            <Button onClick={onSaveTrainer} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? '...' : (isRTL ? 'حفظ' : 'Save')}
            </Button>
          </div>

          <TrainerForm
            ref={trainerFormRef}
            mode={editingTrainer ? 'admin-edit' : 'admin-create'}
            formResetKey={trainerFormNonce}
            initialValues={trainerFormInitial}
            garageStorageUserId={editingTrainer?.id ?? null}
            hideSubmitButton
            onValuesChange={(v) => {
              trainerFormSnapshotRef.current = v;
            }}
            onSubmit={handleTrainerFormSubmit}
            isSubmitting={saveMutation.isPending}
            trainingsSlot={
            <>
          {/* Section: Training Assignments */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider text-start">
                  {isRTL ? 'التدريبات المعينة' : 'Training Assignments'}
                </h3>
                {allTrainings && allTrainings.length > 0 && (
                  <Badge variant="secondary" className="w-fit shrink-0">
                    {isRTL
                      ? `التدريبات المختارة: ${assignedTrainings.length} / ${allTrainings.length}`
                      : `Selected: ${assignedTrainings.length} / ${allTrainings.length}`}
                  </Badge>
                )}
              </div>

              {!allTrainings?.length ? (
                <div className="space-y-4 rounded-lg border border-dashed border-border py-10 text-center">
                  <p className="text-sm text-muted-foreground px-4">
                    {isRTL ? 'لا توجد تدريبات متاحة، أضف تدريبات أولاً' : 'No trainings available. Add trainings first.'}
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/admin/trainings">{isRTL ? 'الانتقال إلى التدريبات' : 'Go to Trainings'}</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {allTrainings.map((training) => {
                    const isAssigned = assignedTrainings.some((at) => at.training_id === training.id);
                    const assignment = assignedTrainings.find((at) => at.training_id === training.id);
                    const missingInAssignment = assignment ? assignmentMissingKeys(assignment) : [];
                    const hasMissing = missingInAssignment.length > 0;
                    const name = isRTL ? training.name_ar : training.name_en;
                    const typeBadge = trainingTypeLabel(training.type, isRTL);
                    return (
                      <div
                        key={training.id}
                        className={`rounded-xl border transition-colors ${
                          isAssigned ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 p-4">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-start text-sm font-medium leading-snug">{name}</span>
                              <Badge variant="outline" className="shrink-0 px-2 py-0 text-[10px] font-normal">
                                {typeBadge}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {isAssigned && assignment ? (
                              <>
                                <Check className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => void toggleTraining(training.id, false)}
                                  aria-label={isRTL ? 'إزالة التدريب' : 'Remove training'}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => void toggleTraining(training.id, true)}
                                aria-label={isRTL ? 'إضافة تدريب' : 'Add training'}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <AnimatePresence initial={false}>
                          {isAssigned && assignment ? (
                            <motion.div
                              key={`assign-${training.id}`}
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                              className="overflow-hidden border-t border-border/50"
                            >
                              <div className="space-y-3 bg-muted/10 p-4">
                                {hasMissing && (
                                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                                    {isRTL
                                      ? 'يرجى تعبئة جميع الحقول المطلوبة لهذا التدريب قبل الحفظ.'
                                      : 'Please fill all required fields for this training before saving.'}
                                  </div>
                                )}

                                {(() => {
                                  const td = trainingDetails[training.id];
                                  const meta = allTrainings?.find((x) => x.id === training.id) as TrainingCatalogRow | undefined;
                                  const curriculum = parseTrainingSessions(td?.sessions ?? meta?.sessions);
                                  const defaultSessions = curriculum.length > 0
                                    ? curriculum.length
                                    : td
                                      ? td.default_sessions_count
                                      : Math.max(1, Number(meta?.default_sessions_count ?? assignment.sessions_count ?? 1));
                                  const defaultDur = curriculum.length > 0
                                    ? Math.round((curriculum.reduce((sum, s) => sum + s.duration_hours, 0) / curriculum.length) * 100) / 100
                                    : td
                                      ? td.default_session_duration_hours
                                      : Math.max(0.25, Number(meta?.default_session_duration_hours ?? assignment.duration_hours ?? 2));
                                  if (!td && !meta) {
                                    return (
                                      <div
                                        className="mb-1 rounded-xl border border-border/50 bg-muted/30 p-3 sm:mx-0"
                                        dir={isRTL ? 'rtl' : 'ltr'}
                                      >
                                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                          {isRTL ? 'تفاصيل التدريب' : 'Training Details'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {isRTL ? 'عدد الجلسات:' : 'Sessions:'}{' '}
                                          <span className="font-semibold text-foreground">{defaultSessions}</span>
                                          {' · '}
                                          {isRTL ? 'المدة/جلسة:' : 'Hrs/session:'}{' '}
                                          <span className="font-semibold text-foreground">{defaultDur}</span>
                                        </p>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div
                                      className="mb-1 rounded-xl border border-border/50 bg-muted/30 p-3 sm:mx-0"
                                      dir={isRTL ? 'rtl' : 'ltr'}
                                    >
                                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        {isRTL ? 'تفاصيل التدريب' : 'Training Details'}
                                      </p>
                                      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                          <span className="text-xs text-muted-foreground">
                                            {isRTL ? 'عدد الجلسات' : 'Sessions'}
                                          </span>
                                          <span className="font-semibold tabular-nums">
                                            {defaultSessions}
                                            {isRTL ? ' جلسات' : ' sessions'}
                                          </span>
                                        </div>
                                      </div>
                                      {curriculum.length > 0 ? (
                                        <div className="mt-2 space-y-1 border-t border-border/40 pt-2">
                                          {curriculum.map((s, i) => (
                                            <div
                                              key={`${s.session_number}-${i}`}
                                              className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                                            >
                                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                                                {s.session_number || i + 1}
                                              </span>
                                              <span className="min-w-0 flex-1 text-start">
                                                {isRTL ? s.title_ar || s.title_en : s.title_en || s.title_ar}
                                              </span>
                                              <span className="ms-auto shrink-0 tabular-nums" dir="ltr">
                                                {s.duration_hours}h · {s.points}pts
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })()}

                                <FormField
                                  label={isRTL ? 'سعر المدرب الأساسي (ر.س)' : 'Trainer base price (SAR)'}
                                  hint={
                                    isRTL
                                      ? 'ما يستحقه المدرب؛ عمولة المنصة تُضاف من إعدادات التدريبات.'
                                      : 'Amount the trainer keeps; Bikerz commission is added in Trainings admin.'
                                  }
                                >
                                  <div className="relative max-w-md" dir="ltr">
                                    <Input
                                      type="number"
                                      className={cn('pe-12 text-start', Number(assignment.price) > 0 ? '' : 'border-amber-500/60')}
                                      value={assignment.price}
                                      onChange={(e) =>
                                        updateAssignment(training.id, 'price', parseFloat(e.target.value) || 0)
                                      }
                                    />
                                    <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                      {isRTL ? 'ر.س' : 'SAR'}
                                    </span>
                                  </div>
                                </FormField>

                                <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
                                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    {isRTL ? 'موقع التدريب' : 'Training Location'}
                                  </p>
                                {(() => {
                                  const countryCode = (assignment.location_country || '').trim();
                                  const city = (assignment.location_city || '').trim();
                                  const country = COUNTRIES.find((c) => c.code === countryCode);
                                  const cities = country ? [...country.cities, OTHER_OPTION] : [];
                                  const cityInList = !!(country && cities.some((c) => c.en === city));
                                  const showManualCity = !!(country && !cityInList && city !== '');
                                  const citySelectValue = cityInList ? city : showManualCity ? 'Other' : '';

                                  return (
                                    <div dir={locationFieldDir} className="grid gap-3 sm:grid-cols-2">
                                      <div className="min-w-0">
                                        <FormField label={isRTL ? 'الدولة' : 'Country'}>
                                        <Select
                                          dir={locationFieldDir}
                                          value={countryCode}
                                          onValueChange={(v) => setAssignmentCountry(training.id, v)}
                                        >
                                          <SelectTrigger
                                            dir={locationFieldDir}
                                            className={cn('h-9 text-xs', countryCode ? '' : 'border-amber-500/60')}
                                          >
                                            <SelectValue placeholder={isRTL ? 'اختر الدولة' : 'Select country'} />
                                          </SelectTrigger>
                                          <SelectContent dir={locationFieldDir}>
                                            {COUNTRIES.map((c) => (
                                              <SelectItem key={c.code} value={c.code}>
                                                {isRTL ? c.ar : c.en}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        </FormField>
                                      </div>
                                      <div className="min-w-0">
                                        <FormField label={isRTL ? 'المدينة' : 'City'}>
                                        <div className="space-y-2">
                                          <Select
                                            dir={locationFieldDir}
                                            value={citySelectValue}
                                            onValueChange={(v) => setAssignmentCityFromSelect(training.id, v)}
                                            disabled={!country}
                                          >
                                            <SelectTrigger dir={locationFieldDir} className="h-9 text-xs">
                                              <SelectValue placeholder={!country ? (isRTL ? 'اختر الدولة أولاً' : 'Select country first') : isRTL ? 'اختر المدينة' : 'Select city'} />
                                            </SelectTrigger>
                                            <SelectContent dir={locationFieldDir}>
                                              {cities.map((c) => (
                                                <SelectItem key={c.en} value={c.en}>
                                                  {isRTL ? c.ar : c.en}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                          {country && (citySelectValue === 'Other' || showManualCity) && (
                                            <Input
                                              dir={locationFieldDir}
                                              className={cn('h-9 text-xs text-start', city ? '' : 'border-amber-500/60')}
                                              value={city}
                                              onChange={(e) => setAssignmentCityManual(training.id, e.target.value)}
                                              placeholder={isRTL ? 'أدخل اسم المدينة' : 'Enter city name'}
                                            />
                                          )}
                                        </div>
                                        </FormField>
                                      </div>
                                    </div>
                                  );
                                })()}

                                <FormField
                                  label={isRTL ? 'تفاصيل الموقع' : 'Location Details'}
                                  hint={isRTL
                                    ? 'مثال: حديقة الملك فهد، بوابة 3، شارع الأمير محمد'
                                    : 'e.g. King Fahd Park, Gate 3, Prince Mohammed Street'}
                                >
                                  <Input
                                    value={assignment.location_detail}
                                    onChange={(e) => updateAssignment(training.id, 'location_detail', e.target.value)}
                                    placeholder={isRTL
                                      ? 'أدخل العنوان التفصيلي للموقع'
                                      : 'Enter the detailed location address'}
                                    dir={isRTL ? 'rtl' : 'ltr'}
                                    className="h-9 text-xs"
                                  />
                                </FormField>
                                </div>

                              </div>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
            </>
            }
          />

          {/* Bottom Save */}
          <div className="flex justify-end gap-3 pb-6">
            <Button variant="outline" onClick={() => setFormOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={onSaveTrainer} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? '...' : (isRTL ? 'حفظ' : 'Save')}
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // ─── Table View ─────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{isRTL ? 'إدارة المدربين' : 'Trainers Management'}</h1>
            <p className="text-sm text-muted-foreground">{isRTL ? 'إدارة جميع المدربين' : 'Manage all trainers'}</p>
          </div>
          {mainTab === 'trainers' && (
            <Button onClick={openAdd} size="sm" className="shrink-0 w-fit">
              <Plus className="w-4 h-4 me-2" />
              {isRTL ? 'إضافة مدرب' : 'Add Trainer'}
            </Button>
          )}
        </div>

        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
          <TabsList className="flex h-auto flex-wrap gap-1 p-1">
            <TabsTrigger value="trainers" className="gap-1.5">
              {isRTL ? 'المدربين' : 'Trainers'}
            </TabsTrigger>
            <TabsTrigger value="applications" className="gap-1.5">
              <span>{t('admin.trainerApplications.tabLabel')}</span>
              {pendingApplicationsCount > 0 && (
                <Badge
                  variant="destructive"
                  className="h-5 min-w-5 rounded-full px-1.5 text-[10px] font-bold tabular-nums"
                >
                  {pendingApplicationsCount >= 10 ? '9+' : pendingApplicationsCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="applications" className="mt-6 outline-none">
            <TrainerApplicationsList />
          </TabsContent>

          <TabsContent value="trainers" className="mt-6 space-y-6 outline-none">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              titleEn: 'Total Trainers',
              titleAr: 'إجمالي المدربين',
              value: trainers?.length || 0,
              icon: Users,
              color: 'text-blue-500',
              bgColor: 'bg-blue-500/10',
            },
            {
              titleEn: 'Active Trainers',
              titleAr: 'المدربين النشطين',
              value: trainers?.filter(t => t.status === 'active')?.length || 0,
              icon: TrendingUp,
              color: 'text-green-500',
              bgColor: 'bg-green-500/10',
            },
            {
              titleEn: 'Avg. Rating',
              titleAr: 'متوسط التقييم',
              value: (() => {
                if (!reviewStats || !trainers?.length) return '0.0';
                const allRatings = Object.values(reviewStats);
                if (!allRatings.length) return '0.0';
                return (allRatings.reduce((sum, s) => sum + s.avg, 0) / allRatings.length).toFixed(1);
              })(),
              icon: Star,
              color: 'text-yellow-500',
              bgColor: 'bg-yellow-500/10',
            },
            {
              titleEn: 'Total Students',
              titleAr: 'إجمالي الطلاب',
              value: studentCounts ? Object.values(studentCounts).reduce((a, b) => a + b, 0) : 0,
              icon: Users,
              color: 'text-purple-500',
              bgColor: 'bg-purple-500/10',
            },
          ].map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {isRTL ? stat.titleAr : stat.titleEn}
                      </p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-full ${stat.bgColor}`}>
                      <Icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2 flex-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))}
              </div>
            ) : trainers?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">{isRTL ? 'لا يوجد مدربين بعد' : 'No trainers yet'}</h3>
                <p className="text-sm text-muted-foreground mb-4">{isRTL ? 'ابدأ بإضافة أول مدرب' : 'Get started by adding your first trainer'}</p>
                <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 me-2" />{isRTL ? 'إضافة مدرب' : 'Add Trainer'}</Button>
              </div>
            ) : (
              <div className="overflow-x-auto" dir={isRTL ? 'rtl' : 'ltr'}>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[52px]">{isRTL ? 'الصورة / Photo' : 'Photo / الصورة'}</TableHead>
                      <TableHead>{isRTL ? 'الاسم / Name' : 'Name / الاسم'}</TableHead>
                      <TableHead>{isRTL ? 'الموقع / Location' : 'Location / الموقع'}</TableHead>
                      <TableHead>{isRTL ? 'الخبرة / Exp' : 'Exp / الخبرة'}</TableHead>
                      <TableHead>{isRTL ? 'التقييم / Rating' : 'Rating / التقييم'}</TableHead>
                      <TableHead>{isRTL ? 'الطلاب / Students' : 'Students / الطلاب'}</TableHead>
                      <TableHead>{isRTL ? 'التدريبات / Trainings' : 'Trainings / التدريبات'}</TableHead>
                      <TableHead>{isRTL ? 'الأرباح / Revenue' : 'Revenue / الأرباح'}</TableHead>
                      <TableHead>{isRTL ? 'الحالة / Status' : 'Status / الحالة'}</TableHead>
                      <TableHead className="min-w-[120px]">{isRTL ? 'الإجراءات / Actions' : 'Actions / الإجراءات'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trainers?.map((t) => {
                      const stats = reviewStats?.[t.id];
                      const ratingText = stats ? `★ ${stats.avg.toFixed(1)}` : '★ —';
                      const rev = revenueByTrainer[t.id] ?? 0;
                      const revLabel = `${rev.toFixed(0)} ${isRTL ? 'ر.س' : 'SAR'}`;
                      const initial = (isRTL ? t.name_ar : t.name_en || t.name_ar || '?').trim().charAt(0) || '?';
                      return (
                        <TableRow key={t.id}>
                          <TableCell>
                            <Avatar className="h-10 w-10 border border-border">
                              <AvatarImage src={t.photo_url || ''} className="object-cover" />
                              <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">{initial}</AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell>
                            <div className="min-w-0 max-w-[200px]">
                              <div className="font-semibold text-sm truncate">{isRTL ? t.name_ar : t.name_en}</div>
                              <div className="text-xs text-muted-foreground truncate">{isRTL ? t.name_en : t.name_ar}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm max-w-[180px]">
                              <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate" title={trainerTableLocationDisplay(t, isRTL)}>
                                {trainerTableLocationDisplay(t, isRTL)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {t.years_of_experience} {isRTL ? 'سنة' : 'yrs'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm tabular-nums">{ratingText}</TableCell>
                          <TableCell className="tabular-nums text-sm">{studentCounts?.[t.id] ?? 0}</TableCell>
                          <TableCell className="tabular-nums text-sm">{trainingCountByTrainer[t.id] ?? 0}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm font-medium text-emerald-600 tabular-nums">{revLabel}</TableCell>
                          <TableCell>
                            {t.status === 'active' ? (
                              <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/20 text-xs">
                                {isRTL ? 'نشط' : 'Active'}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground text-xs">
                                {isRTL ? 'غير نشط' : 'Inactive'}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                title={isRTL ? 'عرض التفاصيل' : 'View details'}
                                onClick={() => navigate(`/admin/trainers/${t.id}`)}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title={isRTL ? 'تعديل' : 'Edit'} onClick={() => openEdit(t)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title={isRTL ? 'حذف' : 'Delete'} onClick={() => setDeleteId(t.id)}>
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <AlertDialogTitle>{isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}</AlertDialogTitle>
                <AlertDialogDescription className="mt-1">{isRTL ? 'هل أنت متأكد من حذف هذا المدرب؟ سيتم حذف جميع البيانات المرتبطة.' : 'Are you sure you want to delete this trainer? All related data will be removed.'}</AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isRTL ? 'حذف' : 'Delete'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminTrainers;
