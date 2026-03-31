import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface Student {
  id: string;
  trainer_id: string;
  training_id: string;
  full_name: string;
  phone: string;
  email: string;
  enrolled_at: string;
}

const AdminTrainingStudents: React.FC = () => {
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Student | null>(null);
  const [filterTrainer, setFilterTrainer] = useState('all');
  const [filterTraining, setFilterTraining] = useState('all');
  const [form, setForm] = useState({ trainer_id: '', training_id: '', full_name: '', phone: '', email: '' });

  const { data: students, isLoading } = useQuery({
    queryKey: ['admin-training-students'],
    queryFn: async () => {
      const { data, error } = await supabase.from('training_students').select('*').order('enrolled_at', { ascending: false });
      if (error) throw error;
      return data as Student[];
    },
  });

  const { data: trainers } = useQuery({
    queryKey: ['all-trainers-list'],
    queryFn: async () => {
      const { data } = await supabase.from('trainers').select('id, name_ar, name_en');
      return data || [];
    },
  });

  const { data: trainings } = useQuery({
    queryKey: ['all-trainings-list'],
    queryFn: async () => {
      const { data } = await supabase.from('trainings').select('id, name_ar, name_en');
      return data || [];
    },
  });

  const { data: trainerCourses } = useQuery({
    queryKey: ['all-trainer-courses'],
    queryFn: async () => {
      const { data } = await supabase.from('trainer_courses').select('trainer_id, training_id');
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form & { id?: string }) => {
      const { id, ...rest } = data;
      if (id) {
        const { error } = await supabase.from('training_students').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('training_students').insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-training-students'] });
      setDialogOpen(false);
      toast.success(isRTL ? 'تم الحفظ' : 'Saved');
    },
    onError: () => toast.error(isRTL ? 'خطأ' : 'Error'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('training_students').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-training-students'] });
      setDeleteId(null);
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
    },
  });

  const filtered = students?.filter(s => {
    if (filterTrainer !== 'all' && s.trainer_id !== filterTrainer) return false;
    if (filterTraining !== 'all' && s.training_id !== filterTraining) return false;
    return true;
  });

  const availableTrainingsForTrainer = form.trainer_id ? trainerCourses?.filter(tc => tc.trainer_id === form.trainer_id).map(tc => tc.training_id) : [];

  const getTrainerName = (id: string) => { const t = trainers?.find(t => t.id === id); return t ? (isRTL ? t.name_ar : t.name_en) : ''; };
  const getTrainingName = (id: string) => { const t = trainings?.find(t => t.id === id); return t ? (isRTL ? t.name_ar : t.name_en) : ''; };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">{isRTL ? 'إدارة الطلاب' : 'Students Management'}</h1>
            <p className="text-muted-foreground">{isRTL ? 'إدارة طلاب التدريبات' : 'Manage training students'}</p>
          </div>
          <Button onClick={() => { setEditing(null); setForm({ trainer_id: '', training_id: '', full_name: '', phone: '', email: '' }); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 me-2" />{isRTL ? 'إضافة طالب' : 'Add Student'}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <Select value={filterTrainer} onValueChange={setFilterTrainer}>
            <SelectTrigger className="w-48"><SelectValue placeholder={isRTL ? 'المدرب' : 'Trainer'} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
              {trainers?.map(t => <SelectItem key={t.id} value={t.id}>{isRTL ? t.name_ar : t.name_en}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterTraining} onValueChange={setFilterTraining}>
            <SelectTrigger className="w-48"><SelectValue placeholder={isRTL ? 'التدريب' : 'Training'} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
              {trainings?.map(t => <SelectItem key={t.id} value={t.id}>{isRTL ? t.name_ar : t.name_en}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? <div className="p-6 space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'الاسم' : 'Full Name'}</TableHead>
                    <TableHead>{isRTL ? 'الهاتف' : 'Phone'}</TableHead>
                    <TableHead>{isRTL ? 'الإيميل' : 'Email'}</TableHead>
                    <TableHead>{isRTL ? 'المدرب' : 'Trainer'}</TableHead>
                    <TableHead>{isRTL ? 'التدريب' : 'Training'}</TableHead>
                    <TableHead>{isRTL ? 'تاريخ التسجيل' : 'Enrolled'}</TableHead>
                    <TableHead>{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map(s => (
                    <TableRow key={s.id}>
                      <TableCell>{s.full_name}</TableCell>
                      <TableCell dir="ltr">{s.phone}</TableCell>
                      <TableCell>{s.email}</TableCell>
                      <TableCell>{getTrainerName(s.trainer_id)}</TableCell>
                      <TableCell>{getTrainingName(s.training_id)}</TableCell>
                      <TableCell>{format(new Date(s.enrolled_at), 'yyyy-MM-dd')}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(s); setForm({ trainer_id: s.trainer_id, training_id: s.training_id, full_name: s.full_name, phone: s.phone, email: s.email }); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered?.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{isRTL ? 'لا يوجد طلاب' : 'No students'}</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? (isRTL ? 'تعديل طالب' : 'Edit Student') : (isRTL ? 'إضافة طالب' : 'Add Student')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>{isRTL ? 'الاسم الكامل' : 'Full Name'}</Label><Input value={form.full_name} onChange={e => setForm(f => ({...f, full_name: e.target.value}))} /></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>{isRTL ? 'الهاتف' : 'Phone'}</Label><Input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} dir="ltr" /></div>
              <div className="space-y-2"><Label>{isRTL ? 'الإيميل' : 'Email'}</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} dir="ltr" /></div>
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'المدرب' : 'Trainer'}</Label>
              <Select value={form.trainer_id} onValueChange={v => setForm(f => ({...f, trainer_id: v, training_id: ''}))}>
                <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر مدرب' : 'Select trainer'} /></SelectTrigger>
                <SelectContent>{trainers?.map(t => <SelectItem key={t.id} value={t.id}>{isRTL ? t.name_ar : t.name_en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'التدريب' : 'Training'}</Label>
              <Select value={form.training_id} onValueChange={v => setForm(f => ({...f, training_id: v}))} disabled={!form.trainer_id}>
                <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر تدريب' : 'Select training'} /></SelectTrigger>
                <SelectContent>
                  {trainings?.filter(t => availableTrainingsForTrainer?.includes(t.id)).map(t => (
                    <SelectItem key={t.id} value={t.id}>{isRTL ? t.name_ar : t.name_en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={() => saveMutation.mutate({...form, id: editing?.id})} disabled={saveMutation.isPending}>{saveMutation.isPending ? '...' : (isRTL ? 'حفظ' : 'Save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}</AlertDialogTitle><AlertDialogDescription>{isRTL ? 'هل أنت متأكد؟' : 'Are you sure?'}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel><AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground">{isRTL ? 'حذف' : 'Delete'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminTrainingStudents;
