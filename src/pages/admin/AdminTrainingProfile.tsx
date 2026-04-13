import React, { useMemo, useState } from 'react';
import TrainingCurriculumAccordion from '@/components/training/TrainingCurriculumAccordion';
import { parseTrainingSessions } from '@/lib/trainingSessionCurriculum';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, Dumbbell, Shield, Star, User, Users, Award, Bike, Clock, MapPin, Pencil, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { COUNTRIES } from '@/data/countryCityData';
import { ProfileSectionTitle } from '@/components/admin/trainerProfileTrainingBlocks';
import { normalizeBookingSessions, sessionCountLabel } from '@/lib/trainingBookingSessions';

type TrainerLite = {
  id: string;
  name_ar: string;
  name_en: string;
  photo_url: string | null;
  city: string;
  country: string;
  bike_type: string;
  motorbike_brand: string;
  license_type: string;
  years_of_experience: number;
  status: string;
  services: string[] | null;
  bio_ar: string;
  bio_en: string;
  profit_ratio: number;
};

type TrainerCourseRow = {
  id: string;
  trainer_id: string;
  price: number;
  sessions_count: number;
  duration_hours: number;
  location: string;
  services: string[] | null;
  trainers: TrainerLite | null;
};

type TrainingBookingStudentRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  created_at: string | null;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  payment_status: string;
  sessions: unknown;
  amount: number | string | null;
  currency: string | null;
  trainer_id: string;
  trainers: { name_ar: string; name_en: string } | null;
};

