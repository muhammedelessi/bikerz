import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Bike, Clock, Users } from 'lucide-react';

const TrainingsSection: React.FC = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();

  const { data: trainings, isLoading } = useQuery({
    queryKey: ['public-trainings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('trainings').select('*').eq('status', 'active');
      if (error) throw error;
      return data;
    },
  });

  const { data: trainerCourses } = useQuery({
    queryKey: ['public-trainer-courses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('trainer_courses').select('id, training_id, trainer_id');
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

  const levelColors: Record<string, string> = { beginner: 'bg-green-500/10 text-green-600', intermediate: 'bg-amber-500/10 text-amber-600', advanced: 'bg-red-500/10 text-red-600' };
  const levelLabels: Record<string, { en: string; ar: string }> = { beginner: { en: 'Beginner', ar: 'مبتدئ' }, intermediate: { en: 'Intermediate', ar: 'متوسط' }, advanced: { en: 'Advanced', ar: 'متقدم' } };

  const levelLabel = (level: string) => (isRTL ? levelLabels[level]?.ar : levelLabels[level]?.en) || level;

  if (isLoading) return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <Skeleton className="h-10 w-60 mx-auto mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    </section>
  );

  if (!trainings?.length) {
    return (
      <section className="py-16" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card/60 px-6 py-12 text-center shadow-sm backdrop-blur-sm">
            <div className="mb-5 text-6xl opacity-60" aria-hidden>
              🏁
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-2">
              {isRTL ? 'التدريب قيد الإعداد' : 'Trainings are being prepared'}
            </h2>
            <p className="text-muted-foreground mb-6">
              {isRTL ? 'سيتم إطلاق برامج التدريب العملي قريباً' : 'Training programs launching soon'}
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
    <section className="py-16" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="w-12 h-1 bg-primary mx-auto mb-4 rounded-full" />
          <h2 className="text-3xl font-black text-foreground mb-3">{isRTL ? 'التدريبات المتاحة' : 'Available Trainings'}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">{isRTL ? 'اختر التدريب المناسب لك وابدأ رحلتك' : 'Choose the right training and start your journey'}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {trainings.map((training) => {
            const trainingTrainers = trainerCourses?.filter((tc) => tc.training_id === training.id) || [];
            const trainerCount = trainingTrainers.length;
            const displayDescription = isRTL ? training.description_ar : training.description_en;
            return (
              <div
                key={training.id}
                className="group relative rounded-2xl overflow-hidden border border-border hover:border-primary/40 transition-all cursor-pointer shadow-sm hover:shadow-md"
                onClick={() => navigate(`/trainings/${training.id}`)}
              >
                <div className="relative h-44 bg-muted">
                  {training.background_image ? (
                    <img
                      src={training.background_image}
                      alt={isRTL ? training.name_ar : training.name_en}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/10">
                      <Bike className="w-12 h-12 text-primary/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                  <div className="absolute top-3 start-3 flex gap-1.5">
                    <Badge>
                      {isRTL
                        ? (training.type === 'practical' ? 'عملي' : 'نظري')
                        : (training.type === 'practical' ? 'Practical' : 'Theory')}
                    </Badge>
                    <Badge variant="outline" className={levelColors[training.level]}>
                      {levelLabel(training.level)}
                    </Badge>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <h3 className="font-bold text-base leading-snug">
                    {isRTL ? training.name_ar : training.name_en}
                  </h3>
                  {displayDescription && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {displayDescription}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {trainerCount} {isRTL ? 'مدرب' : 'trainers'}
                    </span>
                    {training.default_sessions_count && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {training.default_sessions_count} {isRTL ? 'جلسات' : 'sessions'}
                      </span>
                    )}
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/trainings/${training.id}`);
                    }}
                  >
                    {isRTL ? 'احجز الآن' : 'Book Now'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TrainingsSection;
