import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BikeGarage } from '@/components/ui/profile/BikeGarage';
import type { BikeEntry as ProfileBikeEntry } from '@/hooks/useUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Star, MapPin, BookOpen, Plus, Images, Pencil, CalendarDays, Users, Wallet, CreditCard, Bike, CheckCircle2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { TrainerScheduleManager } from '@/components/admin/trainer/TrainerScheduleManager';
import { TrainerBookingsManager } from '@/components/admin/trainer/TrainerBookingsManager';
import { format, isValid } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { COUNTRIES } from '@/data/countryCityData';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ProfileSectionTitle,
  TrainerCourseEditDialog,
  TrainingCourseAccordionRow,
  type TrainerCourseRow,
  type TrainingStudentRow,
  type TrainerReviewRow,
} from '@/components/admin/trainerProfileTrainingBlocks';
import { TrainerAdminPaymentsSection } from '@/components/admin/trainer/TrainerAdminPaymentsSection';
import { AddTrainingForTrainerDialog } from '@/components/admin/trainer/AddTrainingForTrainerDialog';
import { TrainerAddTrainingPage } from '@/components/trainer/TrainerAddTrainingPage';
import { useSearchParams } from 'react-router-dom';
import { uploadTrainerAlbumFile } from '@/lib/trainer-uploads';
import { MAX_ALBUM_PHOTOS, validateAlbumPhotoFile } from '@/lib/trainer-form-validation';
import { Upload, Trash2 } from 'lucide-react';
import BookingTimeDisplay from '@/components/common/BookingTimeDisplay';
import { normalizeBookingSessions } from '@/lib/trainingBookingSessions';
import { getNextSession } from '@/lib/bookingTime';

type BikeEntryRow = { type: string; brand: string; photos: string[] };

type TrainerTrainingBookingRow = {
  id: string;
  trainer_course_id: string | null;
  training_id: string;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  sessions: unknown;
  amount: number | string | null;
  currency: string | null;
  status: string;
  payment_status: string;
  full_name: string;
  phone: string;
  email: string;
  created_at: string | null;
};

type UpcomingTrainerBooking = TrainerTrainingBookingRow & {
  bookingAtMs: number;
};

