import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Star, Users, MapPin, Bike, Clock, BookOpen, Briefcase, User } from 'lucide-react';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Trainer {
  id: string;
  name_ar: string;
  name_en: string;
  photo_url: string | null;
  bio_ar: string;
  bio_en: string;
  country: string;
  city: string;
  bike_type: string;
  years_of_experience: number;
  services: string[];
  status: string;
  created_at: string;
  profit_ratio: number;
}

interface TrainerProfileDialogProps {
  trainer: Trainer | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const TrainerProfileDialog: React.FC<TrainerProfileDialogProps> = ({ trainer, open, onOpenChange }) => {
  const { isRTL } = useLanguage();

  const { data: students, isLoading: loadingStudents } = useQuery({
    queryKey: ['trainer-profile-students', trainer?.id],
    queryFn: async () => {
      const { data } = await supabase.from('training_students').select('*').eq('trainer_id', trainer!.id).order('enrolled_at', { ascending: false });
      return data || [];
    },
    enabled: !!trainer,
  });

  const { data: reviews, isLoading: loadingReviews } = useQuery({
    queryKey: ['trainer-profile-reviews', trainer?.id],
    queryFn: async () => {
      const { data } = await supabase.from('trainer_reviews').select('*').eq('trainer_id', trainer!.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!trainer,
  });

  const { data: trainerCourses, isLoading: loadingCourses } = useQuery({
    queryKey: ['trainer-profile-courses', trainer?.id],
    queryFn: async () => {
      const { data } = await supabase.from('trainer_courses').select('*, trainings(name_ar, name_en)').eq('trainer_id', trainer!.id);
      return data || [];
    },
    enabled: !!trainer,
  });

  if (!trainer) return null;

  const avgRating = reviews?.length ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1) : '0.0';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="sr-only">{isRTL ? 'ملف المدرب' : 'Trainer Profile'}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[80vh]">
          <div className="p-6 pt-2 space-y-6">
            {/* Header */}
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 border-2 border-border">
                <AvatarImage src={trainer.photo_url || ''} />
                <AvatarFallback className="text-lg bg-primary/10 text-primary">{trainer.name_en.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold">{isRTL ? trainer.name_ar : trainer.name_en}</h2>
                <p className="text-sm text-muted-foreground">{isRTL ? trainer.name_en : trainer.name_ar}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge className={trainer.status === 'active' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' : ''} variant={trainer.status === 'active' ? 'default' : 'outline'}>
                    {trainer.status === 'active' ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive')}
                  </Badge>
                  <Badge variant="secondary" className="gap-1"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{avgRating} ({reviews?.length || 0})</Badge>
                  <Badge variant="secondary" className="gap-1"><Users className="w-3 h-3" />{students?.length || 0} {isRTL ? 'طالب' : 'students'}</Badge>
                </div>
              </div>
            </div>

            {/* Personal Info Grid */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {isRTL ? 'المعلومات الشخصية' : 'Personal Info'}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{isRTL ? 'الموقع' : 'Location'}</p>
                      <p className="font-medium">{trainer.city}, {trainer.country}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Bike className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{isRTL ? 'نوع الدراجة' : 'Bike Type'}</p>
                      <p className="font-medium">{trainer.bike_type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{isRTL ? 'الخبرة' : 'Experience'}</p>
                      <p className="font-medium">{trainer.years_of_experience} {isRTL ? 'سنة' : 'years'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{isRTL ? 'نسبة الربح' : 'Profit Ratio'}</p>
                      <p className="font-medium">{trainer.profit_ratio}%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <User className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{isRTL ? 'تاريخ الانضمام' : 'Joined'}</p>
                      <p className="font-medium">{format(new Date(trainer.created_at), 'yyyy-MM-dd')}</p>
                    </div>
                  </div>
                </div>
                {trainer.bio_ar || trainer.bio_en ? (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-1">{isRTL ? 'نبذة' : 'Bio'}</p>
                    <p className="text-sm leading-relaxed">{isRTL ? trainer.bio_ar : trainer.bio_en}</p>
                  </div>
                ) : null}
                {trainer.services?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">{isRTL ? 'الخدمات' : 'Services'}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {trainer.services.map((s, i) => <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tabs: Trainings, Students, Reviews */}
            <Tabs defaultValue="trainings">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="trainings" className="gap-1.5 text-xs">
                  <BookOpen className="w-3.5 h-3.5" />
                  {isRTL ? 'التدريبات' : 'Trainings'}
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] ms-1">{trainerCourses?.length || 0}</Badge>
                </TabsTrigger>
                <TabsTrigger value="students" className="gap-1.5 text-xs">
                  <Users className="w-3.5 h-3.5" />
                  {isRTL ? 'الطلاب' : 'Students'}
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] ms-1">{students?.length || 0}</Badge>
                </TabsTrigger>
                <TabsTrigger value="reviews" className="gap-1.5 text-xs">
                  <Star className="w-3.5 h-3.5" />
                  {isRTL ? 'التقييمات' : 'Reviews'}
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] ms-1">{reviews?.length || 0}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="trainings" className="mt-3">
                {loadingCourses ? (
                  <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
                ) : !trainerCourses?.length ? (
                  <p className="text-center py-8 text-sm text-muted-foreground">{isRTL ? 'لا توجد تدريبات معينة' : 'No trainings assigned'}</p>
                ) : (
                  <div className="space-y-2">
                    {trainerCourses.map((tc: any) => (
                      <Card key={tc.id || tc.training_id}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">{isRTL ? tc.trainings?.name_ar : tc.trainings?.name_en}</span>
                            <Badge variant="outline" className="text-xs">{tc.price} {isRTL ? 'ر.س' : 'SAR'}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{tc.duration_hours} {isRTL ? 'ساعات' : 'hrs'}</span>
                            {tc.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{tc.location}</span>}
                          </div>
                          {tc.services?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {tc.services.map((s: string, i: number) => <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0.5">{s}</Badge>)}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

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
                        <TableHead className="h-8">{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map(s => (
                        <TableRow key={s.id} className="text-xs">
                          <TableCell className="py-2">{s.full_name}</TableCell>
                          <TableCell className="py-2" dir="ltr">{s.phone}</TableCell>
                          <TableCell className="py-2">{s.email}</TableCell>
                          <TableCell className="py-2">{format(new Date(s.enrolled_at), 'yyyy-MM-dd')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="reviews" className="mt-3">
                {loadingReviews ? (
                  <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
                ) : !reviews?.length ? (
                  <p className="text-center py-8 text-sm text-muted-foreground">{isRTL ? 'لا توجد تقييمات' : 'No reviews yet'}</p>
                ) : (
                  <div className="space-y-2">
                    {reviews.map(r => (
                      <div key={r.id} className="rounded-lg border border-border p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{r.student_name}</span>
                          <span className="text-xs text-muted-foreground">{format(new Date(r.created_at), 'yyyy-MM-dd')}</span>
                        </div>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`w-3.5 h-3.5 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                          ))}
                        </div>
                        {r.comment && <p className="text-xs text-muted-foreground leading-relaxed">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default TrainerProfileDialog;
