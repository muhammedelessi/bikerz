import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { COUNTRIES } from '@/data/countryCityData';
import TrainerShowcaseCard from '@/components/landing/TrainerShowcaseCard';

const TrainersSection: React.FC = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();

  const { data: trainers, isLoading } = useQuery({
    queryKey: ['public-trainers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('public_trainers').select('id,name_ar,name_en,photo_url,bio_ar,bio_en,country,city,bike_type,years_of_experience,services,status,profit_ratio,motorbike_brand,license_type,bike_photos,album_photos,bike_entries,availability_blocked_dates,availability_special_hours,availability_settings,language_levels,user_id,created_at').eq('status', 'active');
      if (error) throw error;
      return data;
    },
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
          {trainers.map(t => {
            const countryEntry = COUNTRIES.find(
              (c) => c.code === t.country || c.en === t.country,
            );
            const cityEntry = countryEntry?.cities.find((c) => c.en === t.city);
            const displayLocation = [
              cityEntry ? (isRTL ? cityEntry.ar : cityEntry.en) : t.city,
              countryEntry ? (isRTL ? countryEntry.ar : countryEntry.en) : t.country,
            ].filter(Boolean).join(isRTL ? '، ' : ', ');

            const metaRows = [
              {
                id: 'exp',
                icon: 'clock' as const,
                text: isRTL
                  ? `${t.years_of_experience} سنوات خبرة`
                  : `${t.years_of_experience} years experience`,
              },
            ].filter(Boolean);

            const footer = (
              <div className="flex">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(`/trainers/${t.id}`);
                  }}
                >
                  {isRTL ? 'عرض الملف' : 'View Profile'}
                </Button>
              </div>
            );

            return (
              <Link key={t.id} to={`/trainers/${t.id}`} className="block">
                <TrainerShowcaseCard
                  trainer={t}
                  isRTL={isRTL}
                  reviewStats={reviewStats?.[t.id] || null}
                  headline={displayLocation}
                  bioPreview={isRTL ? t.bio_ar : t.bio_en}
                  metaRows={metaRows}
                  footer={footer}
                  className="cursor-pointer hover:border-primary/40 hover:shadow-lg"
                />
              </Link>
            );
          })}
        </div>
      </div>

    </section>
  );
};

export default TrainersSection;
