import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import BilingualInput from '@/components/admin/content/BilingualInput';

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
}

const AdminTrainings: React.FC = () => {
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [form, setForm] = useState({
    name_ar: '', name_en: '', type: 'theory' as 'theory' | 'practical', description_ar: '', description_en: '', level: 'beginner' as 'beginner' | 'intermediate' | 'advanced', status: 'active' as 'active' | 'archived',
  });

  const { data: trainings, isLoading } = useQuery({
    queryKey: ['admin-trainings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('trainings').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Training[];
    },
  });

  const { data: trainerCounts } = useQuery({
    queryKey: ['training-trainer-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('trainer_courses').select('training_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach(tc => { counts[tc.training_id] = (counts[tc.training_id] || 0) + 1; });
      return counts;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form & { id?: string }) => {
      const { id, ...rest } = data;
      if (id) {
        const { error } = await supabase.from('trainings').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('trainings').insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trainings'] });
      setDialogOpen(false);
      toast.success(isRTL ? 'تم الحفظ بنجاح' : 'Saved successfully');
    },
    onError: () => toast.error(isRTL ? 'حدث خطأ' : 'An error occurred'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('trainings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trainings'] });
      setDeleteId(null);
      toast.success(isRTL ? 'تم الحذف' : 'Deleted successfully');
    },
    onError: () => toast.error(isRTL ? 'حدث خطأ' : 'An error occurred'),
  });

  const openAdd = () => {
    setEditingTraining(null);
    setForm({ name_ar: '', name_en: '', type: 'theory', description_ar: '', description_en: '', level: 'beginner', status: 'active' });
    setDialogOpen(true);
  };

  const openEdit = (t: Training) => {
    setEditingTraining(t);
    setForm({ name_ar: t.name_ar, name_en: t.name_en, type: t.type as typeof form.type, description_ar: t.description_ar, description_en: t.description_en, level: t.level as typeof form.level, status: t.status as typeof form.status });
    setDialogOpen(true);
  };

  const handleSave = () => {
    saveMutation.mutate({ ...form, id: editingTraining?.id });
  };

  const levelBadge = (level: string) => {
    const colors: Record<string, string> = { beginner: 'bg-green-500/10 text-green-600', intermediate: 'bg-amber-500/10 text-amber-600', advanced: 'bg-red-500/10 text-red-600' };
    return <Badge variant="outline" className={colors[level] || ''}>{isRTL ? { beginner: 'مبتدئ', intermediate: 'متوسط', advanced: 'متقدم' }[level] : level}</Badge>;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{isRTL ? 'إدارة التدريبات' : 'Trainings Management'}</h1>
            <p className="text-muted-foreground">{isRTL ? 'إدارة جميع التدريبات المتاحة' : 'Manage all available trainings'}</p>
          </div>
          <Button onClick={openAdd}><Plus className="w-4 h-4 me-2" />{isRTL ? 'إضافة تدريب' : 'Add Training'}</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'الاسم (عربي)' : 'Name (AR)'}</TableHead>
                    <TableHead>{isRTL ? 'الاسم (إنجليزي)' : 'Name (EN)'}</TableHead>
                    <TableHead>{isRTL ? 'النوع' : 'Type'}</TableHead>
                    <TableHead>{isRTL ? 'المستوى' : 'Level'}</TableHead>
                    <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead>{isRTL ? 'المدربين' : 'Trainers'}</TableHead>
                    <TableHead>{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trainings?.map(t => (
                    <TableRow key={t.id}>
                      <TableCell dir="rtl">{t.name_ar}</TableCell>
                      <TableCell dir="ltr">{t.name_en}</TableCell>
                      <TableCell><Badge variant="secondary">{t.type === 'theory' ? (isRTL ? 'نظري' : 'Theory') : (isRTL ? 'عملي' : 'Practical')}</Badge></TableCell>
                      <TableCell>{levelBadge(t.level)}</TableCell>
                      <TableCell><Badge variant={t.status === 'active' ? 'default' : 'secondary'}>{t.status === 'active' ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'مؤرشف' : 'Archived')}</Badge></TableCell>
                      <TableCell><div className="flex items-center gap-1"><Users className="w-4 h-4" />{trainerCounts?.[t.id] || 0}</div></TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {trainings?.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{isRTL ? 'لا توجد تدريبات' : 'No trainings found'}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTraining ? (isRTL ? 'تعديل تدريب' : 'Edit Training') : (isRTL ? 'إضافة تدريب' : 'Add Training')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <BilingualInput labelEn="Name" labelAr="الاسم" valueEn={form.name_en} valueAr={form.name_ar} onChangeEn={v => setForm(f => ({...f, name_en: v}))} onChangeAr={v => setForm(f => ({...f, name_ar: v}))} placeholderEn="Training name" placeholderAr="اسم التدريب" />
            <BilingualInput labelEn="Description" labelAr="الوصف" valueEn={form.description_en} valueAr={form.description_ar} onChangeEn={v => setForm(f => ({...f, description_en: v}))} onChangeAr={v => setForm(f => ({...f, description_ar: v}))} isTextarea rows={3} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{isRTL ? 'النوع' : 'Type'}</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({...f, type: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="theory">{isRTL ? 'نظري' : 'Theory'}</SelectItem>
                    <SelectItem value="practical">{isRTL ? 'عملي' : 'Practical'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? 'المستوى' : 'Level'}</Label>
                <Select value={form.level} onValueChange={v => setForm(f => ({...f, level: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">{isRTL ? 'مبتدئ' : 'Beginner'}</SelectItem>
                    <SelectItem value="intermediate">{isRTL ? 'متوسط' : 'Intermediate'}</SelectItem>
                    <SelectItem value="advanced">{isRTL ? 'متقدم' : 'Advanced'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label>{isRTL ? 'نشط' : 'Active'}</Label>
              <Switch checked={form.status === 'active'} onCheckedChange={v => setForm(f => ({...f, status: v ? 'active' : 'archived'}))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>{saveMutation.isPending ? '...' : (isRTL ? 'حفظ' : 'Save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}</AlertDialogTitle>
            <AlertDialogDescription>{isRTL ? 'هل أنت متأكد من حذف هذا التدريب؟' : 'Are you sure you want to delete this training?'}</AlertDialogDescription>
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

export default AdminTrainings;
