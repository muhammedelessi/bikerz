import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Bike, Plus, Pencil, Trash2, Eye, ChevronDown, ChevronRight,
  Users as UsersIcon, UserCheck, Loader2, AlertTriangle,
  ArrowLeft, ArrowRight, Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================
interface BikeModel {
  id: string;
  subtype_id: string;
  brand: string;
  model_name: string;
  sort_order: number;
}

interface BikeSubtype {
  id: string;
  type_id: string;
  name_en: string;
  name_ar: string;
  sort_order: number;
  models: BikeModel[];
}

interface BikeType {
  id: string;
  name_en: string;
  name_ar: string;
  sort_order: number;
  subtypes: BikeSubtype[];
}

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  bike_brand: string | null;
  bike_model: string | null;
  created_at: string | null;
}

interface TrainerRow {
  id: string;
  name_ar: string | null;
  name_en: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  bike_type: string | null;
  bike_entries?: unknown;
}

function parseTrainerBikeTypes(entries: unknown): string[] {
  if (!Array.isArray(entries)) return [];
  const types = entries
    .map((e: any) => (e && typeof e === 'object' ? (e.type_name as string | undefined) : undefined))
    .filter((s): s is string => Boolean(s && s.trim()));
  return Array.from(new Set(types));
}

type Tbl = 'bike_types' | 'bike_subtypes' | 'bike_models';

// ============================================================
// Helpers
// ============================================================


