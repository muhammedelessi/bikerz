import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
import { Star, Users, MapPin, Bike, Clock, BookOpen, Briefcase, User, ChevronDown, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { COUNTRIES } from '@/data/countryCityData';
import { CountryCityPicker } from '@/components/ui/fields';
import { toast } from 'sonner';

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

// ─── Add Training Dialog ─────────────────────────────────────────────
const AddTrainingForTrainerDialog: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trainerId: string;
  existingTrainingIds: string[];
  isRTL: boolean;
}> = ({ open, onOpenChange, trainerId, existingTrainingIds, isRTL }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ training_id: '', price: 0, duration_hours: 0, location: '', location_detail: '' });

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
      setForm({ training_id: '', price: 0, duration_hours: 0, location: '', location_detail: '' });
      toast.success(isRTL ? 'تم إضافة التدريب' : 'Training added');
    },
    onError: () => toast.error(isRTL ? 'خطأ' : 'Error'),
  });

  const locationParts = form.location.split(' - ');
  const countryPart = locationParts[0] || '';
  const cityPart = locationParts[1] || '';
  const selectedCountryForLoc = COUNTRIES.find(c => c.en === countryPart);

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
          <CountryCityPicker
            country={selectedCountryForLoc?.code || ''}
            city={cityPart}
            onCountryChange={(code) => {
              const c = COUNTRIES.find(x => x.code === code);
              if (c) setForm(f => ({ ...f, location: c.en }));
            }}
            onCityChange={(v) => {
              const cName = selectedCountryForLoc?.en || countryPart;
              setForm(f => ({ ...f, location: cName + ' - ' + v }));
            }}
          />
          <div className="space-y-2">
            <Label>{isRTL ? 'تفاصيل الموقع' : 'Location Details'}</Label>
            <Input
              value={form.location_detail}
              onChange={(e) => setForm(f => ({ ...f, location_detail: e.target.value }))}
              placeholder={isRTL ? 'أدخل العنوان التفصيلي للموقع' : 'Enter the detailed location address'}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
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

