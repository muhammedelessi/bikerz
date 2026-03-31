import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BookOpen, Dumbbell, Star, MapPin, Clock, DollarSign } from 'lucide-react';
import TrainerProfileModal from '@/components/landing/TrainerProfileModal';

const TrainingsSection: React.FC = () => {
  const { isRTL } = useLanguage();
  const [selectedTraining, setSelectedTraining] = useState<any>(null);
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null);

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
      const { data, error } = await supabase.from('trainer_courses').select('*, trainers(*)');
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

  const getTrainersForTraining = (trainingId: string) => trainerCourses?.filter(tc => tc.training_id === trainingId) || [];

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

  if (!trainings?.length) return null;

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="w-12 h-1 bg-primary mx-auto mb-4 rounded-full" />
          <h2 className="text-3xl font-black text-foreground mb-3">{isRTL ? 'التدريبات المتاحة' : 'Available Trainings'}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">{isRTL ? 'اختر التدريب المناسب لك وابدأ رحلتك' : 'Choose the right training and start your journey'}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {trainings.map(t => (
            <Card key={t.id} className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group" onClick={() => setSelectedTraining(t)}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-primary text-primary-foreground">
                    {t.type === 'theory' ? <BookOpen className="w-6 h-6" /> : <Dumbbell className="w-6 h-6" />}
                  </div>
                  <Badge variant="outline" className={levelColors[t.level]}>{isRTL ? levelLabels[t.level]?.ar : levelLabels[t.level]?.en}</Badge>
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{isRTL ? t.name_ar : t.name_en}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{isRTL ? t.description_ar : t.description_en}</p>
                <Badge variant="secondary">{t.type === 'theory' ? (isRTL ? 'نظري' : 'Theory') : (isRTL ? 'عملي' : 'Practical')}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Training Detail Dialog */}
      <Dialog open={!!selectedTraining} onOpenChange={() => setSelectedTraining(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedTraining && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{isRTL ? selectedTraining.name_ar : selectedTraining.name_en}</DialogTitle>
              </DialogHeader>
              <p className="text-muted-foreground">{isRTL ? selectedTraining.description_ar : selectedTraining.description_en}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="secondary">{selectedTraining.type === 'theory' ? (isRTL ? 'نظري' : 'Theory') : (isRTL ? 'عملي' : 'Practical')}</Badge>
                <Badge variant="outline" className={levelColors[selectedTraining.level]}>{isRTL ? levelLabels[selectedTraining.level]?.ar : levelLabels[selectedTraining.level]?.en}</Badge>
              </div>
              <h3 className="text-lg font-semibold mt-6 mb-3">{isRTL ? 'المدربون المتاحون' : 'Available Trainers'}</h3>
              <div className="space-y-3">
                {getTrainersForTraining(selectedTraining.id).map((tc: any) => {
                  const trainer = tc.trainers;
                  if (!trainer) return null;
                  const stats = reviewStats?.[trainer.id];
                  return (
                    <Card key={tc.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => { setSelectedTraining(null); setSelectedTrainerId(trainer.id); }}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <Avatar className="h-14 w-14">
                          <AvatarImage src={trainer.photo_url || ''} />
                          <AvatarFallback>{(isRTL ? trainer.name_ar : trainer.name_en).charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground">{isRTL ? trainer.name_ar : trainer.name_en}</h4>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                            {stats && <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />{stats.avg.toFixed(1)}</span>}
                            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{Number(tc.duration_hours)}h</span>
                            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{tc.location}</span>
                            <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />{Number(tc.price)} SAR</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {getTrainersForTraining(selectedTraining.id).length === 0 && (
                  <p className="text-center text-muted-foreground py-4">{isRTL ? 'لا يوجد مدربون لهذا التدريب حالياً' : 'No trainers available for this training yet'}</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <TrainerProfileModal trainerId={selectedTrainerId} onClose={() => setSelectedTrainerId(null)} />
    </section>
  );
};

export default TrainingsSection;