function normalize(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

function profileMatchesType(profile: ProfileRow, type: BikeType): boolean {
  const brand = normalize(profile.bike_brand);
  const model = normalize(profile.bike_model);
  if (!brand && !model) return false;

  const typeNameEn = normalize(type.name_en);
  const typeNameAr = normalize(type.name_ar);

  // Quick match: profile.bike_brand is exactly the type (some users pick by type).
  if (brand === typeNameEn || brand === typeNameAr) return true;

  for (const sub of type.subtypes) {
    const subEn = normalize(sub.name_en);
    const subAr = normalize(sub.name_ar);
    if (brand === subEn || brand === subAr) return true;

    for (const m of sub.models) {
      const mBrand = normalize(m.brand);
      const mModel = normalize(m.model_name);
      if (mBrand && brand === mBrand && (!model || model === mModel)) return true;
      if (mModel && model === mModel) return true;
      // free text in bike_brand can contain both brand + model
      if (mBrand && mModel && brand.includes(mBrand) && brand.includes(mModel)) return true;
    }
  }
  return false;
}

function trainerMatchesType(trainer: TrainerRow, type: BikeType): boolean {
  const typeEn = normalize(type.name_en);
  const typeAr = normalize(type.name_ar);
  return normalize(trainer.bike_type) === typeEn || normalize(trainer.bike_type) === typeAr;
}

function profileHasAnyBike(p: ProfileRow): boolean {
  return Boolean((p.bike_brand && p.bike_brand.trim()) || (p.bike_model && p.bike_model.trim()));
}

function trainerHasAnyBike(t: TrainerRow): boolean {
  return Boolean(t.bike_type && t.bike_type.trim());
}

// ============================================================
// Page
// ============================================================

const AdminBikeCatalog: React.FC = () => {
  const { isRTL } = useLanguage();

  // Data
  const [types, setTypes] = useState<BikeType[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [trainers, setTrainers] = useState<TrainerRow[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [expandedTypeId, setExpandedTypeId] = useState<string | null>(null);

  // Type dialog
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<BikeType | null>(null);
  const [typeForm, setTypeForm] = useState({ name_en: '', name_ar: '', sort_order: 0 });

  // Subtype dialog
  const [subtypeDialogOpen, setSubtypeDialogOpen] = useState(false);
  const [editingSubtype, setEditingSubtype] = useState<BikeSubtype | null>(null);
  const [subtypeParentTypeId, setSubtypeParentTypeId] = useState<string>('');
  const [subtypeForm, setSubtypeForm] = useState({ name_en: '', name_ar: '', sort_order: 0 });

  // Model dialog
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<BikeModel | null>(null);
  const [modelParentSubtypeId, setModelParentSubtypeId] = useState<string>('');
  const [modelForm, setModelForm] = useState({ brand: '', model_name: '', sort_order: 0 });

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: 'type'; id: string; label: string; usageCount: number }
    | { kind: 'subtype'; id: string; label: string }
    | { kind: 'model'; id: string; label: string }
    | null
  >(null);

  // View: 'list' = main table | 'detail' = students/trainers child page
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [detailTypeId, setDetailTypeId] = useState<string | null>(null);
  const [detailIsManual, setDetailIsManual] = useState(false);
  const [detailSearch, setDetailSearch] = useState('');

  // ---------- Data loading ----------
  const loadAll = async () => {
    setLoading(true);
    try {
      const [typesRes, subtypesRes, modelsRes, profilesRes, trainersRes] = await Promise.all([
        (supabase as unknown as { from: (t: Tbl) => { select: (c: string) => Promise<{ data: unknown; error: unknown }> } })
          .from('bike_types').select('*'),
        (supabase as unknown as { from: (t: Tbl) => { select: (c: string) => Promise<{ data: unknown; error: unknown }> } })
          .from('bike_subtypes').select('*'),
        (supabase as unknown as { from: (t: Tbl) => { select: (c: string) => Promise<{ data: unknown; error: unknown }> } })
          .from('bike_models').select('*'),
        supabase.from('profiles').select('user_id, full_name, phone, bike_brand, bike_model, created_at'),
        supabase.from('trainers').select('id, name_ar, name_en, phone, city, country, bike_type'),
      ]);

      const rawTypes   = (typesRes.data   as Array<Omit<BikeType, 'subtypes'>> | null) ?? [];
      const rawSubs    = (subtypesRes.data as Array<Omit<BikeSubtype, 'models'>> | null) ?? [];
      const rawModels  = (modelsRes.data   as BikeModel[] | null) ?? [];
      const rawProfiles = (profilesRes.data as ProfileRow[] | null) ?? [];
      const rawTrainers = (trainersRes.data as TrainerRow[] | null) ?? [];

      const subsByType = new Map<string, BikeSubtype[]>();
      for (const s of rawSubs) {
        const arr = subsByType.get(s.type_id) ?? [];
        arr.push({ ...s, models: [] });
        subsByType.set(s.type_id, arr);
      }

      const modelsBySub = new Map<string, BikeModel[]>();
      for (const m of rawModels) {
        const arr = modelsBySub.get(m.subtype_id) ?? [];
        arr.push(m);
        modelsBySub.set(m.subtype_id, arr);
      }

      const builtTypes: BikeType[] = rawTypes
        .map((t) => {
          const subs = (subsByType.get(t.id) ?? []).sort((a, b) => a.sort_order - b.sort_order);
          subs.forEach((s) => { s.models = (modelsBySub.get(s.id) ?? []).sort((a, b) => a.sort_order - b.sort_order); });
          return { ...t, subtypes: subs };
        })
        .sort((a, b) => a.sort_order - b.sort_order);

      setTypes(builtTypes);
      setProfiles(rawProfiles);
      setTrainers(rawTrainers);
    } catch (err) {
      console.error('Failed to load bike catalog', err);
      toast.error(isRTL ? 'فشل تحميل كتالوج الدراجات' : 'Failed to load bike catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Derived stats ----------
  const studentsByType = useMemo(() => {
    const map = new Map<string, ProfileRow[]>();
    types.forEach((t) => map.set(t.id, []));
    for (const p of profiles) {
      if (!profileHasAnyBike(p)) continue;
      for (const t of types) {
        if (profileMatchesType(p, t)) {
          map.get(t.id)!.push(p);
          break; // first match wins (types mutually exclusive at this level)
        }
      }
    }
    return map;
  }, [profiles, types]);

  const trainersByType = useMemo(() => {
    const map = new Map<string, TrainerRow[]>();
    types.forEach((t) => map.set(t.id, []));
    for (const tr of trainers) {
      if (!trainerHasAnyBike(tr)) continue;
      for (const t of types) {
        if (trainerMatchesType(tr, t)) {
          map.get(t.id)!.push(tr);
        }
      }
    }
    return map;
  }, [trainers, types]);

  const manualProfiles = useMemo(() => {
    return profiles.filter((p) => {
      if (!profileHasAnyBike(p)) return false;
      return !types.some((t) => profileMatchesType(p, t));
    });
  }, [profiles, types]);

  const manualTrainers = useMemo(() => {
    return trainers.filter((tr) => {
      if (!trainerHasAnyBike(tr)) return false;
      return !types.some((t) => trainerMatchesType(tr, t));
    });
  }, [trainers, types]);

  // ---------- CRUD: Types ----------
  const openNewType = () => {
    setEditingType(null);
    setTypeForm({ name_en: '', name_ar: '', sort_order: types.length + 1 });
    setTypeDialogOpen(true);
  };
  const openEditType = (t: BikeType) => {
    setEditingType(t);
    setTypeForm({ name_en: t.name_en, name_ar: t.name_ar, sort_order: t.sort_order });
    setTypeDialogOpen(true);
  };
  const submitType = async () => {
    if (!typeForm.name_en.trim() || !typeForm.name_ar.trim()) {
      toast.error(isRTL ? 'الرجاء تعبئة جميع الحقول' : 'Please fill all required fields');
      return;
    }
    const payload = {
      name_en: typeForm.name_en.trim(),
      name_ar: typeForm.name_ar.trim(),
      sort_order: Number(typeForm.sort_order) || 0,
    };
    const tbl = (supabase as unknown as {
      from: (t: Tbl) => {
        insert: (p: unknown) => Promise<{ error: unknown }>;
        update: (p: unknown) => { eq: (c: string, v: unknown) => Promise<{ error: unknown }> };
      };
    }).from('bike_types');

    const { error } = editingType
      ? await tbl.update(payload).eq('id', editingType.id)
      : await tbl.insert(payload);

    if (error) {
      console.error(error);
      toast.error(isRTL ? 'فشل الحفظ' : 'Save failed');
      return;
    }
    toast.success(isRTL ? 'تم الحفظ' : 'Saved');
    setTypeDialogOpen(false);
    await loadAll();
  };

  // ---------- CRUD: Subtypes ----------
  const openNewSubtype = (typeId: string) => {
    setEditingSubtype(null);
    setSubtypeParentTypeId(typeId);
    setSubtypeForm({ name_en: '', name_ar: '', sort_order: 1 });
    setSubtypeDialogOpen(true);
  };
  const openEditSubtype = (s: BikeSubtype) => {
    setEditingSubtype(s);
    setSubtypeParentTypeId(s.type_id);
    setSubtypeForm({ name_en: s.name_en, name_ar: s.name_ar, sort_order: s.sort_order });
    setSubtypeDialogOpen(true);
  };
  const submitSubtype = async () => {
    if (!subtypeForm.name_en.trim() || !subtypeForm.name_ar.trim() || !subtypeParentTypeId) {
      toast.error(isRTL ? 'الرجاء تعبئة جميع الحقول' : 'Please fill all required fields');
      return;
    }
    const payload = {
      type_id: subtypeParentTypeId,
      name_en: subtypeForm.name_en.trim(),
      name_ar: subtypeForm.name_ar.trim(),
      sort_order: Number(subtypeForm.sort_order) || 0,
    };
    const tbl = (supabase as unknown as {
      from: (t: Tbl) => {
        insert: (p: unknown) => Promise<{ error: unknown }>;
        update: (p: unknown) => { eq: (c: string, v: unknown) => Promise<{ error: unknown }> };
      };
    }).from('bike_subtypes');

    const { error } = editingSubtype
      ? await tbl.update(payload).eq('id', editingSubtype.id)
      : await tbl.insert(payload);

    if (error) {
      console.error(error);
      toast.error(isRTL ? 'فشل الحفظ' : 'Save failed');
      return;
    }
    toast.success(isRTL ? 'تم الحفظ' : 'Saved');
    setSubtypeDialogOpen(false);
    await loadAll();
  };

  // ---------- CRUD: Models ----------
  const openNewModel = (subtypeId: string) => {
    setEditingModel(null);
    setModelParentSubtypeId(subtypeId);
    setModelForm({ brand: '', model_name: '', sort_order: 1 });
    setModelDialogOpen(true);
  };
  const openEditModel = (m: BikeModel) => {
    setEditingModel(m);
    setModelParentSubtypeId(m.subtype_id);
    setModelForm({ brand: m.brand, model_name: m.model_name, sort_order: m.sort_order });
    setModelDialogOpen(true);
  };
  const submitModel = async () => {
    if (!modelForm.brand.trim() || !modelForm.model_name.trim() || !modelParentSubtypeId) {
      toast.error(isRTL ? 'الرجاء تعبئة جميع الحقول' : 'Please fill all required fields');
      return;
    }
    const payload = {
      subtype_id: modelParentSubtypeId,
      brand: modelForm.brand.trim(),
      model_name: modelForm.model_name.trim(),
      sort_order: Number(modelForm.sort_order) || 0,
    };
    const tbl = (supabase as unknown as {
      from: (t: Tbl) => {
        insert: (p: unknown) => Promise<{ error: unknown }>;
        update: (p: unknown) => { eq: (c: string, v: unknown) => Promise<{ error: unknown }> };
      };
    }).from('bike_models');

    const { error } = editingModel
      ? await tbl.update(payload).eq('id', editingModel.id)
      : await tbl.insert(payload);

    if (error) {
      console.error(error);
      toast.error(isRTL ? 'فشل الحفظ' : 'Save failed');
      return;
    }
    toast.success(isRTL ? 'تم الحفظ' : 'Saved');
    setModelDialogOpen(false);
    await loadAll();
  };

  // ---------- DELETE ----------
  const confirmDelete = (
    target:
      | { kind: 'type'; id: string; label: string; usageCount: number }
      | { kind: 'subtype'; id: string; label: string }
      | { kind: 'model'; id: string; label: string },
  ) => setDeleteTarget(target);

  const executeDelete = async () => {
    if (!deleteTarget) return;
    const tableName: Tbl =
      deleteTarget.kind === 'type' ? 'bike_types'
      : deleteTarget.kind === 'subtype' ? 'bike_subtypes'
      : 'bike_models';

    const { error } = await (supabase as any).from(tableName).delete().eq('id', deleteTarget.id);
    if (error) {
      console.error(error);
      toast.error(isRTL ? 'فشل الحذف' : 'Delete failed');
      return;
    }

    // Optimistic state update — remove from local state immediately
    if (deleteTarget.kind === 'type') {
      setTypes((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    } else if (deleteTarget.kind === 'subtype') {
      setTypes((prev) => prev.map((t) => ({
        ...t,
        subtypes: t.subtypes.filter((s) => s.id !== deleteTarget.id),
      })));
    } else {
      setTypes((prev) => prev.map((t) => ({
        ...t,
        subtypes: t.subtypes.map((s) => ({
          ...s,
          models: s.models.filter((m) => m.id !== deleteTarget.id),
        })),
      })));
    }

    toast.success(isRTL ? 'تم الحذف' : 'Deleted');
    setDeleteTarget(null);
  };

  // ---------- Detail child page ----------
  const openDetail = (typeId: string | null, manual = false) => {
    setDetailTypeId(typeId);
    setDetailIsManual(manual);
    setDetailSearch('');
    setView('detail');
  };

  // ============================================================
  // Render
  // ============================================================
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <AdminLayout>
      <div dir={isRTL ? 'rtl' : 'ltr'}>

        {/* ══════════════════ LIST VIEW ══════════════════ */}
        {view === 'list' && (
        <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bike className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {isRTL ? 'كتالوج الدراجات' : 'Bike Catalog'}
              </h1>
              <p className="text-xs text-muted-foreground">
                {isRTL ? 'إدارة أنواع الدراجات والأنواع الفرعية والموديلات' : 'Manage bike types, subtypes, and models'}
              </p>
            </div>
          </div>
          <Button onClick={openNewType} className="gap-2">
            <Plus className="w-4 h-4" />
            {isRTL ? 'إضافة نوع جديد' : 'Add New Type'}
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {isRTL ? 'جارٍ التحميل...' : 'Loading...'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>{isRTL ? 'النوع' : 'Type'}</TableHead>
                    <TableHead className="text-center">{isRTL ? 'الأنواع الفرعية' : 'Subtypes'}</TableHead>
                    <TableHead className="text-center">{isRTL ? 'الموديلات' : 'Models'}</TableHead>
                    <TableHead className="text-center">{isRTL ? 'الطلاب' : 'Students'}</TableHead>
                    <TableHead className="text-center">{isRTL ? 'المدربون' : 'Trainers'}</TableHead>
                    <TableHead className="text-end">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {types.map((type) => {
                    const isOpen = expandedTypeId === type.id;
                    const modelCount = type.subtypes.reduce((acc, s) => acc + s.models.length, 0);
                    const studentCount = studentsByType.get(type.id)?.length ?? 0;
                    const trainerCount = trainersByType.get(type.id)?.length ?? 0;
                    const label = isRTL ? type.name_ar : type.name_en;

                    return (
                      <React.Fragment key={type.id}>
                        <TableRow className="group">
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setExpandedTypeId(isOpen ? null : type.id)}
                              aria-label="expand"
                            >
                              {isOpen
                                ? <ChevronDown className="w-4 h-4" />
                                : <ChevronRight className={cn('w-4 h-4', isRTL && 'rotate-180')} />}
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{label}</span>
                              <span className="text-[10px] text-muted-foreground" dir="ltr">
                                {type.name_en}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="tabular-nums">{type.subtypes.length}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="tabular-nums">{modelCount}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => openDetail(type.id)}
                            >
                              <span className="tabular-nums font-medium">{studentCount}</span>
                              <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => openDetail(type.id)}
                            >
                              <span className="tabular-nums font-medium">{trainerCount}</span>
                              <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          </TableCell>
                          <TableCell className="text-end">
                            <div className="inline-flex items-center gap-1">
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditType(type)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => confirmDelete({
                                  kind: 'type', id: type.id, label,
                                  usageCount: studentCount + trainerCount,
                                })}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expanded: subtypes + models */}
                        {isOpen && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell />
                            <TableCell colSpan={6} className="py-3">
                              <div className="space-y-2">
                                {type.subtypes.length === 0 && (
                                  <p className="text-xs text-muted-foreground italic">
                                    {isRTL ? 'لا توجد أنواع فرعية' : 'No subtypes yet'}
                                  </p>
                                )}
                                {type.subtypes.map((sub) => (
                                  <div
                                    key={sub.id}
                                    className="rounded-lg border border-border/60 bg-card/80 overflow-hidden"
                                  >
                                    {/* subtype header */}
                                    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/40">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-medium text-sm">
                                          {isRTL ? sub.name_ar : sub.name_en}
                                        </span>
                                        <Badge variant="outline" className="text-[10px]">
                                          {sub.models.length} {isRTL ? 'موديل' : 'models'}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => openNewModel(sub.id)}>
                                          <Plus className="w-3 h-3" />
                                          {isRTL ? 'موديل' : 'Model'}
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditSubtype(sub)}>
                                          <Pencil className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          size="icon" variant="ghost"
                                          className="h-7 w-7 text-destructive hover:text-destructive"
                                          onClick={() => confirmDelete({
                                            kind: 'subtype', id: sub.id,
                                            label: isRTL ? sub.name_ar : sub.name_en,
                                          })}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </div>
                                    {/* models list */}
                                    {sub.models.length > 0 && (
                                      <div className="divide-y divide-border/40">
                                        {sub.models.map((m) => (
                                          <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                                            <div className="min-w-0 flex items-center gap-2">
                                              <span className="text-muted-foreground">•</span>
                                              <span className="truncate">
                                                {m.brand && m.brand !== '—' ? `${m.brand} ${m.model_name}` : m.model_name}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEditModel(m)}>
                                                <Pencil className="w-3 h-3" />
                                              </Button>
                                              <Button
                                                size="icon" variant="ghost"
                                                className="h-6 w-6 text-destructive hover:text-destructive"
                                                onClick={() => confirmDelete({
                                                  kind: 'model', id: m.id,
                                                  label: m.brand && m.brand !== '—' ? `${m.brand} ${m.model_name}` : m.model_name,
                                                })}
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                                <Button size="sm" variant="outline" className="gap-1" onClick={() => openNewSubtype(type.id)}>
                                  <Plus className="w-3.5 h-3.5" />
                                  {isRTL ? 'إضافة نوع فرعي' : 'Add Subtype'}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* Manual row */}
                  <TableRow className="bg-yellow-500/5 hover:bg-yellow-500/10">
                    <TableCell />
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        <div className="flex flex-col">
                          <span>{isRTL ? 'يدوي / غير مصنف' : 'Manual / Uncategorized'}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {isRTL ? 'دراجات لا تطابق الكتالوج' : 'Bikes not in catalog'}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">—</TableCell>
                    <TableCell className="text-center text-muted-foreground">—</TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openDetail(null, true)}>
                        <span className="tabular-nums font-medium">{manualProfiles.length}</span>
                        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openDetail(null, true)}>
                        <span className="tabular-nums font-medium">{manualTrainers.length}</span>
                        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        </div>
        )} {/* end list view */}

        {/* ══════════════════ DETAIL CHILD PAGE ══════════════════ */}
        {view === 'detail' && (() => {
          const detailType = types.find((t) => t.id === detailTypeId) ?? null;
          const allStudents = detailIsManual ? manualProfiles : (detailTypeId ? studentsByType.get(detailTypeId) ?? [] : []);
          const allTrainers = detailIsManual ? manualTrainers : (detailTypeId ? trainersByType.get(detailTypeId) ?? [] : []);
          const q = detailSearch.trim().toLowerCase();
          const filteredStudents = q
            ? allStudents.filter((s) => s.full_name?.toLowerCase().includes(q) || s.phone?.toLowerCase().includes(q) || s.bike_brand?.toLowerCase().includes(q))
            : allStudents;
          const filteredTrainers = q
            ? allTrainers.filter((tr) => (tr.name_ar || tr.name_en || '').toLowerCase().includes(q) || tr.phone?.toLowerCase().includes(q))
            : allTrainers;

          return (
            <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>

              {/* ── Header ── */}
              <div className="flex flex-col gap-4">

                {/* Row 1: back button + title */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setView('list')}
                    className="gap-2 shrink-0"
                  >
                    <BackIcon className="w-4 h-4" />
                    {isRTL ? 'رجوع' : 'Back'}
                  </Button>

                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      {detailIsManual
                        ? <AlertTriangle className="w-5 h-5 text-yellow-500" />
                        : <Bike className="w-5 h-5 text-primary" />}
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-xl font-bold text-foreground truncate">
                        {detailIsManual
                          ? (isRTL ? 'دراجات غير مصنفة' : 'Uncategorized Bikes')
                          : (detailType ? (isRTL ? detailType.name_ar : detailType.name_en) : '')}
                      </h1>
                      <p className="text-xs text-muted-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
                        {isRTL
                          ? `${allStudents.length} طالب · ${allTrainers.length} مدرب`
                          : `${allStudents.length} students · ${allTrainers.length} trainers`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Row 2: search bar (full width on its own row) */}
                <div className="relative w-full sm:max-w-sm">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder={isRTL ? 'بحث بالاسم أو الهاتف أو الدراجة...' : 'Search by name, phone or bike...'}
                    value={detailSearch}
                    onChange={(e) => setDetailSearch(e.target.value)}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    className="w-full h-9 ps-9 pe-3 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              {/* ── Tabs ── */}
              <Tabs defaultValue="students" dir={isRTL ? 'rtl' : 'ltr'}>
                <TabsList className="grid grid-cols-2 w-full sm:max-w-xs">
                  <TabsTrigger value="students" className="gap-2">
                    <UsersIcon className="w-4 h-4" />
                    {isRTL ? 'الطلاب' : 'Students'} ({allStudents.length})
                  </TabsTrigger>
                  <TabsTrigger value="trainers" className="gap-2">
                    <UserCheck className="w-4 h-4" />
                    {isRTL ? 'المدربون' : 'Trainers'} ({allTrainers.length})
                  </TabsTrigger>
                </TabsList>

                {/* Students Tab */}
                <TabsContent value="students" className="mt-4">
                  <Card>
                    <CardContent className="p-0">
                      {filteredStudents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                          <UsersIcon className="w-10 h-10 opacity-30" />
                          <p className="text-sm">{isRTL ? 'لا يوجد طلاب' : 'No students found'}</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-start">{isRTL ? 'الاسم' : 'Name'}</TableHead>
                              <TableHead className="text-start">{isRTL ? 'الهاتف' : 'Phone'}</TableHead>
                              <TableHead className="text-start">{isRTL ? 'العلامة التجارية' : 'Brand'}</TableHead>
                              <TableHead className="text-start">{isRTL ? 'الموديل' : 'Model'}</TableHead>
                              {detailIsManual && <TableHead className="text-start">{isRTL ? 'القيمة المدخلة' : 'Entered Value'}</TableHead>}
                              <TableHead className="text-start">{isRTL ? 'تاريخ التسجيل' : 'Registered'}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredStudents.map((s) => (
                              <TableRow key={s.user_id}>
                                <TableCell className="font-medium">{s.full_name || '—'}</TableCell>
                                <TableCell><span dir="ltr">{s.phone || '—'}</span></TableCell>
                                <TableCell>{s.bike_brand || '—'}</TableCell>
                                <TableCell>{s.bike_model || '—'}</TableCell>
                                {detailIsManual && (
                                  <TableCell className="text-xs text-muted-foreground">
                                    {[s.bike_brand, s.bike_model].filter(Boolean).join(' / ') || '—'}
                                  </TableCell>
                                )}
                                <TableCell className="text-xs tabular-nums">
                                  <span dir="ltr">{s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}</span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Trainers Tab */}
                <TabsContent value="trainers" className="mt-4">
                  <Card>
                    <CardContent className="p-0">
                      {filteredTrainers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                          <UserCheck className="w-10 h-10 opacity-30" />
                          <p className="text-sm">{isRTL ? 'لا يوجد مدربون' : 'No trainers found'}</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-start">{isRTL ? 'الاسم' : 'Name'}</TableHead>
                              <TableHead className="text-start">{isRTL ? 'الهاتف' : 'Phone'}</TableHead>
                              <TableHead className="text-start">{isRTL ? 'نوع الدراجة' : 'Bike Type'}</TableHead>
                              {detailIsManual && <TableHead className="text-start">{isRTL ? 'القيمة المدخلة' : 'Entered Value'}</TableHead>}
                              <TableHead className="text-start">{isRTL ? 'المدينة' : 'City'}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredTrainers.map((tr) => (
                              <TableRow key={tr.id}>
                                <TableCell className="font-medium">
                                  {isRTL ? (tr.name_ar || tr.name_en) : (tr.name_en || tr.name_ar) || '—'}
                                </TableCell>
                                <TableCell><span dir="ltr">{tr.phone || '—'}</span></TableCell>
                                <TableCell>{tr.bike_type || parseTrainerBikeTypes(tr.bike_entries).join(', ') || '—'}</TableCell>
                                {detailIsManual && (
                                  <TableCell className="text-xs text-muted-foreground">
                                    {tr.bike_type || parseTrainerBikeTypes(tr.bike_entries).join(', ') || '—'}
                                  </TableCell>
                                )}
                                <TableCell>{tr.city || tr.country || '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          );
        })()}

      </div>

      {/* ============================================================
         Type Dialog
         ============================================================ */}
      <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>
              {editingType
                ? (isRTL ? 'تعديل نوع' : 'Edit Type')
                : (isRTL ? 'إضافة نوع دراجة جديد' : 'Add New Bike Type')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{isRTL ? 'الاسم (عربي)' : 'Name (Arabic)'}</Label>
              <Input
                value={typeForm.name_ar}
                onChange={(e) => setTypeForm((p) => ({ ...p, name_ar: e.target.value }))}
                dir="rtl"
              />
            </div>
            <div>
              <Label>{isRTL ? 'الاسم (إنجليزي)' : 'Name (English)'}</Label>
              <Input
                value={typeForm.name_en}
                onChange={(e) => setTypeForm((p) => ({ ...p, name_en: e.target.value }))}
                dir="ltr"
              />
            </div>
            <div>
              <Label>{isRTL ? 'الترتيب' : 'Sort Order'}</Label>
              <Input
                type="number"
                value={typeForm.sort_order}
                onChange={(e) => setTypeForm((p) => ({ ...p, sort_order: Number(e.target.value) }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTypeDialogOpen(false)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={submitType}>{isRTL ? 'حفظ' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================
         Subtype Dialog
         ============================================================ */}
      <Dialog open={subtypeDialogOpen} onOpenChange={setSubtypeDialogOpen}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>
              {editingSubtype
                ? (isRTL ? 'تعديل نوع فرعي' : 'Edit Subtype')
                : (isRTL ? 'إضافة نوع فرعي' : 'Add Subtype')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{isRTL ? 'النوع الأب' : 'Parent Type'}</Label>
              <Select value={subtypeParentTypeId} onValueChange={setSubtypeParentTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder={isRTL ? 'اختر النوع' : 'Select type'} />
                </SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {isRTL ? t.name_ar : t.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{isRTL ? 'الاسم (عربي)' : 'Name (Arabic)'}</Label>
              <Input
                value={subtypeForm.name_ar}
                onChange={(e) => setSubtypeForm((p) => ({ ...p, name_ar: e.target.value }))}
                dir="rtl"
              />
            </div>
            <div>
              <Label>{isRTL ? 'الاسم (إنجليزي)' : 'Name (English)'}</Label>
              <Input
                value={subtypeForm.name_en}
                onChange={(e) => setSubtypeForm((p) => ({ ...p, name_en: e.target.value }))}
                dir="ltr"
              />
            </div>
            <div>
              <Label>{isRTL ? 'الترتيب' : 'Sort Order'}</Label>
              <Input
                type="number"
                value={subtypeForm.sort_order}
                onChange={(e) => setSubtypeForm((p) => ({ ...p, sort_order: Number(e.target.value) }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubtypeDialogOpen(false)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={submitSubtype}>{isRTL ? 'حفظ' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================
         Model Dialog
         ============================================================ */}
      <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>
              {editingModel
                ? (isRTL ? 'تعديل موديل' : 'Edit Model')
                : (isRTL ? 'إضافة موديل' : 'Add Model')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{isRTL ? 'العلامة التجارية' : 'Brand'}</Label>
              <Input
                value={modelForm.brand}
                onChange={(e) => setModelForm((p) => ({ ...p, brand: e.target.value }))}
                placeholder="BMW, Harley-Davidson, ..."
                dir="ltr"
              />
            </div>
            <div>
              <Label>{isRTL ? 'اسم الموديل' : 'Model Name'}</Label>
              <Input
                value={modelForm.model_name}
                onChange={(e) => setModelForm((p) => ({ ...p, model_name: e.target.value }))}
                placeholder="R18, Sportster S, ..."
                dir="ltr"
              />
            </div>
            <div>
              <Label>{isRTL ? 'الترتيب' : 'Sort Order'}</Label>
              <Input
                type="number"
                value={modelForm.sort_order}
                onChange={(e) => setModelForm((p) => ({ ...p, sort_order: Number(e.target.value) }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModelDialogOpen(false)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={submitModel}>{isRTL ? 'حفظ' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================
         Delete Confirmation
         ============================================================ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL
                ? `هل أنت متأكد من حذف "${deleteTarget?.label ?? ''}"؟`
                : `Are you sure you want to delete "${deleteTarget?.label ?? ''}"?`}
              {deleteTarget?.kind === 'type' && deleteTarget.usageCount > 0 && (
                <div className="mt-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    {isRTL
                      ? `هذا النوع مرتبط بـ ${deleteTarget.usageCount} مستخدم/مدرب. سيتم فقدان التصنيف.`
                      : `This type is linked to ${deleteTarget.usageCount} user(s)/trainer(s). Their bikes will become uncategorized.`}
                  </span>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRTL ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </AdminLayout>
  );
};

export default AdminBikeCatalog;
