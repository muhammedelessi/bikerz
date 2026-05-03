import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Star, MapPin, Bike, Clock, Users, DollarSign } from 'lucide-react';

interface TrainerProfileModalProps {
  trainerId: string | null;
  onClose: () => void;
}

const TrainerProfileModal: React.FC<TrainerProfileModalProps> = ({ trainerId, onClose }) => {
  const { isRTL } = useLanguage();

  const { data: trainer, isLoading } = useQuery({
    queryKey: ['trainer-profile', trainerId],
    queryFn: async () => {
      if (!trainerId) return null;
      const { data, error } = await supabase.from('public_trainers').select('id,name_ar,name_en,photo_url,bio_ar,bio_en,country,city,bike_type,years_of_experience,services,status,profit_ratio,motorbike_brand,license_type,bike_photos,album_photos,bike_entries,availability_blocked_dates,availability_special_hours,availability_settings,language_levels,user_id,created_at').eq('id', trainerId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!trainerId,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const { data: trainerCourses } = useQuery({
    queryKey: ['trainer-courses', trainerId],
    queryFn: async () => {
      if (!trainerId) return [];
      const { data, error } = await supabase.from('trainer_courses').select('*, trainings(*)').eq('trainer_id', trainerId);
      if (error) throw error;
      return data;
    },
    enabled: !!trainerId,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const { data: reviews } = useQuery({
    queryKey: ['trainer-reviews', trainerId],
    queryFn: async () => {
      if (!trainerId) return [];
      const { data, error } = await supabase.from('trainer_reviews').select('*').eq('trainer_id', trainerId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!trainerId,
  });

  const { data: studentCount } = useQuery({
    queryKey: ['trainer-student-count', trainerId],
    queryFn: async () => {
      if (!trainerId) return 0;
      const { count } = await supabase.from('training_students').select('*', { count: 'exact', head: true }).eq('trainer_id', trainerId);
      return count || 0;
    },
    enabled: !!trainerId,
  });

  const avgRating = reviews?.length ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length) : 0;

  return (
    <Dialog open={!!trainerId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4"><Skeleton className="h-24 w-24 rounded-full mx-auto" /><Skeleton className="h-6 w-48 mx-auto" /><Skeleton className="h-20 w-full" /></div>
        ) : trainer ? (
          <>
            <DialogHeader>
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-24 w-24 mb-4 ring-2 ring-primary/20">
                  <AvatarImage src={trainer.photo_url || ''} />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">{(isRTL ? trainer.name_ar : trainer.name_en).charAt(0)}</AvatarFallback>
                </Avatar>
                <DialogTitle className="text-xl">{isRTL ? trainer.name_ar : trainer.name_en}</DialogTitle>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                  <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{trainer.city}, {trainer.country}</span>
                  <span className="flex items-center gap-1"><Bike className="w-4 h-4" />{trainer.bike_type}</span>
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{trainer.years_of_experience} {isRTL ? 'سنة' : 'yrs'}</span>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  {reviews && reviews.length > 0 && (
                    <div className="flex items-center gap-1"><Star className="w-4 h-4 fill-amber-400 text-amber-400" /><span className="font-medium">{avgRating.toFixed(1)}</span><span className="text-xs text-muted-foreground">({reviews.length})</span></div>
                  )}
                  <div className="flex items-center gap-1 text-sm"><Users className="w-4 h-4" />{studentCount} {isRTL ? 'طالب' : 'students'}</div>
                </div>
              </div>
            </DialogHeader>

            {/* Bio */}
            <p className="text-muted-foreground text-sm">{isRTL ? trainer.bio_ar : trainer.bio_en}</p>

            {/* Services */}
            {trainer.services && trainer.services.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">{isRTL ? 'الخدمات' : 'Services'}</h4>
                <div className="flex flex-wrap gap-2">{trainer.services.map((s: string, i: number) => <Badge key={i} variant="secondary">{s}</Badge>)}</div>
              </div>
            )}

            <Separator />

            {/* Assigned Trainings */}
            {trainerCourses && trainerCourses.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3">{isRTL ? 'التدريبات' : 'Trainings'}</h4>
                <div className="space-y-2">
                  {trainerCourses.map((tc: any) => {
                    const training = tc.trainings;
                    if (!training) return null;
                    return (
                      <Card key={tc.id}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <span className="font-medium text-sm">{isRTL ? training.name_ar : training.name_en}</span>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />{Number(tc.price)} SAR</span>
                            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{Number(tc.duration_hours)}h</span>
                            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{tc.location}</span>
                          </div>
                          {(tc as { location_detail?: string }).location_detail && (
                            <p className="text-[10px] text-muted-foreground/70 mt-1 truncate">{(tc as { location_detail?: string }).location_detail}</p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            <Separator />

            {/* Reviews */}
            <div>
              <h4 className="font-semibold mb-3">{isRTL ? 'التقييمات' : 'Reviews'}</h4>
              {reviews && reviews.length > 0 ? (
                <div className="space-y-3">
                  {reviews.map(r => (
                    <Card key={r.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{r.student_name}</span>
                          <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`w-3.5 h-3.5 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted'}`} />)}</div>
                        </div>
                        <p className="text-sm text-muted-foreground">{r.comment}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">{isRTL ? 'لا توجد تقييمات بعد' : 'No reviews yet'}</p>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default TrainerProfileModal;
