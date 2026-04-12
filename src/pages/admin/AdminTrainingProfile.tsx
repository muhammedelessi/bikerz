import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Star, Users, MapPin, Bike, Clock, BookOpen, DollarSign, ChevronDown, ChevronUp, ArrowLeft, ArrowRight, Briefcase, Shield } from 'lucide-react';
import { format } from 'date-fns';

const AdminTrainingProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const [expandedTrainerId, setExpandedTrainerId] = useState<string | null>(null);

  const { data: training, isLoading: loadingTraining } = useQuery({
    queryKey: ['admin-training-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('trainings').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: trainerCourses, isLoading: loadingTrainers } = useQuery({
    queryKey: ['training-profile-trainers', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('trainer_courses')
        .select('*, trainers(id, name_ar, name_en, photo_url, city, country, bike_type, motorbike_brand, license_type, years_of_experience, status, services, bio_ar, bio_en, profit_ratio)')
        .eq('training_id', id!);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: students, isLoading: loadingStudents } = useQuery({
    queryKey: ['training-profile-students', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('training_students')
        .select('*')
        .eq('training_id', id!)
        .order('enrolled_at', { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const trainerIds = trainerCourses?.map((tc: any) => tc.trainers?.id).filter(Boolean) || [];
  const { data: allReviews } = useQuery({
    queryKey: ['training-profile-reviews', id, trainerIds],
    queryFn: async () => {
      if (!trainerIds.length) return [];
      const { data } = await supabase
        .from('trainer_reviews')
        .select('*')
        .in('trainer_id', trainerIds)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!id && trainerIds.length > 0,
  });

  const { data: trainerStudentCounts } = useQuery({
    queryKey: ['training-profile-trainer-students', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('training_students')
        .select('trainer_id')
        .eq('training_id', id!);
      const counts: Record<string, number> = {};
      data?.forEach(s => { counts[s.trainer_id] = (counts[s.trainer_id] || 0) + 1; });
      return counts;
    },
    enabled: !!id,
  });

  if (loadingTraining) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      </AdminLayout>
    );
  }

  if (!training) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <p className="text-lg text-muted-foreground">{isRTL ? 'لم يتم العثور على التدريب' : 'Training not found'}</p>
          <Button variant="outline" onClick={() => navigate('/admin/trainings')}>
            {isRTL ? 'العودة' : 'Go Back'}
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const levelLabel = (level: string) => isRTL
    ? { beginner: 'مبتدئ', intermediate: 'متوسط', advanced: 'متقدم' }[level] || level
    : level.charAt(0).toUpperCase() + level.slice(1);

  const getTrainerReviews = (trainerId: string) => allReviews?.filter(r => r.trainer_id === trainerId) || [];
  const getTrainerAvgRating = (trainerId: string) => {
    const reviews = getTrainerReviews(trainerId);
    return reviews.length ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1) : '0.0';
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Back button */}
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate('/admin/trainings')}>
          {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          {isRTL ? 'العودة لقائمة التدريبات' : 'Back to Trainings'}
        </Button>

        {/* Header with background image */}
        {training.background_image && (
          <div className="relative rounded-xl overflow-hidden h-40">
            <img src={training.background_image} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
          </div>
        )}

        {/* Title & Badges */}
        <Card>
          <CardContent className="p-6">
            <h1 className="text-2xl font-bold">{isRTL ? training.name_ar : training.name_en}</h1>
            <p className="text-sm text-muted-foreground mt-1">{isRTL ? training.name_en : training.name_ar}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge variant="outline" className={training.type === 'theory' ? 'bg-purple-500/15 text-purple-600 border-purple-500/30 dark:text-purple-400' : 'bg-orange-500/15 text-orange-600 border-orange-500/30 dark:text-orange-400'}>
                {training.type === 'theory' ? (isRTL ? 'نظري' : 'Theory') : (isRTL ? 'عملي' : 'Practical')}
              </Badge>
              <Badge variant="outline" className={
                training.level === 'beginner' ? 'bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400' :
                training.level === 'intermediate' ? 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400' :
                'bg-red-500/15 text-red-600 border-red-500/30 dark:text-red-400'
              }>
                {levelLabel(training.level)}
              </Badge>
              <Badge className={training.status === 'active' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400' : ''} variant={training.status === 'active' ? 'outline' : 'secondary'}>
                {training.status === 'active' ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'مؤرشف' : 'Archived')}
              </Badge>
            </div>

            {(training.description_ar || training.description_en) && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1">{isRTL ? 'الوصف' : 'Description'}</p>
                <p className="text-sm leading-relaxed">{isRTL ? training.description_ar : training.description_en}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-primary/10">
                <Bike className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? 'المدربين' : 'Trainers'}</p>
                <p className="text-xl font-bold">{trainerCourses?.length || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-blue-500/10">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? 'الطلاب' : 'Students'}</p>
                <p className="text-xl font-bold">{students?.length || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-amber-500/10">
                <Star className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? 'التقييمات' : 'Reviews'}</p>
                <p className="text-xl font-bold">{allReviews?.length || 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Trainers / Students */}
        <Tabs defaultValue="trainers">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="trainers" className="gap-1.5">
              <Bike className="w-4 h-4" />
              {isRTL ? 'المدربين' : 'Trainers'}
              <Badge variant="secondary" className="h-5 px-1.5 text-xs ms-1">{trainerCourses?.length || 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="students" className="gap-1.5">
              <Users className="w-4 h-4" />
              {isRTL ? 'الطلاب' : 'Students'}
              <Badge variant="secondary" className="h-5 px-1.5 text-xs ms-1">{students?.length || 0}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* Trainers Tab */}
          <TabsContent value="trainers" className="mt-4">
            {loadingTrainers ? (
              <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div>
            ) : !trainerCourses?.length ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {isRTL ? 'لا يوجد مدربين معينين' : 'No trainers assigned'}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
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
                        <button
                          className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors text-start"
                          onClick={() => setExpandedTrainerId(isExpanded ? null : trainer.id)}
                        >
                          <Avatar className="h-12 w-12 border border-border shrink-0">
                            <AvatarImage src={trainer.photo_url || ''} />
                            <AvatarFallback className="bg-primary/10 text-primary">{trainer.name_en?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold">{isRTL ? trainer.name_ar : trainer.name_en}</div>
                            <div className="flex flex-wrap gap-3 mt-1.5 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{trainer.city}, {trainer.country}</span>
                              <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />{tc.price} {isRTL ? 'ر.س' : 'SAR'}</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {Math.max(1, Number(tc.sessions_count ?? 1))}×{isRTL ? ' جلسات، ' : ' sessions, '}
                                {tc.duration_hours} {isRTL ? 'س/جلسة' : 'h/sess'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary" className="gap-1"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{avgRating}</Badge>
                            <Badge variant="secondary" className="gap-1"><Users className="w-3 h-3" />{stuCount}</Badge>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-border p-5 space-y-5 bg-muted/20">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-xs text-muted-foreground">{isRTL ? 'نوع الدراجة' : 'Bike Type'}</span>
                                <p className="font-medium">{trainer.bike_type || '—'}</p>
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground">{isRTL ? 'ماركة الدراجة' : 'Brand'}</span>
                                <p className="font-medium">{trainer.motorbike_brand || '—'}</p>
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground">{isRTL ? 'نوع الرخصة' : 'License'}</span>
                                <p className="font-medium">{trainer.license_type || '—'}</p>
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground">{isRTL ? 'الخبرة' : 'Experience'}</span>
                                <p className="font-medium">{trainer.years_of_experience} {isRTL ? 'سنة' : 'years'}</p>
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground">{isRTL ? 'نسبة الربح' : 'Profit'}</span>
                                <p className="font-medium">{trainer.profit_ratio}%</p>
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground">{isRTL ? 'الحالة' : 'Status'}</span>
                                <p className="font-medium">{trainer.status === 'active' ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive')}</p>
                              </div>
                            </div>

                            {tc.location && (
                              <div className="text-sm">
                                <span className="text-xs text-muted-foreground">{isRTL ? 'موقع التدريب' : 'Training Location'}: </span>
                                <span className="font-medium">{tc.location}</span>
                              </div>
                            )}

                            {tc.services?.length > 0 && (
                              <div>
                                <span className="text-xs text-muted-foreground">{isRTL ? 'الخدمات' : 'Services'}</span>
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {tc.services.map((s: string, i: number) => <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>)}
                                </div>
                              </div>
                            )}

                            <div>
                              <span className="text-xs text-muted-foreground font-semibold">{isRTL ? 'التقييمات' : 'Reviews'} ({trainerReviews.length})</span>
                              {trainerReviews.length === 0 ? (
                                <p className="text-sm text-muted-foreground mt-2">{isRTL ? 'لا توجد تقييمات' : 'No reviews'}</p>
                              ) : (
                                <div className="grid gap-2 sm:grid-cols-2 mt-2">
                                  {trainerReviews.slice(0, 6).map(r => (
                                    <Card key={r.id}>
                                      <CardContent className="p-3 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm font-medium">{r.student_name}</span>
                                          <span className="text-xs text-muted-foreground">{format(new Date(r.created_at), 'yyyy-MM-dd')}</span>
                                        </div>
                                        <div className="flex gap-0.5">
                                          {Array.from({ length: 5 }).map((_, i) => (
                                            <Star key={i} className={`w-3.5 h-3.5 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                                          ))}
                                        </div>
                                        {r.comment && <p className="text-xs text-muted-foreground">{r.comment}</p>}
                                      </CardContent>
                                    </Card>
                                  ))}
                                  {trainerReviews.length > 6 && (
                                    <p className="text-xs text-muted-foreground text-center col-span-2">+{trainerReviews.length - 6} {isRTL ? 'المزيد' : 'more'}</p>
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
          <TabsContent value="students" className="mt-4">
            {loadingStudents ? (
              <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : !students?.length ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {isRTL ? 'لا يوجد طلاب' : 'No students yet'}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                        <TableHead>{isRTL ? 'الهاتف' : 'Phone'}</TableHead>
                        <TableHead>{isRTL ? 'الإيميل' : 'Email'}</TableHead>
                        <TableHead>{isRTL ? 'المدرب' : 'Trainer'}</TableHead>
                        <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map(s => {
                        const trainerName = trainerCourses?.find((tc: any) => tc.trainers?.id === s.trainer_id)?.trainers;
                        return (
                          <TableRow key={s.id}>
                            <TableCell>{s.full_name}</TableCell>
                            <TableCell dir="ltr" className="rtl:text-right">{s.phone}</TableCell>
                            <TableCell>{s.email}</TableCell>
                            <TableCell>{trainerName ? (isRTL ? trainerName.name_ar : trainerName.name_en) : '—'}</TableCell>
                            <TableCell>{format(new Date(s.enrolled_at), 'yyyy-MM-dd')}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminTrainingProfile;
