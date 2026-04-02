import React, { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Star, Upload, X, ChevronDown, ChevronUp, ArrowLeft, ArrowRight, Users, MessageSquare, Bike, MapPin, Clock, AlertTriangle, TrendingUp, Eye } from 'lucide-react';
import TrainerProfileDialog from '@/components/admin/TrainerProfileDialog';
import BilingualInput from '@/components/admin/content/BilingualInput';
import { COUNTRIES, OTHER_OPTION } from '@/data/countryCityData';
import { format } from 'date-fns';

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

interface TrainerCourse {
  training_id: string;
  price: number;
  duration_hours: number;
  location: string;
  available_schedule: any;
  services: string[];
}

// ─── Expandable Row Detail ───────────────────────────────────────────

// ─── Add Student Dialog ──────────────────────────────────────────────
const AddStudentDialog: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trainerId: string;
  isRTL: boolean;
}> = ({ open, onOpenChange, trainerId, isRTL }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', training_id: '' });

  const { data: trainerCourses } = useQuery({
    queryKey: ['trainer-courses-for', trainerId],
    queryFn: async () => {
      const { data } = await supabase.from('trainer_courses').select('training_id').eq('trainer_id', trainerId);
      return data || [];
    },
    enabled: !!trainerId,
  });

  const { data: trainings } = useQuery({
    queryKey: ['all-trainings-list'],
    queryFn: async () => {
      const { data } = await supabase.from('trainings').select('id, name_ar, name_en');
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('training_students').insert({ ...form, trainer_id: trainerId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainer-students', trainerId] });
      queryClient.invalidateQueries({ queryKey: ['trainer-student-counts'] });
      onOpenChange(false);
      setForm({ full_name: '', phone: '', email: '', training_id: '' });
      toast.success(isRTL ? 'تم إضافة الطالب' : 'Student added');
    },
    onError: () => toast.error(isRTL ? 'خطأ' : 'Error'),
  });

  const availableTrainings = trainings?.filter(t => trainerCourses?.some(tc => tc.training_id === t.id)) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isRTL ? 'إضافة طالب' : 'Add Student'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>{isRTL ? 'الاسم الكامل' : 'Full Name'}</Label><Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2"><Label>{isRTL ? 'الهاتف' : 'Phone'}</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} dir="ltr" /></div>
            <div className="space-y-2"><Label>{isRTL ? 'الإيميل' : 'Email'}</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} dir="ltr" /></div>
          </div>
          <div className="space-y-2">
            <Label>{isRTL ? 'التدريب' : 'Training'}</Label>
            <Select value={form.training_id} onValueChange={v => setForm(f => ({ ...f, training_id: v }))}>
              <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر تدريب' : 'Select training'} /></SelectTrigger>
              <SelectContent>
                {availableTrainings.map(t => <SelectItem key={t.id} value={t.id}>{isRTL ? t.name_ar : t.name_en}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.full_name || !form.training_id}>
            {saveMutation.isPending ? '...' : (isRTL ? 'حفظ' : 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Add Review Dialog ───────────────────────────────────────────────
const AddReviewDialog: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trainerId: string;
  isRTL: boolean;
}> = ({ open, onOpenChange, trainerId, isRTL }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ student_name: '', rating: 5, comment: '', training_id: '' });

  const { data: trainerCourses } = useQuery({
    queryKey: ['trainer-courses-for', trainerId],
    queryFn: async () => {
      const { data } = await supabase.from('trainer_courses').select('training_id').eq('trainer_id', trainerId);
      return data || [];
    },
    enabled: !!trainerId,
  });

  const { data: trainings } = useQuery({
    queryKey: ['all-trainings-list'],
    queryFn: async () => {
      const { data } = await supabase.from('trainings').select('id, name_ar, name_en');
      return data || [];
    },
  });

  const availableTrainings = trainings?.filter(t => trainerCourses?.some(tc => tc.training_id === t.id)) || [];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { student_name: form.student_name, rating: form.rating, comment: form.comment, trainer_id: trainerId };
      if (form.training_id) payload.training_id = form.training_id;
      const { error } = await supabase.from('trainer_reviews').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainer-reviews-detail', trainerId] });
      queryClient.invalidateQueries({ queryKey: ['trainer-review-stats'] });
      queryClient.invalidateQueries({ queryKey: ['trainer-profile-reviews', trainerId] });
      onOpenChange(false);
      setForm({ student_name: '', rating: 5, comment: '', training_id: '' });
      toast.success(isRTL ? 'تم إضافة التقييم' : 'Review added');
    },
    onError: () => toast.error(isRTL ? 'خطأ' : 'Error'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isRTL ? 'إضافة تقييم' : 'Add Review'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>{isRTL ? 'اسم الطالب' : 'Student Name'}</Label><Input value={form.student_name} onChange={e => setForm(f => ({ ...f, student_name: e.target.value }))} /></div>
          <div className="space-y-2">
            <Label>{isRTL ? 'التدريب' : 'Training'}</Label>
            <Select value={form.training_id} onValueChange={v => setForm(f => ({ ...f, training_id: v }))}>
              <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر تدريب (اختياري)' : 'Select training (optional)'} /></SelectTrigger>
              <SelectContent>
                {availableTrainings.map(t => <SelectItem key={t.id} value={t.id}>{isRTL ? t.name_ar : t.name_en}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{isRTL ? 'التقييم' : 'Rating'}</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(v => (
                <button key={v} type="button" onClick={() => setForm(f => ({ ...f, rating: v }))} className="p-1 hover:scale-110 transition-transform">
                  <Star className={`w-7 h-7 ${v <= form.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2"><Label>{isRTL ? 'التعليق' : 'Comment'}</Label><Textarea value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))} rows={3} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.student_name}>
            {saveMutation.isPending ? '...' : (isRTL ? 'حفظ' : 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────
const AdminTrainers: React.FC = () => {
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [serviceInput, setServiceInput] = useState('');
  const [trainingServiceInputs, setTrainingServiceInputs] = useState<Record<string, string>>({});
  const [isOtherCity, setIsOtherCity] = useState(false);
  const [assignedTrainings, setAssignedTrainings] = useState<TrainerCourse[]>([]);
  
  const [addStudentTrainerId, setAddStudentTrainerId] = useState<string | null>(null);
  const [addReviewTrainerId, setAddReviewTrainerId] = useState<string | null>(null);
  const [viewProfileTrainer, setViewProfileTrainer] = useState<Trainer | null>(null);

  const defaultForm = { name_ar: '', name_en: '', bio_ar: '', bio_en: '', country: '', city: '', bike_type: '', years_of_experience: 0, profit_ratio: 0, services: [] as string[], status: 'active' as 'active' | 'inactive', photo_url: null as string | null };
  const [form, setForm] = useState(defaultForm);

  const { data: trainers, isLoading } = useQuery({
    queryKey: ['admin-trainers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('trainers').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Trainer[];
    },
  });

  const { data: allTrainings } = useQuery({
    queryKey: ['all-trainings-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('trainings').select('id, name_ar, name_en');
      if (error) throw error;
      return data;
    },
  });

  const { data: reviewStats } = useQuery({
    queryKey: ['trainer-review-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('trainer_reviews').select('trainer_id, rating');
      if (error) throw error;
      const stats: Record<string, { avg: number; count: number }> = {};
      const grouped: Record<string, number[]> = {};
      data?.forEach(r => { if (!grouped[r.trainer_id]) grouped[r.trainer_id] = []; grouped[r.trainer_id].push(r.rating); });
      Object.entries(grouped).forEach(([id, ratings]) => {
        stats[id] = { avg: ratings.reduce((a, b) => a + b, 0) / ratings.length, count: ratings.length };
      });
      return stats;
    },
  });

  const { data: studentCounts } = useQuery({
    queryKey: ['trainer-student-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('training_students').select('trainer_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach(s => { counts[s.trainer_id] = (counts[s.trainer_id] || 0) + 1; });
      return counts;
    },
  });

  const uploadPhoto = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('trainer-photos').upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from('trainer-photos').getPublicUrl(path);
    return data.publicUrl;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let photoUrl = form.photo_url;
      if (photoFile) photoUrl = await uploadPhoto(photoFile);
      const payload = { ...form, photo_url: photoUrl };

      if (editingTrainer) {
        const { error } = await supabase.from('trainers').update(payload).eq('id', editingTrainer.id);
        if (error) throw error;
        await supabase.from('trainer_courses').delete().eq('trainer_id', editingTrainer.id);
        if (assignedTrainings.length > 0) {
          const { error: tcError } = await supabase.from('trainer_courses').insert(
            assignedTrainings.map(at => ({ trainer_id: editingTrainer.id, ...at }))
          );
          if (tcError) throw tcError;
        }
      } else {
        const { data, error } = await supabase.from('trainers').insert(payload).select().single();
        if (error) throw error;
        if (assignedTrainings.length > 0) {
          await supabase.from('trainer_courses').insert(
            assignedTrainings.map(at => ({ trainer_id: data.id, ...at }))
          );
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trainers'] });
      queryClient.invalidateQueries({ queryKey: ['training-trainer-counts'] });
      setFormOpen(false);
      toast.success(isRTL ? 'تم الحفظ بنجاح' : 'Saved successfully');
    },
    onError: () => toast.error(isRTL ? 'حدث خطأ' : 'An error occurred'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('trainers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trainers'] });
      setDeleteId(null);
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
    },
    onError: () => toast.error(isRTL ? 'حدث خطأ' : 'An error occurred'),
  });

  const openAdd = () => {
    setEditingTrainer(null);
    setForm(defaultForm);
    setPhotoFile(null);
    setPhotoPreview(null);
    setAssignedTrainings([]);
    setTrainingServiceInputs({});
    setIsOtherCity(false);
    setFormOpen(true);
  };

  const openEdit = async (t: Trainer) => {
    setEditingTrainer(t);
    setForm({ name_ar: t.name_ar, name_en: t.name_en, bio_ar: t.bio_ar, bio_en: t.bio_en, country: t.country, city: t.city, bike_type: t.bike_type, years_of_experience: t.years_of_experience, profit_ratio: t.profit_ratio || 0, services: t.services || [], status: t.status as 'active' | 'inactive', photo_url: t.photo_url });
    setPhotoFile(null);
    setPhotoPreview(t.photo_url);
    const { data } = await supabase.from('trainer_courses').select('training_id, price, duration_hours, location, available_schedule, services').eq('trainer_id', t.id);
    setAssignedTrainings((data || []).map(d => ({ training_id: d.training_id, price: Number(d.price), duration_hours: Number(d.duration_hours), location: d.location, available_schedule: d.available_schedule, services: (d as any).services || [] })));
    // Check if stored city is in the country's city list
    const countryEntry = COUNTRIES.find(c => c.code === t.country);
    const cityInList = countryEntry?.cities.some(c => c.en === t.city);
    setIsOtherCity(!!countryEntry && !cityInList && !!t.city);
    setFormOpen(true);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const addService = () => {
    if (serviceInput.trim()) {
      setForm(f => ({ ...f, services: [...f.services, serviceInput.trim()] }));
      setServiceInput('');
    }
  };

  const toggleTraining = (trainingId: string, checked: boolean) => {
    if (checked) {
      setAssignedTrainings(prev => [...prev, { training_id: trainingId, price: 0, duration_hours: 0, location: '', available_schedule: {}, services: [] }]);
    } else {
      setAssignedTrainings(prev => prev.filter(at => at.training_id !== trainingId));
    }
  };

  const updateAssignment = (trainingId: string, field: string, value: any) => {
    setAssignedTrainings(prev => prev.map(at => at.training_id === trainingId ? { ...at, [field]: value } : at));
  };

  // ─── Full-page form view ────────────────────────────────────────
  if (formOpen) {
    return (
      <AdminLayout>
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setFormOpen(false)}>
              {isRTL ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{editingTrainer ? (isRTL ? 'تعديل مدرب' : 'Edit Trainer') : (isRTL ? 'إضافة مدرب' : 'Add Trainer')}</h1>
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? '...' : (isRTL ? 'حفظ' : 'Save')}
            </Button>
          </div>

          {/* Section: Photo & Basic Info */}
          <Card>
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{isRTL ? 'المعلومات الأساسية' : 'Basic Information'}</h3>

              {/* Photo Upload */}
              <div
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-4 p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
              >
                <Avatar className="h-16 w-16">
                  <AvatarImage src={photoPreview || ''} />
                  <AvatarFallback className="bg-primary/10 text-primary"><Upload className="w-6 h-6" /></AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{isRTL ? 'رفع صورة المدرب' : 'Upload trainer photo'}</p>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'اسحب أو انقر للرفع' : 'Drag or click to upload'}</p>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
              </div>

              <BilingualInput labelEn="Name" labelAr="الاسم" valueEn={form.name_en} valueAr={form.name_ar} onChangeEn={v => setForm(f => ({ ...f, name_en: v }))} onChangeAr={v => setForm(f => ({ ...f, name_ar: v }))} />
              <BilingualInput labelEn="Bio" labelAr="السيرة" valueEn={form.bio_en} valueAr={form.bio_ar} onChangeEn={v => setForm(f => ({ ...f, bio_en: v }))} onChangeAr={v => setForm(f => ({ ...f, bio_ar: v }))} isTextarea rows={3} />
            </CardContent>
          </Card>

          {/* Section: Location & Specialization */}
          <Card>
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{isRTL ? 'الموقع والتخصص' : 'Location & Specialization'}</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{isRTL ? 'الدولة' : 'Country'}</Label>
                  <Select value={form.country} onValueChange={v => setForm(f => ({ ...f, country: v, city: '' }))}>
                    <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر الدولة' : 'Select country'} /></SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map(c => (
                        <SelectItem key={c.code} value={c.code}>{isRTL ? c.ar : c.en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? 'المدينة' : 'City'}</Label>
                  {(() => {
                    const selectedCountry = COUNTRIES.find(c => c.code === form.country);
                    const cities = selectedCountry ? [...selectedCountry.cities, OTHER_OPTION] : [];
                    if (!selectedCountry) {
                      return <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder={isRTL ? 'أدخل اسم المدينة' : 'Enter city name'} />;
                    }
                    const cityInList = cities.some(c => c.en === form.city);
                    return (
                      <div className="space-y-2">
                        <Select
                          value={cityInList ? form.city : (isOtherCity ? 'Other' : '')}
                          onValueChange={v => {
                            if (v === 'Other') {
                              setIsOtherCity(true);
                              setForm(f => ({ ...f, city: '' }));
                            } else {
                              setIsOtherCity(false);
                              setForm(f => ({ ...f, city: v }));
                            }
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر المدينة' : 'Select city'} /></SelectTrigger>
                          <SelectContent>
                            {cities.map(c => (
                              <SelectItem key={c.en} value={c.en}>{isRTL ? c.ar : c.en}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isOtherCity && (
                          <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder={isRTL ? 'أدخل اسم المدينة' : 'Enter city name'} />
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2"><Label>{isRTL ? 'نوع الدراجة' : 'Bike Type'}</Label><Input value={form.bike_type} onChange={e => setForm(f => ({ ...f, bike_type: e.target.value }))} /></div>
                <div className="space-y-2"><Label>{isRTL ? 'سنوات الخبرة' : 'Years of Experience'}</Label><Input type="number" value={form.years_of_experience} onChange={e => setForm(f => ({ ...f, years_of_experience: parseInt(e.target.value) || 0 }))} /></div>
                <div className="space-y-2"><Label>{isRTL ? 'نسبة الربح (%)' : 'Profit Ratio (%)'}</Label><Input type="number" min={0} max={100} value={form.profit_ratio} onChange={e => setForm(f => ({ ...f, profit_ratio: parseFloat(e.target.value) || 0 }))} /></div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <Label className="text-sm font-medium">{isRTL ? 'الحالة' : 'Status'}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{isRTL ? 'تفعيل أو تعطيل هذا المدرب' : 'Enable or disable this trainer'}</p>
                </div>
                <Switch checked={form.status === 'active'} onCheckedChange={v => setForm(f => ({ ...f, status: v ? 'active' : 'inactive' }))} />
              </div>
            </CardContent>
          </Card>

          {/* Section: Services */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{isRTL ? 'الخدمات' : 'Services'}</h3>
              <div className="flex gap-2">
                <Input value={serviceInput} onChange={e => setServiceInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addService())} placeholder={isRTL ? 'أضف خدمة...' : 'Add service...'} className="flex-1" />
                <Button type="button" variant="outline" size="icon" onClick={addService}><Plus className="w-4 h-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.services.map((s, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 px-3 py-1.5">
                    {s}
                    <X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => setForm(f => ({ ...f, services: f.services.filter((_, idx) => idx !== i) }))} />
                  </Badge>
                ))}
                {form.services.length === 0 && <p className="text-xs text-muted-foreground">{isRTL ? 'لم تتم إضافة خدمات بعد' : 'No services added yet'}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Section: Training Assignments */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{isRTL ? 'التدريبات المعينة' : 'Training Assignments'}</h3>
              {allTrainings?.map(training => {
                const isAssigned = assignedTrainings.some(at => at.training_id === training.id);
                const assignment = assignedTrainings.find(at => at.training_id === training.id);
                return (
                  <div key={training.id} className={`rounded-lg border transition-colors ${isAssigned ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
                    <div className="flex items-center gap-3 p-4">
                      <Checkbox checked={isAssigned} onCheckedChange={(checked) => toggleTraining(training.id, !!checked)} />
                      <span className="font-medium text-sm">{isRTL ? training.name_ar : training.name_en}</span>
                    </div>
                    {isAssigned && assignment && (
                      <div className="px-4 pb-4 pt-0 space-y-3">
                        <div className="grid gap-3 md:grid-cols-2 ps-7">
                          <div className="space-y-1">
                            <Label className="text-xs">{isRTL ? 'السعر (ر.س)' : 'Price (SAR)'}</Label>
                            <div className="relative">
                              <Input type="number" value={assignment.price} onChange={e => updateAssignment(training.id, 'price', parseFloat(e.target.value) || 0)} className="pe-12" />
                              <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{isRTL ? 'ر.س' : 'SAR'}</span>
                            </div>
                          </div>
                          <div className="space-y-1"><Label className="text-xs">{isRTL ? 'المدة (ساعات)' : 'Duration (hrs)'}</Label><Input type="number" value={assignment.duration_hours} onChange={e => updateAssignment(training.id, 'duration_hours', parseFloat(e.target.value) || 0)} /></div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 ps-7">
                          <div className="space-y-1">
                            <Label className="text-xs">{isRTL ? 'الدولة' : 'Country'}</Label>
                            <Select
                              value={(() => {
                                const loc = assignment.location || '';
                                const parts = loc.split(' - ');
                                const countryPart = parts[0] || '';
                                return COUNTRIES.find(c => c.en === countryPart || c.ar === countryPart)?.code || '';
                              })()}
                              onValueChange={v => {
                                const country = COUNTRIES.find(c => c.code === v);
                                if (country) {
                                  updateAssignment(training.id, 'location', country.en);
                                }
                              }}
                            >
                              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={isRTL ? 'اختر الدولة' : 'Select country'} /></SelectTrigger>
                              <SelectContent>
                                {COUNTRIES.map(c => (
                                  <SelectItem key={c.code} value={c.code}>{isRTL ? c.ar : c.en}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">{isRTL ? 'المدينة' : 'City'}</Label>
                            {(() => {
                              const loc = assignment.location || '';
                              const parts = loc.split(' - ');
                              const countryPart = parts[0] || '';
                              const cityPart = parts[1] || '';
                              const selectedCountry = COUNTRIES.find(c => c.en === countryPart || c.ar === countryPart);
                              if (!selectedCountry) return <Input className="h-9 text-xs" disabled placeholder={isRTL ? 'اختر الدولة أولاً' : 'Select country first'} />;
                              const cities = [...selectedCountry.cities, OTHER_OPTION];
                              const cityInList = cities.some(c => c.en === cityPart);
                              const isOtherCityForTraining = cityPart && !cityInList;
                              return (
                                <div className="space-y-1.5">
                                  <Select
                                    value={cityInList ? cityPart : (isOtherCityForTraining ? 'Other' : '')}
                                    onValueChange={v => {
                                      if (v === 'Other') {
                                        updateAssignment(training.id, 'location', selectedCountry.en + ' - ');
                                      } else {
                                        updateAssignment(training.id, 'location', selectedCountry.en + ' - ' + v);
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={isRTL ? 'اختر المدينة' : 'Select city'} /></SelectTrigger>
                                    <SelectContent>
                                      {cities.map(c => (
                                        <SelectItem key={c.en} value={c.en}>{isRTL ? c.ar : c.en}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {(isOtherCityForTraining || (!cityInList && cityPart === '')) && cityPart !== '' ? null : null}
                                  {(() => {
                                    const showManual = !cityInList && loc.includes(' - ');
                                    if (!showManual) return null;
                                    return <Input className="h-9 text-xs" value={cityPart} onChange={e => updateAssignment(training.id, 'location', selectedCountry.en + ' - ' + e.target.value)} placeholder={isRTL ? 'أدخل اسم المدينة' : 'Enter city name'} />;
                                  })()}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        {/* Per-training Services */}
                        <div className="ps-7 space-y-2">
                          <Label className="text-xs">{isRTL ? 'الخدمات لهذا التدريب' : 'Services for this training'}</Label>
                          <div className="flex gap-2">
                            <Select
                              value=""
                              onValueChange={(v) => {
                                if (!assignment.services.includes(v)) {
                                  updateAssignment(training.id, 'services', [...assignment.services, v]);
                                }
                              }}
                            >
                              <SelectTrigger className="flex-1 h-9 text-xs">
                                <SelectValue placeholder={isRTL ? 'اختر من خدماتك...' : 'Pick from your services...'} />
                              </SelectTrigger>
                              <SelectContent>
                                {form.services.filter(s => !assignment.services.includes(s)).map(s => (
                                  <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                                {form.services.filter(s => !assignment.services.includes(s)).length === 0 && (
                                  <div className="px-2 py-1.5 text-xs text-muted-foreground">{isRTL ? 'لا توجد خدمات متاحة' : 'No services available'}</div>
                                )}
                              </SelectContent>
                            </Select>
                            <div className="flex gap-1">
                              <Input
                                value={trainingServiceInputs[training.id] || ''}
                                onChange={e => setTrainingServiceInputs(prev => ({ ...prev, [training.id]: e.target.value }))}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const val = (trainingServiceInputs[training.id] || '').trim();
                                    if (val && !assignment.services.includes(val)) {
                                      updateAssignment(training.id, 'services', [...assignment.services, val]);
                                      if (!form.services.includes(val)) {
                                        setForm(f => ({ ...f, services: [...f.services, val] }));
                                      }
                                      setTrainingServiceInputs(prev => ({ ...prev, [training.id]: '' }));
                                    }
                                  }
                                }}
                                placeholder={isRTL ? 'أو أضف جديدة...' : 'Or add new...'}
                                className="h-9 text-xs w-36"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 shrink-0"
                                onClick={() => {
                                  const val = (trainingServiceInputs[training.id] || '').trim();
                                  if (val && !assignment.services.includes(val)) {
                                    updateAssignment(training.id, 'services', [...assignment.services, val]);
                                    if (!form.services.includes(val)) {
                                      setForm(f => ({ ...f, services: [...f.services, val] }));
                                    }
                                    setTrainingServiceInputs(prev => ({ ...prev, [training.id]: '' }));
                                  }
                                }}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {assignment.services.map((s, i) => (
                              <Badge key={i} variant="secondary" className="gap-1 px-2 py-1 text-xs">
                                {s}
                                <X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => updateAssignment(training.id, 'services', assignment.services.filter((_, idx) => idx !== i))} />
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {!allTrainings?.length && <p className="text-xs text-muted-foreground text-center py-4">{isRTL ? 'لا توجد تدريبات متاحة' : 'No trainings available'}</p>}
            </CardContent>
          </Card>

          {/* Bottom Save */}
          <div className="flex justify-end gap-3 pb-6">
            <Button variant="outline" onClick={() => setFormOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? '...' : (isRTL ? 'حفظ' : 'Save')}
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // ─── Table View ─────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{isRTL ? 'إدارة المدربين' : 'Trainers Management'}</h1>
            <p className="text-sm text-muted-foreground">{isRTL ? 'إدارة جميع المدربين' : 'Manage all trainers'}</p>
          </div>
          <Button onClick={openAdd} size="sm"><Plus className="w-4 h-4 me-2" />{isRTL ? 'إضافة مدرب' : 'Add Trainer'}</Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              titleEn: 'Total Trainers',
              titleAr: 'إجمالي المدربين',
              value: trainers?.length || 0,
              icon: Users,
              color: 'text-blue-500',
              bgColor: 'bg-blue-500/10',
            },
            {
              titleEn: 'Active Trainers',
              titleAr: 'المدربين النشطين',
              value: trainers?.filter(t => t.status === 'active')?.length || 0,
              icon: TrendingUp,
              color: 'text-green-500',
              bgColor: 'bg-green-500/10',
            },
            {
              titleEn: 'Avg. Rating',
              titleAr: 'متوسط التقييم',
              value: (() => {
                if (!reviewStats || !trainers?.length) return '0.0';
                const allRatings = Object.values(reviewStats);
                if (!allRatings.length) return '0.0';
                return (allRatings.reduce((sum, s) => sum + s.avg, 0) / allRatings.length).toFixed(1);
              })(),
              icon: Star,
              color: 'text-yellow-500',
              bgColor: 'bg-yellow-500/10',
            },
            {
              titleEn: 'Total Students',
              titleAr: 'إجمالي الطلاب',
              value: studentCounts ? Object.values(studentCounts).reduce((a, b) => a + b, 0) : 0,
              icon: Users,
              color: 'text-purple-500',
              bgColor: 'bg-purple-500/10',
            },
          ].map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {isRTL ? stat.titleAr : stat.titleEn}
                      </p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-full ${stat.bgColor}`}>
                      <Icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2 flex-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))}
              </div>
            ) : trainers?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">{isRTL ? 'لا يوجد مدربين بعد' : 'No trainers yet'}</h3>
                <p className="text-sm text-muted-foreground mb-4">{isRTL ? 'ابدأ بإضافة أول مدرب' : 'Get started by adding your first trainer'}</p>
                <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 me-2" />{isRTL ? 'إضافة مدرب' : 'Add Trainer'}</Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    
                    <TableHead>{isRTL ? 'المدرب' : 'Trainer'}</TableHead>
                    <TableHead>{isRTL ? 'الموقع' : 'Location'}</TableHead>
                    <TableHead>{isRTL ? 'الدراجة' : 'Bike'}</TableHead>
                    <TableHead>{isRTL ? 'الخبرة' : 'Experience'}</TableHead>
                    <TableHead>{isRTL ? 'الطلاب' : 'Students'}</TableHead>
                    <TableHead>{isRTL ? 'التقييم' : 'Rating'}</TableHead>
                    <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead className="w-[140px]">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trainers?.map(t => {
                    const stats = reviewStats?.[t.id];
                    return (
                      <React.Fragment key={t.id}>
                        <TableRow className="group">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border border-border">
                                <AvatarImage src={t.photo_url || ''} />
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">{t.name_en.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium text-sm">{isRTL ? t.name_ar : t.name_en}</div>
                                <div className="text-xs text-muted-foreground">{isRTL ? t.name_en : t.name_ar}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate max-w-[120px]">{t.city}, {t.country}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Bike className="w-3.5 h-3.5 text-muted-foreground" />
                              {t.bike_type}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-secondary/30 text-xs">
                              {t.years_of_experience} {isRTL ? 'سنة' : 'yrs'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="cursor-pointer text-xs" onClick={e => { e.stopPropagation(); setExpandedId(t.id); }}>
                              <Users className="w-3 h-3 me-1" />
                              {studentCounts?.[t.id] || 0}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {stats ? (
                              <div className="flex items-center gap-1">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star key={i} className={`w-3.5 h-3.5 ${i < Math.round(stats.avg) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                                ))}
                                <span className="text-xs text-muted-foreground ms-1">({stats.count})</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {t.status === 'active' ? (
                              <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/20 text-xs">{isRTL ? 'نشط' : 'Active'}</Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground text-xs">{isRTL ? 'غير نشط' : 'Inactive'}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title={isRTL ? 'عرض الملف' : 'View Profile'} onClick={() => setViewProfileTrainer(t)}>
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title={isRTL ? 'إضافة طالب' : 'Add Student'} onClick={() => setAddStudentTrainerId(t.id)}>
                                <Plus className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title={isRTL ? 'إضافة تقييم' : 'Add Review'} onClick={() => setAddReviewTrainerId(t.id)}>
                                <Star className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteId(t.id)}>
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={9} className="p-0">
                              <TrainerExpandedRow trainer={t} isRTL={isRTL} />
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Student Dialog */}
      {addStudentTrainerId && (
        <AddStudentDialog open={!!addStudentTrainerId} onOpenChange={() => setAddStudentTrainerId(null)} trainerId={addStudentTrainerId} isRTL={isRTL} />
      )}

      {/* Add Review Dialog */}
      {addReviewTrainerId && (
        <AddReviewDialog open={!!addReviewTrainerId} onOpenChange={() => setAddReviewTrainerId(null)} trainerId={addReviewTrainerId} isRTL={isRTL} />
      )}

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <AlertDialogTitle>{isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}</AlertDialogTitle>
                <AlertDialogDescription className="mt-1">{isRTL ? 'هل أنت متأكد من حذف هذا المدرب؟ سيتم حذف جميع البيانات المرتبطة.' : 'Are you sure you want to delete this trainer? All related data will be removed.'}</AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isRTL ? 'حذف' : 'Delete'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Profile Dialog */}
      <TrainerProfileDialog trainer={viewProfileTrainer} open={!!viewProfileTrainer} onOpenChange={() => setViewProfileTrainer(null)} />
    </AdminLayout>
  );
};

export default AdminTrainers;
