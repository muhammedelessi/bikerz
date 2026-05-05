import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLocalizedNavigate } from '@/hooks/useLocalizedNavigate';
import LocalizedLink from '@/components/common/LocalizedLink';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import { trainerServiceLineDisplayLabel } from '@/lib/trainer-form-constants';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/common/SEOHead';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ArrowLeft, ArrowRight, Bike, Calendar, ChevronLeft, ChevronRight, Clock, GraduationCap, Mail, MapPin, Phone, Star, Users, Wrench } from 'lucide-react';
import { translateTrainerCourseLocation } from '@/lib/trainerCourseLocation';
import { COUNTRIES } from '@/data/countryCityData';
import { cn } from '@/lib/utils';
import TrainerProfileReviews from '@/components/training/TrainerProfileReviews';
import { useTrainingPlatformPricing } from '@/hooks/useTrainingPlatformPricing';
import { applyTrainingPlatformMarkupSar } from '@/lib/trainingPlatformMarkup';
import { normalizeBookingSessions } from '@/lib/trainingBookingSessions';
import TrainerReviewForm from '@/components/training/TrainerReviewForm';
import { BikeGarage } from '@/components/ui/profile/BikeGarage';
import type { BikeEntry as ProfileBikeEntry } from '@/hooks/useUserProfile';

type TrainingEmbed = {
  id: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  level: string;
  type: string;
  /** Canonical "number of sessions" admin-entered on the training. */
  default_sessions_count: number | null;
  /** Canonical "hours per session" admin-entered on the training. */
  default_session_duration_hours: number | null;
} | null;

type TrainerCoursePublic = {
  id: string;
  training_id: string;
  price: number;
  sessions_count?: number | null;
  duration_hours: number;
  location: string;
  location_detail?: string | null;
  trainings: TrainingEmbed;
};

const levelStyle: Record<string, string> = {
  beginner: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25',
  intermediate: 'bg-amber-500/10 text-amber-600 border-amber-500/25',
  advanced: 'bg-red-500/10 text-red-600 border-red-500/25',
};

const BIKE_LABELS: Record<string, { ar: string; en: string }> = {
  Sport:        { ar: 'سبورت',       en: 'Sport'       },
  Race:         { ar: 'ريس',         en: 'Race'        },
  Cruiser:      { ar: 'كروزر',       en: 'Cruiser'     },
  Adventure:    { ar: 'أدڤنتشر',    en: 'Adventure'   },
  Touring:      { ar: 'توورينج',     en: 'Touring'     },
  Naked:        { ar: 'نيكد',        en: 'Naked'       },
  Scrambler:    { ar: 'سكرامبلر',    en: 'Scrambler'   },
  'Cafe Racer': { ar: 'كافيه ريسر', en: 'Cafe Racer'  },
  'Dual Sport': { ar: 'ديول سبورت', en: 'Dual Sport'  },
  Scooter:      { ar: 'سكوتر',       en: 'Scooter'     },
};

type BikeEntry = {
  type: string;
  brand: string;
  photos: string[];
  /** New richer fields preserved by the admin trainer save (post fix).
   *  Legacy rows don't have them; UI falls back to the joined `brand`. */
  subtype_name?: string;
  model?: string;
};

function parseBikeEntriesPublic(raw: unknown): BikeEntry[] {
  if (!raw || !Array.isArray(raw)) return [];
  return (raw as unknown[])
    .map((x) => {
      const o = x as Record<string, unknown>;
      return {
        type: String(o.type ?? '').trim(),
        brand: String(o.brand ?? ''),
        photos: Array.isArray(o.photos) ? (o.photos as unknown[]).map(String) : [],
        // Optional richer fields. Legacy entries don't have these, so we
        // tolerate undefined and the UI treats them as "fall back to
        // whatever's in `brand`".
        subtype_name: typeof o.subtype_name === 'string' ? o.subtype_name : undefined,
        model: typeof o.model === 'string' ? o.model : undefined,
      };
    })
    .filter((e) => e.type);
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-bold flex items-center gap-2 mb-4">
      <span className="w-1 h-5 bg-primary rounded-full shrink-0" />
      {children}
    </h2>
  );
}

