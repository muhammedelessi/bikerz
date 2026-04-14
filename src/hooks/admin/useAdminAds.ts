import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface HeroAd {
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

export type AdFormData = Omit<HeroAd, 'id' | 'created_at' | 'updated_at'>;

export const EMPTY_FORM: AdFormData = {
  title: '',
  target_url: '/courses',
  is_active: true,
  position: 0,
  image_desktop_en: null,
  image_desktop_ar: null,
  image_mobile_en: null,
  image_mobile_ar: null,
};

export const useAdminAds = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewAd, setPreviewAd] = useState<AdFormData | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AdFormData>(EMPTY_FORM);

  const { data: ads = [], isLoading } = useQuery({
    queryKey: ['admin-hero-ads'],
    queryFn: async () => {
      const { data, error } = await supabase.from('hero_ads').select('*').order('position', { ascending: true });
      if (error) throw error;
      return data as HeroAd[];
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ['admin-courses-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('courses').select('id, title, title_ar').order('title');
      if (error) throw error;
      return data as { id: string; title: string; title_ar: string | null }[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase
          .from('hero_ads')
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq('id', editingId);
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

  const uploadAdImage = async (file: File) => {
    if (!file.type.startsWith('image/')) throw new Error('Please select an image');
    if (file.size > 10 * 1024 * 1024) throw new Error('Max 10MB');
    const ext = file.name.split('.').pop();
    const path = `ads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('hero-ads').upload(path, file, { cacheControl: '3600', upsert: true });
    if (error) throw error;
    const {
      data: { publicUrl },
    } = supabase.storage.from('hero-ads').getPublicUrl(path);
    return publicUrl;
  };

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

  return {
    dialogOpen,
    setDialogOpen,
    previewOpen,
    setPreviewOpen,
    previewAd,
    setPreviewAd,
    editingId,
    form,
    setForm,
    ads,
    courses,
    isLoading,
    saveMutation,
    deleteMutation,
    toggleMutation,
    resetForm,
    openEdit,
    uploadAdImage,
  };
};
