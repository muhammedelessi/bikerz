import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, MapPin, Bike, Clock, Users } from 'lucide-react';
import TrainerProfileModal from '@/components/landing/TrainerProfileModal';

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
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <Skeleton className="h-10 w-60 mx-auto mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      </div>
    </section>
  );

  if (!trainers?.length) return null;

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="w-12 h-1 bg-primary mx-auto mb-4 rounded-full" />
          <h2 className="text-3xl font-black text-foreground mb-3">{isRTL ? 'مدربونا' : 'Our Trainers'}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">{isRTL ? 'تعرف على فريق المدربين المحترفين' : 'Meet our professional training team'}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {trainers.map(t => {
            const stats = reviewStats?.[t.id];
            return (
              <Card key={t.id} className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group" onClick={() => setSelectedTrainerId(t.id)}>
                <CardContent className="p-6 text-center">
                  <Avatar className="h-24 w-24 mx-auto mb-4 ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all">
                    <AvatarImage src={t.photo_url || ''} />
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary">{(isRTL ? t.name_ar : t.name_en).charAt(0)}</AvatarFallback>
                  </Avatar>
                  <h3 className="text-lg font-bold text-foreground mb-1">{isRTL ? t.name_ar : t.name_en}</h3>
                  {stats && (
                    <div className="flex items-center justify-center gap-1 mb-3">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <span className="text-sm font-medium">{stats.avg.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">({stats.count})</span>
                    </div>
                  )}
                  <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{t.years_of_experience} {isRTL ? 'سنة' : 'yrs'}</div>
                    <div className="flex items-center gap-1"><Bike className="w-3.5 h-3.5" />{t.bike_type}</div>
                    <div className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{studentCounts?.[t.id] || 0}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <TrainerProfileModal trainerId={selectedTrainerId} onClose={() => setSelectedTrainerId(null)} />
    </section>
  );
};

export default TrainersSection;
