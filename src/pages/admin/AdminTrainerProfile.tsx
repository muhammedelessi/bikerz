import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Star, Users, MapPin, Bike, Clock, BookOpen, Briefcase, User, ChevronDown, Plus, ArrowLeft, ArrowRight, Shield, Award } from 'lucide-react';
import { format } from 'date-fns';
import { COUNTRIES, OTHER_OPTION } from '@/data/countryCityData';
import { toast } from 'sonner';

// ─── Add Training Dialog ─────────────────────────────────────────────
const AddTrainingForTrainerDialog: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trainerId: string;
  existingTrainingIds: string[];
  isRTL: boolean;
}> = ({ open, onOpenChange, trainerId, existingTrainingIds, isRTL }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ training_id: '', price: 0, duration_hours: 0, location: '' });

  const { data: allTrainings } = useQuery({
    queryKey: ['all-trainings-list'],
    queryFn: async () => {
      const { data } = await supabase.from('trainings').select('id, name_ar, name_en');
      return data || [];
    },
  });

  const availableTrainings = allTrainings?.filter(t => !existingTrainingIds.includes(t.id)) || [];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('trainer_courses').insert({ trainer_id: trainerId, ...form });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainer-profile-courses', trainerId] });
      onOpenChange(false);
      setForm({ training_id: '', price: 0, duration_hours: 0, location: '' });
      toast.success(isRTL ? 'تم إضافة التدريب' : 'Training added');
    },
    onError: () => toast.error(isRTL ? 'خطأ' : 'Error'),
  });

  const locationParts = form.location.split(' - ');
  const countryPart = locationParts[0] || '';
  const cityPart = locationParts[1] || '';
  const selectedCountry = COUNTRIES.find(c => c.en === countryPart);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isRTL ? 'إضافة تدريب' : 'Add Training'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{isRTL ? 'التدريب' : 'Training'}</Label>
            <Select value={form.training_id} onValueChange={v => setForm(f => ({ ...f, training_id: v }))}>
              <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر تدريب' : 'Select training'} /></SelectTrigger>
              <SelectContent>
                {availableTrainings.map(t => <SelectItem key={t.id} value={t.id}>{isRTL ? t.name_ar : t.name_en}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label>{isRTL ? 'السعر (ر.س)' : 'Price (SAR)'}</Label>
              <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'المدة (ساعات)' : 'Duration (hrs)'}</Label>
              <Input type="number" value={form.duration_hours} onChange={e => setForm(f => ({ ...f, duration_hours: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>
          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label>{isRTL ? 'الدولة' : 'Country'}</Label>
              <Select
                value={selectedCountry?.code || ''}
                onValueChange={v => {
                  const c = COUNTRIES.find(c => c.code === v);
                  if (c) setForm(f => ({ ...f, location: c.en }));
                }}
              >
                <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر الدولة' : 'Select country'} /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{isRTL ? c.ar : c.en}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'المدينة' : 'City'}</Label>
              {selectedCountry ? (
                <Select
                  value={cityPart}
                  onValueChange={v => setForm(f => ({ ...f, location: countryPart + ' - ' + v }))}
                >
                  <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر المدينة' : 'Select city'} /></SelectTrigger>
                  <SelectContent>
                    {[...selectedCountry.cities, OTHER_OPTION].map(c => <SelectItem key={c.en} value={c.en}>{isRTL ? c.ar : c.en}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input disabled placeholder={isRTL ? 'اختر الدولة أولاً' : 'Select country first'} />
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.training_id}>
            {saveMutation.isPending ? '...' : (isRTL ? 'حفظ' : 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Training Section ────────────────────────────────────────────────
const TrainingSection: React.FC<{
  tc: any;
  students: any[];
  reviews: any[];
  isRTL: boolean;
}> = ({ tc, students, reviews, isRTL }) => {
  const [open, setOpen] = useState(false);
  const trainingStudents = students.filter(s => s.training_id === tc.training_id);
  const trainingReviews = reviews.filter(r => r.training_id === tc.training_id);
  const avgRating = trainingReviews.length ? (trainingReviews.reduce((a: number, r: any) => a + r.rating, 0) / trainingReviews.length).toFixed(1) : null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
                <span className="font-semibold">{isRTL ? tc.trainings?.name_ar : tc.trainings?.name_en}</span>
              </div>
              <Badge variant="outline">{tc.price} {isRTL ? 'ر.س' : 'SAR'}</Badge>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground ms-6">
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{tc.duration_hours} {isRTL ? 'ساعات' : 'hrs'}</span>
              {tc.location && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{tc.location}</span>}
              <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{trainingStudents.length} {isRTL ? 'طالب' : 'students'}</span>
              {avgRating && <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />{avgRating}</span>}
            </div>
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border px-4 pb-4 space-y-4">
            {/* Students */}
            <div className="pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{isRTL ? 'الطلاب' : 'Students'} ({trainingStudents.length})</p>
              {trainingStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">{isRTL ? 'لا يوجد طلاب' : 'No students'}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                      <TableHead>{isRTL ? 'الهاتف' : 'Phone'}</TableHead>
                      <TableHead>{isRTL ? 'الإيميل' : 'Email'}</TableHead>
                      <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trainingStudents.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.full_name}</TableCell>
                        <TableCell dir="ltr" className="rtl:text-right">{s.phone}</TableCell>
                        <TableCell>{s.email}</TableCell>
                        <TableCell>{format(new Date(s.enrolled_at), 'yyyy-MM-dd')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            {/* Reviews */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{isRTL ? 'التقييمات' : 'Reviews'} ({trainingReviews.length})</p>
              {trainingReviews.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">{isRTL ? 'لا توجد تقييمات' : 'No reviews'}</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {trainingReviews.map((r: any) => (
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
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

// ─── General Reviews ─────────────────────────────────────────────────
const UnlinkedReviews: React.FC<{ reviews: any[]; isRTL: boolean }> = ({ reviews, isRTL }) => {
  const unlinked = reviews.filter(r => !r.training_id);
  if (unlinked.length === 0) return null;
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{isRTL ? 'تقييمات عامة' : 'General Reviews'} ({unlinked.length})</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {unlinked.map((r: any) => (
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
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────
const AdminTrainerProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const [addTrainingOpen, setAddTrainingOpen] = useState(false);

  const { data: trainer, isLoading: loadingTrainer } = useQuery({
    queryKey: ['admin-trainer-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('trainers').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: students } = useQuery({
    queryKey: ['trainer-profile-students', id],
    queryFn: async () => {
      const { data } = await supabase.from('training_students').select('*').eq('trainer_id', id!).order('enrolled_at', { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: reviews } = useQuery({
    queryKey: ['trainer-profile-reviews', id],
    queryFn: async () => {
      const { data } = await supabase.from('trainer_reviews').select('*').eq('trainer_id', id!).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: trainerCourses, isLoading: loadingCourses } = useQuery({
    queryKey: ['trainer-profile-courses', id],
    queryFn: async () => {
      const { data } = await supabase.from('trainer_courses').select('*, trainings(name_ar, name_en)').eq('trainer_id', id!);
      return data || [];
    },
    enabled: !!id,
  });

  if (loadingTrainer) {
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

  if (!trainer) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <p className="text-lg text-muted-foreground">{isRTL ? 'لم يتم العثور على المدرب' : 'Trainer not found'}</p>
          <Button variant="outline" onClick={() => navigate('/admin/trainers')}>
            {isRTL ? 'العودة' : 'Go Back'}
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const avgRating = reviews?.length ? (reviews.reduce((a: number, r: any) => a + r.rating, 0) / reviews.length).toFixed(1) : '0.0';
  const totalStudents = students?.length || 0;
  const totalReviews = reviews?.length || 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Back button */}
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate('/admin/trainers')}>
          {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          {isRTL ? 'العودة لقائمة المدربين' : 'Back to Trainers'}
        </Button>

        {/* Header Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <Avatar className="h-20 w-20 border-2 border-border shrink-0">
                <AvatarImage src={trainer.photo_url || ''} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">{(trainer.name_en || '?').charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold">{isRTL ? trainer.name_ar : trainer.name_en}</h1>
                <p className="text-sm text-muted-foreground">{isRTL ? trainer.name_en : trainer.name_ar}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge className={trainer.status === 'active' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400' : ''} variant={trainer.status === 'active' ? 'outline' : 'secondary'}>
                    {trainer.status === 'active' ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive')}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-primary/10">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? 'الطلاب' : 'Students'}</p>
                <p className="text-xl font-bold">{totalStudents}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-amber-500/10">
                <Star className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? 'التقييم' : 'Rating'}</p>
                <p className="text-xl font-bold">{avgRating} <span className="text-xs font-normal text-muted-foreground">({totalReviews})</span></p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-blue-500/10">
                <BookOpen className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? 'التدريبات' : 'Trainings'}</p>
                <p className="text-xl font-bold">{trainerCourses?.length || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-green-500/10">
                <Briefcase className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? 'نسبة الربح' : 'Profit'}</p>
                <p className="text-xl font-bold">{trainer.profit_ratio}%</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Personal Info */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              {isRTL ? 'المعلومات الشخصية' : 'Personal Information'}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-5 gap-x-6">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'الموقع' : 'Location'}</p>
                  <p className="font-medium text-sm">{trainer.city}{trainer.city && trainer.country ? ', ' : ''}{trainer.country}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Bike className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'نوع الدراجة' : 'Bike Type'}</p>
                  <p className="font-medium text-sm">{trainer.bike_type || '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Award className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'ماركة الدراجة' : 'Motorbike Brand'}</p>
                  <p className="font-medium text-sm">{trainer.motorbike_brand || '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'نوع الرخصة' : 'License Type'}</p>
                  <p className="font-medium text-sm">{trainer.license_type || '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'الخبرة' : 'Experience'}</p>
                  <p className="font-medium text-sm">{trainer.years_of_experience} {isRTL ? 'سنة' : 'years'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'تاريخ الانضمام' : 'Joined'}</p>
                  <p className="font-medium text-sm">{format(new Date(trainer.created_at), 'yyyy-MM-dd')}</p>
                </div>
              </div>
            </div>

            {(trainer.bio_ar || trainer.bio_en) && (
              <div className="mt-5 pt-5 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1.5">{isRTL ? 'نبذة' : 'Bio'}</p>
                <p className="text-sm leading-relaxed">{isRTL ? trainer.bio_ar : trainer.bio_en}</p>
              </div>
            )}

            {trainer.services?.length > 0 && (
              <div className="mt-5 pt-5 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">{isRTL ? 'الخدمات' : 'Services'}</p>
                <div className="flex flex-wrap gap-2">
                  {trainer.services.map((s: string, i: number) => <Badge key={i} variant="secondary">{s}</Badge>)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trainings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              {isRTL ? 'التدريبات' : 'Trainings'} ({trainerCourses?.length || 0})
            </h2>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAddTrainingOpen(true)}>
              <Plus className="w-4 h-4" />
              {isRTL ? 'إضافة تدريب' : 'Add Training'}
            </Button>
          </div>

          {loadingCourses ? (
            <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div>
          ) : !trainerCourses?.length ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {isRTL ? 'لا توجد تدريبات معينة' : 'No trainings assigned'}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {trainerCourses.map((tc: any) => (
                <TrainingSection
                  key={tc.id || tc.training_id}
                  tc={tc}
                  students={students || []}
                  reviews={reviews || []}
                  isRTL={isRTL}
                />
              ))}
            </div>
          )}

          {reviews && <UnlinkedReviews reviews={reviews} isRTL={isRTL} />}
        </div>
      </div>

      <AddTrainingForTrainerDialog
        open={addTrainingOpen}
        onOpenChange={setAddTrainingOpen}
        trainerId={id!}
        existingTrainingIds={trainerCourses?.map((tc: any) => tc.training_id) || []}
        isRTL={isRTL}
      />
    </AdminLayout>
  );
};

export default AdminTrainerProfile;
