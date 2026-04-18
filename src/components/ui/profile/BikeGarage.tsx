/**
 * BikeGarage — reusable multi-bike manager.
 * Decoupled from any specific profile/trainer model.
 * The parent owns persistence; this component just manages entries in memory
 * and calls `onChange` whenever the list changes.
 */
import React, { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { BikeEntry } from '@/hooks/useUserProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Bike, Plus, Trash2, Loader2,
  ChevronRight, ChevronLeft, X, ImagePlus,
  Gauge, Zap, Mountain, Flame, Wind,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CatalogModel   { id: string; brand: string; model_name: string; sort_order: number; subtype_id: string; }
interface CatalogSubtype { id: string; name_en: string; name_ar: string; sort_order: number; type_id: string; bike_models: CatalogModel[]; }
interface CatalogType    { id: string; name_en: string; name_ar: string; sort_order: number; bike_subtypes: CatalogSubtype[]; }
interface LightboxState  { photos: string[]; index: number; }

interface FlatModel {
  model_id: string; brand: string; model_name: string;
  subtype_id: string; subtype_name: string; subtype_name_ar: string;
  type_id: string; type_name: string; type_name_ar: string;
}

export interface BikeGarageProps {
  /** Current list of bike entries */
  entries: BikeEntry[];
  /** Called whenever entries change (add / delete / photo update) */
  onChange: (entries: BikeEntry[]) => void;
  /** Used as the storage path prefix for photo uploads. If omitted, photo upload is disabled. */
  userId?: string | null;
  /** Optional extra subfolder inside the user dir (default: "bikes") */
  storageFolder?: string;
  isUpdating?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_GRADIENTS: Record<string, string> = {
  Race: 'from-red-950/80 to-background', Touring: 'from-blue-950/80 to-background',
  Cruiser: 'from-amber-950/80 to-background', Adventure: 'from-green-950/80 to-background',
  Scrambler: 'from-stone-950/80 to-background', Naked: 'from-zinc-950/80 to-background',
};
const TYPE_CHIP_COLORS: Record<string, string> = {
  Race: 'bg-red-500/15 text-red-500', Touring: 'bg-blue-500/15 text-blue-500',
  Cruiser: 'bg-amber-500/15 text-amber-500', Adventure: 'bg-green-500/15 text-green-500',
  Scrambler: 'bg-stone-500/15 text-stone-400', Naked: 'bg-zinc-500/15 text-zinc-400',
};
const TYPE_EMOJI: Record<string, string> = {
  Race: '🏁', Touring: '🗺️', Cruiser: '🛣️', Adventure: '🏔️', Scrambler: '🪨', Naked: '⚡',
};
const LUCIDE_ICONS: Record<string, React.ElementType> = {
  Race: Zap, Touring: Wind, Cruiser: Gauge, Adventure: Mountain, Scrambler: Flame, Naked: Bike,
};

// ─── Component ────────────────────────────────────────────────────────────────

export const BikeGarage: React.FC<BikeGarageProps> = ({
  entries, onChange, userId, storageFolder = 'bikes', isUpdating = false,
}) => {
  const { isRTL } = useLanguage();
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const canUpload = Boolean(userId);

  // ── Catalog ───────────────────────────────────────────────────────────────
  const { data: catalogTypes = [] } = useQuery<CatalogType[]>({
    queryKey: ['bike-types'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('bike_types').select('*, bike_subtypes(*, bike_models(*))').order('sort_order');
      if (error) throw error;
      return (data ?? []) as CatalogType[];
    },
    staleTime: 10 * 60 * 1000,
  });

  // ── View state ────────────────────────────────────────────────────────────
  const [view, setView] = useState<'list' | 'add' | 'photos'>('list');
  const [photoBikeId, setPhotoBikeId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  // ── Per-card quick upload ─────────────────────────────────────────────────
  const cardFileRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const triggerCardUpload = (bikeId: string) => { setUploadingFor(bikeId); cardFileRef.current?.click(); };

  const uploadPhotos = async (bikeId: string, files: FileList): Promise<string[]> => {
    if (!userId) return [];
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const path = `${userId}/${storageFolder}/${bikeId}/${Date.now()}-${file.name}`;
      const { error } = await (supabase as any).storage.from('bike-photos').upload(path, file);
      if (error) { toast.error(isRTL ? 'فشل رفع الصورة' : 'Upload failed'); continue; }
      const { data: u } = (supabase as any).storage.from('bike-photos').getPublicUrl(path);
      if (u?.publicUrl) urls.push(u.publicUrl as string);
    }
    return urls;
  };

  const handleCardPhotoUpload = async (files: FileList | null) => {
    if (!files || !uploadingFor) return;
    const entry = entries.find((e) => e.id === uploadingFor);
    if (!entry || entry.photos.length + files.length > 5) {
      toast.error(isRTL ? 'الحد الأقصى 5 صور' : 'Maximum 5 photos'); return;
    }
    const newUrls = await uploadPhotos(uploadingFor, files);
    onChange(entries.map((e) => e.id === uploadingFor ? { ...e, photos: [...e.photos, ...newUrls] } : e));
    setUploadingFor(null);
    if (cardFileRef.current) cardFileRef.current.value = '';
  };

  // ── Add-bike page state ───────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState<string>('all');
  const [showManual, setShowManual] = useState(false);
  const [manualType, setManualType] = useState('');
  const [manualTypeName, setManualTypeName] = useState('');
  const [manualBrand, setManualBrand] = useState('');
  const [manualModel, setManualModel] = useState('');

  const openAddPage = () => {
    setSearch(''); setActiveType('all'); setShowManual(false);
    setManualType(''); setManualTypeName(''); setManualBrand(''); setManualModel('');
    setView('add');
  };

  // ── Photos page ───────────────────────────────────────────────────────────
  const photosFileRef = useRef<HTMLInputElement>(null);
  const [photosUploading, setPhotosUploading] = useState(false);
  const photoEntry = entries.find((e) => e.id === photoBikeId) ?? null;

  const openPhotosPage = (bikeId: string) => { setPhotoBikeId(bikeId); setView('photos'); };

  // ── Flat models for search ────────────────────────────────────────────────
  const flatModels: FlatModel[] = useMemo(() =>
    catalogTypes.flatMap((t) => t.bike_subtypes.flatMap((s) => s.bike_models.map((m) => ({
      model_id: m.id, brand: m.brand, model_name: m.model_name,
      subtype_id: s.id, subtype_name: s.name_en, subtype_name_ar: s.name_ar,
      type_id: t.id, type_name: t.name_en, type_name_ar: t.name_ar,
    })))), [catalogTypes]);

  const searchResults: FlatModel[] = useMemo(() =>
    flatModels.filter((m) => {
      const matchType = activeType === 'all' || m.type_id === activeType;
      const q = search.trim().toLowerCase();
      const matchSearch = !q || [m.brand, m.model_name, m.subtype_name, m.type_name].some((s) => s.toLowerCase().includes(q));
      return matchType && matchSearch;
    }), [flatModels, search, activeType]);

  // ── Quick add from catalog ────────────────────────────────────────────────
  const onQuickAdd = (item: FlatModel) => {
    const newEntry: BikeEntry = {
      id: crypto.randomUUID(), type_id: item.type_id, type_name: item.type_name,
      subtype_id: item.subtype_id, subtype_name: item.subtype_name,
      brand: item.brand, model: item.model_name,
      is_custom_type: false, is_custom_brand: false, photos: [],
    };
    onChange([...entries, newEntry]);
    setView('list');
    toast.success(isRTL ? 'تمت إضافة الدراجة' : 'Bike added');
  };

  // ── Manual add ────────────────────────────────────────────────────────────
  const onSaveManual = () => {
    if (!manualBrand.trim() || !manualModel.trim()) {
      toast.error(isRTL ? 'الرجاء إدخال الماركة والموديل' : 'Please enter brand and model'); return;
    }
    const resolved = manualType === 'custom' ? null : catalogTypes.find((t) => t.id === manualType) ?? null;
    const newEntry: BikeEntry = {
      id: crypto.randomUUID(), type_id: resolved?.id ?? null,
      type_name: resolved?.name_en ?? manualTypeName.trim(),
      subtype_id: null, subtype_name: '', brand: manualBrand.trim(), model: manualModel.trim(),
      is_custom_type: !resolved, is_custom_brand: true, photos: [],
    };
    onChange([...entries, newEntry]);
    setView('list');
    toast.success(isRTL ? 'تمت إضافة الدراجة' : 'Bike added');
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const deleteBike = (id: string) => onChange(entries.filter((e) => e.id !== id));

  // ── Photos page upload ────────────────────────────────────────────────────
  const handlePhotosUpload = async (files: FileList | null) => {
    if (!files || !photoBikeId || !photoEntry) return;
    if (photoEntry.photos.length + files.length > 5) {
      toast.error(isRTL ? 'الحد الأقصى 5 صور' : 'Maximum 5 photos'); return;
    }
    setPhotosUploading(true);
    const newUrls = await uploadPhotos(photoBikeId, files);
    onChange(entries.map((e) => e.id === photoBikeId ? { ...e, photos: [...e.photos, ...newUrls] } : e));
    setPhotosUploading(false);
  };

  const removePhoto = async (url: string) => {
    if (!photoBikeId || !photoEntry) return;
    const path = url.split('/bike-photos/')[1];
    if (path) await (supabase as any).storage.from('bike-photos').remove([path]);
    onChange(entries.map((e) => e.id === photoBikeId ? { ...e, photos: e.photos.filter((p) => p !== url) } : e));
  };

  // ── Localized names ───────────────────────────────────────────────────────
  const localizedTypeName = (entry: BikeEntry) => {
    if (entry.type_id) { const ct = catalogTypes.find((t) => t.id === entry.type_id); if (ct) return isRTL ? ct.name_ar : ct.name_en; }
    return entry.type_name;
  };
  const localizedSubtypeName = (entry: BikeEntry) => {
    if (entry.subtype_id) { for (const ct of catalogTypes) { const s = ct.bike_subtypes.find((s) => s.id === entry.subtype_id); if (s) return isRTL ? s.name_ar : s.name_en; } }
    return entry.subtype_name;
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ══════════════ LIST VIEW ══════════════ */}
      {view === 'list' && (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <Button size="sm" variant="outline" onClick={openAddPage} className="gap-1.5 text-xs h-8">
              <Plus className="w-3.5 h-3.5" />
              {isRTL ? 'إضافة' : 'Add Bike'}
            </Button>
          </div>

          {entries.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {entries.map((entry) => {
                const typeName = localizedTypeName(entry);
                const subName  = localizedSubtypeName(entry);
                const gradient = TYPE_GRADIENTS[entry.type_name] ?? 'from-primary/20 to-background';
                const chipCls  = TYPE_CHIP_COLORS[entry.type_name] ?? 'bg-primary/10 text-primary';
                const emoji    = TYPE_EMOJI[entry.type_name] ?? '🏍️';
                return (
                  <div key={entry.id} className="rounded-2xl border border-border/50 overflow-hidden bg-card shadow-sm hover:shadow-md transition-shadow flex flex-row sm:flex-col">
                    {/* Image */}
                    {entry.photos.length > 0 ? (
                      <div className="relative w-32 sm:w-auto shrink-0 sm:aspect-[6/4] overflow-hidden sm:rounded-t-2xl bg-muted">
                        <img src={entry.photos[0]} alt={entry.model} className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-500"
                          onClick={() => setLightbox({ photos: entry.photos, index: 0 })} />
                        {entry.photos.length > 1 && (
                          <div className="absolute bottom-1.5 end-1.5 sm:bottom-2 sm:end-2 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 sm:px-2 rounded-full backdrop-blur-sm">1 / {entry.photos.length}</div>
                        )}
                      </div>
                    ) : (
                      <div className={cn('w-32 sm:w-auto shrink-0 sm:aspect-[6/4] sm:rounded-t-2xl bg-gradient-to-b flex items-center justify-center', gradient)}>
                        <span className="text-4xl opacity-30 select-none">{emoji}</span>
                      </div>
                    )}

                    {/* Details + actions */}
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="p-3 space-y-1.5 flex-1">
                        {typeName && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', chipCls)}>{typeName}</span>
                            {subName && (
                              <>
                                <ChevronRight className="w-3 h-3 text-muted-foreground/50 shrink-0 rtl:rotate-180" />
                                <span className="text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full truncate">{subName}</span>
                              </>
                            )}
                          </div>
                        )}
                        <div>
                          {entry.brand && <p className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase truncate" dir="ltr">{entry.brand}</p>}
                          <p className="text-sm font-black text-foreground leading-tight truncate" dir="ltr">{entry.model || (isRTL ? 'دراجة غير معرّفة' : 'Unknown Bike')}</p>
                        </div>
                      </div>
                      <div className="px-3 pb-3 pt-2 flex items-center gap-1.5 border-t border-border/20">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
                          {entry.photos.slice(0, 4).map((photo, i) => (
                            <button key={i} onClick={() => setLightbox({ photos: entry.photos, index: i })}
                              className="w-7 h-7 rounded-md overflow-hidden border-2 border-border/40 hover:border-primary/50 hover:scale-110 transition-all shrink-0">
                              <img src={photo} className="w-full h-full object-cover" alt="" />
                            </button>
                          ))}
                          {entry.photos.length > 4 && (
                            <button onClick={() => setLightbox({ photos: entry.photos, index: 4 })}
                              className="w-7 h-7 rounded-md bg-muted/50 border-2 border-border/40 flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0 hover:border-primary/50">
                              +{entry.photos.length - 4}
                            </button>
                          )}
                          {canUpload && entry.photos.length < 5 && (
                            <button onClick={() => triggerCardUpload(entry.id)} disabled={uploadingFor === entry.id}
                              className="w-7 h-7 rounded-md border-2 border-dashed border-border/40 flex items-center justify-center hover:border-primary/50 hover:bg-primary/5 transition-all shrink-0 disabled:opacity-50">
                              {uploadingFor === entry.id ? <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" /> : <Plus className="w-3 h-3 text-muted-foreground" />}
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {canUpload && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-primary/10 hover:text-primary" onClick={() => openPhotosPage(entry.id)}>
                              <ImagePlus className="w-3 h-3" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteBike(entry.id)} disabled={isUpdating}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 gap-3 rounded-xl border border-dashed border-border/60">
              <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center">
                <Bike className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">{isRTL ? 'لم تضف أي دراجة بعد' : 'No bikes added yet'}</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">{isRTL ? 'أضف دراجتك للحصول على تجربة مخصصة' : 'Add a bike for a personalized experience'}</p>
              </div>
              <Button size="sm" onClick={openAddPage} className="gap-2">
                <Plus className="w-4 h-4" />
                {isRTL ? 'إضافة دراجة' : 'Add Bike'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ ADD BIKE PAGE ══════════════ */}
      {view === 'add' && (
        <div className="rounded-xl border border-border/40 overflow-hidden">
          <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border/40 bg-muted/20">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setView('list')}>
              <BackIcon className="w-4 h-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">{isRTL ? 'اختر دراجتك' : 'Choose Your Bike'}</h3>
              <p className="text-xs text-muted-foreground">{isRTL ? 'ابحث في الكتالوج أو أضف يدوياً' : 'Search the catalog or add manually'}</p>
            </div>
          </div>
          <div className="p-4 space-y-3 max-h-[480px] overflow-y-auto">
            {/* Search */}
            <div className="relative">
              <Bike className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={isRTL ? 'ابحث: BMW R18...' : 'Search: BMW R18...'}
                className="ps-10 h-10 rounded-xl" autoFocus />
              {search && (
                <button className="absolute end-3 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
            {/* Type filter chips */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[{ id: 'all', label_ar: 'الكل', label_en: 'All' }, ...catalogTypes.map((t) => ({ id: t.id, label_ar: t.name_ar, label_en: t.name_en }))]
                .map((f) => (
                  <button key={f.id} onClick={() => setActiveType(f.id)}
                    className={cn('flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 border transition-all',
                      activeType === f.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/30 text-muted-foreground border-border/40 hover:border-primary/40')}>
                    <Bike className="w-3 h-3" />
                    {isRTL ? f.label_ar : f.label_en}
                  </button>
                ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border/40" />
              <span className="text-[10px] text-muted-foreground shrink-0">{isRTL ? 'النتائج' : 'Results'} ({searchResults.length})</span>
              <div className="flex-1 h-px bg-border/40" />
            </div>
            {/* Results */}
            {searchResults.length > 0 ? (
              <div className="space-y-1.5">
                {searchResults.map((item) => (
                  <div key={item.model_id}
                    className="flex items-center gap-3 p-2.5 rounded-xl border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all group">
                    <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                      <Bike className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground" dir="ltr">{item.brand} {item.model_name}</p>
                      <p className="text-xs text-muted-foreground">{isRTL ? item.type_name_ar : item.type_name} · {isRTL ? item.subtype_name_ar : item.subtype_name}</p>
                    </div>
                    <button onClick={() => onQuickAdd(item)}
                      className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 hover:bg-primary hover:text-primary-foreground transition-all">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-sm text-muted-foreground">
                {search ? (isRTL ? `لا نتائج لـ "${search}"` : `No results for "${search}"`) : (isRTL ? 'لا توجد دراجات' : 'No bikes found')}
              </div>
            )}
            {/* Manual entry */}
            {!showManual ? (
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 h-px bg-border/40" />
                <Button variant="outline" size="sm" className="gap-1.5 shrink-0 rounded-full text-xs" onClick={() => setShowManual(true)}>
                  <Plus className="w-3 h-3" />
                  {isRTL ? 'إضافة يدوية' : 'Add manually'}
                </Button>
                <div className="flex-1 h-px bg-border/40" />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-primary">{isRTL ? 'إضافة دراجة غير موجودة' : 'Add unlisted bike'}</p>
                  <button onClick={() => setShowManual(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[...catalogTypes.map((t) => ({ id: t.id, nameAr: t.name_ar, nameEn: t.name_en })),
                    { id: 'custom', nameAr: 'أخرى', nameEn: 'Other' }].map((t) => (
                    <button key={t.id} onClick={() => setManualType(t.id)}
                      className={cn('flex flex-col items-center gap-1 p-2 rounded-xl border-2 text-xs font-semibold transition-all',
                        manualType === t.id ? 'border-primary bg-primary/10 text-primary' : 'border-border/30 bg-muted/20 text-muted-foreground hover:border-primary/40')}>
                      <Bike className="w-4 h-4" />
                      {isRTL ? t.nameAr : t.nameEn}
                    </button>
                  ))}
                </div>
                {manualType === 'custom' && (
                  <Input value={manualTypeName} onChange={(e) => setManualTypeName(e.target.value)}
                    placeholder={isRTL ? 'اسم النوع...' : 'Type name...'} className="h-9 rounded-xl" />
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Input value={manualBrand} onChange={(e) => setManualBrand(e.target.value)}
                    placeholder={isRTL ? 'الماركة...' : 'Brand...'} className="h-9 rounded-xl" dir="ltr" />
                  <Input value={manualModel} onChange={(e) => setManualModel(e.target.value)}
                    placeholder={isRTL ? 'الموديل...' : 'Model...'} className="h-9 rounded-xl" dir="ltr" />
                </div>
                <Button className="w-full gap-2 h-9" onClick={onSaveManual}
                  disabled={!manualBrand.trim() || !manualModel.trim() || !manualType}>
                  <Plus className="w-4 h-4" />
                  {isRTL ? 'إضافة الدراجة' : 'Add Bike'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ PHOTOS PAGE ══════════════ */}
      {view === 'photos' && photoEntry && (
        <div className="rounded-xl border border-border/40 overflow-hidden">
          <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border/40 bg-muted/20">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setView('list')}>
              <BackIcon className="w-4 h-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate" dir="ltr">{photoEntry.brand} {photoEntry.model}</h3>
              <p className="text-xs text-muted-foreground">{photoEntry.photos.length}/5 {isRTL ? 'صور' : 'photos'}</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {photoEntry.photos.map((url, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-border/40 group">
                  <img src={url} alt="" className="w-full h-full object-cover cursor-pointer" onClick={() => setLightbox({ photos: photoEntry.photos, index: i })} />
                  <button onClick={() => removePhoto(url)}
                    className="absolute top-1.5 end-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
              {photoEntry.photos.length < 5 && (
                <button onClick={() => photosFileRef.current?.click()} disabled={photosUploading}
                  className="aspect-square rounded-xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50">
                  {photosUploading ? <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" /> : <ImagePlus className="w-5 h-5 text-muted-foreground" />}
                  <span className="text-[10px] text-muted-foreground">{isRTL ? 'إضافة صورة' : 'Add photo'}</span>
                </button>
              )}
            </div>
            <input ref={photosFileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handlePhotosUpload(e.target.files)} />
            <Button variant="outline" className="w-full h-9" onClick={() => setView('list')}>{isRTL ? 'تم' : 'Done'}</Button>
          </div>
        </div>
      )}

      {/* Hidden input for per-card quick upload */}
      <input ref={cardFileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleCardPhotoUpload(e.target.files)} />

      {/* ── Lightbox ─────────────────────────────────────────────────────── */}
      {lightbox && (
        <Dialog open onOpenChange={() => setLightbox(null)}>
          <DialogContent className="max-w-3xl p-0 bg-black/95 border-0 overflow-hidden gap-0">
            <div className="relative">
              <img src={lightbox.photos[lightbox.index]} className="w-full max-h-[75vh] object-contain" alt="" />
              <button className="absolute top-3 end-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 z-10" onClick={() => setLightbox(null)}>
                <X className="w-4 h-4 text-white" />
              </button>
              {lightbox.photos.length > 1 && (
                <>
                  <button className="absolute start-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 disabled:opacity-30"
                    disabled={lightbox.index === 0} onClick={() => setLightbox((p) => p && ({ ...p, index: p.index - 1 }))}>
                    <ChevronLeft className="w-5 h-5 text-white" />
                  </button>
                  <button className="absolute end-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 disabled:opacity-30"
                    disabled={lightbox.index === lightbox.photos.length - 1} onClick={() => setLightbox((p) => p && ({ ...p, index: p.index + 1 }))}>
                    <ChevronRight className="w-5 h-5 text-white" />
                  </button>
                </>
              )}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
                {lightbox.index + 1} / {lightbox.photos.length}
              </div>
            </div>
            {lightbox.photos.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto bg-black/80">
                {lightbox.photos.map((photo, i) => (
                  <button key={i} onClick={() => setLightbox((p) => p && ({ ...p, index: i }))}
                    className={cn('w-14 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-all',
                      i === lightbox.index ? 'border-primary scale-105' : 'border-transparent opacity-60 hover:opacity-100')}>
                    <img src={photo} className="w-full h-full object-cover" alt="" />
                  </button>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