function parseBikeEntriesProfile(raw: unknown): BikeEntryRow[] {
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

const EmptyField: React.FC<{ isRTL: boolean }> = ({ isRTL }) => (
  <span
    className={cn(
      'inline-flex max-w-full items-center rounded-md bg-muted/40 px-2 py-1 text-[11px] font-medium text-muted-foreground',
      isRTL ? 'text-right' : 'text-left',
    )}
    dir={isRTL ? 'rtl' : 'ltr'}
    lang={isRTL ? 'ar' : 'en'}
  >
    {isRTL ? 'سيتم إضافته لاحقًا' : 'Will be added later'}
  </span>
);

interface Trainer {
  id: string;
  name_ar: string;
  name_en: string;
  photo_url: string | null;
  bio_ar: string;
  bio_en: string;
  country: string;
  city: string;
  bike_type: string;
  bike_entries?: unknown;
  bike_photos?: string[] | null;
  album_photos?: string[] | null;
  motorbike_brand?: string | null;
  license_type?: string | null;
  years_of_experience: number;
  services: string[] | null;
  status: string;
  created_at: string;
  profit_ratio: number;
}

export interface TrainerProfileViewProps {
  trainerId: string;
  onEdit?: (trainer: Trainer) => void;
  /** Use `self` when the signed-in trainer views their own row (schedule/bookings/payments RLS). */
  managerMode?: 'admin' | 'self';
}

const UnlinkedReviews: React.FC<{ reviews: TrainerReviewRow[]; isRTL: boolean }> = ({ reviews, isRTL }) => {
  const unlinked = reviews.filter((r) => !r.training_id);
  if (unlinked.length === 0) return null;
  return (
    <section className="space-y-3 border-t border-border/40 pt-6">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="h-0.5 w-8 shrink-0 rounded bg-primary" aria-hidden />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {isRTL ? 'تقييمات عامة (غير مرتبطة بتدريب)' : 'General reviews (not linked to a training)'}{' '}
          <span className="font-normal tabular-nums normal-case">({unlinked.length})</span>
        </p>
      </div>
      <div className="max-h-[min(48vh,400px)] space-y-0 divide-y divide-border/40 overflow-y-auto overscroll-y-contain pe-1">
        {unlinked.map((r) => (
          <div key={r.id} className="py-3 first:pt-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{r.student_name}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums" dir="ltr">
                {format(new Date(r.created_at), 'yyyy-MM-dd')}
              </span>
            </div>
            <div className="mt-1 flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn('h-4 w-4', i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/25')}
                />
              ))}
            </div>
            {r.comment ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{r.comment}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
};

export const TrainerProfileView: React.FC<TrainerProfileViewProps> = ({ trainerId, onEdit, managerMode = 'admin' }) => {
  const { isRTL } = useLanguage();
  const fieldDir = isRTL ? 'rtl' : 'ltr';
  const queryClient = useQueryClient();
  const isSelfMode = managerMode === 'self';
  const [searchParams, setSearchParams] = useSearchParams();
  const isAddingTraining = searchParams.get('action') === 'add';
  const openAddTrainingChildPage = () => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('action', 'add');
      return p;
    });
  };
  const closeAddTrainingChildPage = () => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('action');
      return p;
    }, { replace: true });
  };
  const [addTrainingOpen, setAddTrainingOpen] = useState(false);
  // Self-mode trainers always go through the child page; only admin uses the dialog
  const handleAddTrainingClick = () => {
    if (isSelfMode) {
      setProfileTab('trainings');
      openAddTrainingChildPage();
    } else {
      setAddTrainingOpen(true);
    }
  };
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState('personal');
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [savingBikes, setSavingBikes] = useState(false);
  const albumInputRef = useRef<HTMLInputElement>(null);
  const [albumUploading, setAlbumUploading] = useState(false);
  const [editCourse, setEditCourse] = useState<TrainerCourseRow | null>(null);

  const {
    data: t,
    isLoading: loadingTrainer,
    isError: trainerError,
  } = useQuery({
    queryKey: ['trainer-profile-view', trainerId],
    queryFn: async () => {
      const { data, error } = await supabase.from('trainers').select('*').eq('id', trainerId).single();
      if (error) throw error;
      return data as Trainer;
    },
    enabled: !!trainerId,
  });

  const { data: students, isLoading: loadingStudents } = useQuery({
    queryKey: ['trainer-profile-students', trainerId],
    queryFn: async () => {
      const { data } = await supabase.from('training_students').select('*').eq('trainer_id', trainerId).order('enrolled_at', { ascending: false });
      return data || [];
    },
    enabled: !!trainerId,
  });

  const { data: reviews, isLoading: loadingReviews } = useQuery({
    queryKey: ['trainer-profile-reviews', trainerId],
    queryFn: async () => {
      const { data } = await supabase.from('trainer_reviews').select('*').eq('trainer_id', trainerId).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!trainerId,
  });

  const { data: trainerCourses, isLoading: loadingCourses } = useQuery({
    queryKey: ['trainer-profile-courses', trainerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('trainer_courses')
        .select('id, trainer_id, training_id, price, sessions_count, duration_hours, location, location_detail, trainings(name_ar, name_en)')
        .eq('trainer_id', trainerId);
      return (data || []) as TrainerCourseRow[];
    },
    enabled: !!trainerId,
  });

  const { data: trainerBookings, isLoading: loadingTrainerBookings } = useQuery({
    queryKey: ['trainer-profile-bookings', trainerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_bookings')
        .select(
          'id, trainer_course_id, training_id, booking_date, start_time, end_time, sessions, amount, currency, status, payment_status, full_name, phone, email, created_at',
        )
        .eq('trainer_id', trainerId)
        .order('booking_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as TrainerTrainingBookingRow[];
    },
    enabled: !!trainerId,
  });

  // Trainer's linked auth user (used to read/write the personal profile garage)
  const trainerUserId = (t as unknown as { user_id?: string | null } | undefined)?.user_id ?? null;

  // Read avatar_url + bike_entries from the user's personal profile (`profiles` table) —
  // these are the canonical source for both the apply/edit flows and the trainer dashboard.
  const { data: profileSync } = useQuery({
    queryKey: ['trainer-profile-sync', trainerUserId],
    queryFn: async () => {
      if (!trainerUserId) return { avatar_url: null as string | null, bike_entries: [] as unknown[] };
      const { data } = await (supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { avatar_url?: string | null; bike_entries?: unknown } | null }> };
          };
        };
      })
        .from('profiles')
        .select('avatar_url, bike_entries')
        .eq('user_id', trainerUserId)
        .maybeSingle();
      return {
        avatar_url: typeof data?.avatar_url === 'string' ? data.avatar_url : null,
        bike_entries: Array.isArray(data?.bike_entries) ? (data!.bike_entries as unknown[]) : [],
      };
    },
    enabled: !!trainerUserId,
  });
  const profileBikeEntries = profileSync?.bike_entries;
  const profileAvatarUrl = profileSync?.avatar_url ?? null;

  useEffect(() => {
    if (!expandedCourseId || !trainerCourses) return;
    if (!trainerCourses.some((c) => c.id === expandedCourseId)) setExpandedCourseId(null);
  }, [expandedCourseId, trainerCourses]);

  const revenueSar = useMemo(() => {
    const rows = (trainerBookings || []) as TrainerTrainingBookingRow[];
    return rows
      .filter((b) => String(b.payment_status).toLowerCase() === 'paid' && String(b.status).toLowerCase() !== 'cancelled')
      .reduce((acc, b) => acc + Number(b.amount || 0), 0);
  }, [trainerBookings]);

  const upcomingBookings = useMemo<UpcomingTrainerBooking[]>(() => {
    const nowMs = Date.now();
    const rows = (trainerBookings || []) as TrainerTrainingBookingRow[];

    return rows
      .filter((b) => String(b.status).toLowerCase() !== 'cancelled' && String(b.status).toLowerCase() !== 'completed')
      .map((b) => {
        const ns = normalizeBookingSessions(b.sessions, b.booking_date, b.start_time, b.end_time, b.status);
        const next = getNextSession(ns);
        if (!next) return null;
        const atMs = new Date(`${next.date}T${next.start_time}`).getTime();
        if (!Number.isFinite(atMs) || atMs < nowMs) return null;
        return { ...b, bookingAtMs: atMs };
      })
      .filter((x): x is UpcomingTrainerBooking => x != null)
      .sort((a, b) => a.bookingAtMs - b.bookingAtMs)
      .slice(0, 6);
  }, [trainerBookings]);

  const garageEntries: ProfileBikeEntry[] = useMemo(() => {
    const source: unknown[] = Array.isArray(profileBikeEntries) && profileBikeEntries.length > 0
      ? profileBikeEntries
      : (Array.isArray(t?.bike_entries) ? (t.bike_entries as unknown[]) : []);
    return source.map((rawUnknown) => {
      const raw = rawUnknown as Record<string, unknown>;
      return {
        id: String(raw.id ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString())),
        type_id: raw.type_id != null ? String(raw.type_id) : null,
        type_name: String(raw.type_name ?? raw.type ?? ''),
        subtype_id: raw.subtype_id != null ? String(raw.subtype_id) : null,
        subtype_name: String(raw.subtype_name ?? ''),
        brand: String(raw.brand ?? ''),
        model: String(raw.model ?? ''),
        is_custom_type: Boolean(raw.is_custom_type ?? false),
        is_custom_brand: Boolean(raw.is_custom_brand ?? false),
        photos: Array.isArray(raw.photos) ? (raw.photos as unknown[]).map(String) : [],
      };
    });
  }, [profileBikeEntries, t?.bike_entries]);

  if (!trainerId) return null;

  if (loadingTrainer) {
    return (
      <div className="space-y-3 py-2" dir={fieldDir}>
        <Skeleton className="h-20 w-full max-w-md rounded-md" />
        <Skeleton className="h-4 w-full max-w-none rounded-md" />
        <Skeleton className="h-4 w-[72%] max-w-none rounded-md" />
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-[60%] max-w-none rounded-md" />
      </div>
    );
  }

  if (trainerError || !t) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground" dir={fieldDir}>
        {isRTL ? 'تعذر تحميل بيانات المدرب.' : 'Could not load trainer.'}
      </div>
    );
  }

  const handleBikesChange = async (next: ProfileBikeEntry[]) => {
    if (!isSelfMode || !trainerUserId) return;
    setSavingBikes(true);
    try {
      // Write to the same place the user's personal profile reads from (`profiles` table)
      const { error } = await (supabase as unknown as {
        from: (table: string) => { update: (v: unknown) => { eq: (k: string, v: string) => Promise<{ error: unknown }> } };
      })
        .from('profiles')
        .update({
          bike_entries: next,
          bike_brand: next[0]?.brand || null,
          bike_model: next[0]?.model || null,
        })
        .eq('user_id', trainerUserId);
      if (error) throw error;
      void queryClient.invalidateQueries({ queryKey: ['trainer-profile-sync', trainerUserId] });
      void queryClient.invalidateQueries({ queryKey: ['trainer-profile-view', trainerId] });
      toast.success(isRTL ? 'تم تحديث الجراج' : 'Garage updated');
    } catch {
      toast.error(isRTL ? 'فشل التحديث' : 'Update failed');
    } finally {
      setSavingBikes(false);
    }
  };

  const albumPhotos = Array.isArray(t.album_photos) ? t.album_photos.filter(Boolean) : [];

  const persistAlbum = async (next: string[]) => {
    const { error } = await (supabase as unknown as {
      from: (table: string) => {
        update: (v: unknown) => { eq: (k: string, v: string) => Promise<{ error: unknown }> };
      };
    })
      .from('trainers')
      .update({ album_photos: next })
      .eq('id', t.id);
    if (error) throw error;
    void queryClient.invalidateQueries({ queryKey: ['trainer-profile-view', trainerId] });
  };

  const handleAlbumPick = async (files: FileList | null) => {
    if (!isSelfMode || !files?.length) return;
    const slotsLeft = MAX_ALBUM_PHOTOS - albumPhotos.length;
    if (slotsLeft <= 0) {
      toast.error(isRTL ? `الحد الأقصى ${MAX_ALBUM_PHOTOS} صور` : `Maximum ${MAX_ALBUM_PHOTOS} photos`);
      return;
    }
    const arr = Array.from(files).slice(0, slotsLeft);
    setAlbumUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of arr) {
        const chk = validateAlbumPhotoFile(file, isRTL);
        if (!chk.ok) {
          const msg = 'errors' in chk && chk.errors.general ? chk.errors.general : isRTL ? 'ملف غير صالح' : 'Invalid file';
          toast.error(msg);
          continue;
        }
        try {
          const url = await uploadTrainerAlbumFile(t.id, file);
          uploaded.push(url);
        } catch {
          toast.error(isRTL ? 'فشل رفع الصورة' : 'Upload failed');
        }
      }
      if (uploaded.length === 0) return;
      const next = [...albumPhotos, ...uploaded];
      await persistAlbum(next);
      toast.success(isRTL ? 'تم إضافة الصور' : 'Photos added');
    } finally {
      setAlbumUploading(false);
      if (albumInputRef.current) albumInputRef.current.value = '';
    }
  };

  const handleAlbumRemove = async (url: string) => {
    if (!isSelfMode) return;
    try {
      const next = albumPhotos.filter((u) => u !== url);
      await persistAlbum(next);
      // Best-effort: also remove from storage
      const path = url.split('/trainer-photos/')[1]?.split('?')[0];
      if (path) {
        await (supabase as unknown as {
          storage: { from: (b: string) => { remove: (p: string[]) => Promise<unknown> } };
        }).storage.from('trainer-photos').remove([path]);
      }
      toast.success(isRTL ? 'تم حذف الصورة' : 'Photo removed');
    } catch {
      toast.error(isRTL ? 'فشل حذف الصورة' : 'Failed to remove');
    }
  };

  const servicesList = Array.isArray(t.services) ? t.services.filter((s) => String(s).trim()) : [];
  const countryEntryLoc = COUNTRIES.find(
    (c) => c.code === t.country || c.en === t.country || c.ar === t.country,
  );
  const displayCountryOnly = countryEntryLoc ? (isRTL ? countryEntryLoc.ar : countryEntryLoc.en) : (t.country || '').trim();
  const cityEntry = countryEntryLoc?.cities.find((c) => c.en === t.city || c.ar === t.city);
  const displayCityOnly = cityEntry ? (isRTL ? cityEntry.ar : cityEntry.en) : (t.city || '').trim();

  const reviewRows = (reviews ?? []) as TrainerReviewRow[];
  const avgAll =
    reviewRows.length > 0 ? (reviewRows.reduce((a, r) => a + r.rating, 0) / reviewRows.length).toFixed(1) : null;
  const isLoading = loadingStudents || loadingReviews || loadingCourses || loadingTrainerBookings;

  const joinedAt = t.created_at != null ? new Date(t.created_at) : null;
  const joinedDateLabel =
    joinedAt && isValid(joinedAt)
      ? format(joinedAt, isRTL ? 'd MMMM yyyy' : 'MMMM d, yyyy', { locale: isRTL ? arSA : enUS })
      : null;
  const joinedDateLabelAr =
    joinedAt && isValid(joinedAt) ? format(joinedAt, 'd MMMM yyyy', { locale: arSA }) : null;

  const displayCountryAr = countryEntryLoc?.ar ?? (t.country || '').trim();
  const displayCityAr = cityEntry?.ar ?? (t.city || '').trim();
  const locationLineAr = [displayCityAr, displayCountryAr].filter(Boolean).join('، ');

  const headerLocationLine = [displayCityOnly, displayCountryOnly].filter(Boolean).join(isRTL ? '، ' : ', ');
  const trainingNameById = new Map(
    ((trainerCourses || []) as TrainerCourseRow[]).map((tc) => [
      tc.training_id,
      isRTL ? tc.trainings?.name_ar || '—' : tc.trainings?.name_en || '—',
    ]),
  );

  const textOrEmpty = (value: string | null | undefined) => {
    const s = (value ?? '').trim();
    return s ? <span className="text-sm font-medium">{s}</span> : <EmptyField isRTL={isRTL} />;
  };

  return (
    <>
      <div className="w-full min-w-0 overflow-x-hidden pb-10" dir={fieldDir}>


        <h1 className="sr-only">{isRTL ? 'لوحة المدرب' : 'Trainer dashboard'}</h1>

        <div className="w-full min-w-0 space-y-6">
            <section
              className={cn(
                'overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/[0.06] via-muted/20 to-background shadow-sm',
                'ring-1 ring-black/[0.03] dark:ring-white/[0.06]',
              )}
            >
              <div className="flex flex-col gap-5 p-4 sm:p-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
                <div className="flex min-w-0 flex-1 items-start gap-4 sm:gap-5">
                  <div className="relative shrink-0">
                    <div
                      className="absolute -inset-0.5 rounded-full bg-gradient-to-br from-primary/40 to-primary/5 opacity-80 blur-[1px]"
                      aria-hidden
                    />
                    <Avatar className="relative h-[4.5rem] w-[4.5rem] border-2 border-background shadow-md sm:h-[5.75rem] sm:w-[5.75rem]">
                      <AvatarImage src={profileAvatarUrl || t.photo_url || ''} className="object-cover" />
                      <AvatarFallback className="bg-primary/15 text-2xl font-bold text-primary sm:text-3xl">
                        {(t.name_en || t.name_ar || '?').trim().charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <h2
                        className="text-2xl font-black leading-tight tracking-tight text-foreground sm:text-3xl"
                        lang={isRTL ? 'ar' : 'en'}
                      >
                        {isRTL ? t.name_ar : t.name_en}
                      </h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={cn(
                          'h-7 gap-1.5 border px-2.5 font-medium',
                          t.status === 'active'
                            ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : 'border-border bg-muted text-muted-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'h-2 w-2 shrink-0 rounded-full',
                            t.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground/50',
                          )}
                          aria-hidden
                        />
                        {t.status === 'active' ? (isRTL ? 'نشط' : 'Active') : isRTL ? 'غير نشط' : 'Inactive'}
                      </Badge>
                      {typeof t.years_of_experience === 'number' ? (
                        <Badge variant="outline" className="h-7 gap-1 border-border/80 bg-background/80 px-2.5 font-normal tabular-nums">
                          <CalendarDays className="h-3.5 w-3.5 opacity-70" aria-hidden />
                          {isRTL
                            ? `${t.years_of_experience} ${t.years_of_experience === 1 ? 'سنة خبرة' : 'سنوات خبرة'}`
                            : `${t.years_of_experience} ${t.years_of_experience === 1 ? 'yr' : 'yrs'} exp.`}
                        </Badge>
                      ) : null}
                      {headerLocationLine ? (
                        <Badge
                          variant="outline"
                          className="h-7 max-w-full gap-1 border-primary/20 bg-primary/5 px-2.5 font-normal text-foreground"
                        >
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                          <span className="truncate">{headerLocationLine}</span>
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
                {onEdit ? (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-10 w-full shrink-0 gap-2 shadow-sm sm:w-auto sm:self-start"
                    onClick={() => onEdit(t)}
                  >
                    <Pencil className="h-4 w-4" />
                    {isRTL ? 'تعديل الملف' : 'Edit profile'}
                  </Button>
                ) : null}
              </div>

              <div className="border-t border-border/50 bg-muted/10 px-3 py-3 sm:px-4 sm:py-4">
                <p className="mb-2.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:mb-3">
                  {isRTL ? 'نظرة سريعة' : 'At a glance'}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
                  <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-background/80 p-3 shadow-sm">
                    <Users className="h-4 w-4 text-primary" aria-hidden />
                    <span className="text-xl font-bold tabular-nums leading-none text-foreground sm:text-2xl">
                      {students?.length ?? 0}
                    </span>
                    <span className="text-[11px] leading-snug text-muted-foreground">{isRTL ? 'طلاب' : 'Students'}</span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-background/80 p-3 shadow-sm">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
                    <span className="text-xl font-bold tabular-nums leading-none text-foreground sm:text-2xl">
                      {avgAll ?? '—'}
                    </span>
                    <span className="text-[11px] leading-snug text-muted-foreground">
                      {isRTL ? 'متوسط التقييم' : 'Avg. rating'}
                      {reviewRows.length > 0 ? (
                        <span className="mt-0.5 block text-[10px] text-muted-foreground/80">
                          {isRTL ? `${reviewRows.length} تقييم` : `${reviewRows.length} reviews`}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-background/80 p-3 shadow-sm">
                    <BookOpen className="h-4 w-4 text-primary" aria-hidden />
                    <span className="text-xl font-bold tabular-nums leading-none text-foreground sm:text-2xl">
                      {trainerCourses?.length ?? 0}
                    </span>
                    <span className="text-[11px] leading-snug text-muted-foreground">{isRTL ? 'تدريبات' : 'Trainings'}</span>
                  </div>
                  <div className="col-span-2 flex flex-col gap-1 rounded-xl border border-border/60 bg-background/80 p-3 shadow-sm sm:col-span-1">
                    <Wallet className="h-4 w-4 text-primary" aria-hidden />
                    <span
                      className="text-xl font-bold tabular-nums leading-none text-foreground sm:text-2xl"
                      dir="ltr"
                      lang="en"
                    >
                      {revenueSar.toLocaleString(isRTL ? 'ar-SA' : 'en-US', { maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-[11px] leading-snug text-muted-foreground">
                      {isRTL ? 'إيرادات (مدفوعة)' : 'Paid revenue (SAR)'}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <div className="rounded-xl border border-border/60 bg-muted/15 p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
                <div className="min-w-0 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {isRTL ? 'إجراءات سريعة' : 'Quick actions'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {onEdit ? (
                      <Button variant="secondary" size="sm" className="gap-2" onClick={() => onEdit(t)}>
                        <Pencil className="h-4 w-4 shrink-0" />
                        {isRTL ? 'تعديل الملف' : 'Edit profile'}
                      </Button>
                    ) : null}
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-2"
                      onClick={handleAddTrainingClick}
                    >
                      <Plus className="h-4 w-4 shrink-0" />
                      {isRTL ? 'إضافة تدريب' : 'Add training'}
                    </Button>
                    <Button variant="secondary" size="sm" className="gap-2" onClick={() => setProfileTab('schedule')}>
                      <CalendarDays className="h-4 w-4 shrink-0" />
                      {isRTL ? 'تعديل الجدول' : 'Edit schedule'}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-border/50 pt-3 text-xs text-muted-foreground lg:border-t-0 lg:pt-0">
                  <p className="min-w-0">
                    <span className="mb-0.5 block font-medium text-foreground">{isRTL ? 'تاريخ الانضمام' : 'Joined'}</span>
                    {joinedDateLabel ?? '—'}
                  </p>
                  <p className="min-w-0">
                    <span className="mb-0.5 block font-medium text-foreground">{isRTL ? 'الحالة' : 'Status'}</span>
                    {t.status === 'active' ? (isRTL ? 'نشط' : 'Active') : isRTL ? 'غير نشط' : 'Inactive'}
                  </p>
                </div>
              </div>
            </div>

            <section className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {isRTL ? 'الجدول القادم' : 'Upcoming schedule'}
                  </p>
                  <h3 className="text-base font-semibold text-foreground">
                    {isRTL ? 'الحجوزات القادمة' : 'Upcoming bookings'}
                  </h3>
                </div>
                <Badge variant="outline" className="tabular-nums">
                  {upcomingBookings.length}
                </Badge>
              </div>

              {upcomingBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'لا توجد حجوزات قادمة حالياً.' : 'No upcoming bookings right now.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {upcomingBookings.map((b) => (
                    <div
                      key={b.id}
                      className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate text-sm font-medium text-foreground">{b.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {trainingNameById.get(b.training_id) || '—'}
                        </p>
                      </div>
                      <div className="text-xs sm:text-sm">
                        {(() => {
                          const ns = normalizeBookingSessions(b.sessions, b.booking_date, b.start_time, b.end_time, b.status);
                          const next = getNextSession(ns);
                          return next ? (
                            <BookingTimeDisplay
                              date={next.date}
                              startTime={next.start_time}
                              endTime={next.end_time}
                              compact
                              showCountdown
                            />
                          ) : (
                            <span>—</span>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <Tabs
              value={profileTab}
              onValueChange={(v) => {
                setProfileTab(v);
                if (v !== 'trainings') setExpandedCourseId(null);
              }}
              className="w-full"
              dir={fieldDir}
            >
              <div className="sticky top-0 z-20 -mx-1 border-b border-border/50 bg-background/95 px-1 py-1 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <TabsList className="flex h-auto w-full min-w-0 justify-start gap-0 overflow-x-auto rounded-none border-0 bg-transparent p-0 shadow-none">
                  <TabsTrigger
                    value="personal"
                    className="shrink-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    {isRTL ? 'المعلومات الشخصية' : 'Personal'}
                  </TabsTrigger>
                  <TabsTrigger
                    value="garage"
                    className="shrink-0 gap-1.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    <Bike className="h-3.5 w-3.5 opacity-80" aria-hidden />
                    {isRTL ? 'الجراج' : 'Garage'}
                  </TabsTrigger>
                  <TabsTrigger
                    value="trainings"
                    className="shrink-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    {isRTL ? 'التدريبات' : 'Trainings'}
                  </TabsTrigger>
                  <TabsTrigger
                    value="schedule"
                    className="shrink-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    {isRTL ? 'الجدول' : 'Schedule'}
                  </TabsTrigger>
                  <TabsTrigger
                    value="bookings"
                    className="shrink-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    {isRTL ? 'الحجوزات' : 'Bookings'}
                  </TabsTrigger>
                  <TabsTrigger
                    value="payments"
                    className="shrink-0 gap-1.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    <CreditCard className="h-3.5 w-3.5 opacity-80" aria-hidden />
                    {isRTL ? 'المدفوعات' : 'Payments'}
                  </TabsTrigger>
                  <TabsTrigger
                    value="students"
                    className="shrink-0 gap-1.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    <Users className="h-3.5 w-3.5 opacity-80" aria-hidden />
                    {isRTL ? 'الطلاب' : 'Students'}
                    {students && students.length > 0 ? (
                      <span className="ms-1 rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
                        {students.length}
                      </span>
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger
                    value="reviews"
                    className="shrink-0 gap-1.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    <Star className="h-3.5 w-3.5 opacity-80" aria-hidden />
                    {isRTL ? 'التقييمات' : 'Reviews'}
                    {reviewRows.length > 0 ? (
                      <span className="ms-1 rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
                        {reviewRows.length}
                      </span>
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger
                    value="album"
                    className="shrink-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    {isRTL ? 'الألبوم' : 'Album'}
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="space-y-8 pt-6">
                <TabsContent value="personal" className="mt-0 space-y-8 text-start focus-visible:outline-none">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key="tab-personal"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                      className="space-y-8"
                    >
                      <section dir={fieldDir} className="space-y-4">
                        <ProfileSectionTitle>{isRTL ? 'الملف الشخصي' : 'Profile'}</ProfileSectionTitle>
                        <dl className="grid max-w-none grid-cols-[auto_1fr] gap-x-8 gap-y-0 [&_dt]:text-start [&_dd]:min-w-0 [&_dd]:text-start">
                          <React.Fragment key="ar-name">
                            <dt className="border-b border-border/40 py-3 text-xs text-muted-foreground">الاسم الكامل</dt>
                            <dd className="border-b border-border/40 py-3 text-sm font-medium text-foreground" dir="rtl" lang="ar">
                              {(t.name_ar || '').trim() ? t.name_ar : <EmptyField isRTL={isRTL} />}
                            </dd>
                          </React.Fragment>
                          <React.Fragment key="ar-loc">
                            <dt className="border-b border-border/40 py-3 text-xs text-muted-foreground">الموقع</dt>
                            <dd className="border-b border-border/40 py-3 text-sm font-medium text-foreground" dir="rtl" lang="ar">
                              {locationLineAr.trim() ? locationLineAr : <EmptyField isRTL={isRTL} />}
                            </dd>
                          </React.Fragment>
                          <React.Fragment key="ar-exp">
                            <dt className="border-b border-border/40 py-3 text-xs text-muted-foreground">سنوات الخبرة</dt>
                            <dd className="border-b border-border/40 py-3 text-sm font-medium text-foreground" dir="rtl" lang="ar">
                              {typeof t.years_of_experience === 'number' ? (
                                <>
                                  <bdi>{t.years_of_experience}</bdi>{' '}
                                  {t.years_of_experience === 1 ? 'سنة' : 'سنوات'}
                                </>
                              ) : (
                                <EmptyField isRTL={isRTL} />
                              )}
                            </dd>
                          </React.Fragment>
                          <React.Fragment key="ar-lic">
                            <dt className="border-b border-border/40 py-3 text-xs text-muted-foreground">نوع الرخصة</dt>
                            <dd className="border-b border-border/40 py-3 text-sm font-medium text-foreground" dir="rtl" lang="ar">
                              {(t.license_type || '').trim() ? (
                                <span dir="ltr" className="inline-block">
                                  {t.license_type}
                                </span>
                              ) : (
                                <EmptyField isRTL={isRTL} />
                              )}
                            </dd>
                          </React.Fragment>
                          <React.Fragment key="ar-jd">
                            <dt className="border-b border-border/40 py-3 text-xs text-muted-foreground">تاريخ الانضمام</dt>
                            <dd className="border-b border-border/40 py-3 text-sm font-medium text-foreground" dir="rtl" lang="ar">
                              {joinedDateLabelAr ?? <EmptyField isRTL={isRTL} />}
                            </dd>
                          </React.Fragment>
                        </dl>
                        <div className="max-w-none space-y-2 border-b border-border/40 pb-6">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">نبذة</p>
                          <p className="text-start text-sm leading-relaxed text-muted-foreground" dir="rtl" lang="ar">
                            {(t.bio_ar || '').trim() ? t.bio_ar : <EmptyField isRTL={isRTL} />}
                          </p>
                        </div>
                        <div className="max-w-none space-y-3" dir={fieldDir}>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {isRTL ? 'الخدمات' : 'Services'}
                          </p>
                          {servicesList.length > 0 ? (
                            <ul className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/50 bg-muted/10">
                              {servicesList.map((s, i) => (
                                <li
                                  key={i}
                                  className="flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted/30"
                                >
                                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                                  <span className="min-w-0 break-words text-sm leading-relaxed text-foreground">
                                    {s}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <EmptyField isRTL={isRTL} />
                          )}
                        </div>
                      </section>

                    </motion.div>
                  </AnimatePresence>
                </TabsContent>

                <TabsContent value="garage" className="mt-0 space-y-6 text-start focus-visible:outline-none">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key="tab-garage"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                      className="space-y-4"
                    >
                      <section className="space-y-4" dir={fieldDir}>
                        <ProfileSectionTitle>{isRTL ? 'الجراج' : 'Garage'}</ProfileSectionTitle>
                        <BikeGarage
                          entries={garageEntries}
                          onChange={handleBikesChange}
                          userId={trainerUserId}
                          storageFolder="bikes"
                          readOnly={!isSelfMode}
                          isUpdating={savingBikes}
                        />
                      </section>
                    </motion.div>
                  </AnimatePresence>
                </TabsContent>

                <TabsContent value="trainings" className="mt-0 space-y-6 text-start focus-visible:outline-none">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${profileTab}-trainings-${isAddingTraining && isSelfMode ? 'add' : 'list'}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                      className="space-y-6"
                    >
                  {isAddingTraining && isSelfMode ? (
                    <TrainerAddTrainingPage
                      trainerId={t.id}
                      existingTrainingIds={trainerCourses?.map((tc) => tc.training_id) || []}
                      onClose={closeAddTrainingChildPage}
                    />
                  ) : (
                    <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <ProfileSectionTitle>{isRTL ? 'التدريبات المعيّنة' : 'Assigned trainings'}</ProfileSectionTitle>
                    <Button size="sm" className="h-10 shrink-0 gap-2 self-start sm:self-center" onClick={handleAddTrainingClick}>
                      <Plus className="h-4 w-4" />
                      {isRTL ? 'إضافة تدريب' : 'Add training'}
                    </Button>
                  </div>
                  <p className="-mt-2 text-xs text-muted-foreground">
                    {isRTL ? 'وسّع صفاً لعرض الطلاب والتقييمات.' : 'Expand a row to see students and reviews.'}
                  </p>

                  {isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full rounded-md" />
                      <Skeleton className="h-10 w-full rounded-md" />
                    </div>
                  ) : !trainerCourses?.length ? (
                    <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                      <BookOpen className="h-8 w-8 opacity-40" aria-hidden />
                      <p className="text-sm">{isRTL ? 'لا توجد تدريبات معيّنة.' : 'No trainings assigned yet.'}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40 border-t border-border/40">
                      {trainerCourses.map((tc) => (
                        <TrainingCourseAccordionRow
                          key={tc.id}
                          tc={tc}
                          isRTL={isRTL}
                          students={(students || []) as TrainingStudentRow[]}
                          reviews={reviewRows}
                          isExpanded={expandedCourseId === tc.id}
                          onToggle={() => setExpandedCourseId((id) => (id === tc.id ? null : tc.id))}
                          onEdit={() => setEditCourse(tc)}
                          onDeleted={() => {
                            if (expandedCourseId === tc.id) setExpandedCourseId(null);
                          }}
                        />
                      ))}
                    </div>
                  )}
                  <UnlinkedReviews reviews={reviewRows} isRTL={isRTL} />
                    </>
                  )}
                    </motion.div>
                  </AnimatePresence>
                </TabsContent>

                <TabsContent value="schedule" className="mt-0 text-start focus-visible:outline-none">
                  <TrainerScheduleManager trainerId={trainerId} isRTL={isRTL} mode={managerMode} />
                </TabsContent>

                <TabsContent value="bookings" className="mt-0 text-start focus-visible:outline-none">
                  <TrainerBookingsManager trainerId={trainerId} isRTL={isRTL} mode={managerMode} />
                </TabsContent>

                <TabsContent value="payments" className="mt-0 text-start focus-visible:outline-none">
                  <TrainerAdminPaymentsSection trainerId={trainerId} embed mode={managerMode} />
                </TabsContent>

                <TabsContent value="students" className="mt-0 space-y-4 text-start focus-visible:outline-none">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <ProfileSectionTitle>
                      {isRTL ? 'قائمة الطلاب' : 'Student list'}
                    </ProfileSectionTitle>
                    {students && students.length > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {isRTL ? `${students.length} طالب` : `${students.length} student${students.length === 1 ? '' : 's'}`}
                      </span>
                    ) : null}
                  </div>
                  {loadingStudents ? (
                    <div className="space-y-2">
                      <Skeleton className="h-12 w-full rounded-md" />
                      <Skeleton className="h-12 w-full rounded-md" />
                    </div>
                  ) : !students || students.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                      <Users className="h-8 w-8 opacity-40" aria-hidden />
                      <p className="text-sm">{isRTL ? 'لا يوجد طلاب بعد.' : 'No students yet.'}</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/50 bg-card">
                      {(students as TrainingStudentRow[]).map((s) => {
                        const trainingName = trainingNameById.get(String(s.training_id)) ?? '—';
                        const enrolledAt = s.enrolled_at && isValid(new Date(s.enrolled_at))
                          ? format(new Date(s.enrolled_at), isRTL ? 'd MMMM yyyy' : 'MMMM d, yyyy', { locale: isRTL ? arSA : enUS })
                          : null;
                        return (
                          <li key={String(s.id)} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <p className="truncate text-sm font-semibold text-foreground" dir="auto">
                                {s.full_name || (isRTL ? 'بدون اسم' : 'Unnamed')}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {trainingName}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground sm:justify-end">
                              {s.phone ? (
                                <a href={`tel:${s.phone}`} className="hover:text-foreground" dir="ltr">
                                  {s.phone}
                                </a>
                              ) : null}
                              {s.email ? (
                                <a href={`mailto:${s.email}`} className="hover:text-foreground" dir="ltr">
                                  {s.email}
                                </a>
                              ) : null}
                              {enrolledAt ? (
                                <span className="tabular-nums">{enrolledAt}</span>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </TabsContent>

                <TabsContent value="reviews" className="mt-0 space-y-4 text-start focus-visible:outline-none">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <ProfileSectionTitle>
                      {isRTL ? 'التقييمات والتعليقات' : 'Reviews & comments'}
                    </ProfileSectionTitle>
                    {avgAll ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 px-3 py-1 text-xs font-medium text-foreground">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span className="tabular-nums">{avgAll}</span>
                        <span className="text-muted-foreground">
                          ({reviewRows.length})
                        </span>
                      </span>
                    ) : null}
                  </div>
                  {loadingReviews ? (
                    <div className="space-y-2">
                      <Skeleton className="h-20 w-full rounded-md" />
                      <Skeleton className="h-20 w-full rounded-md" />
                    </div>
                  ) : reviewRows.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                      <Star className="h-8 w-8 opacity-40" aria-hidden />
                      <p className="text-sm">{isRTL ? 'لا توجد تقييمات بعد.' : 'No reviews yet.'}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {reviewRows.map((r) => {
                        const trainingName = r.training_id
                          ? trainingNameById.get(String(r.training_id)) ?? null
                          : null;
                        const created = r.created_at && isValid(new Date(r.created_at))
                          ? format(new Date(r.created_at), isRTL ? 'd MMMM yyyy' : 'MMMM d, yyyy', { locale: isRTL ? arSA : enUS })
                          : null;
                        return (
                          <div
                            key={String(r.id)}
                            className="space-y-2 rounded-xl border border-border/50 bg-card p-3 sm:p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-foreground" dir="auto">
                                  {r.student_name || (isRTL ? 'مجهول' : 'Anonymous')}
                                </p>
                                <div className="flex gap-0.5">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star
                                      key={i}
                                      className={cn(
                                        'h-3.5 w-3.5',
                                        i < Number(r.rating)
                                          ? 'fill-amber-400 text-amber-400'
                                          : 'text-muted-foreground/30',
                                      )}
                                      aria-hidden
                                    />
                                  ))}
                                </div>
                              </div>
                              {created ? (
                                <span className="text-[10px] tabular-nums text-muted-foreground">{created}</span>
                              ) : null}
                            </div>
                            {trainingName ? (
                              <p className="text-[11px] text-muted-foreground">
                                <span className="font-medium">{isRTL ? 'تدريب: ' : 'Training: '}</span>
                                {trainingName}
                              </p>
                            ) : null}
                            {r.comment ? (
                              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90" dir="auto">
                                {r.comment}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="album" className="mt-0 space-y-4 text-start focus-visible:outline-none">
                  {isSelfMode ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <ProfileSectionTitle>{isRTL ? 'ألبوم الصور' : 'Photo album'}</ProfileSectionTitle>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {isRTL
                            ? `${albumPhotos.length} / ${MAX_ALBUM_PHOTOS} صور`
                            : `${albumPhotos.length} / ${MAX_ALBUM_PHOTOS} photos`}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="gap-2"
                        onClick={() => albumInputRef.current?.click()}
                        disabled={albumUploading || albumPhotos.length >= MAX_ALBUM_PHOTOS}
                      >
                        <Upload className="h-4 w-4" />
                        {albumUploading
                          ? isRTL ? 'جارٍ الرفع...' : 'Uploading…'
                          : isRTL ? 'إضافة صور' : 'Add photos'}
                      </Button>
                      <input
                        ref={albumInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleAlbumPick(e.target.files)}
                      />
                    </div>
                  ) : null}

                  {albumPhotos.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                      {albumPhotos.map((url) => (
                        <div
                          key={url}
                          className="group relative aspect-square overflow-hidden rounded-lg border border-border/60"
                        >
                          <button
                            type="button"
                            className="block h-full w-full focus:outline-none focus:ring-2 focus:ring-ring"
                            onClick={() => setLightboxUrl(url)}
                          >
                            <img src={url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                          </button>
                          {isSelfMode ? (
                            <button
                              type="button"
                              onClick={() => handleAlbumRemove(url)}
                              className="absolute end-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white group-hover:opacity-100"
                              aria-label={isRTL ? 'حذف الصورة' : 'Remove photo'}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
                      <Images className="h-8 w-8 opacity-40" aria-hidden />
                      <p className="text-sm">{isRTL ? 'لا توجد صور في الألبوم.' : 'No album photos yet.'}</p>
                      {isSelfMode ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={() => albumInputRef.current?.click()}
                          disabled={albumUploading}
                        >
                          <Upload className="h-4 w-4" />
                          {isRTL ? 'إضافة أول صورة' : 'Add your first photo'}
                        </Button>
                      ) : null}
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
        </div>
      </div>

      <TrainerCourseEditDialog
        open={!!editCourse}
        onOpenChange={(o) => {
          if (!o) setEditCourse(null);
        }}
        tc={editCourse}
        isRTL={isRTL}
      />


      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-5xl border-0 bg-background/95 p-2" aria-describedby={undefined}>
          <DialogHeader className="sr-only">
            <DialogTitle>{isRTL ? 'معاينة الصورة' : 'Image preview'}</DialogTitle>
          </DialogHeader>
          {lightboxUrl ? (
            <img src={lightboxUrl} alt="" className="max-h-[80vh] w-full rounded-md object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>

      <AddTrainingForTrainerDialog
        open={addTrainingOpen}
        onOpenChange={setAddTrainingOpen}
        trainerId={t.id}
        existingTrainingIds={trainerCourses?.map((tc) => tc.training_id) || []}
        isRTL={isRTL}
      />
    </>
  );
};

export default TrainerProfileView;
