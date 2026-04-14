import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminTrainers } from '@/hooks/admin/useAdminTrainers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Star, Upload, X, ArrowLeft, ArrowRight, Users, Bike, MapPin, Clock, Timer, AlertTriangle, TrendingUp, Eye, Camera, Images, Check, Minus, Languages } from 'lucide-react';
import BilingualInput from '@/components/admin/content/BilingualInput';
import { COUNTRIES, OTHER_OPTION } from '@/data/countryCityData';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { parseTrainingSessions } from '@/lib/trainingSessionCurriculum';

const COMMON_BIKE_TYPES = ['Sport', 'Cruiser', 'Adventure', 'Touring', 'Naked', 'Dual Sport', 'Scooter'] as const;
const BIKE_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  Sport: { ar: 'رياضية', en: 'Sport' },
  Cruiser: { ar: 'كروزر', en: 'Cruiser' },
  Adventure: { ar: 'مغامرات', en: 'Adventure' },
  Touring: { ar: 'رحلات', en: 'Touring' },
  Naked: { ar: 'عارية', en: 'Naked' },
  'Dual Sport': { ar: 'مزدوجة الاستخدام', en: 'Dual Sport' },
  Scooter: { ar: 'سكوتر', en: 'Scooter' },
};

function bikeTypeDisplayLabel(type: string, isRTL: boolean): string {
  const m = BIKE_TYPE_LABELS[type];
  if (!m) return type;
  return isRTL ? m.ar : m.en;
}

const MAX_BIKE_PHOTO_BYTES = 2 * 1024 * 1024;
const MAX_ALBUM_PHOTO_BYTES = 3 * 1024 * 1024;
const MAX_PHOTOS_PER_BIKE_ENTRY = 5;
const MAX_ALBUM_PHOTOS = 10;

/** Stored in `trainers.language_levels` as JSON array */
export type TrainerLanguageEntry = {
  language: string;
  level: string;
};

const TRAINER_LANGUAGE_OPTIONS = [
  { code: 'ar', label_en: 'Arabic', label_ar: 'العربية' },
  { code: 'en', label_en: 'English', label_ar: 'الإنجليزية' },
  { code: 'fr', label_en: 'French', label_ar: 'الفرنسية' },
  { code: 'es', label_en: 'Spanish', label_ar: 'الإسبانية' },
  { code: 'de', label_en: 'German', label_ar: 'الألمانية' },
  { code: 'it', label_en: 'Italian', label_ar: 'الإيطالية' },
  { code: 'tr', label_en: 'Turkish', label_ar: 'التركية' },
  { code: 'ur', label_en: 'Urdu', label_ar: 'الأردية' },
  { code: 'hi', label_en: 'Hindi', label_ar: 'الهندية' },
  { code: 'pt', label_en: 'Portuguese', label_ar: 'البرتغالية' },
] as const;

const LANGUAGE_LEVEL_OPTIONS = [
  { value: 'native', label_en: 'Native', label_ar: 'لغة أم' },
  { value: 'fluent', label_en: 'Fluent', label_ar: 'طلاقة' },
  { value: 'professional', label_en: 'Professional working', label_ar: 'مهنية' },
  { value: 'conversational', label_en: 'Conversational', label_ar: 'محادثة' },
  { value: 'basic', label_en: 'Basic', label_ar: 'مبتدئ' },
] as const;

function parseLanguageLevels(raw: unknown): TrainerLanguageEntry[] {
  if (!raw || !Array.isArray(raw)) return [];
  const out: TrainerLanguageEntry[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const language = String(o.language ?? o.code ?? '').trim().toLowerCase();
    const level = String(o.level ?? '').trim().toLowerCase();
    if (!language || !level) continue;
    out.push({ language, level });
  }
  return out;
}

function languageOptionLabel(code: string, isRTL: boolean): string {
  const o = TRAINER_LANGUAGE_OPTIONS.find((x) => x.code === code);
  if (!o) return code.toUpperCase();
  return isRTL ? o.label_ar : o.label_en;
}

export type BikeEntry = {
  type: string;
  brand: string;
  photos: string[];
};

function typeStorageSlug(type: string): string {
  const s = encodeURIComponent(type.trim()).replace(/%/g, '_');
  return s.slice(0, 96) || 'bike';
}

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

