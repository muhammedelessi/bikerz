import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useLocalizedNavigate } from '@/hooks/useLocalizedNavigate';
import LocalizedLink from '@/components/common/LocalizedLink';
import { COUNTRIES } from '@/data/countryCityData';
import TrainerShowcaseCard from '@/components/landing/TrainerShowcaseCard';

const TrainersSection: React.FC = () => {
  const { isRTL } = useLanguage();
  const navigate = useLocalizedNavigate();

  const { data: trainers, isLoading } = useQuery({
    queryKey: ['public-trainers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('public_trainers').select('id,name_ar,name_en,photo_url,bio_ar,bio_en,country,city,email,phone,bike_type,years_of_experience,services,status,profit_ratio,motorbike_brand,license_type,bike_photos,album_photos,bike_entries,availability_blocked_dates,availability_special_hours,availability_settings,language_levels,user_id,created_at').eq('status', 'active');
      if (error) throw error;
      return data;
    },
    // Always refetch on mount + window focus so an admin's recent edit
    // (in another tab or within the same session) shows up here without
    // the user having to do a hard refresh. Cache invalidations from the
    // admin pages also reach this query, but `refetchOnMount: 'always'`
    // is a belt-and-braces guarantee for cross-tab freshness.
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 30_000, // 30s
  });

  const { data: reviewStats } = useQuery({
    queryKey: ['public-trainer-review-stats'],
    queryFn: async () => {
      const { data } = await supabase.from('trainer_reviews').select('trainer_id, rating');
      const stats: Record<string, { avg: number; count: number }> = {};
      const grouped: Record<string, number[]> = {};
      data?.forEach(r => { if (!grouped[r.trainer_id]) grouped[r.trainer_id] = []; grouped[r.trainer_id].push(r.rating); });
      Object.entries(grouped).forEach(([id, ratings]) => { stats[id] = { avg: ratings.reduce((a, b) => a + b, 0) / ratings.length, count: ratings.length }; });
      return stats;
    },
  });

  if (isLoading) return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <Skeleton className="h-10 w-60 mx-auto mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      </div>
    </section>
  );

  if (!trainers?.length) {
    return (
      <section className="py-16 bg-muted/30" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card/60 px-6 py-12 text-center shadow-sm backdrop-blur-sm">
            <div className="mb-5 text-6xl opacity-60" aria-hidden>
              🏍️
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-2">
              {isRTL ? 'نعمل على توسيع فريق المدربين' : "We're growing our trainer team"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {isRTL
                ? 'سيتم إضافة المدربين قريباً — ترقّب!'
                : 'Trainers will be added soon — stay tuned!'}
            </p>
            <Button onClick={() => navigate('/contact')}>
              {isRTL ? 'أشعرني عند الإطلاق' : 'Notify me'}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-muted/30" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="w-12 h-1 bg-primary mx-auto mb-4 rounded-full" />
          <h2 className="text-3xl font-black text-foreground mb-3">{isRTL ? 'مدربونا' : 'Our Trainers'}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">{isRTL ? 'تعرف على فريق المدربين المحترفين' : 'Meet our professional training team'}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {trainers.map((t) => {
            // Same location formatting helper used by the training detail
            // page so the headline reads identically across both surfaces.
            const countryEntry = COUNTRIES.find(
              (c) => c.code === t.country || c.en === t.country,
            );
            const cityEntry = countryEntry?.cities.find((c) => c.en === t.city);
            const displayLocation = [
              cityEntry ? (isRTL ? cityEntry.ar : cityEntry.en) : t.city,
              countryEntry ? (isRTL ? countryEntry.ar : countryEntry.en) : t.country,
            ].filter(Boolean).join(isRTL ? '، ' : ', ');

            // Match the meta rows produced by the training detail page so
            // both cards have the same visual density. Without context of a
            // specific training we can't show sessions/duration here, but
            // we can show the trainer's bike type + services count in
            // their place — keeping the card from looking sparse next to
            // its training-detail counterpart.
            const yoe = Number(t.years_of_experience);
            const metaRows: { id: string; icon: 'clock' | 'gauge' | 'map' | 'users'; text: string }[] = [];
            if (Number.isFinite(yoe) && yoe > 0) {
              metaRows.push({
                id: 'exp',
                icon: 'clock',
                text: isRTL
                  ? `${yoe} ${yoe === 1 ? 'سنة خبرة' : 'سنوات خبرة'}`
                  : `${yoe} ${yoe === 1 ? 'year' : 'years'} experience`,
              });
            }
            if (t.bike_type) {
              metaRows.push({
                id: 'bike',
                icon: 'gauge',
                text: t.bike_type,
              });
            }
            if (Array.isArray(t.services) && t.services.length > 0) {
              metaRows.push({
                id: 'svc',
                icon: 'users',
                text: isRTL
                  ? `${t.services.length} ${t.services.length === 1 ? 'خدمة' : 'خدمات'}`
                  : `${t.services.length} ${t.services.length === 1 ? 'service' : 'services'}`,
              });
            }

            const footer = (
              <Button
                variant="outline"
                size="sm"
                className="w-full font-semibold"
                asChild
              >
                <LocalizedLink to={`/trainers/${t.id}`}>{isRTL ? 'عرض الملف' : 'View Profile'}</LocalizedLink>
              </Button>
            );

            // profileHref makes the body clickable as a single Link;
            // wrapping the card in another <LocalizedLink> (the previous setup)
            // nested two clickable layers and broke nested buttons on
            // some browsers. Move to the same pattern TrainingDetail uses.
            return (
              <TrainerShowcaseCard
                key={t.id}
                trainer={t}
                isRTL={isRTL}
                reviewStats={reviewStats?.[t.id] || null}
                headline={displayLocation}
                bioPreview={isRTL ? t.bio_ar : t.bio_en}
                metaRows={metaRows}
                profileHref={`/trainers/${t.id}`}
                footer={footer}
                className="h-full border-border/60 shadow-sm hover:border-primary/40 hover:shadow-lg transition-shadow"
              />
            );
          })}
        </div>
      </div>

    </section>
  );
};

export default TrainersSection;