function payBadgeStudent(ps: string, isRTL: boolean) {
  const map: Record<string, { className: string; ar: string; en: string }> = {
    paid: { className: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30', ar: 'مدفوع', en: 'Paid' },
    unpaid: { className: 'bg-muted text-muted-foreground', ar: 'غير مدفوع', en: 'Unpaid' },
    refunded: { className: 'bg-violet-500/15 text-violet-700', ar: 'مسترد', en: 'Refunded' },
  };
  const m = map[ps] || map.unpaid;
  return (
    <Badge variant="outline" className={m.className}>
      {isRTL ? m.ar : m.en}
    </Badge>
  );
}

function bookingStatusBadgeStudent(status: string, isRTL: boolean) {
  const map: Record<string, { className: string; ar: string; en: string }> = {
    pending: { className: 'bg-amber-500/15 text-amber-700 border-amber-500/30', ar: 'معلق', en: 'Pending' },
    confirmed: { className: 'bg-blue-500/15 text-blue-700 border-blue-500/30', ar: 'مؤكد', en: 'Confirmed' },
    completed: { className: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30', ar: 'مكتمل', en: 'Completed' },
    cancelled: { className: 'bg-red-500/15 text-red-700 border-red-500/30', ar: 'ملغي', en: 'Cancelled' },
  };
  const m = map[status] || map.pending;
  return (
    <Badge variant="outline" className={m.className}>
      {isRTL ? m.ar : m.en}
    </Badge>
  );
}

const levelLabel = (level: string, isRTL: boolean) =>
  isRTL
    ? { beginner: 'مبتدئ', intermediate: 'متوسط', advanced: 'متقدم' }[level] || level
    : level.charAt(0).toUpperCase() + level.slice(1);

const statusLabel = (status: string, isRTL: boolean) => {
  const map: Record<string, { ar: string; en: string }> = {
    active: { ar: 'نشط', en: 'Active' },
    archived: { ar: 'مؤرشف', en: 'Archived' },
    pending: { ar: 'معلق', en: 'Pending' },
    confirmed: { ar: 'مؤكد', en: 'Confirmed' },
    completed: { ar: 'مكتمل', en: 'Completed' },
    cancelled: { ar: 'ملغي', en: 'Cancelled' },
  };
  return isRTL ? map[status]?.ar || status : map[status]?.en || status;
};

type TrainerSupply = { name_ar: string; name_en: string };

function parseTrainerSupplies(raw: unknown): TrainerSupply[] {
  if (!raw || !Array.isArray(raw)) return [];
  return (raw as unknown[])
    .map((x) => {
      const o = x as Record<string, unknown>;
      return {
        name_ar: String(o.name_ar ?? '').trim(),
        name_en: String(o.name_en ?? '').trim(),
      };
    })
    .filter((x) => x.name_ar && x.name_en);
}

const AdminTrainingProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const [expandedTrainerId, setExpandedTrainerId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');

  const { data: training, isLoading: loadingTraining } = useQuery({
    queryKey: ['admin-training-detail', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('trainings').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: trainerCourses = [], isLoading: loadingTrainers } = useQuery({
    queryKey: ['training-profile-trainers', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trainer_courses')
        .select(
          'id, trainer_id, price, sessions_count, duration_hours, location, services, trainers(id, name_ar, name_en, photo_url, city, country, bike_type, motorbike_brand, license_type, years_of_experience, status, services, bio_ar, bio_en, profit_ratio)',
        )
        .eq('training_id', id!);
      if (error) throw error;
      return (data || []) as TrainerCourseRow[];
    },
  });

  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['training-profile-students', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_bookings')
        .select(
          'id, full_name, email, phone, created_at, booking_date, start_time, end_time, status, payment_status, sessions, amount, currency, trainer_id, trainers(name_ar, name_en)',
        )
        .eq('training_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as TrainingBookingStudentRow[];
    },
  });

  const trainerIds = useMemo(() => trainerCourses.map((tc) => tc.trainers?.id).filter(Boolean) as string[], [trainerCourses]);

  const { data: allReviews = [] } = useQuery({
    queryKey: ['training-profile-reviews', id, trainerIds.join(',')],
    enabled: !!id && trainerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trainer_reviews')
        .select('*')
        .in('trainer_id', trainerIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const trainerStudentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    students.forEach((s) => {
      counts[s.trainer_id] = (counts[s.trainer_id] || 0) + 1;
    });
    return counts;
  }, [students]);

  const reviewCount = allReviews.length;

  const curriculumSessions = useMemo(
    () => parseTrainingSessions(training?.sessions),
    [training?.sessions],
  );

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q),
    );
  }, [students, studentSearch]);

  const translateLocation = (countryCode: string, city: string) => {
    const c = COUNTRIES.find((x) => x.code === countryCode);
    const countryName = c ? (isRTL ? c.ar : c.en) : countryCode;
    const cityObj = c?.cities.find((ct) => ct.en === city || ct.ar === city);
    const cityName = cityObj ? (isRTL ? cityObj.ar : cityObj.en) : city;
    return [cityName, countryName].filter(Boolean).join(isRTL ? '، ' : ', ');
  };

  const getTrainerReviews = (trainerId: string) => allReviews.filter((r: any) => r.trainer_id === trainerId);
  const getTrainerAvgRating = (trainerId: string) => {
    const rows = getTrainerReviews(trainerId);
    if (!rows.length) return '0.0';
    return (rows.reduce((a: number, r: any) => a + Number(r.rating || 0), 0) / rows.length).toFixed(1);
  };

  if (loadingTraining) {
    return (
      <AdminLayout>
        <div className="mx-auto w-full min-w-0 min-h-0 max-w-none space-y-4 px-2 sm:px-4 lg:px-6">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </AdminLayout>
    );
  }

  if (!training) {
    return (
      <AdminLayout>
        <div className="mx-auto w-full min-w-0 min-h-0 max-w-none px-2 py-16 text-center sm:px-4 lg:px-6">
          <p className="text-muted-foreground">{isRTL ? 'لم يتم العثور على التدريب' : 'Training not found'}</p>
          <Button className="mt-4" variant="outline" onClick={() => navigate('/admin/trainings')}>
            {isRTL ? 'العودة' : 'Back'}
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const TypeIcon = training.type === 'practical' ? Dumbbell : BookOpen;
  const typeLabel = training.type === 'practical' ? (isRTL ? 'عملي' : 'Practical') : (isRTL ? 'نظري' : 'Theory');
  const supplies = parseTrainerSupplies(training.trainer_supplies);

  return (
    <AdminLayout>
      <div className="mx-auto w-full min-w-0 min-h-0 max-w-none space-y-6 px-2 sm:px-4 lg:px-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <Button variant="ghost" size="sm" className="gap-2 -ms-2" onClick={() => navigate('/admin/trainings')}>
          {isRTL ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
          {isRTL ? 'العودة لقائمة التدريبات' : 'Back to trainings'}
        </Button>

        <Card className="border-border/60">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4 min-w-0">
                <div className={cn('flex h-16 w-16 shrink-0 items-center justify-center rounded-full', training.type === 'practical' ? 'bg-orange-500/10 text-orange-600' : 'bg-purple-500/10 text-purple-600')}>
                  <TypeIcon className="h-8 w-8" />
                </div>
                <div className="min-w-0 space-y-2 text-start">
                  <h1 className="text-2xl font-black leading-tight">{training.name_ar}</h1>
                  <p className="text-sm text-muted-foreground">{training.name_en}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={training.status === 'active' ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' : 'bg-muted text-muted-foreground'}>
                      {statusLabel(training.status, isRTL)}
                    </Badge>
                    <Badge variant="outline">{typeLabel}</Badge>
                    <Badge variant="outline">{levelLabel(training.level, isRTL)}</Badge>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="gap-2 self-start" onClick={() => navigate('/admin/trainings')}>
                <Pencil className="h-4 w-4" />
                {isRTL ? 'تعديل' : 'Edit'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2.5 rounded-full bg-primary/10"><Bike className="w-5 h-5 text-primary" /></div><div><p className="text-xs text-muted-foreground">{isRTL ? 'المدربين' : 'Trainers'}</p><p className="text-xl font-bold">{trainerCourses.length}</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2.5 rounded-full bg-blue-500/10"><Users className="w-5 h-5 text-blue-500" /></div><div><p className="text-xs text-muted-foreground">{isRTL ? 'الطلاب' : 'Students'}</p><p className="text-xl font-bold">{students.length}</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2.5 rounded-full bg-amber-500/10"><Star className="w-5 h-5 text-amber-500" /></div><div><p className="text-xs text-muted-foreground">{isRTL ? 'التقييمات' : 'Reviews'}</p><p className="text-xl font-bold">{reviewCount}</p></div></CardContent></Card>
        </div>

        <Card className="border-border/60">
          <CardContent className="p-5 sm:p-6 space-y-4">
            <ProfileSectionTitle>{isRTL ? 'تفاصيل التدريب' : 'Training details'}</ProfileSectionTitle>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-2 text-sm"><BookOpen className="h-4 w-4 mt-0.5 text-primary" /><div><p className="text-xs text-muted-foreground">{isRTL ? 'الوصف (عربي)' : 'Description (AR)'}</p><p>{training.description_ar || '—'}</p></div></div>
              <div className="flex items-start gap-2 text-sm"><BookOpen className="h-4 w-4 mt-0.5 text-primary" /><div><p className="text-xs text-muted-foreground">{isRTL ? 'الوصف (إنجليزي)' : 'Description (EN)'}</p><p>{training.description_en || '—'}</p></div></div>
              <div className="flex items-start gap-2 text-sm"><BookOpen className="h-4 w-4 mt-0.5 text-primary" /><div><p className="text-xs text-muted-foreground">{isRTL ? 'النوع' : 'Type'}</p><p>{typeLabel}</p></div></div>
              <div className="flex items-start gap-2 text-sm"><Award className="h-4 w-4 mt-0.5 text-primary" /><div><p className="text-xs text-muted-foreground">{isRTL ? 'المستوى' : 'Level'}</p><p>{levelLabel(training.level, isRTL)}</p></div></div>
              <div className="flex items-start gap-2 text-sm"><Shield className="h-4 w-4 mt-0.5 text-primary" /><div><p className="text-xs text-muted-foreground">{isRTL ? 'الحالة' : 'Status'}</p><p>{statusLabel(training.status, isRTL)}</p></div></div>
              <div className="flex items-start gap-2 text-sm"><User className="h-4 w-4 mt-0.5 text-primary" /><div><p className="text-xs text-muted-foreground">{isRTL ? 'تاريخ الإنشاء' : 'Created'}</p><p>{training.created_at ? format(new Date(training.created_at), isRTL ? 'd MMM yyyy' : 'MMM d, yyyy', { locale: isRTL ? ar : undefined }) : '—'}</p></div></div>
            </div>
            {supplies.length > 0 ? (
              <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" />
                  {isRTL ? 'ما يوفره المدرب' : 'Trainer Supplies'}
                </p>
                <ul className="space-y-1.5">
                  {supplies.map((item, idx) => (
                    <li key={`${item.name_en}-${idx}`} className="text-sm flex items-center gap-2">
                      <Wrench className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span>{isRTL ? item.name_ar : item.name_en}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {curriculumSessions.length > 0 ? (
          <TrainingCurriculumAccordion sessions={curriculumSessions} isRTL={isRTL} />
        ) : null}

        <Card className="border-border/60">
          <CardContent className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <ProfileSectionTitle>{isRTL ? `المدربون (${trainerCourses.length})` : `Trainers (${trainerCourses.length})`}</ProfileSectionTitle>
              <Button size="sm" variant="secondary" onClick={() => navigate('/admin/trainers')}>{isRTL ? 'إضافة مدرب' : 'Add trainer'}</Button>
            </div>
            {loadingTrainers ? (
              <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : trainerCourses.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">{isRTL ? 'لا يوجد مدربون' : 'No trainers assigned'}</p>
            ) : (
              <div className="divide-y divide-border/40 border-t border-border/40">
                {trainerCourses.map((tc) => {
                  const trainer = tc.trainers;
                  if (!trainer) return null;
                  const expanded = expandedTrainerId === trainer.id;
                  const reviews = getTrainerReviews(trainer.id);
                  return (
                    <div key={tc.id}>
                      <button type="button" onClick={() => setExpandedTrainerId(expanded ? null : trainer.id)} className="flex w-full items-center gap-3 py-4 text-start hover:bg-muted/20">
                        <Avatar className="h-11 w-11"><AvatarImage src={trainer.photo_url || undefined} /><AvatarFallback>{trainer.name_en?.charAt(0)}</AvatarFallback></Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{isRTL ? trainer.name_ar : trainer.name_en}</p>
                          <p className="text-xs text-muted-foreground">{isRTL ? trainer.name_en : trainer.name_ar}</p>
                        </div>
                        <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{getTrainerAvgRating(trainer.id)}</span>
                          <span>{trainerStudentCounts[trainer.id] || 0} {isRTL ? 'طلاب' : 'students'}</span>
                          <span>{Math.round(Number(tc.price || 0))} ﷼</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{Number(tc.duration_hours)} {isRTL ? 'س/جلسة' : 'h/session'}</span>
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{translateLocation(trainer.country, trainer.city)}</span>
                        </div>
                        <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
                      </button>
                      <AnimatePresence initial={false}>
                        {expanded && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden pb-4">
                            <div className="space-y-4 rounded-lg bg-muted/20 p-4">
                              <div className="flex justify-end">
                                <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/trainers/${trainer.id}`)}>{isRTL ? 'عرض الملف الكامل' : 'View full profile'}</Button>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                                <div><p className="text-xs text-muted-foreground">{isRTL ? 'نوع الدراجة' : 'Bike type'}</p><p>{trainer.bike_type || '—'}</p></div>
                                <div><p className="text-xs text-muted-foreground">{isRTL ? 'الماركة' : 'Brand'}</p><p>{trainer.motorbike_brand || '—'}</p></div>
                                <div><p className="text-xs text-muted-foreground">{isRTL ? 'الرخصة' : 'License'}</p><p dir="ltr">{trainer.license_type || '—'}</p></div>
                                <div><p className="text-xs text-muted-foreground">{isRTL ? 'الخبرة' : 'Experience'}</p><p>{trainer.years_of_experience}</p></div>
                              </div>
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground">{isRTL ? `التقييمات (${reviews.length})` : `Reviews (${reviews.length})`}</p>
                                {reviews.length === 0 ? <p className="text-sm text-muted-foreground">{isRTL ? 'لا توجد تقييمات' : 'No reviews'}</p> : (
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    {reviews.slice(0, 4).map((r: any) => (
                                      <Card key={r.id}><CardContent className="p-3"><div className="flex justify-between text-xs"><span>{r.student_name || '—'}</span><span>{format(new Date(r.created_at), 'yyyy-MM-dd')}</span></div><p className="mt-1 text-xs text-muted-foreground">{r.comment || '—'}</p></CardContent></Card>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-5 sm:p-6 space-y-4">
            <ProfileSectionTitle>{isRTL ? `الطلاب (${students.length})` : `Students (${students.length})`}</ProfileSectionTitle>
            <div className="max-w-md">
              <Input
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder={isRTL ? '🔍 بحث بالاسم أو الإيميل أو الهاتف...' : '🔍 Search by name, email, or phone...'}
              />
            </div>
            {loadingStudents ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : filteredStudents.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">{isRTL ? 'لا يوجد طلاب' : 'No students yet'}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                      <TableHead>{isRTL ? 'الهاتف' : 'Phone'}</TableHead>
                      <TableHead>{isRTL ? 'الإيميل' : 'Email'}</TableHead>
                      <TableHead>{isRTL ? 'المدرب' : 'Trainer'}</TableHead>
                      <TableHead>{isRTL ? 'الجلسات' : 'Sessions'}</TableHead>
                      <TableHead>{isRTL ? 'الدفع' : 'Payment'}</TableHead>
                      <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead>{isRTL ? 'تاريخ التسجيل' : 'Enrolled'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((s) => {
                      const trainer = s.trainers ?? trainerCourses.find((tc) => tc.trainer_id === s.trainer_id)?.trainers;
                      const sessionCount = normalizeBookingSessions(
                        s.sessions,
                        s.booking_date,
                        s.start_time,
                        s.end_time,
                        s.status,
                      ).length;
                      return (
                        <TableRow key={s.id}>
                          <TableCell>{s.full_name}</TableCell>
                          <TableCell dir="ltr">{s.phone || '—'}</TableCell>
                          <TableCell dir="ltr">{s.email || '—'}</TableCell>
                          <TableCell>
                            {trainer ? (isRTL ? trainer.name_ar : trainer.name_en) : '—'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {sessionCountLabel(Math.max(1, sessionCount), isRTL)}
                          </TableCell>
                          <TableCell>{payBadgeStudent(s.payment_status, isRTL)}</TableCell>
                          <TableCell>{bookingStatusBadgeStudent(s.status, isRTL)}</TableCell>
                          <TableCell>
                            {s.created_at
                              ? format(new Date(s.created_at), isRTL ? 'd MMM yyyy' : 'MMM d, yyyy', {
                                  locale: isRTL ? ar : undefined,
                                })
                              : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminTrainingProfile;
