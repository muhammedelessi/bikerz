import React, { useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Eye, Upload, Loader2, Image as ImageIcon, GripVertical } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface HeroAd {
  id: string;
  title: string;
  target_url: string;
  is_active: boolean;
  position: number;
  image_desktop_en: string | null;
  image_desktop_ar: string | null;
  image_mobile_en: string | null;
  image_mobile_ar: string | null;
  created_at: string;
  updated_at: string;
}

type AdFormData = Omit<HeroAd, 'id' | 'created_at' | 'updated_at'>;

const EMPTY_FORM: AdFormData = {
  title: '',
  target_url: '/courses',
  is_active: true,
  position: 0,
  image_desktop_en: null,
  image_desktop_ar: null,
  image_mobile_en: null,
  image_mobile_ar: null,
};

/* ── Image Upload Field ── */
const AdImageUpload: React.FC<{
  label: string;
  value: string | null;
  onChange: (url: string) => void;
  aspectHint: string;
}> = ({ label, value, onChange, aspectHint }) => {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Max 10MB'); return; }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `ads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('hero-ads').upload(path, file, { cacheControl: '3600', upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('hero-ads').getPublicUrl(path);
      onChange(publicUrl);
      toast.success('Image uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{label} <span className="text-muted-foreground">({aspectHint})</span></Label>
      <div className={cn(
        "relative border-2 border-dashed border-border/50 rounded-lg overflow-hidden flex items-center justify-center bg-muted/30 hover:border-primary/40 transition-colors cursor-pointer",
        aspectHint.includes('9:16') ? 'aspect-[9/16] max-h-[220px]' : 'aspect-video max-h-[140px]'
      )}>
        {value ? (
          <img src={value} alt={label} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground p-2">
            <ImageIcon className="w-6 h-6" />
            <span className="text-[10px]">Click to upload</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        )}
        <input type="file" accept="image/*" onChange={handleUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
      </div>
    </div>
  );
};

/* ── Preview Modal ── */
const AdPreview: React.FC<{ ad: AdFormData }> = ({ ad }) => (
  <div className="grid grid-cols-2 gap-4">
    {[
      { label: 'Desktop EN', src: ad.image_desktop_en, cls: 'aspect-[9/16]' },
      { label: 'Desktop AR', src: ad.image_desktop_ar, cls: 'aspect-[9/16]' },
      { label: 'Mobile EN', src: ad.image_mobile_en, cls: 'aspect-video' },
      { label: 'Mobile AR', src: ad.image_mobile_ar, cls: 'aspect-video' },
    ].map(({ label, src, cls }) => (
      <div key={label} className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className={cn('rounded-lg border border-border/30 overflow-hidden bg-muted/20', cls)}>
          {src ? (
            <img src={src} alt={label} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No image</div>
          )}
        </div>
      </div>
    ))}
  </div>
);

/* ── Main Page ── */
const AdminAds: React.FC = () => {
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewAd, setPreviewAd] = useState<AdFormData | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AdFormData>(EMPTY_FORM);

  const { data: ads = [], isLoading } = useQuery({
    queryKey: ['admin-hero-ads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hero_ads')
        .select('*')
        .order('position', { ascending: true });
      if (error) throw error;
      return data as HeroAd[];
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ['admin-courses-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, title_ar')
        .order('title');
      if (error) throw error;
      return data as { id: string; title: string; title_ar: string | null }[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase.from('hero_ads').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('hero_ads').insert({ ...form, position: ads.length });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-hero-ads'] });
      queryClient.invalidateQueries({ queryKey: ['hero-ads-public'] });
      toast.success(editingId ? 'Ad updated' : 'Ad created');
      resetForm();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('hero_ads').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-hero-ads'] });
      queryClient.invalidateQueries({ queryKey: ['hero-ads-public'] });
      toast.success('Ad deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('hero_ads').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-hero-ads'] });
      queryClient.invalidateQueries({ queryKey: ['hero-ads-public'] });
    },
  });

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setDialogOpen(false);
  };

  const openEdit = (ad: HeroAd) => {
    setEditingId(ad.id);
    setForm({
      title: ad.title,
      target_url: ad.target_url,
      is_active: ad.is_active,
      position: ad.position,
      image_desktop_en: ad.image_desktop_en,
      image_desktop_ar: ad.image_desktop_ar,
      image_mobile_en: ad.image_mobile_en,
      image_mobile_ar: ad.image_mobile_ar,
    });
    setDialogOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{isRTL ? 'إدارة الإعلانات' : 'Ads Management'}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isRTL ? 'إدارة إعلانات الصفحة الرئيسية للسلايدر' : 'Manage homepage hero slider advertisements'}
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetForm(); else setDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={() => { resetForm(); setDialogOpen(true); }}>
                <Plus className="w-4 h-4" />
                {isRTL ? 'إعلان جديد' : 'New Ad'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? (isRTL ? 'تعديل الإعلان' : 'Edit Ad') : (isRTL ? 'إعلان جديد' : 'New Ad')}</DialogTitle>
              </DialogHeader>

              <div className="space-y-5 pt-2">
                {/* Title & URL */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{isRTL ? 'العنوان' : 'Title'}</Label>
                    <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Summer Sale Ad" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{isRTL ? 'الكورس المستهدف' : 'Target Course'}</Label>
                    <Select value={form.target_url} onValueChange={(v) => setForm(f => ({ ...f, target_url: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder={isRTL ? 'اختر كورس' : 'Select a course'} />
                      </SelectTrigger>
                      <SelectContent>
                        {courses.map((c) => (
                          <SelectItem key={c.id} value={`/courses/${c.id}`}>
                            {isRTL ? (c.title_ar || c.title) : c.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center gap-3">
                  <Switch checked={form.is_active} onCheckedChange={(c) => setForm(f => ({ ...f, is_active: c }))} />
                  <Label>{isRTL ? 'نشط' : 'Active'}</Label>
                </div>

                {/* Image uploads */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 text-foreground">{isRTL ? 'صور سطح المكتب (9:16)' : 'Desktop Images (9:16 Portrait)'}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <AdImageUpload label={isRTL ? 'الإنجليزية' : 'English'} value={form.image_desktop_en} onChange={(url) => setForm(f => ({ ...f, image_desktop_en: url }))} aspectHint="9:16" />
                    <AdImageUpload label={isRTL ? 'العربية' : 'Arabic'} value={form.image_desktop_ar} onChange={(url) => setForm(f => ({ ...f, image_desktop_ar: url }))} aspectHint="9:16" />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-3 text-foreground">{isRTL ? 'صور الجوال (16:9)' : 'Mobile Images (16:9 Landscape)'}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <AdImageUpload label={isRTL ? 'الإنجليزية' : 'English'} value={form.image_mobile_en} onChange={(url) => setForm(f => ({ ...f, image_mobile_en: url }))} aspectHint="16:9" />
                    <AdImageUpload label={isRTL ? 'العربية' : 'Arabic'} value={form.image_mobile_ar} onChange={(url) => setForm(f => ({ ...f, image_mobile_ar: url }))} aspectHint="16:9" />
                  </div>
                </div>

                {/* Preview button */}
                <Button variant="outline" className="w-full gap-2" onClick={() => { setPreviewAd(form); setPreviewOpen(true); }}>
                  <Eye className="w-4 h-4" />
                  {isRTL ? 'معاينة' : 'Preview All Versions'}
                </Button>

                {/* Save */}
                <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.title}>
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {editingId ? (isRTL ? 'حفظ التعديلات' : 'Save Changes') : (isRTL ? 'إنشاء الإعلان' : 'Create Ad')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{isRTL ? 'معاينة الإعلان' : 'Ad Preview'}</DialogTitle>
            </DialogHeader>
            {previewAd && <AdPreview ad={previewAd} />}
          </DialogContent>
        </Dialog>

        {/* Ads Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{isRTL ? 'الإعلانات الحالية' : 'Current Ads'} ({ads.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : ads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {isRTL ? 'لا توجد إعلانات بعد' : 'No ads yet. Create your first ad.'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>{isRTL ? 'العنوان' : 'Title'}</TableHead>
                    <TableHead>{isRTL ? 'الصور' : 'Images'}</TableHead>
                    <TableHead>{isRTL ? 'الرابط' : 'URL'}</TableHead>
                    <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead className="text-right">{isRTL ? 'الإجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ads.map((ad, idx) => (
                    <TableRow key={ad.id}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{ad.title || '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {[ad.image_desktop_en, ad.image_desktop_ar, ad.image_mobile_en, ad.image_mobile_ar].map((img, i) => (
                            <div key={i} className={cn('w-8 h-8 rounded border border-border/30 overflow-hidden bg-muted/20', !img && 'opacity-30')}>
                              {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-full h-full p-1.5 text-muted-foreground" />}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{ad.target_url}</TableCell>
                      <TableCell>
                        <Switch
                          checked={ad.is_active}
                          onCheckedChange={(c) => toggleMutation.mutate({ id: ad.id, is_active: c })}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setPreviewAd(ad); setPreviewOpen(true); }}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(ad)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { if (confirm(isRTL ? 'حذف هذا الإعلان؟' : 'Delete this ad?')) deleteMutation.mutate(ad.id); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
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
    </AdminLayout>
  );
};

export default AdminAds;
