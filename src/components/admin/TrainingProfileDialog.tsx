import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Star, Users, MapPin, Bike, Clock, BookOpen, Info, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';

interface Training {
  id: string;
  name_ar: string;
  name_en: string;
  type: string;
  description_ar: string;
  description_en: string;
  level: string;
  status: string;
  created_at: string;
  background_image: string | null;
}

interface TrainingProfileDialogProps {
  training: Training | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const TrainingProfileDialog: React.FC<TrainingProfileDialogProps> = ({ training, open, onOpenChange }) => {
  const { isRTL } = useLanguage();
  const [expandedTrainerId, setExpandedTrainerId] = useState<string | null>(null);

  // Fetch trainers assigned to this training with their details
  const { data: trainerCourses, isLoading: loadingTrainers } = useQuery({
    queryKey: ['training-profile-trainers', training?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('trainer_courses')
        .select('*, trainers(id, name_ar, name_en, photo_url, city, country, bike_type, years_of_experience, status, services, bio_ar, bio_en, profit_ratio)')
        .eq('training_id', training!.id);
      return data || [];
    },
    enabled: !!training,
  });

  // Fetch all students for this training
  const { data: students, isLoading: loadingStudents } = useQuery({
    queryKey: ['training-profile-students', training?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('training_students')
        .select('*')
        .eq('training_id', training!.id)
        .order('enrolled_at', { ascending: false });
      return data || [];
    },
    enabled: !!training,
  });

  // Fetch reviews for all trainers in this training
  const trainerIds = trainerCourses?.map((tc: any) => tc.trainers?.id).filter(Boolean) || [];
  const { data: allReviews } = useQuery({
    queryKey: ['training-profile-reviews', training?.id, trainerIds],
    queryFn: async () => {
      if (!trainerIds.length) return [];
      const { data } = await supabase
        .from('trainer_reviews')
        .select('*')
        .in('trainer_id', trainerIds)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!training && trainerIds.length > 0,
  });

  // Fetch student counts per trainer for this training
  const { data: trainerStudentCounts } = useQuery({
    queryKey: ['training-profile-trainer-students', training?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('training_students')
        .select('trainer_id')
        .eq('training_id', training!.id);
      const counts: Record<string, number> = {};
      data?.forEach(s => { counts[s.trainer_id] = (counts[s.trainer_id] || 0) + 1; });
      return counts;
    },
    enabled: !!training,
  });

  if (!training) return null;

  const levelLabel = (level: string) => isRTL
    ? { beginner: 'مبتدئ', intermediate: 'متوسط', advanced: 'متقدم' }[level] || level
    : level.charAt(0).toUpperCase() + level.slice(1);

  const getTrainerReviews = (trainerId: string) => allReviews?.filter(r => r.trainer_id === trainerId) || [];
  const getTrainerAvgRating = (trainerId: string) => {
    const reviews = getTrainerReviews(trainerId);
    return reviews.length ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1) : '0.0';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="sr-only">{isRTL ? 'تفاصيل التدريب' : 'Training Details'}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[80vh]">
          <div className="p-6 pt-2 space-y-6">
            {/* Header with background image */}
            {training.background_image && (
              <div className="relative rounded-lg overflow-hidden h-32">
                <img src={training.background_image} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
              </div>
            )}

            <div>
              <h2 className="text-xl font-bold">{isRTL ? training.name_ar : training.name_en}</h2>
              <p className="text-sm text-muted-foreground">{isRTL ? training.name_en : training.name_ar}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline" className={training.type === 'theory' ? 'bg-purple-500/15 text-purple-500 border-purple-500/30' : 'bg-orange-500/15 text-orange-500 border-orange-500/30'}>
                  {training.type === 'theory' ? (isRTL ? 'نظري' : 'Theory') : (isRTL ? 'عملي' : 'Practical')}
                </Badge>
                <Badge variant="outline" className={
                  training.level === 'beginner' ? 'bg-blue-500/15 text-blue-500 border-blue-500/30' :
                  training.level === 'intermediate' ? 'bg-amber-500/15 text-amber-500 border-amber-500/30' :
                  'bg-red-500/15 text-red-500 border-red-500/30'
                }>
                  {levelLabel(training.level)}
                </Badge>
                <Badge className={training.status === 'active' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' : ''} variant={training.status === 'active' ? 'default' : 'outline'}>
                  {training.status === 'active' ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'مؤرشف' : 'Archived')}
                </Badge>
                <Badge variant="secondary" className="gap-1"><Users className="w-3 h-3" />{trainerCourses?.length || 0} {isRTL ? 'مدرب' : 'trainers'}</Badge>
                <Badge variant="secondary" className="gap-1"><Users className="w-3 h-3" />{students?.length || 0} {isRTL ? 'طالب' : 'students'}</Badge>
              </div>
            </div>

            {/* Description */}
            {(training.description_ar || training.description_en) && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">{isRTL ? 'الوصف' : 'Description'}</h3>
                  <p className="text-sm leading-relaxed">{isRTL ? training.description_ar : training.description_en}</p>
                </CardContent>
              </Card>
            )}

            {/* Tabs */}
            <Tabs defaultValue="trainers">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="trainers" className="gap-1.5 text-xs">
                  <Bike className="w-3.5 h-3.5" />
                  {isRTL ? 'المدربين' : 'Trainers'}
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] ms-1">{trainerCourses?.length || 0}</Badge>
                </TabsTrigger>
                <TabsTrigger value="students" className="gap-1.5 text-xs">
                  <Users className="w-3.5 h-3.5" />
                  {isRTL ? 'الطلاب' : 'Students'}
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] ms-1">{students?.length || 0}</Badge>
                </TabsTrigger>
              </TabsList>

              {/* Trainers Tab */}
              <TabsContent value="trainers" className="mt-3">
                {loadingTrainers ? (
                  <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>
                ) : !trainerCourses?.length ? (
                  <p className="text-center py-8 text-sm text-muted-foreground">{isRTL ? 'لا يوجد مدربين معينين' : 'No trainers assigned'}</p>
                ) : (
                  <div className="space-y-2">
                    {trainerCourses.map((tc: any) => {
                      const trainer = tc.trainers;
                      if (!trainer) return null;
                      const isExpanded = expandedTrainerId === trainer.id;
                      const trainerReviews = getTrainerReviews(trainer.id);
                      const avgRating = getTrainerAvgRating(trainer.id);
                      const stuCount = trainerStudentCounts?.[trainer.id] || 0;

                      return (
                        <Card key={tc.id || trainer.id} className="overflow-hidden">
                          <CardContent className="p-0">
                            {/* Trainer Summary Row */}
                            <button
                              className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-start"
                              onClick={() => setExpandedTrainerId(isExpanded ? null : trainer.id)}
                            >
                              <Avatar className="h-10 w-10 border border-border shrink-0">
                                <AvatarImage src={trainer.photo_url || ''} />
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">{trainer.name_en?.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">{isRTL ? trainer.name_ar : trainer.name_en}</div>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{trainer.city}, {trainer.country}</span>
                                  <span className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="w-3 h-3" />{tc.price} {isRTL ? 'ر.س' : 'SAR'}</span>
                                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{tc.duration_hours} {isRTL ? 'ساعات' : 'hrs'}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant="secondary" className="text-xs gap-1"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{avgRating}</Badge>
                                <Badge variant="secondary" className="text-xs gap-1"><Users className="w-3 h-3" />{stuCount}</Badge>
                                {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                              </div>
                            </button>

                            {/* Expanded Details */}
                            {isExpanded && (
                              <div className="border-t border-border p-4 space-y-4 bg-muted/20">
                                {/* Trainer Info */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">{isRTL ? 'نوع الدراجة' : 'Bike'}</span>
                                    <p className="font-medium">{trainer.bike_type}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">{isRTL ? 'الخبرة' : 'Experience'}</span>
                                    <p className="font-medium">{trainer.years_of_experience} {isRTL ? 'سنة' : 'years'}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">{isRTL ? 'نسبة الربح' : 'Profit'}</span>
                                    <p className="font-medium">{trainer.profit_ratio}%</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">{isRTL ? 'الحالة' : 'Status'}</span>
                                    <p className="font-medium">{trainer.status === 'active' ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive')}</p>
                                  </div>
                                </div>

                                {/* Location for this training */}
                                {tc.location && (
                                  <div className="text-xs">
                                    <span className="text-muted-foreground">{isRTL ? 'موقع التدريب' : 'Training Location'}: </span>
                                    <span className="font-medium">{tc.location}</span>
                                    {(tc as { location_detail?: string }).location_detail && (
                                      <p className="text-muted-foreground/70 mt-0.5">{(tc as { location_detail?: string }).location_detail}</p>
                                    )}
                                  </div>
                                )}

                                {/* Services */}
                                {tc.services?.length > 0 && (
                                  <div>
                                    <span className="text-xs text-muted-foreground">{isRTL ? 'الخدمات' : 'Services'}</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {tc.services.map((s: string, i: number) => <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0.5">{s}</Badge>)}
                                    </div>
                                  </div>
                                )}

                                {/* Reviews */}
                                <div>
                                  <span className="text-xs text-muted-foreground font-semibold">{isRTL ? 'التقييمات' : 'Reviews'} ({trainerReviews.length})</span>
                                  {trainerReviews.length === 0 ? (
                                    <p className="text-xs text-muted-foreground mt-1">{isRTL ? 'لا توجد تقييمات' : 'No reviews'}</p>
                                  ) : (
                                    <div className="space-y-1.5 mt-1.5 max-h-40 overflow-y-auto">
                                      {trainerReviews.slice(0, 5).map(r => (
                                        <div key={r.id} className="rounded-md border border-border p-2 text-xs space-y-1">
                                          <div className="flex items-center justify-between">
                                            <span className="font-medium">{r.student_name}</span>
                                            <span className="text-muted-foreground">{format(new Date(r.created_at), 'yyyy-MM-dd')}</span>
                                          </div>
                                          <div className="flex gap-0.5">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                              <Star key={i} className={`w-3 h-3 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                                            ))}
                                          </div>
                                          {r.comment && <p className="text-muted-foreground">{r.comment}</p>}
                                        </div>
                                      ))}
                                      {trainerReviews.length > 5 && (
                                        <p className="text-xs text-muted-foreground text-center">+{trainerReviews.length - 5} {isRTL ? 'المزيد' : 'more'}</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* Students Tab */}
              <TabsContent value="students" className="mt-3">
                {loadingStudents ? (
                  <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
                ) : !students?.length ? (
                  <p className="text-center py-8 text-sm text-muted-foreground">{isRTL ? 'لا يوجد طلاب' : 'No students yet'}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead className="h-8">{isRTL ? 'الاسم' : 'Name'}</TableHead>
                        <TableHead className="h-8">{isRTL ? 'الهاتف' : 'Phone'}</TableHead>
                        <TableHead className="h-8">{isRTL ? 'الإيميل' : 'Email'}</TableHead>
                        <TableHead className="h-8">{isRTL ? 'المدرب' : 'Trainer'}</TableHead>
                        <TableHead className="h-8">{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map(s => {
                        const trainerName = trainerCourses?.find((tc: any) => tc.trainers?.id === s.trainer_id)?.trainers;
                        return (
                          <TableRow key={s.id} className="text-xs">
                            <TableCell className="py-2">{s.full_name}</TableCell>
                            <TableCell className="py-2" dir="ltr">{s.phone}</TableCell>
                            <TableCell className="py-2">{s.email}</TableCell>
                            <TableCell className="py-2">{trainerName ? (isRTL ? trainerName.name_ar : trainerName.name_en) : '—'}</TableCell>
                            <TableCell className="py-2">{format(new Date(s.enrolled_at), 'yyyy-MM-dd')}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default TrainingProfileDialog;