// ─── Training Section (students & reviews per training) ──────────────
const TrainingSection: React.FC<{
  tc: any;
  trainerId: string;
  students: any[];
  reviews: any[];
  isRTL: boolean;
}> = ({ tc, trainerId, students, reviews, isRTL }) => {
  const [open, setOpen] = useState(false);
  const trainingStudents = students.filter(s => s.training_id === tc.training_id);
  const trainingReviews = reviews.filter(r => r.training_id === tc.training_id);
  const avgRating = trainingReviews.length ? (trainingReviews.reduce((a: number, r: any) => a + r.rating, 0) / trainingReviews.length).toFixed(1) : null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardContent className="p-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
                <span className="font-medium text-sm">{isRTL ? tc.trainings?.name_ar : tc.trainings?.name_en}</span>
              </div>
              <Badge variant="outline" className="text-xs">{tc.price} {isRTL ? 'ر.س' : 'SAR'}</Badge>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground ms-6">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{tc.duration_hours} {isRTL ? 'ساعات' : 'hrs'}</span>
              {tc.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{tc.location}</span>}
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{trainingStudents.length} {isRTL ? 'طالب' : 'students'}</span>
              {avgRating && <span className="flex items-center gap-1"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{avgRating}</span>}
            </div>
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border px-3 pb-3 space-y-3">
            {/* Students */}
            <div className="pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{isRTL ? 'الطلاب' : 'Students'} ({trainingStudents.length})</p>
              {trainingStudents.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">{isRTL ? 'لا يوجد طلاب' : 'No students'}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="h-7">{isRTL ? 'الاسم' : 'Name'}</TableHead>
                      <TableHead className="h-7">{isRTL ? 'الهاتف' : 'Phone'}</TableHead>
                      <TableHead className="h-7">{isRTL ? 'الإيميل' : 'Email'}</TableHead>
                      <TableHead className="h-7">{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trainingStudents.map((s: any) => (
                      <TableRow key={s.id} className="text-xs">
                        <TableCell className="py-1.5">{s.full_name}</TableCell>
                        <TableCell className="py-1.5" dir="ltr">{s.phone}</TableCell>
                        <TableCell className="py-1.5">{s.email}</TableCell>
                        <TableCell className="py-1.5">{format(new Date(s.enrolled_at), 'yyyy-MM-dd')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            {/* Reviews */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{isRTL ? 'التقييمات' : 'Reviews'} ({trainingReviews.length})</p>
              {trainingReviews.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">{isRTL ? 'لا توجد تقييمات' : 'No reviews'}</p>
              ) : (
                <div className="space-y-2">
                  {trainingReviews.map((r: any) => (
                    <div key={r.id} className="rounded-lg border border-border p-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{r.student_name}</span>
                        <span className="text-[10px] text-muted-foreground">{format(new Date(r.created_at), 'yyyy-MM-dd')}</span>
                      </div>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`w-3 h-3 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                        ))}
                      </div>
                      {r.comment && <p className="text-[11px] text-muted-foreground">{r.comment}</p>}
                    </div>
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

// ─── Unlinked reviews (no training_id) ───────────────────────────────
const UnlinkedReviews: React.FC<{ reviews: any[]; isRTL: boolean }> = ({ reviews, isRTL }) => {
  const unlinked = reviews.filter(r => !r.training_id);
  if (unlinked.length === 0) return null;
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{isRTL ? 'تقييمات عامة' : 'General Reviews'} ({unlinked.length})</p>
        <div className="space-y-2">
          {unlinked.map((r: any) => (
            <div key={r.id} className="rounded-lg border border-border p-2.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{r.student_name}</span>
                <span className="text-[10px] text-muted-foreground">{format(new Date(r.created_at), 'yyyy-MM-dd')}</span>
              </div>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-3 h-3 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                ))}
              </div>
              {r.comment && <p className="text-[11px] text-muted-foreground">{r.comment}</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Main Dialog ─────────────────────────────────────────────────────
const TrainerProfileDialog: React.FC<TrainerProfileDialogProps> = ({ trainer, open, onOpenChange }) => {
  const { isRTL } = useLanguage();
  const [addTrainingOpen, setAddTrainingOpen] = useState(false);

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

  const avgRating = reviews?.length ? (reviews.reduce((a: number, r: any) => a + r.rating, 0) / reviews.length).toFixed(1) : '0.0';
  const isLoading = loadingStudents || loadingReviews || loadingCourses;

  return (
    <>
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
                  {(trainer.bio_ar || trainer.bio_en) && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-1">{isRTL ? 'نبذة' : 'Bio'}</p>
                      <p className="text-sm leading-relaxed">{isRTL ? trainer.bio_ar : trainer.bio_en}</p>
                    </div>
                  )}
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

              {/* Trainings with students & reviews grouped */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    {isRTL ? 'التدريبات' : 'Trainings'} ({trainerCourses?.length || 0})
                  </h3>
                  <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setAddTrainingOpen(true)}>
                    <Plus className="w-3.5 h-3.5" />
                    {isRTL ? 'إضافة تدريب' : 'Add Training'}
                  </Button>
                </div>

                {isLoading ? (
                  <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>
                ) : !trainerCourses?.length ? (
                  <p className="text-center py-8 text-sm text-muted-foreground">{isRTL ? 'لا توجد تدريبات معينة' : 'No trainings assigned'}</p>
                ) : (
                  <div className="space-y-2">
                    {trainerCourses.map((tc: any) => (
                      <TrainingSection
                        key={tc.id || tc.training_id}
                        tc={tc}
                        trainerId={trainer.id}
                        students={students || []}
                        reviews={reviews || []}
                        isRTL={isRTL}
                      />
                    ))}
                  </div>
                )}

                {/* Show reviews without training_id */}
                {reviews && <UnlinkedReviews reviews={reviews} isRTL={isRTL} />}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AddTrainingForTrainerDialog
        open={addTrainingOpen}
        onOpenChange={setAddTrainingOpen}
        trainerId={trainer.id}
        existingTrainingIds={trainerCourses?.map((tc: any) => tc.training_id) || []}
        isRTL={isRTL}
      />
    </>
  );
};

export default TrainerProfileDialog;
