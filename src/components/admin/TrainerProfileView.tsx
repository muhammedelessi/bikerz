import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Star, MapPin, BookOpen, Plus, Images, Pencil, CalendarDays, Users, Wallet, Percent, CreditCard } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { TrainerScheduleManager } from '@/components/admin/trainer/TrainerScheduleManager';
import { TrainerBookingsManager } from '@/components/admin/trainer/TrainerBookingsManager';
import { format, isValid } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { COUNTRIES } from '@/data/countryCityData';
import { CountryCityPicker } from '@/components/ui/fields';
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
}

const AddTrainingForTrainerDialog: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trainerId: string;
  existingTrainingIds: string[];
  isRTL: boolean;
}> = ({ open, onOpenChange, trainerId, existingTrainingIds, isRTL }) => {
  const queryClient = useQueryClient();
  const emptyForm = { training_id: '', price: 0, sessions_count: 1, duration_hours: 2, location: '', location_detail: '' };
  const [form, setForm] = useState(emptyForm);

  const { data: allTrainings } = useQuery({
    queryKey: ['all-trainings-catalog'],
    queryFn: async () => {
      const { data } = await supabase
        .from('trainings')
        .select('id, name_ar, name_en, type, default_sessions_count, default_session_duration_hours');
      return data || [];
    },
  });

  const availableTrainings = allTrainings?.filter((tr) => !existingTrainingIds.includes(tr.id)) || [];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('trainer_courses').insert({ trainer_id: trainerId, ...form });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainer-profile-courses', trainerId] });
      queryClient.invalidateQueries({ queryKey: ['trainer-profile-view', trainerId] });
      queryClient.invalidateQueries({ queryKey: ['trainer-profile-bookings', trainerId] });
      queryClient.invalidateQueries({ queryKey: ['admin-trainer-courses-summary'] });
      onOpenChange(false);
      setForm(emptyForm);
      toast.success(isRTL ? 'تم إضافة التدريب' : 'Training added');
    },
    onError: () => toast.error(isRTL ? 'خطأ' : 'Error'),
  });

  const locationParts = form.location.split(' - ');
  const countryPart = locationParts[0] || '';
  const cityPart = locationParts[1] || '';
  const selectedCountryForLoc = COUNTRIES.find((c) => c.en === countryPart);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>{isRTL ? 'إضافة تدريب' : 'Add Training'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{isRTL ? 'التدريب' : 'Training'}</Label>
            <Select
              value={form.training_id}
              onValueChange={(v) => {
                const tr = allTrainings?.find((x) => x.id === v) as
                  | {
                      default_sessions_count?: number | null;
                      default_session_duration_hours?: number | null;
                    }
                  | undefined;
                setForm((f) => ({
                  ...f,
                  training_id: v,
                  sessions_count: Math.max(1, Number(tr?.default_sessions_count ?? 1)),
                  duration_hours: Math.max(0.25, Number(tr?.default_session_duration_hours ?? 2)),
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={isRTL ? 'اختر تدريب' : 'Select training'} />
              </SelectTrigger>
              <SelectContent>
                {availableTrainings.map((tr) => (
                  <SelectItem key={tr.id} value={tr.id}>
                    {isRTL ? tr.name_ar : tr.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>{isRTL ? 'السعر (ر.س)' : 'Price (SAR)'}</Label>
              <Input
                type="number"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'عدد الجلسات' : 'Sessions'}</Label>
              <Input
                type="number"
                min={1}
                step={1}
                value={form.sessions_count}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sessions_count: Math.max(1, parseInt(e.target.value, 10) || 1) }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'مدة كل جلسة (ساعات)' : 'Hours / session'}</Label>
              <Input
                type="number"
                min={0.25}
                step={0.25}
                value={form.duration_hours}
                onChange={(e) =>
                  setForm((f) => ({ ...f, duration_hours: Math.max(0.25, parseFloat(e.target.value) || 0.25) }))
                }
              />
            </div>
          </div>
          <CountryCityPicker
            country={selectedCountryForLoc?.code || ''}
            city={cityPart}
            onCountryChange={(code) => {
              const c = COUNTRIES.find((x) => x.code === code);
              if (c) setForm((f) => ({ ...f, location: c.en }));
            }}
            onCityChange={(v) => {
              const c = selectedCountryForLoc || COUNTRIES.find((x) => x.code === '');
              const cName = c?.en || countryPart;
              setForm((f) => ({ ...f, location: cName + ' - ' + v }));
            }}
          />
          <div className="space-y-2">
            <Label>{isRTL ? 'تفاصيل الموقع' : 'Location Details'}</Label>
            <Input
              value={form.location_detail}
              onChange={(e) => setForm((f) => ({ ...f, location_detail: e.target.value }))}
              placeholder={isRTL ? 'أدخل العنوان التفصيلي للموقع' : 'Enter the detailed location address'}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.training_id}>
            {saveMutation.isPending ? '...' : isRTL ? 'حفظ' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

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

export const TrainerProfileView: React.FC<TrainerProfileViewProps> = ({ trainerId, onEdit }) => {
  const { isRTL } = useLanguage();
  const fieldDir = isRTL ? 'rtl' : 'ltr';
  const [addTrainingOpen, setAddTrainingOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState('personal');
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
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

  const bikeEntries = parseBikeEntriesProfile(t.bike_entries);
  const albumPhotos = Array.isArray(t.album_photos) ? t.album_photos.filter(Boolean) : [];
  const servicesList = Array.isArray(t.services) ? t.services.filter((s) => String(s).trim()) : [];
  const countryEntryLoc = COUNTRIES.find((c) => c.code === t.country);
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
  const joinedDateLabelEn =
    joinedAt && isValid(joinedAt) ? format(joinedAt, 'MMMM d, yyyy', { locale: enUS }) : null;

  const displayCountryAr = countryEntryLoc?.ar ?? (t.country || '').trim();
  const displayCountryEn = countryEntryLoc?.en ?? (t.country || '').trim();
  const displayCityAr = cityEntry?.ar ?? (t.city || '').trim();
  const displayCityEn = cityEntry?.en ?? (t.city || '').trim();
  const locationLineAr = [displayCityAr, displayCountryAr].filter(Boolean).join('، ');
  const locationLineEn = [displayCityEn, displayCountryEn].filter(Boolean).join(', ');

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
                      <AvatarImage src={t.photo_url || ''} className="object-cover" />
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
                      <p
                        className="mt-1 text-sm font-medium text-muted-foreground sm:text-base"
                        dir={isRTL ? 'ltr' : 'rtl'}
                        lang={isRTL ? 'en' : 'ar'}
                      >
                        {isRTL ? t.name_en : t.name_ar}
                      </p>
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
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
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
                  <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-background/80 p-3 shadow-sm">
                    <Percent className="h-4 w-4 text-primary" aria-hidden />
                    <span className="text-xl font-bold tabular-nums leading-none text-foreground sm:text-2xl">
                      {t.profit_ratio != null && !Number.isNaN(Number(t.profit_ratio)) ? `${t.profit_ratio}%` : '—'}
                    </span>
                    <span className="text-[11px] leading-snug text-muted-foreground">{isRTL ? 'نسبة الربح' : 'Profit share'}</span>
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
                      onClick={() => {
                        setProfileTab('trainings');
                        setAddTrainingOpen(true);
                      }}
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
                  <p className="min-w-0">
                    <span className="mb-0.5 block font-medium text-foreground">{isRTL ? 'نسبة الربح' : 'Profit ratio'}</span>
                    {t.profit_ratio != null && !Number.isNaN(Number(t.profit_ratio)) ? `${t.profit_ratio}%` : '—'}
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
                      <section dir="rtl" lang="ar" className="space-y-4">
                        <ProfileSectionTitle>{isRTL ? 'البيانات بالعربية' : 'Arabic profile'}</ProfileSectionTitle>
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
                          <React.Fragment key="ar-pr">
                            <dt className="border-b border-border/40 py-3 text-xs text-muted-foreground">نسبة الربح</dt>
                            <dd className="border-b border-border/40 py-3 text-sm font-medium text-foreground" dir="rtl" lang="ar">
                              {t.profit_ratio != null && !Number.isNaN(Number(t.profit_ratio)) ? (
                                <bdi>{`${t.profit_ratio}%`}</bdi>
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
                        <div className="max-w-none space-y-2 text-right" dir="rtl" lang="ar">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">الخدمات</p>
                          {servicesList.length > 0 ? (
                            <div className="flex flex-wrap justify-end gap-1.5">
                              {servicesList.map((s, i) => (
                                <Badge key={i} variant="secondary" className="text-xs font-normal">
                                  {s}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <EmptyField isRTL={isRTL} />
                          )}
                        </div>
                      </section>

                      <section dir="ltr" lang="en" className="space-y-4 border-t border-border/40 pt-8">
                        <ProfileSectionTitle>{isRTL ? 'البيانات بالإنجليزية' : 'English profile'}</ProfileSectionTitle>
                        <dl className="grid max-w-none grid-cols-[auto_1fr] gap-x-8 gap-y-0 [&_dt]:text-start [&_dd]:min-w-0 [&_dd]:text-start">
                          <React.Fragment key="en-name">
                            <dt className="border-b border-border/40 py-3 text-xs text-muted-foreground">Full name</dt>
                            <dd className="border-b border-border/40 py-3 text-sm font-medium text-foreground" dir="ltr" lang="en">
                              {(t.name_en || '').trim() ? t.name_en : <EmptyField isRTL={false} />}
                            </dd>
                          </React.Fragment>
                          <React.Fragment key="en-loc">
                            <dt className="border-b border-border/40 py-3 text-xs text-muted-foreground">Location</dt>
                            <dd className="border-b border-border/40 py-3 text-sm font-medium text-foreground" dir="ltr" lang="en">
                              {locationLineEn.trim() ? locationLineEn : <EmptyField isRTL={false} />}
                            </dd>
                          </React.Fragment>
                          <React.Fragment key="en-exp">
                            <dt className="border-b border-border/40 py-3 text-xs text-muted-foreground">Experience</dt>
                            <dd className="border-b border-border/40 py-3 text-sm font-medium text-foreground" dir="ltr" lang="en">
                              {typeof t.years_of_experience === 'number' ? (
                                `${t.years_of_experience} ${t.years_of_experience === 1 ? 'year' : 'years'}`
                              ) : (
                                <EmptyField isRTL={false} />
                              )}
                            </dd>
                          </React.Fragment>
                          <React.Fragment key="en-lic">
                            <dt className="border-b border-border/40 py-3 text-xs text-muted-foreground">License type</dt>
                            <dd className="border-b border-border/40 py-3 text-sm font-medium text-foreground" dir="ltr" lang="en">
                              {(t.license_type || '').trim() ? t.license_type : <EmptyField isRTL={false} />}
                            </dd>
                          </React.Fragment>
                          <React.Fragment key="en-pr">
                            <dt className="border-b border-border/40 py-3 text-xs text-muted-foreground">Profit ratio</dt>
                            <dd className="border-b border-border/40 py-3 text-sm font-medium text-foreground" dir="ltr" lang="en">
                              {t.profit_ratio != null && !Number.isNaN(Number(t.profit_ratio)) ? (
                                <bdi>{`${t.profit_ratio}%`}</bdi>
                              ) : (
                                <EmptyField isRTL={false} />
                              )}
                            </dd>
                          </React.Fragment>
                          <React.Fragment key="en-jd">
                            <dt className="border-b border-border/40 py-3 text-xs text-muted-foreground">Join date</dt>
                            <dd className="border-b border-border/40 py-3 text-sm font-medium text-foreground" dir="ltr" lang="en">
                              {joinedDateLabelEn ?? <EmptyField isRTL={false} />}
                            </dd>
                          </React.Fragment>
                        </dl>
                        <div className="max-w-none space-y-2 border-b border-border/40 pb-6">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bio</p>
                          <p className="text-start text-sm leading-relaxed text-muted-foreground" dir="ltr" lang="en">
                            {(t.bio_en || '').trim() ? t.bio_en : <EmptyField isRTL={false} />}
                          </p>
                        </div>
                        <div className="max-w-none space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Services</p>
                          {servicesList.length > 0 ? (
                            <div className="flex flex-wrap justify-start gap-1.5">
                              {servicesList.map((s, i) => (
                                <Badge key={`en-${i}`} variant="secondary" className="text-xs font-normal">
                                  {s}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <EmptyField isRTL={false} />
                          )}
                        </div>
                      </section>

                      <section className="space-y-4 border-t border-border/40 pt-8" dir={fieldDir}>
                        <ProfileSectionTitle>{isRTL ? 'الدراجات' : 'Bikes'}</ProfileSectionTitle>
                        {bikeEntries.length > 0 ? (
                          <div className="space-y-6">
                            {bikeEntries.map((b) => (
                              <div key={b.type} className="space-y-3 border-b border-border/40 pb-6 last:border-0 last:pb-0">
                                <p className="text-sm font-semibold text-foreground">{b.type}</p>
                                <div>
                                  <p className="text-xs text-muted-foreground">{isRTL ? 'الماركة' : 'Brand'}</p>
                                  {b.brand.trim() ? (
                                    <div
                                      dir="ltr"
                                      lang="en"
                                      className="min-w-0 text-start text-sm font-medium [unicode-bidi:isolate]"
                                    >
                                      {b.brand}
                                    </div>
                                  ) : (
                                    <div className="text-sm font-medium">
                                      <EmptyField isRTL={isRTL} />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">{isRTL ? 'الصور' : 'Photos'}</p>
                                  {b.photos.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {b.photos.map((url) => (
                                        <button
                                          key={url}
                                          type="button"
                                          className="block h-16 w-16 overflow-hidden rounded-md border border-border/60 focus:outline-none focus:ring-2 focus:ring-ring"
                                          onClick={() => setLightboxUrl(url)}
                                        >
                                          <img src={url} alt="" className="h-full w-full object-cover" />
                                        </button>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="mt-2">
                                      <EmptyField isRTL={isRTL} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-xs text-muted-foreground">{isRTL ? 'لا توجد دراجات مسجلة' : 'No bikes added yet'}</p>
                            {textOrEmpty(t.bike_type)}
                            {(t.motorbike_brand || '').trim() ? (
                              <p className="text-sm">
                                <span className="text-muted-foreground">{isRTL ? 'الماركة: ' : 'Brand: '}</span>
                                {t.motorbike_brand}
                              </p>
                            ) : null}
                            {Array.isArray(t.bike_photos) && t.bike_photos.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {t.bike_photos.map((url) => (
                                  <button
                                    key={url}
                                    type="button"
                                    className="h-16 w-16 overflow-hidden rounded-md border border-border/60"
                                    onClick={() => setLightboxUrl(url)}
                                  >
                                    <img src={url} alt="" className="h-full w-full object-cover" />
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div>
                                <EmptyField isRTL={isRTL} />
                              </div>
                            )}
                          </div>
                        )}
                      </section>
                    </motion.div>
                  </AnimatePresence>
                </TabsContent>

                <TabsContent value="trainings" className="mt-0 space-y-6 text-start focus-visible:outline-none">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${profileTab}-trainings`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                      className="space-y-6"
                    >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <ProfileSectionTitle>{isRTL ? 'التدريبات المعيّنة' : 'Assigned trainings'}</ProfileSectionTitle>
                    <Button size="sm" className="h-10 shrink-0 gap-2 self-start sm:self-center" onClick={() => setAddTrainingOpen(true)}>
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
                    </motion.div>
                  </AnimatePresence>
                </TabsContent>

                <TabsContent value="schedule" className="mt-0 text-start focus-visible:outline-none">
                  <TrainerScheduleManager trainerId={trainerId} isRTL={isRTL} />
                </TabsContent>

                <TabsContent value="bookings" className="mt-0 text-start focus-visible:outline-none">
                  <TrainerBookingsManager trainerId={trainerId} isRTL={isRTL} />
                </TabsContent>

                <TabsContent value="payments" className="mt-0 text-start focus-visible:outline-none">
                  <TrainerAdminPaymentsSection trainerId={trainerId} embed />
                </TabsContent>

                <TabsContent value="album" className="mt-0 text-start focus-visible:outline-none">
                  {albumPhotos.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                      {albumPhotos.map((url) => (
                        <button
                          key={url}
                          type="button"
                          className="aspect-square overflow-hidden rounded-lg border border-border/60 focus:outline-none focus:ring-2 focus:ring-ring"
                          onClick={() => setLightboxUrl(url)}
                        >
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                      <Images className="h-8 w-8 opacity-40" aria-hidden />
                      <p className="text-sm">{isRTL ? 'لا توجد صور في الألبوم.' : 'No album photos yet.'}</p>
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