type BikeCardProps = {
  bike: BikeEntry;
  displayType: string;
  isRTL: boolean;
  onPhotoClick: (url: string) => void;
};

function TrainerBikeCard({ bike, displayType, isRTL, onPhotoClick }: BikeCardProps) {
  const typeLabel = isRTL ? 'النوع' : 'Type';
  const brandLabel = isRTL ? 'الماركة' : 'Brand';
  const modelLabel = isRTL ? 'الموديل' : 'Model';
  const subtypeLabel = isRTL ? 'الفئة' : 'Category';
  const noPhotosLabel = isRTL ? 'لا توجد صور' : 'No photos';
  const photoHint = isRTL ? 'اضغط للتكبير' : 'Tap to enlarge';

  // Prefer the granular `model` if present; otherwise fall back to whatever
  // is in the joined `brand` field. Brand alone is shown when both are
  // present so we don't repeat "Honda Honda CBR" if `brand` already
  // contains the model.
  const hasGranularModel = !!bike.model && bike.model.trim().length > 0;
  const brandOnly = hasGranularModel
    ? bike.brand.replace(bike.model!, '').trim()
    : bike.brand;

  return (
    <Card
      className={cn(
        'overflow-hidden rounded-2xl border-border/70 bg-card shadow-sm transition-shadow duration-200',
        'hover:shadow-md hover:border-primary/20',
      )}
    >
      {/* Photo area — consistent aspect & alignment for RTL/LTR */}
      <div className="relative border-b border-border/50 bg-muted/30">
        {bike.photos.length === 0 ? (
          <div
            className={cn(
              'flex aspect-[5/3] w-full flex-col items-center justify-center gap-2 px-4 text-center',
              'bg-gradient-to-br from-muted/80 to-muted/30',
            )}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background/80 shadow-sm ring-1 ring-border/60">
              <Bike className="h-7 w-7 text-primary/70" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">{noPhotosLabel}</p>
          </div>
        ) : bike.photos.length === 1 ? (
          <button
            type="button"
            className="group/img relative block w-full overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={() => onPhotoClick(bike.photos[0])}
            aria-label={photoHint}
          >
            <div className="aspect-[5/3] w-full">
              <img
                src={bike.photos[0]}
                alt=""
                className="h-full w-full object-cover transition-transform duration-300 group-hover/img:scale-[1.02]"
              />
            </div>
            <span className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5" />
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 p-1.5 sm:grid-cols-3 sm:gap-2 sm:p-2">
            {bike.photos.map((url, i) => (
              <button
                key={`${url}-${i}`}
                type="button"
                className={cn(
                  'relative aspect-square overflow-hidden rounded-xl border border-border/50 bg-muted outline-none',
                  'transition-transform hover:brightness-[1.02] focus-visible:ring-2 focus-visible:ring-ring',
                )}
                onClick={() => onPhotoClick(url)}
                aria-label={`${photoHint} ${i + 1}`}
              >
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-4">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner',
              'ring-1 ring-primary/15',
            )}
            aria-hidden
          >
            <Bike className="h-6 w-6" />
          </div>

          <div className="min-w-0 flex-1 space-y-3 text-start">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{typeLabel}</p>
              <p className="text-base font-bold leading-snug text-foreground">{displayType}</p>
            </div>

            {bike.subtype_name ? (
              <div className="space-y-1 border-t border-border/50 pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{subtypeLabel}</p>
                <p className="text-sm font-medium leading-relaxed text-foreground/90 break-words" dir="auto" translate="no">
                  {bike.subtype_name}
                </p>
              </div>
            ) : null}

            {brandOnly ? (
              <div className="space-y-1 border-t border-border/50 pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{brandLabel}</p>
                <p className="text-sm font-medium leading-relaxed text-foreground/90 break-words" dir="auto" translate="no">
                  {brandOnly}
                </p>
              </div>
            ) : null}

            {hasGranularModel ? (
              <div className="space-y-1 border-t border-border/50 pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{modelLabel}</p>
                <p className="text-sm font-medium leading-relaxed text-foreground/90 break-words" dir="auto" translate="no">
                  {bike.model}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const TrainerProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isRTL, language } = useLanguage();
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useLocalizedNavigate();
  const queryClient = useQueryClient();
  const { formatTrainingOfferPrice } = useCurrency();
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [isRTL, language]);

  const { data: trainer, isLoading, isError } = useQuery({
    queryKey: ['trainer-public-profile', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('public_trainers').select('id,name_ar,name_en,photo_url,bio_ar,bio_en,country,city,email,phone,bike_type,years_of_experience,services,status,profit_ratio,motorbike_brand,license_type,bike_photos,album_photos,bike_entries,availability_blocked_dates,availability_special_hours,availability_settings,language_levels,user_id,created_at').eq('id', id!).eq('status', 'active').maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const { data: trainerCourses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ['trainer-courses-public', id],
    enabled: !!id && !!trainer,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trainer_courses')
        .select(
          // default_sessions_count + default_session_duration_hours are the
          // canonical admin-entered fields. The `sessions` JSONB is OPTIONAL
          // curriculum content and is not used to compute the displayed
          // count/hours.
          'id, training_id, price, sessions_count, duration_hours, location, location_detail, trainings(id, name_ar, name_en, description_ar, description_en, level, type, default_sessions_count, default_session_duration_hours)',
        )
        .eq('trainer_id', id!);
      if (error) throw error;
      return (data || []) as TrainerCoursePublic[];
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const { data: studentCount = 0 } = useQuery({
    queryKey: ['trainer-student-count-public', id],
    enabled: !!id && !!trainer,
    queryFn: async () => {
      const { count } = await supabase.from('training_students').select('*', { count: 'exact', head: true }).eq('trainer_id', id!);
      return count || 0;
    },
  });

  const { data: pricing } = useTrainingPlatformPricing();
  const platformMarkupPct = pricing?.markupPercent ?? 0;
  const platformVatPct = pricing?.vatPercent ?? 0;

  const { data: reviewAgg } = useQuery({
    queryKey: ['trainer-review-agg', id],
    enabled: !!id && !!trainer,
    queryFn: async () => {
      const { data, error } = await supabase.from('trainer_reviews').select('rating').eq('trainer_id', id!);
      if (error) throw error;
      const rows = data || [];
      if (!rows.length) return { avg: 0, count: 0 };
      const avg = rows.reduce((s, r) => s + Number(r.rating), 0) / rows.length;
      return { avg, count: rows.length };
    },
  });

  const { data: myReview } = useQuery({
    queryKey: ['my-trainer-review', id, user?.id],
    enabled: !!id && !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('trainer_reviews')
        .select('id, trainer_id, rating, comment')
        .eq('trainer_id', id!)
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; trainer_id: string; rating: number; comment: string | null } | null;
    },
  });

  const { data: canReviewTrainer = false } = useQuery({
    queryKey: ['can-review-trainer', id, user?.id],
    enabled: !!id && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_bookings')
        .select('status, sessions, booking_date, start_time, end_time')
        .eq('trainer_id', id!)
        .eq('user_id', user!.id)
        .in('status', ['confirmed', 'completed']);
      if (error) throw error;
      return (data || []).some((booking) => {
        const normalized = normalizeBookingSessions(
          booking.sessions,
          booking.booking_date,
          booking.start_time,
          booking.end_time,
          booking.status,
        );
        return normalized.some((session) => session.status === 'completed');
      });
    },
  });

  const displayName = trainer ? (isRTL ? trainer.name_ar : trainer.name_en) : '';
  const bio = trainer ? (isRTL ? trainer.bio_ar || trainer.bio_en : trainer.bio_en || trainer.bio_ar) : '';
  const y = trainer ? Number(trainer.years_of_experience) : 0;

  const displayLocation = useMemo(() => {
    if (!trainer) return '';
    const countryEntry = COUNTRIES.find(
      (c) => c.code === trainer.country || c.en === trainer.country || c.ar === trainer.country,
    );
    const cityEntry = countryEntry?.cities.find(
      (c) => c.en === trainer.city || c.ar === trainer.city,
    );
    const displayCountry = countryEntry ? (isRTL ? countryEntry.ar : countryEntry.en) : trainer.country;
    const displayCity = cityEntry ? (isRTL ? cityEntry.ar : cityEntry.en) : trainer.city;
    return [displayCity, displayCountry].filter(Boolean).join(isRTL ? '، ' : ', ');
  }, [trainer, isRTL]);

  const bikeEntries: BikeEntry[] = useMemo(() => {
    if (!trainer) return [];
    const entries = parseBikeEntriesPublic(trainer.bike_entries);
    if (entries.length > 0) return entries;
    if (trainer.bike_type) {
      return [
        {
          type: trainer.bike_type,
          brand: trainer.motorbike_brand || '',
          photos: [] as string[],
        },
      ];
    }
    return [];
  }, [trainer]);

  const albumPhotos = useMemo(() => {
    const raw = trainer?.album_photos;
    if (!raw || !Array.isArray(raw)) return [];
    return raw.map(String).filter(Boolean);
  }, [trainer?.album_photos]);

  const pageTitle = displayName || (isRTL ? 'المدرب' : 'Trainer');
  const seoDesc = useMemo(() => {
    if (!trainer) return '';
    const b = isRTL ? trainer.bio_ar : trainer.bio_en;
    return (b || '').slice(0, 160);
  }, [trainer, isRTL]);

  const notFound = !isLoading && !isError && !trainer;

  const levelLabel = (level: string) => {
    const m: Record<string, { ar: string; en: string }> = {
      beginner: { ar: 'مبتدئ', en: 'Beginner' },
      intermediate: { ar: 'متوسط', en: 'Intermediate' },
      advanced: { ar: 'متقدم', en: 'Advanced' },
    };
    return isRTL ? m[level]?.ar ?? level : m[level]?.en ?? level;
  };

  const buildBookHref = (tc: TrainerCoursePublic) => {
    const path = `/trainings/${tc.training_id}/book/${tc.id}`;
    if (!user) return `/login?returnTo=${encodeURIComponent(path)}`;
    return path;
  };

  const BookIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'} lang={language}>
      <SEOHead
        title={pageTitle}
        description={seoDesc || (isRTL ? 'ملف مدرب بايكرز' : 'BIKERZ trainer profile')}
        canonical={id ? `/trainers/${id}` : '/trainers'}
      />
      <Navbar />
      <div className="pt-[var(--navbar-h)]">
        <main className="section-container pb-16 max-w-4xl mx-auto">
          <div className="mb-6">
            <Button variant="ghost" size="sm" className="gap-2 -ms-2" asChild>
              <LocalizedLink to="/trainers">
                <BackIcon className="w-4 h-4" />
                {isRTL ? 'العودة للمدربين' : 'Back to trainers'}
              </LocalizedLink>
            </Button>
          </div>

          {isLoading && (
            <div className="space-y-6">
              <div className="flex gap-4">
                <Skeleton className="h-28 w-28 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          )}

          {isError && (
            <p className="text-center text-muted-foreground py-16">{isRTL ? 'تعذر تحميل الملف.' : 'Could not load profile.'}</p>
          )}

          {notFound && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {isRTL ? 'المدرب غير موجود أو غير متاح.' : 'Trainer not found or unavailable.'}
              </CardContent>
            </Card>
          )}

          {trainer && (
            <div className="space-y-10">
              {/* Header: small circular photo + info in site language */}
              <div className="flex flex-col sm:flex-row gap-6 sm:items-start">
                <Avatar className="h-28 w-28 shrink-0 ring-4 ring-primary/15 border-2 border-background shadow-md mx-auto sm:mx-0">
                  <AvatarImage src={trainer.photo_url || undefined} alt={displayName} className="object-cover" />
                  <AvatarFallback className="text-3xl font-black bg-primary/10 text-primary">{displayName.charAt(0)}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1 text-center sm:text-start space-y-3">
                  <h1 className="text-2xl sm:text-3xl font-black text-foreground leading-tight">{displayName}</h1>

                  <div className="flex flex-wrap justify-center sm:justify-start gap-x-5 gap-y-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-primary" />
                      <span className="text-foreground font-medium">{displayLocation || '—'}</span>
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Calendar className="h-4 w-4 shrink-0 text-primary" />
                      <span className="text-foreground font-medium tabular-nums">
                        {y} {isRTL ? (y === 1 ? 'سنة خبرة' : 'سنوات خبرة') : y === 1 ? 'yr experience' : 'yrs experience'}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Users className="h-4 w-4 shrink-0 text-primary" />
                      <span className="text-foreground font-medium tabular-nums">
                        {studentCount} {isRTL ? 'متدرب' : studentCount === 1 ? 'student' : 'students'}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Star className="h-4 w-4 shrink-0 text-amber-500 fill-amber-400" />
                      {reviewAgg && reviewAgg.count > 0 ? (
                        <span className="text-foreground font-medium tabular-nums">
                          {reviewAgg.avg.toFixed(1)}{' '}
                          <span className="text-muted-foreground font-normal">
                            ({reviewAgg.count} {isRTL ? 'تقييم' : reviewAgg.count === 1 ? 'review' : 'reviews'})
                          </span>
                        </span>
                      ) : (
                        <span className="text-foreground font-medium">{isRTL ? 'لا تقييمات بعد' : 'No reviews yet'}</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact card — phone + email. Only renders when at least
                  one is present so trainers without contact info don't get
                  an empty section. Both are wrapped in tel:/mailto: links
                  for one-tap dialing on mobile and one-click compose on
                  desktop. */}
              {(trainer.phone || trainer.email) && (
                <section className="rounded-xl border border-border bg-muted/30 p-3 sm:p-4">
                  <SectionHeader>{isRTL ? 'تواصل مع المدرب' : 'Contact the trainer'}</SectionHeader>
                  <div className="flex flex-wrap gap-2 sm:gap-3 mt-2">
                    {trainer.phone && (
                      <a
                        href={`tel:${trainer.phone.replace(/\s+/g, '')}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-primary/5 hover:border-primary/40 transition-colors min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        dir="ltr"
                      >
                        <Phone className="h-4 w-4 text-primary" />
                        <span className="tabular-nums">{trainer.phone}</span>
                      </a>
                    )}
                    {trainer.email && (
                      <a
                        href={`mailto:${trainer.email}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-primary/5 hover:border-primary/40 transition-colors min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        dir="ltr"
                      >
                        <Mail className="h-4 w-4 text-primary" />
                        <span className="break-all">{trainer.email}</span>
                      </a>
                    )}
                  </div>
                </section>
              )}

              {bio ? (
                <section>
                  <SectionHeader>{isRTL ? 'نبذة عن المدرب' : 'About'}</SectionHeader>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed whitespace-pre-wrap text-start">
                    {bio}
                  </p>
                </section>
              ) : null}

              {trainer.services && trainer.services.length > 0 && (
                <section>
                  <SectionHeader>{isRTL ? 'الخدمات' : 'Services'}</SectionHeader>
                  <ul className="list-disc ps-5 space-y-1.5 text-sm text-start max-w-prose mx-auto sm:mx-0">
                    {trainer.services.map((s: string, i: number) => (
                      <li key={i} className="leading-relaxed">
                        {trainerServiceLineDisplayLabel(s, t)}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {trainer.license_type ? (
                <section>
                  <SectionHeader>{isRTL ? 'نوع الرخصة' : 'License'}</SectionHeader>
                  <p
                    className={cn('w-full text-sm font-medium tabular-nums', isRTL ? 'text-end' : 'text-start')}
                    dir="ltr"
                    translate="no"
                  >
                    {trainer.license_type}
                  </p>
                </section>
              ) : null}

              {bikeEntries.length > 0 ? (
                <section>
                  <SectionHeader>{isRTL ? 'الدراجات' : 'Bikes'}</SectionHeader>
                  <BikeGarage
                    readOnly
                    entries={bikeEntries.map((bike, idx): ProfileBikeEntry => ({
                      id: `${bike.type}-${idx}`,
                      type_id: null,
                      type_name: BIKE_LABELS[bike.type]?.[isRTL ? 'ar' : 'en'] || bike.type,
                      subtype_id: null,
                      subtype_name: bike.subtype_name || '',
                      brand: bike.brand || '',
                      model: bike.model || '',
                      is_custom_type: false,
                      is_custom_brand: false,
                      photos: bike.photos || [],
                    }))}
                    onChange={() => {}}
                  />
                </section>
              ) : null}

              {albumPhotos.length > 0 ? (
                <section>
                  <SectionHeader>{isRTL ? 'ألبوم الصور' : 'Photo Album'}</SectionHeader>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {albumPhotos.map((url) => (
                      <button
                        key={url}
                        type="button"
                        className="aspect-square overflow-hidden rounded-lg border border-border/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => setLightboxPhoto(url)}
                      >
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <Separator />

              <section>
                <SectionHeader>{isRTL ? 'التدريبات المتاحة للحجز' : 'Available trainings'}</SectionHeader>
                {coursesLoading ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Skeleton className="h-48 rounded-xl" />
                    <Skeleton className="h-48 rounded-xl" />
                  </div>
                ) : trainerCourses.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center sm:text-start py-6">
                    {isRTL ? 'لا توجد تدريبات معروضة حالياً.' : 'No trainings listed yet.'}
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {trainerCourses.map((tc) => {
                      const raw = tc.trainings;
                      const tr = Array.isArray(raw) ? raw[0] : raw;
                      if (!tr) return null;
                      const title = isRTL ? tr.name_ar : tr.name_en;
                      const desc = (isRTL ? tr.description_ar : tr.description_en) || '';
                      const loc = translateTrainerCourseLocation(tc.location, isRTL) || tc.location;
                      // Canonical sources (per product owner):
                      //   sessions count    →  trainings.default_sessions_count
                      //   session duration  →  trainings.default_session_duration_hours
                      // The `sessions` JSONB is OPTIONAL curriculum content and
                      // must NOT override these admin-entered fields. The
                      // trainer_courses fallbacks remain only for legacy rows
                      // where the admin hasn't filled in the canonical fields.
                      const sessions = Math.max(
                        1,
                        Number(tr.default_sessions_count) ||
                          Number(tc.sessions_count) ||
                          1,
                      );
                      const hours =
                        Number(tr.default_session_duration_hours) ||
                        Number(tc.duration_hours) ||
                        0;
                      const TypeIcon = tr.type === 'theory' ? GraduationCap : Wrench;
                      return (
                        <Card key={tc.id} className="overflow-hidden border-border/60 shadow-sm flex flex-col">
                          <CardHeader className="space-y-2 pb-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                                <TypeIcon className="h-5 w-5" />
                              </div>
                              <Badge variant="outline" className={cn('text-[10px] shrink-0', levelStyle[tr.level] || levelStyle.beginner)}>
                                {levelLabel(tr.level)}
                              </Badge>
                            </div>
                            <CardTitle className="text-base leading-snug text-start">{title}</CardTitle>
                            {desc ? (
                              <CardDescription className="text-start line-clamp-2 leading-relaxed">{desc}</CardDescription>
                            ) : null}
                          </CardHeader>
                          <CardContent className="flex flex-1 flex-col gap-3 pt-0">
                            <div className="space-y-1.5 text-sm text-muted-foreground text-start">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 shrink-0 text-primary/80" />
                                <span>
                                  {sessions}{' '}
                                  {isRTL ? (sessions === 1 ? 'جلسة' : 'جلسات') : sessions === 1 ? 'session' : 'sessions'}
                                  {' · '}
                                  {hours} {isRTL ? (hours === 1 ? 'ساعة/جلسة' : 'ساعات/جلسة') : hours === 1 ? 'hr/session' : 'hrs/session'}
                                </span>
                              </div>
                              <div className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-primary/80" />
                                <div className="min-w-0">
                                  <span className="leading-snug">{loc}</span>
                                  {tc.location_detail && (
                                    <p className="text-xs text-muted-foreground leading-snug mt-0.5">{tc.location_detail}</p>
                                  )}
                                </div>
                              </div>
                              <p
                                className="text-lg font-bold text-primary tabular-nums pt-1"
                                dir={isRTL ? 'rtl' : 'ltr'}
                                lang={isRTL ? 'ar' : 'en'}
                              >
                                {formatTrainingOfferPrice(
                                  applyTrainingPlatformMarkupSar(Number(tc.price), platformMarkupPct),
                                  isRTL,
                                  { vatPercent: platformVatPct },
                                )}
                              </p>
                            </div>
                            <Button className="w-full mt-auto gap-2 font-semibold" asChild>
                              <LocalizedLink to={buildBookHref(tc)}>
                                {isRTL ? 'احجز هذا التدريب' : 'Book this training'}
                                <BookIcon className="h-4 w-4 opacity-90" />
                              </LocalizedLink>
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>

              <Separator />

              <section className="space-y-3">
                {!user ? (
                  <Card>
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">
                        {isRTL ? 'سجل دخولك لتتمكن من التقييم' : 'Login to leave a review'}
                      </p>
                      <Button size="sm" onClick={() => navigate(`/login?returnTo=${encodeURIComponent(`/trainers/${id}`)}`)}>
                        {isRTL ? 'تسجيل الدخول' : 'Login'}
                      </Button>
                    </CardContent>
                  </Card>
                ) : canReviewTrainer ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{isRTL ? 'شاركنا تجربتك مع هذا المدرب' : 'Share your experience with this trainer'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <TrainerReviewForm
                        trainerId={id!}
                        existingReview={myReview}
                        submitLabel={myReview ? (isRTL ? 'تعديل التقييم' : 'Update review') : undefined}
                        onSuccess={() => {
                          queryClient.invalidateQueries({ queryKey: ['my-trainer-review', id, user?.id] });
                          queryClient.invalidateQueries({ queryKey: ['trainer-profile-reviews', id] });
                          queryClient.invalidateQueries({ queryKey: ['trainer-review-agg', id] });
                        }}
                      />
                    </CardContent>
                  </Card>
                ) : null}
              </section>

              {id && <TrainerProfileReviews trainerId={id} />}

              <Dialog open={!!lightboxPhoto} onOpenChange={(open) => !open && setLightboxPhoto(null)}>
                <DialogContent className="max-w-3xl p-2 bg-black/90 border-0">
                  <img
                    src={lightboxPhoto || ''}
                    alt=""
                    className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
                  />
                </DialogContent>
              </Dialog>
            </div>
          )}
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default TrainerProfile;
