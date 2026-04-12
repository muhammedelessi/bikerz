import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, ChevronLeft, ChevronRight } from 'lucide-react';
import TrainerShowcaseCard from '@/components/landing/TrainerShowcaseCard';
import { translateTrainerHomeLocation } from '@/lib/trainerCourseLocation';
import { Button } from '@/components/ui/button';

const TrainersSection: React.FC = () => {
  const { isRTL } = useLanguage();

  const { data: trainers, isLoading, isError } = useQuery({
    queryKey: ['public-trainers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('trainers').select('*').eq('status', 'active');
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
      data?.forEach((r) => {
        if (!grouped[r.trainer_id]) grouped[r.trainer_id] = [];
        grouped[r.trainer_id].push(r.rating);
      });
      Object.entries(grouped).forEach(([tid, ratings]) => {
        stats[tid] = {
          avg: ratings.reduce((a, b) => a + b, 0) / ratings.length,
          count: ratings.length,
        };
      });
      return stats;
    },
  });

  if (isLoading)
    return (
      <section className="py-12 sm:py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-[1200px]">
          <Skeleton className="h-10 w-60 mx-auto mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[280px] rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );

  const showGrid = !isError && !!trainers?.length;

  return (
    <section className="py-12 sm:py-16 bg-muted/30">
      <div className="container mx-auto px-4 max-w-[1200px]">
        <div className="text-center mb-10">
          <div className="w-10 h-1 bg-primary mx-auto mb-4 rounded-full" />
          <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-2">
            {isRTL ? 'مدربونا المحترفون' : 'Meet Our Expert Trainers'}
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
            {isRTL ? 'تعلم من أفضل المدربين المحترفين في المنطقة' : 'Learn from the best certified professionals in the region'}
          </p>
        </div>

        {isError && (
          <div className="text-center py-14 px-4">
            <p className="text-muted-foreground">
              {isRTL ? 'تعذر تحميل المدربين. حاول مرة أخرى لاحقاً.' : 'Could not load trainers. Please try again later.'}
            </p>
          </div>
        )}

        {!isError && !trainers?.length && (
          <div className="text-center py-14 px-4">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
              <Users className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              {isRTL ? 'لا يوجد مدربون معروضون حالياً' : 'No trainers listed yet'}
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto text-sm sm:text-base">
              {isRTL ? 'سيتم إضافة المدربين قريباً.' : 'Trainers will appear here once they are added.'}
            </p>
          </div>
        )}

        {showGrid && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {trainers!.map((t) => {
              const stats = reviewStats?.[t.id];
              const bio = isRTL ? t.bio_ar || t.bio_en : t.bio_en || t.bio_ar || '';
              const loc = translateTrainerHomeLocation(t.country, t.city, isRTL) || [t.city, t.country].filter(Boolean).join(' - ');
              const y = Number(t.years_of_experience);
              const expText = isRTL
                ? `${y} ${y === 1 ? 'سنة خبرة' : 'سنوات خبرة'}`
                : `${y} ${y === 1 ? 'yr exp' : 'yrs exp'}`;
              const ProfileIcon = isRTL ? ChevronLeft : ChevronRight;

              return (
                <TrainerShowcaseCard
                  key={t.id}
                  trainer={{ name_ar: t.name_ar, name_en: t.name_en, photo_url: t.photo_url }}
                  isRTL={isRTL}
                  reviewStats={stats}
                  headline={loc}
                  bioPreview={bio || null}
                  metaRows={[{ id: 'exp', icon: 'clock', text: expText }]}
                  footer={
                    <Button type="button" className="w-full font-semibold gap-2" asChild>
                      <Link to={`/trainers/${t.id}`}>
                        {isRTL ? 'عرض الملف الشخصي' : 'View Profile'}
                        <ProfileIcon className="h-4 w-4 opacity-90" />
                      </Link>
                    </Button>
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default TrainersSection;
