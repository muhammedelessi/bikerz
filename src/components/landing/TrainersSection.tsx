import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, Bike, Clock, Users, ChevronRight, ChevronLeft } from 'lucide-react';
import TrainerProfileModal from '@/components/landing/TrainerProfileModal';
import { cn } from '@/lib/utils';

const TrainersSection: React.FC = () => {
  const { isRTL } = useLanguage();
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null);

  const { data: trainers, isLoading } = useQuery({
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
      data?.forEach(r => { if (!grouped[r.trainer_id]) grouped[r.trainer_id] = []; grouped[r.trainer_id].push(r.rating); });
      Object.entries(grouped).forEach(([id, ratings]) => { stats[id] = { avg: ratings.reduce((a, b) => a + b, 0) / ratings.length, count: ratings.length }; });
      return stats;
    },
  });

  const { data: studentCounts } = useQuery({
    queryKey: ['public-trainer-student-counts'],
    queryFn: async () => {
      const { data } = await supabase.from('training_students').select('trainer_id');
      const counts: Record<string, number> = {};
      data?.forEach(s => { counts[s.trainer_id] = (counts[s.trainer_id] || 0) + 1; });
      return counts;
    },
  });

  if (isLoading) return (
    <section className="py-12 sm:py-16 bg-muted/30">
      <div className="container mx-auto px-4 max-w-[1200px]">
        <Skeleton className="h-10 w-60 mx-auto mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-[280px] rounded-2xl" />)}
        </div>
      </div>
    </section>
  );

  if (!trainers?.length) return null;

  const Arrow = isRTL ? ChevronLeft : ChevronRight;

  return (
    <section className="py-12 sm:py-16 bg-muted/30">
      <div className="container mx-auto px-4 max-w-[1200px]">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-10 h-1 bg-primary mx-auto mb-4 rounded-full" />
          <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-2">
            {isRTL ? 'مدربونا المحترفون' : 'Meet Our Expert Trainers'}
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
            {isRTL ? 'تعلم من أفضل المدربين المحترفين في المنطقة' : 'Learn from the best certified professionals in the region'}
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {trainers.map(t => {
            const stats = reviewStats?.[t.id];
            const students = studentCounts?.[t.id] || 0;
            const name = isRTL ? t.name_ar : t.name_en;
            const initials = name?.charAt(0) || '?';

            return (
              <div
                key={t.id}
                onClick={() => setSelectedTrainerId(t.id)}
                className={cn(
                  "group relative bg-card rounded-2xl border border-border/60 overflow-hidden cursor-pointer",
                  "transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 hover:border-primary/30"
                )}
              >
                {/* Top gradient band */}
                <div className="h-20 bg-gradient-to-br from-primary/80 to-primary/40 relative">
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz48L3N2Zz4=')] opacity-60" />
                </div>

                {/* Avatar - overlapping the gradient */}
                <div className="flex justify-center -mt-10 relative z-10">
                  <div className="w-20 h-20 rounded-full border-4 border-card overflow-hidden bg-muted shadow-lg">
                    {t.photo_url ? (
                      <img src={t.photo_url} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-2xl font-bold">
                        {initials}
                      </div>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="px-5 pb-5 pt-3 text-center">
                  <h3 className="text-base font-bold text-foreground mb-1 line-clamp-1">{name}</h3>

                  {/* Rating */}
                  {stats && (
                    <div className="flex items-center justify-center gap-1 mb-3">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star
                            key={s}
                            className={cn(
                              "w-3.5 h-3.5",
                              s <= Math.round(stats.avg)
                                ? "fill-amber-400 text-amber-400"
                                : "fill-muted text-muted"
                            )}
                          />
                        ))}
                      </div>
                      <span className="text-xs font-semibold text-foreground ms-1">{stats.avg.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">({stats.count})</span>
                    </div>
                  )}

                  {/* Stats row */}
                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-primary/70" />
                      <span>{t.years_of_experience} {isRTL ? 'سنة خبرة' : 'yrs exp'}</span>
                    </div>
                    <div className="w-px h-3 bg-border" />
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-primary/70" />
                      <span>{students} {isRTL ? 'متدرب' : 'students'}</span>
                    </div>
                  </div>

                  {/* Bike badge */}
                  {t.bike_type && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-xs font-medium text-muted-foreground mb-4">
                      <Bike className="w-3.5 h-3.5" />
                      {t.bike_type}
                    </div>
                  )}

                  {/* CTA */}
                  <button className="w-full flex items-center justify-center gap-1 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-semibold transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    {isRTL ? 'عرض الملف الشخصي' : 'View Profile'}
                    <Arrow className="w-4 h-4 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TrainerProfileModal trainerId={selectedTrainerId} onClose={() => setSelectedTrainerId(null)} />
    </section>
  );
};

export default TrainersSection;