function trainerBikeCellLabel(t: Trainer, isRTL: boolean): string {
  const entries = parseBikeEntries(t.bike_entries);
  if (entries.length > 0) {
    return entries.map((e) => (e.brand ? `${e.type}: ${e.brand}` : e.type)).join(' · ');
  }
  const legacy = [t.bike_type?.trim(), t.motorbike_brand?.trim()].filter(Boolean).join(' · ');
  return legacy || (isRTL ? '—' : '—');
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

function splitFullName(full: string): { first: string; last: string } {
  const s = (full || '').trim();
  const i = s.indexOf(' ');
  if (i === -1) return { first: s, last: '' };
  return { first: s.slice(0, i).trim(), last: s.slice(i + 1).trim() };
}

function joinFullName(first: string, last: string): string {
  return [first, last].map((p) => p.trim()).filter(Boolean).join(' ');
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

type PendingImage = { file: File; preview: string };

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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const locationFieldDir = isRTL ? 'rtl' : 'ltr';
  const fileRef = useRef<HTMLInputElement>(null);
  const bikePhotoFileRef = useRef<HTMLInputElement>(null);
  const bikePhotoPickTypeRef = useRef<string | null>(null);
  const albumPhotosInputRef = useRef<HTMLInputElement>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [serviceInput, setServiceInput] = useState('');
  const [isOtherCity, setIsOtherCity] = useState(false);
  const [assignedTrainings, setAssignedTrainings] = useState<TrainerCourse[]>([]);
  const [trainingDetails, setTrainingDetails] = useState<Record<string, TrainingDetailsCache>>({});
  
  const [bikeTypeInput, setBikeTypeInput] = useState('');
  const [pendingBikeByType, setPendingBikeByType] = useState<Record<string, PendingImage[]>>({});
  const [pendingAlbumImages, setPendingAlbumImages] = useState<PendingImage[]>([]);

  const defaultForm = {
    first_name_ar: '',
    first_name_en: '',
    last_name_ar: '',
    last_name_en: '',
    phone: '',
    email: '',
    bio_ar: '',
    bio_en: '',
    country: '',
    city: '',
    bike_types: [] as string[],
    bike_entries: [] as BikeEntry[],
    album_photos: [] as string[],
    license_type: '',
    years_of_experience: 0,
    profit_ratio: 0,
    services: [] as string[],
    status: 'active' as 'active' | 'inactive',
    photo_url: null as string | null,
    language_levels: [] as TrainerLanguageEntry[],
  };
  const [form, setForm] = useState(defaultForm);
  const [languageAddCode, setLanguageAddCode] = useState('');
  const [languageAddLevel, setLanguageAddLevel] = useState<string>(LANGUAGE_LEVEL_OPTIONS[1]!.value);
  const formRef = useRef(form);
  formRef.current = form;

  const revokePendingList = (list: PendingImage[]) => {
    list.forEach((p) => URL.revokeObjectURL(p.preview));
  };

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

  const uploadPhoto = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('trainer-photos').upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from('trainer-photos').getPublicUrl(path);
    return data.publicUrl;
  };

  const uploadTrainerBikeFile = async (trainerId: string, bikeType: string, file: File): Promise<string> => {
    const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
    const path = `bikes/${trainerId}/${typeStorageSlug(bikeType)}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('trainer-photos').upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from('trainer-photos').getPublicUrl(path);
    return data.publicUrl;
  };

  const uploadTrainerAlbumFile = async (trainerId: string, file: File): Promise<string> => {
    const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
    const path = `album/${trainerId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('trainer-photos').upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from('trainer-photos').getPublicUrl(path);
    return data.publicUrl;
  };

  const saveMutation = useRM({
    mutationFn: async () => {
      let photoUrl = form.photo_url;
      if (photoFile) photoUrl = await uploadPhoto(photoFile);

      const name_en = joinFullName(form.first_name_en, form.last_name_en);
      const name_ar = joinFullName(form.first_name_ar, form.last_name_ar);
      const bike_type = form.bike_types.join(', ');

      const albumPhotos = [...form.album_photos];

      const bikeEntries: BikeEntry[] = form.bike_types.map((typ) => {
        const e = form.bike_entries.find((x) => x.type === typ) ?? { type: typ, brand: '', photos: [] };
        return { type: e.type, brand: e.brand, photos: [...e.photos] };
      });

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
        bike_entries: bikeEntries as unknown as Json,
        bike_photos: flattenBikePhotos(bikeEntries),
        album_photos: albumPhotos,
        motorbike_brand: summarizeMotorbikeBrand(bikeEntries),
        license_type: form.license_type,
        years_of_experience: form.years_of_experience,
        profit_ratio: form.profit_ratio,
        services: form.services,
        status: form.status,
        photo_url: photoUrl,
        language_levels: form.language_levels as unknown as Json,
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

      let pendingBikeChanged = false;
      for (const entry of bikeEntries) {
        const pend = pendingBikeByType[entry.type] || [];
        for (const { file } of pend) {
          entry.photos.push(await uploadTrainerBikeFile(trainerId, entry.type, file));
          pendingBikeChanged = true;
        }
      }

      for (const { file } of pendingAlbumImages) {
        albumPhotos.push(await uploadTrainerAlbumFile(trainerId, file));
      }

      if (pendingBikeChanged || pendingAlbumImages.length > 0) {
        const { error: upErr } = await supabase
          .from('trainers')
          .update({
            bike_entries: bikeEntries as unknown as Json,
            bike_photos: flattenBikePhotos(bikeEntries),
            motorbike_brand: summarizeMotorbikeBrand(bikeEntries),
            album_photos: albumPhotos,
          })
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
    },
    onSuccess: () => {
      Object.values(pendingBikeByType).forEach((list) => revokePendingList(list));
      setPendingBikeByType({});
      revokePendingList(pendingAlbumImages);
      setPendingAlbumImages([]);
      queryClient.invalidateQueries({ queryKey: ['admin-trainers'] });
      queryClient.invalidateQueries({ queryKey: ['training-trainer-counts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-trainer-courses-summary'] });
      queryClient.invalidateQueries({ queryKey: ['admin-training-students-by-pair'] });
      queryClient.invalidateQueries({ queryKey: ['trainer-profile-view'] });
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
      const { error } = await dbFrom('trainers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trainers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-trainer-courses-summary'] });
      queryClient.invalidateQueries({ queryKey: ['admin-training-students-by-pair'] });
      queryClient.invalidateQueries({ queryKey: ['trainer-student-counts'] });
      setDeleteId(null);
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
    },
    onError: () => toast.error(isRTL ? 'حدث خطأ' : 'An error occurred'),
  });

  const openAdd = () => {
    setEditingTrainer(null);
    setForm(defaultForm);
    setPhotoFile(null);
    setPhotoPreview(null);
    setPendingBikeByType((prev) => {
      Object.values(prev).forEach((list) => revokePendingList(list));
      return {};
    });
    setPendingAlbumImages((prev) => {
      revokePendingList(prev);
      return [];
    });
    setBikeTypeInput('');
    setAssignedTrainings([]);
    setTrainingDetails({});
    setIsOtherCity(false);
    setLanguageAddCode('');
    setLanguageAddLevel(LANGUAGE_LEVEL_OPTIONS[1]!.value);
    setFormOpen(true);
  };

  const openEdit = async (t: Trainer) => {
    setEditingTrainer(t);
    const ar = splitFullName(t.name_ar);
    const en = splitFullName(t.name_en);
    const bike_types = t.bike_type
      ? t.bike_type.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    let bike_entries = parseBikeEntries(t.bike_entries);
    if (bike_entries.length === 0 && bike_types.length > 0) {
      bike_entries = bike_types.map((typ, i) => ({
        type: typ,
        brand: i === 0 ? (t.motorbike_brand || '') : '',
        photos: i === 0 && Array.isArray(t.bike_photos) ? [...t.bike_photos] : [],
      }));
    }
    bike_entries = bike_types.map((typ) => bike_entries.find((e) => e.type === typ) ?? { type: typ, brand: '', photos: [] });
    setForm({
      ...defaultForm,
      first_name_ar: ar.first,
      last_name_ar: ar.last,
      first_name_en: en.first,
      last_name_en: en.last,
      phone: (t.phone ?? '').trim(),
      email: (t.email ?? '').trim(),
      bio_ar: t.bio_ar,
      bio_en: t.bio_en,
      country: t.country,
      city: t.city,
      bike_types,
      bike_entries,
      album_photos: Array.isArray(t.album_photos) ? [...t.album_photos] : [],
      license_type: t.license_type || '',
      years_of_experience: t.years_of_experience,
      profit_ratio: t.profit_ratio || 0,
      services: t.services || [],
      status: t.status as 'active' | 'inactive',
      photo_url: t.photo_url,
      language_levels: parseLanguageLevels(t.language_levels),
    });
    setLanguageAddCode('');
    setLanguageAddLevel(LANGUAGE_LEVEL_OPTIONS[1]!.value);
    setPendingBikeByType((prev) => {
      Object.values(prev).forEach((list) => revokePendingList(list));
      return {};
    });
    setPendingAlbumImages((prev) => {
      revokePendingList(prev);
      return [];
    });
    setBikeTypeInput('');
    setPhotoFile(null);
    setPhotoPreview(t.photo_url);
    const { data: courseRows } = await supabase
      .from('trainer_courses')
      .select('training_id, price, sessions_count, duration_hours, location, available_schedule, services')
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
          available_schedule: d.available_schedule,
          services: (d as { services?: string[] }).services ?? [],
        };
      }),
    );
    // Check if stored city is in the country's city list
    const countryEntry = COUNTRIES.find(c => c.code === t.country);
    const cityInList = countryEntry?.cities.some(c => c.en === t.city);
    setIsOtherCity(!!countryEntry && !cityInList && !!t.city);
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

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const addService = () => {
    if (serviceInput.trim()) {
      setForm(f => ({ ...f, services: [...f.services, serviceInput.trim()] }));
      setServiceInput('');
    }
  };

  const addTrainerLanguage = () => {
    if (!languageAddCode) {
      toast.error(isRTL ? 'اختر لغة' : 'Choose a language');
      return;
    }
    if (form.language_levels.some((x) => x.language === languageAddCode)) {
      toast.error(isRTL ? 'هذه اللغة مضافة بالفعل' : 'That language is already added');
      return;
    }
    setForm((f) => ({
      ...f,
      language_levels: [...f.language_levels, { language: languageAddCode, level: languageAddLevel }],
    }));
    setLanguageAddCode('');
  };

  const clearPendingForBikeType = (bikeType: string) => {
    setPendingBikeByType((pb) => {
      const list = pb[bikeType];
      if (list?.length) revokePendingList(list);
      const { [bikeType]: _, ...rest } = pb;
      return rest;
    });
  };

  const toggleBikeType = (type: string) => {
    const f = formRef.current;
    const removing = f.bike_types.includes(type);
    if (removing) clearPendingForBikeType(type);
    setForm((prev) => {
      const nextTypes = removing ? prev.bike_types.filter((t) => t !== type) : [...prev.bike_types, type];
      const nextEntries = nextTypes.map(
        (t) => prev.bike_entries.find((e) => e.type === t) ?? { type: t, brand: '', photos: [] },
      );
      return { ...prev, bike_types: nextTypes, bike_entries: nextEntries };
    });
  };

  const addCustomBikeType = () => {
    const v = bikeTypeInput.trim();
    if (!v) return;
    const f = formRef.current;
    if (f.bike_types.includes(v)) {
      setBikeTypeInput('');
      return;
    }
    setForm((prev) => ({
      ...prev,
      bike_types: [...prev.bike_types, v],
      bike_entries: [...prev.bike_entries, { type: v, brand: '', photos: [] }],
    }));
    setBikeTypeInput('');
  };

  const removeBikeTypeBadge = (bikeType: string) => {
    clearPendingForBikeType(bikeType);
    setForm((prev) => ({
      ...prev,
      bike_types: prev.bike_types.filter((x) => x !== bikeType),
      bike_entries: prev.bike_entries.filter((e) => e.type !== bikeType),
    }));
  };

  const setBikeEntryBrand = (bikeType: string, brand: string) => {
    setForm((f) => ({
      ...f,
      bike_entries: f.bike_entries.some((e) => e.type === bikeType)
        ? f.bike_entries.map((e) => (e.type === bikeType ? { ...e, brand } : e))
        : [...f.bike_entries, { type: bikeType, brand, photos: [] }],
    }));
  };

  const triggerBikePhotoPick = (bikeType: string) => {
    bikePhotoPickTypeRef.current = bikeType;
    bikePhotoFileRef.current?.click();
  };

  const addBikePhotoFilesForType = (bikeType: string, files: FileList | null) => {
    if (!files?.length || !bikeType) return;
    setPendingBikeByType((prev) => {
      const pending = prev[bikeType] || [];
      const entry = formRef.current.bike_entries.find((e) => e.type === bikeType);
      const urlCount = entry?.photos.length ?? 0;
      const next = [...pending];
      for (const file of Array.from(files)) {
        if (file.size > MAX_BIKE_PHOTO_BYTES) {
          toast.error(
            isRTL
              ? `الملف أكبر من ${MAX_BIKE_PHOTO_BYTES / (1024 * 1024)} ميجابايت`
              : `File exceeds ${MAX_BIKE_PHOTO_BYTES / (1024 * 1024)} MB`,
          );
          continue;
        }
        if (urlCount + next.length >= MAX_PHOTOS_PER_BIKE_ENTRY) {
          toast.error(
            isRTL
              ? `الحد الأقصى ${MAX_PHOTOS_PER_BIKE_ENTRY} صور لكل دراجة`
              : `Maximum ${MAX_PHOTOS_PER_BIKE_ENTRY} photos per bike`,
          );
          break;
        }
        next.push({ file, preview: URL.createObjectURL(file) });
      }
      return { ...prev, [bikeType]: next };
    });
    if (bikePhotoFileRef.current) bikePhotoFileRef.current.value = '';
  };

  const onBikePhotoFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const type = bikePhotoPickTypeRef.current;
    bikePhotoPickTypeRef.current = null;
    if (type) addBikePhotoFilesForType(type, e.target.files);
    e.target.value = '';
  };

  const removeBikePhotoUrlForType = (bikeType: string, url: string) => {
    setForm((f) => ({
      ...f,
      bike_entries: f.bike_entries.map((e) =>
        e.type === bikeType ? { ...e, photos: e.photos.filter((u) => u !== url) } : e,
      ),
    }));
  };

  const removePendingBikeAtForType = (bikeType: string, index: number) => {
    setPendingBikeByType((prev) => {
      const list = prev[bikeType] || [];
      const row = list[index];
      if (row) URL.revokeObjectURL(row.preview);
      const nextList = list.filter((_, i) => i !== index);
      const { [bikeType]: _, ...rest } = prev;
      return nextList.length ? { ...rest, [bikeType]: nextList } : rest;
    });
  };

  const addAlbumPhotoFiles = (files: FileList | null) => {
    if (!files?.length) return;
    setPendingAlbumImages((prev) => {
      const next = [...prev];
      for (const file of Array.from(files)) {
        if (file.size > MAX_ALBUM_PHOTO_BYTES) {
          toast.error(
            isRTL
              ? `الملف أكبر من ${MAX_ALBUM_PHOTO_BYTES / (1024 * 1024)} ميجابايت`
              : `File exceeds ${MAX_ALBUM_PHOTO_BYTES / (1024 * 1024)} MB`,
          );
          continue;
        }
        if (formRef.current.album_photos.length + next.length >= MAX_ALBUM_PHOTOS) {
          toast.error(isRTL ? `الحد الأقصى ${MAX_ALBUM_PHOTOS} صور` : `Maximum ${MAX_ALBUM_PHOTOS} album photos`);
          break;
        }
        next.push({ file, preview: URL.createObjectURL(file) });
      }
      return next;
    });
    if (albumPhotosInputRef.current) albumPhotosInputRef.current.value = '';
  };

  const removeAlbumPhotoUrl = (url: string) => {
    setForm((f) => ({ ...f, album_photos: f.album_photos.filter((u) => u !== url) }));
  };

  const removePendingAlbumAt = (index: number) => {
    setPendingAlbumImages((prev) => {
      const row = prev[index];
      if (row) URL.revokeObjectURL(row.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

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

    const f = formRef.current;
    setAssignedTrainings((prev) => {
      if (prev.some((a) => a.training_id === trainingId)) return prev;
      return [
        ...prev,
        {
          training_id: trainingId,
          price: 0,
          sessions_count: defSessions,
          duration_hours: defDur,
          location_country: f.country,
          location_city: f.city,
          available_schedule: {},
          services: [...f.services],
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

  const onSaveTrainer = () => {
    const v = validateAssignedTrainings();
    if (!v.ok) {
      toast.error(v.message);
      return;
    }
    saveMutation.mutate();
  };

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

          {/* Section: Photo & Basic Info */}
          <Card>
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{isRTL ? 'المعلومات الأساسية' : 'Basic Information'}</h3>

              {/* Photo Upload */}
              <div
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-4 p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
              >
                <Avatar className="h-16 w-16">
                  <AvatarImage src={photoPreview || ''} />
                  <AvatarFallback className="bg-primary/10 text-primary"><Upload className="w-6 h-6" /></AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{isRTL ? 'رفع صورة المدرب' : 'Upload trainer photo'}</p>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'اسحب أو انقر للرفع' : 'Drag or click to upload'}</p>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
              </div>

              {/* Photo album */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">{isRTL ? 'ألبوم الصور' : 'Photo album'}</Label>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? `حتى ${MAX_ALBUM_PHOTOS} صور، حتى ${MAX_ALBUM_PHOTO_BYTES / (1024 * 1024)} ميجابايت لكل صورة` : `Up to ${MAX_ALBUM_PHOTOS} images, ${MAX_ALBUM_PHOTO_BYTES / (1024 * 1024)} MB each`}
                </p>
                <div className="flex flex-wrap gap-2 items-start">
                  {form.album_photos.map((url) => (
                    <div key={url} className="relative w-20 h-20 rounded-md border border-border overflow-hidden shrink-0 group/thumb">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        className="absolute top-0.5 end-0.5 w-5 h-5 rounded-full bg-background/90 border text-xs flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                        onClick={() => removeAlbumPhotoUrl(url)}
                        aria-label={isRTL ? 'حذف' : 'Remove'}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {pendingAlbumImages.map((p, i) => (
                    <div key={p.preview} className="relative w-20 h-20 rounded-md border border-border overflow-hidden shrink-0 group/thumb">
                      <img src={p.preview} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        className="absolute top-0.5 end-0.5 w-5 h-5 rounded-full bg-background/90 border text-xs flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                        onClick={() => removePendingAlbumAt(i)}
                        aria-label={isRTL ? 'حذف' : 'Remove'}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => albumPhotosInputRef.current?.click()}
                    disabled={form.album_photos.length + pendingAlbumImages.length >= MAX_ALBUM_PHOTOS}
                    className="w-20 h-20 rounded-md border border-dashed border-muted-foreground/40 flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
                  >
                    <Images className="w-5 h-5" />
                    <span className="text-[10px]">{isRTL ? 'إضافة' : 'Add'}</span>
                  </button>
                  <input
                    ref={albumPhotosInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => addAlbumPhotoFiles(e.target.files)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isRTL ? 'الاسم الأول (عربي)' : 'First Name (AR)'}</Label>
                  <Input value={form.first_name_ar} onChange={(e) => setForm((f) => ({ ...f, first_name_ar: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? 'الاسم الأخير (عربي)' : 'Last Name (AR)'}</Label>
                  <Input value={form.last_name_ar} onChange={(e) => setForm((f) => ({ ...f, last_name_ar: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? 'الاسم الأول (إنجليزي)' : 'First Name (EN)'}</Label>
                  <Input
                    value={form.first_name_en}
                    onChange={(e) => setForm((f) => ({ ...f, first_name_en: e.target.value }))}
                    dir="ltr"
                    className={cn(
                      '[direction:ltr] [unicode-bidi:plaintext]',
                      isRTL ? 'text-right placeholder:text-right' : 'text-left placeholder:text-left',
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? 'الاسم الأخير (إنجليزي)' : 'Last Name (EN)'}</Label>
                  <Input
                    value={form.last_name_en}
                    onChange={(e) => setForm((f) => ({ ...f, last_name_en: e.target.value }))}
                    dir="ltr"
                    className={cn(
                      '[direction:ltr] [unicode-bidi:plaintext]',
                      isRTL ? 'text-right placeholder:text-right' : 'text-left placeholder:text-left',
                    )}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{isRTL ? 'رقم الجوال / الهاتف' : 'Phone number'}</Label>
                  <Input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder={isRTL ? '+9665xxxxxxxx' : '+9665xxxxxxxx'}
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    dir="ltr"
                    className={cn(
                      'font-mono text-sm [direction:ltr] [unicode-bidi:plaintext]',
                      isRTL ? 'text-right placeholder:text-right' : 'text-left placeholder:text-left',
                    )}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{isRTL ? 'البريد الإلكتروني' : 'Email'}</Label>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder={isRTL ? 'name@example.com' : 'name@example.com'}
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    dir="ltr"
                    className={cn(
                      '[direction:ltr] [unicode-bidi:plaintext]',
                      isRTL ? 'text-right placeholder:text-right' : 'text-left placeholder:text-left',
                    )}
                  />
                </div>
              </div>

              <BilingualInput labelEn="Bio" labelAr="السيرة" valueEn={form.bio_en} valueAr={form.bio_ar} onChangeEn={v => setForm(f => ({ ...f, bio_en: v }))} onChangeAr={v => setForm(f => ({ ...f, bio_ar: v }))} isTextarea rows={3} />
            </CardContent>
          </Card>

          {/* Section: Location & Specialization */}
          <Card>
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{isRTL ? 'الموقع والتخصص' : 'Location & Specialization'}</h3>
              <div dir={locationFieldDir} className="grid gap-4 md:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label className="block text-start">{isRTL ? 'الدولة' : 'Country'}</Label>
                  <Select
                    dir={locationFieldDir}
                    value={form.country}
                    onValueChange={(v) => setForm((f) => ({ ...f, country: v, city: '' }))}
                  >
                    <SelectTrigger dir={locationFieldDir}>
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
                </div>
                <div className="min-w-0 space-y-2">
                  <Label className="block text-start">{isRTL ? 'المدينة' : 'City'}</Label>
                  {(() => {
                    const selectedCountry = COUNTRIES.find((c) => c.code === form.country);
                    const cities = selectedCountry ? [...selectedCountry.cities, OTHER_OPTION] : [];
                    if (!selectedCountry) {
                      return (
                        <Input
                          dir={locationFieldDir}
                          className="text-start"
                          value={form.city}
                          onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                          placeholder={isRTL ? 'أدخل اسم المدينة' : 'Enter city name'}
                        />
                      );
                    }
                    const cityInList = cities.some((c) => c.en === form.city);
                    return (
                      <div className="space-y-2">
                        <Select
                          dir={locationFieldDir}
                          value={cityInList ? form.city : isOtherCity ? 'Other' : ''}
                          onValueChange={(v) => {
                            if (v === 'Other') {
                              setIsOtherCity(true);
                              setForm((f) => ({ ...f, city: '' }));
                            } else {
                              setIsOtherCity(false);
                              setForm((f) => ({ ...f, city: v }));
                            }
                          }}
                        >
                          <SelectTrigger dir={locationFieldDir}>
                            <SelectValue placeholder={isRTL ? 'اختر المدينة' : 'Select city'} />
                          </SelectTrigger>
                          <SelectContent dir={locationFieldDir}>
                            {cities.map((c) => (
                              <SelectItem key={c.en} value={c.en}>
                                {isRTL ? c.ar : c.en}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isOtherCity && (
                          <Input
                            dir={locationFieldDir}
                            className="text-start"
                            value={form.city}
                            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                            placeholder={isRTL ? 'أدخل اسم المدينة' : 'Enter city name'}
                          />
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="space-y-4 rounded-xl border border-border/70 bg-muted/10 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-semibold">{isRTL ? 'أنواع الدراجات وتفاصيلها' : 'Bike Types & Details'}</Label>
                  <Badge variant="outline" className="text-xs">
                    {form.bike_types.length} {isRTL ? 'مختار' : 'selected'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isRTL
                    ? 'اختر الأنواع التي يدرب عليها المدرب، ثم أضف الماركة والصور لكل نوع.'
                    : 'Choose trainer bike types first, then add brand and photos for each type.'}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {COMMON_BIKE_TYPES.map((type) => {
                    const active = form.bike_types.includes(type);
                    return (
                      <Button
                        key={type}
                        type="button"
                        variant={active ? 'default' : 'outline'}
                        className="h-auto py-2 px-3 text-xs sm:text-sm justify-start"
                        onClick={() => toggleBikeType(type)}
                      >
                        {bikeTypeDisplayLabel(type, isRTL)}
                      </Button>
                    );
                  })}
                </div>

                <div className="flex gap-2 max-w-md">
                  <Input
                    value={bikeTypeInput}
                    onChange={(e) => setBikeTypeInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomBikeType())}
                    placeholder={isRTL ? 'أضف نوعًا مخصصًا...' : 'Add custom bike type...'}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={addCustomBikeType}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {form.bike_types.map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1 px-3 py-1.5">
                      {bikeTypeDisplayLabel(t, isRTL)}
                      <X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => removeBikeTypeBadge(t)} />
                    </Badge>
                  ))}
                  {form.bike_types.length === 0 && (
                    <p className="text-xs text-muted-foreground">{isRTL ? 'لم يتم اختيار نوع بعد' : 'No bike types selected'}</p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">{isRTL ? 'تفاصيل كل دراجة' : 'Per-bike details'}</Label>
                <p className="text-xs text-muted-foreground">
                  {isRTL
                    ? `ماركة وصور لكل نوع. حتى ${MAX_PHOTOS_PER_BIKE_ENTRY} صور لكل نوع، حتى ${MAX_BIKE_PHOTO_BYTES / (1024 * 1024)} ميجابايت لكل صورة`
                    : `Brand and photos per bike type. Up to ${MAX_PHOTOS_PER_BIKE_ENTRY} images per type, ${MAX_BIKE_PHOTO_BYTES / (1024 * 1024)} MB each`}
                </p>
                <input
                  ref={bikePhotoFileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={onBikePhotoFileInputChange}
                />
                  {form.bike_types.length === 0 ? (
                    <p className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
                      {isRTL ? 'اختر أنواع الدراجات أعلاه لإضافة التفاصيل' : 'Select bike types above to add brand and photos'}
                    </p>
                  ) : (
                    <div className="space-y-4">
                    {form.bike_types.map((bikeType) => {
                      const entry =
                        form.bike_entries.find((e) => e.type === bikeType) ?? { type: bikeType, brand: '', photos: [] };
                      const pending = pendingBikeByType[bikeType] || [];
                      const totalPhotos = entry.photos.length + pending.length;
                      return (
                        <div key={bikeType} dir={isRTL ? 'rtl' : 'ltr'}>
                          <Card className="border-border/80 shadow-sm">
                            <CardHeader className="py-3 px-4 space-y-0">
                              <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Bike className="w-4 h-4 text-muted-foreground shrink-0" />
                                {bikeTypeDisplayLabel(bikeType, isRTL)}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 pt-0 px-4 pb-4">
                              <div className="min-w-0 space-y-2">
                                <Label className="block w-full text-start text-xs">
                                  {isRTL ? 'الماركة والطراز' : 'Brand & Model'}
                                </Label>
                                {/* Isolate LTR so English brand/model is not affected by card RTL */}
                                <div
                                  dir="ltr"
                                  lang="en"
                                  className="min-w-0"
                                  style={{ unicodeBidi: 'isolate' }}
                                >
                                  <Input
                                    dir="ltr"
                                    lang="en"
                                    spellCheck={false}
                                    autoComplete="off"
                                    value={entry.brand}
                                    onChange={(e) => setBikeEntryBrand(bikeType, e.target.value)}
                                    placeholder="e.g. Yamaha R1 2023"
                                    className={cn(
                                      'w-full [direction:ltr] [unicode-bidi:plaintext]',
                                      isRTL ? 'text-right placeholder:text-right' : 'text-left placeholder:text-left',
                                    )}
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">{isRTL ? 'صور هذه الدراجة' : 'Photos for this bike'}</Label>
                                <div className="flex flex-wrap gap-2 items-start">
                                {entry.photos.map((url) => (
                                  <div
                                    key={url}
                                    className="relative w-20 h-20 rounded-md border border-border overflow-hidden shrink-0 group/bthumb"
                                  >
                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                    <button
                                      type="button"
                                      className="absolute top-0.5 end-0.5 w-5 h-5 rounded-full bg-background/90 border text-xs flex items-center justify-center opacity-0 group-hover/bthumb:opacity-100 transition-opacity"
                                      onClick={() => removeBikePhotoUrlForType(bikeType, url)}
                                      aria-label={isRTL ? 'حذف' : 'Remove'}
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                                {pending.map((p, i) => (
                                  <div
                                    key={p.preview}
                                    className="relative w-20 h-20 rounded-md border border-border overflow-hidden shrink-0 group/bthumb"
                                  >
                                    <img src={p.preview} alt="" className="w-full h-full object-cover" />
                                    <button
                                      type="button"
                                      className="absolute top-0.5 end-0.5 w-5 h-5 rounded-full bg-background/90 border text-xs flex items-center justify-center opacity-0 group-hover/bthumb:opacity-100 transition-opacity"
                                      onClick={() => removePendingBikeAtForType(bikeType, i)}
                                      aria-label={isRTL ? 'حذف' : 'Remove'}
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => triggerBikePhotoPick(bikeType)}
                                  disabled={totalPhotos >= MAX_PHOTOS_PER_BIKE_ENTRY}
                                  className="w-20 h-20 rounded-md border border-dashed border-muted-foreground/40 flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
                                >
                                  <Camera className="w-5 h-5" />
                                  <span className="text-[10px]">{isRTL ? 'إضافة' : 'Add'}</span>
                                </button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{isRTL ? 'نوع الرخصة' : 'License Type'}</Label>
                  <Input value={form.license_type} onChange={e => setForm(f => ({ ...f, license_type: e.target.value }))} placeholder={isRTL ? 'مثال: A2' : 'e.g. A2'} />
                </div>
                <div className="space-y-2"><Label>{isRTL ? 'سنوات الخبرة' : 'Years of Experience'}</Label><Input type="number" value={form.years_of_experience} onChange={e => setForm(f => ({ ...f, years_of_experience: parseInt(e.target.value) || 0 }))} /></div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <Label className="text-sm font-medium">{isRTL ? 'الحالة' : 'Status'}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{isRTL ? 'تفعيل أو تعطيل هذا المدرب' : 'Enable or disable this trainer'}</p>
                </div>
                <Switch checked={form.status === 'active'} onCheckedChange={v => setForm(f => ({ ...f, status: v ? 'active' : 'inactive' }))} />
              </div>
            </CardContent>
          </Card>

          {/* Section: Languages & proficiency */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                <Languages className="h-4 w-4 shrink-0" aria-hidden />
                {isRTL ? 'اللغات والمستوى' : 'Languages & level'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isRTL
                  ? 'أضف كل لغة يتحدثها المدرب واختر مستوى الإتقان لكل لغة.'
                  : 'Add each language the trainer speaks and set proficiency for every language.'}
              </p>

              <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="min-w-0 flex-[1.2] space-y-1.5 sm:min-w-[12rem]">
                  <Label className="text-xs">{isRTL ? 'لغة' : 'Language'}</Label>
                  <Select
                    dir={locationFieldDir}
                    value={languageAddCode || '__none__'}
                    onValueChange={(v) => setLanguageAddCode(v === '__none__' ? '' : v)}
                  >
                    <SelectTrigger dir={locationFieldDir} className="h-9 w-full">
                      <SelectValue placeholder={isRTL ? 'اختر لغة' : 'Select language'} />
                    </SelectTrigger>
                    <SelectContent dir={locationFieldDir}>
                      <SelectItem value="__none__">{isRTL ? '— اختر —' : '— Select —'}</SelectItem>
                      {TRAINER_LANGUAGE_OPTIONS.filter(
                        (opt) => !form.language_levels.some((e) => e.language === opt.code),
                      ).map((opt) => (
                        <SelectItem key={opt.code} value={opt.code}>
                          {isRTL ? opt.label_ar : opt.label_en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5 sm:min-w-[12rem]">
                  <Label className="text-xs">{isRTL ? 'المستوى' : 'Level'}</Label>
                  <Select dir={locationFieldDir} value={languageAddLevel} onValueChange={setLanguageAddLevel}>
                    <SelectTrigger dir={locationFieldDir} className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent dir={locationFieldDir}>
                      {LANGUAGE_LEVEL_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {isRTL ? opt.label_ar : opt.label_en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 gap-1 shrink-0 sm:min-w-[7.5rem]"
                  onClick={addTrainerLanguage}
                  disabled={!languageAddCode}
                >
                  <Plus className="h-4 w-4" />
                  {isRTL ? 'إضافة' : 'Add'}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-muted-foreground">{isRTL ? 'إضافة سريعة:' : 'Quick add:'}</span>
                {TRAINER_LANGUAGE_OPTIONS.filter(
                  (opt) =>
                    ['ar', 'en', 'ur'].includes(opt.code) &&
                    !form.language_levels.some((e) => e.language === opt.code),
                ).map((opt) => (
                  <Button
                    key={opt.code}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        language_levels: [...f.language_levels, { language: opt.code, level: languageAddLevel }],
                      }))
                    }
                  >
                    {isRTL ? opt.label_ar : opt.label_en}
                  </Button>
                ))}
              </div>

              <div className="space-y-2">
                {form.language_levels.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{isRTL ? 'لم تُضف لغات بعد' : 'No languages added yet'}</p>
                ) : (
                  <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
                    {form.language_levels.map((row, i) => {
                      const levelVal = LANGUAGE_LEVEL_OPTIONS.some((x) => x.value === row.level) ? row.level : LANGUAGE_LEVEL_OPTIONS[4]!.value;
                      return (
                        <li key={`${row.language}-${i}`} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-sm font-medium">{languageOptionLabel(row.language, isRTL)}</span>
                          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            <Select
                              value={levelVal}
                              onValueChange={(v) =>
                                setForm((f) => ({
                                  ...f,
                                  language_levels: f.language_levels.map((e, idx) => (idx === i ? { ...e, level: v } : e)),
                                }))
                              }
                            >
                              <SelectTrigger className="h-9 w-full min-w-[10rem] sm:w-[14rem]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {LANGUAGE_LEVEL_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {isRTL ? opt.label_ar : opt.label_en}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  language_levels: f.language_levels.filter((_, idx) => idx !== i),
                                }))
                              }
                              aria-label={isRTL ? 'إزالة اللغة' : 'Remove language'}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section: Services */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{isRTL ? 'الخدمات' : 'Services'}</h3>
              <div className="flex gap-2">
                <Input value={serviceInput} onChange={e => setServiceInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addService())} placeholder={isRTL ? 'أضف خدمة...' : 'Add service...'} className="flex-1" />
                <Button type="button" variant="outline" size="icon" onClick={addService}><Plus className="w-4 h-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.services.map((s, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 px-3 py-1.5">
                    {s}
                    <X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => setForm(f => ({ ...f, services: f.services.filter((_, idx) => idx !== i) }))} />
                  </Badge>
                ))}
                {form.services.length === 0 && <p className="text-xs text-muted-foreground">{isRTL ? 'لم تتم إضافة خدمات بعد' : 'No services added yet'}</p>}
              </div>
            </CardContent>
          </Card>

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
                                  const defaultSessions = td
                                    ? td.default_sessions_count
                                    : Math.max(1, Number(meta?.default_sessions_count ?? assignment.sessions_count ?? 1));
                                  const defaultDur = td
                                    ? td.default_session_duration_hours
                                    : Math.max(0.25, Number(meta?.default_session_duration_hours ?? assignment.duration_hours ?? 2));
                                  const curriculum = parseTrainingSessions(td?.sessions ?? meta?.sessions);
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
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Timer className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                          <span className="text-xs text-muted-foreground">
                                            {isRTL ? 'مدة كل جلسة' : 'Per session'}
                                          </span>
                                          <span className="font-semibold tabular-nums">
                                            {defaultDur}
                                            {isRTL ? ' ساعة' : ' hrs'}
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

                                <div className="space-y-1">
                                  <Label className="text-xs text-start">
                                    {isRTL ? 'سعر المدرب الأساسي (ر.س)' : 'Trainer base price (SAR)'}
                                  </Label>
                                  <p className="text-[10px] text-muted-foreground leading-snug">
                                    {isRTL
                                      ? 'ما يستحقه المدرب؛ عمولة المنصة تُضاف من إعدادات التدريبات.'
                                      : 'Amount the trainer keeps; Bikerz commission is added in Trainings admin.'}
                                  </p>
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
                                </div>

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
                                      <div className="min-w-0 space-y-1">
                                        <Label className="block text-xs text-start">{isRTL ? 'الدولة' : 'Country'}</Label>
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
                                      </div>
                                      <div className="min-w-0 space-y-1">
                                        <Label className="block text-xs text-start">{isRTL ? 'المدينة' : 'City'}</Label>
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
                                      </div>
                                    </div>
                                  );
                                })()}

                                <div className="space-y-2">
                                  <Label className="text-xs text-start">{isRTL ? 'الخدمات' : 'Services'}</Label>
                                  {form.services.length === 0 ? (
                                    <p className="text-xs text-muted-foreground text-start">
                                      {isRTL ? 'أضف خدمات للمدرب في القسم أعلاه' : 'Add trainer services in the section above.'}
                                    </p>
                                  ) : (
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                      {form.services.map((svc) => (
                                        <label
                                          key={svc}
                                          className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-background/60 px-2 py-1.5 text-xs"
                                        >
                                          <Checkbox
                                            checked={assignment.services.includes(svc)}
                                            onCheckedChange={(checked) => {
                                              const next =
                                                checked === true
                                                  ? [...assignment.services, svc].filter((x, i, a) => a.indexOf(x) === i)
                                                  : assignment.services.filter((s) => s !== svc);
                                              updateAssignment(training.id, 'services', next);
                                            }}
                                          />
                                          <span className="truncate text-start">{svc}</span>
                                        </label>
                                      ))}
                                    </div>
                                  )}
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{isRTL ? 'إدارة المدربين' : 'Trainers Management'}</h1>
            <p className="text-sm text-muted-foreground">{isRTL ? 'إدارة جميع المدربين' : 'Manage all trainers'}</p>
          </div>
          <Button onClick={openAdd} size="sm"><Plus className="w-4 h-4 me-2" />{isRTL ? 'إضافة مدرب' : 'Add Trainer'}</Button>
        </div>

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
