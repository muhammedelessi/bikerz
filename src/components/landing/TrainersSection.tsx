import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, Award, Calendar, Users, ChevronRight, ChevronLeft, Gauge } from 'lucide-react';
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
        <div className="text-center mb-10">
          <div className="w-10 h-1 bg-primary mx-auto mb-4 rounded-full" />
          <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-2">
            {isRTL ? 'مدربونا المحترفون' : 'Meet Our Expert Trainers'}
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
            {isRTL ? 'تعلم من أفضل المدربين المحترفين في المنطقة' : 'Learn from the best certified professionals in the region'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {trainers.map(t => {
            const stats = reviewStats?.[t.id];
            const students = studentCounts?.[t.id] || 0;
            const name = isRTL ? t.name_ar : t.name_en;
            const initials = name?.charAt(0) || '?';
            const bio = isRTL ? (t.bio_ar || t.bio_en) : (t.bio_en || '');

            return (
              <div
                key={t.id}
                onClick={() => setSelectedTrainerId(t.id)}
                className={cn(
                  "group relative bg-card rounded-2xl border border-border/60 overflow-hidden cursor-pointer flex flex-col",
                  "transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 hover:border-primary/30"
                )}
              >
                <div className="p-5 flex-1 flex flex-col">
                  {/* Avatar + Name row */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-muted shrink-0 ring-2 ring-primary/10">
                      {t.photo_url ? (
                        <img src={t.photo_url} alt={name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-xl font-bold">
                          {initials}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-foreground line-clamp-1">{name}</h3>
                      {stats && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span className="text-xs font-semibold text-foreground">{stats.avg.toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground">({stats.count} {isRTL ? 'تقييم' : 'reviews'})</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bio - 2 lines */}
                  {bio && (
                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mb-4">{bio}</p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-auto mb-0">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-primary/70" />
                      <span>{t.years_of_experience} {isRTL ? 'سنة خبرة' : 'yrs exp'}</span>
                    </div>
                    <div className="w-px h-3 bg-border" />
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-primary/70" />
                      <span>{students} {isRTL ? 'متدرب' : 'students'}</span>
                    </div>
                    {t.bike_type && (
                      <>
                        <div className="w-px h-3 bg-border" />
                        <div className="flex items-center gap-1.5">
                          <Gauge className="w-3.5 h-3.5 text-primary/70" />
                          <span>{t.bike_type}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* CTA - always at bottom */}
                <div className="px-5 pb-5">
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
