import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Star, Upload, X } from 'lucide-react';
import BilingualInput from '@/components/admin/content/BilingualInput';

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
}

interface TrainerCourse {
  training_id: string;
  price: number;
  duration_hours: number;
  location: string;
  available_schedule: any;
}

const AdminTrainers: React.FC = () => {
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [serviceInput, setServiceInput] = useState('');
  const [assignedTrainings, setAssignedTrainings] = useState<TrainerCourse[]>([]);

  const defaultForm = { name_ar: '', name_en: '', bio_ar: '', bio_en: '', country: '', city: '', bike_type: '', years_of_experience: 0, services: [] as string[], status: 'active' as 'active' | 'inactive', photo_url: null as string | null };
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
        // Update trainer_courses
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
      setDialogOpen(false);
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
    setDialogOpen(true);
  };

  const openEdit = async (t: Trainer) => {
    setEditingTrainer(t);
    setForm({ name_ar: t.name_ar, name_en: t.name_en, bio_ar: t.bio_ar, bio_en: t.bio_en, country: t.country, city: t.city, bike_type: t.bike_type, years_of_experience: t.years_of_experience, services: t.services || [], status: t.status as 'active' | 'inactive', photo_url: t.photo_url });
    setPhotoFile(null);
    setPhotoPreview(t.photo_url);
    // Load assigned trainings
    const { data } = await supabase.from('trainer_courses').select('training_id, price, duration_hours, location, available_schedule').eq('trainer_id', t.id);
    setAssignedTrainings((data || []).map(d => ({ training_id: d.training_id, price: Number(d.price), duration_hours: Number(d.duration_hours), location: d.location, available_schedule: d.available_schedule })));
    setDialogOpen(true);
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
      setAssignedTrainings(prev => [...prev, { training_id: trainingId, price: 0, duration_hours: 0, location: '', available_schedule: {} }]);
    } else {
      setAssignedTrainings(prev => prev.filter(at => at.training_id !== trainingId));
    }
  };

  const updateAssignment = (trainingId: string, field: string, value: any) => {
    setAssignedTrainings(prev => prev.map(at => at.training_id === trainingId ? { ...at, [field]: value } : at));
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{isRTL ? 'إدارة المدربين' : 'Trainers Management'}</h1>
            <p className="text-muted-foreground">{isRTL ? 'إدارة جميع المدربين' : 'Manage all trainers'}</p>
          </div>
          <Button onClick={openAdd}><Plus className="w-4 h-4 me-2" />{isRTL ? 'إضافة مدرب' : 'Add Trainer'}</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'الصورة' : 'Photo'}</TableHead>
                    <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                    <TableHead>{isRTL ? 'الموقع' : 'Location'}</TableHead>
                    <TableHead>{isRTL ? 'الدراجة' : 'Bike'}</TableHead>
                    <TableHead>{isRTL ? 'الخبرة' : 'Exp.'}</TableHead>
                    <TableHead>{isRTL ? 'الطلاب' : 'Students'}</TableHead>
                    <TableHead>{isRTL ? 'التقييم' : 'Rating'}</TableHead>
                    <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead>{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trainers?.map(t => {
                    const stats = reviewStats?.[t.id];
                    return (
                      <TableRow key={t.id}>
                        <TableCell><Avatar className="h-10 w-10"><AvatarImage src={t.photo_url || ''} /><AvatarFallback>{t.name_en.charAt(0)}</AvatarFallback></Avatar></TableCell>
                        <TableCell><div>{isRTL ? t.name_ar : t.name_en}</div><div className="text-xs text-muted-foreground">{isRTL ? t.name_en : t.name_ar}</div></TableCell>
                        <TableCell>{t.city}, {t.country}</TableCell>
                        <TableCell>{t.bike_type}</TableCell>
                        <TableCell>{t.years_of_experience} {isRTL ? 'سنة' : 'yrs'}</TableCell>
                        <TableCell>{studentCounts?.[t.id] || 0}</TableCell>
                        <TableCell>{stats ? <div className="flex items-center gap-1"><Star className="w-4 h-4 fill-amber-400 text-amber-400" />{stats.avg.toFixed(1)}</div> : '-'}</TableCell>
                        <TableCell><Badge variant={t.status === 'active' ? 'default' : 'secondary'}>{t.status === 'active' ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive')}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {trainers?.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">{isRTL ? 'لا يوجد مدربين' : 'No trainers found'}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTrainer ? (isRTL ? 'تعديل مدرب' : 'Edit Trainer') : (isRTL ? 'إضافة مدرب' : 'Add Trainer')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Photo Upload */}
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={photoPreview || ''} />
                <AvatarFallback><Upload className="w-6 h-6" /></AvatarFallback>
              </Avatar>
              <div>
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 me-2" />{isRTL ? 'رفع صورة' : 'Upload Photo'}</Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
              </div>
            </div>

            <BilingualInput labelEn="Name" labelAr="الاسم" valueEn={form.name_en} valueAr={form.name_ar} onChangeEn={v => setForm(f => ({...f, name_en: v}))} onChangeAr={v => setForm(f => ({...f, name_ar: v}))} />
            <BilingualInput labelEn="Bio" labelAr="السيرة" valueEn={form.bio_en} valueAr={form.bio_ar} onChangeEn={v => setForm(f => ({...f, bio_en: v}))} onChangeAr={v => setForm(f => ({...f, bio_ar: v}))} isTextarea rows={3} />

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2"><Label>{isRTL ? 'الدولة' : 'Country'}</Label><Input value={form.country} onChange={e => setForm(f => ({...f, country: e.target.value}))} /></div>
              <div className="space-y-2"><Label>{isRTL ? 'المدينة' : 'City'}</Label><Input value={form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))} /></div>
              <div className="space-y-2"><Label>{isRTL ? 'نوع الدراجة' : 'Bike Type'}</Label><Input value={form.bike_type} onChange={e => setForm(f => ({...f, bike_type: e.target.value}))} /></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>{isRTL ? 'سنوات الخبرة' : 'Years of Experience'}</Label><Input type="number" value={form.years_of_experience} onChange={e => setForm(f => ({...f, years_of_experience: parseInt(e.target.value) || 0}))} /></div>
              <div className="flex items-center gap-3 pt-6"><Label>{isRTL ? 'نشط' : 'Active'}</Label><Switch checked={form.status === 'active'} onCheckedChange={v => setForm(f => ({...f, status: v ? 'active' : 'inactive'}))} /></div>
            </div>

            {/* Services */}
            <div className="space-y-2">
              <Label>{isRTL ? 'الخدمات' : 'Services'}</Label>
              <div className="flex gap-2">
                <Input value={serviceInput} onChange={e => setServiceInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addService())} placeholder={isRTL ? 'أضف خدمة...' : 'Add service...'} />
                <Button type="button" variant="outline" onClick={addService}><Plus className="w-4 h-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {form.services.map((s, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">{s}<X className="w-3 h-3 cursor-pointer" onClick={() => setForm(f => ({...f, services: f.services.filter((_, idx) => idx !== i)}))} /></Badge>
                ))}
              </div>
            </div>

            {/* Training Assignments */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">{isRTL ? 'التدريبات المعينة' : 'Training Assignments'}</Label>
              {allTrainings?.map(training => {
                const isAssigned = assignedTrainings.some(at => at.training_id === training.id);
                const assignment = assignedTrainings.find(at => at.training_id === training.id);
                return (
                  <Card key={training.id} className={isAssigned ? 'border-primary' : ''}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <Checkbox checked={isAssigned} onCheckedChange={(checked) => toggleTraining(training.id, !!checked)} />
                        <span className="font-medium">{isRTL ? training.name_ar : training.name_en}</span>
                      </div>
                      {isAssigned && assignment && (
                        <div className="grid gap-3 md:grid-cols-3 ps-7">
                          <div className="space-y-1"><Label className="text-xs">{isRTL ? 'السعر' : 'Price'}</Label><Input type="number" value={assignment.price} onChange={e => updateAssignment(training.id, 'price', parseFloat(e.target.value) || 0)} /></div>
                          <div className="space-y-1"><Label className="text-xs">{isRTL ? 'المدة (ساعات)' : 'Duration (hrs)'}</Label><Input type="number" value={assignment.duration_hours} onChange={e => updateAssignment(training.id, 'duration_hours', parseFloat(e.target.value) || 0)} /></div>
                          <div className="space-y-1"><Label className="text-xs">{isRTL ? 'الموقع' : 'Location'}</Label><Input value={assignment.location} onChange={e => updateAssignment(training.id, 'location', e.target.value)} /></div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>{saveMutation.isPending ? '...' : (isRTL ? 'حفظ' : 'Save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}</AlertDialogTitle>
            <AlertDialogDescription>{isRTL ? 'هل أنت متأكد من حذف هذا المدرب؟' : 'Are you sure you want to delete this trainer?'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground">{isRTL ? 'حذف' : 'Delete'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminTrainers;
