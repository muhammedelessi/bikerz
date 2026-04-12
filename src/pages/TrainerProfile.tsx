import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
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
import { ArrowLeft, ArrowRight, Bike, Calendar, Camera, ChevronLeft, ChevronRight, Clock, GraduationCap, MapPin, Star, Users, Wrench } from 'lucide-react';
import { translateTrainerCourseLocation } from '@/lib/trainerCourseLocation';
import { COUNTRIES } from '@/data/countryCityData';
import { cn } from '@/lib/utils';
import TrainerProfileReviews from '@/components/training/TrainerProfileReviews';

type TrainingEmbed = {
  id: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  level: string;
  type: string;
} | null;

type TrainerCoursePublic = {
  id: string;
  training_id: string;
  price: number;
  duration_hours: number;
  location: string;
  trainings: TrainingEmbed;
};

const levelStyle: Record<string, string> = {
  beginner: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25',
  intermediate: 'bg-amber-500/10 text-amber-600 border-amber-500/25',
  advanced: 'bg-red-500/10 text-red-600 border-red-500/25',
};

const BIKE_LABELS: Record<string, { ar: string; en: string }> = {
  Sport: { ar: 'رياضية', en: 'Sport' },
  Cruiser: { ar: 'كروزر', en: 'Cruiser' },
  Adventure: { ar: 'مغامرة', en: 'Adventure' },
  Touring: { ar: 'سياحية', en: 'Touring' },
  Naked: { ar: 'نيكد', en: 'Naked' },
  'Dual Sport': { ar: 'ثنائية الاستخدام', en: 'Dual Sport' },
  Scooter: { ar: 'سكوتر', en: 'Scooter' },
};

type BikeEntry = {
  type: string;
  brand: string;
  photos: string[];
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

const TrainerProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
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
      const { data, error } = await supabase.from('trainers').select('*').eq('id', id!).eq('status', 'active').maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: trainerCourses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ['trainer-courses-public', id],
    enabled: !!id && !!trainer,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trainer_courses')
        .select('id, training_id, price, duration_hours, location, trainings(id, name_ar, name_en, description_ar, description_en, level, type)')
        .eq('trainer_id', id!);
      if (error) throw error;
      return (data || []) as TrainerCoursePublic[];
    },
  });

  const { data: studentCount = 0 } = useQuery({
    queryKey: ['trainer-student-count-public', id],
    enabled: !!id && !!trainer,
    queryFn: async () => {
      const { count } = await supabase.from('training_students').select('*', { count: 'exact', head: true }).eq('trainer_id', id!);
      return count || 0;
    },
  });

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
              <Link to="/trainers">
                <BackIcon className="w-4 h-4" />
                {isRTL ? 'العودة للمدربين' : 'Back to trainers'}
              </Link>
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
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    {trainer.services.map((s: string, i: number) => (
                      <Badge key={i} variant="secondary" className="font-normal">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              {trainer.license_type ? (
                <section>
                  <SectionHeader>{isRTL ? 'نوع الرخصة' : 'License'}</SectionHeader>
                  <p className="text-sm font-medium text-start" dir="ltr">
                    {trainer.license_type}
                  </p>
                </section>
              ) : null}

              {bikeEntries.length > 0 ? (
                <section>
                  <SectionHeader>{isRTL ? 'الدراجات' : 'Bikes'}</SectionHeader>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {bikeEntries.map((bike, idx) => {
                      const displayType = BIKE_LABELS[bike.type]?.[isRTL ? 'ar' : 'en'] || bike.type;
                      return (
                        <Card key={`${bike.type}-${idx}`} className="overflow-hidden border-border/60 shadow-sm">
                          <CardContent className="pt-5 pb-4 px-4 space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                                <Bike className="h-5 w-5" />
                              </div>
                              <div className="min-w-0 flex-1 space-y-0.5 text-start">
                                <p className="text-sm font-bold leading-tight">{displayType}</p>
                                {bike.brand ? (
                                  <p className="text-sm text-muted-foreground truncate" dir="ltr" lang="en">
                                    {bike.brand}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            {bike.photos.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {bike.photos.map((url) => (
                                  <button
                                    key={url}
                                    type="button"
                                    className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    onClick={() => setLightboxPhoto(url)}
                                  >
                                    <img src={url} alt="" className="h-full w-full object-cover" />
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 rounded-lg border border-dashed border-muted-foreground/25 bg-muted/25 px-3 py-3 text-xs text-muted-foreground">
                                <Camera className="h-4 w-4 shrink-0 opacity-70" />
                                <span>{isRTL ? 'لا توجد صور' : 'No photos'}</span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
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
                      const hours = Number(tc.duration_hours);
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
                                  {hours} {isRTL ? (hours === 1 ? 'ساعة' : 'ساعات') : hours === 1 ? 'hr' : 'hrs'}
                                </span>
                              </div>
                              <div className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-primary/80" />
                                <span className="leading-snug">{loc}</span>
                              </div>
                              <p
                                className="text-lg font-bold text-primary tabular-nums pt-1"
                                dir={isRTL ? 'rtl' : 'ltr'}
                                lang={isRTL ? 'ar' : 'en'}
                              >
                                {formatTrainingOfferPrice(Number(tc.price), isRTL)}
                              </p>
                            </div>
                            <Button className="w-full mt-auto gap-2 font-semibold" asChild>
                              <Link to={buildBookHref(tc)}>
                                {isRTL ? 'احجز هذا التدريب' : 'Book this training'}
                                <BookIcon className="h-4 w-4 opacity-90" />
                              </Link>
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>

              <Separator />

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
