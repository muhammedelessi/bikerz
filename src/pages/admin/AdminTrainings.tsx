import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Users, BookOpen, AlertTriangle, ArrowLeft, ArrowRight, ImagePlus, X, Eye } from 'lucide-react';
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
  background_image: string | null;
}

const AdminTrainings: React.FC = () => {
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    mutationFn: async (data: typeof form & { id?: string; background_image?: string | null }) => {
      const { id, ...rest } = data;
      if (id) {
        const { error } = await supabase.from('trainings').update(rest as any).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('trainings').insert(rest as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trainings'] });
      setFormOpen(false);
      setUploadingImage(false);
      toast.success(isRTL ? 'تم الحفظ بنجاح' : 'Saved successfully');
    },
    onError: () => { setUploadingImage(false); toast.error(isRTL ? 'حدث خطأ' : 'An error occurred'); },
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
    setImageFile(null);
    setImagePreview(null);
    setFormOpen(true);
  };

  const openEdit = (t: Training) => {
    setEditingTraining(t);
    setForm({ name_ar: t.name_ar, name_en: t.name_en, type: t.type as typeof form.type, description_ar: t.description_ar, description_en: t.description_en, level: t.level as typeof form.level, status: t.status as typeof form.status });
    setImageFile(null);
    setImagePreview(t.background_image || null);
    setFormOpen(true);
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return imagePreview;
    const ext = imageFile.name.split('.').pop();
    const path = `training-bg-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('training-images').upload(path, imageFile, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('training-images').getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    try {
      setUploadingImage(true);
      const bgUrl = await uploadImage();
      saveMutation.mutate({ ...form, background_image: bgUrl, id: editingTraining?.id });
    } catch {
      toast.error(isRTL ? 'فشل رفع الصورة' : 'Image upload failed');
      setUploadingImage(false);
    }
  };

  const levelBadgeClasses: Record<string, string> = {
    beginner: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
    intermediate: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
    advanced: 'bg-red-500/15 text-red-500 border-red-500/30',
  };

  const levelLabel = (level: string) => isRTL
    ? { beginner: 'مبتدئ', intermediate: 'متوسط', advanced: 'متقدم' }[level] || level
    : level.charAt(0).toUpperCase() + level.slice(1);

  const typeBadgeClasses: Record<string, string> = {
    theory: 'bg-purple-500/15 text-purple-500 border-purple-500/30',
    practical: 'bg-orange-500/15 text-orange-500 border-orange-500/30',
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
              <h1 className="text-2xl font-bold">{editingTraining ? (isRTL ? 'تعديل تدريب' : 'Edit Training') : (isRTL ? 'إضافة تدريب' : 'Add Training')}</h1>
            </div>
            <Button onClick={handleSave} disabled={saveMutation.isPending || uploadingImage}>
              {(saveMutation.isPending || uploadingImage) ? '...' : (isRTL ? 'حفظ' : 'Save')}
            </Button>
          </div>

          {/* Section: Basic Info */}
          <Card>
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{isRTL ? 'المعلومات الأساسية' : 'Basic Information'}</h3>
              <BilingualInput labelEn="Name" labelAr="الاسم" valueEn={form.name_en} valueAr={form.name_ar} onChangeEn={v => setForm(f => ({...f, name_en: v}))} onChangeAr={v => setForm(f => ({...f, name_ar: v}))} placeholderEn="Training name" placeholderAr="اسم التدريب" />
            </CardContent>
          </Card>

          {/* Section: Description */}
          <Card>
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{isRTL ? 'الوصف' : 'Description'}</h3>
              <BilingualInput labelEn="Description" labelAr="الوصف" valueEn={form.description_en} valueAr={form.description_ar} onChangeEn={v => setForm(f => ({...f, description_en: v}))} onChangeAr={v => setForm(f => ({...f, description_ar: v}))} isTextarea rows={3} />
            </CardContent>
          </Card>

          {/* Section: Background Image */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{isRTL ? 'صورة الخلفية' : 'Background Image'}</h3>
              <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageSelect} />
              {imagePreview ? (
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <img src={imagePreview} alt="Background" className="w-full h-48 object-cover" />
                  <Button variant="destructive" size="icon" className="absolute top-2 end-2 h-8 w-8" onClick={() => { setImageFile(null); setImagePreview(null); }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-48 rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <ImagePlus className="w-8 h-8" />
                  <span className="text-sm">{isRTL ? 'اضغط لرفع صورة الخلفية' : 'Click to upload background image'}</span>
                </button>
              )}
            </CardContent>
          </Card>

          {/* Section: Classification */}
          <Card>
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{isRTL ? 'التصنيف' : 'Classification'}</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{isRTL ? 'النوع' : 'Type'}</Label>
                  <Select value={form.type} onValueChange={v => setForm(f => ({...f, type: v as typeof f.type}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="theory">{isRTL ? 'نظري' : 'Theory'}</SelectItem>
                      <SelectItem value="practical">{isRTL ? 'عملي' : 'Practical'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? 'المستوى' : 'Level'}</Label>
                  <Select value={form.level} onValueChange={v => setForm(f => ({...f, level: v as typeof f.level}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">{isRTL ? 'مبتدئ' : 'Beginner'}</SelectItem>
                      <SelectItem value="intermediate">{isRTL ? 'متوسط' : 'Intermediate'}</SelectItem>
                      <SelectItem value="advanced">{isRTL ? 'متقدم' : 'Advanced'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <Label className="text-sm font-medium">{isRTL ? 'الحالة' : 'Status'}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{isRTL ? 'تفعيل أو تعطيل هذا التدريب' : 'Enable or disable this training'}</p>
                </div>
                <Switch checked={form.status === 'active'} onCheckedChange={v => setForm(f => ({...f, status: v ? 'active' : 'archived'}))} />
              </div>
            </CardContent>
          </Card>

          {/* Bottom Save */}
          <div className="flex justify-end gap-3 pb-6">
            <Button variant="outline" onClick={() => setFormOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
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
            <h1 className="text-2xl font-bold">{isRTL ? 'إدارة التدريبات' : 'Trainings Management'}</h1>
            <p className="text-sm text-muted-foreground">{isRTL ? 'إدارة جميع التدريبات المتاحة' : 'Manage all available trainings'}</p>
          </div>
          <Button onClick={openAdd} size="sm"><Plus className="w-4 h-4 me-2" />{isRTL ? 'إضافة تدريب' : 'Add Training'}</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : trainings?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <BookOpen className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">{isRTL ? 'لا توجد تدريبات بعد' : 'No trainings yet'}</h3>
                <p className="text-sm text-muted-foreground mb-4">{isRTL ? 'ابدأ بإضافة أول تدريب' : 'Get started by adding your first training'}</p>
                <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 me-2" />{isRTL ? 'إضافة تدريب' : 'Add Training'}</Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                    <TableHead>{isRTL ? 'النوع' : 'Type'}</TableHead>
                    <TableHead>{isRTL ? 'المستوى' : 'Level'}</TableHead>
                    <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead>{isRTL ? 'المدربين' : 'Trainers'}</TableHead>
                    <TableHead className="w-[100px]">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trainings?.map(t => (
                    <TableRow key={t.id} className="group">
                      <TableCell>
                        <div className="font-medium">{isRTL ? t.name_ar : t.name_en}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{isRTL ? t.name_en : t.name_ar}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={typeBadgeClasses[t.type] || ''}>
                          {t.type === 'theory' ? (isRTL ? 'نظري' : 'Theory') : (isRTL ? 'عملي' : 'Practical')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={levelBadgeClasses[t.level] || ''}>
                          {levelLabel(t.level)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {t.status === 'active' ? (
                          <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/20">{isRTL ? 'نشط' : 'Active'}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">{isRTL ? 'مؤرشف' : 'Archived'}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm">{trainerCounts?.[t.id] || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title={isRTL ? 'عرض التفاصيل' : 'View Details'} onClick={() => navigate(`/admin/trainings/${t.id}`)}><Eye className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteId(t.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

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
                <AlertDialogDescription className="mt-1">{isRTL ? 'هل أنت متأكد من حذف هذا التدريب؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this training? This action cannot be undone.'}</AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isRTL ? 'حذف' : 'Delete'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TrainingProfileDialog training={viewTraining} open={!!viewTraining} onOpenChange={() => setViewTraining(null)} />
    </AdminLayout>
  );
};

export default AdminTrainings;
