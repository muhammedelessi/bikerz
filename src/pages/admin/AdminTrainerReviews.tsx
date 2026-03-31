import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Star } from 'lucide-react';
import { format } from 'date-fns';

interface Review {
  id: string;
  trainer_id: string;
  student_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

const AdminTrainerReviews: React.FC = () => {
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Review | null>(null);
  const [filterTrainer, setFilterTrainer] = useState('all');
  const [form, setForm] = useState({ trainer_id: '', student_name: '', rating: 5, comment: '' });

  const { data: reviews, isLoading } = useQuery({
    queryKey: ['admin-trainer-reviews'],
    queryFn: async () => {
      const { data, error } = await supabase.from('trainer_reviews').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Review[];
    },
  });

  const { data: trainers } = useQuery({
    queryKey: ['all-trainers-list'],
    queryFn: async () => {
      const { data } = await supabase.from('trainers').select('id, name_ar, name_en');
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form & { id?: string }) => {
      const { id, ...rest } = data;
      if (id) {
        const { error } = await supabase.from('trainer_reviews').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('trainer_reviews').insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trainer-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['trainer-review-stats'] });
      setDialogOpen(false);
      toast.success(isRTL ? 'تم الحفظ' : 'Saved');
    },
    onError: () => toast.error(isRTL ? 'خطأ' : 'Error'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('trainer_reviews').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trainer-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['trainer-review-stats'] });
      setDeleteId(null);
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
    },
  });

  const filtered = reviews?.filter(r => filterTrainer === 'all' || r.trainer_id === filterTrainer);
  const getTrainerName = (id: string) => { const t = trainers?.find(t => t.id === id); return t ? (isRTL ? t.name_ar : t.name_en) : ''; };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">{isRTL ? 'إدارة التقييمات' : 'Reviews Management'}</h1>
            <p className="text-muted-foreground">{isRTL ? 'إدارة تقييمات المدربين' : 'Manage trainer reviews'}</p>
          </div>
          <Button onClick={() => { setEditing(null); setForm({ trainer_id: '', student_name: '', rating: 5, comment: '' }); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 me-2" />{isRTL ? 'إضافة تقييم' : 'Add Review'}
          </Button>
        </div>

        <Select value={filterTrainer} onValueChange={setFilterTrainer}>
          <SelectTrigger className="w-48"><SelectValue placeholder={isRTL ? 'المدرب' : 'Trainer'} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
            {trainers?.map(t => <SelectItem key={t.id} value={t.id}>{isRTL ? t.name_ar : t.name_en}</SelectItem>)}
          </SelectContent>
        </Select>

        <Card>
          <CardContent className="p-0">
            {isLoading ? <div className="p-6 space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'المدرب' : 'Trainer'}</TableHead>
                    <TableHead>{isRTL ? 'اسم الطالب' : 'Student Name'}</TableHead>
                    <TableHead>{isRTL ? 'التقييم' : 'Rating'}</TableHead>
                    <TableHead>{isRTL ? 'التعليق' : 'Comment'}</TableHead>
                    <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                    <TableHead>{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{getTrainerName(r.trainer_id)}</TableCell>
                      <TableCell>{r.student_name}</TableCell>
                      <TableCell><div className="flex items-center gap-1">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`w-4 h-4 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted'}`} />)}</div></TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.comment}</TableCell>
                      <TableCell>{format(new Date(r.created_at), 'yyyy-MM-dd')}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setForm({ trainer_id: r.trainer_id, student_name: r.student_name, rating: r.rating, comment: r.comment }); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{isRTL ? 'لا توجد تقييمات' : 'No reviews'}</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? (isRTL ? 'تعديل تقييم' : 'Edit Review') : (isRTL ? 'إضافة تقييم' : 'Add Review')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{isRTL ? 'المدرب' : 'Trainer'}</Label>
              <Select value={form.trainer_id} onValueChange={v => setForm(f => ({...f, trainer_id: v}))}>
                <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر مدرب' : 'Select trainer'} /></SelectTrigger>
                <SelectContent>{trainers?.map(t => <SelectItem key={t.id} value={t.id}>{isRTL ? t.name_ar : t.name_en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>{isRTL ? 'اسم الطالب' : 'Student Name'}</Label><Input value={form.student_name} onChange={e => setForm(f => ({...f, student_name: e.target.value}))} /></div>
            <div className="space-y-2">
              <Label>{isRTL ? 'التقييم' : 'Rating'}</Label>
              <div className="flex gap-1">{[1,2,3,4,5].map(v => <button key={v} type="button" onClick={() => setForm(f => ({...f, rating: v}))}><Star className={`w-6 h-6 cursor-pointer ${v <= form.rating ? 'fill-amber-400 text-amber-400' : 'text-muted'}`} /></button>)}</div>
            </div>
            <div className="space-y-2"><Label>{isRTL ? 'التعليق' : 'Comment'}</Label><Textarea value={form.comment} onChange={e => setForm(f => ({...f, comment: e.target.value}))} rows={3} /></div>
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

export default AdminTrainerReviews;
